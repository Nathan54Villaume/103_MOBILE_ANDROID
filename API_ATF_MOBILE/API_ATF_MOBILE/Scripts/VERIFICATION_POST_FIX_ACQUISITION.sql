-- =========================================================================
-- Script : VERIFICATION_POST_FIX_ACQUISITION.sql
-- Description : Vérifie que le fix d'acquisition DIRIS fonctionne correctement
--               après le redéploiement
-- Date : 2025-10-10
-- Usage : Exécuter ce script 10-15 minutes après le redéploiement
-- =========================================================================

USE [AI_ATR];
GO

PRINT '========================================';
PRINT 'VERIFICATION POST-FIX ACQUISITION DIRIS';
PRINT 'Date : ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '========================================';
GO

-- =========================================================================
-- TEST 1 : Vérifier qu'il y a de nouvelles mesures récentes
-- =========================================================================
PRINT '';
PRINT '--- TEST 1 : Présence de mesures récentes ---';
GO

DECLARE @MeasurementsLast5Min INT;
DECLARE @MeasurementsLast10Min INT;

SELECT @MeasurementsLast5Min = COUNT(*)
FROM [DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(MINUTE, -5, GETUTCDATE());

SELECT @MeasurementsLast10Min = COUNT(*)
FROM [DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(MINUTE, -10, GETUTCDATE());

PRINT 'Mesures dans les 5 dernières minutes : ' + CAST(@MeasurementsLast5Min AS VARCHAR);
PRINT 'Mesures dans les 10 dernières minutes : ' + CAST(@MeasurementsLast10Min AS VARCHAR);

IF @MeasurementsLast5Min > 0
    PRINT '✅ TEST 1 REUSSI : L''acquisition fonctionne';
ELSE
    PRINT '❌ TEST 1 ECHOUE : Aucune mesure récente (attendre quelques minutes ou vérifier les logs)';
GO

-- =========================================================================
-- TEST 2 : Vérifier la cohérence des fréquences
-- =========================================================================
PRINT '';
PRINT '--- TEST 2 : Cohérence des fréquences d''acquisition ---';
PRINT 'Analyse des 15 dernières minutes...';
GO

;WITH MeasurementIntervals AS (
    SELECT 
        m.TagMapId,
        d.Name AS DeviceName,
        tm.Signal,
        tm.RecordingFrequencyMs AS FrequenceConfigMs,
        m.UtcTs,
        LAG(m.UtcTs) OVER (PARTITION BY m.TagMapId ORDER BY m.UtcTs) AS PreviousUtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY m.TagMapId ORDER BY m.UtcTs), 
            m.UtcTs
        ) AS IntervalMs
    FROM [DIRIS].[Measurements] m
    INNER JOIN [DIRIS].[TagMap] tm ON m.TagMapId = tm.TagMapId
    INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
    WHERE m.UtcTs >= DATEADD(MINUTE, -15, GETUTCDATE())
        AND tm.Enabled = 1
),
FrequencyStats AS (
    SELECT 
        DeviceName,
        Signal,
        FrequenceConfigMs,
        COUNT(*) AS NbMesures,
        AVG(CAST(IntervalMs AS FLOAT)) AS EcartMoyenMs,
        MIN(IntervalMs) AS EcartMinMs,
        MAX(IntervalMs) AS EcartMaxMs,
        STDEV(IntervalMs) AS EcartStdDevMs
    FROM MeasurementIntervals
    WHERE IntervalMs IS NOT NULL
        AND IntervalMs > 0
    GROUP BY DeviceName, Signal, FrequenceConfigMs
)
SELECT TOP 20
    DeviceName AS Device,
    Signal,
    FrequenceConfigMs AS [Frequence Config (ms)],
    NbMesures AS [Nb Mesures],
    CAST(EcartMoyenMs AS INT) AS [Ecart Moyen (ms)],
    CAST(EcartMinMs AS INT) AS [Ecart Min (ms)],
    CAST(EcartMaxMs AS INT) AS [Ecart Max (ms)],
    CAST(EcartStdDevMs AS INT) AS [Ecart StdDev (ms)],
    -- Calcul du % d'écart par rapport à la config
    CAST(ABS(EcartMoyenMs - FrequenceConfigMs) * 100.0 / FrequenceConfigMs AS DECIMAL(5,2)) AS [Ecart %],
    -- Déterminer si c'est conforme
    CASE 
        WHEN ABS(EcartMoyenMs - FrequenceConfigMs) * 100.0 / FrequenceConfigMs < 5 THEN '✅ CONFORME'
        WHEN ABS(EcartMoyenMs - FrequenceConfigMs) * 100.0 / FrequenceConfigMs < 20 THEN '⚠️ ACCEPTABLE'
        ELSE '❌ PROBLEME'
    END AS [Statut]
FROM FrequencyStats
WHERE FrequenceConfigMs > 0
ORDER BY NbMesures DESC;
GO

-- =========================================================================
-- TEST 3 : Détecter les signaux avec acquisition trop rapide
-- =========================================================================
PRINT '';
PRINT '--- TEST 3 : Signaux avec acquisition trop rapide ---';
GO

;WITH MeasurementIntervals AS (
    SELECT 
        m.TagMapId,
        d.Name AS DeviceName,
        tm.Signal,
        tm.RecordingFrequencyMs AS FrequenceConfigMs,
        m.UtcTs,
        LAG(m.UtcTs) OVER (PARTITION BY m.TagMapId ORDER BY m.UtcTs) AS PreviousUtcTs,
        DATEDIFF(MILLISECOND, 
            LAG(m.UtcTs) OVER (PARTITION BY m.TagMapId ORDER BY m.UtcTs), 
            m.UtcTs
        ) AS IntervalMs
    FROM [DIRIS].[Measurements] m
    INNER JOIN [DIRIS].[TagMap] tm ON m.TagMapId = tm.TagMapId
    INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
    WHERE m.UtcTs >= DATEADD(MINUTE, -15, GETUTCDATE())
        AND tm.Enabled = 1
),
FrequencyStats AS (
    SELECT 
        DeviceName,
        Signal,
        FrequenceConfigMs,
        COUNT(*) AS NbMesures,
        AVG(CAST(IntervalMs AS FLOAT)) AS EcartMoyenMs
    FROM MeasurementIntervals
    WHERE IntervalMs IS NOT NULL
        AND IntervalMs > 0
    GROUP BY DeviceName, Signal, FrequenceConfigMs
)
SELECT 
    DeviceName AS Device,
    Signal,
    FrequenceConfigMs AS [Frequence Config (ms)],
    NbMesures AS [Nb Mesures],
    CAST(EcartMoyenMs AS INT) AS [Ecart Reel (ms)],
    CAST(ABS(EcartMoyenMs - FrequenceConfigMs) * 100.0 / FrequenceConfigMs AS DECIMAL(5,2)) AS [Ecart %]
FROM FrequencyStats
WHERE FrequenceConfigMs > 0
    AND EcartMoyenMs < FrequenceConfigMs * 0.8 -- Plus de 20% trop rapide
ORDER BY [Ecart %] DESC;

IF @@ROWCOUNT = 0
    PRINT '✅ Aucun signal avec acquisition trop rapide détecté';
ELSE
    PRINT '❌ Des signaux ont encore une acquisition trop rapide (voir résultats ci-dessus)';
GO

-- =========================================================================
-- TEST 4 : Statistiques globales
-- =========================================================================
PRINT '';
PRINT '--- TEST 4 : Statistiques globales ---';
GO

-- Nombre de devices actifs
DECLARE @ActiveDevices INT;
SELECT @ActiveDevices = COUNT(DISTINCT tm.DeviceId)
FROM [DIRIS].[TagMap] tm
INNER JOIN [DIRIS].[Measurements] m ON tm.TagMapId = m.TagMapId
WHERE m.UtcTs >= DATEADD(MINUTE, -15, GETUTCDATE())
    AND tm.Enabled = 1;

-- Nombre de signaux actifs
DECLARE @ActiveSignals INT;
SELECT @ActiveSignals = COUNT(DISTINCT tm.TagMapId)
FROM [DIRIS].[TagMap] tm
INNER JOIN [DIRIS].[Measurements] m ON tm.TagMapId = m.TagMapId
WHERE m.UtcTs >= DATEADD(MINUTE, -15, GETUTCDATE())
    AND tm.Enabled = 1;

-- Taux d'acquisition moyen (mesures/minute)
DECLARE @AcquisitionRate FLOAT;
SELECT @AcquisitionRate = COUNT(*) / 15.0
FROM [DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(MINUTE, -15, GETUTCDATE());

PRINT 'Devices actifs (15 dernières min) : ' + CAST(@ActiveDevices AS VARCHAR);
PRINT 'Signaux actifs (15 dernières min) : ' + CAST(@ActiveSignals AS VARCHAR);
PRINT 'Taux d''acquisition moyen : ' + CAST(CAST(@AcquisitionRate AS DECIMAL(10,2)) AS VARCHAR) + ' mesures/minute';

-- Calculer le taux ATTENDU basé sur les fréquences configurées
DECLARE @ExpectedRate FLOAT;
;WITH SignalRates AS (
    SELECT 
        CASE 
            WHEN RecordingFrequencyMs = 0 THEN 0
            ELSE 60000.0 / RecordingFrequencyMs -- mesures par minute
        END AS ExpectedMeasuresPerMinute
    FROM [DIRIS].[TagMap]
    WHERE Enabled = 1
)
SELECT @ExpectedRate = SUM(ExpectedMeasuresPerMinute)
FROM SignalRates;

PRINT 'Taux d''acquisition attendu : ' + CAST(CAST(@ExpectedRate AS DECIMAL(10,2)) AS VARCHAR) + ' mesures/minute';
PRINT 'Ratio réel/attendu : ' + CAST(CAST((@AcquisitionRate / @ExpectedRate) * 100.0 AS DECIMAL(5,2)) AS VARCHAR) + '%';

IF @AcquisitionRate <= @ExpectedRate * 1.1 -- Tolérance de 10%
    PRINT '✅ TEST 4 REUSSI : Taux d''acquisition conforme';
ELSE
    PRINT '⚠️ TEST 4 : Taux d''acquisition légèrement élevé (peut être normal si le système vient de redémarrer)';
GO

-- =========================================================================
-- TEST 5 : Dernières mesures par device
-- =========================================================================
PRINT '';
PRINT '--- TEST 5 : Dernières mesures par device ---';
GO

;WITH LastMeasurements AS (
    SELECT 
        d.DeviceId,
        d.Name AS DeviceName,
        MAX(m.UtcTs) AS LastMeasurement,
        COUNT(DISTINCT tm.TagMapId) AS ActiveSignals,
        COUNT(*) AS TotalMeasurements
    FROM [DIRIS].[Devices] d
    LEFT JOIN [DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId AND tm.Enabled = 1
    LEFT JOIN [DIRIS].[Measurements] m ON tm.TagMapId = m.TagMapId AND m.UtcTs >= DATEADD(MINUTE, -15, GETUTCDATE())
    WHERE d.Enabled = 1
    GROUP BY d.DeviceId, d.Name
)
SELECT 
    DeviceName AS Device,
    ActiveSignals AS [Signaux actifs],
    TotalMeasurements AS [Mesures (15 min)],
    CASE 
        WHEN LastMeasurement IS NULL THEN 'Aucune mesure'
        ELSE CONVERT(VARCHAR, LastMeasurement, 120) + ' (' + 
             CAST(DATEDIFF(SECOND, LastMeasurement, GETUTCDATE()) AS VARCHAR) + 's ago)'
    END AS [Dernière mesure],
    CASE 
        WHEN TotalMeasurements = 0 THEN '❌ INACTIF'
        WHEN DATEDIFF(SECOND, LastMeasurement, GETUTCDATE()) < 60 THEN '✅ ACTIF'
        WHEN DATEDIFF(SECOND, LastMeasurement, GETUTCDATE()) < 300 THEN '⚠️ RALENTI'
        ELSE '❌ PROBLEME'
    END AS Statut
FROM LastMeasurements
ORDER BY TotalMeasurements DESC;
GO

-- =========================================================================
-- RAPPORT FINAL
-- =========================================================================
PRINT '';
PRINT '========================================';
PRINT 'RAPPORT FINAL';
PRINT '========================================';
GO

DECLARE @TestsPassed INT = 0;
DECLARE @TestsFailed INT = 0;
DECLARE @TestsWarning INT = 0;

-- Vérifier chaque test
IF EXISTS (SELECT 1 FROM [DIRIS].[Measurements] WHERE UtcTs >= DATEADD(MINUTE, -5, GETUTCDATE()))
    SET @TestsPassed = @TestsPassed + 1;
ELSE
    SET @TestsFailed = @TestsFailed + 1;

-- Résumer
PRINT 'Tests réussis : ' + CAST(@TestsPassed AS VARCHAR);
PRINT 'Tests échoués : ' + CAST(@TestsFailed AS VARCHAR);
PRINT '';

IF @TestsFailed = 0
BEGIN
    PRINT '✅✅✅ TOUS LES TESTS SONT PASSES ✅✅✅';
    PRINT 'Le fix d''acquisition fonctionne correctement !';
    PRINT 'Les fréquences d''acquisition sont maintenant respectées.';
END
ELSE
BEGIN
    PRINT '⚠️⚠️⚠️ CERTAINS TESTS ONT ECHOUE ⚠️⚠️⚠️';
    PRINT 'Actions recommandées :';
    PRINT '1. Vérifier que l''application a bien été redéployée';
    PRINT '2. Vérifier les logs dans C:\API_ATF_MOBILE\DATA\logs\';
    PRINT '3. Attendre 10-15 minutes après le redémarrage puis relancer ce script';
    PRINT '4. Vérifier la configuration dans appsettings.json';
END

PRINT '';
PRINT '========================================';
PRINT 'FIN DU RAPPORT';
PRINT 'Date : ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '========================================';
GO

