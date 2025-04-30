// test.js
import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:3020";

export default function Test() {
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [deviceData, setDeviceData] = useState({
    flowRateLpm: "–",
    totalVolumeL: "–",
    valve: null,
  });
  const [error, setError] = useState(null);

  // Fetch deviceStatus
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/deviceStatus`);
      const { deviceStatus } = await res.json();
      setDeviceStatus(deviceStatus);
    } catch (e) {
      console.error(e);
      setError("Failed to load status");
    }
  };

  // Fetch deviceData
  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/deviceData`);
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error);
      }
      const data = await res.json();
      setDeviceData(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load data");
    }
  };

  // Toggle valve
  const handleToggle = async () => {
    try {
      const res = await fetch(`${API_BASE}/toggleValve`, { method: "POST" });
      if (!res.ok) throw new Error("Toggle failed");
      const { valve } = await res.json();
      setDeviceData((d) => ({ ...d, valve }));
    } catch (e) {
      console.error(e);
      setError("Failed to toggle valve");
    }
  };

  // Initial load + polling
  useEffect(() => {
    fetchStatus();
    fetchData();
    const id = setInterval(() => {
      fetchStatus();
      fetchData();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "2rem auto" }}
    >
      <h1>Smart Water Meter Dashboard</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <section style={{ marginBottom: "1rem" }}>
        <strong>Device Status:</strong>{" "}
        {deviceStatus === null
          ? "Loading…"
          : deviceStatus
          ? "ACTIVE"
          : "INACTIVE"}
      </section>

      <section style={{ marginBottom: "1rem" }}>
        <strong>Device Data:</strong>
        <ul>
          <li>Flow Rate (L/min): {deviceData.flowRateLpm}</li>
          <li>Total Volume (L): {deviceData.totalVolumeL}</li>
          <li>
            Valve is:{" "}
            {deviceData.valve === null
              ? "–"
              : deviceData.valve
              ? "OPEN"
              : "CLOSED"}
          </li>
        </ul>
      </section>

      <section style={{ textAlign: "center" }}>
        <button
          onClick={handleToggle}
          style={{ padding: "0.5rem 1rem", fontSize: "1rem" }}
        >
          Toggle Valve
        </button>
      </section>
    </div>
  );
}
