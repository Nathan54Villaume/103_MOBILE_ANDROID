@echo off
echo 🚀 Démarrage de l'application avec Proxy CORS
echo ==============================================

REM Aller dans le répertoire du projet
cd /d "%~dp0\..\..\..\..\..\..\API_ATF_MOBILE\API_ATF_MOBILE"

echo 🧹 Nettoyage des fichiers de build...
if exist bin rmdir /s /q bin
if exist obj rmdir /s /q obj

echo 🔨 Recompilation du projet...
dotnet clean
dotnet build --configuration Release

if %ERRORLEVEL% neq 0 (
    echo ❌ Erreur de compilation !
    pause
    exit /b 1
)

echo ✅ Compilation réussie !

echo 🚀 Démarrage du serveur avec proxy CORS...
echo ⏳ Le serveur va démarrer sur le port 8088...
echo.

REM Démarrer le serveur .NET
start "Serveur .NET" cmd /k "dotnet run --configuration Release --urls http://localhost:8088"

REM Attendre que le serveur démarre
echo ⏳ Attente du démarrage du serveur...
timeout /t 20 /nobreak >nul

echo.
echo 🎉 Application démarrée !
echo ==============================================
echo 🌐 Frontend: http://localhost:8088/wwwroot/supervision-poste-electrique/index.html
echo 🔧 Dev: http://localhost:8088/wwwroot/supervision-poste-electrique/index_dev.html
echo 📡 API: http://localhost:8088/api
echo 📋 Swagger: http://localhost:8088/swagger
echo 🎛️ Admin: http://localhost:8088/wwwroot/admin/index.html
echo ==============================================
echo.

REM Vérifier si le serveur répond
echo 🔍 Vérification du serveur...
curl -s http://localhost:8088/api/values >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✅ Serveur accessible !
    echo.
    echo Appuyez sur une touche pour ouvrir l'application...
    pause >nul
    start http://localhost:8088/wwwroot/admin/index.html
) else (
    echo ⚠️ Serveur en cours de démarrage...
    echo 💡 Attendez quelques secondes puis ouvrez manuellement:
    echo    http://localhost:8088/wwwroot/admin/index.html
)

echo.
echo 💡 Fermez la fenêtre de commande pour arrêter le serveur
pause
