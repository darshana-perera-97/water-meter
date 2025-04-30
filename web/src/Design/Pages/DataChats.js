// src/components/DataChats.js
import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function DataChats() {
  const [last1800, setLast1800] = useState([]);
  const [allData, setAllData] = useState([]);
  const [activeTab, setActiveTab] = useState("volume");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch("http://localhost:3020/data/last1800"),
          fetch("http://localhost:3020/data/all"),
        ]);
        const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
        if (!mounted) return;
        setLast1800(j1);
        setAllData(j2);
      } catch (e) {
        console.error("Fetch error", e);
      }
    };
    load();
    const iv = setInterval(load, 1000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  const metricConfig = {
    volume: {
      field: "totalVolumeL",
      label: "Total Volume (L)",
      borderColor: "rgba(255,0,0,1)",
      backgroundColor: "rgba(255,0,0,0.2)",
      stepped: false,
      yLabel: "Liters",
    },
    flow: {
      field: "flowRateLpm",
      label: "Flow Rate (L/min)",
      borderColor: "rgba(0,0,255,1)",
      backgroundColor: "rgba(0,0,255,0.2)",
      stepped: false,
      yLabel: "L/min",
    },
    valve: {
      field: "valve",
      label: "Valve State (1=on,0=off)",
      borderColor: "rgba(0,128,0,1)",
      backgroundColor: "rgba(0,128,0,0.2)",
      stepped: true,
      yLabel: "State",
    },
  };

  const buildChartData = (dataArray) => {
    const cfg = metricConfig[activeTab];
    const sorted = [...dataArray].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    return {
      labels: sorted.map((pt) => pt.timestamp),
      datasets: [
        {
          label: cfg.label,
          data: sorted.map((pt) =>
            activeTab === "valve" ? (pt.valve ? 1 : 0) : pt[cfg.field]
          ),
          borderColor: cfg.borderColor,
          backgroundColor: cfg.backgroundColor,
          fill: false,
          tension: 0.1,
          stepped: cfg.stepped,
          pointRadius: cfg.stepped ? 2 : 0,
        },
      ],
    };
  };

  const options = {
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "top" } },
    scales: {
      x: {
        type: "time",
        time: { tooltipFormat: "PPpp", unit: "minute" },
        title: { display: true, text: "Time" },
      },
      y: {
        title: { display: true, text: metricConfig[activeTab].yLabel },
        ticks:
          activeTab === "valve" ? { stepSize: 1, min: 0, max: 1 } : undefined,
      },
    },
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Tab buttons */}
      <div style={{ marginBottom: 20 }}>
        {Object.keys(metricConfig).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              marginRight: 10,
              padding: "6px 12px",
              fontWeight: activeTab === tab ? "bold" : "normal",
            }}
          >
            {metricConfig[tab].label}
          </button>
        ))}
      </div>

      {/* Two‐column flex: left=last1800, right=allData */}
      <div style={{ display: "flex", width: "100%" }}>
        <div style={{ width: "50%", paddingRight: 10 }}>
          <h4>{metricConfig[activeTab].label} — Last 1,800 Entries</h4>
          <Line data={buildChartData(last1800)} options={options} />
        </div>
        <div style={{ width: "50%", paddingLeft: 10 }}>
          <h4>{metricConfig[activeTab].label} — All Entries</h4>
          <Line data={buildChartData(allData)} options={options} />
        </div>
      </div>
    </div>
  );
}
