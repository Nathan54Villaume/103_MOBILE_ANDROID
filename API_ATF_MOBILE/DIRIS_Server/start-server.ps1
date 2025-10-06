# Script de démarrage DIRIS Server avec gestion d'erreurs
Write-Host "=== Démarrage du serveur DIRIS ===" -ForegroundColor Green

# Vérifier que l'exécutable existe
if (-not (Test-Path "dist\Diris.Server.exe")) {
    Write-Host "ERREUR: L'exécutable Diris.Server.exe n'existe pas dans le dossier dist" -ForegroundColor Red
    exit 1
}

# Configurer les variables d'environnement
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ASPNETCORE_URLS = "http://localhost:5001"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "- Environnement: $env:ASPNETCORE_ENVIRONMENT" -ForegroundColor Gray
Write-Host "- URL: $env:ASPNETCORE_URLS" -ForegroundColor Gray
Write-Host ""

# Démarrer le serveur
Write-Host "Démarrage du serveur..." -ForegroundColor Yellow
try {
    & ".\dist\Diris.Server.exe"
} catch {
    Write-Host "ERREUR lors du démarrage: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Détails: $($_.Exception)" -ForegroundColor Red
}
