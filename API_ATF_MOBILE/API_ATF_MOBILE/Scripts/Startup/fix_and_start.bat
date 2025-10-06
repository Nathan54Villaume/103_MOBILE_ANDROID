@echo off
echo 🔧 Correction et démarrage de l'application DIRIS
echo ================================================

REM Aller dans le répertoire du projet
cd /d "%~dp0\..\..\..\..\..\..\API_ATF_MOBILE\API_ATF_MOBILE"

echo 🧹 Nettoyage complet...
if exist bin rmdir /s /q bin
if exist obj rmdir /s /q obj

echo 🔨 Recompilation complète...
dotnet clean
dotnet build --configuration Release --verbosity minimal

if %ERRORLEVEL% neq 0 (
    echo ❌ Erreur de compilation !
    pause
    exit /b 1
)

echo ✅ Compilation réussie !

echo 🚀 Démarrage de l'application...
echo ⏳ L'application va démarrer sur le port 8088...
echo.

REM Démarrer l'application
dotnet run --configuration Release --urls http://localhost:8088

echo.
echo 💡 Appuyez sur une touche pour fermer...
pause
