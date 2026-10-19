# SOURCE CODE - PROMETHEUS & GRAFANA MONITORING DEMO

Thu muc chua toan bo ma nguon quan trong va can thiet nhat de van hanh buoi Seminar / Workshop giam sat he thong (Observability Stack) voi Prometheus, Grafana, Alertmanager, Webhook Receiver va FastAPI Demo App.

## 1. Cau Truc Thu Muc

- `app/`: Ung dung FastAPI duoc tich hop do luong metrics Prometheus (Counter, Histogram, Gauge).
- `prometheus/`: File cau hinh `prometheus.yml` va luat canh bao `alert.rules.yml`.
- `grafana/`: Cau hinh datasource va dashboard mau `demo-dashboard.json`.
- `alertmanager/`: File cau hinh dinh tuyen canh bao `alertmanager.template.yml` va token Telegram.
- `webhook-receiver/`: Microservice FastAPI nhan thong bao Webhook tu Alertmanager (HTTP POST JSON).
- `loadgen/`: Dinh nghia background load generator container chay ngam.
- `scripts/`: Cac tap lenh PowerShell (.ps1) va Bash (.sh) dung trong buoi thuyet trinh va demo:
  - `start.ps1` / `start.sh`: Khoi chay toan bo stack.
  - `stop.ps1` / `stop.sh`: Dung stack an toan.
  - `traffic-normal.ps1`: Tao luong truy cap binh thuong (HTTP 200).
  - `traffic-heavy.ps1`: Tao luong tai lon voi RPS cao.
  - `traffic-error.ps1`: Tao loi HTTP 500 de kich hoat canh bao DemoHighErrorRate.
  - `traffic-slow.ps1`: Tao do tre cao de kich hoat canh bao DemoHighLatency.
  - `traffic-stop.ps1`: Dung sinh tai va tat chaos mode.
  - `test-alert.ps1`: Kiem thu tu dong vong doi canh bao FIRING va RESOLVED.
  - `view-webhook.ps1`: Xem thong tin canh bao nhan duoc tu Webhook Receiver.
- `tests/`: Bo kiem thu tu dong (Unit & Integration Tests) kiem tra tinh dung dan cua metrics va webhook.
- `docker-compose.yml`: File dieu phoi toan bo 6 dich vu trong he thong.
- `.env`: File bien moi truong cau hinh cac cong ket noi va token.

## 2. Huong Dan Khoi Chay Nhanh

### Buoc 1: Khoi dong stack
Chay tap lenh sau trong PowerShell:
```powershell
.\scripts\start.ps1
```
Hoac tren Linux / macOS:
```bash
bash scripts/start.sh
```

### Buoc 2: Truy cap cac cong dich vu tren trinh duyet
- Demo App API: http://localhost:8000
- Prometheus Metrics thô: http://localhost:8000/metrics
- Prometheus Web UI: http://localhost:9091
- Prometheus Alerts: http://localhost:9091/alerts
- Alertmanager UI: http://localhost:9093
- Grafana Dashboard: http://localhost:3005 (Tai khoan: admin / admin)
- Webhook Receiver Log: http://localhost:5001/alerts/latest

### Buoc 3: Cac kich ban demo thuc chien
1. Sinh tai tao loi HTTP 500:
```powershell
.\scripts\traffic-error.ps1
```
2. Sinh tai lon (Heavy Traffic):
```powershell
.\scripts\traffic-heavy.ps1
```
3. Sinh tai do tre cao (Slow):
```powershell
.\scripts\traffic-slow.ps1
```
4. Dung va khoi phuc he thong:
```powershell
.\scripts\traffic-stop.ps1
```
5. Kiem thu tu dong toan bo vong doi canh bao:
```powershell
.\scripts\test-alert.ps1
```

### Buoc 4: Dung he thong
```powershell
.\scripts\stop.ps1
```
