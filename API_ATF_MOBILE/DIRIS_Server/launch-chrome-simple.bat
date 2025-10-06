@echo off
echo Lancement du serveur DIRIS et ouverture dans Chrome...

REM Aller dans le dossier du serveur
cd /d "%~dp0"

REM Démarrer le serveur
start "DIRIS-Server" "dist\Diris.Server.exe"

REM Attendre 3 secondes
timeout /t 3 /nobreak >nul

REM Ouvrir Chrome
start chrome "http://localhost:5001"

echo Serveur démarré! Chrome ouvert sur http://localhost:5001
echo Fermez cette fenêtre pour arrêter le serveur.
pause
