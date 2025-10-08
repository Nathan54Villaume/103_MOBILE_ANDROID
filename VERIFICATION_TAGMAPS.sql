-- Script de vérification des TagMaps DIRIS
-- À exécuter pour diagnostiquer le problème d'enregistrement de tous les signaux

-- 1. Lister tous les devices DIRIS
SELECT DeviceId, Name, IpAddress, Enabled, PollIntervalMs
FROM [AI_ATR].[DIRIS].[Devices]
ORDER BY DeviceId;

-- 2. Compter les TagMaps par device (activés vs désactivés)
SELECT 
    d.DeviceId,
    d.Name,
    COUNT(*) AS TotalSignaux,
    SUM(CASE WHEN tm.Enabled = 1 THEN 1 ELSE 0 END) AS SignauxActives,
    SUM(CASE WHEN tm.Enabled = 0 THEN 1 ELSE 0 END) AS SignauxDesactives
FROM [AI_ATR].[DIRIS].[Devices] d
LEFT JOIN [AI_ATR].[DIRIS].[TagMaps] tm ON d.DeviceId = tm.DeviceId
GROUP BY d.DeviceId, d.Name
ORDER BY d.DeviceId;

-- 3. Voir tous les TagMaps pour le device DIRIS ATR-TR1 (remplacer DeviceId si nécessaire)
SELECT 
    tm.TagMapId,
    tm.DeviceId,
    tm.Signal,
    tm.WebMiKey,
    tm.Unit,
    tm.Scale,
    tm.Enabled,
    tm.Description
FROM [AI_ATR].[DIRIS].[TagMaps] tm
INNER JOIN [AI_ATR].[DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
WHERE d.Name LIKE '%ATR%TR1%' OR d.Name LIKE '%ATR-TR1%'
ORDER BY tm.Signal;

-- 4. Vérifier les mesures enregistrées récemment pour ce device
SELECT TOP 100
    m.DeviceId,
    d.Name AS DeviceName,
    m.Signal,
    m.Value,
    m.Quality,
    m.UtcTs,
    m.IngestTs
FROM [AI_ATR].[DIRIS].[Measurements] m
INNER JOIN [AI_ATF].[DIRIS].[Devices] d ON m.DeviceId = d.DeviceId
WHERE d.Name LIKE '%ATR%TR1%' OR d.Name LIKE '%ATR-TR1%'
ORDER BY m.IngestTs DESC;

-- 5. Compter les mesures par signal pour voir lesquels sont réellement enregistrés
SELECT 
    m.DeviceId,
    d.Name AS DeviceName,
    m.Signal,
    COUNT(*) AS NombreMesures,
    MAX(m.UtcTs) AS DerniereMesure,
    -- Vérifier si le signal est activé dans les TagMaps
    (SELECT Enabled FROM [AI_ATR].[DIRIS].[TagMaps] tm 
     WHERE tm.DeviceId = m.DeviceId AND tm.Signal = m.Signal) AS SignalActive
FROM [AI_ATR].[DIRIS].[Measurements] m
INNER JOIN [AI_ATR].[DIRIS].[Devices] d ON m.DeviceId = d.DeviceId
WHERE d.Name LIKE '%ATR%TR1%' OR d.Name LIKE '%ATR-TR1%'
  AND m.UtcTs >= DATEADD(MINUTE, -10, GETUTCDATE())  -- Dernières 10 minutes
GROUP BY m.DeviceId, d.Name, m.Signal
ORDER BY NombreMesures DESC;
