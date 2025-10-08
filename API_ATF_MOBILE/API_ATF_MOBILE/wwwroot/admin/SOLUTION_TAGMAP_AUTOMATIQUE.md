# ✅ Solution Implémentée - TagMap Automatique

## 🎯 Problème Résolu

**Votre demande** : Lors de l'ajout d'un appareil DIRIS dans l'onglet DIRIS, les tagmaps ne se créaient pas automatiquement dans la base de données.

**Solution** : ✅ Les tagmaps sont maintenant créés **automatiquement** avec 12 signaux DIRIS standards !

---

## 🚀 Ce qui a été modifié

### 1. Backend (C#)

**Fichier** : `API_ATF_MOBILE/API_ATF_MOBILE/Controllers/DirisDevicesController.cs`

**Modifications** :
- ✅ Ajout de l'auto-création des tagmaps dans `CreateDevice()`
- ✅ Nouvel endpoint `POST /api/diris/devices/{id}/discover-tags` pour redécouverte manuelle
- ✅ Nouvelle méthode privée `DiscoverAndCreateTagMappingsAsync()` avec 12 signaux standards

**Signaux créés automatiquement** :
```
✅ I_PH1_255, I_PH2_255, I_PH3_255, I_NUL_255 (Courants en A)
✅ F_255 (Fréquence en Hz)
✅ PV1_255, PV2_255, PV3_255 (Tensions en V)
✅ SUM_RP_255 (Puissance active en kW)
✅ SUM_IP_255 (Puissance réactive en kVAR)
✅ SUM_AP_255 (Puissance apparente en kVA)
✅ SUM_PF_255 (Facteur de puissance en %)
```

### 2. Frontend (JavaScript)

**Fichier** : `API_ATF_MOBILE/API_ATF_MOBILE/wwwroot/admin/js/diris-manager.js`

**Modifications** :
- ✅ Ajout d'un bouton **🏷️ Tags** pour chaque device
- ✅ Nouvelle méthode `discoverTags(deviceId)` pour redécouverte manuelle
- ✅ Messages utilisateur améliorés avec mention de l'auto-création

---

## 💡 Comment Utiliser

### Ajouter un nouveau device DIRIS

1. **Interface admin** → Onglet **⚡ DIRIS**
2. Section **"Devices DIRIS"** → Bouton **➕ Ajouter**
3. Remplir le formulaire :
   - Nom du device
   - Adresse IP
   - Intervalle de poll (1500 ms recommandé)
4. Cliquer **➕ Ajouter**

**Résultat** :
```
✅ Device ajouté avec succès (ID: 5). Les tagmaps ont été créés automatiquement.
```

**C'est tout !** Le device est prêt avec ses 12 signaux configurés.

---

### Redéclencher la découverte manuellement

Si vous avez un ancien device sans tagmaps :

1. **Interface admin** → Onglet **⚡ DIRIS**
2. Trouver votre device dans la liste
3. Cliquer sur le bouton **🏷️ Tags**

**Résultat** :
```
✅ 12 tags créés automatiquement pour device X
```

Les anciens tagmaps (s'il y en avait) sont supprimés et remplacés par les nouveaux.

---

## 🔍 Vérification

### Dans l'interface admin

1. **Onglet DIRIS** → Section **"Dernières mesures"**
2. Votre nouveau device devrait apparaître avec ses signaux
3. Cliquer sur **🔄 Actualiser** si nécessaire

### Dans la base de données

```sql
-- Voir tous les devices avec leur nombre de tagmaps
SELECT 
    d.DeviceId,
    d.Name,
    d.IpAddress,
    COUNT(tm.Signal) AS NombreSignaux
FROM DIRIS.Devices d
LEFT JOIN DIRIS.TagMap tm ON d.DeviceId = tm.DeviceId
GROUP BY d.DeviceId, d.Name, d.IpAddress
ORDER BY d.DeviceId;
```

**Résultat attendu** : Chaque device devrait avoir **12** signaux.

---

## 📊 Exemple Complet

### Avant (Manuel)

```sql
-- 1. Ajouter le device
INSERT INTO DIRIS.Devices (Name, IpAddress, Protocol, Enabled, PollIntervalMs)
VALUES ('Mon_DIRIS', '192.168.2.195', 'webmi', 1, 1500);

-- 2. Récupérer l'ID
DECLARE @DeviceId INT = SCOPE_IDENTITY();

-- 3. Ajouter TOUS les tagmaps manuellement (12 INSERT)
INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
VALUES 
    (@DeviceId, 'I_PH1_255', 'I_PH1_255', 'A', 1000, 1),
    (@DeviceId, 'I_PH2_255', 'I_PH2_255', 'A', 1000, 1),
    -- ... 10 autres signaux à écrire manuellement
```

**Temps** : ~10-15 minutes  
**Risque d'erreur** : Élevé (typo, mauvaise échelle, etc.)

### Maintenant (Automatique)

1. Interface admin → DIRIS → ➕ Ajouter
2. Remplir : Nom + IP
3. Cliquer "Ajouter"

**Temps** : ~30 secondes  
**Risque d'erreur** : Aucun ✅

---

## 🎉 Bénéfices

✅ **Gain de temps** : De 15 minutes à 30 secondes  
✅ **Sans erreur** : Configuration standardisée  
✅ **Prêt à l'emploi** : Acquisition immédiate  
✅ **Historique** : Actions tracées  
✅ **Flexibilité** : Bouton de redécouverte si besoin  

---

## 🔄 Migration des Devices Existants

Si vous avez des devices DIRIS **sans tagmaps** :

### Option 1 : Interface (recommandée)

Pour chaque device :
1. Cliquer sur **🏷️ Tags**
2. Confirmer

### Option 2 : Script SQL automatisé

```sql
-- Script pour créer les tagmaps pour tous les devices sans tags

DECLARE @DeviceId INT;
DECLARE device_cursor CURSOR FOR 
    SELECT d.DeviceId 
    FROM DIRIS.Devices d
    LEFT JOIN DIRIS.TagMap tm ON d.DeviceId = tm.DeviceId
    WHERE tm.DeviceId IS NULL;

OPEN device_cursor;
FETCH NEXT FROM device_cursor INTO @DeviceId;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Créer les 12 tagmaps standards
    INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
    VALUES 
        (@DeviceId, 'I_PH1_255', 'I_PH1_255', 'A', 1000, 1),
        (@DeviceId, 'I_PH2_255', 'I_PH2_255', 'A', 1000, 1),
        (@DeviceId, 'I_PH3_255', 'I_PH3_255', 'A', 1000, 1),
        (@DeviceId, 'I_NUL_255', 'I_NUL_255', 'A', 1000, 1),
        (@DeviceId, 'F_255', 'F_255', 'Hz', 100, 1),
        (@DeviceId, 'PV1_255', 'PV1_255', 'V', 100, 1),
        (@DeviceId, 'PV2_255', 'PV2_255', 'V', 100, 1),
        (@DeviceId, 'PV3_255', 'PV3_255', 'V', 100, 1),
        (@DeviceId, 'SUM_RP_255', 'SUM_RP_255', 'kW', 100, 1),
        (@DeviceId, 'SUM_IP_255', 'SUM_IP_255', 'kVAR', 100, 1),
        (@DeviceId, 'SUM_AP_255', 'SUM_AP_255', 'kVA', 100, 1),
        (@DeviceId, 'SUM_PF_255', 'SUM_PF_255', '%', 100, 1);
    
    PRINT 'TagMaps créés pour DeviceId: ' + CAST(@DeviceId AS VARCHAR(10));
    
    FETCH NEXT FROM device_cursor INTO @DeviceId;
END;

CLOSE device_cursor;
DEALLOCATE device_cursor;

PRINT 'Migration terminée !';
```

---

## 📞 Questions Fréquentes

### Q: Les tagmaps sont-ils créés pour tous les modèles DIRIS ?

**R:** La configuration actuelle est optimisée pour les modèles **DIRIS A40/A41** qui utilisent les signaux `_255`. Si vous avez un autre modèle, vous pouvez :
- Modifier la méthode `DiscoverAndCreateTagMappingsAsync()` dans le code
- Ou créer les tagmaps manuellement après l'ajout du device

### Q: Puis-je modifier les tagmaps après la création automatique ?

**R:** Oui ! Les tagmaps sont stockés dans la table `DIRIS.TagMap` et peuvent être :
- Modifiés via SQL directement
- Mis à jour via l'endpoint `PUT /api/diris/devices/{id}/tags`
- Recréés en cliquant sur le bouton "🏷️ Tags"

### Q: Que se passe-t-il si je clique sur "🏷️ Tags" pour un device qui a déjà des tagmaps ?

**R:** Les anciens tagmaps sont **supprimés** et remplacés par les 12 signaux standards. Si vous aviez des signaux personnalisés, ils seront perdus. Utilisez cette fonction avec précaution sur des devices en production.

### Q: Les tagmaps sont-ils créés même si le device n'est pas accessible ?

**R:** Oui. Les tagmaps sont créés **indépendamment** de la connectivité du device. Même si l'appareil est hors ligne, les 12 signaux standards sont configurés. Cela permet de préparer la configuration avant que le device ne soit physiquement installé.

---

## 🔗 Liens Utiles

- [Guide complet AUTO_TAGMAP_GUIDE.md](AUTO_TAGMAP_GUIDE.md) - Documentation détaillée
- [Guide de test TEST_AUTO_TAGMAP.md](TEST_AUTO_TAGMAP.md) - Procédures de test
- [Changelog CHANGELOG_AUTO_TAGMAP.md](CHANGELOG_AUTO_TAGMAP.md) - Historique des modifications
- [Onglet DIRIS DIRIS_TAB.md](DIRIS_TAB.md) - Vue d'ensemble de l'interface

---

**Statut** : ✅ **IMPLÉMENTÉ ET FONCTIONNEL**  
**Version** : 1.1.0  
**Date** : 8 octobre 2025

🎉 **Votre problème est résolu ! Les tagmaps se créent maintenant automatiquement.** 🎉

