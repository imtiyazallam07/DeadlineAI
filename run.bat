@echo off
title Running DeadlineAI Development Server
echo ===================================================
echo [DeadlineAI] Starting local development server...
echo            Express Backend + Vite Frontend (Unified)
echo ===================================================
echo.

call npm run dev
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] The server stopped unexpectedly with exit code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)
