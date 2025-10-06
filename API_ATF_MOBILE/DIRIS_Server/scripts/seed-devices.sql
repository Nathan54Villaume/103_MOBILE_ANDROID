-- Script de création des tables et données initiales pour DIRIS Server
-- ====================================================================

USE AI_ATR;
GO

-- Créer le schéma DIRIS s'il n'existe pas
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'DIRIS')
BEGIN
    EXEC('CREATE SCHEMA DIRIS');
    PRINT 'Schéma DIRIS créé';
END
GO

-- Table Devices
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[DIRIS].[Devices]') AND type in (N'U'))
BEGIN
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
    PRINT 'Table DIRIS.Devices créée';
END
GO

-- Table Measurements
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[DIRIS].[Measurements]') AND type in (N'U'))
BEGIN
    CREATE TABLE DIRIS.Measurements (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        DeviceId INT NOT NULL,
        UtcTs DATETIME2(3) NOT NULL,
        Signal NVARCHAR(64) NOT NULL,
        Value FLOAT NOT NULL,
        Quality TINYINT NOT NULL DEFAULT 1, -- 1=OK, 2=Warning, 3=Error
        IngestTs DATETIME2(3) NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT FK_Measurements_DeviceId 
            FOREIGN KEY (DeviceId) REFERENCES DIRIS.Devices(DeviceId)
    );
    PRINT 'Table DIRIS.Measurements créée';
END
GO

-- Table TagMap
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[DIRIS].[TagMap]') AND type in (N'U'))
BEGIN
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
    PRINT 'Table DIRIS.TagMap créée';
END
GO

-- Index pour les requêtes de courbes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Measurements_DeviceSignal_UtcTs')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Measurements_DeviceSignal_UtcTs 
    ON DIRIS.Measurements (DeviceId, Signal, UtcTs) 
    INCLUDE (Value, Quality)
    WITH (FILLFACTOR = 90);
    PRINT 'Index IX_Measurements_DeviceSignal_UtcTs créé';
END
GO

-- Index pour les requêtes temporelles
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Measurements_UtcTs_DeviceId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Measurements_UtcTs_DeviceId 
    ON DIRIS.Measurements (UtcTs, DeviceId) 
    INCLUDE (Signal, Value, Quality)
    WITH (FILLFACTOR = 90);
    PRINT 'Index IX_Measurements_UtcTs_DeviceId créé';
END
GO

-- Vue pour les dernières valeurs
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_LastValueBySignal')
BEGIN
    EXEC('
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
    WHERE d.Enabled = 1
    ');
    PRINT 'Vue DIRIS.vw_LastValueBySignal créée';
END
GO

-- Insérer des devices de test
IF NOT EXISTS (SELECT * FROM DIRIS.Devices WHERE Name = 'DIRIS-001')
BEGIN
    INSERT INTO DIRIS.Devices (Name, IpAddress, Protocol, Enabled, PollIntervalMs, MetaJson)
    VALUES 
        ('DIRIS-001', '192.168.2.133', 'webmi', 1, 1500, '{"location": "Salle électrique 1", "description": "Compteur principal"}'),
        ('DIRIS-002', '192.168.2.134', 'webmi', 1, 1500, '{"location": "Salle électrique 2", "description": "Compteur secondaire"}'),
        ('DIRIS-003', '192.168.2.135', 'webmi', 0, 2000, '{"location": "Salle électrique 3", "description": "Compteur de réserve"}');
    PRINT 'Devices de test insérés';
END
GO

-- Insérer les mappings de tags par défaut
DECLARE @DeviceId INT = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'DIRIS-001');

IF @DeviceId IS NOT NULL AND NOT EXISTS (SELECT * FROM DIRIS.TagMap WHERE DeviceId = @DeviceId)
BEGIN
    INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
    VALUES 
        (@DeviceId, 'I_PH1_255', 'I_PH1_255', 'A', 1000, 1),
        (@DeviceId, 'I_PH2_255', 'I_PH2_255', 'A', 1000, 1),
        (@DeviceId, 'I_PH3_255', 'I_PH3_255', 'A', 1000, 1),
        (@DeviceId, 'I_NUL_255', 'I_NUL_255', 'A', 1000, 1),
        (@DeviceId, 'F_255', 'F_255', 'Hz', 100, 1),
        (@DeviceId, 'PV1_255', 'PV1_255', 'V', 100, 1),
        (@DeviceId, 'PV2_255', 'PV2_255', 'V', 100, 1),
        (@DeviceId, 'PV3_255', 'PV3_255', 'V', 100, 1),
        (@DeviceId, 'SUM_RP_255', 'SUM_RP_255', 'kW', 100, 1),
        (@DeviceId, 'SUM_IP_255', 'SUM_IP_255', 'kVAR', 100, 1),
        (@DeviceId, 'SUM_AP_255', 'SUM_AP_255', 'kVA', 100, 1),
        (@DeviceId, 'SUM_PF_255', 'SUM_PF_255', '%', 100, 1);
    PRINT 'Mappings de tags insérés pour DIRIS-001';
END
GO

-- Copier les mappings pour les autres devices
DECLARE @Device2Id INT = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'DIRIS-002');
DECLARE @Device3Id INT = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'DIRIS-003');

IF @Device2Id IS NOT NULL AND NOT EXISTS (SELECT * FROM DIRIS.TagMap WHERE DeviceId = @Device2Id)
BEGIN
    INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
    SELECT @Device2Id, Signal, WebMiKey, Unit, Scale, Enabled
    FROM DIRIS.TagMap 
    WHERE DeviceId = @DeviceId;
    PRINT 'Mappings de tags copiés pour DIRIS-002';
END
GO

IF @Device3Id IS NOT NULL AND NOT EXISTS (SELECT * FROM DIRIS.TagMap WHERE DeviceId = @Device3Id)
BEGIN
    INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
    SELECT @Device3Id, Signal, WebMiKey, Unit, Scale, Enabled
    FROM DIRIS.TagMap 
    WHERE DeviceId = @DeviceId;
    PRINT 'Mappings de tags copiés pour DIRIS-003';
END
GO

PRINT '';
PRINT 'Script d''initialisation terminé avec succès!';
PRINT 'Base de données prête pour DIRIS Server.';
PRINT '';
PRINT 'Tables créées:';
PRINT '- DIRIS.Devices (gestion des devices)';
PRINT '- DIRIS.Measurements (stockage des mesures)';
PRINT '- DIRIS.TagMap (mapping WebMI -> Signal)';
PRINT '- DIRIS.vw_LastValueBySignal (vue des dernières valeurs)';
PRINT '';
PRINT 'Devices de test créés:';
PRINT '- DIRIS-001 (192.168.2.133) - Actif';
PRINT '- DIRIS-002 (192.168.2.134) - Actif';
PRINT '- DIRIS-003 (192.168.2.135) - Inactif';
