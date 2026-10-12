
const express = require("express");
const client = require("prom-client");

const app = express();
const PORT = 3001;

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

register.registerMetric(requestCounter);
register.registerMetric(responseTime);

function getRoute(req) {
  if (req.route && req.route.path) {
    return req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.route.path;
  }
  const rawPath = req.path || req.originalUrl || "/";
  const path = rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
  return path.replace(/\/products\/\d+/g, "/products/:id");
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

const products = [
  { id: 1, name: "Laptop", price: 15000000 },
  { id: 2, name: "Mouse", price: 250000 },
  { id: 3, name: "Keyboard", price: 750000 }
];

app.get("/", (req, res) => {
  res.json({
    service: "HNT Product Service",
    status: "running"
  });
});

// Health check endpoint
const healthHandler = (req, res) => {
  res.json({
    status: "UP",
    service: "product-service",
    uptime: process.uptime()
  });
};
app.get("/health", healthHandler);
app.get("/actuator/health", healthHandler);

// Endpoint mô phỏng lỗi 500 có kiểm soát phục vụ kiểm thử HTTP Error Rate Panel
app.get("/products/simulate-error", (req, res) => {
  res.status(500).json({
    error: "Simulated internal server error",
    service: "HNT Product Service",
    timestamp: new Date().toISOString()
  });
});

app.get("/products", (req, res) => {
  res.json(products);
});

app.get("/products/:id", (req, res) => {
  const product = products.find(
    (item) => item.id === Number(req.params.id)
  );

  if (!product) {
    return res.status(404).json({
      error: "Product not found"
    });
  }

  res.json(product);
});

// Prometheus metrics endpoint (hỗ trợ cả /metrics và /actuator/prometheus)
const metricsHandler = async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
};
app.get("/metrics", metricsHandler);
app.get("/actuator/prometheus", metricsHandler);

app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
});

