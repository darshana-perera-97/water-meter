// src/components/DataCharts.js
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

// React-Bootstrap imports
import { Container, Row, Col, Nav, Card, Spinner } from "react-bootstrap";

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function DataCharts() {
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
      label: "Valve State",
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

  // Show spinner until at least the last1800 data is loaded
  const loading = !last1800.length;

  return (
    <Container className="p-4">
      <Nav
        variant="tabs"
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
      >
        {Object.entries(metricConfig).map(([key, cfg]) => (
          <Nav.Item key={key}>
            <Nav.Link eventKey={key}>{cfg.label}</Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center my-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : (
        <Row className="mt-4">
          <Col md={6}>
            <Card className="mb-4 shadow-sm">
              <Card.Header>Last 1,800 Entries</Card.Header>
              <Card.Body>
                <Line data={buildChartData(last1800)} options={options} />
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="mb-4 shadow-sm">
              <Card.Header>All Entries</Card.Header>
              <Card.Body>
                <Line data={buildChartData(allData)} options={options} />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}
