@echo off
REM ========================================
REM Script de déploiement FRONTEND UNIQUEMENT
REM ========================================
REM Copie les fichiers statiques sans rebuild
REM ========================================

echo.
echo ========================================
echo DEPLOIEMENT FRONTEND UNIQUEMENT
echo ========================================
echo.

PowerShell -ExecutionPolicy Bypass -File "%~dp0deploy-frontend-only.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Appuyez sur une touche pour fermer...
    pause > nul
) else (
    echo.
    echo ERREUR lors du deploiement
    pause
)
