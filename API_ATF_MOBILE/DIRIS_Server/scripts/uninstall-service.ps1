# Script de désinstallation du service Windows DIRIS Server
# =========================================================

param(
    [string]$ServiceName = "DIRIS-Server"
)

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Ce script doit être exécuté en tant qu'administrateur"
    exit 1
}

Write-Host "Désinstallation du service Windows..." -ForegroundColor Yellow
Write-Host "Service: $ServiceName" -ForegroundColor Cyan

try {
    # Vérifier si le service existe
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    
    if (-not $service) {
        Write-Host "Le service '$ServiceName' n'existe pas" -ForegroundColor Yellow
        exit 0
    }
    
    # Arrêter le service s'il est en cours d'exécution
    if ($service.Status -eq "Running") {
        Write-Host "Arrêt du service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 3
        
        # Vérifier que le service est bien arrêté
        $service = Get-Service -Name $ServiceName
        if ($service.Status -eq "Running") {
            Write-Warning "Le service est toujours en cours d'exécution. Tentative d'arrêt forcé..."
            Stop-Process -Name "Diris.Server" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        
        Write-Host "Service arrêté" -ForegroundColor Green
    }
    
    # Supprimer le service
    Write-Host "Suppression du service..." -ForegroundColor Yellow
    Remove-Service -Name $ServiceName
    
    Write-Host "Service supprimé avec succès!" -ForegroundColor Green
    
    # Nettoyer les fichiers de logs (optionnel)
    $logsPath = Join-Path $PSScriptRoot "..\logs"
    if (Test-Path $logsPath) {
        $response = Read-Host "Voulez-vous supprimer les fichiers de logs? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            Remove-Item -Path $logsPath -Recurse -Force
            Write-Host "Fichiers de logs supprimés" -ForegroundColor Green
        }
    }
    
} catch {
    Write-Error "Erreur lors de la désinstallation du service: $_"
    exit 1
}

Write-Host ""
Write-Host "Désinstallation terminée!" -ForegroundColor Green
Write-Host "Le service DIRIS Server a été supprimé du système." -ForegroundColor Cyan
