-- ========================================
-- DIAGNOSTIC : Service d'acquisition DIRIS
-- Vérifier si le service s'arrête réellement
-- ========================================

-- 1. Compter les mesures par minute (dernières 10 minutes)
-- Si le service est arrêté, on ne devrait pas voir de nouvelles mesures
SELECT 
    DATEPART(HOUR, UtcTs) AS Heure,
    DATEPART(MINUTE, UtcTs) AS Minute,
    COUNT(*) AS NombreMesures,
    COUNT(DISTINCT Signal) AS SignauxDifferents,
    MIN(IngestTs) AS PremiereIngestion,
    MAX(IngestTs) AS DerniereIngestion
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE DeviceId = (SELECT TOP 1 DeviceId FROM [AI_ATR].[DIRIS].[Devices] WHERE Name LIKE '%ATR%TR1%')
  AND UtcTs >= DATEADD(MINUTE, -10, GETUTCDATE())
GROUP BY DATEPART(HOUR, UtcTs), DATEPART(MINUTE, UtcTs)
ORDER BY Heure DESC, Minute DESC;

-- ========================================
-- RÉSULTAT ATTENDU SI LE SERVICE EST ARRÊTÉ :
-- - Aucune ligne OU
-- - Dernières mesures datant de plusieurs minutes
-- ========================================

-- 2. Vérifier les mesures des 2 dernières minutes (temps réel)
SELECT 
    Signal,
    COUNT(*) AS Mesures_2_dernieres_minutes,
    MAX(UtcTs) AS DerniereMesure,
    DATEDIFF(SECOND, MAX(UtcTs), GETUTCDATE()) AS SecondesDepuisDerniereMesure
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE DeviceId = (SELECT TOP 1 DeviceId FROM [AI_ATR].[DIRIS].[Devices] WHERE Name LIKE '%ATR%TR1%')
  AND UtcTs >= DATEADD(MINUTE, -2, GETUTCDATE())
GROUP BY Signal
ORDER BY DerniereMesure DESC;

-- ========================================
-- RÉSULTAT ATTENDU SI LE SERVICE EST ARRÊTÉ :
-- - 0 lignes (aucune mesure récente)
-- OU
-- - SecondesDepuisDerniereMesure > 120 secondes
-- ========================================

-- 3. Vérifier la continuité des mesures (pour détecter un arrêt)
WITH MesuresParMinute AS (
    SELECT 
        DATEADD(MINUTE, DATEDIFF(MINUTE, 0, UtcTs), 0) AS MinuteUtc,
        COUNT(*) AS NombreMesures
    FROM [AI_ATR].[DIRIS].[Measurements]
    WHERE DeviceId = (SELECT TOP 1 DeviceId FROM [AI_ATR].[DIRIS].[Devices] WHERE Name LIKE '%ATR%TR1%')
      AND UtcTs >= DATEADD(MINUTE, -10, GETUTCDATE())
    GROUP BY DATEADD(MINUTE, DATEDIFF(MINUTE, 0, UtcTs), 0)
)
SELECT 
    MinuteUtc,
    NombreMesures,
    CASE 
        WHEN NombreMesures = 0 THEN '⏸️ ARRÊTÉ'
        WHEN NombreMesures < 100 THEN '⚠️ RALENTI'
        ELSE '✅ ACTIF'
    END AS Statut
FROM MesuresParMinute
ORDER BY MinuteUtc DESC;

-- ========================================
-- INTERPRÉTATION :
-- - ✅ ACTIF : ~280 mesures/minute (7 signaux × 40 cycles)
-- - ⚠️ RALENTI : < 100 mesures/minute (problème)
-- - ⏸️ ARRÊTÉ : 0 mesures/minute (service arrêté)
-- ========================================

-- 4. Test en temps réel : Attendre 30 secondes et réexécuter
WAITFOR DELAY '00:00:30';

-- Recompter après 30 secondes
SELECT 
    'Après 30 secondes d''attente' AS Info,
    COUNT(*) AS NouvellesMesures,
    MAX(UtcTs) AS DerniereMesureUtc,
    MAX(IngestTs) AS DerniereIngestionServeur
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE DeviceId = (SELECT TOP 1 DeviceId FROM [AI_ATR].[DIRIS].[Devices] WHERE Name LIKE '%ATR%TR1%')
  AND IngestTs >= DATEADD(SECOND, -35, GETUTCDATE());  -- 35s pour couvrir le WAITFOR

-- ========================================
-- SI LE SERVICE EST VRAIMENT ARRÊTÉ :
-- NouvellesMesures = 0
-- ========================================
