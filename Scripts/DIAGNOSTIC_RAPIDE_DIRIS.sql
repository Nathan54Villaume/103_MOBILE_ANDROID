-- =====================================================
-- DIAGNOSTIC RAPIDE DIRIS - VÉRIFICATIONS ESSENTIELLES
-- =====================================================
-- Scripts de diagnostic rapide pour vérifier l'état du système DIRIS

-- =====================================================
-- 1. ÉTAT GÉNÉRAL DU SYSTÈME (30 secondes)
-- =====================================================

-- Vérification rapide de l'activité
SELECT 
    '🔍 DIAGNOSTIC RAPIDE DIRIS' as Info,
    GETDATE() as Timestamp;

-- Nombre de devices actifs vs inactifs
SELECT 
    'DEVICES' as Type,
    COUNT(CASE WHEN Enabled = 1 THEN 1 END) as Actifs,
    COUNT(CASE WHEN Enabled = 0 THEN 1 END) as Inactifs,
    COUNT(*) as Total
FROM [AI_ATR].[DIRIS].[Devices];

-- Signaux configurés vs activés
SELECT 
    'SIGNAUX' as Type,
    COUNT(CASE WHEN Enabled = 1 THEN 1 END) as Activés,
    COUNT(CASE WHEN Enabled = 0 THEN 1 END) as Désactivés,
    COUNT(*) as Total
FROM [AI_ATR].[DIRIS].[TagMap];

-- =====================================================
-- 2. ACTIVITÉ RÉCENTE (Dernières 2 heures)
-- =====================================================

-- Mesures reçues dans les dernières 2h par device
SELECT 
    d.Name as DeviceName,
    COUNT(*) as Mesures2h,
    COUNT(DISTINCT m.Signal) as SignauxActifs,
    MAX(m.UtcTs) as DerniereMesure,
    DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) as MinutesDepuisDerniere
FROM [AI_ATR].[DIRIS].[Devices] d
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId 
    AND m.UtcTs >= DATEADD(HOUR, -2, GETUTCDATE())
WHERE d.Enabled = 1
GROUP BY d.Name
ORDER BY Mesures2h DESC;

-- =====================================================
-- 3. SIGNAUX PROBLÉMATIQUES (Priorité haute)
-- =====================================================

-- Signaux configurés mais sans mesures récentes (dernières 30 minutes)
SELECT 
    d.Name as DeviceName,
    tm.Signal,
    tm.RecordingFrequencyMs as FreqAttendueMs,
    MAX(m.UtcTs) as DerniereMesure,
    CASE 
        WHEN MAX(m.UtcTs) IS NULL THEN '❌ JAMAIS MESURÉ'
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > 30 THEN '⚠️ PAS DE MESURE > 30MIN'
        ELSE '✅ OK'
    END as Status
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId 
    AND tm.Signal = m.Signal 
    AND m.UtcTs >= DATEADD(HOUR, -1, GETUTCDATE())
WHERE tm.Enabled = 1
GROUP BY d.Name, tm.Signal, tm.RecordingFrequencyMs
HAVING MAX(m.UtcTs) IS NULL OR DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > 30
ORDER BY d.Name, tm.Signal;

-- =====================================================
-- 4. VÉRIFICATION DES FRÉQUENCES ANORMALES
-- =====================================================

-- Signaux avec fréquences très rapides ou très lentes
SELECT 
    d.Name as DeviceName,
    tm.Signal,
    tm.RecordingFrequencyMs,
    tm.Description,
    CASE 
        WHEN tm.RecordingFrequencyMs < 500 THEN '🚨 TRÈS RAPIDE (< 0.5s)'
        WHEN tm.RecordingFrequencyMs < 1000 THEN '⚡ RAPIDE (< 1s)'
        WHEN tm.RecordingFrequencyMs > 300000 THEN '🐌 TRÈS LENT (> 5min)'
        WHEN tm.RecordingFrequencyMs > 60000 THEN '⏰ LENT (> 1min)'
        ELSE '✅ NORMAL'
    END as Categorie
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
WHERE tm.Enabled = 1
ORDER BY 
    CASE 
        WHEN tm.RecordingFrequencyMs < 500 THEN 1
        WHEN tm.RecordingFrequencyMs > 300000 THEN 2
        WHEN tm.RecordingFrequencyMs < 1000 THEN 3
        WHEN tm.RecordingFrequencyMs > 60000 THEN 4
        ELSE 5
    END,
    tm.RecordingFrequencyMs;

-- =====================================================
-- 5. QUALITÉ DES MESURES (Dernière heure)
-- =====================================================

-- Répartition de la qualité des mesures
SELECT 
    d.Name as DeviceName,
    COUNT(*) as TotalMesures,
    COUNT(CASE WHEN m.Quality = 0 THEN 1 END) as BonneQualite,
    COUNT(CASE WHEN m.Quality = 1 THEN 1 END) as QualiteIncertaine,
    COUNT(CASE WHEN m.Quality = 2 THEN 1 END) as MauvaiseQualite,
    ROUND(
        COUNT(CASE WHEN m.Quality = 0 THEN 1 END) * 100.0 / COUNT(*), 
        1
    ) as PourcentageBonneQualite
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[Measurements] m ON d.DeviceId = m.DeviceId
WHERE m.UtcTs >= DATEADD(HOUR, -1, GETUTCDATE())
GROUP BY d.Name
ORDER BY PourcentageBonneQualite ASC;

-- =====================================================
-- 6. RÉSUMÉ EXÉCUTIF (Pour le management)
-- =====================================================

SELECT 
    '📊 RÉSUMÉ EXÉCUTIF DIRIS' as Rapport,
    '' as Separateur;

-- Indicateurs clés
SELECT 
    'Devices Actifs' as Metrique,
    COUNT(*) as Valeur,
    'Devices configurés et activés' as Description
FROM [AI_ATR].[DIRIS].[Devices] 
WHERE Enabled = 1

UNION ALL

SELECT 
    'Signaux Configurés' as Metrique,
    COUNT(*) as Valeur,
    'Signaux avec fréquence définie' as Description
FROM [AI_ATR].[DIRIS].[TagMap] 
WHERE Enabled = 1

UNION ALL

SELECT 
    'Mesures/H (Dernière heure)' as Metrique,
    COUNT(*) as Valeur,
    'Volume de données reçues' as Description
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(HOUR, -1, GETUTCDATE())

UNION ALL

SELECT 
    'Signaux Inactifs' as Metrique,
    COUNT(*) as Valeur,
    'Signaux configurés mais sans mesures récentes' as Description
FROM [AI_ATR].[DIRIS].[TagMap] tm
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId 
    AND tm.Signal = m.Signal 
    AND m.UtcTs >= DATEADD(HOUR, -1, GETUTCDATE())
WHERE tm.Enabled = 1 AND m.UtcTs IS NULL

UNION ALL

SELECT 
    'Qualité Moyenne (%)' as Metrique,
    ROUND(
        AVG(CASE WHEN Quality = 0 THEN 100 WHEN Quality = 1 THEN 50 ELSE 0 END), 
        1
    ) as Valeur,
    'Pourcentage de qualité des mesures' as Description
FROM [AI_ATR].[DIRIS].[Measurements]
WHERE UtcTs >= DATEADD(HOUR, -1, GETUTCDATE());

-- =====================================================
-- 7. ALERTES PRIORITAIRES
-- =====================================================

-- Alertes critiques
SELECT 
    '🚨 ALERTES CRITIQUES' as Type,
    d.Name as DeviceName,
    tm.Signal as SignalProblematique,
    CASE 
        WHEN MAX(m.UtcTs) IS NULL THEN 'Signal configuré mais jamais mesuré'
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > 60 THEN 'Aucune mesure depuis plus d''1 heure'
        WHEN tm.RecordingFrequencyMs < 500 THEN 'Fréquence trop rapide (risque surcharge)'
        WHEN tm.RecordingFrequencyMs > 300000 THEN 'Fréquence très lente (données obsolètes)'
    END as Probleme,
    MAX(m.UtcTs) as DerniereMesure
FROM [AI_ATR].[DIRIS].[Devices] d
JOIN [AI_ATR].[DIRIS].[TagMap] tm ON d.DeviceId = tm.DeviceId
LEFT JOIN [AI_ATR].[DIRIS].[Measurements] m ON tm.DeviceId = m.DeviceId AND tm.Signal = m.Signal
WHERE tm.Enabled = 1
GROUP BY d.Name, tm.Signal, tm.RecordingFrequencyMs
HAVING MAX(m.UtcTs) IS NULL 
    OR DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > 60
    OR tm.RecordingFrequencyMs < 500
    OR tm.RecordingFrequencyMs > 300000
ORDER BY 
    CASE 
        WHEN MAX(m.UtcTs) IS NULL THEN 1
        WHEN DATEDIFF(MINUTE, MAX(m.UtcTs), GETUTCDATE()) > 60 THEN 2
        WHEN tm.RecordingFrequencyMs < 500 THEN 3
        WHEN tm.RecordingFrequencyMs > 300000 THEN 4
    END;
