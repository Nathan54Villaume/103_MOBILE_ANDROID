# Guide d'Exploitation - DIRIS Server

## Vue d'Ensemble

Ce guide couvre les opérations quotidiennes, la maintenance, le monitoring et le dépannage du serveur DIRIS Server en production.

## Monitoring Quotidien

### 1. Vérifications de Base

#### Interface Web
- **Accueil** : http://localhost:5000
- **Tableau de bord** : http://localhost:5000/dashboard.html
- **Health check** : http://localhost:5000/health

#### Métriques Clés à Surveiller
- **CPU Process** : < 50% en moyenne
- **Mémoire** : < 80% de la RAM disponible
- **Débit** : Points/s stable selon la charge
- **Latence P95** : < 1 seconde
- **Taux d'erreur** : < 5%

### 2. Logs à Consulter

#### Fichiers de Log
```bash
# Logs du jour
tail -f logs/diris-$(date +%Y-%m-%d).log

# Logs des erreurs
grep "ERROR" logs/diris-*.log

# Logs d'acquisition
grep "Acquisition" logs/diris-*.log
```

#### Niveaux de Log
- **ERROR** : Erreurs critiques nécessitant intervention
- **WARNING** : Problèmes non bloquants mais à surveiller
- **INFO** : Informations générales sur le fonctionnement
- **DEBUG** : Détails techniques (développement uniquement)

### 3. Vérifications Réseau

#### Connectivité Devices
```bash
# Test ping
ping 192.168.2.133

# Test WebMI
curl -X POST "http://192.168.2.133/webMI/?read" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "address[]=F_255"
```

#### Ports et Services
```bash
# Vérifier le port du service
netstat -an | findstr :5000

# Vérifier le service Windows
Get-Service -Name "DIRIS-Server"
```

## Maintenance Préventive

### 1. Nettoyage des Logs

#### Rotation Automatique
Les logs sont automatiquement rotés quotidiennement et conservés 30 jours.

#### Nettoyage Manuel
```powershell
# Supprimer les logs de plus de 30 jours
Get-ChildItem logs\ -Name "diris-*.log" | 
Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } |
Remove-Item -Force
```

### 2. Maintenance Base de Données

#### Vérification de l'Espace
```sql
-- Vérifier la taille des tables
SELECT 
    t.name AS TableName,
    s.name AS SchemaName,
    p.rows AS RowCounts,
    CAST(ROUND(((SUM(a.total_pages) * 8) / 1024.00), 2) AS NUMERIC(36, 2)) AS TotalSpaceMB
FROM sys.tables t
INNER JOIN sys.indexes i ON t.object_id = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
LEFT OUTER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'DIRIS'
GROUP BY t.name, s.name, p.rows
ORDER BY TotalSpaceMB DESC;
```

#### Nettoyage des Anciennes Données
```sql
-- Supprimer les mesures de plus de 90 jours
DELETE FROM DIRIS.Measurements 
WHERE UtcTs < DATEADD(day, -90, GETUTCDATE());

-- Réindexer après suppression
ALTER INDEX IX_Measurements_DeviceSignal_UtcTs ON DIRIS.Measurements REBUILD;
```

### 3. Mise à Jour de Configuration

#### Redémarrage du Service
```powershell
# Redémarrage propre
Restart-Service -Name "DIRIS-Server"

# Vérification du statut
Get-Service -Name "DIRIS-Server"
```

#### Modification de Configuration
1. Arrêter le service
2. Modifier `appsettings.json`
3. Redémarrer le service
4. Vérifier les logs

## Dépannage

### 1. Service ne Démarre Pas

#### Vérifications
```powershell
# Vérifier les logs d'événements
Get-EventLog -LogName Application -Source "DIRIS-Server" -Newest 10

# Vérifier les permissions
icacls "C:\DIRIS_Server" /T

# Tester la configuration
dotnet Diris.Server.dll --check-config
```

#### Solutions Courantes
- **Port occupé** : Changer le port dans `appsettings.json`
- **Permissions** : Exécuter en tant qu'administrateur
- **Dépendances** : Vérifier .NET 8 Runtime
- **Configuration** : Valider `appsettings.json`

### 2. Pas de Données Acquises

#### Diagnostic
```bash
# Vérifier la connectivité WebMI
curl -v "http://192.168.2.133/webMI/?read" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "address[]=F_255"

# Vérifier les devices en base
sqlcmd -S SQLAIATF\SQL_AI_ATF -d AI_ATR -Q "SELECT * FROM DIRIS.Devices WHERE Enabled = 1"
```

#### Solutions
- **Réseau** : Vérifier la connectivité IP
- **WebMI** : Tester l'endpoint manuellement
- **Mapping** : Vérifier les TagMap en base
- **Circuit Breaker** : Reset via API

### 3. Performance Dégradée

#### Diagnostic
```bash
# Métriques système
curl "http://localhost:5000/api/metrics/system"

# Métriques acquisition
curl "http://localhost:5000/api/metrics/acquisition"

# État des devices
curl "http://localhost:5000/api/devices/enabled"
```

#### Solutions
- **Parallélisme** : Réduire dans `appsettings.json`
- **Buffer** : Ajuster `MaxBufferSize`
- **Poll Interval** : Augmenter `DefaultPollIntervalMs`
- **Ressources** : Augmenter CPU/RAM

### 4. Erreurs de Base de Données

#### Diagnostic
```sql
-- Vérifier la connectivité
SELECT @@VERSION;

-- Vérifier les tables
SELECT COUNT(*) FROM DIRIS.Devices;
SELECT COUNT(*) FROM DIRIS.Measurements;

-- Vérifier les index
SELECT name, type_desc FROM sys.indexes 
WHERE object_id = OBJECT_ID('DIRIS.Measurements');
```

#### Solutions
- **Connexion** : Vérifier la chaîne de connexion
- **Permissions** : Vérifier les droits utilisateur
- **Espace** : Libérer de l'espace disque
- **Index** : Reconstruire les index

## Alertes et Seuils

### 1. Seuils Recommandés

#### Métriques Système
- **CPU > 80%** : Alerte warning
- **CPU > 95%** : Alerte critique
- **RAM > 90%** : Alerte warning
- **RAM > 95%** : Alerte critique

#### Métriques Acquisition
- **Latence P95 > 1s** : Alerte warning
- **Latence P95 > 2s** : Alerte critique
- **Taux d'erreur > 10%** : Alerte warning
- **Taux d'erreur > 25%** : Alerte critique

#### Circuit Breaker
- **État Open > 5min** : Alerte warning
- **État Open > 15min** : Alerte critique

### 2. Configuration d'Alertes

#### PowerShell Script
```powershell
# Script de monitoring
$metrics = Invoke-RestMethod "http://localhost:5000/api/metrics/system"
$acquisition = Invoke-RestMethod "http://localhost:5000/api/metrics/acquisition"

if ($metrics.process.cpuPercent -gt 80) {
    Write-Warning "CPU élevé: $($metrics.process.cpuPercent)%"
}

if ($acquisition.throughput.p95LatencyMs -gt 1000) {
    Write-Warning "Latence élevée: $($acquisition.throughput.p95LatencyMs)ms"
}
```

## Sauvegarde et Restauration

### 1. Sauvegarde

#### Configuration
```powershell
# Sauvegarder la configuration
Copy-Item "appsettings.json" "backup\appsettings-$(Get-Date -Format 'yyyyMMdd').json"
Copy-Item "devices.json" "backup\devices-$(Get-Date -Format 'yyyyMMdd').json"
```

#### Base de Données
```sql
-- Sauvegarde complète
BACKUP DATABASE AI_ATR TO DISK = 'C:\Backup\AI_ATR_Full.bak'

-- Sauvegarde différentielle
BACKUP DATABASE AI_ATR TO DISK = 'C:\Backup\AI_ATR_Diff.bak' WITH DIFFERENTIAL
```

### 2. Restauration

#### Configuration
```powershell
# Restaurer la configuration
Copy-Item "backup\appsettings-20250130.json" "appsettings.json"
Restart-Service -Name "DIRIS-Server"
```

#### Base de Données
```sql
-- Restauration complète
RESTORE DATABASE AI_ATR FROM DISK = 'C:\Backup\AI_ATR_Full.bak' WITH REPLACE
```

## Mise à Niveau

### 1. Préparation

#### Sauvegarde
```powershell
# Arrêter le service
Stop-Service -Name "DIRIS-Server"

# Sauvegarder la configuration
Copy-Item "appsettings.json" "backup\"
Copy-Item "devices.json" "backup\"

# Sauvegarder la base
sqlcmd -S SQLAIATF\SQL_AI_ATF -Q "BACKUP DATABASE AI_ATR TO DISK = 'C:\Backup\AI_ATR_PreUpgrade.bak'"
```

### 2. Installation

#### Nouvelle Version
```powershell
# Compiler la nouvelle version
dotnet publish src/Diris.Server -c Release -o dist-new

# Remplacer les fichiers
Stop-Service -Name "DIRIS-Server"
Copy-Item "dist-new\*" "dist\" -Recurse -Force

# Restaurer la configuration
Copy-Item "backup\appsettings.json" "dist\"
Copy-Item "backup\devices.json" "dist\"

# Redémarrer
Start-Service -Name "DIRIS-Server"
```

### 3. Validation

#### Tests Post-Upgrade
```bash
# Vérifier le health check
curl "http://localhost:5000/health"

# Vérifier les métriques
curl "http://localhost:5000/api/metrics/system"

# Vérifier l'acquisition
curl "http://localhost:5000/api/metrics/acquisition"
```

## Contacts et Escalade

### 1. Niveaux de Support

#### Niveau 1 - Opérations
- **Responsabilité** : Monitoring, redémarrage, logs
- **Actions** : Redémarrage service, vérification logs
- **Escalade** : Si problème non résolu en 30min

#### Niveau 2 - Technique
- **Responsabilité** : Configuration, base de données, réseau
- **Actions** : Modification config, diagnostic avancé
- **Escalade** : Si problème non résolu en 2h

#### Niveau 3 - Développement
- **Responsabilité** : Code, architecture, bugs
- **Actions** : Correction code, optimisation
- **Escalade** : Si problème non résolu en 1 jour

### 2. Procédures d'Escalade

#### Critères d'Escalade
- **Service down** > 15 minutes
- **Perte de données** > 1 heure
- **Performance** < 50% de la normale
- **Erreurs** > 25% des requêtes

#### Informations à Fournir
- **Timestamp** de l'incident
- **Logs** pertinents
- **Métriques** au moment de l'incident
- **Actions** déjà tentées
- **Impact** sur les utilisateurs

---

**Dernière mise à jour** : 2025-01-30  
**Version** : 1.0.0  
**Responsable** : Équipe IT
