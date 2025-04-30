import express from "express";
import cors from "cors";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set } from "firebase/database";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

// —————————————————————————————————————————————————————————————————————————————
// 1) Your Firebase config
// —————————————————————————————————————————————————————————————————————————————
const firebaseConfig = {
  apiKey: "AIzaSyCkLaDFyOhAZXLeBYLZU9c0vQUDFTw8oYk",
  authDomain: "smart-water-meter-e01fd.firebaseapp.com",
  databaseURL: "https://smart-water-meter-e01fd-default-rtdb.firebaseio.com",
  projectId: "smart-water-meter-e01fd",
  storageBucket: "smart-water-meter-e01fd.appspot.com",
  messagingSenderId: "28725079752",
  appId: "1:28725079752:web:9335f784cdfdb67447fffd",
};

// —————————————————————————————————————————————————————————————————————————————
// 2) Initialize Firebase & RTDB
// —————————————————————————————————————————————————————————————————————————————
const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

// —————————————————————————————————————————————————————————————————————————————
// 3) File paths & constants
// —————————————————————————————————————————————————————————————————————————————
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data.json");
const USAGE_FILE = path.join(__dirname, "usage.json");
const MAX_ENTRIES = 10000;

let deviceStatus = false;

// —————————————————————————————————————————————————————————————————————————————
// Helper: current Sri Lanka time as ISO+05:30
// —————————————————————————————————————————————————————————————————————————————
function getSriLankaTimestamp() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const lkaMs = utcMs + 5.5 * 60 * 60 * 1000;
  return new Date(lkaMs).toISOString().replace("Z", "+05:30");
}

// —————————————————————————————————————————————————————————————————————————————
// Helper: today’s date in Sri Lanka (YYYY-MM-DD)
// —————————————————————————————————————————————————————————————————————————————
function getSriLankaDate() {
  return getSriLankaTimestamp().slice(0, 10);
}

// —————————————————————————————————————————————————————————————————————————————
// Load (or init) data.json → array of { timestamp, counter, … }
// —————————————————————————————————————————————————————————————————————————————
async function loadDataLog() {
  let raw;
  try {
    raw = await fs.readFile(DATA_FILE, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      await fs.writeFile(DATA_FILE, "[]", "utf8");
      return [];
    }
    console.warn("loadDataLog read error:", err);
    await fs.writeFile(DATA_FILE, "[]", "utf8");
    return [];
  }
  if (!raw.trim()) {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
    return [];
  }
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    console.warn("loadDataLog parse error – resetting file:", err);
    await fs.writeFile(DATA_FILE, "[]", "utf8");
    return [];
  }
}

// —————————————————————————————————————————————————————————————————————————————
// Compute usage for a given date from full log
// —————————————————————————————————————————————————————————————————————————————
function computeUsageForDate(dataLog, date) {
  let min = Infinity,
    max = -Infinity,
    found = false;
  for (const { timestamp, totalVolumeL } of dataLog) {
    if (timestamp.startsWith(date)) {
      found = true;
      if (totalVolumeL < min) min = totalVolumeL;
      if (totalVolumeL > max) max = totalVolumeL;
    }
  }
  return found ? +(max - min).toFixed(3) : null;
}

// —————————————————————————————————————————————————————————————————————————————
// Scheduled job: update usage.json with today’s value
// —————————————————————————————————————————————————————————————————————————————
async function updateTodayUsage() {
  try {
    const today = getSriLankaDate();
    const log = await loadDataLog();
    const usage = computeUsageForDate(log, today);
    if (usage === null) {
      console.log(`No log entries for ${today}; skipping update.`);
      return;
    }

    let arr = [];
    try {
      const raw = await fs.readFile(USAGE_FILE, "utf8");
      arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [];
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }

    const idx = arr.findIndex((e) => e.date === today);
    if (idx >= 0) {
      arr[idx].usage = usage;
      console.log(`Updated usage for ${today}: ${usage}`);
    } else {
      arr.push({ date: today, usage });
      console.log(`Added usage for ${today}: ${usage}`);
    }

    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    await fs.writeFile(USAGE_FILE, JSON.stringify(arr, null, 2), "utf8");
  } catch (err) {
    console.error("Error in updateTodayUsage():", err);
  }
}

// run every minute, Sri Lanka time
cron.schedule(
  "*/1 * * * *",
  () => {
    updateTodayUsage();
  },
  { timezone: "Asia/Colombo" }
);

// —————————————————————————————————————————————————————————————————————————————
// Express API
// —————————————————————————————————————————————————————————————————————————————
const apiApp = express();
apiApp.use(cors());
apiApp.use(express.json());

// GET /deviceStatus
apiApp.get("/deviceStatus", (_req, res) => {
  res.json({ deviceStatus });
});

// GET /deviceData
apiApp.get("/deviceData", async (_req, res) => {
  try {
    const snap = await get(ref(db, "/"));
    if (!snap.exists())
      return res.status(503).json({ error: "Device state unavailable" });
    const { flowRateLpm, totalVolumeL, valve } = snap.val();
    res.json({ flowRateLpm, totalVolumeL, valve });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /toggleValve
apiApp.post("/toggleValve", async (_req, res) => {
  try {
    const snap = await get(ref(db, "/valve"));
    if (!snap.exists() || typeof snap.val() !== "boolean") {
      return res.status(503).json({ error: "Valve state unavailable" });
    }
    const newV = !snap.val();
    await set(ref(db, "/valve"), newV);
    res.json({ valve: newV });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /data/last1800
apiApp.get("/data/last1800", async (_req, res) => {
  try {
    const log = await loadDataLog();
    res.json(log.slice(-600));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /data/all
apiApp.get("/data/all", async (_req, res) => {
  try {
    const log = await loadDataLog();
    res.json(log);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /usage/daily → full history
apiApp.get("/usage/daily", async (_req, res) => {
  try {
    const raw = await fs.readFile(USAGE_FILE, "utf8");
    const arr = JSON.parse(raw);
    res.json(Array.isArray(arr) ? arr : []);
  } catch (err) {
    if (err.code === "ENOENT") return res.json([]);
    console.error("Error in /usage/daily:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// —————————————————————————————————————————————————————————————————————————————
// NEW: GET /usage/today → compute and return today's usage
// —————————————————————————————————————————————————————————————————————————————
apiApp.get("/usage/today", async (_req, res) => {
  try {
    const today = getSriLankaDate();
    const log = await loadDataLog();
    const usage = computeUsageForDate(log, today);
    if (usage === null) {
      return res.status(404).json({ error: `No usage data for ${today}` });
    }
    res.json({ date: today, usage });
  } catch (err) {
    console.error("Error in /usage/today:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// —————————————————————————————————————————————————————————————————————————————
// 7) Polling loop → log to data.json
// —————————————————————————————————————————————————————————————————————————————
async function main() {
  const dataLog = await loadDataLog();
  let lastCounter =
    dataLog.length > 0 ? dataLog[dataLog.length - 1].counter : null;
  let offTimer = null;

  setInterval(async () => {
    try {
      const snap = await get(ref(db, "/"));
      if (!snap.exists()) return;
      const s = snap.val();

      if (s.counter !== lastCounter) {
        deviceStatus = true;
        lastCounter = s.counter;
        if (offTimer) {
          clearTimeout(offTimer);
          offTimer = null;
        }

        const entry = {
          timestamp: getSriLankaTimestamp(),
          counter: s.counter,
          flowRateLpm: s.flowRateLpm,
          totalVolumeL: s.totalVolumeL,
          valve: s.valve,
        };

        dataLog.push(entry);
        if (dataLog.length > MAX_ENTRIES) {
          dataLog.splice(0, dataLog.length - MAX_ENTRIES);
        }
        await fs.writeFile(DATA_FILE, JSON.stringify(dataLog, null, 2), "utf8");
        console.log("Device ON — logged:", entry);
      } else if (!offTimer) {
        offTimer = setTimeout(() => {
          deviceStatus = false;
          offTimer = null;
          console.log("No updates for 5s — deviceStatus set to OFF");
        }, 5000);
      }
    } catch (err) {
      console.error("Error in polling loop:", err);
    }
  }, 2000);
}

// —————————————————————————————————————————————————————————————————————————————
const PORT = process.env.PORT || 3020;
apiApp.listen(PORT, () => {
  console.log(`🚀 API server listening on http://localhost:${PORT}`);
});
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
