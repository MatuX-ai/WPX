# WPX Electron 构建脚本（增强版，含镜像配置）
$ErrorActionPreference = 'Stop'

Write-Host "=== WPX Electron Build Script (with mirror) ===" -ForegroundColor Cyan

# ── 配置镜像（国内网络环境）────────────────────────────────────
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
# 使用淘宝 NPM 镜像加速
$env:NPM_CONFIG_REGISTRY = "https://registry.npmmirror.com/"
# 设置 electron-get 使用 npmmirror
$env:ELECTRON_GET_DOWNLOAD_HOST = "https://npmmirror.com/mirrors/electron/"
# 关闭 GitHub Releases 直接下载
$env:ELECTRON_NO_ATTACH_CONSOLE = "1"

Write-Host "`n[Mirror] ELECTRON_MIRROR = $env:ELECTRON_MIRROR" -ForegroundColor DarkGray
Write-Host "[Mirror] ELECTRON_BUILDER_BINARIES_MIRROR = $env:ELECTRON_BUILDER_BINARIES_MIRROR" -ForegroundColor DarkGray

# ── Step 0: 显示本次打包版本 ─────────────────────────────────────
$buildVersion = node (Join-Path $PSScriptRoot "bump-pack-version.mjs") read
Write-Host "`n[Version] Packaging WPX v$buildVersion" -ForegroundColor Cyan

# ── Step 1: Build Vite frontend ─────────────────────────────────
Write-Host "`n[Step 1/3] Building Vite frontend..." -ForegroundColor Yellow
Push-Location wpx-app
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Vite build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "[Step 1/3] Vite build complete!" -ForegroundColor Green

# ── Step 2: 预下载 Electron 二进制（避免 600s 超时）────────────
Write-Host "`n[Step 2.5/3] Pre-downloading Electron binary..." -ForegroundColor Yellow
$electronVersion = "42.4.1"
$electronZipName = "electron-v$electronVersion-win32-x64.zip"
$electronCacheDir = Join-Path $env:LOCALAPPDATA "electron\Cache"
$electronZipPath = Join-Path $electronCacheDir $electronZipName

if (-not (Test-Path $electronZipPath)) {
    Write-Host "  Downloading from mirror: $env:ELECTRON_MIRROR" -ForegroundColor DarkGray
    Write-Host "  Target: $electronZipPath" -ForegroundColor DarkGray
    
    New-Item -ItemType Directory -Path $electronCacheDir -Force | Out-Null
    
    $downloadUrl = "$($env:ELECTRON_MIRROR)v$electronVersion/$electronZipName"
    Write-Host "  URL: $downloadUrl" -ForegroundColor DarkGray
    
    try {
        # 优先使用 PowerShell 7+ 的 Invoke-WebRequest -Resume
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $ProgressPreference = 'SilentlyContinue'  # 禁用进度条干扰
        Invoke-WebRequest -Uri $downloadUrl -OutFile $electronZipPath -UseBasicParsing -TimeoutSec 1800
        Write-Host "  [OK] Electron binary downloaded" -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] Pre-download failed: $_" -ForegroundColor Yellow
        Write-Host "  Will retry via electron-builder download" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  [CACHED] Electron binary exists" -ForegroundColor Green
}

# ── Step 3: Run electron-builder ───────────────────────────────
Write-Host "`n[Step 3/3] Running electron-builder for Windows..." -ForegroundColor Yellow
npx electron-builder --win --config
if ($LASTEXITCODE -ne 0) {
    Write-Host "electron-builder failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[Step 3/3] electron-builder complete!" -ForegroundColor Green

# ── 打包成功后递增版本号（0.1.0 起，patch+1，>100 进位 minor）────
node (Join-Path $PSScriptRoot "bump-pack-version.mjs") bump | Write-Host

# ── 显示产物 ────────────────────────────────────────────────
Write-Host "`n[Output] Build artifacts:" -ForegroundColor Yellow
if (Test-Path "release") {
    Get-ChildItem -Path "release" -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
        $sizeKB = [math]::Round($_.Length / 1KB, 1)
        Write-Host ("  {0,-60} {1,12:N1} KB" -f $_.Name, $sizeKB) -ForegroundColor White
    }
}
Write-Host "`n=== Build Complete! ===" -ForegroundColor Green
Write-Host "Installer: $PSScriptRoot\..\release\WPX-Setup-$buildVersion.exe" -ForegroundColor Cyan