# API Documentation - DIRIS Server

## Vue d'Ensemble

L'API REST de DIRIS Server fournit des endpoints pour la gestion des devices, l'acquisition de données, les métriques système et la supervision. Tous les endpoints retournent du JSON et utilisent les codes de statut HTTP standard.

## Base URL

```
http://localhost:5000/api
```

## Authentification

Les endpoints d'administration nécessitent une clé API dans le header :
```
X-API-Key: YOUR_API_KEY
```

## Endpoints

### 1. Métriques Système

#### GET /api/metrics/system
Récupère les métriques système en temps réel.

**Réponse :**
```json
{
  "timestamp": "2025-01-30T10:30:00Z",
  "process": {
    "cpuPercent": 15.2,
    "memoryMB": 128.5,
    "workingSetMB": 256.0,
    "privateMemoryMB": 180.3,
    "threads": 12,
    "handles": 450,
    "uptime": "00:02:30:45"
  },
  "system": {
    "cpuPercent": 25.8,
    "memoryTotalMB": 16384,
    "memoryAvailableMB": 8192,
    "uptime": "7.00:00:00"
  },
  "gc": {
    "gen0Collections": 150,
    "gen1Collections": 25,
    "gen2Collections": 3,
    "totalMemoryMB": 45.2,
    "lohSizeMB": 12.8
  }
}
```

#### GET /api/metrics/acquisition
Récupère les métriques d'acquisition.

**Réponse :**
```json
{
  "timestamp": "2025-01-30T10:30:00Z",
  "throughput": {
    "pointsPerSecond": 1250.5,
    "devicesPerSecond": 8.3,
    "averagePollDurationMs": 180.5,
    "p95LatencyMs": 450.2,
    "p99LatencyMs": 800.1
  },
  "devices": [
    {
      "deviceId": 1,
      "name": "DIRIS-001",
      "status": "healthy",
      "lastPollUtc": "2025-01-30T10:29:45Z",
      "pollDurationMs": 165,
      "errorCount": 0,
      "circuitBreakerState": "closed",
      "successRate": 100.0
    }
  ],
  "queues": {
    "measurementBufferSize": 1250,
    "sqlBulkQueueSize": 3,
    "pendingWrites": 2500,
    "maxBufferSize": 1000
  }
}
```

#### GET /api/metrics/throughput
Récupère le taux de débit actuel.

**Réponse :**
```json
{
  "pointsPerSecond": 1250.5
}
```

### 2. Gestion des Devices

#### GET /api/devices
Récupère tous les devices.

**Réponse :**
```json
[
  {
    "deviceId": 1,
    "name": "DIRIS-001",
    "ipAddress": "192.168.2.133",
    "protocol": "webmi",
    "enabled": true,
    "pollIntervalMs": 1500,
    "lastSeenUtc": "2025-01-30T10:29:45Z",
    "metaJson": "{\"location\": \"Salle électrique 1\"}",
    "createdUtc": "2025-01-30T08:00:00Z",
    "updatedUtc": "2025-01-30T10:29:45Z"
  }
]
```

#### GET /api/devices/enabled
Récupère uniquement les devices activés.

#### GET /api/devices/{id}
Récupère un device spécifique.

**Paramètres :**
- `id` (int) : ID du device

**Réponse :** Device object ou 404 si non trouvé

#### POST /api/devices
Crée un nouveau device.

**Headers :**
```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

**Body :**
```json
{
  "name": "DIRIS-004",
  "ipAddress": "192.168.2.136",
  "protocol": "webmi",
  "enabled": true,
  "pollIntervalMs": 1500,
  "metaJson": "{\"location\": \"Salle électrique 4\"}"
}
```

**Réponse :** 201 Created avec le device créé

#### PUT /api/devices/{id}
Met à jour un device existant.

**Headers :**
```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

**Body :** Device object complet

**Réponse :** 204 No Content

#### DELETE /api/devices/{id}
Supprime un device.

**Headers :**
```
X-API-Key: YOUR_API_KEY
```

**Réponse :** 204 No Content

#### GET /api/devices/{id}/tags
Récupère les mappings de tags pour un device.

**Réponse :**
```json
[
  {
    "deviceId": 1,
    "signal": "I_PH1_255",
    "webMiKey": "I_PH1_255",
    "unit": "A",
    "scale": 1000.0,
    "enabled": true
  }
]
```

#### PUT /api/devices/{id}/tags
Met à jour les mappings de tags pour un device.

**Headers :**
```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

**Body :** Array de TagMap objects

**Réponse :** 204 No Content

#### POST /api/devices/{id}/poll
Déclenche un poll manuel pour un device.

**Headers :**
```
X-API-Key: YOUR_API_KEY
```

**Réponse :**
```json
{
  "deviceId": 1,
  "deviceName": "DIRIS-001",
  "utcTs": "2025-01-30T10:30:00Z",
  "measurements": [
    {
      "deviceId": 1,
      "utcTs": "2025-01-30T10:30:00Z",
      "signal": "I_PH1_255",
      "value": 312.72,
      "quality": 1,
      "ingestTs": "2025-01-30T10:30:00Z"
    }
  ],
  "pollDuration": "00:00:00.165",
  "isSuccess": true,
  "errorMessage": null
}
```

#### GET /api/devices/{id}/health
Récupère l'état de santé d'un device.

**Réponse :**
```json
{
  "deviceId": 1,
  "isHealthy": true,
  "circuitBreakerState": "closed",
  "errorCount": 0,
  "lastChecked": "2025-01-30T10:30:00Z"
}
```

### 3. Données de Mesures

#### GET /api/readings/query
Requête de données temporelles avec filtres.

**Paramètres de requête :**
- `deviceId` (int, optionnel) : ID du device
- `signal` (string, optionnel) : Nom du signal
- `from` (datetime, optionnel) : Date de début (ISO 8601)
- `to` (datetime, optionnel) : Date de fin (ISO 8601)
- `downsample` (string, optionnel) : Échantillonnage (1m, 5m, 1h)

**Exemple :**
```
GET /api/readings/query?deviceId=1&signal=I_PH1_255&from=2025-01-30T00:00:00Z&to=2025-01-30T23:59:59Z&downsample=1m
```

**Réponse :**
```json
{
  "deviceId": 1,
  "signal": "I_PH1_255",
  "unit": "A",
  "from": "2025-01-30T00:00:00Z",
  "to": "2025-01-30T23:59:59Z",
  "data": [
    {
      "timestamp": "2025-01-30T00:00:00Z",
      "value": 312.72,
      "quality": 1
    },
    {
      "timestamp": "2025-01-30T00:01:00Z",
      "value": 315.45,
      "quality": 1
    }
  ],
  "count": 1440
}
```

#### GET /api/readings/latest
Récupère les dernières valeurs pour tous les signals.

**Paramètres de requête :**
- `deviceId` (int, optionnel) : ID du device

**Réponse :**
```json
[
  {
    "deviceId": 1,
    "deviceName": "DIRIS-001",
    "signals": [
      {
        "signal": "I_PH1_255",
        "value": 312.72,
        "unit": "A",
        "quality": 1,
        "timestamp": "2025-01-30T10:30:00Z"
      },
      {
        "signal": "F_255",
        "value": 49.97,
        "unit": "Hz",
        "quality": 1,
        "timestamp": "2025-01-30T10:30:00Z"
      }
    ]
  }
]
```

### 4. Health Checks

#### GET /health/live
Vérifie que le service est actif.

**Réponse :** 200 OK si actif

#### GET /health/ready
Vérifie que le service est prêt à traiter les requêtes.

**Réponse :**
```json
{
  "status": "Healthy",
  "totalDuration": 15.5,
  "checks": [
    {
      "name": "database",
      "status": "Healthy",
      "duration": 5.2,
      "description": "Database connection successful"
    },
    {
      "name": "webmi",
      "status": "Healthy", 
      "duration": 8.1,
      "description": "WebMI connectivity good (3/3 devices)"
    }
  ]
}
```

#### GET /health
Health check complet avec détails.

## Codes de Statut HTTP

- **200 OK** : Requête réussie
- **201 Created** : Ressource créée
- **204 No Content** : Requête réussie, pas de contenu
- **400 Bad Request** : Requête malformée
- **401 Unauthorized** : Clé API manquante ou invalide
- **404 Not Found** : Ressource non trouvée
- **500 Internal Server Error** : Erreur serveur

## Gestion des Erreurs

### Format d'Erreur Standard
```json
{
  "error": "Device not found",
  "message": "Device with ID 999 does not exist",
  "details": "Additional error details if available"
}
```

### Exemples d'Erreurs

#### 400 Bad Request
```json
{
  "error": "Validation failed",
  "message": "The request body is invalid",
  "details": {
    "name": ["The Name field is required"],
    "ipAddress": ["The IP Address field is required"]
  }
}
```

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "API key is required for this operation"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred",
  "details": "Check server logs for more information"
}
```

## Limites et Quotas

### Rate Limiting
- **Métriques** : 100 requêtes/minute par IP
- **Données** : 50 requêtes/minute par IP
- **Admin** : 20 requêtes/minute par IP

### Taille des Requêtes
- **Body max** : 1MB
- **Query params** : 2048 caractères
- **Timeout** : 30 secondes

### Pagination
Pour les endpoints retournant des listes :
- **Page size** : 100 éléments max
- **Page** : 1-based indexing
- **Total** : Nombre total d'éléments

## Exemples d'Utilisation

### cURL

#### Récupérer les métriques système
```bash
curl -X GET "http://localhost:5000/api/metrics/system" \
  -H "Accept: application/json"
```

#### Créer un device
```bash
curl -X POST "http://localhost:5000/api/devices" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "name": "DIRIS-004",
    "ipAddress": "192.168.2.136",
    "enabled": true,
    "pollIntervalMs": 1500
  }'
```

#### Requête de données
```bash
curl -X GET "http://localhost:5000/api/readings/query?deviceId=1&signal=I_PH1_255&from=2025-01-30T00:00:00Z&to=2025-01-30T23:59:59Z" \
  -H "Accept: application/json"
```

### PowerShell

#### Récupérer les devices
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/devices" -Method GET
$response | ConvertTo-Json -Depth 3
```

#### Déclencher un poll
```powershell
$headers = @{
    "X-API-Key" = "YOUR_API_KEY"
}
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/devices/1/poll" -Method POST -Headers $headers
$response | ConvertTo-Json -Depth 3
```

### JavaScript (Frontend)

#### Charger les métriques
```javascript
async function loadMetrics() {
    try {
        const response = await fetch('/api/metrics/system');
        const data = await response.json();
        console.log('CPU:', data.process.cpuPercent + '%');
        console.log('Memory:', data.process.memoryMB + ' MB');
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}
```

#### Requête de données avec filtres
```javascript
async function loadChartData(deviceId, signal, from, to) {
    const params = new URLSearchParams({
        deviceId: deviceId,
        signal: signal,
        from: from.toISOString(),
        to: to.toISOString()
    });
    
    const response = await fetch(`/api/readings/query?${params}`);
    const data = await response.json();
    return data.data;
}
```

## Versioning

L'API utilise le versioning par URL :
- **v1** : Version actuelle (par défaut)
- **Future** : `/api/v2/...` pour les versions futures

## Changelog

### v1.0.0 (2025-01-30)
- Première version de l'API
- Endpoints métriques, devices, readings
- Health checks complets
- Authentification par clé API
