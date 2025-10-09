#!/usr/bin/env pwsh
# Script de déploiement API simple
param(
    [string]$Server = "10.250.13.4",
    [string]$RemotePath = "\\$Server\c$\API_ATF_MOBILE\DEPLOIEMENT_API"
)

Write-Host "🚀 Déploiement API simple vers $Server" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

try {
    # Vérifier la connectivité
    Write-Host "📡 Test de connectivité vers $Server..." -ForegroundColor Yellow
    if (Test-Connection -ComputerName $Server -Count 1 -Quiet) {
        Write-Host "✅ Connectivité OK" -ForegroundColor Green
    } else {
        Write-Host "❌ Impossible de joindre $Server" -ForegroundColor Red
        exit 1
    }

    # Build du projet
    Write-Host "🔨 Build du projet..." -ForegroundColor Yellow
    Push-Location "R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE"
    
    dotnet build --configuration Release --no-restore
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur de build" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host "✅ Build réussi" -ForegroundColor Green

    # Publish
    Write-Host "📦 Publication du projet..." -ForegroundColor Yellow
    dotnet publish --configuration Release --output ".\bin\Release\net8.0\publish" --no-build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur de publication" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host "✅ Publication réussie" -ForegroundColor Green

    # Copie vers le serveur distant
    Write-Host "📤 Copie vers le serveur distant..." -ForegroundColor Yellow
    $publishPath = ".\bin\Release\net8.0\publish"
    
    if (Test-Path $RemotePath) {
        Remove-Item "$RemotePath\*" -Recurse -Force
    } else {
        New-Item -Path $RemotePath -ItemType Directory -Force
    }
    
    Copy-Item -Path "$publishPath\*" -Destination $RemotePath -Recurse -Force
    Write-Host "✅ Copie réussie" -ForegroundColor Green

    Pop-Location

    Write-Host "================================================" -ForegroundColor Green
    Write-Host "✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "📝 Redémarrez le service sur le serveur pour appliquer les changements" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Erreur lors du déploiement: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
