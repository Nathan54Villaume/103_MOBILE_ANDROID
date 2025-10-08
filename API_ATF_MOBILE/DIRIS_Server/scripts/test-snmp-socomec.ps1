# Script de test pour la connexion SNMP avec la passerelle Socomec M50
# Usage: .\test-snmp-socomec.ps1 -Host 192.168.2.198 -Community public

param(
    [Parameter(Mandatory=$true)]
    [string]$Host,
    
    [Parameter(Mandatory=$false)]
    [string]$Community = "public",
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 161,
    
    [Parameter(Mandatory=$false)]
    [int]$Timeout = 5000
)

Write-Host "🔍 Test de connexion SNMP vers $Host:$Port" -ForegroundColor Cyan
Write-Host "📡 Communauté: $Community" -ForegroundColor Yellow
Write-Host "⏱️  Timeout: $Timeout ms" -ForegroundColor Yellow
Write-Host ""

# Test de connectivité de base
Write-Host "1️⃣ Test de connectivité réseau..." -ForegroundColor Green
try {
    $ping = Test-Connection -ComputerName $Host -Count 1 -Quiet
    if ($ping) {
        Write-Host "✅ Ping réussi vers $Host" -ForegroundColor Green
    } else {
        Write-Host "❌ Ping échoué vers $Host" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de ping: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test du port SNMP
Write-Host ""
Write-Host "2️⃣ Test du port SNMP..." -ForegroundColor Green
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connectTask = $tcpClient.ConnectAsync($Host, $Port)
    $timeoutTask = Start-Sleep -Seconds 5
    
    if ($connectTask.Wait(5000)) {
        if ($tcpClient.Connected) {
            Write-Host "✅ Port $Port accessible sur $Host" -ForegroundColor Green
            $tcpClient.Close()
        } else {
            Write-Host "❌ Port $Port non accessible sur $Host" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Timeout de connexion au port $Port sur $Host" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de connexion TCP: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test SNMP avec des OIDs de base
Write-Host ""
Write-Host "3️⃣ Test SNMP avec OIDs de base..." -ForegroundColor Green

# OIDs de test (MIB-II standard)
$testOids = @{
    "1.3.6.1.2.1.1.1.0" = "System Description"
    "1.3.6.1.2.1.1.3.0" = "System Uptime"
    "1.3.6.1.2.1.1.4.0" = "System Contact"
    "1.3.6.1.2.1.1.5.0" = "System Name"
}

foreach ($oid in $testOids.Keys) {
    $description = $testOids[$oid]
    Write-Host "   🔍 Test OID $oid ($description)..." -ForegroundColor Yellow
    
    try {
        # Utilisation de snmpwalk si disponible, sinon snmpget
        $command = "snmpget -v2c -c $Community -t $([math]::Floor($Timeout/1000)) $Host $oid"
        Write-Host "   📝 Commande: $command" -ForegroundColor Gray
        
        $result = Invoke-Expression $command 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $description: $result" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Erreur pour $description: $result" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ❌ Exception pour $description: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test avec des OIDs Socomec spécifiques
Write-Host ""
Write-Host "4️⃣ Test avec OIDs Socomec spécifiques..." -ForegroundColor Green

$socomecOids = @{
    "1.3.6.1.4.1.4555.1.1.1.1.3.1.1.1.1.1" = "Voltage L1"
    "1.3.6.1.4.1.4555.1.1.1.1.3.1.1.2.1.1" = "Current L1"
    "1.3.6.1.4.1.4555.1.1.1.1.3.1.1.3.1.1" = "Active Power"
    "1.3.6.1.4.1.4555.1.1.1.1.3.1.1.4.1.1" = "Frequency"
}

foreach ($oid in $socomecOids.Keys) {
    $description = $socomecOids[$oid]
    Write-Host "   🔍 Test OID Socomec $oid ($description)..." -ForegroundColor Yellow
    
    try {
        $command = "snmpget -v2c -c $Community -t $([math]::Floor($Timeout/1000)) $Host $oid"
        $result = Invoke-Expression $command 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $description: $result" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $description: $result (peut être normal si l'OID n'existe pas)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ Exception pour $description: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎯 Test terminé !" -ForegroundColor Cyan
Write-Host "💡 Si les tests SNMP échouent, vérifiez:" -ForegroundColor Yellow
Write-Host "   - Que SNMP est activé sur la passerelle Socomec M50" -ForegroundColor White
Write-Host "   - Que la communauté '$Community' est correcte" -ForegroundColor White
Write-Host "   - Que le firewall autorise le trafic SNMP (port $Port)" -ForegroundColor White
Write-Host "   - Que les OIDs Socomec sont corrects pour votre modèle" -ForegroundColor White
