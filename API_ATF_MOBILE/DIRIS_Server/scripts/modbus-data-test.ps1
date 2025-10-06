# Test des données Modbus pour Unit ID 2,3,4,7,8,9,10
$DeviceIP = "192.168.2.198"
$UnitIDs = @(2,3,4,7,8,9,10)

Write-Host "=== TEST DONNÉES MODBUS - Device: $DeviceIP ===" -ForegroundColor Magenta
Write-Host "Unit IDs: $($UnitIDs -join ', ')" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host ""

foreach ($UnitID in $UnitIDs) {
    Write-Host "--- UNIT ID: $UnitID ---" -ForegroundColor Yellow
    
    try {
        # Test de connexion rapide
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ReceiveTimeout = 2000
        $tcpClient.SendTimeout = 2000
        
        $tcpClient.Connect($DeviceIP, 502)
        $stream = $tcpClient.GetStream()
        
        # Trame pour lire la fréquence (registre 18442)
        $request = [byte[]](0x00, 0x01, 0x00, 0x00, 0x00, 0x06, $UnitID, 0x03, 0x48, 0x0A, 0x00, 0x02)
        $stream.Write($request, 0, $request.Length)
        
        $response = New-Object byte[] 1024
        $bytesRead = $stream.Read($response, 0, $response.Length)
        
        $tcpClient.Close()
        
        if ($bytesRead -ge 9 -and $response[7] -eq 3) {
            $value = [BitConverter]::ToUInt32($response, 9)
            $frequency = $value / 1000.0
            Write-Host "✅ Fréquence: $frequency Hz" -ForegroundColor Green
            
            # Test tension V1 (registre 18444)
            $tcpClient2 = New-Object System.Net.Sockets.TcpClient
            $tcpClient2.Connect($DeviceIP, 502)
            $stream2 = $tcpClient2.GetStream()
            
            $request2 = [byte[]](0x00, 0x02, 0x00, 0x00, 0x00, 0x06, $UnitID, 0x03, 0x48, 0x0C, 0x00, 0x02)
            $stream2.Write($request2, 0, $request2.Length)
            
            $response2 = New-Object byte[] 1024
            $bytesRead2 = $stream2.Read($response2, 0, $response2.Length)
            $tcpClient2.Close()
            
            if ($bytesRead2 -ge 9 -and $response2[7] -eq 3) {
                $value2 = [BitConverter]::ToUInt32($response2, 9)
                $voltage = $value2 / 100.0
                Write-Host "✅ Tension V1: $voltage V" -ForegroundColor Green
                
                # Test courant I1 (registre 18450)
                $tcpClient3 = New-Object System.Net.Sockets.TcpClient
                $tcpClient3.Connect($DeviceIP, 502)
                $stream3 = $tcpClient3.GetStream()
                
                $request3 = [byte[]](0x00, 0x03, 0x00, 0x00, 0x00, 0x06, $UnitID, 0x03, 0x48, 0x12, 0x00, 0x02)
                $stream3.Write($request3, 0, $request3.Length)
                
                $response3 = New-Object byte[] 1024
                $bytesRead3 = $stream3.Read($response3, 0, $response3.Length)
                $tcpClient3.Close()
                
                if ($bytesRead3 -ge 9 -and $response3[7] -eq 3) {
                    $value3 = [BitConverter]::ToUInt32($response3, 9)
                    $current = $value3 / 1000.0
                    Write-Host "✅ Courant I1: $current A" -ForegroundColor Green
                } else {
                    Write-Host "❌ Pas de données courant" -ForegroundColor Red
                }
            } else {
                Write-Host "❌ Pas de données tension" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ Pas de données ou erreur Modbus" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ Erreur connexion: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Start-Sleep -Milliseconds 500
}

Write-Host "=== TEST TERMINÉ ===" -ForegroundColor Magenta
