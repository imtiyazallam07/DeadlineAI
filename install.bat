@echo off
title Installing DeadlineAI Dependencies
echo ===================================================
echo [DeadlineAI] Installing all npm packages...
echo ===================================================
echo.

call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Installation failed! Please check your internet connection and Node.js installation.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [SUCCESS] All dependencies installed successfully!
echo           You can now run 'run.bat' to start the app.
echo ===================================================
pause
