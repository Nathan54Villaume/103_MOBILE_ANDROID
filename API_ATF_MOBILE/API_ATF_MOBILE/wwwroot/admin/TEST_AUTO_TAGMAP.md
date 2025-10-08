# 🧪 Guide de Test - Auto-création des TagMaps DIRIS

**Objectif** : Vérifier que les TagMaps sont bien créés automatiquement lors de l'ajout d'un device DIRIS.

---

## ⚡ Test Rapide (5 minutes)

### 1️⃣ Préparation

**Démarrer le serveur** :
```bash
cd API_ATF_MOBILE\API_ATF_MOBILE
dotnet run --configuration Release
```

**Ouvrir l'interface admin** :
```
http://localhost:8088/admin/
```

**Se connecter** :
- Utilisateur : `admin`
- Mot de passe : `admin123`

---

### 2️⃣ Test d'Ajout de Device

#### Étape A : Aller dans l'onglet DIRIS
1. Cliquer sur "⚡ DIRIS" dans la barre latérale
2. Descendre jusqu'à la section **"Devices DIRIS"**

#### Étape B : Ajouter un device de test
1. Cliquer sur le bouton **"➕ Ajouter"**
2. Remplir le formulaire :
   - **Nom** : `DIRIS_Test_Auto`
   - **Adresse IP** : `192.168.2.199` (ou une IP de test)
   - **Intervalle de poll** : `1500`
   - **Description** : `Test de création automatique des tagmaps`
3. Cliquer sur **"➕ Ajouter"**

#### Étape C : Vérifier le message de confirmation

Vous devriez voir une notification verte en haut à droite :
```
✅ Device ajouté avec succès (ID: X). Les tagmaps ont été créés automatiquement.
```

#### Étape D : Vérifier l'historique

Descendre jusqu'à la section **"Historique des actions"**

Vous devriez voir :
```
✅ Device ajouté
   Device DIRIS_Test_Auto ajouté avec auto-création des tagmaps (12 signaux)
```

---

### 3️⃣ Vérification dans la Base de Données

**Ouvrir SQL Server Management Studio** et exécuter :

```sql
-- 1. Vérifier que le device existe
SELECT * FROM DIRIS.Devices WHERE Name = 'DIRIS_Test_Auto';
-- Résultat attendu : 1 ligne

-- 2. Compter les tagmaps créés
DECLARE @DeviceId INT = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'DIRIS_Test_Auto');

SELECT COUNT(*) AS NombreTagMaps
FROM DIRIS.TagMap
WHERE DeviceId = @DeviceId;
-- Résultat attendu : 12

-- 3. Voir tous les tagmaps créés
SELECT 
    Signal,
    WebMiKey,
    Unit,
    Scale,
    Enabled
FROM DIRIS.TagMap
WHERE DeviceId = @DeviceId
ORDER BY Signal;
```

**Résultat attendu** : 12 lignes avec ces signaux :
- F_255 (Hz)
- I_NUL_255 (A)
- I_PH1_255 (A)
- I_PH2_255 (A)
- I_PH3_255 (A)
- PV1_255 (V)
- PV2_255 (V)
- PV3_255 (V)
- SUM_AP_255 (kVA)
- SUM_IP_255 (kVAR)
- SUM_PF_255 (%)
- SUM_RP_255 (kW)

---

### 4️⃣ Test de Redécouverte Manuelle

#### Étape A : Supprimer manuellement les tagmaps

```sql
DECLARE @DeviceId INT = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'DIRIS_Test_Auto');
DELETE FROM DIRIS.TagMap WHERE DeviceId = @DeviceId;
-- Vérifier : SELECT COUNT(*) FROM DIRIS.TagMap WHERE DeviceId = @DeviceId
-- Résultat : 0
```

#### Étape B : Redéclencher la découverte

1. Dans l'interface admin → Onglet DIRIS → Section "Devices DIRIS"
2. Trouver le device `DIRIS_Test_Auto`
3. Cliquer sur le bouton **"🏷️ Tags"**

#### Étape C : Vérifier la notification

Vous devriez voir :
```
✅ 12 tags créés automatiquement pour device X
```

#### Étape D : Re-vérifier en BDD

```sql
DECLARE @DeviceId INT = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'DIRIS_Test_Auto');
SELECT COUNT(*) FROM DIRIS.TagMap WHERE DeviceId = @DeviceId;
-- Résultat attendu : 12 (tags recréés)
```

---

## 🧹 Nettoyage après Test

**Supprimer le device de test** :

```sql
DECLARE @DeviceId INT = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'DIRIS_Test_Auto');

-- Supprimer les tagmaps
DELETE FROM DIRIS.TagMap WHERE DeviceId = @DeviceId;

-- Supprimer le device
DELETE FROM DIRIS.Devices WHERE DeviceId = @DeviceId;
```

Ou via l'interface admin (si fonctionnalité de suppression implémentée).

---

## 📝 Tests Avancés

### Test 5 : Vérification des échelles

Les échelles sont critiques pour convertir correctement les valeurs WebMI :

```sql
DECLARE @DeviceId INT = (SELECT DeviceId FROM DIRIS.Devices WHERE Name = 'DIRIS_Test_Auto');

SELECT 
    Signal,
    Unit,
    Scale,
    CASE 
        WHEN Unit = 'A' AND Scale = 1000 THEN '✅ Correct'
        WHEN Unit = 'V' AND Scale = 100 THEN '✅ Correct'
        WHEN Unit = 'Hz' AND Scale = 100 THEN '✅ Correct'
        WHEN Unit IN ('kW', 'kVAR', 'kVA', '%') AND Scale = 100 THEN '✅ Correct'
        ELSE '❌ Incorrect'
    END AS Validation
FROM DIRIS.TagMap
WHERE DeviceId = @DeviceId;
```

**Résultat attendu** : Toutes les lignes avec `✅ Correct`

---

### Test 6 : Test d'acquisition réelle (si device physique disponible)

**Si vous avez un vrai device DIRIS accessible** :

1. Ajouter le device avec sa vraie IP (ex: `192.168.2.133`)
2. Les tagmaps sont créés automatiquement
3. Cliquer sur le bouton **"🔍 Test"** pour le device
4. Vérifier le message : `✅ Device X: 12 mesures lues en Yms`
5. Aller dans "Dernières mesures"
6. Vérifier que les valeurs sont affichées correctement avec les bonnes unités

---

## 🐛 Scénarios de Problèmes

### Problème 1 : Aucun tagmap créé

**Symptôme** : Le device est créé mais COUNT(*) = 0

**Causes possibles** :
1. Exception lors de l'appel à `DiscoverAndCreateTagMappingsAsync()`
2. Erreur de permission SQL
3. Table DIRIS.TagMap n'existe pas

**Diagnostic** :
```sql
-- Vérifier que la table existe
SELECT * FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'DIRIS' AND TABLE_NAME = 'TagMap';
```

**Solution** :
- Vérifier les logs serveur (onglet Logs de l'admin)
- Chercher les messages d'erreur contenant "tag mapping"
- Utiliser le bouton "🏷️ Tags" pour retenter

---

### Problème 2 : Erreur lors de l'ajout du device

**Symptôme** : Le device n'est pas créé du tout

**Causes possibles** :
1. IP déjà utilisée par un autre device
2. Nom vide ou invalide
3. Erreur de connexion à la BDD

**Solution** :
- Vérifier l'unicité de l'IP et du nom
- Consulter les logs serveur
- Tester la connexion à la BDD dans l'onglet "Bases de données"

---

### Problème 3 : Les signaux ne correspondent pas à votre device

**Symptôme** : Tagmaps créés mais aucune donnée lors de l'acquisition

**Cause** : Votre modèle DIRIS utilise des clés WebMI différentes

**Solution** :
1. Consulter la documentation de votre modèle DIRIS
2. Modifier `DirisDevicesController.DiscoverAndCreateTagMappingsAsync()` avec les bons signaux
3. Ou créer les tagmaps manuellement :

```sql
INSERT INTO DIRIS.TagMap (DeviceId, Signal, WebMiKey, Unit, Scale, Enabled)
VALUES 
    (@DeviceId, 'VOTRE_SIGNAL', 'VOTRE_WEBMI_KEY', 'kW', 100, 1);
```

---

## 📊 Checklist de Test Complète

- [ ] Serveur démarré
- [ ] Interface admin accessible
- [ ] Connexion admin réussie
- [ ] Onglet DIRIS ouvert
- [ ] Formulaire d'ajout rempli
- [ ] Device créé avec succès
- [ ] Notification de tagmaps auto affichée
- [ ] 12 tagmaps vérifiés en BDD
- [ ] Bouton "🏷️ Tags" testé
- [ ] Redécouverte manuelle réussie
- [ ] Device de test supprimé (nettoyage)

---

## 🎓 Annexe : Comprendre les Échelles

### Pourquoi des échelles ?

WebMI retourne les valeurs en **unités de base** :
- **Courants** : milliampères (mA) → diviser par 1000 pour obtenir des Ampères (A)
- **Tensions** : centivolts (cV) → diviser par 100 pour obtenir des Volts (V)
- **Fréquence** : centihertz (cHz) → diviser par 100 pour obtenir des Hertz (Hz)
- **Puissances** : centiwatts (cW) → diviser par 100 pour obtenir des kW

### Exemple de conversion

**WebMI retourne** : `I_PH1_255 = 312450`  
**Après application de l'échelle** : `312450 / 1000 = 312.45 A`  
**Affiché dans l'interface** : `312.45 A` ✅

**Sans échelle** : `312450 A` ❌ (valeur incorrecte)

---

**Fin du guide de test** 🎉

