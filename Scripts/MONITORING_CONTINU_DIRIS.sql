-- =====================================================
-- MONITORING CONTINU DIRIS - DASHBOARD TEMPS RÉEL
-- =====================================================
-- Scripts pour surveiller en continu le respect des conditions
-- et détecter les anomalies en temps réel

-- =====================================================
-- 1. DASHBOARD TEMPS RÉEL (À exécuter toutes les 5 minutes)
-- =====================================================

-- Vue d'ensemble de l'activité actuelle
SELECT 
    '📊 DASHBOARD DIRIS - ' + FORMAT(GETDATE(), 'dd/MM/yyyy HH:mm:ss') as Info;

-- État des devices en temps réel
SELECT 
    d.Name as DeviceName,
    d.Enabled as DeviceActif,
    d.PollIntervalMs as PollInterval,
    COUNT(DISTINCT tm.Signal) as SignauxConfigures,
    COUNT(DISTINCT CASE WHEN tm.Enabled = 1 THEN tm.Signal END) as SignauxActives,
    COUNT(DISTINCT CASE WHEN m.UtcTs >= DATEADD(MINUTE, -5, GETUTCDATE()) THEN m.Signal END) as SignauxActifs5min,
    MAX(m.UtcTs) as DerniereMesure,
    CASE 
        WHEN MAX(m.UtcTs) IS NULL THEN '❌ INACTIF'
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) <= 5 THEN '✅ ACTIF'
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) <= 15 THEN '⚠️ RALENTI'
        ELSE '🚨 PROBLÈME'
    END as Status
FROM [AI_ATR].[DIRIS].[Devices] d
LEFT JOIN [AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
WHERE d.Enabled = 1
GROUP BY d.Name, d.Enabled, d.PollIntervalMs
ORDER BY Status, DerniereMesure DESC;

-- =====================================================
-- 2. ANALYSE DES FRÉQUENCES RÉELLES VS ATTENDUES
-- =====================================================

-- Calcul des fréquences réelles des dernières 30 minutes
WITH RecentMeasurements AS (
    SELECT 
        d.Name as DeviceName,
        m.Signal,
        m.UtcTs,
        ROW_NUMBER() OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs) as RowNum,
        LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs) as PreviousUtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs) as IntervalMs
    FROM [AI_ATR].[DIRIS].[Devices] d
    JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
    WHERE m.UtcTs >= DATEADD(MINUTE, -30, GETUTCDATE())
),
FrequencyAnalysis AS (
    SELECT 
        rm.DeviceName,
        rm.Signal,
        COUNT(*) as MeasurementCount,
        AVG(rm.IntervalMs) as AvgActualIntervalMs,
        MIN(rm.IntervalMs) as MinActualIntervalMs,
        MAX(rm.IntervalMs) as MaxActualIntervalMs,
        STDEV(rm.IntervalMs) as StdDevIntervalMs
    FROM RecentMeasurements rm
    WHERE rm.IntervalMs IS NOT NULL AND rm.RowNum > 1
    GROUP BY rm.DeviceName, rm.Signal
)
SELECT 
    fa.DeviceName,
    fa.Signal,
    tm.RecordingFrequencyMs as ExpectedFrequencyMs,
    ROUND(fa.AvgActualIntervalMs, 0) as ActualAvgIntervalMs,
    ROUND(fa.MinActualIntervalMs, 0) as ActualMinIntervalMs,
    ROUND(fa.MaxActualIntervalMs, 0) as ActualMaxIntervalMs,
    ROUND(fa.StdDevIntervalMs, 0) as ActualStdDevMs,
    fa.MeasurementCount as MeasuresLast30min,
    CASE 
        WHEN fa.AvgActualIntervalMs IS NULL THEN '❌ PAS DE MESURES'
        WHEN ABS(fa.AvgActualIntervalMs - tm.RecordingFrequencyMs) <= tm.RecordingFrequencyMs * 0.2 
        THEN '✅ CONFORME'
        WHEN fa.AvgActualIntervalMs > tm.RecordingFrequencyMs * 2 
        THEN '⚠️ TROP LENT'
        WHEN fa.AvgActualIntervalMs < tm.RecordingFrequencyMs * 0.5 
        THEN '⚡ TROP RAPIDE'
        WHEN fa.StdDevIntervalMs > tm.RecordingFrequencyMs * 0.5 
        THEN '📈 VARIABLE'
        ELSE '✅ ACCEPTABLE'
    END as ConformityStatus,
    ROUND(
        ABS(fa.AvgActualIntervalMs - tm.RecordingFrequencyMs) * 100.0 / tm.RecordingFrequencyMs, 
        1
    ) as DeviationPercentage
FROM FrequencyAnalysis fa
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON fa.DeviceName = (
    SELECT Name FROM [AI_ATR].[DIRIS].[Devices] WHERE DeviceId = (
        SELECT TOP 1 DeviceId FROM [AI_ATR].[DIRIS].[TagMap] WHERE Signal = fa.Signal
    )
) AND fa.Signal = tm.Signal
WHERE tm.Enabled = 1
ORDER BY 
    CASE 
        WHEN fa.AvgActualIntervalMs IS NULL THEN 1
        WHEN ABS(fa.AvgActualIntervalMs - tm.RecordingFrequencyMs) > tm.RecordingFrequencyMs * 0.5 THEN 2
        ELSE 3
    END,
    DeviationPercentage DESC;

-- =====================================================
-- 3. DÉTECTION D'ANOMALIES EN TEMPS RÉEL
-- =====================================================

-- Signaux avec comportement anormal dans les dernières 10 minutes
SELECT 
    d.Name as DeviceName,
    m.Signal,
    tm.RecordingFrequencyMs as ExpectedFreqMs,
    COUNT(*) as MeasuresLast10min,
    MIN(m.UtcTs) as FirstMeasure,
    MAX(m.UtcTs) as LastMeasure,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ AUCUNE MESURE'
        WHEN COUNT(*) > (tm.RecordingFrequencyMs / 1000 / 60 * 10 * 2) THEN '⚡ TROP DE MESURES'
        WHEN COUNT(*) < (tm.RecordingFrequencyMs / 1000 / 60 * 10 * 0.3) THEN '🐌 TROP PEU DE MESURES'
        WHEN COUNT(DISTINCT m.Value) = 1 THEN '📊 VALEUR FIXE (suspicion)'
        ELSE '✅ NORMAL'
    END as AnomalyStatus
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId 
    AND tm.Signal = m.Signal 
    AND m.UtcTs >= DATEADD(MINUTE, -10, GETUTCDATE())
WHERE tm.Enabled = 1
GROUP BY d.Name, m.Signal, tm.RecordingFrequencyMs
HAVING COUNT(*) = 0 
    OR COUNT(*) > (tm.RecordingFrequencyMs / 1000 / 60 * 10 * 2)
    OR COUNT(*) < (tm.RecordingFrequencyMs / 1000 / 60 * 10 * 0.3)
    OR COUNT(DISTINCT m.Value) = 1
ORDER BY d.Name, m.Signal;

-- =====================================================
-- 4. MÉTRIQUES DE PERFORMANCE
-- =====================================================

-- Performance du système (dernières 2 heures)
SELECT 
    'PERFORMANCE SYSTÈME (2h)' as Metrique,
    COUNT(*) as TotalMesures,
    COUNT(DISTINCT DeviceId) as DevicesActifs,
    COUNT(DISTINCT Signal) as SignauxActifs,
    ROUND(COUNT(*) / 2.0, 1) as MesuresParHeure,
    ROUND(AVG(DATEDIFF(MILLISECOND, IngestTs, UtcTs)), 2) as LatenceMoyenneMs,
    COUNT(CASE WHEN Quality = 0 THEN 1 END) as MesuresBonneQualite,
    ROUND(COUNT(CASE WHEN Quality = 0 THEN 1 END) * 100.0 / COUNT(*), 1) as PourcentageBonneQualite
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(HOUR, -2, GETUTCDATE());

-- =====================================================
-- 5. TENDANCES ET ÉVOLUTIONS
-- =====================================================

-- Évolution de l'activité par tranches de 15 minutes
SELECT 
    FORMAT(DATEADD(MINUTE, (DATEDIFF(MINUTE, '00:00:00', FORMAT(UtcTs, 'HH:mm')) / 15) * 15, '00:00:00'), 'HH:mm') as Tranche15min,
    COUNT(*) as NombreMesures,
    COUNT(DISTINCT DeviceId) as DevicesActifs,
    COUNT(DISTINCT Signal) as SignauxActifs,
    ROUND(AVG(CASE WHEN Quality = 0 THEN 100 WHEN Quality = 1 THEN 50 ELSE 0 END), 1) as QualiteMoyenne
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(HOUR, -4, GETUTCDATE())
GROUP BY DATEADD(MINUTE, (DATEDIFF(MINUTE, '00:00:00', FORMAT(UtcTs, 'HH:mm')) / 15) * 15, '00:00:00')
ORDER BY Tranche15min DESC;

-- =====================================================
-- 6. ALERTES AUTOMATIQUES
-- =====================================================

-- Conditions d'alerte à surveiller
SELECT 
    '🚨 ALERTES TEMPS RÉEL' as Type,
    d.Name as DeviceName,
    tm.Signal,
    CASE 
        WHEN MAX(m.UtcTs) IS NULL THEN 'Signal configuré mais aucune mesure'
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > (tm.RecordingFrequencyMs / 1000 / 60 * 3) 
        THEN 'Retard de ' + CAST(DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) - (tm.RecordingFrequencyMs / 1000 / 60) as VARCHAR) + ' minutes'
        WHEN COUNT(CASE WHEN m.UtcTs >= DATEADD(MINUTE, -5, GETUTCDATE()) THEN 1 END) = 0 
        THEN 'Aucune mesure dans les 5 dernières minutes'
        WHEN AVG(CASE WHEN m.Quality = 2 THEN 1 ELSE 0 END) > 0.5 
        THEN 'Qualité des mesures dégradée (>50% mauvaise)'
    END as Alerte,
    MAX(m.UtcTs) as DerniereMesure,
    COUNT(CASE WHEN m.UtcTs >= DATEADD(MINUTE, -5, GETUTCDATE()) THEN 1 END) as Mesures5min
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId AND tm.Signal = m.Signal
WHERE tm.Enabled = 1
GROUP BY d.Name, tm.Signal, tm.RecordingFrequencyMs
HAVING MAX(m.UtcTs) IS NULL 
    OR DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > (tm.RecordingFrequencyMs / 1000 / 60 * 3)
    OR COUNT(CASE WHEN m.UtcTs >= DATEADD(MINUTE, -5, GETUTCDATE()) THEN 1 END) = 0
    OR AVG(CASE WHEN m.Quality = 2 THEN 1 ELSE 0 END) > 0.5
ORDER BY DerniereMesure;

-- =====================================================
-- 7. CONFIGURATION RECOMMANDÉE
-- =====================================================

-- Recommandations d'optimisation basées sur l'usage réel
SELECT 
    d.Name as DeviceName,
    tm.Signal,
    tm.RecordingFrequencyMs as FrequenceActuelle,
    AVG(DATEDIFF(MILLISECOND, 
        LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
        m.UtcTs)) as FrequenceReelle,
    COUNT(*) as UsageReel,
    CASE 
        WHEN AVG(DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs)) > tm.RecordingFrequencyMs * 1.5 
        THEN 'Considérer réduire la fréquence à ' + CAST(tm.RecordingFrequencyMs * 2 as VARCHAR) + 'ms'
        WHEN AVG(DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs)) < tm.RecordingFrequencyMs * 0.5 
        THEN 'Le système mesure plus souvent que configuré'
        ELSE 'Configuration optimale'
    END as Recommandation
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId AND tm.Signal = m.Signal
WHERE tm.Enabled = 1 
    AND m.UtcTs >= DATEADD(HOUR, -6, GETUTCDATE())
GROUP BY d.Name, tm.Signal, tm.RecordingFrequencyMs
ORDER BY d.Name, tm.Signal;
