# Fix iisnode 500 subStatus 1002 (HRESULT 0x2)
# Run as Administrator. Does: permissions on backend, npm cache clear, reminds about App Pool 32-bit.

param(
    [string]$BackendPath = "C:\Users\supawitn\Documents\GitHub\room-managemert-portal\backend"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix iisnode 500.1002 (HRESULT 0x2)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BackendPath)) {
    Write-Host "ERROR: Backend path not found: $BackendPath" -ForegroundColor Red
    exit 1
}

# 1) Permissions via fix-iis-permissions (-ForBackend = read+write so iisnode can create log files)
$fixPerms = Join-Path $PSScriptRoot "fix-iis-permissions.ps1"
if (Test-Path $fixPerms) {
    Write-Host "[1] Setting permissions on backend folder (read+write for iisnode logs)..." -ForegroundColor Yellow
    & $fixPerms -SitePath $BackendPath -ForBackend
    Write-Host ""
} else {
    Write-Host "[1] fix-iis-permissions.ps1 not found. Grant IIS_IUSRS, IUSR Modify on: $BackendPath and backend\iisnode" -ForegroundColor Yellow
}

# 2) npm cache clear
Write-Host "[2] Clearing npm cache in backend..." -ForegroundColor Yellow
Push-Location $BackendPath
try {
    npm cache clear --force
    Write-Host "    OK: npm cache cleared" -ForegroundColor Green
} catch {
    Write-Host "    WARNING: npm cache clear failed - $_" -ForegroundColor Yellow
} finally {
    Pop-Location
}

# 3) Reminders
Write-Host ""
Write-Host "[3] In IIS Manager, ensure:" -ForegroundColor Yellow
Write-Host "    - Application Pool for 'api': Enable 32-Bit Applications = False" -ForegroundColor White
Write-Host "    - Application Pool for 'api': .NET CLR = No Managed Code" -ForegroundColor White
Write-Host "    - Then: Recycle the Application Pool" -ForegroundColor White
Write-Host ""
Write-Host "Then test: http://localhost/api/ping" -ForegroundColor Cyan
