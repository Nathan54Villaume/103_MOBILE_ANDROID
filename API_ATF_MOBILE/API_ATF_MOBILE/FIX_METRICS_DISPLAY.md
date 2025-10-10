# 🔧 FIX : Affichage des métriques DIRIS

## 📋 Problème identifié

Après le fix d'acquisition, les métriques d'affichage ne fonctionnaient plus correctement :

- ❌ **"Devices actifs"** affichait **0** au lieu du nombre réel
- ❌ **"Devices/seconde"** affichait **0.00**
- ❌ **"Points/seconde"** était incorrect
- ✅ Les données s'enregistraient bien en base (acquisition fonctionnelle)

## 🎯 Cause

En désactivant `DirisAcquisitionService`, j'ai supprimé les appels aux métriques qui étaient dans ce service :

```csharp
// Dans DirisAcquisitionService (DÉSACTIVÉ)
_metricsCollector.RecordSuccessfulReading(device.DeviceId, duration);  // ← Manquait
await _deviceRegistry.UpdateDeviceLastSeenAsync(device.DeviceId, reading.UtcTs);  // ← Manquait
```

Le service `DirisSignalSchedulerService` n'appelait que :
```csharp
_metricsCollector.RecordMeasurementPoint(); // ← Seulement pour les points
```

## ✅ Solution appliquée

**Fichier modifié :** `Services/DirisSignalSchedulerService.cs`

**Lignes ajoutées (247-252) :**
```csharp
// Mettre à jour les métriques de lecture réussie
var duration = DateTime.UtcNow - startTime;
_metricsCollector.RecordSuccessfulReading(device.DeviceId, duration);

// Mettre à jour le "last seen" du device
await _deviceRegistry.UpdateDeviceLastSeenAsync(device.DeviceId, reading.UtcTs);
```

## 📊 Résultat attendu

Après redéploiement, les métriques devraient afficher :

- ✅ **"Devices actifs"** : Nombre réel de devices (ex: 1, 2, etc.)
- ✅ **"Devices/seconde"** : Valeur calculée correctement
- ✅ **"Points/seconde"** : Valeur mise à jour
- ✅ **"Latence P95"** : Valeur calculée

## 🚀 Actions requises

1. **Redéployer** l'application (même procédure que précédemment)
2. **Attendre** 5-10 minutes pour que les métriques se stabilisent
3. **Vérifier** dans l'interface admin que les métriques s'affichent correctement

## 📁 Fichiers modifiés

- ✅ `Services/DirisSignalSchedulerService.cs` : Ajout des appels aux métriques manquants

## 📝 Note

Ce fix est un **complément** au fix d'acquisition principal. Les deux fixes sont nécessaires :
1. **Fix acquisition** : Respecter les fréquences `RecordingFrequencyMs`
2. **Fix métriques** : Afficher correctement les statistiques

---

**Date :** 2025-10-10  
**Priorité :** MOYENNE (affichage uniquement, acquisition fonctionne)  
**Statut :** ✅ Fix appliqué, en attente de redéploiement
