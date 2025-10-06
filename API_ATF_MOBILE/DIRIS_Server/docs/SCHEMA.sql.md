# Schéma Base de Données - DIRIS Server

## Vue d'Ensemble

Le schéma de base de données DIRIS est conçu pour stocker efficacement les données d'acquisition des équipements Socomec DIRIS. Il utilise le schéma `DIRIS` dans la base `AI_ATR` et est optimisé pour les requêtes temporelles et les opérations de bulk insert.

## Schéma DIRIS

### Tables Principales

#### 1. DIRIS.Devices
Table de configuration des devices DIRIS.

```sql
CREATE TABLE DIRIS.Devices (
    DeviceId INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    IpAddress NVARCHAR(15) NOT NULL,
    Protocol NVARCHAR(20) NOT NULL DEFAULT 'webmi',
    Enabled BIT NOT NULL DEFAULT 1,
    PollIntervalMs INT NOT NULL DEFAULT 1500,
    LastSeenUtc DATETIME2(3) NULL,
    MetaJson NVARCHAR(MAX) NULL,
    CreatedUtc DATETIME2(3) NOT NULL DEFAULT GETUTCDATE(),
    UpdatedUtc DATETIME2(3) NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT UQ_Devices_IpAddress UNIQUE (IpAddress)
);
```

**Colonnes :**
- `DeviceId` : Identifiant unique auto-incrémenté
- `Name` : Nom du device (ex: "DIRIS-001")
- `IpAddress` : Adresse IP du device (unique)
- `Protocol` : Protocole utilisé (défaut: "webmi")
- `Enabled` : Device actif/inactif
- `PollIntervalMs` : Intervalle de poll en millisecondes
- `LastSeenUtc` : Dernière lecture réussie
- `MetaJson` : Métadonnées JSON (location, description, etc.)
- `CreatedUtc` : Date de création
- `UpdatedUtc` : Dernière modification

#### 2. DIRIS.Measurements
Table principale de stockage des mesures.

```sql
CREATE TABLE DIRIS.Measurements (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    DeviceId INT NOT NULL,
    UtcTs DATETIME2(3) NOT NULL,
    Signal NVARCHAR(64) NOT NULL,
    Value FLOAT NOT NULL,
    Quality TINYINT NOT NULL DEFAULT 1,
    IngestTs DATETIME2(3) NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_Measurements_DeviceId 
        FOREIGN KEY (DeviceId) REFERENCES DIRIS.Devices(DeviceId)
);
```

**Colonnes :**
- `Id` : Identifiant unique auto-incrémenté (BIGINT pour gros volumes)
- `DeviceId` : Référence vers DIRIS.Devices
- `UtcTs` : Timestamp UTC de la mesure (précision millisecondes)
- `Signal` : Nom du signal (ex: "I_PH1_255")
- `Value` : Valeur de la mesure (FLOAT pour précision)
- `Quality` : Qualité de la mesure (1=OK, 2=Warning, 3=Error)
- `IngestTs` : Timestamp d'insertion en base

#### 3. DIRIS.TagMap
Table de mapping WebMI → Signal.

```sql
CREATE TABLE DIRIS.TagMap (
    DeviceId INT NOT NULL,
    Signal NVARCHAR(64) NOT NULL,
    WebMiKey NVARCHAR(100) NOT NULL,
    Unit NVARCHAR(20) NULL,
    Scale FLOAT NOT NULL DEFAULT 1.0,
    Enabled BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT PK_TagMap PRIMARY KEY (DeviceId, Signal),
    CONSTRAINT UQ_TagMap_WebMiKey UNIQUE (DeviceId, WebMiKey),
    CONSTRAINT FK_TagMap_DeviceId 
        FOREIGN KEY (DeviceId) REFERENCES DIRIS.Devices(DeviceId)
);
```

**Colonnes :**
- `DeviceId` : Référence vers DIRIS.Devices
- `Signal` : Nom du signal interne
- `WebMiKey` : Clé WebMI (ex: "I_PH1_255")
- `Unit` : Unité de mesure (ex: "A", "V", "kW")
- `Scale` : Facteur d'échelle (ex: 1000 pour conversion mA→A)
- `Enabled` : Mapping actif/inactif

### Index de Performance

#### Index Principal (Requêtes de Courbes)
```sql
CREATE NONCLUSTERED INDEX IX_Measurements_DeviceSignal_UtcTs 
ON DIRIS.Measurements (DeviceId, Signal, UtcTs) 
INCLUDE (Value, Quality)
WITH (FILLFACTOR = 90);
```

**Utilisation :** Requêtes par device + signal + période
**Performance :** < 300ms pour 1 jour de données

#### Index Temporel (Requêtes par Période)
```sql
CREATE NONCLUSTERED INDEX IX_Measurements_UtcTs_DeviceId 
ON DIRIS.Measurements (UtcTs, DeviceId) 
INCLUDE (Signal, Value, Quality)
WITH (FILLFACTOR = 90);
```

**Utilisation :** Requêtes par période + device
**Performance :** Optimise les requêtes temporelles

### Vues Utiles

#### 1. DIRIS.vw_LastValueBySignal
Vue des dernières valeurs par signal.

```sql
CREATE VIEW DIRIS.vw_LastValueBySignal AS
SELECT 
    d.DeviceId,
    d.Name AS DeviceName,
    d.IpAddress,
    m.Signal,
    m.Value,
    tm.Unit,
    m.Quality,
    m.UtcTs AS LastReadingUtc,
    m.IngestTs
FROM DIRIS.Devices d
INNER JOIN (
    SELECT 
        DeviceId, Signal, Value, Quality, UtcTs, IngestTs,
        ROW_NUMBER() OVER (PARTITION BY DeviceId, Signal ORDER BY UtcTs DESC) as rn
    FROM DIRIS.Measurements
) m ON d.DeviceId = m.DeviceId AND m.rn = 1
LEFT JOIN DIRIS.TagMap tm ON d.DeviceId = tm.DeviceId AND m.Signal = tm.Signal
WHERE d.Enabled = 1;
```

**Utilisation :** Dashboard temps réel, dernières valeurs

## Données de Test

### Devices de Test
```sql
INSERT INTO DIRIS.Devices (Name, IpAddress, Protocol, Enabled, PollIntervalMs, MetaJson)
VALUES 
    ('DIRIS-001', '192.168.2.133', 'webmi', 1, 1500, 
     '{"location": "Salle électrique 1", "description": "Compteur principal"}'),
    ('DIRIS-002', '192.168.2.134', 'webmi', 1, 1500, 
     '{"location": "Salle électrique 2", "description": "Compteur secondaire"}'),
    ('DIRIS-003', '192.168.2.135', 'webmi', 0, 2000, 
     '{"location": "Salle électrique 3", "description": "Compteur de réserve"}');
```

### Mappings de Tags par Défaut
```sql
-- Pour DIRIS-001 (DeviceId = 1)
INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
VALUES 
    (1, 'I_PH1_255', 'I_PH1_255', 'A', 1000, 1),
    (1, 'I_PH2_255', 'I_PH2_255', 'A', 1000, 1),
    (1, 'I_PH3_255', 'I_PH3_255', 'A', 1000, 1),
    (1, 'I_NUL_255', 'I_NUL_255', 'A', 1000, 1),
    (1, 'F_255', 'F_255', 'Hz', 100, 1),
    (1, 'PV1_255', 'PV1_255', 'V', 100, 1),
    (1, 'PV2_255', 'PV2_255', 'V', 100, 1),
    (1, 'PV3_255', 'PV3_255', 'V', 100, 1),
    (1, 'SUM_RP_255', 'SUM_RP_255', 'kW', 100, 1),
    (1, 'SUM_IP_255', 'SUM_IP_255', 'kVAR', 100, 1),
    (1, 'SUM_AP_255', 'SUM_AP_255', 'kVA', 100, 1),
    (1, 'SUM_PF_255', 'SUM_PF_255', '%', 100, 1);
```

## Requêtes d'Exemple

### 1. Dernières Valeurs par Device
```sql
SELECT 
    d.Name,
    d.IpAddress,
    lv.Signal,
    lv.Value,
    lv.Unit,
    lv.LastReadingUtc
FROM DIRIS.Devices d
LEFT JOIN DIRIS.vw_LastValueBySignal lv ON d.DeviceId = lv.DeviceId
WHERE d.Enabled = 1
ORDER BY d.Name, lv.Signal;
```

### 2. Courbe de Mesures (1 Device, 1 Signal, 1 Jour)
```sql
SELECT 
    UtcTs,
    Value,
    Quality
FROM DIRIS.Measurements
WHERE DeviceId = 1 
  AND Signal = 'I_PH1_255'
  AND UtcTs >= '2025-01-30 00:00:00'
  AND UtcTs < '2025-01-31 00:00:00'
ORDER BY UtcTs;
```

### 3. Statistiques par Device
```sql
SELECT 
    d.Name,
    d.IpAddress,
    COUNT(m.Id) AS TotalMeasurements,
    COUNT(DISTINCT m.Signal) AS UniqueSignals,
    MIN(m.UtcTs) AS FirstMeasurement,
    MAX(m.UtcTs) AS LastMeasurement,
    AVG(m.Value) AS AverageValue,
    SUM(CASE WHEN m.Quality = 1 THEN 1 ELSE 0 END) AS GoodQuality,
    SUM(CASE WHEN m.Quality = 3 THEN 1 ELSE 0 END) AS ErrorQuality
FROM DIRIS.Devices d
LEFT JOIN DIRIS.Measurements m ON d.DeviceId = m.DeviceId
WHERE d.Enabled = 1
GROUP BY d.DeviceId, d.Name, d.IpAddress
ORDER BY d.Name;
```

### 4. Top 10 des Signaux les Plus Actifs
```sql
SELECT TOP 10
    Signal,
    COUNT(*) AS MeasurementCount,
    COUNT(DISTINCT DeviceId) AS DeviceCount,
    AVG(Value) AS AverageValue,
    MIN(UtcTs) AS FirstSeen,
    MAX(UtcTs) AS LastSeen
FROM DIRIS.Measurements
WHERE UtcTs >= DATEADD(day, -7, GETUTCDATE())
GROUP BY Signal
ORDER BY MeasurementCount DESC;
```

### 5. Performance des Requêtes
```sql
-- Vérifier l'utilisation des index
SELECT 
    i.name AS IndexName,
    s.user_seeks,
    s.user_scans,
    s.user_lookups,
    s.user_updates
FROM sys.dm_db_index_usage_stats s
INNER JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
WHERE OBJECT_NAME(s.object_id) = 'Measurements'
ORDER BY s.user_seeks + s.user_scans + s.user_lookups DESC;
```

## Maintenance

### 1. Nettoyage des Anciennes Données
```sql
-- Supprimer les mesures de plus de 90 jours
DELETE FROM DIRIS.Measurements 
WHERE UtcTs < DATEADD(day, -90, GETUTCDATE());

-- Réindexer après suppression
ALTER INDEX IX_Measurements_DeviceSignal_UtcTs ON DIRIS.Measurements REBUILD;
ALTER INDEX IX_Measurements_UtcTs_DeviceId ON DIRIS.Measurements REBUILD;
```

### 2. Statistiques de Taille
```sql
-- Taille des tables
SELECT 
    t.name AS TableName,
    s.name AS SchemaName,
    p.rows AS RowCounts,
    CAST(ROUND(((SUM(a.total_pages) * 8) / 1024.00), 2) AS NUMERIC(36, 2)) AS TotalSpaceMB,
    CAST(ROUND(((SUM(a.used_pages) * 8) / 1024.00), 2) AS NUMERIC(36, 2)) AS UsedSpaceMB
FROM sys.tables t
INNER JOIN sys.indexes i ON t.object_id = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
LEFT OUTER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'DIRIS'
GROUP BY t.name, s.name, p.rows
ORDER BY TotalSpaceMB DESC;
```

### 3. Optimisation des Index
```sql
-- Reconstruire les index fragmentés
ALTER INDEX IX_Measurements_DeviceSignal_UtcTs ON DIRIS.Measurements REBUILD;
ALTER INDEX IX_Measurements_UtcTs_DeviceId ON DIRIS.Measurements REBUILD;

-- Mettre à jour les statistiques
UPDATE STATISTICS DIRIS.Measurements;
```

## Sécurité

### 1. Permissions Utilisateur
```sql
-- Créer un utilisateur dédié
CREATE LOGIN [diris_user] WITH PASSWORD = 'StrongPassword123!';

-- Créer l'utilisateur dans la base
USE AI_ATR;
CREATE USER [diris_user] FOR LOGIN [diris_user];

-- Permissions sur le schéma DIRIS
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::DIRIS TO [diris_user];

-- Permissions sur les tables
GRANT SELECT, INSERT, UPDATE, DELETE ON DIRIS.Devices TO [diris_user];
GRANT SELECT, INSERT, UPDATE, DELETE ON DIRIS.Measurements TO [diris_user];
GRANT SELECT, INSERT, UPDATE, DELETE ON DIRIS.TagMap TO [diris_user];
```

### 2. Audit des Accès
```sql
-- Activer l'audit (si disponible)
CREATE SERVER AUDIT [DIRIS_Audit] TO FILE (FILEPATH = 'C:\Audit\')
WITH (QUEUE_DELAY = 1000, ON_FAILURE = CONTINUE);

CREATE DATABASE AUDIT SPECIFICATION [DIRIS_DB_Audit]
FOR SERVER AUDIT [DIRIS_Audit]
ADD (SELECT, INSERT, UPDATE, DELETE ON DIRIS.Devices BY [diris_user]),
ADD (SELECT, INSERT, UPDATE, DELETE ON DIRIS.Measurements BY [diris_user]),
ADD (SELECT, INSERT, UPDATE, DELETE ON DIRIS.TagMap BY [diris_user]);
```

## Performance et Capacité

### 1. Capacité Estimée
- **25 devices** : ~1M points/jour, 365M points/an
- **50 devices** : ~2M points/jour, 730M points/an
- **100 devices** : ~4M points/jour, 1.46B points/an

### 2. Taille des Données
- **1 point** : ~50 bytes (avec index)
- **1M points** : ~50 MB
- **1B points** : ~50 GB

### 3. Optimisations Recommandées
- **Partitioning** : Par mois pour les gros volumes
- **Compression** : Page compression sur Measurements
- **Archive** : Déplacer les anciennes données
- **Index** : Monitoring et optimisation régulière

---

**Dernière mise à jour** : 2025-01-30  
**Version** : 1.0.0  
**Base de données** : SQL Server 2019+
