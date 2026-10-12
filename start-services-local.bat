@echo off
title HNT Microservices - Local Runner (Khong can Docker)
cd /d "%~dp0"

echo ==========================================================
echo    KHOI DONG CAC DICH VU HNT MICROSERVICES (NODE.JS)     
echo ==========================================================
echo Dang bat Product Service (Port 3001)...
start "HNT - Product Service (3001)" cmd /k "cd /d ""%~dp0product-service"" && node server.js"

timeout /t 2 /nobreak >nul
echo Dang bat Order Service (Port 3002)...
start "HNT - Order Service (3002)" cmd /k "cd /d ""%~dp0order-service"" && node server.js"

timeout /t 2 /nobreak >nul
echo Dang bat API Gateway (Port 3000)...
start "HNT - API Gateway (3000)" cmd /k "cd /d ""%~dp0api-gateway"" && node server.js"

echo.
echo ==========================================================
echo  Tat ca 3 services da duoc bat tren cac cua so rieng!
echo  - API Gateway:     http://localhost:3000
echo  - Product Service: http://localhost:3001
echo  - Order Service:   http://localhost:3002
echo.
echo  De sinh traffic thu nghiem, ban hay mo tiep start-traffic.bat
echo ==========================================================
pause
