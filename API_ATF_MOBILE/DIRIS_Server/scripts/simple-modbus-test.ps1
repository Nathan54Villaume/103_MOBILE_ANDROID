# Test simple Modbus TCP pour device DIRIS
param(
    [string]$DeviceIP = "192.168.2.198",
    [int]$UnitID = 2
)

Write-Host "Test Modbus TCP vers $DeviceIP (Unit ID: $UnitID)" -ForegroundColor Green

try {
    # Créer la trame Modbus TCP pour lire le registre 18442 (Fréquence)
    $transactionID = [BitConverter]::GetBytes([uint16]1)
    $protocolID = [BitConverter]::GetBytes([uint16]0)
    $length = [BitConverter]::GetBytes([uint16]6)
    $unitID = [byte]$UnitID
    $functionCode = [byte]3
    $startAddress = [BitConverter]::GetBytes([uint16]18442)
    $registerCount = [BitConverter]::GetBytes([uint16]2)
    
    $request = $transactionID + $protocolID + $length + $unitID + $functionCode + $startAddress + $registerCount
    
    Write-Host "Trame envoyée: $([System.Convert]::ToHexString($request))" -ForegroundColor Yellow
    
    # Connexion TCP
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect($DeviceIP, 502)
    $stream = $tcpClient.GetStream()
    
    # Envoyer la requête
    $stream.Write($request, 0, $request.Length)
    
    # Lire la réponse
    $response = New-Object byte[] 1024
    $bytesRead = $stream.Read($response, 0, $response.Length)
    
    $tcpClient.Close()
    
    Write-Host "Réponse reçue ($bytesRead bytes): $([System.Convert]::ToHexString($response[0..($bytesRead-1)]))" -ForegroundColor Cyan
    
    if ($bytesRead -ge 9) {
        if ($response[7] -eq 3) {
            $dataLength = $response[8]
            Write-Host "Longueur des données: $dataLength" -ForegroundColor Green
            
            if ($dataLength -ge 4) {
                $dataBytes = $response[9..12]
                $value = [BitConverter]::ToUInt32($dataBytes, 0)
                $frequency = [double]$value / 1000.0  # Conversion mHz -> Hz
                Write-Host "Fréquence brute: $value mHz" -ForegroundColor Yellow
                Write-Host "Fréquence: $frequency Hz" -ForegroundColor Green
            }
        } else {
            Write-Host "Code d'erreur Modbus: $($response[7])" -ForegroundColor Red
        }
    } else {
        Write-Host "Réponse trop courte" -ForegroundColor Red
    }
}
catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test terminé." -ForegroundColor Green
