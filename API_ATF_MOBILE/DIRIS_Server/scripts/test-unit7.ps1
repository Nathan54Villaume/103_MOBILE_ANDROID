# Test spécifique pour Unit ID 7
$DeviceIP = "192.168.2.198"
$UnitID = 7

Write-Host "=== TEST UNIT ID 7 ===" -ForegroundColor Magenta
Write-Host "Device: $DeviceIP" -ForegroundColor Cyan
Write-Host "Unit ID: $UnitID" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host ""

try {
    # Test de connexion
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.ReceiveTimeout = 3000
    $tcpClient.SendTimeout = 3000
    
    Write-Host "Connexion au device..." -ForegroundColor Yellow
    $tcpClient.Connect($DeviceIP, 502)
    $stream = $tcpClient.GetStream()
    Write-Host "✅ Connexion établie" -ForegroundColor Green
    
    # Test 1: Fréquence (registre 18442)
    Write-Host "`nTest 1: Lecture fréquence (registre 18442)..." -ForegroundColor Yellow
    $request1 = [byte[]](0x00, 0x01, 0x00, 0x00, 0x00, 0x06, $UnitID, 0x03, 0x48, 0x0A, 0x00, 0x02)
    $stream.Write($request1, 0, $request1.Length)
    
    $response1 = New-Object byte[] 1024
    $bytesRead1 = $stream.Read($response1, 0, $response1.Length)
    
    Write-Host "Réponse fréquence: $([System.Convert]::ToHexString($response1[0..($bytesRead1-1)]))" -ForegroundColor Cyan
    
    if ($bytesRead1 -ge 9 -and $response1[7] -eq 3) {
        $freqValue = [BitConverter]::ToUInt32($response1, 9)
        $frequency = $freqValue / 1000.0
        Write-Host "✅ Fréquence: $frequency Hz" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur fréquence - Code: $($response1[7])" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 200
    
    # Test 2: Tension V1 (registre 18444)
    Write-Host "`nTest 2: Lecture tension V1 (registre 18444)..." -ForegroundColor Yellow
    $request2 = [byte[]](0x00, 0x02, 0x00, 0x00, 0x00, 0x06, $UnitID, 0x03, 0x48, 0x0C, 0x00, 0x02)
    $stream.Write($request2, 0, $request2.Length)
    
    $response2 = New-Object byte[] 1024
    $bytesRead2 = $stream.Read($response2, 0, $response2.Length)
    
    Write-Host "Réponse tension: $([System.Convert]::ToHexString($response2[0..($bytesRead2-1)]))" -ForegroundColor Cyan
    
    if ($bytesRead2 -ge 9 -and $response2[7] -eq 3) {
        $voltValue = [BitConverter]::ToUInt32($response2, 9)
        $voltage = $voltValue / 100.0
        Write-Host "✅ Tension V1: $voltage V" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur tension - Code: $($response2[7])" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 200
    
    # Test 3: Courant I1 (registre 18450)
    Write-Host "`nTest 3: Lecture courant I1 (registre 18450)..." -ForegroundColor Yellow
    $request3 = [byte[]](0x00, 0x03, 0x00, 0x00, 0x00, 0x06, $UnitID, 0x03, 0x48, 0x12, 0x00, 0x02)
    $stream.Write($request3, 0, $request3.Length)
    
    $response3 = New-Object byte[] 1024
    $bytesRead3 = $stream.Read($response3, 0, $response3.Length)
    
    Write-Host "Réponse courant: $([System.Convert]::ToHexString($response3[0..($bytesRead3-1)]))" -ForegroundColor Cyan
    
    if ($bytesRead3 -ge 9 -and $response3[7] -eq 3) {
        $currValue = [BitConverter]::ToUInt32($response3, 9)
        $current = $currValue / 1000.0
        Write-Host "✅ Courant I1: $current A" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur courant - Code: $($response3[7])" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 200
    
    # Test 4: Puissance P (registre 18458)
    Write-Host "`nTest 4: Lecture puissance P (registre 18458)..." -ForegroundColor Yellow
    $request4 = [byte[]](0x00, 0x04, 0x00, 0x00, 0x00, 0x06, $UnitID, 0x03, 0x48, 0x1A, 0x00, 0x02)
    $stream.Write($request4, 0, $request4.Length)
    
    $response4 = New-Object byte[] 1024
    $bytesRead4 = $stream.Read($response4, 0, $response4.Length)
    
    Write-Host "Réponse puissance: $([System.Convert]::ToHexString($response4[0..($bytesRead4-1)]))" -ForegroundColor Cyan
    
    if ($bytesRead4 -ge 9 -and $response4[7] -eq 3) {
        $powerValue = [BitConverter]::ToUInt32($response4, 9)
        $power = $powerValue / 100.0
        Write-Host "✅ Puissance P: $power W" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur puissance - Code: $($response4[7])" -ForegroundColor Red
    }
    
    $tcpClient.Close()
    Write-Host "`n✅ Test Unit ID 7 terminé avec succès" -ForegroundColor Green
}
catch {
    Write-Host "`n❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== FIN DU TEST ===" -ForegroundColor Magenta
