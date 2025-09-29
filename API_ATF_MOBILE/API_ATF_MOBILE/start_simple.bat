@echo off
echo 🚀 Démarrage simple de l'application
echo ====================================

REM Aller dans le répertoire du projet
cd /d "%~dp0"

REM Démarrer le serveur .NET
echo 🚀 Démarrage du serveur .NET...
start "API Server" cmd /k "dotnet run --environment Development --urls http://localhost:5000"

REM Attendre un peu
echo ⏳ Attente du démarrage...
timeout /t 15 /nobreak >nul

REM Aller dans le répertoire frontend
cd wwwroot\supervision-poste-electrique

REM Démarrer le serveur Python
echo 🌐 Démarrage du serveur frontend...
start "Frontend Server" cmd /k "python -m http.server 8088"

REM Attendre un peu
echo ⏳ Attente du démarrage...
timeout /t 5 /nobreak >nul

echo.
echo 🎉 Application démarrée !
echo ====================================
echo 🌐 Frontend: http://localhost:8088
echo 📡 API: http://localhost:5000
echo 🔧 Dev: http://localhost:8088/index_dev.html
echo ====================================
echo.
echo Appuyez sur une touche pour ouvrir l'application...
pause >nul

REM Ouvrir l'application
start http://localhost:8088/index_dev.html

echo.
echo 💡 Fermez les fenêtres de commande pour arrêter les serveurs
pause
