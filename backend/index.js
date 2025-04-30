// index.js
import express from "express";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set } from "firebase/database";
import { promises as fs } from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

// —————————————————————————————————————————————————————————————————————————————
// 1) Your Firebase config
// —————————————————————————————————————————————————————————————————————————————
const firebaseConfig = {
  apiKey: "AIzaSyCkLaDFyOhAZXLeBYLZU9c0vQUDFTw8oYk",
  authDomain: "smart-water-meter-e01fd.firebaseapp.com",
  databaseURL: "https://smart-water-meter-e01fd-default-rtdb.firebaseio.com",
  projectId: "smart-water-meter-e01fd",
  storageBucket: "smart-water-meter-e01fd.firebasestorage.app",
  messagingSenderId: "28725079752",
  appId: "1:28725079752:web:9335f784cdfdb67447fffd",
};

// —————————————————————————————————————————————————————————————————————————————
// 2) Initialize Firebase & RTDB
// —————————————————————————————————————————————————————————————————————————————
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// —————————————————————————————————————————————————————————————————————————————
// 3) File path, max entries, device flag
// —————————————————————————————————————————————————————————————————————————————
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_FILE = path.join(__dirname, "data.json");
const MAX_ENTRIES = 10000;

let deviceStatus = false;

// —————————————————————————————————————————————————————————————————————————————
// 0) Minimal Express API to expose deviceStatus, deviceData & toggleValve
// —————————————————————————————————————————————————————————————————————————————
const apiApp = express();
apiApp.use(express.json()); // if you ever need JSON body parsing

// GET /deviceStatus → { deviceStatus: boolean }
apiApp.get("/deviceStatus", (_req, res) => {
  res.json({ deviceStatus });
});

// GET /deviceData → { flowRateLpm, totalVolumeL, valve }
apiApp.get("/deviceData", async (_req, res) => {
  try {
    const state = await fetchDeviceState();
    if (!state) {
      return res.status(503).json({ error: "Device state unavailable" });
    }
    const { flowRateLpm, totalVolumeL, valve } = state;
    return res.json({ flowRateLpm, totalVolumeL, valve });
  } catch (err) {
    console.error("Error in /deviceData:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /toggleValve → { valve: boolean }
apiApp.post("/toggleValve", async (_req, res) => {
  try {
    const state = await fetchDeviceState();
    if (!state || typeof state.valve !== "boolean") {
      return res.status(503).json({ error: "Valve state unavailable" });
    }
    const newValve = !state.valve;
    await set(ref(db, "/valve"), newValve);
    return res.json({ valve: newValve });
  } catch (err) {
    console.error("Error in /toggleValve:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
apiApp.listen(PORT, () => {
  console.log(`🚀 API server listening on http://localhost:${PORT}`);
});

// —————————————————————————————————————————————————————————————————————————————
// 4) Load (or bootstrap) data.json → returns an array
// —————————————————————————————————————————————————————————————————————————————
async function loadDataLog() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("data.json is not an array");
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("data.json not found — creating new file");
    } else {
      console.warn("Could not parse data.json, resetting to []:", err);
    }
    await fs.writeFile(DATA_FILE, "[]", "utf8");
    return [];
  }
}

// —————————————————————————————————————————————————————————————————————————————
// 5) Save the log back to disk
// —————————————————————————————————————————————————————————————————————————————
async function saveDataLog(arr) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(arr, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write data.json:", err);
    throw err;
  }
}

// —————————————————————————————————————————————————————————————————————————————
// 6) Fetch the entire device state from RTDB
// —————————————————————————————————————————————————————————————————————————————
async function fetchDeviceState() {
  try {
    const snap = await get(ref(db, "/"));
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.error("RTDB read error:", err);
    return null;
  }
}

// —————————————————————————————————————————————————————————————————————————————
// 7) Main: poll RTDB and maintain deviceStatus & logging
// —————————————————————————————————————————————————————————————————————————————
async function main() {
  const dataLog = await loadDataLog();
  let lastCounter =
    dataLog.length > 0 ? dataLog[dataLog.length - 1].counter : null;

  // Poll the database every 1.5 seconds
  setInterval(async () => {
    try {
      const state = await fetchDeviceState();
      if (!state) return;

      const { counter, flowRateLpm, totalVolumeL, valve } = state;

      if (counter !== lastCounter) {
        // counter changed → device is “on”
        deviceStatus = true;
        lastCounter = counter;

        const entry = {
          timestamp: new Date().toISOString(),
          counter,
          flowRateLpm,
          totalVolumeL,
          valve,
        };

        dataLog.push(entry);

        // trim oldest if over MAX_ENTRIES
        if (dataLog.length > MAX_ENTRIES) {
          dataLog.splice(0, dataLog.length - MAX_ENTRIES);
        }

        await saveDataLog(dataLog);
        console.log(deviceStatus);
        console.log("Counter changed — logged:", entry);
      } else {
        // no change → device is “off”
        deviceStatus = false;
      }
    } catch (err) {
      console.error("Error in polling loop:", err);
    }
  }, 1500);

  // Optional: watch and log deviceStatus every second
  // setInterval(() => {
  //   if (deviceStatus) {
  //     console.log("🚰 Device is ACTIVE");
  //   } else {
  //     console.log("💤 Device is INACTIVE");
  //   }
  // }, 1000);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
