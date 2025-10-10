# 🚀 Actions à effectuer pour corriger le problème d'acquisition DIRIS

## ✅ Ce qui a été fait

Le problème a été **identifié et corrigé** dans le code :

### Fix 1 : Problème d'acquisition (respect des fréquences)
- **Problème :** Double acquisition → trop de mesures
- **Solution :** Désactivation de `DirisAcquisitionService` qui ne respectait pas les fréquences

### Fix 2 : Problème d'affichage des métriques
- **Problème :** Métriques d'affichage ne fonctionnaient plus
- **Solution :** Ajout des appels aux métriques manquants dans `DirisSignalSchedulerService`

### Fix 3 : Fonctionnalités manquantes de l'interface admin (NOUVEAU)
- **Problème :** Boutons de cohérence, alertes, et autres fonctionnalités ne fonctionnaient plus
- **Solution :** Création d'un service unifié qui combine le meilleur des deux services
- **Fichier créé :** `Services/DirisUnifiedAcquisitionService.cs`
- **Fichier modifié :** `Program.cs` (ligne 59) - Utilise le nouveau service unifié
- **Résultat :** Toutes les fonctionnalités restaurées + acquisition correcte

---

## 📋 Étapes à suivre

### 1️⃣ **Redéployer l'application** (OBLIGATOIRE)

Pour que le changement prenne effet, il faut redéployer l'API :

```powershell
# Se placer dans le répertoire du projet
cd R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE

# Compiler en mode Release
dotnet publish -c Release -o bin\Publish

# Puis copier les fichiers publiés vers le serveur de production
# OU redémarrer le service Windows si c'est un service
```

**Important :** L'application doit être **redémarrée** pour que le changement soit actif.

**Vérification du redéploiement :**
```powershell
# Vérifier que le service a bien redémarré
Get-Process | Where-Object {$_.Name -like "*API_ATF*"}

# Ou si c'est un service Windows
Get-Service | Where-Object {$_.Name -like "*ATF*"}
```

---

### 1️⃣.5 **Vérifier que les services DIRIS sont bien configurés** (VERIFICATION)

Après redéploiement, vérifiez que seul le bon service est actif :

**Dans les logs :**
```
C:\API_ATF_MOBILE\DATA\logs\app-YYYYMMDD.log
```

**Logs attendus :**
```
[INFO] DIRIS Signal Scheduler service STARTED
[INFO] Using individual timers for each signal
```

**Logs à NE PAS voir :**
```
[INFO] DIRIS Acquisition service STARTED  ← Ne doit plus apparaître
```

---

### 2️⃣ **Attendre 10-15 minutes** (IMPORTANT)

Après le redéploiement, laissez le système tourner 10-15 minutes pour :
- Permettre au nouveau service de démarrer
- Accumuler suffisamment de mesures pour l'analyse
- Stabiliser les fréquences d'acquisition

---

### 3️⃣ **Vérifier que le fix fonctionne** (VERIFICATION)

Exécutez le script de vérification :

```sql
-- Ouvrir SQL Server Management Studio (SSMS)
-- Connecter à votre instance SQL Server
-- Ouvrir le fichier :
R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE\Scripts\VERIFICATION_POST_FIX_ACQUISITION.sql

-- Exécuter le script (F5)
```

**Résultats attendus :**
- ✅ TEST 1 : Mesures récentes présentes
- ✅ TEST 2 : Fréquences conformes (écart < 5%)
- ✅ TEST 3 : Aucun signal trop rapide
- ✅ TEST 4 : Taux d'acquisition conforme
- ✅ TEST 5 : Tous les devices actifs

Si tous les tests passent → **Le fix fonctionne correctement** ✅

---

### 3️⃣.5 **Vérifier l'affichage des métriques** (VERIFICATION AFFICHAGE)

Après le redéploiement, vérifiez dans l'interface d'administration que les métriques s'affichent correctement :

**Interface web :**
```
http://10.250.13.4:8088/admin/index.html
→ Section "DIRIS" → Onglet "Vue d'ensemble"
```

**Métriques à vérifier :**
- ✅ **"Devices actifs"** : Doit afficher le nombre réel de devices (ex: 1, 2, etc.)
- ✅ **"Devices/seconde"** : Doit afficher une valeur > 0.00
- ✅ **"Points/seconde"** : Doit afficher une valeur > 0
- ✅ **"Latence P95"** : Doit afficher une valeur calculée

**Si les métriques affichent encore 0 :**
- Attendre 5-10 minutes supplémentaires
- Vérifier les logs pour des erreurs
- Redémarrer l'application si nécessaire

---

### 3️⃣.6 **Tester les fonctionnalités de l'interface admin** (VERIFICATION FONCTIONNALITES)

Après redéploiement, testez que toutes les fonctionnalités de l'interface admin fonctionnent :

**Interface web :**
```
http://10.250.13.4:8088/admin/index.html
→ Section "DIRIS"
```

**Fonctionnalités à tester :**

1. **Onglet "Cohérence" :**
   - ✅ Bouton "🔄 Réinitialiser" → Doit fonctionner
   - ✅ Bouton "🗑️ Vider données" → Doit fonctionner  
   - ✅ Bouton "🔄 Actualiser" → Doit fonctionner
   - ✅ Bouton "🗑️ Vider l'affichage" → Doit fonctionner

2. **Onglet "Configuration" :**
   - ✅ Bouton "🔄 Reset" → Doit fonctionner
   - ✅ Bouton "💾 Sauvegarder" → Doit fonctionner

3. **Onglet "Devices" :**
   - ✅ Bouton "⚙️ Configurer presets" → Doit fonctionner
   - ✅ Bouton "➕ Ajouter" → Doit fonctionner

4. **Onglet "Historique" :**
   - ✅ Bouton "📊 Export CSV" → Doit fonctionner
   - ✅ Bouton "📄 Export JSON" → Doit fonctionner
   - ✅ Bouton "🗑️ Vider" → Doit fonctionner

5. **Section "Système d'alertes" :**
   - ✅ Bouton "🗑️ Vider" → Doit fonctionner
   - ✅ Checkbox "Alertes actives" → Doit fonctionner

**Si des boutons ne fonctionnent pas :**
- Vérifier les logs pour des erreurs
- Redémarrer l'application
- Consulter `FIX_UNIFIED_SERVICE.md` pour plus de détails

---

### 4️⃣ **Nettoyer les données en double** (OPTIONNEL)

Si vous souhaitez supprimer les mesures enregistrées en trop avant le fix :

⚠️ **ATTENTION : Cette étape supprime des données de manière IRREVERSIBLE !**

```sql
-- 1. FAIRE UNE SAUVEGARDE DE LA BASE DE DONNEES AVANT
-- 2. Ouvrir le script :
R:\COMMUN\103_MOBILE_ANDROID\API_ATF_MOBILE\API_ATF_MOBILE\Scripts\NETTOYAGE_MESURES_DOUBLE.sql

-- 3. Exécuter d'abord le script TEL QUEL pour voir l'analyse
--    (sans décommenter les sections)

-- 4. Si vous voulez procéder au nettoyage :
--    - Décommenter l'ETAPE 5 (lignes ~110-145)
--    - Décommenter l'ETAPE 6 (lignes ~150-195)
--    - Exécuter à nouveau le script
```

**Note :** Le nettoyage est **optionnel**. Les anciennes mesures seront automatiquement supprimées par le service de rétention après quelques jours (selon configuration).

---

### 5️⃣ **Surveiller les logs** (SURVEILLANCE)

Vérifiez les logs DIRIS pour confirmer le bon fonctionnement :

**Emplacement des logs :**
```
C:\API_ATF_MOBILE\DATA\logs\app-YYYYMMDD.log
```

**Logs attendus :**
```
[INFO] DIRIS Signal Scheduler service STARTED
[INFO] Created timer for signal I_PH1_255 on device 1 with frequency 1000ms
[INFO] Created timer for signal I_PH2_255 on device 1 with frequency 2000ms
[INFO] Signal timers refreshed. Active signals: 486, Total timers: 486
```

**Interface d'administration :**
Vous pouvez aussi visualiser les logs via l'interface web :
```
http://10.250.13.4:8088/admin/index.html
→ Section "Logs DIRIS"
```

---

## 📊 Résumé du problème

### Avant le fix
- **Deux services actifs** : `DirisAcquisitionService` + `DirisSignalSchedulerService`
- **Double acquisition** → Beaucoup trop de mesures
- **Fréquences non respectées** :
  - I_PH1_255 : Config 1000ms → Réel 666ms (33% trop rapide)
  - RP_POS_255 : Config 600000ms → Réel 1990ms (99.7% trop rapide!)

### Après le fix
- **Un seul service actif** : `DirisSignalSchedulerService`
- **Acquisition individuelle par signal** avec timer dédié
- **Fréquences respectées** (écart < 5%)
- **Volume de mesures conforme** à la configuration

---

## 📁 Fichiers créés / modifiés

### Fichiers modifiés
- ✅ `Program.cs` (ligne 59) - Utilise le nouveau service unifié

### Fichiers créés
- ✅ `Services/DirisUnifiedAcquisitionService.cs` - Service unifié complet
- ✅ `FIX_ACQUISITION_FREQUENCE.md` - Documentation du problème initial
- ✅ `FIX_METRICS_DISPLAY.md` - Documentation du fix des métriques
- ✅ `FIX_UNIFIED_SERVICE.md` - Documentation du service unifié
- ✅ `Scripts/NETTOYAGE_MESURES_DOUBLE.sql` - Script de nettoyage optionnel
- ✅ `Scripts/VERIFICATION_POST_FIX_ACQUISITION.sql` - Script de vérification
- ✅ `CHANGELOG_FIX_ACQUISITION.md` - Journal des modifications
- ✅ `README_FIX_RAPIDE.txt` - Résumé ultra-rapide
- ✅ `ACTIONS_A_EFFECTUER.md` - Ce fichier (checklist)

---

## ❓ En cas de problème

Si après le redéploiement, l'acquisition ne fonctionne toujours pas :

1. **Vérifier que l'application a bien redémarré**
   ```powershell
   # Si c'est un service Windows
   Get-Service | Where-Object {$_.Name -like "*ATF*"}
   
   # Ou vérifier les process
   Get-Process | Where-Object {$_.Name -like "*API_ATF*"}
   ```

2. **Vérifier les logs d'erreur**
   ```
   C:\API_ATF_MOBILE\DATA\logs\app-*.log
   ```

3. **Vérifier la configuration**
   ```json
   // appsettings.json
   "Acquisition": {
     "Parallelism": 6,
     "DefaultPollIntervalMs": 1500,
     "RequestTimeoutMs": 2000,
     "MaxConsecutiveErrors": 5
   }
   ```

4. **Vérifier que les devices sont actifs**
   ```sql
   SELECT * FROM [AI_ATR].[DIRIS].[Devices] WHERE Enabled = 1;
   ```

5. **Vérifier que les TagMaps sont actifs**
   ```sql
   SELECT * FROM [AI_ATR].[DIRIS].[TagMap] WHERE Enabled = 1;
   ```

---

## 📞 Support

En cas de problème persistant :
1. Consulter `FIX_ACQUISITION_FREQUENCE.md` pour plus de détails techniques
2. Exécuter `Scripts/DEBUG_ACQUISITION_DIRIS.sql` pour diagnostiquer
3. Consulter les logs dans `C:\API_ATF_MOBILE\DATA\logs\`

---

## ⚠️ POINTS CRITIQUES À RETENIR

### 🔴 OBLIGATOIRE
1. **Redéploiement** : Le fix ne sera effectif qu'après redéploiement
2. **Redémarrage** : L'application doit être redémarrée complètement
3. **Attente** : Laisser 10-15 minutes pour stabilisation

### 🟡 IMPORTANT  
1. **Vérification** : Tester avec le script SQL après 15 minutes
2. **Métriques** : Vérifier l'affichage dans l'interface admin
3. **Logs** : Surveiller les logs pour confirmer le bon fonctionnement

### 🟢 OPTIONNEL
1. **Nettoyage** : Supprimer les anciennes données (avec sauvegarde préalable)
2. **Monitoring** : Surveillance continue des performances

---

## 📋 CHECKLIST RAPIDE

- [ ] Application redéployée et redémarrée
- [ ] Attente de 15 minutes écoulée
- [ ] Script de vérification SQL exécuté avec succès
- [ ] Métriques d'affichage correctes dans l'interface admin
- [ ] **Tous les boutons de l'interface admin fonctionnent** (cohérence, configuration, etc.)
- [ ] Logs confirment le bon fonctionnement du service unifié
- [ ] *(Optionnel)* Nettoyage des anciennes données effectué

---

**Date de création :** 2025-10-10  
**Version :** 1.1  
**Auteur :** Correction automatique  
**Dernière mise à jour :** Ajout des vérifications métriques et checklist

