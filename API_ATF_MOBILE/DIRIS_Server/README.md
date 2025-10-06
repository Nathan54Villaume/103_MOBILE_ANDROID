# DIRIS Server - Serveur d'Acquisition de Données

## 📋 Description

DIRIS Server est un serveur HTTP Windows (.NET 8) conçu pour l'acquisition automatique de données depuis les équipements Socomec DIRIS via l'interface WebMI. Il fournit une API REST complète et une interface web intégrée pour la supervision et la visualisation des données.

## 🚀 Fonctionnalités

### Acquisition de Données
- **Lecture automatique** de ~25 compteurs DIRIS via WebMI
- **Parallélisme contrôlé** (6-8 devices simultanés)
- **Requêtes groupées** optimisées avec `address[]`
- **Résilience avancée** : retry, circuit breaker, timeout
- **Bulk SQL** pour des performances optimales

### Interface Web Intégrée
- **Tableau de bord** temps réel avec métriques système
- **Courbes interactives** avec filtres et échantillonnage
- **Supervision complète** : CPU, RAM, GC, débit, latence
- **Auto-refresh** configurable (1-2 secondes)

### API REST
- **Endpoints métriques** : `/api/metrics/system`, `/api/metrics/acquisition`
- **Gestion devices** : CRUD complet via `/api/devices`
- **Requêtes temporelles** : `/api/readings/query` avec downsampling
- **Health checks** : `/health/live`, `/health/ready`

### Observabilité
- **Logging structuré** avec Serilog (fichiers + console)
- **Métriques système** : CPU, mémoire, GC, threads, handles
- **Métriques acquisition** : débit, latence P95/P99, erreurs par device
- **Health checks** : base de données, connectivité WebMI

## 🏗️ Architecture

```
DIRIS_Server/
├── src/
│   ├── Diris.Server/          # Serveur principal (API + UI)
│   ├── Diris.Core/            # Modèles et interfaces
│   ├── Diris.Providers.WebMI/ # Client WebMI + circuit breaker
│   └── Diris.Storage.SqlServer/ # Bulk writer + repositories
├── scripts/                   # Scripts PowerShell
├── docs/                      # Documentation
├── appsettings.json          # Configuration
└── devices.json              # Configuration devices
```

## ⚙️ Installation

### Prérequis
- **Windows Server 2019+** ou **Windows 10/11**
- **.NET 8 Runtime** ou **SDK**
- **SQL Server** avec base AI_ATR
- **Accès réseau** aux devices DIRIS (port 80)

### 1. Compilation
```bash
cd DIRIS_Server
dotnet publish src/Diris.Server -c Release -o dist
```

### 2. Configuration Base de Données
```sql
-- Exécuter le script d'initialisation
sqlcmd -S SQLAIATF\SQL_AI_ATF -d AI_ATR -i scripts/seed-devices.sql
```

### 3. Configuration
Éditer `appsettings.json` :
```json
{
  "ConnectionStrings": {
    "SqlAiAtr": "Server=SQLAIATF\\SQL_AI_ATF;Database=AI_ATR;User Id=mes;Password=samsam;Encrypt=False;TrustServerCertificate=True;"
  },
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://localhost:5001"
      }
    }
  },
  "Acquisition": {
    "Parallelism": 6,
    "DefaultPollIntervalMs": 1500
  },
  "DataRetention": {
    "Enabled": true,
    "RetentionDays": 10,
    "CleanupHour": 2
  }
}
```

### 4. Installation Service Windows
```powershell
# En tant qu'administrateur
.\scripts\install-service.ps1
```

## 🔧 Configuration

### Devices
Éditer `devices.json` pour ajouter/modifier les devices :
```json
{
  "devices": [
    {
      "name": "DIRIS-001",
      "ipAddress": "192.168.2.133",
      "enabled": true,
      "pollIntervalMs": 1500
    }
  ]
}
```

### Tag Mappings
Les mappings WebMI → Signal sont stockés en base de données :
```sql
INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
VALUES (1, 'I_PH1_255', 'I_PH1_255', 'A', 1000, 1);
```

### Paramètres d'Acquisition
```json
{
  "Acquisition": {
    "Parallelism": 6,           // Nombre de devices en parallèle
    "DefaultPollIntervalMs": 1500, // Intervalle de poll (ms)
    "MaxBatchPoints": 1000,     // Taille max des lots SQL
    "JitterPct": 0.1           // Jitter pour éviter les pics
  }
}
```

## 📊 Utilisation

### Interface Web
- **Accueil** : http://localhost:5001
- **Tableau de bord** : http://localhost:5001/dashboard.html
- **Courbes** : http://localhost:5001/charts.html

### API REST

#### Métriques Système
```bash
GET /api/metrics/system
{
  "process": {
    "cpuPercent": 15.2,
    "memoryMB": 128.5,
    "threads": 12
  },
  "system": {
    "cpuPercent": 25.8,
    "memoryTotalMB": 16384
  }
}
```

#### Requête de Données
```bash
GET /api/readings/query?deviceId=1&signal=I_PH1_255&from=2025-01-01T00:00:00Z&to=2025-01-01T23:59:59Z&downsample=1m
```

#### Gestion Devices
```bash
# Lister tous les devices
GET /api/devices

# Créer un device
POST /api/devices
{
  "name": "DIRIS-004",
  "ipAddress": "192.168.2.136",
  "enabled": true
}

# Déclencher un poll manuel
POST /api/devices/1/poll
```

#### Administration (Nettoyage des données)
```bash
# Statistiques de rétention
GET /api/admin/cleanup/stats

# Nettoyage manuel
POST /api/admin/cleanup/run

# Configuration de rétention
GET /api/admin/cleanup/config
```

### Health Checks
```bash
# Liveness (service actif)
GET /health/live

# Readiness (prêt à traiter)
GET /health/ready

# Santé complète
GET /health
```

## 🔍 Monitoring

### Logs
- **Fichiers** : `logs/diris-YYYY-MM-DD.log`
- **Console** : Sortie standard
- **Rotation** : Quotidienne, 30 jours de rétention

### Métriques Clés
- **Débit** : Points/s, Devices/s
- **Latence** : P50, P95, P99
- **Erreurs** : Taux par device, circuit breaker
- **Système** : CPU, RAM, GC, threads

### Alertes Recommandées
- Circuit breaker ouvert > 5 minutes
- Latence P95 > 1 seconde
- Taux d'erreur > 10%
- CPU > 80% pendant 5 minutes

## 🛠️ Maintenance

### Redémarrage Service
```powershell
Restart-Service -Name "DIRIS-Server"
```

### Désinstallation
```powershell
.\scripts\uninstall-service.ps1
```

### Sauvegarde
- **Configuration** : `appsettings.json`, `devices.json`
- **Base de données** : Tables `DIRIS.*`
- **Logs** : Dossier `logs/`

## 🚨 Dépannage

### Service ne démarre pas
1. Vérifier les logs : `logs/diris-*.log`
2. Tester la connexion SQL
3. Vérifier les permissions service

### Pas de données
1. Vérifier la connectivité WebMI : `ping 192.168.2.133`
2. Tester l'endpoint : `curl http://192.168.2.133/webMI/?read`
3. Vérifier les mappings de tags en base

### Performance dégradée
1. Ajuster le parallélisme dans `appsettings.json`
2. Vérifier la taille des buffers SQL
3. Analyser les métriques via l'interface web

## 📈 Performance

### Capacité
- **25 devices** : Cycle < 2s, latence P95 < 500ms
- **50 devices** : Cycle < 3s, latence P95 < 800ms  
- **100 devices** : Cycle < 5s, latence P95 < 1.5s

### Optimisations
- **Bulk SQL** : Lots de 250-1000 points
- **Index optimisés** : Requêtes courbes < 300ms
- **Circuit breakers** : Isolation des devices défaillants
- **Parallélisme** : 6-12 readers simultanés

## 🔐 Sécurité

### API
- **Accès public** : Tous les endpoints sont accessibles sans authentification
- **CORS** : Configuration minimale
- **HTTPS** : Recommandé en production

### Base de Données
- **Connexion chiffrée** : `Encrypt=True` en production
- **Authentification** : Utilisateur dédié avec permissions minimales
- **Audit** : Logs des opérations sensibles

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs dans `logs/`
2. Vérifier l'état via `/health`
3. Analyser les métriques via l'interface web
4. Contacter l'équipe IT avec les détails d'erreur

---

**Version** : 1.0.1  
**Auteur** : Équipe IT  
**Date** : 2025-01-30  
**Dernière mise à jour** : 2025-09-30 (Suppression authentification API Key)

## 📝 Changelog

### v1.0.1 (2025-09-30)
- ✅ **Suppression de l'authentification API Key** - Tous les endpoints sont maintenant publics
- ✅ **Mise à jour du port par défaut** - 5000 → 5001
- ✅ **Ajout des endpoints d'administration** - Nettoyage des données
- ✅ **Amélioration de la documentation** - Configuration et utilisation

### v1.0.0 (2025-01-30)
- 🎉 **Version initiale** - Serveur d'acquisition DIRIS complet
