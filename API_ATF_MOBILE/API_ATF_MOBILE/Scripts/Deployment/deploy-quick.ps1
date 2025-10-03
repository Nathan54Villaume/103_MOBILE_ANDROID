# ===========================================
# Script de déploiement rapide API_ATF_MOBILE
# Version simplifiée pour déploiements fréquents
# ===========================================

param(
    [string]$Server = "10.250.13.4"
)

$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = (Get-Location).Path }

$remoteDeployDir = "\\$Server\c$\API_ATF_MOBILE\DEPLOIEMENT_API"
$remoteExe = "C:\\API_ATF_MOBILE\\DEPLOIEMENT_API\\API_ATF_MOBILE.exe"
$localWebDir = Join-Path $scriptRoot "wwwroot\supervision-poste-electrique"

Write-Host "🚀 Déploiement rapide vers $Server" -ForegroundColor Cyan

try {
    # 1) Arrêter le processus distant
    Write-Host "🔴 Arrêt du processus distant..." -ForegroundColor Yellow
    Get-WmiObject -Class Win32_Process -ComputerName $Server -Filter "Name='API_ATF_MOBILE.exe'" |
        ForEach-Object { $_.Terminate() } | Out-Null
    Start-Sleep -Seconds 2

    # 2) Nettoyer et publier
    Write-Host "🧹 Nettoyage et publication..." -ForegroundColor Cyan
    Remove-Item "$remoteDeployDir\*" -Recurse -Force -ErrorAction SilentlyContinue
    
    # 3) Générer version.json
    $version = Get-Date -Format "yyyyMMdd-HHmmss"
    $versionFile = Join-Path $localWebDir "version.json"
    "{ `"v`": `"$version`" }" | Out-File -FilePath $versionFile -Encoding utf8 -NoNewline
    
    # 4) Publier
    dotnet publish .\API_ATF_MOBILE.csproj -c Release -r win-x64 -p:SelfContained=true -p:PublishSingleFile=false -o $remoteDeployDir
    
    if ($LASTEXITCODE -ne 0) {
        throw "Échec du 'dotnet publish'"
    }

    # 5) Redémarrer
    Write-Host "🟢 Redémarrage..." -ForegroundColor Cyan
    Invoke-WmiMethod -Class Win32_Process -ComputerName $Server -Name Create -ArgumentList $remoteExe | Out-Null
    
    Write-Host "✅ Déploiement rapide terminé. Version = $version" -ForegroundColor Green
    Write-Host "🌐 Interface: http://$Server`:8088/admin/" -ForegroundColor Green
}
catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
