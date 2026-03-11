# Fix IIS permissions for Site physical path
# RUN THIS SCRIPT AS ADMINISTRATOR (Right-click PowerShell -> Run as administrator)
# -ForBackend: grant Modify (read+write) so iisnode can create log files in backend\iisnode

param(
    [string]$SitePath = "C:\Users\supawitn\Documents\GitHub\room-managemert-portal\frontend\dist",
    [switch]$ForBackend
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as administrator'" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $SitePath)) {
    Write-Host "ERROR: Path not found: $SitePath" -ForegroundColor Red
    exit 1
}

$rights = if ($ForBackend) { "Modify" } else { "ReadAndExecute" }
$rightsDesc = if ($ForBackend) { "Read & Write (Modify)" } else { "Read & Execute" }
Write-Host "Setting permissions for: $SitePath" -ForegroundColor Cyan
if ($ForBackend) { Write-Host "Mode: Backend (iisnode needs write to create logs)" -ForegroundColor Yellow }
Write-Host ""

# Accounts that need access
$accounts = @("IIS_IUSRS", "IUSR")

foreach ($account in $accounts) {
    try {
        $acl = Get-Acl -Path $SitePath
        $permission = "$account", $rights, "ContainerInherit,ObjectInherit", "None", "Allow"
        $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
        $acl.SetAccessRule($accessRule)
        Set-Acl -Path $SitePath -AclObject $acl
        Write-Host "OK: Granted $rightsDesc to $account" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Could not add $account - $_" -ForegroundColor Yellow
    }
}

# Also grant to "Users" if folder is under User profile (often needed for Documents)
try {
    $acl = Get-Acl -Path $SitePath
    $permission = "Users", $rights, "ContainerInherit,ObjectInherit", "None", "Allow"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
    $acl.SetAccessRule($accessRule)
    Set-Acl -Path $SitePath -AclObject $acl
    Write-Host "OK: Granted $rightsDesc to Users" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not add Users - $_" -ForegroundColor Yellow
}

# For backend: grant traverse (ReadAndExecute) on parent chain so Node realpathSync/lstat can resolve paths
# Error "EPERM: operation not permitted, lstat 'C:\Users\supawitn\Documents'" means App Pool cannot traverse parents
if ($ForBackend) {
    Write-Host "Granting traverse on parent folders (so Node realpathSync/lstat can resolve paths)..." -ForegroundColor Yellow
    $folder = (Resolve-Path $SitePath).Path
    $traverseCount = 0
    do {
        $parent = Split-Path -Parent $folder
        if (-not $parent -or $parent -eq $folder -or -not (Test-Path $parent)) { break }
        try {
            $acl = Get-Acl -Path $parent
            foreach ($account in $accounts) {
                $perm = "$account", "ReadAndExecute", "ContainerInherit", "None", "Allow"
                $rule = New-Object System.Security.AccessControl.FileSystemAccessRule $perm
                $acl.SetAccessRule($rule)
            }
            Set-Acl -Path $parent -AclObject $acl
            Write-Host "    OK: Traverse on $parent" -ForegroundColor Gray
            $traverseCount++
        } catch {
            Write-Host "    WARNING: $parent - $_" -ForegroundColor Yellow
        }
        $folder = $parent
    } while ($true)
    Write-Host "    Traverse granted on $traverseCount parent folder(s)." -ForegroundColor Gray
    Write-Host ""
}

# For backend: ensure iisnode folder exists and has write permission (iisnode creates log files there)
if ($ForBackend) {
    $iisnodeDir = Join-Path $SitePath "iisnode"
    if (-not (Test-Path $iisnodeDir)) {
        New-Item -ItemType Directory -Path $iisnodeDir -Force | Out-Null
        Write-Host "OK: Created folder iisnode" -ForegroundColor Green
    }
    try {
        $acl = Get-Acl -Path $iisnodeDir
        foreach ($account in $accounts) {
            $permission = "$account", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow"
            $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
            $acl.SetAccessRule($accessRule)
        }
        Set-Acl -Path $iisnodeDir -AclObject $acl
        Write-Host "OK: Granted Modify on iisnode\ to IIS_IUSRS, IUSR" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Could not set iisnode permissions - $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done. Try opening http://localhost again." -ForegroundColor Cyan
if ($ForBackend) {
    Write-Host "Backend: iisnode can now write logs to $SitePath\iisnode" -ForegroundColor Gray
}
Write-Host "If it still fails, in IIS Manager set the Site's Application Pool identity to a local account with access to this folder." -ForegroundColor Gray
