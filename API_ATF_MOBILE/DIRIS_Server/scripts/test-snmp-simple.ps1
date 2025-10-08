# Script de test simple pour la connexion SNMP avec la passerelle Socomec M50
# Ce script utilise des commandes PowerShell natives

param(
    [Parameter(Mandatory=$false)]
    [string]$TargetHost = "192.168.2.198",
    
    [Parameter(Mandatory=$false)]
    [string]$Community = "public"
)

Write-Host "🔍 Test de connexion SNMP vers $TargetHost" -ForegroundColor Cyan
Write-Host "📡 Communauté: $Community" -ForegroundColor Yellow
Write-Host ""

# Test de connectivité de base
Write-Host "1️⃣ Test de connectivité réseau..." -ForegroundColor Green
try {
    $ping = Test-Connection -ComputerName $TargetHost -Count 1 -Quiet
    if ($ping) {
        Write-Host "✅ Ping réussi vers $TargetHost" -ForegroundColor Green
    } else {
        Write-Host "❌ Ping échoué vers $TargetHost" -ForegroundColor Red
        Write-Host "💡 Vérifiez que la passerelle Socomec M50 est allumée et accessible" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de ping: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test du port SNMP (161)
Write-Host ""
Write-Host "2️⃣ Test du port SNMP (161)..." -ForegroundColor Green
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connectTask = $tcpClient.ConnectAsync($TargetHost, 161)
    
    if ($connectTask.Wait(3000)) {
        if ($tcpClient.Connected) {
            Write-Host "✅ Port 161 accessible sur $TargetHost" -ForegroundColor Green
            $tcpClient.Close()
        } else {
            Write-Host "❌ Port 161 non accessible sur $TargetHost" -ForegroundColor Red
            Write-Host "💡 Vérifiez que SNMP est activé sur la passerelle" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "❌ Timeout de connexion au port 161 sur $TargetHost" -ForegroundColor Red
        Write-Host "💡 Vérifiez que SNMP est activé et que le firewall autorise le trafic" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de connexion TCP: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test HTTP pour vérifier l'interface WEB-CONFIG
Write-Host ""
Write-Host "3️⃣ Test de l'interface WEB-CONFIG..." -ForegroundColor Green
try {
    $webUrl = "http://$TargetHost"
    $response = Invoke-WebRequest -Uri $webUrl -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Interface WEB-CONFIG accessible sur $webUrl" -ForegroundColor Green
        Write-Host "💡 Vous pouvez accéder à l'interface via: $webUrl" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️  Interface WEB-CONFIG non accessible: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "💡 Cela peut être normal si l'interface n'est pas activée" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Tests de connectivité terminés !" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   1. Vérifiez la configuration SNMP sur la passerelle Socomec M50" -ForegroundColor White
Write-Host "   2. Assurez-vous que la communauté '$Community' est correcte" -ForegroundColor White
Write-Host "   3. Testez avec un outil SNMP comme snmpwalk ou MIB Browser" -ForegroundColor White
Write-Host "   4. Vérifiez les OIDs spécifiques à votre modèle de passerelle" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Configuration SNMP recommandée:" -ForegroundColor Yellow
Write-Host "   - Version: SNMP v2c" -ForegroundColor White
Write-Host "   - Communauté de lecture: public" -ForegroundColor White
Write-Host "   - Communauté d'écriture: private" -ForegroundColor White
Write-Host "   - Port: 161" -ForegroundColor White
