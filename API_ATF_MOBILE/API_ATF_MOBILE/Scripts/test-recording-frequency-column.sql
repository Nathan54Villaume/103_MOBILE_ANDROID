-- Test pour vérifier si la colonne RecordingFrequencyMs existe
USE [AI_ATR];
GO

-- Vérifier si la colonne existe
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'DIRIS' 
  AND TABLE_NAME = 'TagMap' 
  AND COLUMN_NAME = 'RecordingFrequencyMs';

-- Si la colonne existe, afficher quelques exemples
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'DIRIS' 
             AND TABLE_NAME = 'TagMap' 
             AND COLUMN_NAME = 'RecordingFrequencyMs')
BEGIN
    PRINT 'La colonne RecordingFrequencyMs existe. Voici quelques exemples:';
    
    SELECT TOP 10
        DeviceId,
        Signal,
        RecordingFrequencyMs,
        Enabled
    FROM [DIRIS].[TagMap]
    ORDER BY DeviceId, Signal;
END
ELSE
BEGIN
    PRINT 'ERREUR: La colonne RecordingFrequencyMs n''existe PAS dans la table [DIRIS].[TagMap]';
    PRINT 'Il faut exécuter le script add-recording-frequency-column.sql d''abord.';
END

GO
