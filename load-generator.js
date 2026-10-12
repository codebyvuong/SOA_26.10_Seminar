/**
 * Traffic & Load Generator for HNT Microservices Monitoring Demo
 * Zero-dependency: Uses Node.js native fetch (Node 18+)
 * 
 * Usage:
 *   node load-generator.js                    (Chế độ bình thường: 5 - 15 req/s)
 *   node load-generator.js --heavy [workers]  (Chế độ tải cao: 50 - 150 req/s)
 *   node load-generator.js --spike [count]    (Đột biến tải tức thì: 200 reqs dồn dập)
 *   node load-generator.js --errors [count]   (Sinh lỗi 4xx & 5xx có kiểm soát)
 *   node load-generator.js --duration [secs]  (Chạy trong N giây rồi tự dừng và báo cáo)
 */

const BASE_URL = process.env.GATEWAY_URL || "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 5000;

const stats = {
  total: 0,
  s2xx: 0,
  s4xx: 0,
  s5xx: 0,
  networkErrors: 0,
  startTime: Date.now()
};

let isShuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch có timeout để tránh treo kết nối
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Danh sách các kịch bản gọi API thực tế tới Gateway
const scenarios = [
  // 1. Xem danh sách sản phẩm (tần suất cao)
  {
    weight: 35,
    name: "GET /products",
    action: () => fetchWithTimeout(`${BASE_URL}/products`)
  },
  // 2. Xem chi tiết sản phẩm hợp lệ
  {
    weight: 25,
    name: "GET /products/:id",
    action: () => {
      const id = Math.floor(Math.random() * 3) + 1; // 1, 2, 3
      return fetchWithTimeout(`${BASE_URL}/products/${id}`);
    }
  },
  // 3. Tạo đơn hàng mới thành công (POST /orders) -> Tăng Counter & Gauge
  {
    weight: 20,
    name: "POST /orders (Success)",
    action: () => {
      const productId = Math.floor(Math.random() * 3) + 1;
      const quantity = Math.floor(Math.random() * 4) + 1;
      return fetchWithTimeout(`${BASE_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity })
      });
    }
  },
  // 4. Xem danh sách các đơn hàng đã đặt
  {
    weight: 10,
    name: "GET /orders",
    action: () => fetchWithTimeout(`${BASE_URL}/orders`)
  },
  // 5. Sinh lỗi 404: Sản phẩm không tồn tại
  {
    weight: 5,
    name: "GET /products/999 (404)",
    action: () => fetchWithTimeout(`${BASE_URL}/products/999`)
  },
  // 6. Sinh lỗi 400: Dữ liệu đặt hàng không hợp lệ
  {
    weight: 3,
    name: "POST /orders (400 Bad Request)",
    action: () =>
      fetchWithTimeout(`${BASE_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: "invalid", quantity: -10 })
      })
  },
  // 7. Sinh lỗi 500 có kiểm soát (Kiểm thử 5xx Error Rate Panel)
  {
    weight: 2,
    name: "GET /products/simulate-error (500 Server Error)",
    action: () => fetchWithTimeout(`${BASE_URL}/products/simulate-error`)
  }
];

// Tính toán trọng số ngẫu nhiên
const cumulativeWeights = [];
let totalWeight = 0;
for (const s of scenarios) {
  totalWeight += s.weight;
  cumulativeWeights.push(totalWeight);
}

function pickRandomScenario() {
  const r = Math.random() * totalWeight;
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (r <= cumulativeWeights[i]) return scenarios[i];
  }
  return scenarios[0];
}

async function sendRequest(scenario) {
  if (isShuttingDown) return;
  stats.total++;
  try {
    const res = await scenario.action();
    if (res.status >= 200 && res.status < 300) {
      stats.s2xx++;
    } else if (res.status >= 400 && res.status < 500) {
      stats.s4xx++;
    } else if (res.status >= 500) {
      stats.s5xx++;
    }
    return res.status;
  } catch (err) {
    stats.networkErrors++;
    return "NET_ERR";
  }
}

function printStatsLine() {
  const elapsedSec = Math.max(1, Math.round((Date.now() - stats.startTime) / 1000));
  const rps = (stats.total / elapsedSec).toFixed(1);
  const line = `[Traffic] Total: ${stats.total} | 2xx: \x1b[32m${stats.s2xx}\x1b[0m | 4xx: \x1b[33m${stats.s4xx}\x1b[0m | 5xx: \x1b[31m${stats.s5xx}\x1b[0m | NetErr: ${stats.networkErrors} | Rate: ${rps} req/s`;
  process.stdout.write(`\r${line}`);
}

function printFinalSummary() {
  const elapsedSec = Math.max(1, ((Date.now() - stats.startTime) / 1000)).toFixed(1);
  const rps = (stats.total / elapsedSec).toFixed(1);
  console.log("\n\n====================================================");
  console.log("            TRAFFIC GENERATOR SUMMARY               ");
  console.log("====================================================");
  console.log(` Target Gateway    : ${BASE_URL}`);
  console.log(` Running Duration  : ${elapsedSec} seconds`);
  console.log(` Total Requests    : ${stats.total}`);
  console.log(` Successful (2xx)  : \x1b[32m${stats.s2xx}\x1b[0m`);
  console.log(` Client Err (4xx)  : \x1b[33m${stats.s4xx}\x1b[0m`);
  console.log(` Server Err (5xx)  : \x1b[31m${stats.s5xx}\x1b[0m`);
  console.log(` Network Errors    : ${stats.networkErrors}`);
  console.log(` Average Rate      : ${rps} requests/second`);
  console.log("====================================================\n");
}

// Bắt tín hiệu ngắt (Ctrl + C) để in báo cáo nghiệm thu
process.on("SIGINT", () => {
  isShuttingDown = true;
  printFinalSummary();
  process.exit(0);
});

async function runNormalTraffic(durationSec = null) {
  console.log("\x1b[36m====================================================\x1b[0m");
  console.log("\x1b[36m  HNT MICROSERVICES - LOAD & TRAFFIC GENERATOR      \x1b[0m");
  console.log("\x1b[36m====================================================\x1b[0m");
  console.log(` Target Gateway : ${BASE_URL}`);
  console.log(" Chế độ         : Bình thường (Phát 5 - 15 req/s)");
  if (durationSec) {
    console.log(` Thời lượng     : Tự động dừng sau ${durationSec} giây`);
  } else {
    console.log(" Thời lượng     : Liên tục (Bấm [Ctrl + C] để dừng và xem tổng kết)");
  }
  console.log("----------------------------------------------------\n");

  const intervalId = setInterval(printStatsLine, 1000);

  const startTime = Date.now();
  while (!isShuttingDown) {
    if (durationSec && (Date.now() - startTime) >= durationSec * 1000) {
      break;
    }

    const batchSize = Math.floor(Math.random() * 4) + 1; // 1 đến 4 request đồng thời
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      promises.push(sendRequest(pickRandomScenario()));
    }
    await Promise.all(promises);

    const delay = Math.floor(Math.random() * 200) + 100;
    await sleep(delay);
  }

  clearInterval(intervalId);
  printFinalSummary();
}

async function runHeavyTraffic(concurrency = 25, durationSec = null) {
  console.log("\x1b[35m====================================================\x1b[0m");
  console.log("\x1b[35m   HNT MICROSERVICES - HEAVY LOAD & STRESS MODE     \x1b[0m");
  console.log("\x1b[35m====================================================\x1b[0m");
  console.log(` Target Gateway : ${BASE_URL}`);
  console.log(` Mức tải cao    : ${concurrency} luồng đồng thời (~50 - 100+ req/s)`);
  if (durationSec) {
    console.log(` Thời lượng     : Tự động dừng sau ${durationSec} giây`);
  } else {
    console.log(" Thời lượng     : Liên tục (Bấm [Ctrl + C] để dừng)");
  }
  console.log("----------------------------------------------------\n");

  const intervalId = setInterval(printStatsLine, 1000);

  const startTime = Date.now();
  while (!isShuttingDown) {
    if (durationSec && (Date.now() - startTime) >= durationSec * 1000) {
      break;
    }

    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(sendRequest(pickRandomScenario()));
    }
    await Promise.all(promises);
    await sleep(40);
  }

  clearInterval(intervalId);
  printFinalSummary();
}

async function runSpikeMode(count = 200) {
  console.log(`\x1b[31m[SPIKE MODE] Đang bắn ${count} requests dồn dập vào Gateway...\x1b[0m`);
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(sendRequest(pickRandomScenario()));
  }
  await Promise.all(promises);
  printFinalSummary();
}

async function runErrorsMode(count = 50) {
  console.log(`\x1b[33m[ERROR MODE] Đang phát sinh ${count} requests lỗi (4xx & 5xx)...\x1b[0m`);
  const errorScenarios = [scenarios[4], scenarios[5], scenarios[6]];
  const promises = [];
  for (let i = 0; i < count; i++) {
    const sc = errorScenarios[Math.floor(Math.random() * errorScenarios.length)];
    promises.push(sendRequest(sc));
  }
  await Promise.all(promises);
  printFinalSummary();
}

// Phân tích tham số dòng lệnh CLI
const args = process.argv.slice(2);
const spikeIdx = args.indexOf("--spike");
const errorIdx = args.indexOf("--errors");
const heavyIdx = args.indexOf("--heavy");
const durationIdx = args.indexOf("--duration");

let durationSec = null;
if (durationIdx !== -1 && args[durationIdx + 1]) {
  const d = parseInt(args[durationIdx + 1], 10);
  if (!isNaN(d) && d > 0) durationSec = d;
}

if (spikeIdx !== -1) {
  const countArg = parseInt(args[spikeIdx + 1], 10);
  const count = (!isNaN(countArg) && countArg > 0) ? countArg : 200;
  runSpikeMode(count).then(() => process.exit(0));
} else if (errorIdx !== -1) {
  const countArg = parseInt(args[errorIdx + 1], 10);
  const count = (!isNaN(countArg) && countArg > 0) ? countArg : 50;
  runErrorsMode(count).then(() => process.exit(0));
} else if (heavyIdx !== -1) {
  const concArg = parseInt(args[heavyIdx + 1], 10);
  const concurrency = (!isNaN(concArg) && concArg > 0) ? concArg : 25;
  runHeavyTraffic(concurrency, durationSec);
} else {
  runNormalTraffic(durationSec);
}
