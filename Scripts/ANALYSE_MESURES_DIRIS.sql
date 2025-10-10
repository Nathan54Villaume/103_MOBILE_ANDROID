-- =====================================================
-- ANALYSE DES MESURES DIRIS - RESPECT DES CONDITIONS
-- =====================================================
-- Script pour vérifier si les mesures respectent les fréquences
-- et conditions configurées dans les tables DIRIS

-- =====================================================
-- 1. VÉRIFICATION DES FRÉQUENCES DE MESURE
-- =====================================================

-- Analyse globale des fréquences par device
SELECT 
    d.DeviceId,
    d.Name as DeviceName,
    d.PollIntervalMs as PollIntervalConfigured,
    COUNT(DISTINCT tm.Signal) as TotalSignalsConfigured,
    COUNT(DISTINCT CASE WHEN tm.Enabled = 1 THEN tm.Signal END) as EnabledSignals,
    AVG(tm.RecordingFrequencyMs) as AvgRecordingFrequencyMs,
    MIN(tm.RecordingFrequencyMs) as MinRecordingFrequencyMs,
    MAX(tm.RecordingFrequencyMs) as MaxRecordingFrequencyMs
FROM [AI_ATR].[AI_ATR].[DIRIS].[Devices] d
LEFT JOIN [AI_ATR].[AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
GROUP BY d.DeviceId, d.Name, d.PollIntervalMs
ORDER BY d.DeviceId;

-- =====================================================
-- 2. ANALYSE DÉTAILLÉE DES FRÉQUENCES PAR SIGNAL
-- =====================================================

-- Signaux avec fréquences anormales (très rapides ou très lentes)
SELECT 
    d.Name as DeviceName,
    tm.Signal,
    tm.RecordingFrequencyMs as FrequencyConfigured,
    tm.Enabled,
    tm.Description,
    CASE 
        WHEN tm.RecordingFrequencyMs < 1000 THEN 'TRÈS RAPIDE (< 1s)'
        WHEN tm.RecordingFrequencyMs > 60000 THEN 'TRÈS LENT (> 1min)'
        WHEN tm.RecordingFrequencyMs BETWEEN 1000 AND 5000 THEN 'RAPIDE (1-5s)'
        WHEN tm.RecordingFrequencyMs BETWEEN 5000 AND 30000 THEN 'NORMAL (5-30s)'
        ELSE 'LENT (30s+)'
    END as FrequencyCategory
FROM [AI_ATR].[AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
WHERE tm.Enabled = 1
ORDER BY tm.RecordingFrequencyMs, d.Name, tm.Signal;

-- =====================================================
-- 3. VÉRIFICATION DES MESURES ACTUELLES
-- =====================================================

-- Dernières mesures par device (pour voir l'activité récente)
SELECT 
    d.Name as DeviceName,
    m.Signal,
    m.UtcTs as LastMeasurementTime,
    m.Value as LastValue,
    m.Quality as LastQuality,
    DATEDIFF(MINUTE, m.UtcTs, GETUTCDATE()) as MinutesSinceLastMeasurement
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
JOIN (
    SELECT DeviceId, Signal, MAX(UtcTs) as MaxUtcTs
    FROM [AI_ATR].[DIRIS].[Measurements]
    GROUP BY DeviceId, Signal
) latest ON m.DeviceId = latest.DeviceId 
         AND m.Signal = latest.Signal 
         AND m.UtcTs = latest.MaxUtcTs
ORDER BY d.Name, MinutesSinceLastMeasurement DESC;

-- =====================================================
-- 4. ANALYSE DE CONFORMITÉ DES FRÉQUENCES
-- =====================================================

-- Signaux qui devraient être actifs mais n'ont pas de mesures récentes
SELECT 
    d.Name as DeviceName,
    tm.Signal,
    tm.RecordingFrequencyMs as ExpectedFrequencyMs,
    MAX(m.UtcTs) as LastMeasurementTime,
    CASE 
        WHEN MAX(m.UtcTs) IS NULL THEN 'JAMAIS MESURÉ'
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > (tm.RecordingFrequencyMs / 1000 / 60 * 3) 
        THEN 'MESURES EN RETARD'
        ELSE 'ACTIF'
    END as Status
FROM [AI_ATR].[AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId AND tm.Signal = m.Signal
WHERE tm.Enabled = 1
GROUP BY d.Name, tm.Signal, tm.RecordingFrequencyMs
HAVING MAX(m.UtcTs) IS NULL 
    OR DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > (tm.RecordingFrequencyMs / 1000 / 60 * 3)
ORDER BY d.Name, tm.Signal;

-- =====================================================
-- 5. STATISTIQUES DE QUALITÉ DES MESURES
-- =====================================================

-- Qualité des mesures par device (dernières 24h)
SELECT 
    d.Name as DeviceName,
    COUNT(*) as TotalMeasurements,
    COUNT(CASE WHEN m.Quality = 0 THEN 1 END) as GoodQuality,
    COUNT(CASE WHEN m.Quality = 1 THEN 1 END) as UncertainQuality,
    COUNT(CASE WHEN m.Quality = 2 THEN 1 END) as BadQuality,
    ROUND(COUNT(CASE WHEN m.Quality = 0 THEN 1 END) * 100.0 / COUNT(*), 2) as GoodQualityPercentage,
    MIN(m.UtcTs) as FirstMeasurement,
    MAX(m.UtcTs) as LastMeasurement
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
WHERE m.UtcTs >= DATEADD(HOUR, -24, GETUTCDATE())
GROUP BY d.Name
ORDER BY GoodQualityPercentage DESC;

-- =====================================================
-- 6. ANALYSE DES INTERVALLES DE MESURE RÉELS
-- =====================================================

-- Calcul des intervalles réels entre mesures pour chaque signal
WITH MeasurementIntervals AS (
    SELECT 
        d.Name as DeviceName,
        m.Signal,
        m.UtcTs,
        LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs) as PreviousUtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY d.DeviceId, m.Signal ORDER BY m.UtcTs), 
            m.UtcTs) as ActualIntervalMs
    FROM [AI_ATR].[DIRIS].[Devices] d
    JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
    WHERE m.UtcTs >= DATEADD(HOUR, -1, GETUTCDATE()) -- Dernière heure
),
IntervalStats AS (
    SELECT 
        DeviceName,
        Signal,
        COUNT(*) as MeasurementCount,
        AVG(ActualIntervalMs) as AvgActualIntervalMs,
        MIN(ActualIntervalMs) as MinActualIntervalMs,
        MAX(ActualIntervalMs) as MaxActualIntervalMs,
        STDEV(ActualIntervalMs) as StdDevIntervalMs
    FROM MeasurementIntervals
    WHERE ActualIntervalMs IS NOT NULL
    GROUP BY DeviceName, Signal
)
SELECT 
    is.DeviceName,
    is.Signal,
    tm.RecordingFrequencyMs as ExpectedFrequencyMs,
    is.AvgActualIntervalMs,
    is.MinActualIntervalMs,
    is.MaxActualIntervalMs,
    ROUND(is.StdDevIntervalMs, 2) as StdDevIntervalMs,
    CASE 
        WHEN ABS(is.AvgActualIntervalMs - tm.RecordingFrequencyMs) <= tm.RecordingFrequencyMs * 0.1 
        THEN 'CONFORME'
        WHEN is.AvgActualIntervalMs > tm.RecordingFrequencyMs * 1.5 
        THEN 'TROP LENT'
        WHEN is.AvgActualIntervalMs < tm.RecordingFrequencyMs * 0.5 
        THEN 'TROP RAPIDE'
        ELSE 'VARIABLE'
    END as FrequencyCompliance,
    is.MeasurementCount
FROM IntervalStats is
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON is.DeviceName = (
    SELECT Name FROM [AI_ATR].[DIRIS].[Devices] WHERE DeviceId = (
        SELECT DeviceId FROM [AI_ATR].[DIRIS].[TagMap] WHERE Signal = is.Signal LIMIT 1
    )
) AND is.Signal = tm.Signal
ORDER BY is.DeviceName, FrequencyCompliance, is.Signal;

-- =====================================================
-- 7. RAPPORT DE SYNTHÈSE
-- =====================================================

-- Vue d'ensemble de la conformité du système
SELECT 
    'TOTAL DEVICES' as Metric,
    COUNT(*) as Value,
    '' as Details
FROM [AI_ATR].[DIRIS].[Devices]
WHERE Enabled = 1

UNION ALL

SELECT 
    'TOTAL SIGNALS CONFIGURÉS' as Metric,
    COUNT(*) as Value,
    '' as Details
FROM [AI_ATR].[DIRIS].[TagMap]
WHERE Enabled = 1

UNION ALL

SELECT 
    'SIGNALS SANS MESURES (24H)' as Metric,
    COUNT(*) as Value,
    'Signaux configurés mais sans mesures récentes' as Details
FROM [AI_ATR].[DIRIS].[TagMap] tm
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId 
    AND tm.Signal = m.Signal 
    AND m.UtcTs >= DATEADD(HOUR, -24, GETUTCDATE())
WHERE tm.Enabled = 1 AND m.UtcTs IS NULL

UNION ALL

SELECT 
    'MESURES TOTALES (24H)' as Metric,
    COUNT(*) as Value,
    'Nombre total de mesures reçues' as Details
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(HOUR, -24, GETUTCDATE())

UNION ALL

SELECT 
    'QUALITÉ MOYENNE (24H)' as Metric,
    ROUND(AVG(CASE WHEN Quality = 0 THEN 100 WHEN Quality = 1 THEN 50 ELSE 0 END), 2) as Value,
    'Pourcentage de qualité des mesures' as Details
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(HOUR, -24, GETUTCDATE());

-- =====================================================
-- 8. REQUÊTES DE DIAGNOSTIC RAPIDE
-- =====================================================

-- Signaux problématiques (à exécuter en premier pour un diagnostic rapide)
SELECT TOP 20
    d.Name as DeviceName,
    tm.Signal,
    tm.RecordingFrequencyMs as ExpectedFreqMs,
    MAX(m.UtcTs) as LastMeasurement,
    DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) as MinutesSinceLast,
    CASE 
        WHEN MAX(m.UtcTs) IS NULL THEN '❌ JAMAIS MESURÉ'
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > 60 THEN '⚠️ PAS DE MESURE > 1H'
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > (tm.RecordingFrequencyMs / 1000 / 60 * 2) 
        THEN '⚠️ RETARD DETECTÉ'
        ELSE '✅ ACTIF'
    END as Status
FROM [AI_ATR].[AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId AND tm.Signal = m.Signal
WHERE tm.Enabled = 1
GROUP BY d.Name, tm.Signal, tm.RecordingFrequencyMs
ORDER BY 
    CASE 
        WHEN MAX(m.UtcTs) IS NULL THEN 1
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > 60 THEN 2
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > (tm.RecordingFrequencyMs / 1000 / 60 * 2) THEN 3
        ELSE 4
    END,
    MinutesSinceLast DESC;
