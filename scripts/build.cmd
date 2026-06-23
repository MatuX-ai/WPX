@echo off
REM WPX Electron Build for Windows（版本 0.1.0 起，每次打包 patch+1）
cd /d I:\WPX
for /f "delims=" %%v in ('node scripts\bump-pack-version.mjs read') do set BUILD_VERSION=%%v
echo ========================================
echo   WPX Electron Builder v%BUILD_VERSION%
echo ========================================
echo [1/2] Building Vite frontend...
cd wpx-app
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Vite build failed!
    exit /b 1
)
cd ..

echo [2/2] Running electron-builder...
call npx electron-builder --win --config
if %ERRORLEVEL% NEQ 0 (
    echo electron-builder failed!
    exit /b 1
)

echo ========================================
echo   Build Complete! v%BUILD_VERSION%
echo ========================================
node scripts\bump-pack-version.mjs bump
if exist release (
    dir /s /b release\*.exe 2>nul
)
pause
