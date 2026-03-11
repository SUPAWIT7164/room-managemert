# ============================================
# Build Frontend สำหรับ Deploy (รวมหน้า bookings/avaliable)
# รันสคริปต์นี้ก่อน deploy ไป bms-dev หรือ IIS
# ============================================

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $projectRoot "frontend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build Frontend - Room Management Portal" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $frontendPath)) {
    Write-Host "ERROR: frontend folder not found at $frontendPath" -ForegroundColor Red
    exit 1
}

Push-Location $frontendPath
try {
    Write-Host "[1/2] Installing dependencies..." -ForegroundColor Yellow
    npm ci 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm ci failed, trying npm install..." -ForegroundColor Yellow
        npm install
    }
    Write-Host "[2/2] Building production..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host ""
    Write-Host "OK: Frontend build สำเร็จ" -ForegroundColor Green
    Write-Host "   ไฟล์อยู่ที่: frontend\dist\" -ForegroundColor Gray
    Write-Host ""
    Write-Host "ขั้นตอนถัดไป:" -ForegroundColor Cyan
    Write-Host "  1. Deploy ไปเซิร์ฟเวอร์: รัน scripts\deploy-to-iis.ps1 (แก้ -IISPath ตาม path จริง)" -ForegroundColor Gray
    Write-Host "  2. หรือคัดลอกเนื้อหาใน frontend\dist ไปยังโฟลเดอร์เว็บบน bms-dev" -ForegroundColor Gray
    Write-Host "  3. Restart Backend (หรือ Application Pool ของ /api) ถ้าแก้ backend ด้วย" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
