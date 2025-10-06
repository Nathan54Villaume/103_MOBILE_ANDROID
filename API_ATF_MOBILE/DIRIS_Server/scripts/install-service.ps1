# Script d'installation du service Windows DIRIS Server
# =====================================================

param(
    [string]$ServiceName = "DIRIS-Server",
    [string]$DisplayName = "DIRIS Data Acquisition Server",
    [string]$Description = "Service d'acquisition de données DIRIS via WebMI",
    [string]$BinaryPath = "",
    [string]$StartType = "Automatic"
)

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Ce script doit être exécuté en tant qu'administrateur"
    exit 1
}

# Déterminer le chemin du binaire
if ([string]::IsNullOrEmpty($BinaryPath)) {
    $BinaryPath = Join-Path $PSScriptRoot "..\src\Diris.Server\bin\Release\net8.0\Diris.Server.exe"
}

if (-not (Test-Path $BinaryPath)) {
    Write-Error "Fichier exécutable non trouvé : $BinaryPath"
    Write-Host "Veuillez d'abord compiler le projet avec : dotnet publish -c Release"
    exit 1
}

Write-Host "Installation du service Windows..." -ForegroundColor Green
Write-Host "Service: $ServiceName" -ForegroundColor Cyan
Write-Host "Chemin: $BinaryPath" -ForegroundColor Cyan

try {
    # Vérifier si le service existe déjà
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    
    if ($existingService) {
        Write-Host "Le service existe déjà. Arrêt et suppression..." -ForegroundColor Yellow
        
        if ($existingService.Status -eq "Running") {
            Stop-Service -Name $ServiceName -Force
            Write-Host "Service arrêté" -ForegroundColor Green
        }
        
        Remove-Service -Name $ServiceName
        Write-Host "Ancien service supprimé" -ForegroundColor Green
    }
    
    # Créer le nouveau service
    New-Service -Name $ServiceName `
                -BinaryPathName $BinaryPath `
                -DisplayName $DisplayName `
                -Description $Description `
                -StartupType $StartType
    
    Write-Host "Service créé avec succès!" -ForegroundColor Green
    
    # Démarrer le service
    Write-Host "Démarrage du service..." -ForegroundColor Yellow
    Start-Service -Name $ServiceName
    
    # Vérifier le statut
    $service = Get-Service -Name $ServiceName
    Write-Host "Statut du service: $($service.Status)" -ForegroundColor Cyan
    
    if ($service.Status -eq "Running") {
        Write-Host "Service démarré avec succès!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Le service DIRIS Server est maintenant actif." -ForegroundColor Green
        Write-Host "Interface web disponible sur: http://localhost:5000" -ForegroundColor Cyan
        Write-Host "Health check disponible sur: http://localhost:5000/health" -ForegroundColor Cyan
    } else {
        Write-Warning "Le service a été créé mais n'a pas démarré correctement"
        Write-Host "Vérifiez les logs dans le dossier 'logs' pour plus d'informations"
    }
    
} catch {
    Write-Error "Erreur lors de l'installation du service: $_"
    exit 1
}

Write-Host ""
Write-Host "Installation terminée!" -ForegroundColor Green
Write-Host "Pour désinstaller le service, exécutez: .\uninstall-service.ps1" -ForegroundColor Yellow
