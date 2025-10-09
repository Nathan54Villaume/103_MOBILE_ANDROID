# 🔌 Nouveaux Endpoints pour Debug et Monitoring

## 📋 LOGS EN TEMPS RÉEL

### 1. Récupérer les dernières lignes du log
```http
GET /api/diris/logs/recent?lines=100
```

**Paramètres** :
- `lines` (optionnel) : Nombre de lignes à récupérer (défaut: 100)

**Réponse** :
```json
{
  "success": true,
  "logFile": "app-20251009.log",
  "linesReturned": 100,
  "logs": [
    "[2025-10-09 13:12:45 INF] DIRIS Acquisition service STARTED",
    "[2025-10-09 13:12:45 DBG] [CYCLE 1] Starting new acquisition cycle",
    ...
  ]
}
```

---

### 2. Récupérer uniquement les logs d'acquisition DIRIS
```http
GET /api/diris/logs/acquisition?lines=100
```

**Paramètres** :
- `lines` (optionnel) : Nombre de lignes à récupérer (défaut: 100)

**Filtre** : Lignes contenant "DIRIS", "DEVICE", "CYCLE", "WATCHDOG", "Acquisition"

**Réponse** : Identique à `/recent` mais filtré

---

### 3. Récupérer uniquement les erreurs
```http
GET /api/diris/logs/errors?lines=50
```

**Paramètres** :
- `lines` (optionnel) : Nombre de lignes à récupérer (défaut: 50)

**Filtre** : Lignes contenant "[ERR]", "[WRN]", "[CRT]", "ERROR", "CRITICAL", "!!!"

**Réponse** : Identique à `/recent` mais filtré sur les erreurs

---

### 4. Lister tous les fichiers de logs
```http
GET /api/diris/logs/files
```

**Réponse** :
```json
{
  "success": true,
  "filesCount": 5,
  "files": [
    {
      "name": "app-20251009.log",
      "sizeMB": 2.35,
      "lastModified": "2025-10-09T13:20:00",
      "created": "2025-10-09T08:00:00"
    },
    ...
  ]
}
```

---

## 🩺 HEALTH CHECKS

### 1. Health check complet
```http
GET /api/diris/health
```

**Réponse** :
```json
{
  "timestamp": "2025-10-09T13:20:00Z",
  "acquisition": {
    "status": "healthy",
    "message": "Acquisition is active and collecting data",
    "lastDataSeconds": 8
  },
  "database": {
    "status": "healthy",
    "message": "Database is accessible",
    "connectionTimeMs": 12,
    "totalMeasurements": 664063
  },
  "storage": {
    "status": "healthy",
    "message": "Sufficient disk space",
    "freeSpaceGB": 125.43
  },
  "overall": "healthy"
}
```

**Statuts possibles** :
- `healthy` : Tout fonctionne normalement
- `degraded` : Fonctionne mais avec des problèmes mineurs
- `unhealthy` : Problème critique nécessitant une action
- `stopped` : Acquisition arrêtée par l'utilisateur

---

### 2. Diagnostic détaillé
```http
GET /api/diris/health/diagnostic
```

**Réponse** :
```json
{
  "timestamp": "2025-10-09T13:20:00Z",
  "server": {
    "machineName": "ATF-SERVER-01",
    "osVersion": "Microsoft Windows NT 10.0.20348.0",
    "processorCount": 8,
    "dotnetVersion": "8.0.0",
    "is64Bit": true,
    "workingSetMB": 256.45,
    "uptime": "02:15:30"
  },
  "acquisition": {
    "isRunning": true,
    "status": "Running",
    "lastStateChange": "2025-10-09T11:05:00Z",
    "lastUpdate": "2025-10-09T13:20:00Z",
    "statePersisted": true
  },
  "database": {
    "totalMeasurements": 664063,
    "deviceCount": 6,
    "firstMeasurement": "2025-10-08T16:21:37Z",
    "lastMeasurement": "2025-10-09T13:19:58Z",
    "lastIngest": "2025-10-09T13:19:58Z",
    "secondsSinceLastIngest": 2
  },
  "recentErrors": [
    "[2025-10-09 12:45:12 WRN] Failed to read from DIRIS device 3: Timeout",
    ...
  ]
}
```

---

## 🎯 EXEMPLES D'UTILISATION

### PowerShell

```powershell
# Health check
$health = Invoke-RestMethod -Uri "http://10.250.13.4:8088/api/diris/health"
if ($health.overall -ne "healthy") {
    Write-Host "ALERTE: Système en état $($health.overall)" -ForegroundColor Red
}

# Logs d'acquisition
$logs = Invoke-RestMethod -Uri "http://10.250.13.4:8088/api/diris/logs/acquisition?lines=50"
$logs.logs | ForEach-Object { Write-Host $_ }

# Erreurs récentes
$errors = Invoke-RestMethod -Uri "http://10.250.13.4:8088/api/diris/logs/errors?lines=20"
if ($errors.linesReturned -gt 0) {
    Write-Host "ERREURS DÉTECTÉES:" -ForegroundColor Red
    $errors.logs | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
}

# Diagnostic complet
$diagnostic = Invoke-RestMethod -Uri "http://10.250.13.4:8088/api/diris/health/diagnostic"
Write-Host "Uptime: $($diagnostic.server.uptime)"
Write-Host "Total mesures: $($diagnostic.database.totalMeasurements)"
Write-Host "Dernière donnée: $($diagnostic.database.secondsSinceLastIngest)s"
```

---

### Curl (Linux/Mac)

```bash
# Health check
curl http://10.250.13.4:8088/api/diris/health | jq .

# Logs d'acquisition
curl "http://10.250.13.4:8088/api/diris/logs/acquisition?lines=50" | jq -r '.logs[]'

# Erreurs récentes
curl "http://10.250.13.4:8088/api/diris/logs/errors?lines=20" | jq -r '.logs[]'

# Diagnostic
curl http://10.250.13.4:8088/api/diris/health/diagnostic | jq .
```

---

### JavaScript/Fetch

```javascript
// Health check
fetch('http://10.250.13.4:8088/api/diris/health')
  .then(res => res.json())
  .then(data => {
    console.log(`Status global: ${data.overall}`);
    console.log(`Acquisition: ${data.acquisition.status}`);
    console.log(`Database: ${data.database.status}`);
  });

// Logs d'acquisition
fetch('http://10.250.13.4:8088/api/diris/logs/acquisition?lines=50')
  .then(res => res.json())
  .then(data => {
    data.logs.forEach(log => console.log(log));
  });

// Erreurs récentes
fetch('http://10.250.13.4:8088/api/diris/logs/errors?lines=20')
  .then(res => res.json())
  .then(data => {
    if (data.linesReturned > 0) {
      console.error(`${data.linesReturned} erreurs détectées:`);
      data.logs.forEach(log => console.error(log));
    }
  });
```

---

## 🔄 MONITORING AUTOMATIQUE

### Script PowerShell de monitoring (à lancer toutes les 5 minutes)

```powershell
# monitor-diris.ps1
$serverUrl = "http://10.250.13.4:8088"

try {
    # Health check
    $health = Invoke-RestMethod -Uri "$serverUrl/api/diris/health" -TimeoutSec 5
    
    if ($health.overall -eq "unhealthy") {
        # ALERTE CRITIQUE
        Write-Host "[$(Get-Date)] CRITIQUE: Système unhealthy!" -ForegroundColor Red
        
        # Récupérer les erreurs
        $errors = Invoke-RestMethod -Uri "$serverUrl/api/diris/logs/errors?lines=10"
        $errors.logs | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
        
        # TODO: Envoyer un email d'alerte
        # Send-MailMessage -To "admin@example.com" -Subject "ALERTE DIRIS" -Body "..."
    }
    elseif ($health.overall -eq "degraded") {
        Write-Host "[$(Get-Date)] ATTENTION: Système degraded" -ForegroundColor Yellow
    }
    else {
        Write-Host "[$(Get-Date)] OK: Système healthy" -ForegroundColor Green
    }
    
    # Afficher les stats d'acquisition
    $acq = $health.acquisition
    Write-Host "  Acquisition: $($acq.status) | Dernière donnée: $($acq.lastDataSeconds)s"
}
catch {
    Write-Host "[$(Get-Date)] ERREUR: Impossible de contacter l'API!" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Yellow
}
```

---

### Tâche planifiée Windows

```powershell
# Créer une tâche planifiée pour exécuter le script toutes les 5 minutes
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Scripts\monitor-diris.ps1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "DIRIS Health Monitor" -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

---

## 📊 DASHBOARD WEB (Optionnel)

Vous pouvez créer une page HTML simple qui affiche le statut en temps réel :

```html
<!DOCTYPE html>
<html>
<head>
    <title>DIRIS Health Dashboard</title>
    <style>
        body { font-family: Arial; background: #1a1a1a; color: #fff; padding: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .healthy { background: #0f5132; }
        .degraded { background: #664d03; }
        .unhealthy { background: #842029; }
        #logs { background: #2a2a2a; padding: 15px; border-radius: 5px; height: 400px; overflow-y: scroll; font-family: monospace; font-size: 12px; }
    </style>
</head>
<body>
    <h1>🩺 DIRIS Health Dashboard</h1>
    <div id="status"></div>
    <h2>📋 Logs récents</h2>
    <div id="logs"></div>

    <script>
        async function updateDashboard() {
            const health = await fetch('http://10.250.13.4:8088/api/diris/health').then(r => r.json());
            
            const statusDiv = document.getElementById('status');
            statusDiv.className = `status ${health.overall}`;
            statusDiv.innerHTML = `
                <h2>Status: ${health.overall.toUpperCase()}</h2>
                <p>Acquisition: ${health.acquisition.status} (dernière donnée: ${health.acquisition.lastDataSeconds}s)</p>
                <p>Database: ${health.database.status} (${health.database.totalMeasurements} mesures)</p>
                <p>Storage: ${health.storage.status} (${health.storage.freeSpaceGB} GB libre)</p>
            `;
            
            const logs = await fetch('http://10.250.13.4:8088/api/diris/logs/acquisition?lines=50').then(r => r.json());
            document.getElementById('logs').innerHTML = logs.logs.join('<br>');
        }

        updateDashboard();
        setInterval(updateDashboard, 10000); // Refresh toutes les 10 secondes
    </script>
</body>
</html>
```

---

**Dernière mise à jour** : 09/10/2025

