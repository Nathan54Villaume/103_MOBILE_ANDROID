# 🔌 Onglet DIRIS - Interface d'Administration

## 📋 Vue d'ensemble

L'onglet **DIRIS** dans l'interface d'administration permet de gérer complètement le système d'acquisition de données depuis les équipements Socomec DIRIS.

**Accès** : http://localhost:8088/admin/ → Onglet "⚡ DIRIS"

---

## 🎛️ Fonctionnalités

### 1. **Services DIRIS**

Contrôlez les services d'acquisition en temps réel :

#### Service d'Acquisition
- ✅ **Statut** : En cours / Arrêté
- ▶️ **Démarrer** : Lance l'acquisition automatique
- ⏸️ **Arrêter** : Stoppe l'acquisition
- 📊 **Indicateur** : Dot de statut (vert = actif, rouge = arrêté)

#### Service de Rétention  
- ✅ **Statut** : Actif / Inactif
- 🧹 **Nettoyage manuel** : Déclenche la suppression des données anciennes
- 📅 **Programmé** : Nettoyage automatique quotidien à l'heure configurée

---

### 2. **Métriques d'acquisition en temps réel**

Tableau de bord avec 4 KPIs mis à jour toutes les 5 secondes :

| Métrique | Description | Couleur |
|----------|-------------|---------|
| **Points/seconde** | Nombre de mesures enregistrées par seconde | Vert |
| **Devices/seconde** | Nombre de devices interrogés par seconde | Bleu |
| **Latence P95** | 95e percentile de latence (ms) | Violet |
| **Devices actifs** | Nombre de devices en ligne | Vert |

---

### 3. **Statistiques de base de données**

Informations détaillées sur le stockage DIRIS :

- 📊 **Total mesures** : Nombre total d'enregistrements dans `DIRIS.Measurements`
- ⚠️ **À supprimer** : Mesures dépassant la durée de rétention
- 💾 **Taille BDD** : Espace occupé par les tables DIRIS
- 📅 **Mesure la plus ancienne** : Date/heure de la plus vieille mesure
- 🕐 **Mesure la plus récente** : Date/heure de la dernière mesure

---

### 4. **Configuration DIRIS**

Paramètres ajustables en temps réel :

#### Acquisition
- **Parallélisme** (1-20) : Nombre de devices interrogés simultanément
  - Défaut : `6`
  - Recommandé : 6-12 selon la puissance du serveur
  
- **Intervalle de poll** (500-10000 ms) : Délai entre chaque interrogation
  - Défaut : `1500 ms`
  - Plus court = plus de données, plus de charge
  
- **Taille max des lots** (100-5000) : Points par lot SQL
  - Défaut : `1000`
  - Plus grand = moins d'insertions SQL, plus de RAM

#### Rétention des données
- **Durée de rétention** (1-365 jours) : Conservation des mesures
  - Défaut : `10 jours`
  
- **Heure de nettoyage** (0-23) : Heure du nettoyage quotidien
  - Défaut : `2h` (2h du matin)
  
- **Activer le nettoyage** : Checkbox pour activer/désactiver

💾 **Bouton Sauvegarder** : Applique les modifications

> ⚠️ **Note** : La sauvegarde de configuration nécessite le redémarrage du serveur pour prendre effet.

---

### 5. **Devices DIRIS**

Liste de tous les équipements DIRIS configurés :

**Informations affichées** :
- 🟢/🔴 Indicateur d'état (activé/désactivé)
- 📛 Nom du device
- 🌐 Adresse IP
- ⏱️ Intervalle de poll (ms)

**Actions disponibles** :
- 🔍 **Test** : Effectue une lecture test immédiate
- ▶️/⏸️ **Activer/Désactiver** : Change l'état du device
- ➕ **Ajouter** : Créer un nouveau device

**Exemple d'affichage** :
```
🟢 DIRIS-001
   192.168.2.133 • Poll: 1500ms
   [🔍 Test] [⏸️ Désactiver]
```

---

### 6. **Dernières mesures**

Vue en temps réel des 10 dernières acquisitions :

**Par device** :
- Nom du device
- Nombre de signaux
- Grid avec les 6 derniers signaux :
  - Nom du signal
  - Valeur + unité (ex: `312.45 A`)

**Exemple** :
```
DIRIS-001 • 15 signaux
┌─────────────┬─────────────┬─────────────┐
│ I_PH1_255   │ I_PH2_255   │ I_PH3_255   │
│ 312.45 A    │ 310.22 A    │ 315.67 A    │
├─────────────┼─────────────┼─────────────┤
│ U_PH1_255   │ U_PH2_255   │ U_PH3_255   │
│ 398.5 V     │ 397.8 V     │ 399.2 V     │
└─────────────┴─────────────┴─────────────┘
```

---

## 🔄 Rafraîchissement automatique

- ⏱️ **Intervalle** : 5 secondes
- 🎯 **Sections rafraîchies** :
  - Métriques d'acquisition
  - Statistiques BDD
- 🔄 **Bouton** : Actualiser manuellement

---

## 🎨 Interface

### Design
- **Thème** : Dark mode avec glassmorphism
- **Couleurs** :
  - 🟢 Vert : Succès, actif, en ligne
  - 🔴 Rouge : Erreur, arrêté, hors ligne
  - 🟠 Orange : Warning, à nettoyer
  - 🔵 Bleu : Info, métriques
  - 🟣 Violet : Latence

### Responsive
- ✅ Desktop (optimisé)
- ✅ Tablette
- ✅ Mobile (grids adaptées)

---

## 🔌 API Backend utilisées

### Endpoints DIRIS
```
GET    /api/diris/metrics/acquisition    # Métriques temps réel
GET    /api/diris/metrics/system          # Métriques système
GET    /api/diris/devices                 # Liste devices
POST   /api/diris/devices/{id}/poll       # Test device
GET    /api/diris/readings/latest         # Dernières mesures
GET    /api/diris/cleanup/stats           # Stats BDD
POST   /api/diris/cleanup                 # Nettoyage manuel
```

### Endpoints Admin
```
GET    /api/admin/config                  # Configuration actuelle
```

---

## ⚙️ Configuration Backend

Les paramètres sont définis dans `appsettings.json` :

```json
{
  "Acquisition": {
    "Parallelism": 6,
    "DefaultPollIntervalMs": 1500,
    "MaxBatchPoints": 1000
  },
  "DataRetention": {
    "Enabled": true,
    "RetentionDays": 10,
    "CleanupHour": 2
  }
}
```

---

## 📊 Monitoring

### Métriques à surveiller

| Métrique | Valeur normale | Action si anormal |
|----------|---------------|-------------------|
| Points/seconde | 100-2000 | Vérifier devices actifs |
| Latence P95 | < 500ms | Réduire parallélisme |
| Devices actifs | = Total configuré | Vérifier réseau/IP |
| Mesures à supprimer | < 50% du total | Ajuster rétention |

### Alertes recommandées

- 🚨 **Critique** : Aucun point reçu pendant > 5 min
- ⚠️ **Warning** : Latence P95 > 1000ms
- 💡 **Info** : Nettoyage terminé

---

## 🔐 Sécurité

- 🔒 **Authentification** : JWT requis (héritée de l'admin)
- 🔑 **Permissions** : Admin uniquement
- 📝 **Audit** : Toutes les actions sont loggées

---

## 🐛 Dépannage

### Aucune donnée affichée
1. Vérifier que le serveur API_ATF_MOBILE est démarré
2. Vérifier que les services DIRIS sont actifs
3. Vérifier la connectivité réseau vers les devices
4. Consulter les logs : `logs/app-*.log`

### Erreur "Failed to fetch"
1. Vérifier l'URL de l'API (`http://localhost:8088`)
2. Vérifier le token JWT (valide 8h)
3. Vérifier CORS dans `Program.cs`

### Latence élevée
1. Réduire le parallélisme dans la config
2. Augmenter l'intervalle de poll
3. Vérifier la charge du serveur
4. Vérifier la qualité réseau

---

## 📝 Développement

### Architecture Frontend

```
admin/
├── index.html                 # Page principale (+ section DIRIS)
└── js/
    ├── admin.js              # Orchestration (navigation, init)
    └── diris-manager.js      # Module DIRIS (nouveau)
```

### Module DirisManager

**Classe** : `DirisManager`

**Méthodes principales** :
- `init()` : Initialisation
- `loadAllData()` : Charge toutes les données
- `loadMetrics()` : Métriques acquisition
- `loadDatabaseStats()` : Stats BDD
- `loadConfiguration()` : Config actuelle
- `loadDevices()` : Liste devices
- `loadLatestReadings()` : Dernières mesures
- `startAutoRefresh(ms)` : Démarre auto-refresh
- `stopAutoRefresh()` : Arrête auto-refresh

### Extension future

Pour ajouter une fonctionnalité :

1. Ajouter l'élément HTML dans `index.html` (section-diris)
2. Créer la méthode dans `diris-manager.js`
3. Appeler depuis `loadAllData()` ou event listener
4. Créer l'endpoint backend si nécessaire

---

## ✅ Checklist Utilisation

- [ ] Accéder à l'onglet DIRIS
- [ ] Vérifier que l'acquisition est active (dot vert)
- [ ] Consulter les métriques en temps réel
- [ ] Vérifier le nombre de devices actifs
- [ ] Consulter les statistiques BDD
- [ ] Tester un device manuellement
- [ ] Vérifier les dernières mesures
- [ ] Ajuster la configuration si nécessaire
- [ ] Déclencher un nettoyage manuel (optionnel)
- [ ] Vérifier que les données sont bien enregistrées

---

## 📚 Documentation associée

- [README principal](README.md)
- [Intégration DIRIS](../INTEGRATION_DIRIS.md)
- [Documentation API DIRIS](../DIRIS_Server/docs/API.md)
- [Architecture DIRIS](../DIRIS_Server/docs/ARCHITECTURE.md)

---

**Version** : 1.0  
**Date** : 6 octobre 2025  
**Auteur** : Intégration DIRIS dans API_ATF_MOBILE

