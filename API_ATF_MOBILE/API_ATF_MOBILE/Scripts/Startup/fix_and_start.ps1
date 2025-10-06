# Script de correction et démarrage pour l'application DIRIS
Write-Host "🔧 Correction et démarrage de l'application DIRIS" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Aller dans le répertoire du projet
$projectPath = Join-Path $PSScriptRoot "..\..\..\..\..\..\API_ATF_MOBILE\API_ATF_MOBILE"
Set-Location $projectPath

Write-Host "📁 Répertoire de travail: $projectPath" -ForegroundColor Cyan

# Arrêter tous les processus existants
Write-Host "🛑 Arrêt des processus existants..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*dotnet*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Nettoyage complet
Write-Host "🧹 Nettoyage complet..." -ForegroundColor Yellow
if (Test-Path "bin") { Remove-Item -Recurse -Force "bin" }
if (Test-Path "obj") { Remove-Item -Recurse -Force "obj" }

# Recompilation
Write-Host "🔨 Recompilation complète..." -ForegroundColor Yellow
dotnet clean
$buildResult = dotnet build --configuration Release --verbosity minimal

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur de compilation !" -ForegroundColor Red
    Write-Host $buildResult -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour continuer"
    exit 1
}

Write-Host "✅ Compilation réussie !" -ForegroundColor Green

# Démarrage de l'application
Write-Host "🚀 Démarrage de l'application..." -ForegroundColor Yellow
Write-Host "⏳ L'application va démarrer sur le port 8088..." -ForegroundColor Yellow
Write-Host ""

try {
    dotnet run --configuration Release --urls http://localhost:8088
}
catch {
    Write-Host "❌ Erreur lors du démarrage: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "💡 Appuyez sur Entrée pour fermer..." -ForegroundColor Yellow
Read-Host
