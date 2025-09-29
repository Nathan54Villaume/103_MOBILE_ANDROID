@echo off
echo 🚀 Démarrage de l'application - Tout sur le port 8088
echo =====================================================

REM Aller dans le répertoire du projet
cd /d "%~dp0"

REM Démarrer le serveur .NET (API + fichiers statiques)
echo 🚀 Démarrage du serveur .NET (API + Frontend)...
start "Serveur .NET" cmd /k "dotnet run --environment Development --urls http://localhost:8088"

REM Attendre que le serveur démarre
echo ⏳ Attente du démarrage...
timeout /t 15 /nobreak >nul

echo.
echo 🎉 Application démarrée !
echo =====================================================
echo 🌐 Frontend: http://localhost:8088/wwwroot/supervision-poste-electrique/index.html
echo 🔧 Dev: http://localhost:8088/wwwroot/supervision-poste-electrique/index_dev.html
echo 📡 API: http://localhost:8088/api
echo 📋 Swagger: http://localhost:8088/swagger
echo =====================================================
echo.
echo Appuyez sur une touche pour ouvrir l'application...
pause >nul

REM Ouvrir l'application
start http://localhost:8088/wwwroot/supervision-poste-electrique/index_dev.html

echo.
echo 💡 Fermez la fenêtre de commande pour arrêter le serveur
pause
