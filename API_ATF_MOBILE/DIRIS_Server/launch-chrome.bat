@echo off
echo ========================================
echo    DIRIS Server - Lancement Chrome
echo ========================================
echo.

REM Vérifier si le serveur est déjà en cours d'exécution
netstat -an | findstr ":5001" >nul
if %errorlevel% == 0 (
    echo Le serveur DIRIS est déjà en cours d'exécution sur le port 5001
    echo Ouverture de Chrome...
    start chrome "http://localhost:5001"
    goto :end
)

REM Aller dans le dossier du serveur
cd /d "%~dp0"

REM Vérifier si le dossier dist existe
if not exist "dist" (
    echo Erreur: Le dossier 'dist' n'existe pas.
    echo Veuillez d'abord compiler le serveur avec:
    echo   dotnet publish src/Diris.Server -c Release -o dist
    pause
    exit /b 1
)

REM Vérifier si l'exécutable existe
if not exist "dist\Diris.Server.exe" (
    echo Erreur: L'exécutable 'Diris.Server.exe' n'existe pas dans le dossier dist.
    echo Veuillez d'abord compiler le serveur avec:
    echo   dotnet publish src/Diris.Server -c Release -o dist
    pause
    exit /b 1
)

echo Démarrage du serveur DIRIS...
echo.

REM Démarrer le serveur en arrière-plan
start /b "DIRIS-Server" "dist\Diris.Server.exe"

REM Attendre que le serveur démarre (5 secondes)
echo Attente du démarrage du serveur (5 secondes)...
timeout /t 5 /nobreak >nul

REM Vérifier si le serveur répond
echo Vérification de la disponibilité du serveur...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5001/health/live' -TimeoutSec 5; if ($response.StatusCode -eq 200) { Write-Host 'Serveur prêt!' -ForegroundColor Green } else { Write-Host 'Serveur non prêt' -ForegroundColor Red } } catch { Write-Host 'Serveur non accessible' -ForegroundColor Red }"

REM Ouvrir Chrome avec les différentes pages
echo.
echo Ouverture de Chrome avec les interfaces DIRIS...
echo.

REM Page d'accueil
start chrome "http://localhost:5001"

REM Attendre un peu avant d'ouvrir les autres onglets
timeout /t 2 /nobreak >nul

REM Tableau de bord
start chrome "http://localhost:5001/dashboard.html"

REM Attendre un peu
timeout /t 1 /nobreak >nul

REM Courbes
start chrome "http://localhost:5001/charts.html"

REM Attendre un peu
timeout /t 1 /nobreak >nul

REM Health check
start chrome "http://localhost:5001/health"

echo.
echo ========================================
echo    Serveur DIRIS démarré avec succès!
echo ========================================
echo.
echo Pages ouvertes dans Chrome:
echo - Accueil: http://localhost:5001
echo - Tableau de bord: http://localhost:5001/dashboard.html
echo - Courbes: http://localhost:5001/charts.html
echo - Santé: http://localhost:5001/health
echo.
echo API REST disponible sur: http://localhost:5001/api
echo.
echo Pour arrêter le serveur, fermez cette fenêtre ou appuyez sur Ctrl+C
echo.

:end
pause
