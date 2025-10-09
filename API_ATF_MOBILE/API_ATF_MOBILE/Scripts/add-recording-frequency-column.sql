-- Script pour ajouter la colonne RecordingFrequencyMs à la table DIRIS.TagMap
-- Cette colonne permettra de définir la fréquence d'enregistrement individuelle pour chaque signal

USE [AI_ATR];
GO

-- Vérifier si la colonne existe déjà
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[DIRIS].[TagMap]') 
    AND name = 'RecordingFrequencyMs'
)
BEGIN
    PRINT 'Ajout de la colonne RecordingFrequencyMs à la table DIRIS.TagMap...';
    
    -- Ajouter la colonne avec une valeur par défaut de 1000ms (1 seconde)
    ALTER TABLE [DIRIS].[TagMap]
    ADD RecordingFrequencyMs INT NOT NULL DEFAULT 1000;
    
    PRINT 'Colonne RecordingFrequencyMs ajoutée avec succès.';
    PRINT 'Valeur par défaut: 1000ms (1 seconde)';
    
    -- Ajouter une contrainte de validation (entre 1000ms et 600000ms)
    ALTER TABLE [DIRIS].[TagMap]
    ADD CONSTRAINT CK_TagMap_RecordingFrequencyMs 
    CHECK (RecordingFrequencyMs >= 1000 AND RecordingFrequencyMs <= 600000);
    
    PRINT 'Contrainte de validation ajoutée: entre 1s et 10min';
    
    -- Mettre à jour les valeurs existantes avec des fréquences par défaut selon le type de signal
    PRINT 'Mise à jour des fréquences par défaut selon le type de signal...';
    
    -- Signaux critiques (courants, tensions) : 1 seconde
    UPDATE [DIRIS].[TagMap] 
    SET RecordingFrequencyMs = 1000 
    WHERE Signal LIKE 'I_%' OR Signal LIKE 'PV%' OR Signal LIKE 'LV_%' OR Signal LIKE 'F_255';
    
    -- Signaux de puissance : 2 secondes
    UPDATE [DIRIS].[TagMap] 
    SET RecordingFrequencyMs = 2000 
    WHERE Signal LIKE '%RP%' OR Signal LIKE '%IP%' OR Signal LIKE '%AP%';
    
    -- Signaux THD : 5 secondes
    UPDATE [DIRIS].[TagMap] 
    SET RecordingFrequencyMs = 5000 
    WHERE Signal LIKE 'THD_%';
    
    -- Signaux d'énergie (compteurs) : 30 secondes
    UPDATE [DIRIS].[TagMap] 
    SET RecordingFrequencyMs = 30000 
    WHERE Signal LIKE 'E%_255';
    
    -- Signaux de moyennes/maximums : 10 secondes
    UPDATE [DIRIS].[TagMap] 
    SET RecordingFrequencyMs = 10000 
    WHERE Signal LIKE 'AVG_%' OR Signal LIKE 'MAXAVG%';
    
    PRINT 'Fréquences par défaut appliquées selon le type de signal.';
    
    -- Afficher un résumé
    SELECT 
        RecordingFrequencyMs / 1000.0 as FrequencySeconds,
        COUNT(*) as SignalCount,
        CASE 
            WHEN RecordingFrequencyMs = 1000 THEN 'Critiques (courants, tensions, fréquence)'
            WHEN RecordingFrequencyMs = 2000 THEN 'Puissances'
            WHEN RecordingFrequencyMs = 5000 THEN 'THD'
            WHEN RecordingFrequencyMs = 10000 THEN 'Moyennes/Maximums'
            WHEN RecordingFrequencyMs = 30000 THEN 'Énergies (compteurs)'
            ELSE 'Autres'
        END as SignalType
    FROM [DIRIS].[TagMap]
    GROUP BY RecordingFrequencyMs
    ORDER BY RecordingFrequencyMs;
    
END
ELSE
BEGIN
    PRINT 'La colonne RecordingFrequencyMs existe déjà dans la table DIRIS.TagMap.';
END

GO

-- Vérifier la structure de la table après modification
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'DIRIS' 
  AND TABLE_NAME = 'TagMap'
ORDER BY ORDINAL_POSITION;

PRINT 'Script terminé avec succès.';
