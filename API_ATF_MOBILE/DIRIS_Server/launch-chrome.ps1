# ========================================
#    DIRIS Server - Lancement Chrome (PowerShell)
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    DIRIS Server - Lancement Chrome" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si le serveur est déjà en cours d'exécution
$serverRunning = Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue
if ($serverRunning) {
    Write-Host "Le serveur DIRIS est déjà en cours d'exécution sur le port 5001" -ForegroundColor Yellow
    Write-Host "Ouverture de Chrome..." -ForegroundColor Green
    Start-Process "chrome" "http://localhost:5001"
    exit
}

# Aller dans le dossier du serveur
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Vérifier si le dossier dist existe
if (-not (Test-Path "dist")) {
    Write-Host "Erreur: Le dossier 'dist' n'existe pas." -ForegroundColor Red
    Write-Host "Veuillez d'abord compiler le serveur avec:" -ForegroundColor Yellow
    Write-Host "  dotnet publish src/Diris.Server -c Release -o dist" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour continuer"
    exit 1
}

# Vérifier si l'exécutable existe
if (-not (Test-Path "dist\Diris.Server.exe")) {
    Write-Host "Erreur: L'exécutable 'Diris.Server.exe' n'existe pas dans le dossier dist." -ForegroundColor Red
    Write-Host "Veuillez d'abord compiler le serveur avec:" -ForegroundColor Yellow
    Write-Host "  dotnet publish src/Diris.Server -c Release -o dist" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour continuer"
    exit 1
}

Write-Host "Démarrage du serveur DIRIS..." -ForegroundColor Green
Write-Host ""

# Démarrer le serveur en arrière-plan
$process = Start-Process -FilePath "dist\Diris.Server.exe" -PassThru -WindowStyle Hidden

# Attendre que le serveur démarre
Write-Host "Attente du démarrage du serveur (5 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Vérifier si le serveur répond
Write-Host "Vérification de la disponibilité du serveur..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/health/live" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "Serveur prêt!" -ForegroundColor Green
    } else {
        Write-Host "Serveur non prêt" -ForegroundColor Red
    }
} catch {
    Write-Host "Serveur non accessible" -ForegroundColor Red
}

Write-Host ""
Write-Host "Ouverture de Chrome avec les interfaces DIRIS..." -ForegroundColor Green
Write-Host ""

# Fonction pour ouvrir Chrome avec une URL
function Open-Chrome {
    param([string]$Url, [string]$Description)
    Write-Host "Ouverture: $Description" -ForegroundColor Cyan
    Start-Process "chrome" $Url
    Start-Sleep -Milliseconds 500
}

# Ouvrir les différentes pages
Open-Chrome "http://localhost:5001" "Page d'accueil"
Open-Chrome "http://localhost:5001/dashboard.html" "Tableau de bord"
Open-Chrome "http://localhost:5001/charts.html" "Courbes"
Open-Chrome "http://localhost:5001/health" "Health Check"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    Serveur DIRIS démarré avec succès!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pages ouvertes dans Chrome:" -ForegroundColor White
Write-Host "- Accueil: http://localhost:5001" -ForegroundColor Gray
Write-Host "- Tableau de bord: http://localhost:5001/dashboard.html" -ForegroundColor Gray
Write-Host "- Courbes: http://localhost:5001/charts.html" -ForegroundColor Gray
Write-Host "- Santé: http://localhost:5001/health" -ForegroundColor Gray
Write-Host ""
Write-Host "API REST disponible sur: http://localhost:5001/api" -ForegroundColor White
Write-Host ""
Write-Host "Pour arrêter le serveur, fermez cette fenêtre ou appuyez sur Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Garder la fenêtre ouverte
Read-Host "Appuyez sur Entrée pour arrêter le serveur et fermer cette fenêtre"

# Arrêter le processus du serveur
if ($process -and !$process.HasExited) {
    Write-Host "Arrêt du serveur DIRIS..." -ForegroundColor Yellow
    $process.Kill()
    Write-Host "Serveur arrêté." -ForegroundColor Green
}
