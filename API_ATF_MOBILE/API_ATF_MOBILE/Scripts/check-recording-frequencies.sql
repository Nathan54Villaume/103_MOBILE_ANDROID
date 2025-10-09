-- ========================================
-- SCRIPT DE VERIFICATION DES FREQUENCES D'ENREGISTREMENT
-- ========================================
-- Ce script permet de vérifier les fréquences d'acquisition configurées pour chaque signal
-- Exécution: sqlcmd -S "10.250.13.4" -d "AI_ATR" -i "check-recording-frequencies.sql"

USE [AI_ATR];
GO

PRINT '========================================';
PRINT 'VERIFICATION DES FREQUENCES D''ENREGISTREMENT';
PRINT '========================================';
PRINT '';

-- ========================================
-- 1. RESUME GLOBAL DES FREQUENCES
-- ========================================
PRINT '--- 1. RESUME GLOBAL DES FREQUENCES ---';
PRINT '';

SELECT 
    RecordingFrequencyMs AS 'Fréquence (ms)',
    CASE 
        WHEN RecordingFrequencyMs = 1000 THEN '1 seconde'
        WHEN RecordingFrequencyMs = 2000 THEN '2 secondes'
        WHEN RecordingFrequencyMs = 5000 THEN '5 secondes'
        WHEN RecordingFrequencyMs = 10000 THEN '10 secondes'
        WHEN RecordingFrequencyMs = 30000 THEN '30 secondes'
        WHEN RecordingFrequencyMs = 60000 THEN '1 minute'
        WHEN RecordingFrequencyMs = 300000 THEN '5 minutes'
        WHEN RecordingFrequencyMs = 600000 THEN '10 minutes'
        ELSE CAST(RecordingFrequencyMs AS VARCHAR) + ' ms'
    END AS 'Libellé',
    COUNT(*) AS 'Nombre de signaux',
    CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS DECIMAL(5,2)) AS 'Pourcentage (%)'
FROM [DIRIS].[TagMap]
WHERE Enabled = 1
GROUP BY RecordingFrequencyMs
ORDER BY RecordingFrequencyMs ASC;

PRINT '';
PRINT '';

-- ========================================
-- 2. FREQUENCES PAR DEVICE
-- ========================================
PRINT '--- 2. FREQUENCES PAR DEVICE ---';
PRINT '';

SELECT 
    d.DeviceId,
    d.Name AS 'Device',
    COUNT(tm.Signal) AS 'Nb Signaux',
    MIN(tm.RecordingFrequencyMs) AS 'Freq Min (ms)',
    MAX(tm.RecordingFrequencyMs) AS 'Freq Max (ms)',
    AVG(tm.RecordingFrequencyMs) AS 'Freq Moyenne (ms)'
FROM [DIRIS].[Devices] d
LEFT JOIN [DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId AND tm.Enabled = 1
WHERE d.Enabled = 1
GROUP BY d.DeviceId, d.Name
ORDER BY d.DeviceId;

PRINT '';
PRINT '';

-- ========================================
-- 3. DETAIL PAR TYPE DE SIGNAL
-- ========================================
PRINT '--- 3. DETAIL PAR TYPE DE SIGNAL ---';
PRINT '';

SELECT 
    CASE 
        WHEN Signal LIKE 'I_%' THEN 'Courants (I_*)'
        WHEN Signal LIKE 'PV%' THEN 'Tensions Phase (PV*)'
        WHEN Signal LIKE 'LV_%' THEN 'Tensions Ligne (LV_*)'
        WHEN Signal = 'F_255' THEN 'Fréquence (F_255)'
        WHEN Signal LIKE '%RP%' THEN 'Puissance Réactive (RP)'
        WHEN Signal LIKE '%IP%' THEN 'Puissance Apparente (IP)'
        WHEN Signal LIKE '%AP%' THEN 'Puissance Active (AP)'
        WHEN Signal LIKE 'THD_%' THEN 'THD'
        WHEN Signal LIKE 'E%_255' THEN 'Énergies (E*_255)'
        WHEN Signal LIKE 'AVG_%' THEN 'Moyennes (AVG_*)'
        WHEN Signal LIKE 'MAXAVG%' THEN 'Max Moyennes (MAXAVG*)'
        ELSE 'Autres'
    END AS 'Type de signal',
    COUNT(*) AS 'Nombre',
    MIN(RecordingFrequencyMs) AS 'Freq Min (ms)',
    MAX(RecordingFrequencyMs) AS 'Freq Max (ms)',
    AVG(RecordingFrequencyMs) AS 'Freq Moyenne (ms)',
    CASE 
        WHEN MIN(RecordingFrequencyMs) = MAX(RecordingFrequencyMs) THEN 'Homogène ✓'
        ELSE 'Hétérogène ⚠'
    END AS 'Statut'
FROM [DIRIS].[TagMap]
WHERE Enabled = 1
GROUP BY 
    CASE 
        WHEN Signal LIKE 'I_%' THEN 'Courants (I_*)'
        WHEN Signal LIKE 'PV%' THEN 'Tensions Phase (PV*)'
        WHEN Signal LIKE 'LV_%' THEN 'Tensions Ligne (LV_*)'
        WHEN Signal = 'F_255' THEN 'Fréquence (F_255)'
        WHEN Signal LIKE '%RP%' THEN 'Puissance Réactive (RP)'
        WHEN Signal LIKE '%IP%' THEN 'Puissance Apparente (IP)'
        WHEN Signal LIKE '%AP%' THEN 'Puissance Active (AP)'
        WHEN Signal LIKE 'THD_%' THEN 'THD'
        WHEN Signal LIKE 'E%_255' THEN 'Énergies (E*_255)'
        WHEN Signal LIKE 'AVG_%' THEN 'Moyennes (AVG_*)'
        WHEN Signal LIKE 'MAXAVG%' THEN 'Max Moyennes (MAXAVG*)'
        ELSE 'Autres'
    END
ORDER BY 'Freq Moyenne (ms)' ASC;

PRINT '';
PRINT '';

-- ========================================
-- 4. LISTE COMPLETE DES SIGNAUX AVEC FREQUENCES
-- ========================================
PRINT '--- 4. LISTE COMPLETE DES SIGNAUX (Top 50) ---';
PRINT '';

SELECT TOP 50
    d.Name AS 'Device',
    tm.Signal,
    tm.RecordingFrequencyMs AS 'Freq (ms)',
    CASE 
        WHEN tm.RecordingFrequencyMs = 1000 THEN '1s'
        WHEN tm.RecordingFrequencyMs = 2000 THEN '2s'
        WHEN tm.RecordingFrequencyMs = 5000 THEN '5s'
        WHEN tm.RecordingFrequencyMs = 10000 THEN '10s'
        WHEN tm.RecordingFrequencyMs = 30000 THEN '30s'
        WHEN tm.RecordingFrequencyMs = 60000 THEN '1min'
        WHEN tm.RecordingFrequencyMs = 300000 THEN '5min'
        WHEN tm.RecordingFrequencyMs = 600000 THEN '10min'
        ELSE CAST(tm.RecordingFrequencyMs AS VARCHAR) + 'ms'
    END AS 'Libellé',
    tm.Unit AS 'Unité',
    tm.Description
FROM [DIRIS].[TagMap] tm
INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
WHERE tm.Enabled = 1
ORDER BY tm.RecordingFrequencyMs ASC, d.Name, tm.Signal;

PRINT '';
PRINT '';

-- ========================================
-- 5. SIGNAUX AVEC FREQUENCES ANORMALES
-- ========================================
PRINT '--- 5. SIGNAUX AVEC FREQUENCES ANORMALES (si présents) ---';
PRINT '';

SELECT 
    d.Name AS 'Device',
    tm.Signal,
    tm.RecordingFrequencyMs AS 'Freq (ms)',
    'Fréquence non standard' AS 'Alerte'
FROM [DIRIS].[TagMap] tm
INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
WHERE tm.Enabled = 1
  AND tm.RecordingFrequencyMs NOT IN (1000, 2000, 5000, 10000, 30000, 60000, 300000, 600000)
ORDER BY tm.RecordingFrequencyMs, d.Name, tm.Signal;

IF @@ROWCOUNT = 0
BEGIN
    PRINT 'Aucun signal avec fréquence anormale détecté ✓';
END

PRINT '';
PRINT '';

-- ========================================
-- 6. PRESETS RECOMMANDES VS ACTUELS
-- ========================================
PRINT '--- 6. COMPARAISON PRESETS RECOMMANDES VS ACTUELS ---';
PRINT '';

WITH PresetComparison AS (
    SELECT 
        tm.DeviceId,
        d.Name AS DeviceName,
        tm.Signal,
        tm.RecordingFrequencyMs AS FrequenceActuelle,
        CASE 
            WHEN tm.Signal LIKE 'I_%' OR tm.Signal LIKE 'PV%' OR tm.Signal LIKE 'LV_%' OR tm.Signal = 'F_255' THEN 1000
            WHEN tm.Signal LIKE '%RP%' OR tm.Signal LIKE '%IP%' OR tm.Signal LIKE '%AP%' THEN 2000
            WHEN tm.Signal LIKE 'THD_%' THEN 5000
            WHEN tm.Signal LIKE 'E%' AND tm.Signal LIKE '%_255' THEN 30000
            WHEN tm.Signal LIKE 'AVG_%' OR tm.Signal LIKE 'MAXAVG%' THEN 10000
            ELSE 5000
        END AS FrequenceRecommandee
    FROM [DIRIS].[TagMap] tm
    INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
    WHERE tm.Enabled = 1
)
SELECT 
    DeviceName AS 'Device',
    Signal,
    FrequenceActuelle AS 'Actuelle (ms)',
    FrequenceRecommandee AS 'Recommandée (ms)',
    CASE 
        WHEN FrequenceActuelle = FrequenceRecommandee THEN '✓ OK'
        WHEN FrequenceActuelle < FrequenceRecommandee THEN '⚠ Plus rapide que recommandé'
        ELSE '⚠ Plus lent que recommandé'
    END AS 'Statut'
FROM PresetComparison
WHERE FrequenceActuelle <> FrequenceRecommandee
ORDER BY DeviceName, Signal;

IF @@ROWCOUNT = 0
BEGIN
    PRINT 'Toutes les fréquences correspondent aux presets recommandés ✓';
END

PRINT '';
PRINT '';

-- ========================================
-- 7. STATISTIQUES FINALES
-- ========================================
PRINT '--- 7. STATISTIQUES FINALES ---';
PRINT '';

DECLARE @TotalSignaux INT;
DECLARE @SignauxActifs INT;
DECLARE @SignauxInactifs INT;
DECLARE @FreqMin INT;
DECLARE @FreqMax INT;
DECLARE @FreqMoyenne INT;

SELECT 
    @TotalSignaux = COUNT(*),
    @SignauxActifs = SUM(CASE WHEN Enabled = 1 THEN 1 ELSE 0 END),
    @SignauxInactifs = SUM(CASE WHEN Enabled = 0 THEN 1 ELSE 0 END),
    @FreqMin = MIN(CASE WHEN Enabled = 1 THEN RecordingFrequencyMs ELSE NULL END),
    @FreqMax = MAX(CASE WHEN Enabled = 1 THEN RecordingFrequencyMs ELSE NULL END),
    @FreqMoyenne = AVG(CASE WHEN Enabled = 1 THEN RecordingFrequencyMs ELSE NULL END)
FROM [DIRIS].[TagMap];

PRINT 'Total signaux configurés : ' + CAST(@TotalSignaux AS VARCHAR);
PRINT 'Signaux actifs : ' + CAST(@SignauxActifs AS VARCHAR);
PRINT 'Signaux inactifs : ' + CAST(@SignauxInactifs AS VARCHAR);
PRINT 'Fréquence minimale : ' + CAST(@FreqMin AS VARCHAR) + ' ms';
PRINT 'Fréquence maximale : ' + CAST(@FreqMax AS VARCHAR) + ' ms';
PRINT 'Fréquence moyenne : ' + CAST(@FreqMoyenne AS VARCHAR) + ' ms';

PRINT '';
PRINT '========================================';
PRINT 'FIN DE LA VERIFICATION';
PRINT '========================================';
GO

