
const express = require("express");
const client = require("prom-client");

const app = express();
const PORT = 3000;

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:3001";

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://localhost:3002";

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
  // Chuẩn hóa dynamic parameters để tránh High Cardinality trong Prometheus
  return path
    .replace(/\/products\/\d+/g, "/products/:id")
    .replace(/\/orders\/\d+/g, "/orders/:id");
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

async function forwardRequest(targetUrl, req, res) {
  try {
    const options = {
      method: req.method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const text = await response.text();

    res.status(response.status);

    if (response.headers.get("content-type")) {
      res.set("Content-Type", response.headers.get("content-type"));
    }

    res.send(text);
  } catch (error) {
    res.status(502).json({
      error: "Service unavailable",
      message: error.message
    });
  }
}

app.get("/", (req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return res.redirect("http://localhost:3003");
  }
  res.json({
    service: "HNT API Gateway",
    status: "running",
    endpoints: {
      products: "/products",
      orders: "/orders",
      metrics: "/metrics",
      health: "/health",
      dashboard: "http://localhost:3003"
    }
  });
});

app.get("/dashboard", (req, res) => {
  res.redirect("http://localhost:3003");
});

// Health check endpoint
const healthHandler = (req, res) => {
  res.json({
    status: "UP",
    service: "api-gateway",
    uptime: process.uptime()
  });
};
app.get("/health", healthHandler);
app.get("/actuator/health", healthHandler);

app.use("/products", (req, res) => {
  const targetUrl = PRODUCT_SERVICE_URL + req.originalUrl;
  forwardRequest(targetUrl, req, res);
});

app.use("/orders", (req, res) => {
  const targetUrl = ORDER_SERVICE_URL + req.originalUrl;
  forwardRequest(targetUrl, req, res);
});

// Prometheus metrics endpoint (hỗ trợ cả /metrics và /actuator/prometheus)
const metricsHandler = async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
};
app.get("/metrics", metricsHandler);
app.get("/actuator/prometheus", metricsHandler);

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

