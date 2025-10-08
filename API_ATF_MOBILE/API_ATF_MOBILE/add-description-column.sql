-- ========================================
-- Script SQL pour ajouter la colonne Description
-- et mettre à jour les descriptions des signaux DIRIS
-- ========================================

USE [AI_ATR]
GO

-- 1. Ajouter la colonne Description si elle n'existe pas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('DIRIS.TagMap') AND name = 'Description')
BEGIN
    ALTER TABLE [DIRIS].[TagMap] 
    ADD [Description] NVARCHAR(255) NULL;
    
    PRINT 'Colonne Description ajoutée à la table DIRIS.TagMap';
END
ELSE
BEGIN
    PRINT 'Colonne Description existe déjà dans la table DIRIS.TagMap';
END
GO

-- 2. Mettre à jour les descriptions pour tous les signaux existants
-- ========== COURANTS (A) ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 1' WHERE [Signal] = 'I_PH1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 2' WHERE [Signal] = 'I_PH2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 3' WHERE [Signal] = 'I_PH3_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant neutre' WHERE [Signal] = 'I_NUL_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 1 - Maximum moyenne' WHERE [Signal] = 'MAXAVGSUM_I1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 2 - Maximum moyenne' WHERE [Signal] = 'MAXAVGSUM_I2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 3 - Maximum moyenne' WHERE [Signal] = 'MAXAVGSUM_I3_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant neutre - Maximum moyenne' WHERE [Signal] = 'MAXAVG_IN_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 1 - Moyenne' WHERE [Signal] = 'AVG_I1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 2 - Moyenne' WHERE [Signal] = 'AVG_I2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant phase 3 - Moyenne' WHERE [Signal] = 'AVG_I3_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Courant neutre - Moyenne' WHERE [Signal] = 'AVG_IN_255';

-- ========== THD COURANTS ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD courant phase 1' WHERE [Signal] = 'THD_I1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD courant phase 2' WHERE [Signal] = 'THD_I2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD courant phase 3' WHERE [Signal] = 'THD_I3_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD courant neutre' WHERE [Signal] = 'THD_IN_255';

-- ========== FRÉQUENCE ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Fréquence réseau' WHERE [Signal] = 'F_255';

-- ========== THD TENSIONS ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD tension phase 1' WHERE [Signal] = 'THD_U1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD tension phase 2' WHERE [Signal] = 'THD_U2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD tension phase 3' WHERE [Signal] = 'THD_U3_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD tension phase-phase 12' WHERE [Signal] = 'THD_U12_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD tension phase-phase 23' WHERE [Signal] = 'THD_U23_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'THD tension phase-phase 31' WHERE [Signal] = 'THD_U31_255';

-- ========== TENSIONS PHASE-NEUTRE ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 1 - neutre' WHERE [Signal] = 'PV1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 2 - neutre' WHERE [Signal] = 'PV2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 3 - neutre' WHERE [Signal] = 'PV3_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 1 - Maximum moyenne' WHERE [Signal] = 'MAXAVG_V1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 2 - Maximum moyenne' WHERE [Signal] = 'MAXAVG_V2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 3 - Maximum moyenne' WHERE [Signal] = 'MAXAVG_V3_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 1 - Moyenne' WHERE [Signal] = 'AVG_V1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 2 - Moyenne' WHERE [Signal] = 'AVG_V2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase 3 - Moyenne' WHERE [Signal] = 'AVG_V3_255';

-- ========== TENSIONS PHASE-PHASE ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 12' WHERE [Signal] = 'LV_U12_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 23' WHERE [Signal] = 'LV_U23_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 31' WHERE [Signal] = 'LV_U31_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 12 - Maximum moyenne' WHERE [Signal] = 'MAXAVG_U12_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 23 - Maximum moyenne' WHERE [Signal] = 'MAXAVG_U23_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 31 - Maximum moyenne' WHERE [Signal] = 'MAXAVG_U31_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 12 - Moyenne' WHERE [Signal] = 'AVG_U12_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 23 - Moyenne' WHERE [Signal] = 'AVG_U23_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Tension phase-phase 31 - Moyenne' WHERE [Signal] = 'AVG_U31_255';

-- ========== PUISSANCES ACTIVES (kW) ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active phase 1' WHERE [Signal] = 'PH1_RP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active phase 2' WHERE [Signal] = 'PH2_RP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active phase 3' WHERE [Signal] = 'PH3_RP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active totale' WHERE [Signal] = 'SUM_RP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active positive - Maximum moyenne' WHERE [Signal] = 'MAXAVGSUM_RPPOS_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active positive - Moyenne' WHERE [Signal] = 'AVGSUM_RPPOS_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active prédictive' WHERE [Signal] = 'PRED_RP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active négative - Maximum moyenne' WHERE [Signal] = 'MAXAVGSUM_RPNEG_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active négative - Moyenne' WHERE [Signal] = 'AVGSUM_RPNEG_255';

-- ========== PUISSANCES RÉACTIVES (kVAR) ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive phase 1' WHERE [Signal] = 'PH1_IP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive phase 2' WHERE [Signal] = 'PH2_IP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive phase 3' WHERE [Signal] = 'PH3_IP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive totale' WHERE [Signal] = 'SUM_IP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive positive - Maximum moyenne' WHERE [Signal] = 'MAXAVGSUM_IPPOS_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive positive - Moyenne' WHERE [Signal] = 'AVGSUM_IPPOS_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive prédictive' WHERE [Signal] = 'PRED_IP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive négative - Maximum moyenne' WHERE [Signal] = 'MAXAVGSUM_IPNEG_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive négative - Moyenne' WHERE [Signal] = 'AVGSUM_IPNEG_255';

-- ========== PUISSANCES APPARENTES (kVA) ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance apparente phase 1' WHERE [Signal] = 'PH1_AP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance apparente phase 2' WHERE [Signal] = 'PH2_AP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance apparente phase 3' WHERE [Signal] = 'PH3_AP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance apparente totale' WHERE [Signal] = 'SUM_AP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance apparente - Maximum moyenne' WHERE [Signal] = 'MAXAVGSUM_AP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance apparente - Moyenne' WHERE [Signal] = 'AVGSUM_AP_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance apparente prédictive' WHERE [Signal] = 'PRED_AP_255';

-- ========== FACTEURS DE PUISSANCE (%) ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Facteur de puissance phase 1' WHERE [Signal] = 'PH1_PF_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Facteur de puissance phase 2' WHERE [Signal] = 'PH2_PF_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Facteur de puissance phase 3' WHERE [Signal] = 'PH3_PF_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Facteur de puissance total' WHERE [Signal] = 'SUM_PF_255';

-- ========== ÉNERGIES (kWh) ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Énergie compteur 1' WHERE [Signal] = 'E1_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Énergie compteur 2' WHERE [Signal] = 'E2_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Énergie compteur 3' WHERE [Signal] = 'E3_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Énergie compteur 4' WHERE [Signal] = 'E4_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Énergie compteur 5' WHERE [Signal] = 'E5_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Énergie compteur 6' WHERE [Signal] = 'E6_255';

-- ========== TOTAUX CUMULATIFS ==========
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active positive cumulée' WHERE [Signal] = 'RP_POS_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance active négative cumulée' WHERE [Signal] = 'RP_NEG_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive positive cumulée' WHERE [Signal] = 'IP_POS_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance réactive négative cumulée' WHERE [Signal] = 'IP_NEG_255';
UPDATE [DIRIS].[TagMap] SET [Description] = 'Puissance apparente cumulée' WHERE [Signal] = 'AP_255';

-- 3. Vérification des mises à jour
PRINT 'Mise à jour des descriptions terminée';
PRINT 'Nombre de signaux avec descriptions: ' + CAST((SELECT COUNT(*) FROM [DIRIS].[TagMap] WHERE [Description] IS NOT NULL) AS NVARCHAR(10));
PRINT 'Nombre total de signaux: ' + CAST((SELECT COUNT(*) FROM [DIRIS].[TagMap]) AS NVARCHAR(10));

-- 4. Afficher un échantillon des descriptions ajoutées
SELECT TOP 10 
    [Signal], 
    [Description], 
    [Unit], 
    [Scale], 
    [Enabled]
FROM [DIRIS].[TagMap] 
WHERE [Description] IS NOT NULL
ORDER BY [Signal];

GO
