# Test rapide Modbus pour Unit ID 2
$DeviceIP = "192.168.2.198"
$UnitID = 2

Write-Host "Test Modbus Unit ID $UnitID sur $DeviceIP" -ForegroundColor Green

try {
    # Trame Modbus TCP pour lire registre 18442 (Fréquence)
    $request = [byte[]](0x00, 0x01, 0x00, 0x00, 0x00, 0x06, $UnitID, 0x03, 0x48, 0x0A, 0x00, 0x02)
    
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect($DeviceIP, 502)
    $stream = $tcpClient.GetStream()
    
    $stream.Write($request, 0, $request.Length)
    
    $response = New-Object byte[] 1024
    $bytesRead = $stream.Read($response, 0, $response.Length)
    
    $tcpClient.Close()
    
    Write-Host "Réponse ($bytesRead bytes): $([System.Convert]::ToHexString($response[0..($bytesRead-1)]))" -ForegroundColor Cyan
    
    if ($bytesRead -ge 9 -and $response[7] -eq 3) {
        $value = [BitConverter]::ToUInt32($response, 9)
        $frequency = $value / 1000.0
        Write-Host "Fréquence: $frequency Hz" -ForegroundColor Green
    } else {
        Write-Host "Erreur ou pas de données" -ForegroundColor Red
    }
}
catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}
