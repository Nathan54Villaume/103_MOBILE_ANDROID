# Système de Courbes - Architecture Robuste

## Vue d'ensemble

Ce système remplace l'ancienne gestion des courbes par une architecture modulaire, testable et performante.

### Objectifs principaux
- Pan horizontal à la souris (sans CTRL)
- Zoom molette sur axe X/Y selon position
- Reset fiable sans dé-zoom au-delà des données
- Menu contextuel par courbe (API `/signals`)
- Tooltips HH:mm:ss + crosshair
- Persistance localStorage
- Aucun reset intempestif

## Architecture

```
charts/
├── core/
│   ├── ChartHost.js          # Fabrique Chart.js + API principale
│   ├── ZoomPanController.js  # Contrôleur zoom/pan custom
│   └── DataManager.js        # Gestion datasets, décimation, bounds
├── ui/
│   ├── ContextMenu.js        # Menu contextuel (clic droit)
│   ├── CrosshairPlugin.js    # Plugin crosshair vertical
│   └── TooltipFormatter.js   # Formatage tooltips HH:mm:ss
├── utils/
│   ├── formatters.js         # Formatage dates, unités, nombres
│   ├── persist.js           # localStorage par carte
│   └── api.js               # Abstraction API signals/series
└── index.js                 # Point d'entrée, bootstrap
```

## Étape 1 - État actuel ✅

### ChartHost.js - Fabrique principale
- Instance Chart.js avec thème sombre
- API simple : `setData()`, `resetView()`, `getView()`, `setView()`
- Calcul automatique des bornes globales
- Tooltips formatés HH:mm:ss
- Décimation pour performances

### index.js - Bootstrap
- Registre global des instances
- Utilitaires de gestion (`initChart`, `updateChart`, `resetChart`)
- Générateur de données de test

### demo-charts.html
- Interface minimal avec 2 cartes (TR1/TR2)
- Boutons Reset/Export par carte
- Bouton Paramètres flottant
- Footer avec timestamp + auteur

## Comment tester l'Étape 1

1. Ouvrir `demo-charts.html` dans un navigateur
2. Vérifier que 2 courbes s'affichent avec données sinusoïdales
3. Bouton "Reset" → doit restaurer la vue complète
4. Console → aucune erreur, logs de confirmation
5. Responsive → courbes s'adaptent à la taille

### Critères OK/KO

✅ **OK si :**
- Les 2 courbes s'affichent correctement
- Tooltips affichent HH:mm:ss + valeurs
- Bouton Reset fonctionne
- Aucune erreur console
- Thème sombre cohérent

❌ **KO si :**
- Courbes vides ou erreur d'affichage
- Tooltips cassés ou mal formatés
- Reset sans effet
- Erreurs JavaScript
- Interface illisible

## API ChartHost

```javascript
// Initialisation
const host = new ChartHost('canvas-id', options);

// Données
host.setData([
  {
    label: 'Signal 1',
    data: [{x: timestamp, y: value}, ...],
    borderColor: '#6366f1',
    unit: 'kW'
  }
]);

// Navigation
host.resetView();                    // Reset complet
const view = host.getView();         // {x: {min, max}, y: {min, max}}
host.setView({x: {min, max}});       // Zoom sur plage

// Nettoyage
host.destroy();
```

## Prochaines étapes

### Étape 2 - Zoom/Pan (en cours de développement)
- Intégration `chartjs-plugin-zoom` ou contrôleur custom
- Pan horizontal (clic + glisser)
- Molette : zoom X/Y selon position
- Hard bounds pour éviter dé-zoom excessif

### Étape 3 - Crosshair + Tooltips avancés
- Plugin crosshair vertical
- Format HH:mm:ss garanti
- Unités dans les tooltips

### Étape 4 - Menu contextuel
- Clic droit → menu flottant
- API `/signals` pour liste dynamique
- Multi-sélection avec checkbox
- Focus management + accessibilité

### Étape 5 - Persistance
- localStorage par carte
- Sauvegarde : signaux, zoom, état replié
- Restauration au chargement

## Intégration avec l'existant

### Remplacement progressif
1. Garder l'ancienne version en parallèle
2. Basculer carte par carte
3. Migration des configurations existantes
4. Tests de non-régression

### Points d'attention
- API `/signals` doit retourner `{id, label, unit, group}`
- Données temps réel via WebSocket ou polling
- Performance sur datasets > 10k points

## Notes de développement

- **Pas d'animation Chart.js** → `animation: false` pour la perf
- **parsing: false** → données pré-formatées `{x: timestamp, y: number}`
- **Décimation automatique** → Chart.js gère les gros datasets
- **Hard bounds** → `originalBounds` calculées à chaque `setData()`
- **Theme sombre** → couleurs cohérentes dans `ChartHost`
