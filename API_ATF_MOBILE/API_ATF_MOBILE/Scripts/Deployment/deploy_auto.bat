@echo off
REM ===========================================
REM Script de déploiement API_ATF_MOBILE
REM ===========================================

:menu
cls
echo.
echo 🚀 Déploiement API_ATF_MOBILE
echo ================================
echo.

REM Vérifier si PowerShell est disponible
powershell -Command "Get-Host" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PowerShell n'est pas disponible
    pause
    exit /b 1
)

REM Afficher le menu
echo Choisissez une option :
echo.
echo 1. Déploiement complet (avec vérifications)
echo 2. Déploiement rapide
echo 3. Déploiement avec logs détaillés
echo 4. Déploiement sans build (redéploiement uniquement)
echo 5. Test de connectivité serveur
echo 6. Quitter
echo.

set /p choice="Votre choix (1-6): "

if "%choice%"=="1" (
    echo.
    echo Deploiement complet...
    powershell -ExecutionPolicy Bypass -File "deploy-fixed.ps1"
) else if "%choice%"=="2" (
    echo.
    echo Deploiement rapide...
    powershell -ExecutionPolicy Bypass -File "deploy-quick.ps1"
) else if "%choice%"=="3" (
    echo.
    echo Déploiement avec logs détaillés...
    powershell -ExecutionPolicy Bypass -File "deploy-fixed.ps1" -Verbose
) else if "%choice%"=="4" (
    echo.
    echo Redéploiement sans build...
    powershell -ExecutionPolicy Bypass -File "deploy-fixed.ps1" -SkipBuild
) else if "%choice%"=="5" (
    echo.
    echo 🔍 Test de connectivité...
    powershell -ExecutionPolicy Bypass -Command "Test-Connection -ComputerName '10.250.13.4' -Count 1 -Quiet; if ($?) { Write-Host '✅ Serveur accessible' -ForegroundColor Green } else { Write-Host '❌ Serveur inaccessible' -ForegroundColor Red }"
) else if "%choice%"=="6" (
    echo.
    echo 👋 Au revoir !
    exit /b 0
) else (
    echo.
    echo ❌ Choix invalide
)

echo.
pause
goto menu
