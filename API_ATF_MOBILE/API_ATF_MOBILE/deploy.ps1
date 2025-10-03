# ===========================================
# Script de déploiement complet API_ATF_MOBILE
# Version améliorée avec gestion d'erreurs et logging
# ===========================================

param(
    [string]$Server = "10.250.13.4",
    [string]$RemoteDeployDir = "\\10.250.13.4\c$\API_ATF_MOBILE\DEPLOIEMENT_API",
    [string]$RemoteExe = "C:\\API_ATF_MOBILE\\DEPLOIEMENT_API\\API_ATF_MOBILE.exe",
    [switch]$SkipBuild = $false,
    [switch]$SkipDeploy = $false,
    [switch]$Verbose = $false
)

# Configuration
$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = (Get-Location).Path }

# Dossiers
$localWebDir = Join-Path $scriptRoot "wwwroot\supervision-poste-electrique"
$logFile = Join-Path $scriptRoot "deploy.log"

# Fonction de logging
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

# Fonction pour tester la connectivité
function Test-ServerConnection {
    param([string]$ServerName)
    try {
        $ping = Test-Connection -ComputerName $ServerName -Count 1 -Quiet
        if (-not $ping) {
            throw "Impossible de pinger le serveur $ServerName"
        }
        Write-Log "✅ Connectivité serveur $ServerName : OK" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "❌ Erreur connectivité serveur $ServerName : $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Fonction pour arrêter le processus distant
function Stop-RemoteProcess {
    param([string]$ServerName, [string]$ProcessName)
    Write-Log "🔴 Arrêt du processus distant $ProcessName sur $ServerName..." "INFO"
    try {
        $processes = Get-WmiObject -Class Win32_Process -ComputerName $ServerName -Filter "Name='$ProcessName'" -ErrorAction SilentlyContinue
        if ($processes) {
            foreach ($process in $processes) {
                $result = $process.Terminate()
                Write-Log "  -> Processus $($process.ProcessId) arrêté (code: $($result.ReturnValue))" "INFO"
            }
            # Attendre que le processus se termine complètement
            Start-Sleep -Seconds 3
        } else {
            Write-Log "  (info) Aucun processus $ProcessName trouvé" "INFO"
        }
    }
    catch {
        Write-Log "  (warning) Erreur lors de l'arrêt du processus : $($_.Exception.Message)" "WARN"
    }
}

# Fonction pour nettoyer le dossier distant
function Clear-RemoteDirectory {
    param([string]$RemotePath)
    Write-Log "🧹 Nettoyage du dossier distant: $RemotePath" "INFO"
    try {
        if (Test-Path $RemotePath) {
            Remove-Item "$RemotePath\*" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Log "  -> Dossier nettoyé avec succès" "SUCCESS"
        } else {
            Write-Log "  -> Dossier n'existe pas, création..." "INFO"
            New-Item -Path $RemotePath -ItemType Directory -Force | Out-Null
        }
    }
    catch {
        Write-Log "❌ Erreur lors du nettoyage : $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Fonction pour générer version.json
function Update-VersionFile {
    param([string]$WebDir)
    Write-Log "📝 Génération de version.json..." "INFO"
    try {
        if (-not (Test-Path $WebDir)) {
            throw "Dossier introuvable: $WebDir"
        }
        
        $version = Get-Date -Format "yyyyMMdd-HHmmss"
        $versionFile = Join-Path $WebDir "version.json"
        $versionContent = "{ `"v`": `"$version`", `"deployed`": `"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`" }"
        
        $versionContent | Out-File -FilePath $versionFile -Encoding utf8 -NoNewline
        Write-Log "  -> $versionFile mis à jour : v=$version" "SUCCESS"
        
        return $version
    }
    catch {
        Write-Log "❌ Erreur génération version.json : $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Fonction pour publier l'application
function Publish-Application {
    param([string]$ProjectPath, [string]$OutputPath)
    Write-Log "🚀 Publication .NET vers $OutputPath ..." "INFO"
    try {
        $publishArgs = @(
            "publish", $ProjectPath,
            "-c", "Release",
            "-r", "win-x64",
            "-p:SelfContained=true",
            "-p:PublishSingleFile=false",
            "-p:IncludeNativeLibrariesForSelfExtract=true",
            "-o", $OutputPath,
            "--verbosity", "minimal"
        )
        
        if ($Verbose) {
            $publishArgs += "--verbosity", "detailed"
        }
        
        & dotnet @publishArgs
        
        if ($LASTEXITCODE -ne 0) {
            throw "Échec du 'dotnet publish' (code $LASTEXITCODE)"
        }
        
        Write-Log "  -> Publication réussie" "SUCCESS"
    }
    catch {
        Write-Log "❌ Erreur publication : $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Fonction pour démarrer le processus distant
function Start-RemoteProcess {
    param([string]$ServerName, [string]$ExePath)
    Write-Log "🟢 Démarrage du processus distant..." "INFO"
    try {
        $result = Invoke-WmiMethod -Class Win32_Process -ComputerName $ServerName -Name Create -ArgumentList $ExePath
        if ($result.ReturnValue -eq 0) {
            Write-Log "  -> Processus démarré avec succès (PID: $($result.ProcessId))" "SUCCESS"
        } else {
            throw "Échec du démarrage (code: $($result.ReturnValue))"
        }
    }
    catch {
        Write-Log "❌ Erreur démarrage processus : $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Fonction pour vérifier que l'application répond
function Test-ApplicationHealth {
    param([string]$ServerName, [int]$Port = 8088, [int]$TimeoutSeconds = 30)
    Write-Log "🔍 Vérification de la santé de l'application..." "INFO"
    
    $url = "http://$ServerName" + ":$Port/api/admin/health"
    $timeout = (Get-Date).AddSeconds($TimeoutSeconds)
    
    do {
        try {
            $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Log "  -> Application répond correctement" "SUCCESS"
                return $true
            }
        }
        catch {
            # Continuer à essayer
        }
        
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $timeout)
    
    Write-Host ""
    Write-Log "⚠️  L'application ne répond pas après $TimeoutSeconds secondes" "WARN"
    return $false
}

# ===========================================
# SCRIPT PRINCIPAL
# ===========================================

Write-Log "🚀 Début du déploiement API_ATF_MOBILE" "INFO"
Write-Log "Serveur: $Server" "INFO"
Write-Log "Dossier de déploiement: $RemoteDeployDir" "INFO"

try {
    # 1) Vérifier la connectivité
    if (-not (Test-ServerConnection -ServerName $Server)) {
        throw "Impossible de se connecter au serveur $Server"
    }
    
    # 2) Arrêter le processus distant
    if (-not $SkipDeploy) {
        Stop-RemoteProcess -ServerName $Server -ProcessName "API_ATF_MOBILE.exe"
    }
    
    # 3) Nettoyer le dossier distant
    if (-not $SkipDeploy) {
        Clear-RemoteDirectory -RemotePath $RemoteDeployDir
    }
    
    # 4) Générer version.json
    $version = Update-VersionFile -WebDir $localWebDir
    
    # 5) Publier l'application
    if (-not $SkipBuild) {
        $projectPath = Join-Path $scriptRoot "API_ATF_MOBILE.csproj"
        Publish-Application -ProjectPath $projectPath -OutputPath $RemoteDeployDir
    }
    
    # 6) Démarrer le processus distant
    if (-not $SkipDeploy) {
        Start-RemoteProcess -ServerName $Server -ExePath $RemoteExe
        
        # 7) Vérifier que l'application répond
        Test-ApplicationHealth -ServerName $Server
    }
    
    Write-Log "✅ Déploiement terminé avec succès. Version = $version" "SUCCESS"
    Write-Host ""
    Write-Host "🌐 Interface d'administration: http://$Server:8088/admin/" -ForegroundColor Green
    Write-Host "📊 API Health Check: http://$Server:8088/api/admin/health" -ForegroundColor Green
    Write-Host "📝 Logs: $logFile" -ForegroundColor Cyan
}
catch {
    Write-Log "❌ ERREUR CRITIQUE: $($_.Exception.Message)" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    exit 1
}
finally {
    Write-Log "🏁 Fin du script de déploiement" "INFO"
}
