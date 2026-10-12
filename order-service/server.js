
const express = require("express");
const client = require("prom-client");

const app = express();
const PORT = 3002;

app.use(express.json());

const register = new client.Registry();

const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"]
});

// Histogram buckets chi tiết từ 5ms đến 5s phục vụ tính p50, p90, p95 chính xác
const responseTime = new client.Histogram({
  name: "http_response_time_seconds",
  help: "HTTP response time in seconds",
  labelNames: ["method", "route"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

// Business Metrics
const ordersCreatedCounter = new client.Counter({
  name: "orders_created_total",
  help: "Total number of orders created",
  labelNames: ["status"]
});

const activeOrdersGauge = new client.Gauge({
  name: "orders_processing_active",
  help: "Current number of orders being processed in background"
});

register.registerMetric(requestCounter);
register.registerMetric(responseTime);
register.registerMetric(ordersCreatedCounter);
register.registerMetric(activeOrdersGauge);

function getRoute(req) {
  if (req.route && req.route.path) {
    return req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.route.path;
  }
  const rawPath = req.path || req.originalUrl || "/";
  const path = rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
  return path.replace(/\/orders\/\d+/g, "/orders/:id");
}

app.use((req, res, next) => {
  const end = responseTime.startTimer();

  res.on("finish", () => {
    const route = getRoute(req);

    requestCounter.inc({
      method: req.method,
      route: route,
      status: String(res.statusCode)
    });

    end({
      method: req.method,
      route: route
    });
  });

  next();
});

const orders = [];
let nextId = 1;

app.get("/", (req, res) => {
  res.json({
    service: "HNT Order Service",
    status: "running"
  });
});

// Health check endpoint
const healthHandler = (req, res) => {
  res.json({
    status: "UP",
    service: "order-service",
    uptime: process.uptime()
  });
};
app.get("/health", healthHandler);
app.get("/actuator/health", healthHandler);

// Endpoint mô phỏng lỗi 500 có kiểm soát phục vụ kiểm thử HTTP Error Rate Panel
app.get("/orders/simulate-error", (req, res) => {
  res.status(500).json({
    error: "Simulated internal server error",
    service: "HNT Order Service",
    timestamp: new Date().toISOString()
  });
});

app.get("/orders", (req, res) => {
  res.json(orders);
});

app.post("/orders", (req, res) => {
  const { productId, quantity } = req.body;

  if (
    !Number.isInteger(productId) ||
    productId < 1 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    ordersCreatedCounter.inc({ status: "failed" });
    return res.status(400).json({
      error: "productId and quantity must be positive integers"
    });
  }

  const order = {
    id: nextId++,
    productId: productId,
    quantity: quantity,
    status: "created"
  };

  orders.push(order);
  ordersCreatedCounter.inc({ status: "success" });

  // Mô phỏng tác vụ xử lý đơn hàng: Gauge tăng lên, sau 3s xử lý xong thì Gauge giảm xuống
  activeOrdersGauge.inc();
  setTimeout(() => {
    activeOrdersGauge.dec();
  }, 3000);

  res.status(201).json(order);
});

// Prometheus metrics endpoint (hỗ trợ cả /metrics và /actuator/prometheus)
const metricsHandler = async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
};
app.get("/metrics", metricsHandler);
app.get("/actuator/prometheus", metricsHandler);

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});

