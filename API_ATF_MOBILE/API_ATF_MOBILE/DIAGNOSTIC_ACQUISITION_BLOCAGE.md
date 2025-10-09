# 🔍 Diagnostic et Solutions - Blocage de l'Acquisition DIRIS

**Date**: 09/10/2025  
**Problème**: L'acquisition DIRIS s'est arrêtée à 23:27:39 le 08/10/2025 et n'a pas redémarré pendant 7h28min  
**Cause**: Le `DirisAcquisitionService` (BackgroundService) s'est bloqué silencieusement sans logger d'erreur  

---

## 🚨 SYMPTÔMES DU PROBLÈME

1. **API web fonctionnait** (port 8088 répondait)
2. **Acquisition marquée comme "Running"** dans le système
3. **6 devices configurés** et actifs
4. **AUCUNE donnée collectée** depuis 23:27:39
5. **Logs arrêtés** à 13:12 (6h avant l'arrêt des données)
6. **Arrêter/Redémarrer l'acquisition via l'UI ne fonctionnait PAS**

---

## ✅ SOLUTIONS IMPLÉMENTÉES

### 1. **Logging Amélioré** (`DirisAcquisitionService.cs`)

#### Ajouts :
- **Compteur de cycles** : Track du nombre total de cycles complétés
- **Timestamp du dernier succès** : Pour détecter les blocages
- **Erreurs consécutives** : Alerte si 10+ erreurs d'affilée
- **Logs détaillés par cycle** :
  - `[CYCLE n]` : Début/fin de chaque cycle
  - `[CYCLE-DETAIL]` : Détails du traitement des devices
  - `[DEVICE n]` : Logs par device (lecture, écriture)
- **Logs toutes les 100 cycles** : Pour confirmer que l'acquisition tourne
- **Logs au démarrage/arrêt** : Avec résumé des statistiques

#### Exemple de logs :
```
[13:12:45 INF] ========================================
[13:12:45 INF] DIRIS Acquisition service STARTED
[13:12:45 INF] Parallelism: 6, Poll Interval: 1500ms
[13:12:45 INF] ========================================
[13:12:45 DBG] [CYCLE 1] Starting new acquisition cycle
[13:12:45 DBG] [CYCLE 1] Acquisition is ACTIVE, performing cycle...
[13:12:45 TRC] [CYCLE-DETAIL] Fetching enabled devices from registry...
[13:12:45 TRC] [CYCLE-DETAIL] Found 6 enabled devices
[13:12:45 DBG] [DEVICE 1] Reading from ATR_TR1 (192.168.2.132)...
[13:12:45 TRC] [DEVICE 1] Read successful: 8 measurements in 123ms
[13:12:45 TRC] [DEVICE 1] Writing 8 measurements to storage...
[13:12:45 DBG] [CYCLE 1] Cycle completed successfully in 456ms
[13:15:20 INF] DIRIS Acquisition: 100 cycles completed, last success: 2025-10-09T13:15:20Z
```

---

### 2. **Watchdog Service** (`DirisAcquisitionWatchdogService.cs`)

#### Fonctionnalités :
- **Vérification automatique toutes les 2 minutes**
- **Détecte si l'acquisition est bloquée** :
  - Vérifie que `IsRunning = true`
  - Vérifie qu'il y a eu des données dans les 5 dernières minutes
  - Compte les échecs consécutifs
- **Alertes progressives** :
  - ⚠️ **WARNING** : Pas de données depuis > 5 minutes
  - 🚨 **CRITICAL** : 3 échecs consécutifs (> 10 minutes sans données)
- **Recommandation automatique** : "Restart the API to fix the issue"

#### Exemple de logs :
```
[13:14:00 INF] ========================================
[13:14:00 INF] DIRIS Acquisition WATCHDOG started
[13:14:00 INF] Monitoring interval: 2 minutes
[13:14:00 INF] ========================================
[13:19:00 DBG] [WATCHDOG] Starting health check at 2025-10-09T13:19:00Z
[13:19:00 DBG] [WATCHDOG] Last data: 00:00:12 ago (Device 1, Signal AP_255)
[13:19:00 DBG] [WATCHDOG] Health check: OK (last data 12s ago)
[23:32:00 WRN] [WATCHDOG] !!! NO DATA for 5 minutes (consecutive failures: 1) !!!
[23:34:00 CRT] [WATCHDOG] !!! CRITICAL: Acquisition appears BLOCKED. No data for 7 minutes !!!
[23:34:00 CRT] [WATCHDOG] !!! ACTION REQUIRED: Restart the API to fix the issue !!!
```

---

### 3. **Timeouts et Circuit Breakers**

#### Déjà en place :
- **Timeout HTTP** dans `WebMiClient` : 1500ms par requête
- **Semaphore de parallélisation** : Max 6 devices simultanés
- **Try/catch** sur chaque device pour isoler les erreurs

#### Amélioration :
- **Logs détaillés** lors des timeouts
- **Erreurs catchées** ne bloquent plus l'acquisition globale

---

### 4. **API de Logs en Temps Réel** (`DirisLogsController.cs`)

#### Endpoints créés :
- **`GET /api/diris/logs/recent?lines=100`** : Dernières lignes du log
- **`GET /api/diris/logs/acquisition?lines=100`** : Logs DIRIS uniquement (filtré)
- **`GET /api/diris/logs/errors?lines=50`** : Erreurs uniquement ([ERR], [WRN], [CRT])
- **`GET /api/diris/logs/files`** : Liste des fichiers de logs disponibles

#### Utilisation :
```bash
# Récupérer les 50 dernières lignes
curl http://10.250.13.4:8088/api/diris/logs/recent?lines=50

# Récupérer uniquement les logs d'acquisition
curl http://10.250.13.4:8088/api/diris/logs/acquisition?lines=100

# Récupérer uniquement les erreurs
curl http://10.250.13.4:8088/api/diris/logs/errors?lines=20
```

---

### 5. **Health Checks** (`DirisHealthController.cs`)

#### Endpoints créés :
- **`GET /api/diris/health`** : Health check complet (acquisition, database, storage)
- **`GET /api/diris/health/diagnostic`** : Diagnostic détaillé pour le debug

#### Exemple de réponse `GET /api/diris/health` :
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

#### Statuts possibles :
- **`healthy`** : Tout fonctionne normalement
- **`degraded`** : Fonctionne mais avec des problèmes mineurs
- **`unhealthy`** : Problème critique nécessitant une action
- **`stopped`** : Acquisition arrêtée par l'utilisateur

---

## 📊 MONITORING ET DEBUG

### Comment lire les logs pour débugger :

1. **Vérifier que l'acquisition démarre** :
   ```
   [INF] DIRIS Acquisition service STARTED
   ```

2. **Vérifier que les cycles se déroulent** :
   ```
   [DBG] [CYCLE n] Cycle completed successfully in Xms
   ```

3. **Vérifier que les devices répondent** :
   ```
   [DBG] [DEVICE n] Reading from DeviceName (IP)...
   [TRC] [DEVICE n] Read successful: X measurements in Yms
   ```

4. **Détecter les blocages** :
   - Si les logs `[CYCLE n]` s'arrêtent : **blocage dans le cycle**
   - Si les logs `[DEVICE n]` s'arrêtent : **blocage sur un device**
   - Si le Watchdog alerte : **pas de données depuis > 5 minutes**

5. **Détecter les erreurs** :
   ```
   [ERR] !!! ERROR in DIRIS acquisition cycle n !!!
   [CRT] !!! CRITICAL: 10 consecutive errors !!!
   [WRN] [WATCHDOG] !!! NO DATA for X minutes !!!
   ```

---

## 🔧 ACTIONS EN CAS DE BLOCAGE

### 1. **Vérifier le health check**
```bash
curl http://10.250.13.4:8088/api/diris/health
```

### 2. **Consulter les logs d'acquisition**
```bash
curl http://10.250.13.4:8088/api/diris/logs/acquisition?lines=100
```

### 3. **Consulter les erreurs**
```bash
curl http://10.250.13.4:8088/api/diris/logs/errors?lines=50
```

### 4. **Redémarrer l'API** (solution la plus rapide)
- Sur le serveur 10.250.13.4 :
  - Ouvrir le Gestionnaire des tâches
  - Tuer le processus `API_ATF_MOBILE.exe` ou `dotnet.exe`
  - Relancer l'API depuis `C:\API_ATF_MOBILE\DEPLOIEMENT_API\`

### 5. **Vérifier que l'acquisition redémarre**
- Aller sur http://10.250.13.4:8088/admin/
- Onglet **DIRIS** → **Vue d'ensemble**
- Vérifier que "**Dernière mesure**" se met à jour toutes les 1-2 secondes

---

## 🎯 PRÉVENTION

### Bonnes pratiques :
1. **Surveiller le Watchdog** : Si des alertes CRITICAL apparaissent, redémarrer l'API immédiatement
2. **Vérifier les health checks** : Automatiser un check toutes les 5 minutes
3. **Lire les logs régulièrement** : Vérifier qu'il n'y a pas d'erreurs accumulées
4. **Surveiller la base de données** : Le service `DirisDatabaseSizeMonitorService` surveille déjà la taille

### Améliorations futures possibles :
1. **Auto-restart** : Si le Watchdog détecte un blocage, redémarrer automatiquement l'acquisition
2. **Alertes par email** : Envoyer un email si l'acquisition est bloquée depuis > 10 minutes
3. **Dashboard de monitoring** : Afficher en temps réel le statut des cycles et devices
4. **Historique des blocages** : Logger dans une table SQL tous les incidents

---

## 📝 FICHIERS MODIFIÉS

1. **`Services/DirisAcquisitionService.cs`** : Logging amélioré + tracking
2. **`Services/DirisAcquisitionWatchdogService.cs`** : Nouveau service de surveillance
3. **`Controllers/DirisLogsController.cs`** : Nouveau contrôleur pour les logs
4. **`Controllers/DirisHealthController.cs`** : Nouveau contrôleur pour les health checks
5. **`Program.cs`** : Enregistrement du Watchdog service

---

## ✅ RÉSULTAT

- ✅ **Logs détaillés** : On peut maintenant voir exactement où l'acquisition se bloque
- ✅ **Watchdog automatique** : Détecte les blocages en 6 minutes (3 checks de 2 min)
- ✅ **Health checks** : On peut interroger l'état de l'acquisition à tout moment
- ✅ **Logs accessibles via API** : Plus besoin de se connecter au serveur pour lire les logs
- ✅ **Timeouts confirmés** : Les requêtes HTTP ne peuvent pas bloquer indéfiniment

---

## 🔗 LIENS UTILES

- **Interface admin** : http://10.250.13.4:8088/admin/
- **Health check** : http://10.250.13.4:8088/api/diris/health
- **Logs d'acquisition** : http://10.250.13.4:8088/api/diris/logs/acquisition
- **Erreurs** : http://10.250.13.4:8088/api/diris/logs/errors
- **Diagnostic** : http://10.250.13.4:8088/api/diris/health/diagnostic
- **Swagger** : http://10.250.13.4:8088/swagger/

---

**Auteur** : Nathan Villaume (avec assistance IA)  
**Version** : 1.0  
**Dernière mise à jour** : 09/10/2025

