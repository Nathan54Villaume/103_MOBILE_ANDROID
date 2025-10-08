# Script pour tester les ports communs des passerelles Socomec
param(
    [Parameter(Mandatory=$false)]
    [string]$TargetHost = "192.168.2.198"
)

Write-Host "🔍 Test des ports sur $TargetHost" -ForegroundColor Cyan
Write-Host ""

$ports = @(
    @{Port=80; Service="HTTP"},
    @{Port=443; Service="HTTPS"},
    @{Port=8080; Service="HTTP Alt"},
    @{Port=8081; Service="HTTP Alt 2"},
    @{Port=161; Service="SNMP"},
    @{Port=162; Service="SNMP Trap"},
    @{Port=502; Service="Modbus TCP"},
    @{Port=23; Service="Telnet"}
)

foreach ($portInfo in $ports) {
    $port = $portInfo.Port
    $service = $portInfo.Service
    
    Write-Host "🔍 Test port $port ($service)..." -ForegroundColor Yellow
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connectTask = $tcpClient.ConnectAsync($TargetHost, $port)
        
        if ($connectTask.Wait(2000)) {
            if ($tcpClient.Connected) {
                Write-Host "   ✅ Port $port ($service) : OUVERT" -ForegroundColor Green
                $tcpClient.Close()
            } else {
                Write-Host "   ❌ Port $port ($service) : FERME" -ForegroundColor Red
            }
        } else {
            Write-Host "   ⏱️  Port $port ($service) : TIMEOUT" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ Port $port ($service) : ERREUR" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎯 Test terminé !" -ForegroundColor Cyan



