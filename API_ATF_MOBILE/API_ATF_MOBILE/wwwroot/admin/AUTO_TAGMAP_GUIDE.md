# 🏷️ Création Automatique des TagMaps DIRIS

## 📋 Vue d'ensemble

Lorsque vous ajoutez un nouveau device DIRIS via l'interface d'administration, le système crée **automatiquement** les tagmaps (mappings de signaux) dans la base de données. Plus besoin de configuration manuelle !

---

## ✨ Fonctionnalité Automatique

### Lors de l'ajout d'un device

**Avant** :
1. ❌ Ajouter un device DIRIS
2. ❌ Ouvrir SQL Server Management Studio
3. ❌ Écrire manuellement les INSERT pour les TagMaps
4. ❌ Trouver tous les signaux et leurs échelles

**Maintenant** :
1. ✅ Ajouter un device DIRIS dans l'interface admin
2. ✅ Les TagMaps sont créés automatiquement !
3. ✅ Le device est prêt à être utilisé immédiatement

### Signaux créés automatiquement

Pour chaque nouveau device DIRIS A40/A41, **81 signaux complets** sont configurés automatiquement :

#### 📊 Catégories de signaux (81 signaux au total)

| Catégorie | Nombre | Exemples |
|-----------|--------|----------|
| **Courants** | 12 | I_PH1/2/3_255, AVG_I1/2/3_255, MAXAVGSUM_I1/2/3_255, I_NUL_255, AVG_IN_255 |
| **THD Courants** | 4 | THD_I1/2/3_255, THD_IN_255 |
| **Fréquence** | 1 | F_255 |
| **THD Tensions** | 6 | THD_U1/2/3_255, THD_U12/23/31_255 |
| **Tensions Phase-Neutre** | 9 | PV1/2/3_255, AVG_V1/2/3_255, MAXAVG_V1/2/3_255 |
| **Tensions Phase-Phase** | 9 | LV_U12/23/31_255, AVG_U12/23/31_255, MAXAVG_U12/23/31_255 |
| **Puissances Actives** | 9 | PH1/2/3_RP_255, SUM_RP_255, AVGSUM_RPPOS_255, PRED_RP_255, etc. |
| **Puissances Réactives** | 9 | PH1/2/3_IP_255, SUM_IP_255, AVGSUM_IPPOS_255, PRED_IP_255, etc. |
| **Puissances Apparentes** | 7 | PH1/2/3_AP_255, SUM_AP_255, AVGSUM_AP_255, PRED_AP_255 |
| **Facteurs de Puissance** | 4 | PH1/2/3_PF_255, SUM_PF_255 |
| **Énergies** | 6 | E1/2/3/4/5/6_255 |
| **Totaux Cumulatifs** | 5 | RP_POS/NEG_255, IP_POS/NEG_255, AP_255 |
| **TOTAL** | **81** | **Jeu complet de signaux DIRIS A40/A41** |

> **Note** : Les échelles sont essentielles car WebMI retourne les valeurs en unités de base (mA pour les courants, cV pour les tensions, etc.). Les échelles (100 ou 1000) convertissent automatiquement vers les bonnes unités.

---

## 🎯 Utilisation

### Ajouter un nouveau device

1. **Accéder à l'onglet DIRIS** dans l'interface admin
   ```
   http://localhost:8088/admin/ → Onglet "⚡ DIRIS"
   ```

2. **Cliquer sur "➕ Ajouter"** dans la section "Devices DIRIS"

3. **Remplir le formulaire** :
   - **Nom du device** : Ex. "DIRIS_Poste_01"
   - **Adresse IP** : Ex. "192.168.2.195"
   - **Intervalle de poll** : 1500 ms (par défaut)
   - **Description** (optionnel) : Ex. "Compteur principal atelier"

4. **Cliquer sur "➕ Ajouter"**

5. ✅ **Le device est créé et les 12 tagmaps sont automatiquement configurés !**

### Message de confirmation

Vous verrez une notification :
```
✅ Device ajouté avec succès (ID: 5). Les tagmaps ont été créés automatiquement.
```

Et dans l'historique des actions :
```
✅ Device ajouté
   Device DIRIS_Poste_01 ajouté avec auto-création des tagmaps (12 signaux)
```

---

## 🔧 Redécouverte manuelle des tags

Si vous avez ajouté un device **avant** cette mise à jour, ou si vous souhaitez recréer les tagmaps, vous pouvez utiliser le bouton **🏷️ Tags** :

### Étapes

1. Aller dans l'onglet **DIRIS** → section **Devices DIRIS**

2. Trouver votre device dans la liste

3. Cliquer sur le bouton **🏷️ Tags**

4. Le système va :
   - Supprimer les anciens tagmaps (s'il y en a)
   - Créer les 12 tagmaps standards
   - Afficher une confirmation

### Message de confirmation

```
✅ 12 tags créés automatiquement pour device 3
```

---

## 🛠️ API Backend

### Endpoint automatique (appelé lors de la création)

```http
POST /api/diris/devices
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "DIRIS_Poste_01",
  "ipAddress": "192.168.2.195",
  "pollIntervalMs": 1500,
  "enabled": true
}

Response:
{
  "deviceId": 5,
  "name": "DIRIS_Poste_01",
  "ipAddress": "192.168.2.195",
  ...
}
```

**Comportement** : Après la création du device, le système appelle automatiquement `DiscoverAndCreateTagMappingsAsync(deviceId)` qui crée les 12 tagmaps.

### Endpoint manuel (découverte manuelle)

```http
POST /api/diris/devices/{id}/discover-tags
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Successfully discovered and created 12 tag mappings for device 5",
  "tagMappings": [
    {
      "deviceId": 5,
      "signal": "I_PH1_255",
      "webMiKey": "I_PH1_255",
      "unit": "A",
      "scale": 1000,
      "enabled": true
    },
    ...
  ]
}
```

---

## 📊 Vérification dans la base de données

Pour vérifier que les tagmaps ont bien été créés, vous pouvez exécuter cette requête SQL :

```sql
-- Voir les devices et leurs tagmaps
SELECT 
    d.DeviceId,
    d.Name,
    d.IpAddress,
    COUNT(tm.Signal) AS NombreSignaux
FROM DIRIS.Devices d
LEFT JOIN DIRIS.TagMap tm ON d.DeviceId = tm.DeviceId
GROUP BY d.DeviceId, d.Name, d.IpAddress
ORDER BY d.DeviceId;

-- Voir tous les tagmaps d'un device spécifique
SELECT 
    DeviceId,
    Signal,
    WebMiKey,
    Unit,
    Scale,
    Enabled
FROM DIRIS.TagMap
WHERE DeviceId = 5 -- Remplacer par votre DeviceId
ORDER BY Signal;
```

**Résultat attendu** : 12 lignes pour chaque device

---

## ⚙️ Configuration Backend

La liste des signaux par défaut est définie dans :
```
API_ATF_MOBILE/API_ATF_MOBILE/Controllers/DirisDevicesController.cs
```

Méthode : `DiscoverAndCreateTagMappingsAsync(int deviceId)`

Si vous utilisez un **modèle DIRIS différent** (ex: A20, B30, etc.) avec d'autres signaux, vous pouvez modifier cette méthode pour ajouter/supprimer des signaux.

### Exemple d'ajout d'un signal

```csharp
// Ajouter ce signal dans la liste defaultTagMappings :
new TagMap 
{ 
    DeviceId = deviceId, 
    Signal = "I_TOTAL_255", 
    WebMiKey = "I_TOTAL_255", 
    Unit = "A", 
    Scale = 1000, 
    Enabled = true 
}
```

---

## 🚀 Avantages

✅ **Gain de temps** : Plus besoin de configurer manuellement les tagmaps  
✅ **Moins d'erreurs** : Configuration standardisée  
✅ **Prêt à l'emploi** : Le device peut être utilisé immédiatement après ajout  
✅ **Cohérence** : Tous les devices ont les mêmes signaux de base  
✅ **Flexibilité** : Possibilité de redéclencher la découverte si nécessaire  

---

## 🐛 Dépannage

### Les tagmaps n'ont pas été créés ?

1. **Vérifier les logs** dans l'onglet Logs :
   ```
   Auto-discovery of tag mappings completed for device X
   ```

2. **Vérifier en base de données** :
   ```sql
   SELECT COUNT(*) FROM DIRIS.TagMap WHERE DeviceId = X
   ```
   Résultat attendu : 12

3. **Redéclencher manuellement** :
   - Cliquer sur le bouton **🏷️ Tags** pour le device concerné

### Le device ne retourne pas de données ?

1. **Vérifier que les tagmaps existent** :
   - Onglet DIRIS → Device → Bouton "🏷️ Tags"

2. **Tester la connexion** :
   - Onglet DIRIS → Device → Bouton "🔍 Test"

3. **Vérifier l'adresse IP** :
   - S'assurer que le device DIRIS est accessible sur le réseau
   - Tester avec `ping 192.168.2.XXX`

---

## 📝 Architecture Technique

### Flux de création

```
1. Frontend : diris-manager.js → addDevice()
                ↓
2. Backend : POST /api/diris/devices
                ↓
3. DeviceRepository → AddDeviceAsync()
                ↓
4. DirisDevicesController → DiscoverAndCreateTagMappingsAsync()
                ↓
5. DeviceRepository → UpdateTagMappingsAsync()
                ↓
6. SQL : INSERT INTO DIRIS.TagMap (12 signaux)
```

### Tables impliquées

- **DIRIS.Devices** : Informations du device (IP, nom, etc.)
- **DIRIS.TagMap** : Mappings des signaux (Signal ↔ WebMI Key)

---

## 🔄 Migration des anciens devices

Si vous avez des devices DIRIS ajoutés **avant** cette mise à jour :

### Option 1 : Via l'interface (recommandé)

1. Aller dans l'onglet **DIRIS**
2. Pour chaque device, cliquer sur **🏷️ Tags**
3. Confirmer la création automatique

### Option 2 : Via SQL

Exécuter le script fourni :
```sql
-- Script de migration pour créer les tagmaps pour les devices existants
-- Voir : API_ATF_MOBILE/DIRIS_Server/scripts/add-new-diris-devices.sql
```

---

## 📚 Documentation associée

- [Guide DIRIS Tab](DIRIS_TAB.md) - Vue d'ensemble de l'onglet DIRIS
- [Intégration DIRIS](../INTEGRATION_DIRIS.md) - Architecture globale
- [Script SQL d'exemple](../DIRIS_Server/scripts/add-new-diris-devices.sql) - Migration manuelle

---

**Version** : 1.1  
**Date** : 8 octobre 2025  
**Fonctionnalité** : Auto-création des TagMaps lors de l'ajout de devices DIRIS  
**Signaux configurés** : 12 signaux standards DIRIS A40/A41

✨ **Les devices DIRIS sont maintenant configurés automatiquement !**

