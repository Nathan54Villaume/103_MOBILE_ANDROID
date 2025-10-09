-- ========================================
-- CORRECTION DES FREQUENCES DES SIGNAUX AP (Puissance Apparente)
-- ========================================
-- Ce script corrige les 4 signaux AP_255 qui sont à 1000ms au lieu de 2000ms
-- Exécution: sqlcmd -S "10.250.13.4" -d "AI_ATR" -i "fix-ap-frequencies.sql"

USE [AI_ATR];
GO

PRINT '========================================';
PRINT 'CORRECTION DES FREQUENCES AP (Puissance Apparente)';
PRINT '========================================';
PRINT '';

-- ========================================
-- 1. AFFICHER L'ETAT ACTUEL
-- ========================================
PRINT '--- 1. ETAT ACTUEL DES SIGNAUX AP_255 ---';
PRINT '';

SELECT 
    d.Name AS 'Device',
    tm.Signal,
    tm.RecordingFrequencyMs AS 'Freq Actuelle (ms)',
    2000 AS 'Freq Recommandee (ms)',
    CASE 
        WHEN tm.RecordingFrequencyMs = 2000 THEN 'OK ✓'
        ELSE 'A CORRIGER ⚠'
    END AS 'Statut'
FROM [DIRIS].[TagMap] tm
INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
WHERE tm.Signal = 'AP_255'
  AND tm.Enabled = 1
ORDER BY d.Name;

PRINT '';
PRINT '';

-- ========================================
-- 2. CORRECTION DES FREQUENCES
-- ========================================
PRINT '--- 2. CORRECTION EN COURS... ---';
PRINT '';

-- Correction pour ATR_TR2
UPDATE [DIRIS].[TagMap]
SET RecordingFrequencyMs = 2000
WHERE DeviceId = 2 
  AND Signal = 'AP_255'
  AND RecordingFrequencyMs <> 2000;

IF @@ROWCOUNT > 0
    PRINT '[SUCCESS] ATR_TR2.AP_255 : 1000ms → 2000ms ✓';
ELSE
    PRINT '[INFO] ATR_TR2.AP_255 : Deja a 2000ms';

-- Correction pour ATS - TR1
UPDATE [DIRIS].[TagMap]
SET RecordingFrequencyMs = 2000
WHERE DeviceId = 10 
  AND Signal = 'AP_255'
  AND RecordingFrequencyMs <> 2000;

IF @@ROWCOUNT > 0
    PRINT '[SUCCESS] ATS - TR1.AP_255 : 1000ms → 2000ms ✓';
ELSE
    PRINT '[INFO] ATS - TR1.AP_255 : Deja a 2000ms';

-- Correction pour ATS - TR3
UPDATE [DIRIS].[TagMap]
SET RecordingFrequencyMs = 2000
WHERE DeviceId = 12 
  AND Signal = 'AP_255'
  AND RecordingFrequencyMs <> 2000;

IF @@ROWCOUNT > 0
    PRINT '[SUCCESS] ATS - TR3.AP_255 : 1000ms → 2000ms ✓';
ELSE
    PRINT '[INFO] ATS - TR3.AP_255 : Deja a 2000ms';

-- Correction pour ATS - TR4
UPDATE [DIRIS].[TagMap]
SET RecordingFrequencyMs = 2000
WHERE DeviceId = 13 
  AND Signal = 'AP_255'
  AND RecordingFrequencyMs <> 2000;

IF @@ROWCOUNT > 0
    PRINT '[SUCCESS] ATS - TR4.AP_255 : 1000ms → 2000ms ✓';
ELSE
    PRINT '[INFO] ATS - TR4.AP_255 : Deja a 2000ms';

PRINT '';
PRINT '';

-- ========================================
-- 3. VERIFICATION APRES CORRECTION
-- ========================================
PRINT '--- 3. VERIFICATION APRES CORRECTION ---';
PRINT '';

SELECT 
    d.Name AS 'Device',
    tm.Signal,
    tm.RecordingFrequencyMs AS 'Freq Actuelle (ms)',
    2000 AS 'Freq Recommandee (ms)',
    CASE 
        WHEN tm.RecordingFrequencyMs = 2000 THEN 'OK ✓'
        ELSE 'ERREUR ✗'
    END AS 'Statut'
FROM [DIRIS].[TagMap] tm
INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
WHERE tm.Signal = 'AP_255'
  AND tm.Enabled = 1
ORDER BY d.Name;

PRINT '';
PRINT '';

-- ========================================
-- 4. RESUME FINAL
-- ========================================
PRINT '--- 4. RESUME FINAL ---';
PRINT '';

DECLARE @TotalAP INT;
DECLARE @APCorrects INT;
DECLARE @APIncorrects INT;

SELECT 
    @TotalAP = COUNT(*),
    @APCorrects = SUM(CASE WHEN RecordingFrequencyMs = 2000 THEN 1 ELSE 0 END),
    @APIncorrects = SUM(CASE WHEN RecordingFrequencyMs <> 2000 THEN 1 ELSE 0 END)
FROM [DIRIS].[TagMap]
WHERE Signal = 'AP_255'
  AND Enabled = 1;

PRINT 'Total signaux AP_255 actifs : ' + CAST(@TotalAP AS VARCHAR);
PRINT 'Signaux a 2000ms (correct) : ' + CAST(@APCorrects AS VARCHAR);
PRINT 'Signaux incorrects : ' + CAST(@APIncorrects AS VARCHAR);

IF @APIncorrects = 0
BEGIN
    PRINT '';
    PRINT '========================================';
    PRINT 'CORRECTION TERMINEE AVEC SUCCES ! ✓';
    PRINT 'Tous les signaux AP_255 sont maintenant a 2000ms';
    PRINT '========================================';
END
ELSE
BEGIN
    PRINT '';
    PRINT '========================================';
    PRINT 'ATTENTION : Des signaux sont encore incorrects !';
    PRINT 'Verifiez manuellement les signaux ci-dessus';
    PRINT '========================================';
END

PRINT '';
GO

