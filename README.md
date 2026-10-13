# 🚀 HNT Microservices - Monitoring & Observability

Hệ thống Microservices mô phỏng thương mại điện tử tích hợp giám sát với **Prometheus** và **Grafana**.

---

## 📌 1. Danh mục Dịch vụ & Cổng truy cập

| Dịch vụ | Host Port | Container Port | URL | Ghi chú |
| :--- | :---: | :---: | :--- | :--- |
| **API Gateway** | `3000` | `3000` | http://localhost:3000 | Reverse Proxy. Truy cập trình duyệt tự redirect sang Grafana |
| **Product Service** | `3001` | `3001` | http://localhost:3001 | Quản lý thông tin sản phẩm |
| **Order Service** | `3002` | `3002` | http://localhost:3002 | Quản lý & xử lý đơn hàng |
| **Prometheus** | `9090` | `9090` | http://localhost:9090 | Thu thập metrics (scrape định kỳ `5s`) |
| **Grafana** | `3003` | `3000` | http://localhost:3003 | Dashboard tự động nạp. **Vào trực tiếp (Anonymous Admin)** |

---

## ⚡ 2. Hướng dẫn khởi chạy

### Cách 1: Chạy bằng Docker Compose (Khuyên dùng)
Khởi động toàn bộ 5 dịch vụ (Gateway, Product, Order, Prometheus, Grafana):
```bash
docker compose up -d --build
```
- Kiểm tra trạng thái: `docker compose ps`
- Dừng hệ thống: `docker compose down`

### Cách 2: Chạy Local (Node.js 18+)
Cài đặt dependencies và chạy 3 service:
```bash
# Cài đặt thư viện
cd api-gateway && npm install && cd ..
cd product-service && npm install && cd ..
cd order-service && npm install && cd ..

# Khởi chạy cả 3 service bằng script (Windows)
start-services-local.bat
```
*(Lưu ý: Chạy local chỉ khởi động 3 node service, cần Docker nếu muốn chạy thêm Prometheus & Grafana).*

---

## 📡 3. Danh mục API Endpoint

Mọi request từ client đều đi qua **API Gateway** (`http://localhost:3000`):

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/` | Trả về thông tin Gateway (trên Browser tự chuyển sang Grafana `:3003`) |
| `GET` | `/dashboard` | Chuyển hướng nhanh tới Grafana Dashboard |
| `GET` | `/health`, `/actuator/health` | Health check trạng thái từng service |
| `GET` | `/metrics`, `/actuator/prometheus` | Xuất dữ liệu metric chuẩn Prometheus |
| `GET` | `/products` | Lấy danh sách sản phẩm |
| `GET` | `/products/:id` | Xem chi tiết sản phẩm (ID hợp lệ: `1`, `2`, `3`; khác: trả `404`) |
| `GET` | `/products/simulate-error` | Giả lập lỗi `500 Internal Server Error` |
| `GET` | `/orders` | Lấy danh sách đơn hàng đã tạo |
| `POST` | `/orders` | Tạo đơn hàng mới (`productId`, `quantity` phải là số nguyên dương) |
| `GET` | `/orders/simulate-error` | Giả lập lỗi `500 Internal Server Error` |

### Lệnh cURL mẫu:
```bash
# 1. Lấy danh sách sản phẩm
curl http://localhost:3000/products

# 2. Xem sản phẩm ID 1
curl http://localhost:3000/products/1

# 3. Tạo đơn hàng mới (Dùng file order.json có sẵn)
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -d @order.json

# 4. Giả lập lỗi 500 để test cảnh báo
curl http://localhost:3000/products/simulate-error
curl http://localhost:3000/orders/simulate-error
```

---

## 📊 4. Metrics & Giám sát

Hệ thống thu thập các metrics chính sau qua Prometheus (`scrape_interval: 5s`):

| Loại Metric | Tên Metric | Type | Labels / Mô tả |
| :--- | :--- | :---: | :--- |
| **Traffic / Request** | `http_requests_total` | Counter | `method`, `route`, `status` |
| **Latency** | `http_response_time_seconds` | Histogram | `method`, `route` (buckets: 5ms - 5s) |
| **Đơn hàng thành công/thất bại** | `orders_created_total` | Counter | `status="success"` / `status="failed"` |
| **Đơn hàng đang xử lý nền** | `orders_processing_active` | Gauge | Tăng khi nhận đơn, tự giảm sau 3s xử lý |
| **Tính khả dụng** | `up` | Gauge | `1`: Hoạt động, `0`: Mất kết nối |

### Dashboard Grafana (`HNT Microservices Overview`):
Tự động nạp sẵn tại `http://localhost:3003` gồm 9 panels:
1. **Service Availability**: Trạng thái UP/DOWN của từng service.
2. **Total HTTP Requests**: Tổng request toàn hệ thống.
3. **Business: Total Orders Created**: Tổng đơn hàng thành công.
4. **Business: Active Orders Processing**: Số đơn đang xử lý ngầm đồng thời.
5. **Request Rate (req/s)**: Biến thiên tải theo thời gian trên từng service.
6. **HTTP 5xx Error Rate (%)**: Tỷ lệ lỗi server (ngưỡng vàng > 1%, đỏ > 5%).
7. **Request Latency: p95 (seconds)**: Độ trễ phản hồi phân vị 95.
8. **HTTP Error Distribution**: Chi tiết lưu lượng lỗi `4xx` và `5xx`.
9. **Order Creation Rate**: Tốc độ phát sinh đơn hàng (đơn/phút).

---

## 📁 5. Cấu trúc thư mục

```text
├── api-gateway/            # Port 3000: Reverse proxy, chuẩn hoá route, forward request
├── product-service/        # Port 3001: Quản lý sản phẩm, giả lập lỗi 500
├── order-service/          # Port 3002: Đặt hàng, giả lập tác vụ nền 3s
├── prometheus/             # Cấu hình scrape jobs (5s)
├── grafana/                # Provisioning datasource và dashboard tự động
├── docker-compose.yml      # Cấu hình cụm 5 container
├── start-services-local.bat# Script bật nhanh 3 service Node.js local
└── order.json              # Dữ liệu payload đơn hàng mẫu
```
