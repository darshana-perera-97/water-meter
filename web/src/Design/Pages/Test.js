import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const API_BASE = "http://localhost:3020";

export default function Test() {
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [deviceData, setDeviceData] = useState({
    flowRateLpm: "–",
    totalVolumeL: "–",
    valve: null,
  });
  const [todayUsage, setTodayUsage] = useState(null);
  const [error, setError] = useState(null);

  // Fetchers
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

  const fetchTodayUsage = async () => {
    try {
      const res = await fetch(`${API_BASE}/usage/today`);
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error);
      }
      const data = await res.json();
      setTodayUsage(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load today's usage");
    }
  };

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

  useEffect(() => {
    fetchStatus();
    fetchData();
    fetchTodayUsage();

    const id = setInterval(() => {
      fetchStatus();
      fetchData();
      fetchTodayUsage();
    }, 5000);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="container my-5" style={{ maxWidth: 900 }}>
      <h1 className="text-center mb-4">Smart Water Meter Dashboard</h1>

      {error && <div className="alert alert-danger text-center">{error}</div>}

      <div className="row">
        {/* Device Status */}
        <div className="col-md-4 mb-3">
          <div className="card h-100 text-center">
            <div className="card-header">Device Status</div>
            <div className="card-body d-flex align-items-center justify-content-center">
              {deviceStatus === null ? (
                <div
                  className="spinner-border spinner-border-sm"
                  role="status"
                />
              ) : (
                <h2 className="card-title">
                  {deviceStatus ? "ACTIVE" : "INACTIVE"}
                </h2>
              )}
            </div>
          </div>
        </div>

        {/* Flow Rate */}
        <div className="col-md-4 mb-3">
          <div className="card h-100 text-center">
            <div className="card-header">Flow Rate</div>
            <div className="card-body d-flex align-items-center justify-content-center">
              <h2 className="card-title">
                {parseFloat(deviceData.flowRateLpm).toFixed(2)} L/min
              </h2>
            </div>
          </div>
        </div>

        {/* Total Volume */}
        <div className="col-md-4 mb-3">
          <div className="card h-100 text-center">
            <div className="card-header">Total Volume</div>
            <div className="card-body d-flex align-items-center justify-content-center">
              <h2 className="card-title">{deviceData.totalVolumeL} L</h2>
            </div>
          </div>
        </div>

        {/* Valve State */}
        <div className="col-md-4 mb-3">
          <div className="card h-100 text-center">
            <div className="card-header">Valve</div>
            <div className="card-body d-flex align-items-center justify-content-center">
              <h2 className="card-title">
                {deviceData.valve === null
                  ? "–"
                  : deviceData.valve
                  ? "OPEN"
                  : "CLOSED"}
              </h2>
            </div>
          </div>
        </div>

        {/* Today's Usage */}
        <div className="col-md-4 mb-3">
          <div className="card h-100 text-center">
            <div className="card-header">Today's Usage</div>
            <div className="card-body d-flex align-items-center justify-content-center">
              {todayUsage === null ? (
                <div
                  className="spinner-border spinner-border-sm"
                  role="status"
                />
              ) : (
                <div>
                  <h2 className="card-title">
                    {parseFloat(todayUsage.usage).toFixed(3)} L
                  </h2>
                  <small className="text-muted">{todayUsage.date}</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <div className="text-center mt-4">
        <button onClick={handleToggle} className="btn btn-primary btn-lg">
          Toggle Valve
        </button>
      </div>
    </div>
  );
}
