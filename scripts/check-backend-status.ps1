# ตรวจสอบสถานะ Backend: รันตรง (port 5000) vs ผ่าน IIS (/api/*)
# ใช้ดูว่า backend รันได้หรือไม่ และเมื่อไหร่ที่ผ่าน IIS ได้ 500

param(
    [string]$BaseUrl = "http://localhost"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ตรวจสอบสถานะ Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# [1] รันตรงด้วย Node (port 5000)
Write-Host "[1] รันตรงด้วย Node (http://localhost:5000/api/ping)" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/api/ping" -UseBasicParsing -TimeoutSec 3
    if ($r.Content -match '"status"\s*:\s*"OK"') {
        Write-Host "    OK: Backend รันได้เมื่อใช้ 'node server.js'" -ForegroundColor Green
    } else {
        Write-Host "    คำตอบ: $($r.Content.Substring(0, [Math]::Min(80, $r.Content.Length)))" -ForegroundColor Gray
    }
} catch {
    Write-Host "    ไม่รันหรือไม่มีคำตอบ (ยังไม่ได้สตาร์ท backend หรือพอร์ต 5000 ถูกใช้)" -ForegroundColor Yellow
    Write-Host "    รัน: cd backend; node server.js" -ForegroundColor Gray
}

# [2] ผ่าน IIS
$viaIisFailed = $false
Write-Host ""
Write-Host "[2] ผ่าน IIS ($BaseUrl/api/ping)" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/ping" -UseBasicParsing -TimeoutSec 5
    if ($r.Content -match '"status"\s*:\s*"OK"') {
        Write-Host "    OK: เข้า Backend ผ่าน IIS ได้" -ForegroundColor Green
    } else {
        $viaIisFailed = $true
        Write-Host "    คำตอบ (500 ตัวอักษรแรก): $($r.Content.Substring(0, [Math]::Min(500, $r.Content.Length)))" -ForegroundColor Gray
        if ($r.Content -match 'iisnode encountered an error|HRESULT|subStatus') {
            Write-Host "    ^ ปัญหา iisnode/Application Pool (เช่น HRESULT 0x2 / subStatus 1002) ดู [4] และ log ใน backend\iisnode\" -ForegroundColor Yellow
        } elseif ($r.Content -match 'Error|Exception|at\s+') {
            Write-Host "    ^ น่าจะเป็น error จาก Node ใน iisnode (devErrorsEnabled=true) ให้แก้จากข้อความด้านบน" -ForegroundColor Yellow
        }
    }
} catch {
    $viaIisFailed = $true
    $code = $null
    if ($_.Exception.Response) { $code = $_.Exception.Response.StatusCode.value__ }
    Write-Host "    Error: $code - $($_.Exception.Message)" -ForegroundColor Red
    if ($code -eq 500) {
        Write-Host "    เปิดในเบราว์เซอร์: $BaseUrl/api/ping" -ForegroundColor White
        Write-Host "    หน้าเว็บอาจแสดง error จริงของ Node (เมื่อ devErrorsEnabled=true)" -ForegroundColor Gray
    }
}

# [3] Path ของ Node
Write-Host ""
Write-Host "[3] Path ของ Node.js (web.config ใช้ 'C:\Program Files\nodejs\node.exe')" -ForegroundColor Yellow
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($nodePath) {
    Write-Host "    เจอ: $nodePath" -ForegroundColor Green
    if ($nodePath -notlike "*Program Files*nodejs*") {
        Write-Host "    ถ้าไม่ตรงกับ web.config แก้ backend\web.config ใน nodeProcessCommandLine" -ForegroundColor Yellow
    }
} else {
    Write-Host "    ไม่พบ node ใน PATH" -ForegroundColor Red
}

# [4] เมื่อ [2] ไม่ผ่าน: แสดง tail ของ log iisnode และขั้นตอนถัดไป
$repoRoot = Split-Path -Parent $PSScriptRoot
$iisnodeDir = Join-Path $repoRoot "backend\iisnode"
if ($viaIisFailed) {
    Write-Host ""
    Write-Host "[4] Log ของ iisnode (backend\iisnode\)" -ForegroundColor Yellow
    if (Test-Path $iisnodeDir) {
        $logs = Get-ChildItem -Path $iisnodeDir -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
        if ($logs.Count -gt 0) {
            $latest = $logs[0]
            Write-Host "    ไฟล์ล่าสุด: $($latest.Name)" -ForegroundColor Gray
            $lines = Get-Content -Path $latest.FullName -Tail 40 -ErrorAction SilentlyContinue
            if ($lines) {
                foreach ($l in $lines) { Write-Host "    $l" -ForegroundColor Gray }
            }
        } else {
            Write-Host "    ยังไม่มีไฟล์ log = process น่าจะล้มก่อน Node สตาร์ท (เช่น HRESULT 0x2 = ไม่พบไฟล์/path)" -ForegroundColor Gray
            Write-Host "    ตรวจ: App Pool ตั้ง 32-bit=False, .NET CLR=No Managed Code; สิทธิ์โฟลเดอร์ backend; จากนั้น Recycle pool" -ForegroundColor Gray
        }
    } else {
        Write-Host "    ไม่เจอโฟลเดอร์: $iisnodeDir" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "    ขั้นถัดไป: เปิดในเบราว์เซอร์ → $BaseUrl/api/ping (อาจเห็น stderr เต็ม) หรือรันแก้: .\fix-iis-500-substatus-1002.ps1" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "ถ้า [1] OK แต่ [2] 500 = ปัญหา iisnode หรือ Application Pool ดู log ใน backend\iisnode\" -ForegroundColor Cyan
