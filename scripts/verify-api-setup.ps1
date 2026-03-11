# Verify API / Backend setup for IIS
# Run this to check if http://localhost/api/health or /health responds (backend reached via IIS)

param(
    [string]$BaseUrl = "http://localhost"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verify API setup (IIS)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$healthUrls = @(
    "$BaseUrl/api/ping",
    "$BaseUrl/api/health",
    "$BaseUrl/ping",
    "$BaseUrl/health"
)

$ok = $false
foreach ($url in $healthUrls) {
    Write-Host "Testing: $url" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            # Backend returns JSON with "status":"OK" - reject HTML (SPA fallback)
            if ($response.Content -match '"status"\s*:\s*"OK"') {
                Write-Host "OK: Backend responded (Status 200, JSON)" -ForegroundColor Green
                Write-Host "Content: $($response.Content.Substring(0, [Math]::Min(120, $response.Content.Length)))..." -ForegroundColor Gray
                $ok = $true
                break
            } else {
                Write-Host "200 but not backend JSON (got HTML/other). Backend may not be reached." -ForegroundColor Yellow
            }
        }
    } catch {
        $statusCode = $null
        $body = $null
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }
        if ($statusCode -eq 404) {
            Write-Host "404 Not Found - Backend not reached. Add Application 'api' in IIS." -ForegroundColor Red
        } elseif ($statusCode -eq 500 -and $body) {
            Write-Host "500 Internal Server Error. Response snippet:" -ForegroundColor Red
            $snippet = $body.Substring(0, [Math]::Min(400, $body.Length))
            Write-Host $snippet -ForegroundColor Gray
            Write-Host "Open $url in browser to see full iisnode/Node error." -ForegroundColor Yellow
        } elseif ($_.Exception.Message -match "500\.19|0x80070005|insufficient permissions") {
            Write-Host "500.19 / Permission denied - Grant IIS read access to the backend folder (run fix-iis-permissions.ps1)." -ForegroundColor Red
        } else {
            Write-Host "Error: $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
if (-not $ok) {
    Write-Host "Backend was not reached. Follow these steps:" -ForegroundColor Yellow
    Write-Host "1. Open IIS Manager (Win+R -> inetmgr)" -ForegroundColor White
    Write-Host "2. Under your Site, Add Application:" -ForegroundColor White
    Write-Host "   - Alias: api" -ForegroundColor White
    Write-Host "   - Physical path: ...\room-managemert-portal\backend" -ForegroundColor White
    Write-Host "3. See: scripts\IIS_API_APPLICATION_SETUP.md" -ForegroundColor White
    exit 1
}

Write-Host "API setup OK. You can try logging in at http://localhost/login" -ForegroundColor Green
