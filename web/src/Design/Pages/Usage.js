// src/components/Usage.js
import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
// React-Bootstrap imports
import { Container, Row, Col, Card, Table, Spinner } from "react-bootstrap";

export default function Usage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("http://localhost:3020/usage/daily")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => {
        console.error("Failed to load usage data:", err);
        setData([]); // avoid infinite spinner
      });
  }, []);

  const loading = data === null;

  return (
    <Container className="p-4">
      {loading ? (
        <div className="d-flex justify-content-center my-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : (
        <Card className="shadow-sm">
          <Card.Header as="h5">Daily Water Usage</Card.Header>
          <Card.Body>
            <Row>
              <Col md={5}>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Usage (L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => (
                      <tr key={item.date}>
                        <td>{item.date}</td>
                        <td>{item.usage}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Col>
              <Col md={7} style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="usage" name="Usage (L)" fill="steelblue" />
                  </BarChart>
                </ResponsiveContainer>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}
