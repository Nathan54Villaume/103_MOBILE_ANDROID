# 🏭 Supervision Poste Électrique n°19

## 📋 Vue d'ensemble

Cette interface permet de surveiller les 5 transformateurs (TR1 à TR5) du Poste Électrique n°19.

## 🚀 Démarrage Rapide

### 1. **Tester l'API (Mode Démo)**
```bash
# Démarrer l'API
dotnet run

# Tester les endpoints
http://localhost:8088/api/energy_Poste_19/signals
http://localhost:8088/api/energy_Poste_19/demo/tr1/series
http://localhost:8088/api/energy_Poste_19/demo/tr3/series
http://localhost:8088/api/energy_Poste_19/demo/tr5/series
```

### 2. **Ouvrir l'Interface**
- **Interface complète** : `index.html`
- **Test API** : `test-api.html`
- **Test simple** : `test-poste-19.html`

## 🔧 Configuration

### **API Endpoints**
- **Base URL** : `http://10.250.13.4/api/energy_Poste_19`
- **Signaux** : `/signals`
- **Données transformateur** : `/tr{id}/series` (où id = 1-5)
- **Mode démo** : `/demo/tr{id}/series`

### **Transformateurs Supportés**
- **TR1** : Transformateur 1
- **TR2** : Transformateur 2  
- **TR3** : Transformateur 3
- **TR4** : Transformateur 4
- **TR5** : Transformateur 5

## 📊 Données Surveillées

Pour chaque transformateur :
- **P** : Puissance active (kW)
- **Q** : Puissance réactive (kvar)
- **PF** : Facteur de puissance
- **U12, U23, U31** : Tensions (V)
- **I1, I2, I3** : Courants (A)
- **E** : Énergie (kWh)

## 🗄️ Base de Données

### **Structure de Table Requise**
```sql
CREATE TABLE [dbo].[EnergyData_Poste19] (
    [Id] int IDENTITY(1,1) PRIMARY KEY,
    [Timestamp] datetime2 NOT NULL,
    [SignalId] nvarchar(50) NOT NULL,
    [TransformerId] int NOT NULL, -- 1-5 pour TR1-TR5
    [Value] float NOT NULL,
    [PosteId] int NOT NULL DEFAULT 19
);

-- Index pour les performances
CREATE INDEX IX_EnergyData_Poste19_Timestamp ON [dbo].[EnergyData_Poste19] ([Timestamp]);
CREATE INDEX IX_EnergyData_Poste19_SignalId ON [dbo].[EnergyData_Poste19] ([SignalId]);
CREATE INDEX IX_EnergyData_Poste19_TransformerId ON [dbo].[EnergyData_Poste19] ([TransformerId]);
```

### **Exemples de Données**
```sql
INSERT INTO [dbo].[EnergyData_Poste19] VALUES 
(GETDATE(), 'P_TR1', 1, 150.5, 19),
(GETDATE(), 'Q_TR1', 1, 45.2, 19),
(GETDATE(), 'U12_TR1', 1, 400.1, 19);
```

## 🧪 Mode Démo

Le mode démo génère des données de test réalistes :
- **Variations sinusoïdales** pour simuler les fluctuations
- **Valeurs différentes** par transformateur
- **Données temporelles** sur 60 minutes

### **Utilisation du Mode Démo**
```javascript
// Dans l'interface, modifier l'URL API
window.API_CONFIG.baseUrl = 'http://localhost:8088/api/energy_Poste_19/demo';
```

## 🔄 Migration depuis Poste 8

### **Différences Principales**
1. **Nombre de transformateurs** : 2 → 5
2. **API endpoint** : `/api/energy` → `/api/energy_Poste_19`
3. **Base de données** : Table séparée pour le Poste 19
4. **Couleurs** : 5 couleurs distinctes pour TR1-TR5

### **Fichiers Modifiés**
- `index.html` : Interface utilisateur
- `js/config.js` : Configuration API et transformateurs
- `js/main.js` : Logique d'application
- `js/api.js` : Appels API
- `js/charts.js` : Configuration des graphiques
- `js/kpi.js` : Définitions des KPIs

## 🐛 Dépannage

### **Problèmes Courants**

1. **Erreur 404 sur l'API**
   - Vérifier que le contrôleur `EnergyController_Poste19` est enregistré
   - Vérifier l'URL de base dans `config.js`

2. **Pas de données affichées**
   - Utiliser le mode démo pour tester
   - Vérifier la connexion à la base de données
   - Vérifier la structure de la table `EnergyData_Poste19`

3. **Erreurs JavaScript**
   - Ouvrir la console du navigateur (F12)
   - Vérifier les erreurs de chargement des modules

### **Logs de Debug**
```javascript
// Activer les logs détaillés
localStorage.setItem('debug', 'true');
```

## 📁 Structure des Fichiers

```
Supervision-Poste-Electrique_19/
├── index.html              # Interface principale
├── test-api.html           # Test des endpoints API
├── test-poste-19.html      # Test simple
├── README.md               # Ce fichier
└── js/
    ├── config.js           # Configuration
    ├── main.js             # Logique principale
    ├── api.js              # Appels API
    ├── charts.js           # Graphiques
    ├── kpi.js              # KPIs
    └── utils.js            # Utilitaires
```

## 🚀 Prochaines Étapes

1. **Configurer la base de données** avec les vraies données
2. **Tester avec des données réelles**
3. **Ajuster les seuils d'alarme** si nécessaire
4. **Configurer la surveillance automatique**

## 📞 Support

Pour toute question ou problème :
1. Vérifier les logs de l'API
2. Tester avec le mode démo
3. Consulter la console du navigateur
4. Vérifier la configuration de la base de données