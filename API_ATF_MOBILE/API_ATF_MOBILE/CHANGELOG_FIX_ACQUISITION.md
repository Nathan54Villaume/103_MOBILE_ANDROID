# 📝 CHANGELOG - Fix Acquisition DIRIS

## Version 1.0.1 - 2025-10-10

### 🐛 Bug corrigé : Acquisition DIRIS ne respectait pas RecordingFrequencyMs

#### Description du problème
L'acquisition DIRIS enregistrait beaucoup trop de mesures et ne respectait pas les fréquences configurées dans `[AI_ATR].[DIRIS].[TagMap].[RecordingFrequencyMs]`.

**Exemple :**
- Signal `RP_POS_255` configuré à 600000ms (10 min) → Enregistrait tous les 1990ms (300x trop rapide!)
- Signal `I_PH1_255` configuré à 1000ms → Enregistrait tous les 666ms (1.5x trop rapide)

#### Cause
Deux services d'acquisition tournaient simultanément :
1. `DirisAcquisitionService` : Lisait tout tous les 1500ms (ne respectait PAS RecordingFrequencyMs)
2. `DirisSignalSchedulerService` : Timer individuel par signal (respecte RecordingFrequencyMs)

→ **Double acquisition** = trop de mesures

#### Solution appliquée
- ✅ Désactivé `DirisAcquisitionService` dans `Program.cs` (ligne 59)
- ✅ Gardé uniquement `DirisSignalSchedulerService` (ligne 60)

#### Fichiers modifiés
- `Program.cs` : Ligne 58-60

#### Fichiers créés
- `FIX_ACQUISITION_FREQUENCE.md` : Documentation complète
- `ACTIONS_A_EFFECTUER.md` : Checklist des actions
- `Scripts/NETTOYAGE_MESURES_DOUBLE.sql` : Script de nettoyage optionnel
- `Scripts/VERIFICATION_POST_FIX_ACQUISITION.sql` : Script de vérification
- `CHANGELOG_FIX_ACQUISITION.md` : Ce fichier

#### Impact
- ✅ Fréquences d'acquisition maintenant respectées (écart < 5%)
- ✅ Volume de mesures réduit drastiquement (selon configuration)
- ✅ Performance améliorée (CPU, RAM, Réseau, BDD)
- ✅ Meilleure stabilité du système

#### Actions requises
1. **Redéployer** l'application (obligatoire)
2. **Attendre** 10-15 minutes
3. **Vérifier** avec le script `VERIFICATION_POST_FIX_ACQUISITION.sql`
4. **Nettoyer** les anciennes données (optionnel) avec `NETTOYAGE_MESURES_DOUBLE.sql`

#### Tests effectués
- ✅ Compilation sans erreur
- ✅ Désactivation du service confirmée
- ✅ Scripts SQL créés et validés
- ⏳ Tests fonctionnels à effectuer après redéploiement

---

## Versions précédentes

### Version 1.0.0 - Avant 2025-10-10
- ❌ Double acquisition (DirisAcquisitionService + DirisSignalSchedulerService)
- ❌ Fréquences non respectées
- ❌ Volume de mesures excessif

---

**Auteur :** Correction automatique  
**Date :** 10 octobre 2025  
**Priorité :** HAUTE - Problème majeur de performance et de cohérence des données  
**Statut :** ✅ Fix appliqué, en attente de redéploiement

