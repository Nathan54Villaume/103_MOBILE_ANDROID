-- Script pour ajouter les nouveaux devices DIRIS testés
-- ========================================================

USE AI_ATR;
GO

-- Ajouter DIRIS-004 (192.168.2.195) - Faible charge
IF NOT EXISTS (SELECT * FROM DIRIS.Devices WHERE IpAddress = '192.168.2.195')
BEGIN
    INSERT INTO DIRIS.Devices (Name, IpAddress, Protocol, Enabled, PollIntervalMs, MetaJson)
    VALUES ('DIRIS-004', '192.168.2.195', 'webmi', 1, 1500, '{"location": "Nouveau compteur 1", "description": "DIRIS A40 - Faible charge"}');
    PRINT 'DIRIS-004 (192.168.2.195) ajouté';
END
ELSE
BEGIN
    PRINT 'DIRIS-004 (192.168.2.195) existe déjà';
END
GO

-- Ajouter DIRIS-005 (192.168.2.132) - Forte charge
IF NOT EXISTS (SELECT * FROM DIRIS.Devices WHERE IpAddress = '192.168.2.132')
BEGIN
    INSERT INTO DIRIS.Devices (Name, IpAddress, Protocol, Enabled, PollIntervalMs, MetaJson)
    VALUES ('DIRIS-005', '192.168.2.132', 'webmi', 1, 1500, '{"location": "Nouveau compteur 2", "description": "DIRIS A40 - Forte charge"}');
    PRINT 'DIRIS-005 (192.168.2.132) ajouté';
END
ELSE
BEGIN
    PRINT 'DIRIS-005 (192.168.2.132) existe déjà';
END
GO

-- Ajouter les mappings de tags pour DIRIS-004
DECLARE @Device4Id INT = (SELECT DeviceId FROM DIRIS.Devices WHERE IpAddress = '192.168.2.195');

IF @Device4Id IS NOT NULL AND NOT EXISTS (SELECT * FROM DIRIS.TagMap WHERE DeviceId = @Device4Id)
BEGIN
    INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
    VALUES 
        (@Device4Id, 'I_PH1_255', 'I_PH1_255', 'A', 1000, 1),
        (@Device4Id, 'I_PH2_255', 'I_PH2_255', 'A', 1000, 1),
        (@Device4Id, 'I_PH3_255', 'I_PH3_255', 'A', 1000, 1),
        (@Device4Id, 'I_NUL_255', 'I_NUL_255', 'A', 1000, 1),
        (@Device4Id, 'F_255', 'F_255', 'Hz', 100, 1),
        (@Device4Id, 'PV1_255', 'PV1_255', 'V', 100, 1),
        (@Device4Id, 'PV2_255', 'PV2_255', 'V', 100, 1),
        (@Device4Id, 'PV3_255', 'PV3_255', 'V', 100, 1),
        (@Device4Id, 'SUM_RP_255', 'SUM_RP_255', 'kW', 100, 1),
        (@Device4Id, 'SUM_IP_255', 'SUM_IP_255', 'kVAR', 100, 1),
        (@Device4Id, 'SUM_AP_255', 'SUM_AP_255', 'kVA', 100, 1),
        (@Device4Id, 'SUM_PF_255', 'SUM_PF_255', '%', 100, 1);
    PRINT 'Mappings de tags ajoutés pour DIRIS-004';
END
ELSE
BEGIN
    PRINT 'Mappings de tags pour DIRIS-004 existent déjà';
END
GO

-- Ajouter les mappings de tags pour DIRIS-005
DECLARE @Device5Id INT = (SELECT DeviceId FROM DIRIS.Devices WHERE IpAddress = '192.168.2.132');

IF @Device5Id IS NOT NULL AND NOT EXISTS (SELECT * FROM DIRIS.TagMap WHERE DeviceId = @Device5Id)
BEGIN
    INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
    VALUES 
        (@Device5Id, 'I_PH1_255', 'I_PH1_255', 'A', 1000, 1),
        (@Device5Id, 'I_PH2_255', 'I_PH2_255', 'A', 1000, 1),
        (@Device5Id, 'I_PH3_255', 'I_PH3_255', 'A', 1000, 1),
        (@Device5Id, 'I_NUL_255', 'I_NUL_255', 'A', 1000, 1),
        (@Device5Id, 'F_255', 'F_255', 'Hz', 100, 1),
        (@Device5Id, 'PV1_255', 'PV1_255', 'V', 100, 1),
        (@Device5Id, 'PV2_255', 'PV2_255', 'V', 100, 1),
        (@Device5Id, 'PV3_255', 'PV3_255', 'V', 100, 1),
        (@Device5Id, 'SUM_RP_255', 'SUM_RP_255', 'kW', 100, 1),
        (@Device5Id, 'SUM_IP_255', 'SUM_IP_255', 'kVAR', 100, 1),
        (@Device5Id, 'SUM_AP_255', 'SUM_AP_255', 'kVA', 100, 1),
        (@Device5Id, 'SUM_PF_255', 'SUM_PF_255', '%', 100, 1);
    PRINT 'Mappings de tags ajoutés pour DIRIS-005';
END
ELSE
BEGIN
    PRINT 'Mappings de tags pour DIRIS-005 existent déjà';
END
GO

-- Vérifier les devices ajoutés
PRINT '';
PRINT '=== RÉSUMÉ DES DEVICES DIRIS ===';
SELECT 
    DeviceId,
    Name,
    IpAddress,
    CASE WHEN Enabled = 1 THEN 'Actif' ELSE 'Inactif' END AS Statut,
    PollIntervalMs,
    JSON_VALUE(MetaJson, '$.description') AS Description
FROM DIRIS.Devices 
WHERE IpAddress IN ('192.168.2.195', '192.168.2.132')
ORDER BY DeviceId;

PRINT '';
PRINT '=== MAPPINGS DE TAGS ===';
SELECT 
    d.Name,
    d.IpAddress,
    COUNT(tm.Signal) AS NombreSignaux
FROM DIRIS.Devices d
LEFT JOIN DIRIS.TagMap tm ON d.DeviceId = tm.DeviceId AND tm.Enabled = 1
WHERE d.IpAddress IN ('192.168.2.195', '192.168.2.132')
GROUP BY d.DeviceId, d.Name, d.IpAddress
ORDER BY d.DeviceId;

PRINT '';
PRINT 'Script terminé avec succès!';
PRINT 'Les nouveaux devices DIRIS sont prêts à être utilisés.';
