# Script de démarrage avec proxy CORS pour l'application DIRIS
Write-Host "🚀 Démarrage de l'application avec Proxy CORS" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green

# Aller dans le répertoire du projet
$projectPath = Join-Path $PSScriptRoot "..\..\..\..\..\..\API_ATF_MOBILE\API_ATF_MOBILE"
Set-Location $projectPath

Write-Host "📁 Répertoire de travail: $projectPath" -ForegroundColor Cyan

# Nettoyage des fichiers de build
Write-Host "🧹 Nettoyage des fichiers de build..." -ForegroundColor Yellow
if (Test-Path "bin") { Remove-Item -Recurse -Force "bin" }
if (Test-Path "obj") { Remove-Item -Recurse -Force "obj" }

# Recompilation
Write-Host "🔨 Recompilation du projet..." -ForegroundColor Yellow
dotnet clean
$buildResult = dotnet build --configuration Release

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur de compilation !" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour continuer"
    exit 1
}

Write-Host "✅ Compilation réussie !" -ForegroundColor Green

# Arrêter les processus existants
Write-Host "🛑 Arrêt des processus existants..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*dotnet*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Démarrer le serveur .NET
Write-Host "🚀 Démarrage du serveur .NET..." -ForegroundColor Yellow
$process = Start-Process -FilePath "dotnet" -ArgumentList "run", "--configuration", "Release", "--urls", "http://localhost:8088" -PassThru -WindowStyle Normal

# Attendre que le serveur démarre
Write-Host "⏳ Attente du démarrage du serveur (20 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Vérifier si le serveur répond
Write-Host "🔍 Vérification du serveur..." -ForegroundColor Yellow
$maxAttempts = 10
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8088/api/values" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
        }
    }
    catch {
        $attempt++
        Write-Host "⏳ Tentative $attempt/$maxAttempts..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

if ($serverReady) {
    Write-Host ""
    Write-Host "🎉 Application démarrée avec succès !" -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host "🌐 Frontend: http://localhost:8088/wwwroot/supervision-poste-electrique/index.html" -ForegroundColor Cyan
    Write-Host "🔧 Dev: http://localhost:8088/wwwroot/supervision-poste-electrique/index_dev.html" -ForegroundColor Cyan
    Write-Host "📡 API: http://localhost:8088/api" -ForegroundColor Cyan
    Write-Host "📋 Swagger: http://localhost:8088/swagger" -ForegroundColor Cyan
    Write-Host "🎛️ Admin: http://localhost:8088/wwwroot/admin/index.html" -ForegroundColor Cyan
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host ""
    
    # Ouvrir l'application
    Write-Host "🌐 Ouverture de l'interface d'administration..." -ForegroundColor Yellow
    Start-Process "http://localhost:8088/wwwroot/admin/index.html"
    
} else {
    Write-Host "⚠️ Le serveur semble avoir des difficultés à démarrer" -ForegroundColor Yellow
    Write-Host "💡 Vous pouvez essayer d'ouvrir manuellement:" -ForegroundColor Yellow
    Write-Host "   http://localhost:8088/wwwroot/admin/index.html" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "💡 Appuyez sur Ctrl+C dans la fenêtre du serveur pour l'arrêter" -ForegroundColor Yellow
Write-Host "🔄 Ou appuyez sur Entrée ici pour redémarrer le script..." -ForegroundColor Yellow

# Attendre une action de l'utilisateur
Read-Host "Appuyez sur Entrée pour continuer"

# Arrêter le processus si nécessaire
if ($process -and !$process.HasExited) {
    Write-Host "🛑 Arrêt du serveur..." -ForegroundColor Yellow
    $process.Kill()
}
