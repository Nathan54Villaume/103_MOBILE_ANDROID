@echo off
echo 🚀 Démarrage de l'application Supervision Poste Électrique
echo ============================================================

REM Vérifier que .NET est installé
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ .NET n'est pas installé ou pas dans le PATH
    echo 💡 Installez .NET 8.0 SDK depuis https://dotnet.microsoft.com/download
    pause
    exit /b 1
)

echo ✅ .NET détecté

REM Compiler le projet
echo 🔨 Compilation du projet...
dotnet build --configuration Release --verbosity quiet
if %errorlevel% neq 0 (
    echo ❌ Erreur de compilation
    pause
    exit /b 1
)

echo ✅ Compilation réussie

REM Démarrer le serveur .NET en arrière-plan
echo 🚀 Démarrage du serveur .NET...
start /B dotnet run --environment Development --urls "http://localhost:5000"

REM Attendre que le serveur démarre
echo ⏳ Attente du démarrage du serveur .NET...
timeout /t 10 /nobreak >nul

REM Démarrer le serveur Python pour le frontend
echo 🌐 Démarrage du serveur frontend...
cd wwwroot\supervision-poste-electrique
start /B python -m http.server 8088

REM Attendre un peu
timeout /t 3 /nobreak >nul

echo.
echo 🎉 Application démarrée avec succès !
echo ============================================================
echo 🌐 Frontend: http://localhost:8088
echo 📡 API Backend: http://localhost:5000
echo 📋 Swagger API: http://localhost:5000/swagger
echo 🔧 Mode développement: http://localhost:8088/index_dev.html
echo.
echo 💡 Le proxy est configuré automatiquement
echo 💡 Appuyez sur une touche pour arrêter les serveurs
echo ============================================================

pause >nul

REM Arrêter les processus
echo 🛑 Arrêt des serveurs...
taskkill /F /IM dotnet.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

echo ✅ Serveurs arrêtés
pause
