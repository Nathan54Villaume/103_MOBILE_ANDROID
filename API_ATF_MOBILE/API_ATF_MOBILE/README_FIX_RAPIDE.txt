╔══════════════════════════════════════════════════════════════════════════════╗
║                   FIX ACQUISITION DIRIS - RÉSUMÉ RAPIDE                        ║
║                            Date: 2025-10-10                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│ PROBLÈME IDENTIFIÉ                                                            │
└──────────────────────────────────────────────────────────────────────────────┘

❌ L'acquisition DIRIS ne respecte PAS les paramètres RecordingFrequencyMs
❌ Beaucoup TROP de mesures enregistrées (60x trop dans certains cas!)
❌ Exemple: Signal configuré à 10 minutes → Enregistré toutes les 2 secondes

Cause: DEUX services d'acquisition actifs simultanément au lieu d'UN seul


┌──────────────────────────────────────────────────────────────────────────────┐
│ SOLUTION APPLIQUÉE                                                            │
└──────────────────────────────────────────────────────────────────────────────┘

✅ Service "DirisAcquisitionService" DÉSACTIVÉ dans Program.cs (ligne 59)
✅ Service "DirisSignalSchedulerService" CONSERVÉ (respecte les fréquences)


┌──────────────────────────────────────────────────────────────────────────────┐
│ ACTIONS À EFFECTUER (3 ÉTAPES)                                               │
└──────────────────────────────────────────────────────────────────────────────┘

1️⃣  REDÉPLOYER L'APPLICATION
    → cd R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE
    → dotnet publish -c Release -o bin\Publish
    → Redémarrer l'application/service

2️⃣  ATTENDRE 10-15 MINUTES
    → Laisser le système se stabiliser

3️⃣  VÉRIFIER QUE ÇA FONCTIONNE
    → Exécuter le script SQL:
      Scripts\VERIFICATION_POST_FIX_ACQUISITION.sql


┌──────────────────────────────────────────────────────────────────────────────┐
│ RÉSULTAT ATTENDU                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

✅ Fréquences d'acquisition respectées (écart < 5%)
✅ Volume de mesures conforme à la configuration
✅ Performance améliorée (CPU, RAM, Réseau, BDD)


┌──────────────────────────────────────────────────────────────────────────────┐
│ DOCUMENTATION COMPLÈTE                                                        │
└──────────────────────────────────────────────────────────────────────────────┘

📄 ACTIONS_A_EFFECTUER.md          → Checklist détaillée
📄 FIX_ACQUISITION_FREQUENCE.md    → Documentation complète du problème
📄 CHANGELOG_FIX_ACQUISITION.md    → Journal des modifications

Scripts SQL:
📊 Scripts\VERIFICATION_POST_FIX_ACQUISITION.sql    → Vérifier le fix
🧹 Scripts\NETTOYAGE_MESURES_DOUBLE.sql             → Nettoyer les données (optionnel)


┌──────────────────────────────────────────────────────────────────────────────┐
│ AIDE                                                                          │
└──────────────────────────────────────────────────────────────────────────────┘

En cas de problème:
1. Vérifier les logs: C:\API_ATF_MOBILE\DATA\logs\app-*.log
2. Consulter la documentation: FIX_ACQUISITION_FREQUENCE.md
3. Vérifier la configuration: appsettings.json


╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️  IMPORTANT: Le fix ne sera effectif qu'APRÈS le redéploiement! ⚠️        ║
╚══════════════════════════════════════════════════════════════════════════════╝

