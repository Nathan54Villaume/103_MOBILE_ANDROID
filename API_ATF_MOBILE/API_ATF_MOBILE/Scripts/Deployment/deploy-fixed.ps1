# ===========================================
# Script de deploiement complet API_ATF_MOBILE
# Version corrigee sans caracteres speciaux
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
$projectRoot = Split-Path (Split-Path $scriptRoot -Parent) -Parent
$localWebDir = Join-Path $projectRoot "wwwroot\supervision-poste-electrique"
$logFile = Join-Path $scriptRoot "deploy.log"

# Fonction de logging
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

# Fonction pour tester la connectivite
function Test-ServerConnection {
    param([string]$ServerName)
    try {
        $ping = Test-Connection -ComputerName $ServerName -Count 1 -Quiet
        if (-not $ping) {
            throw "Impossible de pinger le serveur $ServerName"
        }
        Write-Log "SUCCESS: Connectivite serveur $ServerName : OK" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "ERROR: Erreur connectivite serveur $ServerName : $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Fonction pour arreter le processus distant
function Stop-RemoteProcess {
    param([string]$ServerName, [string]$ProcessName)
    Write-Log "INFO: Arret du processus distant $ProcessName sur $ServerName..." "INFO"
    try {
        $processes = Get-WmiObject -Class Win32_Process -ComputerName $ServerName -Filter "Name='$ProcessName'" -ErrorAction SilentlyContinue
        if ($processes) {
            foreach ($process in $processes) {
                $result = $process.Terminate()
                Write-Log "INFO: Processus $($process.ProcessId) arrete (code: $($result.ReturnValue))" "INFO"
            }
            # Attendre que le processus se termine completement
            Start-Sleep -Seconds 3
        } else {
            Write-Log "INFO: Aucun processus $ProcessName trouve" "INFO"
        }
    }
    catch {
        Write-Log "WARN: Erreur lors de l'arret du processus : $($_.Exception.Message)" "WARN"
    }
}

# Fonction pour nettoyer le dossier distant
function Clear-RemoteDirectory {
    param([string]$RemotePath)
    Write-Log "INFO: Nettoyage du dossier distant: $RemotePath" "INFO"
    try {
        if (Test-Path $RemotePath) {
            Remove-Item "$RemotePath\*" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Log "SUCCESS: Dossier nettoye avec succes" "SUCCESS"
        } else {
            Write-Log "INFO: Dossier n'existe pas, creation..." "INFO"
            New-Item -Path $RemotePath -ItemType Directory -Force | Out-Null
        }
    }
    catch {
        Write-Log "ERROR: Erreur lors du nettoyage : $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Fonction pour generer version.json
function Update-VersionFile {
    param([string]$WebDir)
    Write-Log "INFO: Generation de version.json..." "INFO"
    try {
        if (-not (Test-Path $WebDir)) {
            throw "Dossier introuvable: $WebDir"
        }
        
        $version = Get-Date -Format "yyyyMMdd-HHmmss"
        $versionFile = Join-Path $WebDir "version.json"
        $versionContent = "{ `"v`": `"$version`", `"deployed`": `"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`" }"
        
        $versionContent | Out-File -FilePath $versionFile -Encoding utf8 -NoNewline
        Write-Log "SUCCESS: $versionFile mis a jour : v=$version" "SUCCESS"
        
        return $version
    }
    catch {
        Write-Log "ERROR: Erreur generation version.json : $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Fonction pour publier l'application
function Publish-Application {
    param([string]$ProjectPath, [string]$OutputPath)
    Write-Log "INFO: Publication .NET vers $OutputPath ..." "INFO"
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
            throw "Echec du 'dotnet publish' (code $LASTEXITCODE)"
        }
        
        Write-Log "SUCCESS: Publication reussie" "SUCCESS"
    }
    catch {
        Write-Log "ERROR: Erreur publication : $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Fonction pour demarrer le processus distant
function Start-RemoteProcess {
    param([string]$ServerName, [string]$ExePath)
    Write-Log "INFO: Demarrage du processus distant..." "INFO"
    try {
        $result = Invoke-WmiMethod -Class Win32_Process -ComputerName $ServerName -Name Create -ArgumentList $ExePath
        if ($result.ReturnValue -eq 0) {
            Write-Log "SUCCESS: Processus demarre avec succes (PID: $($result.ProcessId))" "SUCCESS"
        } else {
            throw "Echec du demarrage (code: $($result.ReturnValue))"
        }
    }
    catch {
        Write-Log "ERROR: Erreur demarrage processus : $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Fonction pour verifier que l'application repond
function Test-ApplicationHealth {
    param([string]$ServerName, [int]$Port = 8088, [int]$TimeoutSeconds = 30)
    Write-Log "INFO: Verification de la sante de l'application..." "INFO"
    
    $url = "http://$ServerName" + ":$Port/api/ping"
    $timeout = (Get-Date).AddSeconds($TimeoutSeconds)
    
    do {
        try {
            $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Log "SUCCESS: Application repond correctement" "SUCCESS"
                return $true
            }
        }
        catch {
            # Continuer a essayer
        }
        
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $timeout)
    
    Write-Host ""
    Write-Log "WARN: L'application ne repond pas apres $TimeoutSeconds secondes" "WARN"
    return $false
}

# ===========================================
# SCRIPT PRINCIPAL
# ===========================================

Write-Log "INFO: Debut du deploiement API_ATF_MOBILE" "INFO"
Write-Log "INFO: Serveur: $Server" "INFO"
Write-Log "INFO: Dossier de deploiement: $RemoteDeployDir" "INFO"

try {
    # 1) Verifier la connectivite
    if (-not (Test-ServerConnection -ServerName $Server)) {
        throw "Impossible de se connecter au serveur $Server"
    }
    
    # 2) Arreter le processus distant
    if (-not $SkipDeploy) {
        Stop-RemoteProcess -ServerName $Server -ProcessName "API_ATF_MOBILE.exe"
    }
    
    # 3) Nettoyer le dossier distant
    if (-not $SkipDeploy) {
        Clear-RemoteDirectory -RemotePath $RemoteDeployDir
    }
    
    # 4) Generer version.json
    $version = Update-VersionFile -WebDir $localWebDir
    
    # 5) Publier l'application
    if (-not $SkipBuild) {
        $projectPath = Join-Path $projectRoot "API_ATF_MOBILE.csproj"
        Publish-Application -ProjectPath $projectPath -OutputPath $RemoteDeployDir
    }
    
    # 6) Demarrer le processus distant
    if (-not $SkipDeploy) {
        Start-RemoteProcess -ServerName $Server -ExePath $RemoteExe
        
        # 7) Verifier que l'application repond
        Test-ApplicationHealth -ServerName $Server
    }
    
    Write-Log "SUCCESS: Deploiement termine avec succes. Version = $version" "SUCCESS"
    Write-Host ""
    Write-Host "Interface d'administration: http://${Server}:8088/admin/" -ForegroundColor Green
    Write-Host "API Health Check: http://${Server}:8088/api/ping" -ForegroundColor Green
    Write-Host "Logs: $logFile" -ForegroundColor Cyan
}
catch {
    Write-Log "ERROR: ERREUR CRITIQUE: $($_.Exception.Message)" "ERROR"
    Write-Log "ERROR: Stack trace: $($_.ScriptStackTrace)" "ERROR"
    exit 1
}
finally {
    Write-Log "INFO: Fin du script de deploiement" "INFO"
}
