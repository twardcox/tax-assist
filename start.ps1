# UTBIS — start backend and frontend dev servers
# Usage: .\start.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting UTBIS..." -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root'; python -m uvicorn api.main:app --reload --port 8000"
)

# Frontend
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\frontend'; npm run dev"
)

Write-Host ""
Write-Host "  API:       http://localhost:8000" -ForegroundColor Green
Write-Host "  Docs:      http://localhost:8000/docs" -ForegroundColor Green
Write-Host "  Dashboard: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Both servers opening in new windows. Press Ctrl+C in each to stop." -ForegroundColor Gray
