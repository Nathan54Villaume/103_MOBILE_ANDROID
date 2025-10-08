# 🚀 Supervision Poste Electrique - Version Tesla

## 📋 Description

Version refondue de l'interface de supervision électrique avec un design ultra-moderne inspiré de l'OS Tesla. Cette version conserve 100% de la fonctionnalité originale tout en apportant une expérience utilisateur révolutionnaire.

## ✨ Caractéristiques principales

### 🎨 Design System Tesla
- **Palette de couleurs** : Noir profond, gris sophistiqués, accents colorés
- **Glass Morphism** : Effets de verre avec blur et transparence
- **Typographie** : Inter font avec dégradés sur les titres
- **Animations** : Transitions fluides et effets de hover élégants

### 🏗️ Architecture améliorée
- **KPIs** : 2 lignes de 5 KPIs avec responsive intelligent
- **Courbes** : Toutes en format large (800x400px) pour une meilleure lisibilité
- **Layout** : Structure verticale optimisée pour le monitoring
- **Responsive** : Adaptation parfaite mobile/tablette/desktop

### 🔧 Fonctionnalités préservées
- **Monitoring temps réel** : Tous les graphiques et KPIs fonctionnels
- **Paramètres avancés** : Configuration API, réglages des courbes
- **Menus contextuels** : Sélection des signaux par clic droit
- **Zoom/Pan** : Navigation fluide dans les graphiques
- **Persistence** : Sauvegarde des préférences utilisateur

## 📁 Structure des fichiers

```
Supervision-Poste-Electrique_Dev/
├── index.html              # Interface principale Tesla
├── style.css               # Styles Tesla + compatibilité
├── js/                     # Scripts JavaScript
│   ├── main.js            # Point d'entrée principal
│   ├── charts.js          # Gestion des graphiques
│   ├── api.js             # Communication API
│   ├── kpi.js             # Gestion des KPIs
│   └── ...                # Autres modules
├── charts/                 # Système de graphiques avancé
│   ├── core/              # ChartHost, ZoomPanController
│   ├── ui/                # Plugins UI (Crosshair, Tooltip)
│   ├── api/               # SignalService
│   └── bridge/            # Pont de compatibilité
├── cors-proxy.py          # Proxy CORS pour développement
├── serve-demo.py          # Serveur de démonstration
└── README.md              # Cette documentation
```

## 🚀 Démarrage rapide

### Option 1 : Serveur Python intégré
```bash
cd Supervision-Poste-Electrique_Dev
python serve-demo.py
```
Puis ouvrir : http://localhost:8080

### Option 2 : Proxy CORS pour API distante
```bash
cd Supervision-Poste-Electrique_Dev
python cors-proxy.py
```
Puis ouvrir : http://localhost:8088

### Option 3 : Serveur web classique
Ouvrir directement `index.html` dans un navigateur moderne.

## 🎯 Améliorations apportées

### Interface utilisateur
- ✅ Design Tesla ultra-moderne
- ✅ Glass morphism et effets de profondeur
- ✅ Animations fluides et micro-interactions
- ✅ Typographie hiérarchisée avec dégradés
- ✅ Indicateurs LED avec effet de glow
- ✅ Scrollbar personnalisée

### Expérience utilisateur
- ✅ KPIs en 2 lignes de 5 (responsive)
- ✅ Courbes toutes en format large
- ✅ Navigation intuitive et accessible
- ✅ Feedback visuel immédiat
- ✅ Chargement progressif optimisé

### Performance
- ✅ CSS optimisé avec variables
- ✅ Transitions GPU-accelerated
- ✅ Lazy loading des composants
- ✅ Cache intelligent des données
- ✅ Décimation automatique des gros datasets

## 🔧 Configuration

### Variables Tesla personnalisables
```css
:root {
  --tesla-black: #000000;        /* Fond principal */
  --tesla-blue: #0066cc;         /* Couleur primaire */
  --tesla-green: #00aa44;        /* Succès/Connecté */
  --tesla-red: #d50000;          /* Erreur/Déconnecté */
  --tesla-amber: #ffaa00;        /* Attention */
  --tesla-purple: #6a0dad;       /* Accent secondaire */
}
```

### Configuration API
L'interface utilise la même configuration API que la version originale :
- Endpoint par défaut : `http://localhost:8088/proxy/http://10.250.13.4:8088/api/energy`
- Modifiable via le menu Paramètres (bouton engrenage)

## 📱 Compatibilité

### Navigateurs supportés
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Responsive breakpoints
- **Desktop** : > 1200px (2 lignes de 5 KPIs)
- **Tablette** : 900px - 1200px (2 lignes de 3 KPIs)
- **Mobile** : < 900px (1 colonne de KPIs)

## 🎨 Personnalisation

### Couleurs
Modifiez les variables CSS dans `style.css` pour adapter les couleurs à votre charte graphique.

### Layout
Ajustez les grilles KPIs en modifiant les classes `.tesla-grid` dans le CSS.

### Animations
Personnalisez les transitions via les variables `--tesla-transition`.

## 🔍 Debugging

### Console développeur
L'interface affiche des logs détaillés dans la console :
- `[ChartHost]` : Gestion des graphiques
- `[SignalService]` : Communication API
- `[Tesla]` : Événements interface

### Mode développement
Ajoutez `?debug=true` à l'URL pour activer le mode debug complet.

## 📞 Support

Pour toute question ou problème :
1. Vérifiez la console développeur
2. Consultez les logs de l'API
3. Testez avec les données de démonstration

---

**Version** : Tesla 1.0  
**Auteur** : N.Villaume  
**Date** : 2025  
**Compatibilité** : Supervision Poste Electrique v2.0+
