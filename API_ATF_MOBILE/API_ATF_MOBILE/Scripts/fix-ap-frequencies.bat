@echo off
REM ========================================
REM CORRECTION DES FREQUENCES AP (Puissance Apparente)
REM ========================================

echo.
echo ========================================
echo CORRECTION DES FREQUENCES AP
echo ========================================
echo.

REM Configuration
set SERVER=10.250.13.4
set DATABASE=AI_ATR
set SCRIPT_DIR=%~dp0
set SQL_SCRIPT=%SCRIPT_DIR%fix-ap-frequencies.sql
set OUTPUT_FILE=%SCRIPT_DIR%fix-ap-frequencies-output.log

echo Serveur: %SERVER%
echo Base de donnees: %DATABASE%
echo Script SQL: %SQL_SCRIPT%
echo.

REM Confirmation
echo ATTENTION: Ce script va modifier les frequences des signaux AP_255
echo.
echo Signaux concernes:
echo   - ATR_TR2.AP_255     : 1000ms -^> 2000ms
echo   - ATS - TR1.AP_255   : 1000ms -^> 2000ms
echo   - ATS - TR3.AP_255   : 1000ms -^> 2000ms
echo   - ATS - TR4.AP_255   : 1000ms -^> 2000ms
echo.
set /p CONFIRM="Voulez-vous continuer ? (O/N): "

if /i not "%CONFIRM%"=="O" (
    echo.
    echo [INFO] Operation annulee par l'utilisateur
    echo.
    pause
    exit /b 0
)

echo.
echo [INFO] Execution du script de correction...
echo.

REM Exécution du script SQL
sqlcmd -S "%SERVER%" -d "%DATABASE%" -i "%SQL_SCRIPT%" -o "%OUTPUT_FILE%" -W -s "|" -w 1000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Correction terminee avec succes !
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
    echo FIN DE LA CORRECTION
    echo ========================================
    echo.
    echo [INFO] Pensez a redemarrer l'API pour appliquer les changements !
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

