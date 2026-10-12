@echo off
title HNT Microservices - Traffic Generator Menu
cd /d "%~dp0"

echo ==========================================================
echo    HNT MICROSERVICES - PROMETHEUS & GRAFANA TRAFFIC TOOL  
echo ==========================================================
echo  1. Che do Binh thuong (Normal Traffic: 5 - 15 req/s)
echo  2. Che do Tai cao (Heavy Load: 50 - 100 req/s)
echo  3. Dot bien tai (Spike Burst: 200 requests tuc thi)
echo  4. Sinh loi kiem thu (Error Mode: 50 requests 4xx/5xx)
echo  5. Chay thu nhanh 30 giay roi tu tong ket (Quick Test)
echo ==========================================================
set /p choice="Chon che do (1-5, mac dinh la 1): "

if "%choice%"=="2" goto heavy
if "%choice%"=="3" goto spike
if "%choice%"=="4" goto errors
if "%choice%"=="5" goto quick
goto normal

:normal
echo Dang khoi dong che do Binh thuong...
node load-generator.js
goto end

:heavy
echo Dang khoi dong che do Tai cao...
node load-generator.js --heavy 25
goto end

:spike
echo Dang ban dot bien tai 200 requests...
node load-generator.js --spike 200
goto end

:errors
echo Dang sinh 50 requests loi...
node load-generator.js --errors 50
goto end

:quick
echo Dang chay thu nghiem 30 giay...
node load-generator.js --duration 30
goto end

:end
echo.
echo Hoan thanh! Nhan phim bat ky de thoat...
pause >nul
