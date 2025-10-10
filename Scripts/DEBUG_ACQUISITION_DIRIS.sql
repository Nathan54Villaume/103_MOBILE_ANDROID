-- =====================================================
-- DEBUG ACQUISITION DIRIS - RÉSULTAT SIMPLE À PARTAGER
-- =====================================================
-- Script qui retourne un tableau simple pour analyser les problèmes d'acquisition

-- =====================================================
-- RÉSULTAT PRINCIPAL - TABLEAU SIMPLE À PARTAGER
-- =====================================================

WITH MesureIntervals AS (
    SELECT 
        d.Name as Device,
        m.Signal,
        LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs) as PreviousUtcTs,
        m.UtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs) as EcartMs
    FROM [AI_ATR].[DIRIS].[Devices] d
    JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
    WHERE m.UtcTs >= DATEADD(HOUR, -2, GETUTCDATE())
),
SignalStats AS (
    SELECT 
        Device,
        Signal,
        COUNT(*) as NbMesures,
        AVG(EcartMs) as EcartMoyenMs,
        MIN(EcartMs) as EcartMinMs,
        MAX(EcartMs) as EcartMaxMs,
        MAX(UtcTs) as DerniereMesure
    FROM MesureIntervals
    WHERE EcartMs IS NOT NULL
    GROUP BY Device, Signal
)
SELECT 
    ss.Device,
    ss.Signal,
    tm.RecordingFrequencyMs as FrequenceConfigMs,
    ss.NbMesures,
    ROUND(ss.EcartMoyenMs, 0) as EcartReelMs,
    ROUND(ABS(ss.EcartMoyenMs - tm.RecordingFrequencyMs) * 100.0 / tm.RecordingFrequencyMs, 1) as EcartPourcent,
    CASE 
        WHEN ss.EcartMoyenMs IS NULL THEN 'PAS_DE_MESURES'
        WHEN ABS(ss.EcartMoyenMs - tm.RecordingFrequencyMs) <= tm.RecordingFrequencyMs * 0.1 THEN 'CORRECT'
        WHEN ss.EcartMoyenMs > tm.RecordingFrequencyMs * 1.5 THEN 'TROP_LENT'
        WHEN ss.EcartMoyenMs < tm.RecordingFrequencyMs * 0.5 THEN 'TROP_RAPIDE'
        ELSE 'VARIABLE'
    END as Probleme,
    FORMAT(ss.DerniereMesure, 'HH:mm:ss') as DerniereMesureHeure
FROM SignalStats ss
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON ss.Signal = tm.Signal
WHERE tm.Enabled = 1
ORDER BY 
    CASE 
        WHEN ss.EcartMoyenMs IS NULL THEN 1
        WHEN ABS(ss.EcartMoyenMs - tm.RecordingFrequencyMs) > tm.RecordingFrequencyMs * 0.1 THEN 2
        ELSE 3
    END,
    ss.EcartMoyenMs;

-- =====================================================
-- RÉSUMÉ NUMÉRIQUE SIMPLE
-- =====================================================

WITH MesureIntervals2 AS (
    SELECT 
        d.Name as Device,
        m.Signal,
        LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs) as PreviousUtcTs,
        m.UtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs) as EcartMs
    FROM [AI_ATR].[DIRIS].[Devices] d
    JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
    WHERE m.UtcTs >= DATEADD(HOUR, -2, GETUTCDATE())
),
SignalStats2 AS (
    SELECT 
        Device,
        Signal,
        AVG(EcartMs) as EcartMoyenMs
    FROM MesureIntervals2
    WHERE EcartMs IS NOT NULL
    GROUP BY Device, Signal
),
ProblemClassification AS (
    SELECT 
        ss.Signal,
        tm.RecordingFrequencyMs,
        CASE 
            WHEN ss.EcartMoyenMs IS NULL THEN 'PAS_DE_MESURES'
            WHEN ABS(ss.EcartMoyenMs - tm.RecordingFrequencyMs) <= tm.RecordingFrequencyMs * 0.1 THEN 'CORRECT'
            WHEN ss.EcartMoyenMs > tm.RecordingFrequencyMs * 1.5 THEN 'TROP_LENT'
            WHEN ss.EcartMoyenMs < tm.RecordingFrequencyMs * 0.5 THEN 'TROP_RAPIDE'
            ELSE 'VARIABLE'
        END as Probleme
    FROM SignalStats2 ss
    JOIN [AI_ATR].[DIRIS].[TagMap] tm ON ss.Signal = tm.Signal
    WHERE tm.Enabled = 1
)
SELECT 
    'RÉSUMÉ' as Info,
    COUNT(*) as TotalSignaux,
    SUM(CASE WHEN pc.Probleme = 'CORRECT' THEN 1 ELSE 0 END) as SignauxCorrects,
    SUM(CASE WHEN pc.Probleme = 'TROP_LENT' THEN 1 ELSE 0 END) as SignauxTropLents,
    SUM(CASE WHEN pc.Probleme = 'TROP_RAPIDE' THEN 1 ELSE 0 END) as SignauxTropRapides,
    SUM(CASE WHEN pc.Probleme = 'PAS_DE_MESURES' THEN 1 ELSE 0 END) as SignauxSansMesures,
    ROUND(
        SUM(CASE WHEN pc.Probleme = 'CORRECT' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
        1
    ) as PourcentageCorrects
FROM ProblemClassification pc;