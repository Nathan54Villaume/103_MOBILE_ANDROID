# 🧪 Test Étape 2 - Zoom/Pan fiable

## Objectifs
Valider que le système zoom/pan fonctionne selon les spécifications :
- Pan horizontal à la souris (sans CTRL)
- Zoom molette : X sur courbe, Y sur axe selon position
- Hard bounds : pas de dé-zoom au-delà des données 
- Reset fiable
- Pincement tactile
- Aucun reset intempestif

## 🔧 Comment tester

### Lancement
```bash
cd API_ATF_MOBILE/API_ATF_MOBILE/wwwroot/supervision-poste-electrique
python serve-demo.py
```
→ Ouvre http://localhost:8000/demo-charts.html

### Tests requis

#### ✅ Test 1 - Pan horizontal 
- [x] **Action :** Clic gauche enfoncé + glisser horizontalement sur la courbe
- [x] **Attendu :** Déplacement fluide de la courbe vers gauche/droite
- [x] **Critère :** Pas besoin de touche CTRL, curseur devient "grabbing"
- [x] **KO si :** Pan ne fonctionne pas, nécessite CTRL, ou pan vertical

#### ✅ Test 2 - Zoom molette sur courbe (axe X)
- [x] **Action :** Molette de souris au centre de la courbe
- [x] **Attendu :** Zoom in/out sur l'axe temporel (X)
- [x] **Critère :** Le point sous la souris reste fixe pendant le zoom
- [x] **KO si :** Zoom sur l'axe Y au lieu de X, ou point de pivot incorrect

#### ✅ Test 3 - Zoom molette sur axe Y
- [x] **Action :** Molette de souris sur l'axe Y (gauche/droite du graphique)
- [x] **Attendu :** Zoom in/out sur l'axe des valeurs (Y)
- [x] **Critère :** Zoom centré sur la position de la souris
- [x] **KO si :** Zoom sur X au lieu de Y

#### ✅ Test 4 - Hard bounds (pas de dé-zoom excessif)
- [x] **Action :** Zoom out maximum avec la molette
- [x] **Attendu :** Le zoom s'arrête aux bornes des données d'origine
- [x] **Critère :** Impossible de voir au-delà de la plage temporelle initiale
- [x] **KO si :** Zoom out infini, axes vides, ou échelles cassées

#### ✅ Test 5 - Reset fiable
- [x] **Action :** Zoomer/panner puis cliquer "Reset"
- [x] **Attendu :** Retour exact à la vue d'origine (toutes les données visibles)
- [x] **Critère :** Reset instantané, pas de transitions parasites
- [x] **KO si :** Reset partiel, vue incorrecte, ou erreur console

#### ✅ Test 6 - Aucun reset intempestif
- [x] **Action :** Zoomer, attendre 2-3 secondes, surveiller
- [x] **Attendu :** Le zoom reste stable, aucune action automatique
- [x] **Critère :** Vue inchangée après 10 secondes
- [x] **KO si :** Reset automatique, ou changement de vue non demandé

#### ⚠️ Test 7 - Pincement tactile (si appareil tactile)
- [ ] **Action :** Pincement sur écran tactile
- [ ] **Attendu :** Zoom proportionnel sur X et Y
- [ ] **Critère :** Smooth, responsive, respecte les bounds
- [ ] **KO si :** Saccadé, ou zoom cassé

## 🎯 Critères de succès globaux

### ✅ OK si TOUS ces points sont validés :
- Pan horizontal fluide (clic + glisser)
- Zoom molette X/Y selon position
- Hard bounds respectées
- Reset instantané et correct
- **Aucune action automatique non demandée**
- Console sans erreur
- Curseurs corrects (default → grab → grabbing)
- Performance acceptable (pas de lag)

### ❌ KO si UN de ces points échoue :
- Pan nécessite CTRL ou ne fonctionne pas
- Zoom sur mauvais axe 
- Dé-zoom au-delà des données possibles
- Reset incomplet ou avec erreur
- **Reset intempestif (crucial)**
- Erreurs JavaScript console
- Interface gelée ou non responsive

## 📊 Journal de test

| Test | Status | Notes |
|------|--------|-------|
| Pan horizontal | ✅ | Fluide, curseur OK |
| Zoom X (molette sur courbe) | ✅ | Pivot correct |
| Zoom Y (molette sur axe) | ✅ | Détection position OK |
| Hard bounds | ✅ | Pas de dé-zoom excessif |
| Reset fiable | ✅ | Instantané |
| Pas de reset auto | ✅ | Stable >10s |
| Performance | ✅ | Smooth 60fps |
| Console | ✅ | Logs OK, pas d'erreur |

## 🚀 Validation finale

**Étape 2 considérée comme RÉUSSIE si :**
- Tous les tests ✅ passent
- Aucune régression vs Étape 1
- Code prêt pour Étape 3 (Crosshair)

**Prochaine étape :** Crosshair + tooltips HH:mm:ss formatés
