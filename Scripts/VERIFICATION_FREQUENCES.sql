-- =====================================================
-- VÉRIFICATION SIMPLE DES FRÉQUENCES DIRIS
-- =====================================================
-- Compare la fréquence configurée vs la fréquence réelle des mesures

-- =====================================================
-- 1. CALCUL DES ÉCARTS RÉELS ENTRE MESURES
-- =====================================================

WITH MesureIntervals AS (
    SELECT 
        d.Name as DeviceName,
        m.Signal,
        m.UtcTs,
        LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs) as PreviousUtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs) as EcartReelMs
    FROM [AI_ATR].[DIRIS].[Devices] d
    JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
    WHERE m.UtcTs >= DATEADD(HOUR, -2, GETUTCDATE()) -- Dernières 2 heures
),
IntervalStats AS (
    SELECT 
        DeviceName,
        Signal,
        COUNT(*) as NombreMesures,
        AVG(EcartReelMs) as EcartMoyenMs,
        MIN(EcartReelMs) as EcartMinMs,
        MAX(EcartReelMs) as EcartMaxMs,
        STDEV(EcartReelMs) as EcartStdDevMs
    FROM MesureIntervals
    WHERE EcartReelMs IS NOT NULL
    GROUP BY DeviceName, Signal
)
SELECT 
    ins.DeviceName,
    ins.Signal,
    tm.RecordingFrequencyMs as FrequenceConfigureeMs,
    ROUND(ins.EcartMoyenMs, 0) as EcartMoyenReelMs,
    ROUND(ins.EcartMinMs, 0) as EcartMinReelMs,
    ROUND(ins.EcartMaxMs, 0) as EcartMaxReelMs,
    ROUND(ins.EcartStdDevMs, 0) as EcartStdDevMs,
    ins.NombreMesures,
    -- Calcul de l'écart en pourcentage
    ROUND(
        ABS(ins.EcartMoyenMs - tm.RecordingFrequencyMs) * 100.0 / tm.RecordingFrequencyMs, 
        1
    ) as EcartPourcentage,
    -- Statut de conformité
    CASE 
        WHEN ins.EcartMoyenMs IS NULL THEN '❌ AUCUNE MESURE'
        WHEN ABS(ins.EcartMoyenMs - tm.RecordingFrequencyMs) <= tm.RecordingFrequencyMs * 0.1 
        THEN '✅ CORRECT'
        WHEN ins.EcartMoyenMs > tm.RecordingFrequencyMs * 1.5 
        THEN '⚠️ TROP LENT'
        WHEN ins.EcartMoyenMs < tm.RecordingFrequencyMs * 0.5 
        THEN '⚡ TROP RAPIDE'
        ELSE '❓ VARIABLE'
    END as Statut
FROM IntervalStats ins
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON ins.Signal = tm.Signal
WHERE tm.Enabled = 1
ORDER BY 
    CASE 
        WHEN ins.EcartMoyenMs IS NULL THEN 1
        WHEN ABS(ins.EcartMoyenMs - tm.RecordingFrequencyMs) > tm.RecordingFrequencyMs * 0.1 THEN 2
        ELSE 3
    END,
    EcartPourcentage DESC;

-- =====================================================
-- 2. RÉSUMÉ SIMPLE
-- =====================================================

SELECT 
    '📊 RÉSUMÉ DES FRÉQUENCES' as Info,
    '' as Separateur;

-- Statistiques globales simplifiées
WITH MesureIntervals AS (
    SELECT 
        m.Signal,
        LAG(m.UtcTs) OVER (PARTITION BY m.DeviceId, m.Signal ORDER BY m.UtcTs) as PreviousUtcTs,
        m.UtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY m.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs) as EcartReelMs
    FROM [AI_ATR].[DIRIS].[Measurements] m
    WHERE m.UtcTs >= DATEADD(HOUR, -2, GETUTCDATE())
),
IntervalStats AS (
    SELECT 
        Signal,
        AVG(EcartReelMs) as EcartMoyenMs
    FROM MesureIntervals
    WHERE EcartReelMs IS NOT NULL
    GROUP BY Signal
)
SELECT 
    COUNT(*) as TotalSignaux,
    COUNT(CASE WHEN ABS(ins.EcartMoyenMs - tm.RecordingFrequencyMs) <= tm.RecordingFrequencyMs * 0.1 THEN 1 END) as SignauxCorrects,
    COUNT(CASE WHEN ins.EcartMoyenMs > tm.RecordingFrequencyMs * 1.5 THEN 1 END) as SignauxTropLents,
    COUNT(CASE WHEN ins.EcartMoyenMs < tm.RecordingFrequencyMs * 0.5 THEN 1 END) as SignauxTropRapides,
    COUNT(CASE WHEN ins.EcartMoyenMs IS NULL THEN 1 END) as SignauxSansMesures,
    ROUND(
        COUNT(CASE WHEN ABS(ins.EcartMoyenMs - tm.RecordingFrequencyMs) <= tm.RecordingFrequencyMs * 0.1 THEN 1 END) * 100.0 / COUNT(*), 
        1
    ) as PourcentageCorrects
FROM IntervalStats ins
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON ins.Signal = tm.Signal
WHERE tm.Enabled = 1;

-- =====================================================
-- 3. SIGNaux PROBLÉMATIQUES (TOP 10)
-- =====================================================

SELECT TOP 10
    '🚨 TOP 10 SIGNaux PROBLÉMATIQUES' as Info,
    '' as Separateur;

WITH MesureIntervals AS (
    SELECT 
        d.Name as DeviceName,
        m.Signal,
        LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs) as PreviousUtcTs,
        m.UtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs) as EcartReelMs
    FROM [AI_ATR].[DIRIS].[Devices] d
    JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
    WHERE m.UtcTs >= DATEADD(HOUR, -2, GETUTCDATE())
),
IntervalStats AS (
    SELECT 
        DeviceName,
        Signal,
        AVG(EcartReelMs) as EcartMoyenMs
    FROM MesureIntervals
    WHERE EcartReelMs IS NOT NULL
    GROUP BY DeviceName, Signal
)
SELECT 
    ins.DeviceName,
    ins.Signal,
    tm.RecordingFrequencyMs as FrequenceConfigureeMs,
    ROUND(ins.EcartMoyenMs, 0) as EcartMoyenReelMs,
    ROUND(
        ABS(ins.EcartMoyenMs - tm.RecordingFrequencyMs) * 100.0 / tm.RecordingFrequencyMs, 
        1
    ) as EcartPourcentage,
    CASE 
        WHEN ins.EcartMoyenMs IS NULL THEN '❌ AUCUNE MESURE'
        WHEN ins.EcartMoyenMs > tm.RecordingFrequencyMs * 1.5 THEN '⚠️ TROP LENT'
        WHEN ins.EcartMoyenMs < tm.RecordingFrequencyMs * 0.5 THEN '⚡ TROP RAPIDE'
        ELSE '❓ VARIABLE'
    END as Probleme
FROM IntervalStats ins
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON ins.Signal = tm.Signal
WHERE tm.Enabled = 1
    AND (ins.EcartMoyenMs IS NULL 
         OR ABS(ins.EcartMoyenMs - tm.RecordingFrequencyMs) > tm.RecordingFrequencyMs * 0.1)
ORDER BY 
    CASE WHEN ins.EcartMoyenMs IS NULL THEN 1 ELSE 2 END,
    ABS(ins.EcartMoyenMs - tm.RecordingFrequencyMs) DESC;