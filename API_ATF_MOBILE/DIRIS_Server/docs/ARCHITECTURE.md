# Architecture DIRIS Server

## Vue d'Ensemble

DIRIS Server est une application .NET 8 modulaire conçue pour l'acquisition haute performance de données depuis les équipements Socomec DIRIS. L'architecture suit les principes SOLID et utilise des patterns modernes pour garantir la scalabilité, la résilience et la maintenabilité.

## Diagramme d'Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DIRIS SERVER (.NET 8)                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│  │   Web UI        │    │   REST API      │    │  Health/Metrics │            │
│  │   (Static)      │    │   (Minimal)     │    │  (Serilog)      │            │
│  └─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘            │
│            │                      │                      │                    │
│            └──────────────────────┼──────────────────────┘                    │
│                                   │                                           │
│  ┌─────────────────────────────────▼─────────────────────────────────────────┐ │
│  │                    Kestrel HTTP Server (Windows Service)                  │ │
│  └─────────────────────────────────┬─────────────────────────────────────────┘ │
│                                    │                                           │
│  ┌─────────────────────────────────▼─────────────────────────────────────────┐ │
│  │                    Background Service (Acquisition)                      │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │ │
│  │  │   Device    │  │   Device    │  │   Device    │  │   Device    │     │ │
│  │  │  Registry   │  │   Reader    │  │   Reader    │  │   Reader    │     │ │
│  │  │             │  │  (WebMI)    │  │  (WebMI)    │  │  (WebMI)    │     │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │ │
│  │         │                │                │                │             │ │
│  │         └────────────────┼────────────────┼────────────────┘             │ │
│  │                          │                │                              │ │
│  │  ┌───────────────────────▼────────────────▼─────────────────────────────┐ │ │
│  │  │              Bulk Writer (SQL Server)                               │ │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │ │ │
│  │  │  │   Buffer    │  │   Buffer    │  │   Buffer    │                 │ │ │
│  │  │  │  (250-1K)   │  │  (250-1K)   │  │  (250-1K)   │                 │ │ │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘                 │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                           │
│  ┌─────────────────────────────────▼─────────────────────────────────────────┐ │
│  │                    SQL Server AI_ATR (SqlAiAtr)                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │ │
│  │  │   Devices   │  │Measurements │  │   TagMap    │  │  LastValue  │     │ │
│  │  │   Table     │  │   Table     │  │   Table     │  │    View     │     │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Couches de l'Application

### 1. Couche Présentation (Diris.Server)

#### Composants
- **Kestrel HTTP Server** : Serveur web haute performance
- **Minimal API** : Endpoints REST légers et rapides
- **Static Files** : Interface web intégrée (HTML/CSS/JS)
- **Windows Service** : Intégration système Windows

#### Responsabilités
- Exposition des APIs REST
- Servir l'interface web statique
- Gestion des requêtes HTTP
- Intégration avec le système Windows

### 2. Couche Métier (Diris.Core)

#### Composants
- **Models** : Entités métier (Device, Measurement, TagMap)
- **Interfaces** : Contrats pour l'injection de dépendances
- **DTOs** : Objets de transfert de données

#### Responsabilités
- Définition du modèle métier
- Abstraction des dépendances
- Contrats pour les couches externes

### 3. Couche Accès aux Données (Diris.Providers.WebMI)

#### Composants
- **WebMiClient** : Client HTTP pour WebMI
- **WebMiReader** : Lecteur avec circuit breaker
- **Polly Integration** : Retry, timeout, circuit breaker

#### Responsabilités
- Communication avec les devices DIRIS
- Gestion de la résilience (retry, circuit breaker)
- Normalisation des données WebMI

### 4. Couche Persistance (Diris.Storage.SqlServer)

#### Composants
- **DeviceRepository** : CRUD des devices
- **BulkWriter** : Écriture en lot optimisée
- **SqlBulkCopy** : Performance maximale

#### Responsabilités
- Persistance des données
- Optimisation des performances
- Gestion des transactions

## Patterns Architecturaux

### 1. Dependency Injection
```csharp
// Configuration dans Program.cs
builder.Services.AddWebMiProvider();
builder.Services.AddSqlServerStorage();
builder.Services.AddSingleton<ISystemMetricsCollector, SystemMetricsCollector>();
```

### 2. Repository Pattern
```csharp
public interface IDeviceRegistry
{
    Task<IEnumerable<Device>> GetEnabledDevicesAsync();
    Task<Device?> GetDeviceAsync(int deviceId);
    // ...
}
```

### 3. Circuit Breaker Pattern
```csharp
// Dans WebMiReader
var circuitBreaker = Policy
    .Handle<HttpRequestException>()
    .CircuitBreakerAsync(
        handledEventsAllowedBeforeBreaking: 5,
        durationOfBreak: TimeSpan.FromSeconds(20));
```

### 4. Background Service Pattern
```csharp
public class AcquisitionService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Boucle d'acquisition continue
    }
}
```

## Flux de Données

### 1. Acquisition
```
BackgroundService (Timer)
    ↓
DeviceRegistry.GetEnabledDevicesAsync()
    ↓
Parallel.ForEach(devices, parallelism=6)
    ↓
WebMiReader.ReadAsync(device) [avec Polly CB]
    ↓
Normalisation → DirisReading
    ↓
Buffer.Add(measurements) [ring buffer]
    ↓
BulkWriter.WriteAsync() [SqlBulkCopy, batch=250-1000]
    ↓
SQL Server AI_ATR
```

### 2. API REST
```
HTTP Request
    ↓
Minimal API Controller
    ↓
Service Layer (Repository/Reader)
    ↓
Database/WebMI
    ↓
JSON Response
```

### 3. Interface Web
```
Browser Request
    ↓
Static File Middleware
    ↓
HTML/CSS/JS
    ↓
AJAX Calls to API
    ↓
Real-time Updates
```

## Gestion de la Résilience

### 1. Retry Policy
```json
{
  "Polly": {
    "RetryCount": 3,
    "RetryBaseDelayMs": 150,
    "RetryBackoffExponent": 2.0
  }
}
```

### 2. Circuit Breaker
```json
{
  "CircuitBreaker": {
    "Failures": 5,
    "WindowSeconds": 30,
    "BreakSeconds": 20
  }
}
```

### 3. Timeout
```json
{
  "WebMi": {
    "RequestTimeoutMs": 1500
  }
}
```

## Optimisations de Performance

### 1. Parallélisme Contrôlé
- **SemaphoreSlim** : Limite le nombre de readers simultanés
- **Configuration** : 6-12 devices en parallèle selon la charge
- **Jitter** : Évite les pics de charge simultanés

### 2. Bulk SQL
- **SqlBulkCopy** : Insertion en lot optimisée
- **Buffer Size** : 250-1000 points par lot
- **Index** : Optimisés pour les requêtes de courbes

### 3. Caching
- **Device Registry** : Cache des devices actifs
- **Tag Mappings** : Cache des mappings par device
- **Metrics** : Ring buffer pour les métriques temps réel

## Observabilité

### 1. Logging (Serilog)
```json
{
  "Serilog": {
    "WriteTo": [
      { "Name": "Console" },
      { "Name": "File", "Args": { "path": "logs/diris-.log" } }
    ]
  }
}
```

### 2. Health Checks
- **Liveness** : Service actif
- **Readiness** : Prêt à traiter les requêtes
- **Database** : Connexion SQL
- **WebMI** : Connectivité devices

### 3. Métriques
- **Système** : CPU, RAM, GC, threads
- **Acquisition** : Débit, latence, erreurs
- **Business** : Points/s, devices/s, taux de succès

## Sécurité

### 1. API Security
- **API Key** : Header `X-API-Key` pour endpoints admin
- **CORS** : Configuration minimale
- **HTTPS** : Recommandé en production

### 2. Database Security
- **Connection String** : Chiffrement recommandé
- **Permissions** : Utilisateur dédié avec droits minimaux
- **Audit** : Logs des opérations sensibles

## Scalabilité

### 1. Horizontal Scaling
- **Stateless** : Pas d'état partagé
- **Load Balancer** : Possible avec plusieurs instances
- **Database** : Partage de la même base

### 2. Vertical Scaling
- **Parallélisme** : Ajustable selon les ressources
- **Buffer Size** : Adaptable à la mémoire disponible
- **Poll Interval** : Configurable par device

### 3. Capacity Planning
- **25 devices** : 2 CPU cores, 4GB RAM
- **50 devices** : 4 CPU cores, 8GB RAM
- **100 devices** : 8 CPU cores, 16GB RAM

## Maintenance

### 1. Monitoring
- **Logs** : Rotation quotidienne, 30 jours
- **Métriques** : Dashboard temps réel
- **Alertes** : Seuils configurables

### 2. Updates
- **Zero Downtime** : Redémarrage du service
- **Configuration** : Hot reload pour certains paramètres
- **Database** : Migrations via scripts SQL

### 3. Backup
- **Configuration** : `appsettings.json`, `devices.json`
- **Database** : Tables `DIRIS.*`
- **Logs** : Dossier `logs/`

Cette architecture garantit une solution robuste, performante et maintenable pour l'acquisition de données DIRIS à grande échelle.
