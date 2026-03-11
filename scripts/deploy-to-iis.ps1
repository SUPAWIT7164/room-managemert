# ============================================
# Deploy Room Management Portal to IIS
# ============================================

param(
    [string]$IISPath = "C:\inetpub\wwwroot\room-portal",
    [string]$SiteName = "RoomPortal",
    [string]$NodePath = "C:\Program Files\nodejs\node.exe",
    [switch]$SkipBuild = $false,
    [switch]$SkipBackend = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Room Management Portal - IIS Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "[1/8] Checking Node.js..." -ForegroundColor Yellow
if (-not (Test-Path $NodePath)) {
    Write-Host "ERROR: Node.js not found at $NodePath" -ForegroundColor Red
    Write-Host "Please check Node.js path or modify -NodePath parameter" -ForegroundColor Red
    exit 1
}
$nodeVersion = & $NodePath --version
Write-Host "OK: Found Node.js $nodeVersion" -ForegroundColor Green

# Check npm
$npmPath = Join-Path (Split-Path $NodePath) "npm.cmd"
if (-not (Test-Path $npmPath)) {
    Write-Host "ERROR: npm not found" -ForegroundColor Red
    exit 1
}

# Check project structure
Write-Host "[2/8] Checking project structure..." -ForegroundColor Yellow
$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $projectRoot "frontend"
$backendPath = Join-Path $projectRoot "backend"

if (-not (Test-Path $frontendPath)) {
    Write-Host "ERROR: frontend folder not found" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: backend folder not found" -ForegroundColor Red
    exit 1
}
Write-Host "OK: Project structure is valid" -ForegroundColor Green

# Check/create .env.production
Write-Host "[3/8] Checking .env.production file..." -ForegroundColor Yellow
$envProductionPath = Join-Path $frontendPath ".env.production"
if (-not (Test-Path $envProductionPath)) {
    Write-Host "Creating .env.production file..." -ForegroundColor Yellow
    @"
# Production Environment Variables
VITE_API_BASE_URL=/api
"@ | Out-File -FilePath $envProductionPath -Encoding UTF8
    Write-Host "OK: Created .env.production file" -ForegroundColor Green
} else {
    $envContent = Get-Content $envProductionPath -Raw
    if ($envContent -notmatch "VITE_API_BASE_URL") {
        Write-Host "Adding VITE_API_BASE_URL to .env.production..." -ForegroundColor Yellow
        Add-Content -Path $envProductionPath -Value "`nVITE_API_BASE_URL=/api" -Encoding UTF8
        Write-Host "OK: Added VITE_API_BASE_URL" -ForegroundColor Green
    } else {
        Write-Host "OK: .env.production already has VITE_API_BASE_URL" -ForegroundColor Green
    }
}

# Build Frontend
if (-not $SkipBuild) {
    Write-Host "[4/8] Building Frontend..." -ForegroundColor Yellow
    Push-Location $frontendPath
    
    try {
        Write-Host "Installing dependencies..." -ForegroundColor Gray
        # Try npm ci first, fallback to npm install if it fails
        & $npmPath ci
        if ($LASTEXITCODE -ne 0) {
            Write-Host "npm ci failed, trying npm install..." -ForegroundColor Yellow
            & $npmPath install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed"
            }
        }
        
        Write-Host "Building production..." -ForegroundColor Gray
        & $npmPath run build
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed"
        }
        
        Write-Host "OK: Frontend build successful" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Frontend build failed: $_" -ForegroundColor Red
        Write-Host "You may need to:" -ForegroundColor Yellow
        Write-Host "  1. Close any programs using node_modules (VS Code, etc.)" -ForegroundColor Yellow
        Write-Host "  2. Run PowerShell as Administrator" -ForegroundColor Yellow
        Write-Host "  3. Build manually: cd frontend && npm install && npm run build" -ForegroundColor Yellow
        Pop-Location
        exit 1
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[4/8] Skipping Frontend build (using -SkipBuild)" -ForegroundColor Yellow
}

# Check frontend/dist
$frontendDistPath = Join-Path $frontendPath "dist"
if (-not (Test-Path $frontendDistPath)) {
    if ($SkipBuild) {
        Write-Host "WARNING: frontend/dist folder not found. Skipping frontend copy." -ForegroundColor Yellow
        Write-Host "Please build frontend manually: cd frontend && npm install && npm run build" -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: frontend/dist folder not found. Please build first." -ForegroundColor Red
        exit 1
    }
}

# Check web.config in frontend/dist
$frontendWebConfig = Join-Path $frontendDistPath "web.config"
$frontendPublicWebConfig = Join-Path $frontendPath "public\web.config"
if (-not (Test-Path $frontendWebConfig)) {
    if (Test-Path $frontendPublicWebConfig) {
        Write-Host "Copying web.config from public..." -ForegroundColor Yellow
        Copy-Item $frontendPublicWebConfig $frontendWebConfig
        Write-Host "OK: Copied web.config" -ForegroundColor Green
    } else {
        Write-Host "WARNING: web.config not found in frontend/dist and frontend/public" -ForegroundColor Yellow
    }
}

# Prepare Backend
if (-not $SkipBackend) {
    Write-Host "[5/8] Preparing Backend..." -ForegroundColor Yellow
    
    # Check .env in backend
    $backendEnvPath = Join-Path $backendPath ".env"
    if (-not (Test-Path $backendEnvPath)) {
        Write-Host "WARNING: backend/.env file not found" -ForegroundColor Yellow
        Write-Host "Please create .env file in backend and configure according to env.example.txt" -ForegroundColor Yellow
    }
    
    # Check web.config in backend
    $backendWebConfig = Join-Path $backendPath "web.config"
    if (-not (Test-Path $backendWebConfig)) {
        Write-Host "ERROR: backend/web.config file not found" -ForegroundColor Red
        exit 1
    }
    
    # Check node path in web.config
    $webConfigContent = Get-Content $backendWebConfig -Raw
    if ($webConfigContent -notmatch [regex]::Escape($NodePath)) {
        Write-Host "Updating node path in web.config..." -ForegroundColor Yellow
        $webConfigContent = $webConfigContent -replace 'nodeProcessCommandLine="[^"]*"', "nodeProcessCommandLine=`"$NodePath`""
        $webConfigContent | Out-File -FilePath $backendWebConfig -Encoding UTF8 -NoNewline
        Write-Host "OK: Updated node path" -ForegroundColor Green
    }
    
    Write-Host "OK: Backend is ready" -ForegroundColor Green
} else {
    Write-Host "[5/8] Skipping Backend preparation (using -SkipBackend)" -ForegroundColor Yellow
}

# Create destination folders
Write-Host "[6/8] Creating destination folders..." -ForegroundColor Yellow
$apiPath = Join-Path $IISPath "api"

if (-not (Test-Path $IISPath)) {
    New-Item -ItemType Directory -Path $IISPath -Force | Out-Null
    Write-Host "OK: Created folder $IISPath" -ForegroundColor Green
}

if (-not (Test-Path $apiPath)) {
    New-Item -ItemType Directory -Path $apiPath -Force | Out-Null
    Write-Host "OK: Created folder $apiPath" -ForegroundColor Green
}

# Copy Frontend files
if (Test-Path $frontendDistPath) {
    Write-Host "[7/8] Copying Frontend files..." -ForegroundColor Yellow
    Write-Host "Copying from $frontendDistPath to $IISPath" -ForegroundColor Gray
    Get-ChildItem -Path $frontendDistPath | Copy-Item -Destination $IISPath -Recurse -Force
    Write-Host "OK: Frontend files copied successfully" -ForegroundColor Green
} else {
    Write-Host "[7/8] Skipping Frontend copy (dist folder not found)" -ForegroundColor Yellow
}

# Copy Backend files
if (-not $SkipBackend) {
    Write-Host "[8/8] Copying Backend files..." -ForegroundColor Yellow
    Write-Host "Copying from $backendPath to $apiPath" -ForegroundColor Gray
    
    # Copy necessary files (exclude node_modules, .git, etc.)
    $excludePatterns = @("node_modules", ".git", "iisnode", "*.log")
    
    Get-ChildItem -Path $backendPath -File | Where-Object {
        $exclude = $false
        foreach ($pattern in $excludePatterns) {
            if ($_.Name -like $pattern) {
                $exclude = $true
                break
            }
        }
        -not $exclude
    } | Copy-Item -Destination $apiPath -Force
    
    Get-ChildItem -Path $backendPath -Directory | Where-Object {
        $_.Name -notin @("node_modules", ".git", "iisnode")
    } | ForEach-Object {
        $destDir = Join-Path $apiPath $_.Name
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Get-ChildItem -Path $_.FullName -Recurse | Copy-Item -Destination $destDir -Recurse -Force
    }
    
    Write-Host "OK: Backend files copied successfully" -ForegroundColor Green
    
    # Install dependencies in backend (production only)
    Write-Host "Installing dependencies in Backend (production)..." -ForegroundColor Yellow
    Push-Location $apiPath
    try {
        & $npmPath ci --production
        if ($LASTEXITCODE -ne 0) {
            Write-Host "WARNING: npm ci --production failed. Please install manually." -ForegroundColor Yellow
        } else {
            Write-Host "OK: Dependencies installed successfully" -ForegroundColor Green
        }
    } catch {
        Write-Host "WARNING: Cannot install dependencies: $_" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
    
    # Create writable directories
    $writableDirs = @(
        "public\uploads",
        "storage\processed_images",
        "iisnode"
    )
    foreach ($dir in $writableDirs) {
        $fullPath = Join-Path $apiPath $dir
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            Write-Host "OK: Created folder $dir" -ForegroundColor Green
        }
    }
} else {
    Write-Host "[8/8] Skipping Backend copy (using -SkipBackend)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploy completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open IIS Manager" -ForegroundColor White
Write-Host "2. Create new Site (or use existing Site)" -ForegroundColor White
Write-Host "   - Site name: $SiteName" -ForegroundColor White
Write-Host "   - Physical path: $IISPath" -ForegroundColor White
Write-Host "   - Binding: HTTP, Port 80" -ForegroundColor White
Write-Host "3. Add Application '/api' under Site" -ForegroundColor White
Write-Host "   - Alias: api" -ForegroundColor White
Write-Host "   - Physical path: $apiPath" -ForegroundColor White
Write-Host "4. Configure Application Pool for '/api':" -ForegroundColor White
Write-Host "   - .NET CLR Version: No Managed Code" -ForegroundColor White
Write-Host "5. Set folder permissions:" -ForegroundColor White
Write-Host "   - Give IIS AppPool and IUSR read access to $IISPath and $apiPath" -ForegroundColor White
Write-Host "   - Give backend write access to $apiPath\public\uploads, $apiPath\storage\processed_images, $apiPath\iisnode" -ForegroundColor White
Write-Host ""
Write-Host "See IIS_DEPLOYMENT.md for more details" -ForegroundColor Cyan
