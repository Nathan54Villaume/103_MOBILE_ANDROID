# Script de test Modbus TCP pour device DIRIS Digiware I-31
# Basé sur la documentation Socomec : https://www.socomec.us/sites/default/files/2022-05/DIRIS-DIGIWARE-I-31-1.10.1_COMMUNICATION-TABLE_2022-05_CMT_EN.html

param(
    [string]$DeviceIP = "192.168.2.198",
    [int]$DevicePort = 502,
    [int]$UnitID = 2,  # Adresse Modbus du device (visible dans Easy Config System)
    [int]$TimeoutMs = 5000
)

# Registres Modbus pour les mesures instantanées - Load #1
$Registers = @{
    "Frequency" = @{ Address = 18442; Type = "U32"; Unit = "mHz"; Scale = 1000 }
    "V1" = @{ Address = 18444; Type = "U32"; Unit = "V"; Scale = 100 }
    "V2" = @{ Address = 18446; Type = "U32"; Unit = "V"; Scale = 100 }
    "V3" = @{ Address = 18448; Type = "U32"; Unit = "V"; Scale = 100 }
    "I1" = @{ Address = 18450; Type = "U32"; Unit = "A"; Scale = 1000 }
    "I2" = @{ Address = 18452; Type = "U32"; Unit = "A"; Scale = 1000 }
    "I3" = @{ Address = 18454; Type = "U32"; Unit = "A"; Scale = 1000 }
    "In" = @{ Address = 18456; Type = "U32"; Unit = "A"; Scale = 1000 }
    "P" = @{ Address = 18458; Type = "U32"; Unit = "W"; Scale = 100 }
    "Q" = @{ Address = 18460; Type = "U32"; Unit = "var"; Scale = 100 }
    "S" = @{ Address = 18462; Type = "U32"; Unit = "VA"; Scale = 100 }
    "PF" = @{ Address = 18464; Type = "U32"; Unit = "%"; Scale = 100 }
}

function Read-ModbusRegister {
    param(
        [int]$RegisterAddress,
        [int]$RegisterCount = 2
    )
    
    try {
        # Créer la trame Modbus TCP
        $transactionID = [BitConverter]::GetBytes([uint16]1)  # Transaction ID
        $protocolID = [BitConverter]::GetBytes([uint16]0)     # Protocol ID (0 pour Modbus)
        $length = [BitConverter]::GetBytes([uint16]6)         # Length
        $unitID = [byte]$UnitID                               # Unit ID
        $functionCode = [byte]3                               # Function Code 3 (Read Holding Registers)
        $startAddress = [BitConverter]::GetBytes([uint16]$RegisterAddress)  # Start Address
        $registerCount = [BitConverter]::GetBytes([uint16]$RegisterCount)   # Register Count
        
        # Assembler la trame
        $request = $transactionID + $protocolID + $length + $unitID + $functionCode + $startAddress + $registerCount
        
        # Connexion TCP
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ReceiveTimeout = $TimeoutMs
        $tcpClient.SendTimeout = $TimeoutMs
        
        $tcpClient.Connect($DeviceIP, $DevicePort)
        $stream = $tcpClient.GetStream()
        
        # Envoyer la requête
        $stream.Write($request, 0, $request.Length)
        
        # Lire la réponse
        $response = New-Object byte[] 1024
        $bytesRead = $stream.Read($response, 0, $response.Length)
        
        $tcpClient.Close()
        
        if ($bytesRead -ge 9) {
            # Vérifier la fonction code (byte 7)
            if ($response[7] -eq 3) {
                # Extraire les données (bytes 8+)
                $dataLength = $response[8]
                $dataBytes = $response[9..($dataLength + 8)]
                
                # Convertir en UInt32 (2 registres = 4 bytes)
                if ($dataBytes.Length -ge 4) {
                    $value = [BitConverter]::ToUInt32($dataBytes, 0)
                    return $value
                }
            }
        }
        
        return $null
    }
    catch {
        Write-Error "Erreur lors de la lecture du registre $RegisterAddress : $($_.Exception.Message)"
        return $null
    }
}

function Convert-ModbusValue {
    param(
        [uint32]$RawValue,
        [string]$Type,
        [double]$Scale
    )
    
    switch ($Type) {
        "U32" { return [double]$RawValue / $Scale }
        "S32" { 
            $signedValue = [int32]$RawValue
            return [double]$signedValue / $Scale 
        }
        default { return [double]$RawValue / $Scale }
    }
}

# Test de connexion
Write-Host "Test de connexion Modbus TCP vers ${DeviceIP}:${DevicePort} (Unit ID: $UnitID)" -ForegroundColor Green

# Lire l'identification du produit
Write-Host "`nLecture de l'identification du produit..." -ForegroundColor Yellow
$productID = Read-ModbusRegister -RegisterAddress 50004 -RegisterCount 1
if ($productID) {
    Write-Host "Product ID: $productID" -ForegroundColor Cyan
}

# Lire les mesures instantanées
Write-Host "`nLecture des mesures instantanées..." -ForegroundColor Yellow
$measurements = @{}

foreach ($measure in $Registers.GetEnumerator()) {
    $name = $measure.Key
    $config = $measure.Value
    
    Write-Host "Lecture de $name (registre $($config.Address))..." -NoNewline
    
    $rawValue = Read-ModbusRegister -RegisterAddress $config.Address -RegisterCount 2
    if ($rawValue -ne $null) {
        $convertedValue = Convert-ModbusValue -RawValue $rawValue -Type $config.Type -Scale $config.Scale
        $measurements[$name] = @{
            RawValue = $rawValue
            Value = $convertedValue
            Unit = $config.Unit
        }
        Write-Host " $convertedValue $($config.Unit)" -ForegroundColor Green
    } else {
        Write-Host " ERREUR" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 100  # Pause entre les lectures
}

# Afficher le résumé
Write-Host "`n=== RÉSUMÉ DES MESURES ===" -ForegroundColor Magenta
Write-Host "Device: ${DeviceIP} (Unit ID: $UnitID)" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan

foreach ($measure in $measurements.GetEnumerator()) {
    $name = $measure.Key
    $data = $measure.Value
    Write-Host "$name`: $($data.Value) $($data.Unit)" -ForegroundColor White
}

Write-Host "`nTest terminé." -ForegroundColor Green
