# Test Modbus TCP pour plusieurs Unit ID sur le device DIRIS 192.168.2.198
param(
    [string]$DeviceIP = "192.168.2.198",
    [int[]]$UnitIDs = @(2,3,4,7,8,9,10)
)

function Read-ModbusRegister {
    param(
        [string]$IP,
        [int]$UnitID,
        [int]$RegisterAddress,
        [int]$RegisterCount = 2
    )
    
    try {
        # Créer la trame Modbus TCP
        $transactionID = [BitConverter]::GetBytes([uint16]1)
        $protocolID = [BitConverter]::GetBytes([uint16]0)
        $length = [BitConverter]::GetBytes([uint16]6)
        $unitID = [byte]$UnitID
        $functionCode = [byte]3
        $startAddress = [BitConverter]::GetBytes([uint16]$RegisterAddress)
        $registerCount = [BitConverter]::GetBytes([uint16]$RegisterCount)
        
        $request = $transactionID + $protocolID + $length + $unitID + $functionCode + $startAddress + $registerCount
        
        # Connexion TCP
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ReceiveTimeout = 3000
        $tcpClient.SendTimeout = 3000
        
        $tcpClient.Connect($IP, 502)
        $stream = $tcpClient.GetStream()
        
        # Envoyer la requête
        $stream.Write($request, 0, $request.Length)
        
        # Lire la réponse
        $response = New-Object byte[] 1024
        $bytesRead = $stream.Read($response, 0, $response.Length)
        
        $tcpClient.Close()
        
        if ($bytesRead -ge 9) {
            if ($response[7] -eq 3) {
                $dataLength = $response[8]
                if ($dataLength -ge 4) {
                    $dataBytes = $response[9..12]
                    $value = [BitConverter]::ToUInt32($dataBytes, 0)
                    return $value
                }
            }
        }
        return $null
    }
    catch {
        return $null
    }
}

function Convert-ModbusValue {
    param(
        [uint32]$RawValue,
        [double]$Scale
    )
    return [double]$RawValue / $Scale
}

# Registres clés à tester
$Registers = @{
    "Freq" = @{ Address = 18442; Scale = 1000; Unit = "Hz" }
    "V1" = @{ Address = 18444; Scale = 100; Unit = "V" }
    "V2" = @{ Address = 18446; Scale = 100; Unit = "V" }
    "V3" = @{ Address = 18448; Scale = 100; Unit = "V" }
    "I1" = @{ Address = 18450; Scale = 1000; Unit = "A" }
    "I2" = @{ Address = 18452; Scale = 1000; Unit = "A" }
    "I3" = @{ Address = 18454; Scale = 1000; Unit = "A" }
    "In" = @{ Address = 18456; Scale = 1000; Unit = "A" }
    "P" = @{ Address = 18458; Scale = 100; Unit = "W" }
    "Q" = @{ Address = 18460; Scale = 100; Unit = "var" }
    "S" = @{ Address = 18462; Scale = 100; Unit = "VA" }
    "PF" = @{ Address = 18464; Scale = 100; Unit = "%" }
}

Write-Host "=== TEST MODBUS TCP - Device: $DeviceIP ===" -ForegroundColor Magenta
Write-Host "Unit IDs à tester: $($UnitIDs -join ', ')" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host ""

foreach ($unitID in $UnitIDs) {
    Write-Host "--- UNIT ID: $unitID ---" -ForegroundColor Yellow
    
    $hasData = $false
    $measurements = @{}
    
    foreach ($register in $Registers.GetEnumerator()) {
        $name = $register.Key
        $config = $register.Value
        
        $rawValue = Read-ModbusRegister -IP $DeviceIP -UnitID $unitID -RegisterAddress $config.Address
        if ($rawValue -ne $null) {
            $convertedValue = Convert-ModbusValue -RawValue $rawValue -Scale $config.Scale
            $measurements[$name] = $convertedValue
            $hasData = $true
        }
        
        Start-Sleep -Milliseconds 50
    }
    
    if ($hasData) {
        Write-Host "✅ Données disponibles:" -ForegroundColor Green
        foreach ($measure in $measurements.GetEnumerator()) {
            $name = $measure.Key
            $value = $measure.Value
            $unit = $Registers[$name].Unit
            Write-Host "  $name`: $value $unit" -ForegroundColor White
        }
    } else {
        Write-Host "❌ Aucune donnée disponible" -ForegroundColor Red
    }
    
    Write-Host ""
    Start-Sleep -Milliseconds 200
}

Write-Host "=== TEST TERMINÉ ===" -ForegroundColor Magenta
