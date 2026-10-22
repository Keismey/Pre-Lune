# Pré-Lune · GDD v1 · 02 Progression

## Cartes

<!-- section : cartes -->

Quatre cartes aux contraintes différentes, plus la carte du défi du jour. Les obstacles sont infranchissables sans pont ou tunnel.

| Carte | Rang requis | Disposition | Ce qu'elle change |
|---|---|---|---|
| La Plaine | 1 | 20 × 30 cases libres, 10 à 14 groupes d'obstacles (arbres, rochers de 1 à 4 cases) | Apprentissage : le tracé est libre, les obstacles forcent seulement quelques détours |
| Le Fleuve | 2 | Rivière sinueuse de 2 cases de large qui coupe la carte du nord au sud, 2 ponts de pierre déjà posés (non effaçables) | Les chaumières et ateliers apparaissent des deux côtés : tout le trafic passe par 2 goulets, le cadeau Pont devient précieux |
| Les Montagnes | 3 | 2 massifs de 6 × 8 cases en diagonale, 3 cols de 2 cases de large | Les cols saturent vite ; le Tunnel est deux fois plus fréquent |
| L'Île | 4 | Zone jouable d'environ 250 cases (14 × 22) entourée de mer, plafond de 20 bâtiments | Peu de place : les bâtiments se touchent presque, il faut optimiser chaque case |
| La Plaine du jour | 2 | Comme la Plaine, mais les obstacles viennent de la graine du jour | Voir l'onglet Défi du jour |

### Règles communes

- Chaque carte garde son meilleur score et son plus grand nombre de journées.
- Les cartes sont décrites en données (`maps.json`) : masque d'obstacles, ponts de départ, graine, plafonds. Ajouter une carte ne demande aucun code.
- Les saisons (Printemps, Automne, Hiver, Nuit) changent seulement l'apparence du terrain et se débloquent avec les rangs.

## Défi du jour

<!-- section : defi -->

- **Principe :** une carte (La Plaine du jour) et des tirages identiques pour tous les joueurs, calculés à partir de la date, sans serveur ni compte.
- **Graine :** `fnv1a("pl-" + règles_version + "-" + AAAA-MM-JJ en UTC)`, puis trois sous-flux (carte, apparitions, cadeaux). Un changement de règles change la graine pour éviter les parties incohérentes entre versions.
- **Tentatives :** 3 par jour, la meilleure compte. Le jour change à minuit UTC (1 h ou 2 h du matin en France selon la saison, à indiquer dans l'écran).
- **Récompense :** un badge du jour et une série de jours d'affilée. Il n'y a pas de monnaie dans le jeu, donc aucun gain à exploiter.
- **Historique :** les 7 derniers jours avec le meilleur score de chacun, dans le Carnet.
- **Équité :** les propositions de cadeaux et les couleurs d'apparition sont identiques. Une position de bâtiment occupée par un chemin est sautée au profit de la suivante de la liste, donc deux parties peuvent différer légèrement. Le classement reste personnel, ce qui suffit.
- **Disponibilité :** à partir du rang 2.

## Progression

<!-- section : progression -->

Pas de monnaie ni d'achats : la progression ouvre des cartes, des saisons et des cadeaux, et se mesure aux livraisons cumulées de toutes les parties.

### Rangs du hameau (5)

| Rang | Livraisons cumulées | Débloque |
|---|---|---|
| 1 · Hameau | 0 | La Plaine, saison Printemps |
| 2 · Village | 300 | Le Fleuve, défi du jour, saison Automne |
| 3 · Bourg | 1 000 | Les Montagnes, cadeau Tunnel, saison Hiver |
| 4 · Cité | 2 500 | L'Île, saison Nuit |
| 5 · Capitale | 6 000 | Titre de Capitale et 3 textures de chemins (pierre, bois, pavés lumineux) |

- Une première partie de 5 à 8 minutes rapporte environ 250 à 400 livraisons : le Village arrive vers la première ou deuxième partie, la Cité après une dizaine.
- Le passage de rang s'affiche à la fin de la partie, avec ce qu'il ouvre.

### Succès (10)

- Première livraison : livrer une créature.
- Journée tranquille : finir une journée sans qu'aucune file ne dépasse 3.
- Cinq minutes : tenir 5 minutes.
- Cent : 100 livraisons dans une seule partie.
- Roi du rond-point : poser 10 ronds-points au total.
- Sous la montagne : utiliser un tunnel.
- À un cheveu : sortir d'une panique avec 1 s ou moins au compteur.
- Six couleurs : voir les six couleurs dans une même partie.
- Série en or : défi du jour 7 jours d'affilée.
- Capitale : atteindre le rang 5.

### Statistiques du Carnet

- Livraisons cumulées et rang, meilleur score et plus longue partie par carte, succès, historique des 7 derniers défis.

### Réglages par défaut

- Son 80 %, musique 60 %, vibration activée, aide au tracé activée, décalage du curseur désactivé, mode gaucher désactivé, animations réduites désactivées, langue automatique.
- Effacer la sauvegarde demande deux confirmations. Une petite ligne « Soutenir le studio » renvoie vers la page Ko-fi dans Réglages, sans fenêtre ni rappel.
