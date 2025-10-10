-- =========================================================================
-- Script : NETTOYAGE_MESURES_DOUBLE.sql
-- Description : Nettoie les mesures enregistrées en double suite au bug
--               de double acquisition (DirisAcquisitionService + DirisSignalSchedulerService)
-- Date : 2025-10-10
-- =========================================================================
-- ⚠️ ATTENTION : Ce script supprime des données de manière IRREVERSIBLE !
-- ⚠️ Faites une SAUVEGARDE avant d'exécuter ce script en production !
-- =========================================================================

USE [AI_ATR];
GO

PRINT '========================================';
PRINT 'NETTOYAGE DES MESURES DIRIS EN DOUBLE';
PRINT 'Date : ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '========================================';
GO

-- =========================================================================
-- ETAPE 1 : ANALYSE DES DONNEES AVANT NETTOYAGE
-- =========================================================================
PRINT '';
PRINT '--- ETAPE 1 : ANALYSE AVANT NETTOYAGE ---';
GO

-- Compter le nombre total de mesures
DECLARE @TotalMeasurements INT;
SELECT @TotalMeasurements = COUNT(*)
FROM [DIRIS].[Measurements];
PRINT 'Total de mesures actuellement : ' + CAST(@TotalMeasurements AS VARCHAR);

-- Compter le nombre de mesures par device et signal
PRINT '';
PRINT 'Top 10 des signaux avec le plus de mesures :';
SELECT TOP 10
    d.Name AS Device,
    tm.Signal,
    COUNT(*) AS NbMesures,
    MIN(m.UtcTs) AS PremiereMesure,
    MAX(m.UtcTs) AS DerniereMesure,
    DATEDIFF(MINUTE, MIN(m.UtcTs), MAX(m.UtcTs)) AS DureeMinutes,
    tm.RecordingFrequencyMs AS FrequenceConfigMs,
    CASE 
        WHEN DATEDIFF(SECOND, MIN(m.UtcTs), MAX(m.UtcTs)) = 0 THEN 0
        ELSE CAST(COUNT(*) AS FLOAT) / (DATEDIFF(SECOND, MIN(m.UtcTs), MAX(m.UtcTs)) / 60.0)
    END AS MesuresParMinute
FROM [DIRIS].[Measurements] m
INNER JOIN [DIRIS].[TagMap] tm ON m.TagMapId = tm.TagMapId
INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
GROUP BY d.Name, tm.Signal, tm.RecordingFrequencyMs
ORDER BY COUNT(*) DESC;
GO

-- =========================================================================
-- ETAPE 2 : STRATEGIE DE NETTOYAGE
-- =========================================================================
PRINT '';
PRINT '--- ETAPE 2 : STRATEGIE DE NETTOYAGE ---';
PRINT 'Le script va conserver UNE mesure par intervalle de fréquence configuré';
PRINT 'et supprimer toutes les autres mesures "en trop".';
PRINT '';
PRINT 'Exemple : Si RecordingFrequencyMs = 2000ms (2 secondes)';
PRINT '  - On garde 1 mesure toutes les 2 secondes';
PRINT '  - Les mesures intermédiaires sont supprimées';
GO

-- =========================================================================
-- ETAPE 3 : IDENTIFICATION DES MESURES A SUPPRIMER
-- =========================================================================
PRINT '';
PRINT '--- ETAPE 3 : IDENTIFICATION DES MESURES A SUPPRIMER ---';
GO

-- Créer une table temporaire pour identifier les mesures à garder
IF OBJECT_ID('tempdb..#MeasurementsToKeep') IS NOT NULL
    DROP TABLE #MeasurementsToKeep;

-- Pour chaque TagMap, on va créer des "buckets" de temps basés sur RecordingFrequencyMs
-- et garder seulement la PREMIERE mesure de chaque bucket
;WITH RankedMeasurements AS (
    SELECT 
        m.MeasurementId,
        m.TagMapId,
        m.UtcTs,
        tm.RecordingFrequencyMs,
        -- Créer un "bucket" de temps basé sur la fréquence
        -- Exemple : RecordingFrequencyMs = 2000ms → buckets de 2 secondes
        DATEADD(
            MILLISECOND, 
            (DATEDIFF(MILLISECOND, '2000-01-01', m.UtcTs) / tm.RecordingFrequencyMs) * tm.RecordingFrequencyMs,
            '2000-01-01'
        ) AS TimeBucket,
        -- Numéro de ligne dans chaque bucket (1 = première mesure du bucket)
        ROW_NUMBER() OVER (
            PARTITION BY 
                m.TagMapId,
                DATEADD(
                    MILLISECOND, 
                    (DATEDIFF(MILLISECOND, '2000-01-01', m.UtcTs) / tm.RecordingFrequencyMs) * tm.RecordingFrequencyMs,
                    '2000-01-01'
                )
            ORDER BY m.UtcTs ASC
        ) AS RowNum
    FROM [DIRIS].[Measurements] m
    INNER JOIN [DIRIS].[TagMap] tm ON m.TagMapId = tm.TagMapId
    WHERE tm.RecordingFrequencyMs > 0 -- Éviter division par zéro
)
SELECT 
    MeasurementId,
    TagMapId,
    UtcTs,
    RecordingFrequencyMs,
    TimeBucket
INTO #MeasurementsToKeep
FROM RankedMeasurements
WHERE RowNum = 1; -- Garder seulement la première mesure de chaque bucket

-- Compter combien de mesures seront conservées vs supprimées
DECLARE @ToKeep INT, @ToDelete INT;
SELECT @ToKeep = COUNT(*) FROM #MeasurementsToKeep;
SELECT @ToDelete = COUNT(*) 
FROM [DIRIS].[Measurements] m
WHERE NOT EXISTS (
    SELECT 1 FROM #MeasurementsToKeep k 
    WHERE k.MeasurementId = m.MeasurementId
);

PRINT 'Mesures à CONSERVER : ' + CAST(@ToKeep AS VARCHAR) + ' (' + 
      CAST((@ToKeep * 100.0 / @TotalMeasurements) AS DECIMAL(5,2)) + '%)';
PRINT 'Mesures à SUPPRIMER : ' + CAST(@ToDelete AS VARCHAR) + ' (' + 
      CAST((@ToDelete * 100.0 / @TotalMeasurements) AS DECIMAL(5,2)) + '%)';
PRINT '';

-- =========================================================================
-- ETAPE 4 : CONFIRMATION UTILISATEUR
-- =========================================================================
PRINT '--- ETAPE 4 : CONFIRMATION ---';
PRINT '⚠️ ⚠️ ⚠️  ATTENTION  ⚠️ ⚠️ ⚠️';
PRINT 'Vous êtes sur le point de SUPPRIMER ' + CAST(@ToDelete AS VARCHAR) + ' mesures !';
PRINT 'Cette opération est IRREVERSIBLE !';
PRINT '';
PRINT 'Pour exécuter la suppression, décommentez la section ETAPE 5 ci-dessous.';
PRINT 'Assurez-vous d''avoir une SAUVEGARDE avant de continuer.';
GO

-- =========================================================================
-- ETAPE 5 : SUPPRESSION (DESACTIVE PAR DEFAUT)
-- =========================================================================
-- ⚠️ DECOMMENTEZ LES LIGNES SUIVANTES POUR EXECUTER LA SUPPRESSION ⚠️
/*
PRINT '';
PRINT '--- ETAPE 5 : SUPPRESSION EN COURS ---';
GO

BEGIN TRANSACTION;

DECLARE @DeletedCount INT;
DECLARE @BatchSize INT = 10000; -- Supprimer par lots de 10000 pour éviter de bloquer la base
DECLARE @TotalDeleted INT = 0;

PRINT 'Suppression en cours par lots de ' + CAST(@BatchSize AS VARCHAR) + '...';

WHILE 1 = 1
BEGIN
    -- Supprimer un lot de mesures
    DELETE TOP (@BatchSize)
    FROM [DIRIS].[Measurements]
    WHERE MeasurementId NOT IN (
        SELECT MeasurementId FROM #MeasurementsToKeep
    );
    
    SET @DeletedCount = @@ROWCOUNT;
    SET @TotalDeleted = @TotalDeleted + @DeletedCount;
    
    PRINT 'Lot supprimé : ' + CAST(@DeletedCount AS VARCHAR) + ' mesures (Total : ' + CAST(@TotalDeleted AS VARCHAR) + ')';
    
    -- Si plus rien à supprimer, sortir de la boucle
    IF @DeletedCount = 0
        BREAK;
    
    -- Petite pause pour éviter de surcharger la base
    WAITFOR DELAY '00:00:01';
END;

PRINT '';
PRINT 'Suppression terminée. Total supprimé : ' + CAST(@TotalDeleted AS VARCHAR) + ' mesures';

-- Si tout s'est bien passé, COMMIT
COMMIT TRANSACTION;
PRINT 'Transaction validée (COMMIT).';

-- Nettoyer la table temporaire
DROP TABLE #MeasurementsToKeep;

GO
*/

-- =========================================================================
-- ETAPE 6 : VERIFICATION APRES NETTOYAGE (si exécuté)
-- =========================================================================
/*
PRINT '';
PRINT '--- ETAPE 6 : VERIFICATION APRES NETTOYAGE ---';
GO

-- Recompter le nombre total de mesures
DECLARE @NewTotalMeasurements INT;
SELECT @NewTotalMeasurements = COUNT(*)
FROM [DIRIS].[Measurements];
PRINT 'Nouveau total de mesures : ' + CAST(@NewTotalMeasurements AS VARCHAR);
PRINT 'Différence : ' + CAST((@TotalMeasurements - @NewTotalMeasurements) AS VARCHAR) + ' mesures supprimées';

-- Vérifier les fréquences après nettoyage
PRINT '';
PRINT 'Vérification des fréquences après nettoyage :';
SELECT TOP 10
    d.Name AS Device,
    tm.Signal,
    COUNT(*) AS NbMesures,
    MIN(m.UtcTs) AS PremiereMesure,
    MAX(m.UtcTs) AS DerniereMesure,
    DATEDIFF(MINUTE, MIN(m.UtcTs), MAX(m.UtcTs)) AS DureeMinutes,
    tm.RecordingFrequencyMs AS FrequenceConfigMs,
    -- Calculer l'écart moyen entre mesures
    CASE 
        WHEN COUNT(*) <= 1 THEN 0
        ELSE DATEDIFF(MILLISECOND, MIN(m.UtcTs), MAX(m.UtcTs)) / (COUNT(*) - 1)
    END AS EcartMoyenMs,
    -- Calculer l'écart par rapport à la fréquence configurée
    CASE 
        WHEN COUNT(*) <= 1 OR tm.RecordingFrequencyMs = 0 THEN 0
        ELSE ABS((DATEDIFF(MILLISECOND, MIN(m.UtcTs), MAX(m.UtcTs)) / (COUNT(*) - 1)) - tm.RecordingFrequencyMs) * 100.0 / tm.RecordingFrequencyMs
    END AS EcartPourcent
FROM [DIRIS].[Measurements] m
INNER JOIN [DIRIS].[TagMap] tm ON m.TagMapId = tm.TagMapId
INNER JOIN [DIRIS].[Devices] d ON tm.DeviceId = d.DeviceId
GROUP BY d.Name, tm.Signal, tm.RecordingFrequencyMs
ORDER BY COUNT(*) DESC;
GO
*/

-- =========================================================================
-- FIN DU SCRIPT
-- =========================================================================
PRINT '';
PRINT '========================================';
PRINT 'SCRIPT TERMINE';
PRINT 'Date : ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '========================================';
PRINT '';
PRINT '⚠️ Si vous n''avez pas décommenté l''ETAPE 5, aucune donnée n''a été supprimée.';
PRINT '⚠️ Pour effectuer le nettoyage, décommentez les sections ETAPE 5 et ETAPE 6.';
GO

