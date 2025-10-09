@echo off
REM ========================================
REM VERIFICATION DES FREQUENCES D'ENREGISTREMENT
REM ========================================

echo.
echo ========================================
echo VERIFICATION DES FREQUENCES D'ENREGISTREMENT
echo ========================================
echo.

REM Configuration
set SERVER=10.250.13.4
set DATABASE=AI_ATR
set SCRIPT_DIR=%~dp0
set SQL_SCRIPT=%SCRIPT_DIR%check-recording-frequencies.sql
set OUTPUT_FILE=%SCRIPT_DIR%check-frequencies-output.log

echo Serveur: %SERVER%
echo Base de donnees: %DATABASE%
echo Script SQL: %SQL_SCRIPT%
echo.

REM Exécution du script SQL
echo [INFO] Execution du script de verification...
echo.

sqlcmd -S "%SERVER%" -d "%DATABASE%" -i "%SQL_SCRIPT%" -o "%OUTPUT_FILE%" -W -s "|" -w 1000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Verification terminee avec succes !
    echo.
    echo Resultats enregistres dans: %OUTPUT_FILE%
    echo.
    echo ========================================
    echo AFFICHAGE DES RESULTATS
    echo ========================================
    echo.
    type "%OUTPUT_FILE%"
    echo.
    echo ========================================
    echo FIN DE LA VERIFICATION
    echo ========================================
) else (
    echo.
    echo [ERROR] Erreur lors de l'execution du script SQL
    echo Code d'erreur: %ERRORLEVEL%
    echo.
    echo Verifiez:
    echo   1. La connexion au serveur %SERVER%
    echo   2. L'acces a la base de donnees %DATABASE%
    echo   3. Les permissions SQL
    echo.
)

echo.
pause

