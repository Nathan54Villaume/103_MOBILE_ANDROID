# ===========================================
# Script de deploiement FRONTEND UNIQUEMENT
# ===========================================
# Copie les fichiers statiques (HTML, JS, CSS) sans rebuild
# Utilise pour les modifications visuelles uniquement
# DEPLOIEMENT DISTANT UNIQUEMENT (serveur 10.250.13.4)
# ===========================================

param(
    [string]$Server = "10.250.13.4",
    [string]$RemoteDeployDir = "\\10.250.13.4\c$\API_ATF_MOBILE\DEPLOIEMENT_API",
    [switch]$Verbose = $false
)

# Configuration
$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = (Get-Location).Path }

# Dossiers
$projectRoot = Split-Path $scriptRoot -Parent
$sourcePath = Join-Path $projectRoot "wwwroot"
$logFile = Join-Path $scriptRoot "deploy-frontend.log"

# Debug paths
if ($Verbose) {
    Write-Host "DEBUG: scriptRoot = $scriptRoot" -ForegroundColor Gray
    Write-Host "DEBUG: projectRoot = $projectRoot" -ForegroundColor Gray
    Write-Host "DEBUG: sourcePath = $sourcePath" -ForegroundColor Gray
}

# Fonction de logging
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    
    Write-Host $logMessage -ForegroundColor $color
    Add-Content -Path $logFile -Value $logMessage
}

# Fonction pour tester la connectivite
function Test-ServerConnection {
    param([string]$ServerName)
    try {
        $ping = Test-Connection -ComputerName $ServerName -Count 1 -Quiet -ErrorAction SilentlyContinue
        if (-not $ping) {
            throw "Impossible de pinger le serveur $ServerName"
        }
        Write-Log "Connectivite serveur $ServerName : OK" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Erreur connectivite serveur $ServerName : $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Fonction pour generer version.json
function Update-VersionFile {
    param([string]$WebDir)
    Write-Log "Generation de version.json..." "INFO"
    try {
        $adminDir = Join-Path $WebDir "admin"
        if (-not (Test-Path $adminDir)) {
            $adminDir = $WebDir
        }
        
        $version = Get-Date -Format "yyyyMMdd-HHmmss"
        $versionFile = Join-Path $adminDir "version.json"
        $versionContent = @{
            v = $version
            deployed = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
            type = "frontend-only"
        } | ConvertTo-Json
        
        $versionContent | Out-File -FilePath $versionFile -Encoding utf8 -NoNewline
        Write-Log "version.json mis a jour : v=$version" "SUCCESS"
        
        return $version
    }
    catch {
        Write-Log "Erreur generation version.json : $($_.Exception.Message)" "WARN"
        return "unknown"
    }
}


# Fonction pour deployer a distance
function Deploy-RemoteFrontend {
    param([string]$Source, [string]$RemotePath, [string]$ServerName)
    
    Write-Log "Deploiement DISTANT..." "INFO"
    Write-Log "Source: $Source" "INFO"
    Write-Log "Cible:  $RemotePath" "INFO"
    
    $remoteWwwroot = Join-Path $RemotePath "wwwroot"
    
    # Verifier que le dossier distant existe
    if (-not (Test-Path $RemotePath)) {
        Write-Log "Dossier distant introuvable: $RemotePath" "ERROR"
        Write-Log "Conseil: Verifiez que l'API est deployee sur le serveur distant" "WARN"
        return $false
    }
    
    # Creer le dossier wwwroot distant s'il n'existe pas
    if (-not (Test-Path $remoteWwwroot)) {
        New-Item -ItemType Directory -Path $remoteWwwroot -Force | Out-Null
        Write-Log "Dossier wwwroot distant cree: $remoteWwwroot" "INFO"
    }
    
    try {
        # Copier tous les fichiers wwwroot vers le serveur distant
        Copy-Item -Path "$Source\*" -Destination $remoteWwwroot -Recurse -Force
        
        $filesCount = (Get-ChildItem -Path $remoteWwwroot -Recurse -File -ErrorAction SilentlyContinue).Count
        Write-Log "Deploiement distant reussi: $filesCount fichiers copies" "SUCCESS"
        
        return $true
    }
    catch {
        Write-Log "Erreur copie distante: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# ===========================================
# SCRIPT PRINCIPAL
# ===========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOIEMENT FRONTEND DISTANT" -ForegroundColor Cyan
Write-Host "  Serveur: $Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Log "Debut du deploiement frontend DISTANT UNIQUEMENT" "INFO"
Write-Log "Serveur cible: $Server" "INFO"
Write-Log "Dossier distant: $RemoteDeployDir" "INFO"

try {
    # Verifier que le dossier source existe
    if (-not (Test-Path $sourcePath)) {
        throw "Dossier source introuvable: $sourcePath"
    }
    
    Write-Host ""
    Write-Host "--- VERIFICATION CONNECTIVITE ---" -ForegroundColor Yellow
    
    # Tester la connectivite
    if (-not (Test-ServerConnection -ServerName $Server)) {
        throw "Impossible de se connecter au serveur distant $Server"
    }
    
    Write-Host ""
    Write-Host "--- DEPLOIEMENT DISTANT ---" -ForegroundColor Yellow
    
    # Deployer sur le serveur distant
    $success = Deploy-RemoteFrontend -Source $sourcePath -RemotePath $RemoteDeployDir -ServerName $Server
    
    if (-not $success) {
        throw "Echec du deploiement distant"
    }
    
    # Generer version.json
    $version = Update-VersionFile -WebDir $sourcePath
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Log "DEPLOIEMENT TERMINE AVEC SUCCES. Version = $version" "SUCCESS"
    Write-Host ""
    Write-Host "Fichiers mis a jour sur $Server :" -ForegroundColor Cyan
    Write-Host "   HTML (*.html)" -ForegroundColor Green
    Write-Host "   JavaScript (*.js)" -ForegroundColor Green
    Write-Host "   CSS (*.css)" -ForegroundColor Green
    Write-Host "   Images et assets" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: Rafraichissez votre navigateur (Ctrl+F5)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Interface admin: http://${Server}:8088/admin/" -ForegroundColor Green
    Write-Host "API Swagger: http://${Server}:8088/swagger/" -ForegroundColor Green
    Write-Host "Logs: $logFile" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Log "ERREUR CRITIQUE: $($_.Exception.Message)" "ERROR"
    if ($Verbose) {
        Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    }
    Write-Host ""
    Write-Host "Conseil: Verifiez que:" -ForegroundColor Yellow
    Write-Host "  1. Le serveur $Server est accessible" -ForegroundColor Yellow
    Write-Host "  2. Le dossier $RemoteDeployDir existe" -ForegroundColor Yellow
    Write-Host "  3. Vous avez les droits d'acces au serveur" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
finally {
    Write-Log "Fin du script de deploiement frontend" "INFO"
}
