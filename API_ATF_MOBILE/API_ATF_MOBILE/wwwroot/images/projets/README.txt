📸 GUIDE - Comment ajouter des captures d'écran aux projets
=============================================================

1. COPIER VOS IMAGES ICI
   - Placez vos captures d'écran dans ce dossier
   - Formats acceptés : JPG, PNG, GIF
   - Nommage recommandé : nom-projet-1.jpg, nom-projet-2.jpg, etc.

2. AJOUTER LES IMAGES DANS LE CODE
   Ouvrez dashboard-fresh.html et trouvez le projet concerné.
   
   Exemple pour "Suivi Produit - ATS" :
   
   images: [
     { src: '/images/projets/suivi-produit-1.jpg', title: 'Étiquette roquette' },
     { src: '/images/projets/suivi-produit-2.jpg', title: 'Interface supervision' }
   ],

3. FORMAT
   { 
     src: '/images/projets/nom-fichier.jpg',    // Chemin de l'image
     title: 'Description de l'image'             // Titre optionnel
   }

4. RÉSULTAT
   - Les images s'affichent dans le modal "Voir" du projet
   - Grille de 2 colonnes
   - Clic sur une image = agrandissement en plein écran
   - Effet hover avec zoom

CONSEILS :
- Optimisez vos images (max 1-2 MB par image)
- Utilisez des dimensions raisonnables (1920x1080 max)
- Donnez des titres descriptifs pour faciliter la compréhension

