# Script PowerShell pour démarrer l'application en local
# Ce script démarre le serveur .NET et configure un proxy

Write-Host "🚀 Démarrage de l'application Supervision Poste Électrique" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

# Vérifier que .NET est installé
try {
    $dotnetVersion = dotnet --version
    Write-Host "✅ .NET version: $dotnetVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ .NET n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "💡 Installez .NET 8.0 SDK depuis https://dotnet.microsoft.com/download" -ForegroundColor Yellow
    exit 1
}

# Vérifier que le projet se compile
Write-Host "🔨 Compilation du projet..." -ForegroundColor Yellow
try {
    dotnet build --configuration Release --verbosity quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Compilation réussie" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur de compilation" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la compilation" -ForegroundColor Red
    exit 1
}

# Démarrer le serveur .NET en arrière-plan
Write-Host "🚀 Démarrage du serveur .NET..." -ForegroundColor Yellow
$dotnetJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    dotnet run --environment Development --urls "http://localhost:5000"
}

# Attendre que le serveur démarre
Write-Host "⏳ Attente du démarrage du serveur .NET..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Vérifier que le serveur répond
$maxAttempts = 30
$attempt = 0
$apiReady = $false

while ($attempt -lt $maxAttempts -and -not $apiReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/swagger" -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $apiReady = $true
            Write-Host "✅ Serveur .NET démarré avec succès" -ForegroundColor Green
        }
    } catch {
        $attempt++
        Write-Host "⏳ Tentative $attempt/$maxAttempts - Attente du serveur..." -ForegroundColor Yellow
        Start-Sleep -Seconds 1
    }
}

if (-not $apiReady) {
    Write-Host "❌ Le serveur .NET n'a pas démarré correctement" -ForegroundColor Red
    Stop-Job $dotnetJob
    Remove-Job $dotnetJob
    exit 1
}

# Démarrer le serveur Python pour le frontend
Write-Host "🌐 Démarrage du serveur frontend..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "$using:PWD\wwwroot\supervision-poste-electrique"
    python -m http.server 8088
}

# Attendre que le serveur frontend démarre
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "🎉 Application démarrée avec succès !" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "🌐 Frontend: http://localhost:8088" -ForegroundColor White
Write-Host "📡 API Backend: http://localhost:5000" -ForegroundColor White
Write-Host "📋 Swagger API: http://localhost:5000/swagger" -ForegroundColor White
Write-Host "🔧 Mode développement: http://localhost:8088/index_dev.html" -ForegroundColor White
Write-Host ""
Write-Host "💡 Le proxy est configuré automatiquement" -ForegroundColor Cyan
Write-Host "💡 Appuyez sur Ctrl+C pour arrêter les serveurs" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Cyan

# Fonction pour arrêter proprement les serveurs
function Stop-Servers {
    Write-Host "`n🛑 Arrêt des serveurs..." -ForegroundColor Yellow
    Stop-Job $dotnetJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $dotnetJob, $frontendJob -ErrorAction SilentlyContinue
    Write-Host "✅ Serveurs arrêtés" -ForegroundColor Green
    exit 0
}

# Gérer l'arrêt avec Ctrl+C
try {
    # Attendre indéfiniment
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Vérifier que les jobs sont toujours en cours
        if ($dotnetJob.State -ne "Running") {
            Write-Host "❌ Le serveur .NET s'est arrêté inattendu" -ForegroundColor Red
            break
        }
        if ($frontendJob.State -ne "Running") {
            Write-Host "❌ Le serveur frontend s'est arrêté inattendu" -ForegroundColor Red
            break
        }
    }
} catch {
    Stop-Servers
}

# Nettoyage en cas d'arrêt
Stop-Servers
