@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo       RONAQ ERP - Windows Build
echo ==========================================
where node >nul 2>nul
if errorlevel 1 (echo Node.js is not installed. Install Node.js LTS first.& pause & exit /b 1)
where npm >nul 2>nul
if errorlevel 1 (echo npm is not available.& pause & exit /b 1)
echo [1/4] Installing project dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (echo Dependency installation failed.& pause & exit /b 1)
echo [2/4] Running TypeScript type check...
call npm run typecheck
if errorlevel 1 (echo Type check failed. Installer will not be built.& pause & exit /b 1)
echo [3/4] Running optional Python smoke tests...
where python >nul 2>nul
if errorlevel 1 goto skip_python_tests
call npm run test:db
if errorlevel 1 (echo Smoke tests failed. Installer will not be built.& pause & exit /b 1)
goto build_installer
:skip_python_tests
echo Python is not installed. Skipping optional Python smoke tests.
:build_installer
echo [4/4] Building Windows installer...
call npm run dist:win
if errorlevel 1 (echo Windows installer build failed.& pause & exit /b 1)
echo.
echo Build complete. Check the release folder for the Setup EXE.
pause
