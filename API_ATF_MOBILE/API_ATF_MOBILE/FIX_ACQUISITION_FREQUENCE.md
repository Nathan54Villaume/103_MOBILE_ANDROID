# 🔧 FIX : Problème de fréquence d'acquisition DIRIS

## 📋 Problème identifié

### Symptômes
L'acquisition DIRIS **ne respectait PAS** les paramètres `RecordingFrequencyMs` configurés dans la table `[AI_ATR].[DIRIS].[TagMap]`.

**Exemple des problèmes constatés** (voir `Debug_SQL.csv`) :
- Signal `I_PH1_255` : Configuré à 1000ms → Enregistré tous les 666ms (33% trop rapide)
- Signal `I_PH2_255` : Configuré à 2000ms → Enregistré tous les 1000ms (50% trop rapide)
- Signal `RP_POS_255` : Configuré à 600000ms (10 min) → Enregistré tous les 1990ms (99.7% trop rapide!)

### Cause racine

**DEUX services d'acquisition** tournaient **simultanément** dans `Program.cs` :

1. **`DirisAcquisitionService`** (ligne 58)
   - Lit TOUS les devices avec TOUS les signaux
   - Fréquence fixe : `DefaultPollIntervalMs` (1500ms par défaut)
   - ❌ **IGNORE complètement** `RecordingFrequencyMs` de la table TagMap
   - Écrit TOUTES les mesures dans la base

2. **`DirisSignalSchedulerService`** (ligne 59)
   - Crée un timer **individuel** pour chaque signal
   - ✅ **Respecte** `RecordingFrequencyMs` de chaque signal
   - Écrit les mesures selon la fréquence configurée

**Résultat :** Double acquisition → Beaucoup trop de mesures!

---

## ✅ Solution appliquée

### Modification dans `Program.cs`

**Avant :**
```csharp
builder.Services.AddHostedService<DirisAcquisitionService>();           // ← Actif
builder.Services.AddHostedService<DirisSignalSchedulerService>();       // ← Actif
```

**Après :**
```csharp
// ⚠️ DirisAcquisitionService désactivé car il ne respecte PAS RecordingFrequencyMs
// builder.Services.AddHostedService<DirisAcquisitionService>();        // ← Désactivé
builder.Services.AddHostedService<DirisSignalSchedulerService>();       // ✅ Actif seul
```

### Fonctionnement après le fix

Maintenant, **seul** `DirisSignalSchedulerService` est actif :

1. **Au démarrage**, le service :
   - Charge tous les devices actifs depuis `[DIRIS].[Devices]`
   - Charge tous les TagMaps actifs depuis `[DIRIS].[TagMap]`
   - Lit la fréquence `RecordingFrequencyMs` pour chaque signal

2. **Pour chaque signal**, il crée un timer individuel :
   - `I_PH1_255` avec fréquence 1000ms → Timer à 1000ms
   - `I_PH2_255` avec fréquence 2000ms → Timer à 2000ms
   - `RP_POS_255` avec fréquence 600000ms → Timer à 600000ms (10 minutes)

3. **À chaque déclenchement du timer** :
   - Lit le device concerné
   - Extrait uniquement la mesure pour ce signal
   - Enregistre la mesure dans `[DIRIS].[Measurements]`

4. **Rafraîchissement automatique** :
   - Toutes les 5 minutes, recharge les fréquences depuis la base
   - Si un signal est ajouté/modifié/supprimé, met à jour les timers

---

## 🚀 Actions à effectuer

### 1. Redéployer l'application

Pour que le changement prenne effet, il faut **redéployer** l'application :

```powershell
# Depuis le répertoire API_ATF_MOBILE/API_ATF_MOBILE
dotnet publish -c Release
```

Puis copier les fichiers publiés vers le serveur de production.

### 2. Nettoyer les données en double (optionnel)

Si vous souhaitez nettoyer les mesures enregistrées en trop, utilisez le script SQL fourni : `Scripts/NETTOYAGE_MESURES_DOUBLE.sql`

⚠️ **Attention :** Ce nettoyage est optionnel. Si vous laissez les données actuelles, elles seront automatiquement supprimées par le service de rétention après X jours (configurable).

### 3. Vérification après redéploiement

Après redéploiement, vérifiez dans les logs DIRIS :

```
[Section: Logs DIRIS dans l'interface admin]
```

Vous devriez voir des logs du type :
```
DIRIS Signal Scheduler service STARTED
Created timer for signal I_PH1_255 on device 1 with frequency 1000ms
Created timer for signal I_PH2_255 on device 1 with frequency 2000ms
...
Signal timers refreshed. Active signals: 486, Total timers: 486
```

### 4. Tester avec le script de vérification

Lancez le script SQL de diagnostic pour vérifier que les fréquences sont maintenant respectées :

```sql
-- Voir Scripts/VERIFICATION_FREQUENCES.sql
```

Attendez quelques minutes après le redéploiement, puis exécutez ce script. Vous devriez voir :
- `EcartPourcent` proche de 0% pour chaque signal
- `Probleme` = 'CONFORME' pour la majorité des signaux

---

## 📊 Comparaison Avant/Après

### Avant le fix
| Signal | Config (ms) | Réel (ms) | Écart | Problème |
|--------|-------------|-----------|-------|----------|
| I_PH1_255 | 1000 | 666 | 33% | VARIABLE |
| I_PH2_255 | 2000 | 1000 | 50% | VARIABLE |
| RP_POS_255 | 600000 | 1990 | 99.7% | TROP_RAPIDE |

**Résultat :** ~309 mesures en 5 minutes au lieu de ~5 → **60x trop de mesures!**

### Après le fix (attendu)
| Signal | Config (ms) | Réel (ms) | Écart | Problème |
|--------|-------------|-----------|-------|----------|
| I_PH1_255 | 1000 | 1005 | 0.5% | CONFORME |
| I_PH2_255 | 2000 | 2010 | 0.5% | CONFORME |
| RP_POS_255 | 600000 | 600050 | 0.01% | CONFORME |

---

## 🔍 Détails techniques

### DirisSignalSchedulerService

**Emplacement :** `Services/DirisSignalSchedulerService.cs`

**Méthodes clés :**
- `LoadSignalFrequenciesAsync()` : Charge les fréquences depuis `[DIRIS].[TagMap]`
- `CreateOrUpdateSignalTimerAsync()` : Crée un timer pour un signal
- `ProcessSignalAsync()` : Traite l'acquisition d'un signal (appelé par le timer)
- `GetSignalFrequency()` : Récupère la fréquence avec fallback par défaut si non configuré

**Configuration :**
Les fréquences sont définies dans la table `[AI_ATR].[DIRIS].[TagMap]` :
```sql
SELECT DeviceId, Signal, RecordingFrequencyMs, Enabled
FROM [AI_ATR].[DIRIS].[TagMap]
WHERE Enabled = 1
```

**Fallback par défaut** (si RecordingFrequencyMs non configuré) :
- Signaux `I_*`, `PV*`, `LV_*`, `F_255` : 1000ms (critiques)
- Signaux `*RP*`, `*IP*`, `*AP*` : 2000ms (puissances)
- Signaux `THD_*` : 5000ms
- Signaux `E*_255` : 30000ms (énergies)
- Signaux `AVG_*`, `MAXAVG*` : 10000ms
- Autres : 5000ms

---

## 📝 Notes importantes

### Logs persistants
Les logs DIRIS sont stockés dans `C:\API_ATF_MOBILE\DATA\logs\` et sont conservés 30 jours.

Vérifiez les logs pour confirmer le bon fonctionnement :
```
app-YYYYMMDD.log
```

### Interface d'administration
L'interface web (`/admin/index.html`) permet de :
- Visualiser les devices et leurs signaux
- Configurer `RecordingFrequencyMs` pour chaque signal
- Voir les métriques d'acquisition en temps réel
- Vérifier la cohérence des données

### Performance attendue
Avec ce fix :
- ✅ Respect strict des fréquences configurées
- ✅ Réduction drastique du volume de données (selon configuration)
- ✅ Meilleure performance CPU/Réseau
- ✅ Base de données moins sollicitée

---

## 🆘 En cas de problème

Si après le fix, l'acquisition ne fonctionne toujours pas correctement :

1. **Vérifier les logs** dans `C:\API_ATF_MOBILE\DATA\logs\app-*.log`
2. **Vérifier que le service est bien actif** dans l'interface admin (Section DIRIS)
3. **Vérifier la configuration** dans `appsettings.json` :
   ```json
   "Acquisition": {
     "Parallelism": 6,
     "DefaultPollIntervalMs": 1500,
     "RequestTimeoutMs": 2000,
     "MaxConsecutiveErrors": 5
   }
   ```
4. **Consulter ce document** et les scripts SQL de diagnostic

---

## 📅 Historique

- **2025-10-10** : Problème identifié et fix appliqué
- **Symptômes** : Double acquisition, non-respect de RecordingFrequencyMs
- **Solution** : Désactivation de DirisAcquisitionService, garde de DirisSignalSchedulerService
- **Impact** : Réduction significative du volume de mesures, respect des fréquences configurées

---

**Auteur :** Correction automatique via analyse du code  
**Date :** 10 octobre 2025  
**Version :** 1.0

