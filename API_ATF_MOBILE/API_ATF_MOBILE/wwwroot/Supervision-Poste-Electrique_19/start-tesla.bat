@echo off
echo.
echo ========================================
echo    🚀 SUPERVISION POSTE ELECTRIQUE
echo         Version Tesla 1.0
echo ========================================
echo.

echo 📁 Dossier de travail: %CD%
echo.

echo 🔍 Vérification des fichiers...
if not exist "index.html" (
    echo ❌ Fichier index.html manquant
    pause
    exit /b 1
)

if not exist "style.css" (
    echo ❌ Fichier style.css manquant
    pause
    exit /b 1
)

if not exist "js\main.js" (
    echo ❌ Dossier js\main.js manquant
    pause
    exit /b 1
)

echo ✅ Tous les fichiers sont présents
echo.

echo 🐍 Vérification de Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python n'est pas installé ou pas dans le PATH
    echo 💡 Installez Python depuis https://python.org
    pause
    exit /b 1
)

echo ✅ Python détecté
echo.

echo 🌐 Démarrage du serveur Tesla...
echo 📡 URL: http://localhost:8080
echo 🛑 Pour arrêter: Ctrl+C
echo.

python serve-demo.py

pause
