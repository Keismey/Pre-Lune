# Pré-Lune · GDD v1 · 01 Gameplay

## Gameplay

<!-- section : gameplay -->

> **Boucle d'une partie** : une carte vide → des bâtiments apparaissent → tu traces les chemins → les créatures livrent → la **journée** (40 s) se termine → tu choisis **1 cadeau sur 3** → journée suivante, plus chargée → jusqu'à la brume.

### Ce que le joueur fait

| Geste | Comment | Effet |
|---|---|---|
| Tracer | Poser le doigt sur une chaumière, un atelier ou un chemin existant, puis glisser. Le chemin suit le doigt librement (courbes, diagonales), sans grille. Il se raccorde tout seul aux chemins et aux bâtiments proches. | Le chemin coûte 1 dalle par 54 px de longueur neuve. Partir d'un chemin existant crée un embranchement. Repasser le doigt sur son propre tracé le défait et rend les dalles. |
| Effacer | Toucher brièvement un tronçon (moins de 200 ms, sans glisser). | Le tronçon entre deux croisements disparaît et rend ses dalles. Un bouton Annuler le ramène pendant 4 s. |
| Croiser | Tracer à travers un autre chemin. | Un croisement apparaît tout seul. Les créatures y passent une par une, donc il ralentit quand il est chargé. |
| Poser un cadeau | Toucher son emplacement dans la barre du bas, puis la cible surlignée (ou le glisser dessus). | Rond-point, pont, feu, tunnel, chemin doré, etc. (voir Bonus). |
| Voir qui va où | Appui long sur un bâtiment. | Son partenaire de même couleur s'illumine, avec un pointillé entre les deux. |
| Pause | Bouton en haut à gauche. | Le jeu s'arrête, on peut regarder la carte. |

### Le trafic

- Chaque chaumière fabrique une créature à intervalle régulier. Elle prend le plus court chemin vers un atelier de sa couleur, recalculé quand le réseau change.
- Pas de dépassement : une créature lente retient celles qui la suivent. Les créatures se serrent et attendent plutôt que de se chevaucher.
- Si une chaumière n'a aucune route vers un atelier de sa couleur, ou si la route est saturée, ses créatures s'accumulent dans une **file d'attente** visible sur un anneau de 10 pastilles.

### La défaite : la brume

1. Une file atteint **10 créatures** : un compteur de panique de **10 s** démarre, avec un anneau rouge qui se vide et une brume violette qui monte sur les bords de l'écran.
2. Si la file redescend à **7** ou moins avant la fin, le compteur s'arrête et repart de 10 s au prochain débordement.
3. Si le compteur arrive à zéro, la partie s'arrête. Le score est le nombre de livraisons réussies.

### Une main, un pouce

- Les actions fréquentes (cadeaux, annuler) sont dans la barre du bas, à portée du pouce. Seule la pause est en haut.
- **Aide au tracé** (active par défaut) : le temps passe à moitié vitesse tant que le doigt est posé, pour tracer sans stress.
- Option de décalage du curseur au-dessus du doigt, pour voir la pointe du tracé (à trancher en test en V0).
- Aucune manipulation à deux doigts, aucun zoom : la carte entière tient à l'écran.

### Ce qui doit être satisfaisant

- Le tracé s'allume à mesure que le doigt avance, avec un léger rebond à chaque segment posé.
- Chaque livraison fait tinter une clochette, dont la note dépend de la couleur : un réseau qui fonctionne bien joue une petite mélodie.
- Un croisement qui se vide, un rond-point posé au bon moment : la file diminue à vue d'œil.

## Specs (valeurs de départ)

<!-- section : specs -->

Monde logique 1080 × 1920 mis à l'échelle de l'écran, devicePixelRatio plafonné à 2. Toutes les valeurs vivent dans `balance.json` et sont à ajuster en test.

### Écran et grille

| Élément | Valeur | Remarque |
|---|---|---|
| Barre du haut | 130 px | Pause, journée et horloge, dalles, livraisons |
| Grille | 20 × 30 cases de 54 px (1080 × 1620), invisible | Elle sert à poser les bâtiments, les obstacles et l'eau, et d'unité de mesure : une « case » vaut 54 px de chemin. Les chemins, eux, ne suivent pas la grille. |
| Barre du bas | 170 px | Annuler et emplacements de cadeaux, boutons d'au moins 48 px à l'écran |
| Bâtiment | 2 × 2 cases | Zone d'appui pour démarrer un tracé : 1,5 case autour du centre. Maximum 3 chemins reliés par bâtiment. |

### Journées et ressources

| Paramètre | Valeur |
|---|---|
| Durée d'une journée | 40 s de temps de jeu. Pendant un tracé, le temps passe à moitié vitesse (aide au tracé) : la journée dure alors un peu plus longtemps en vrai. |
| Dalles au départ | 40 |
| Dalles gagnées par journée | +18, plafond de 120 |
| Coût d'un chemin | 1 dalle par 54 px de chemin neuf (les dalles sont comptées au dixième, l'affichage arrondit vers le bas). Repasser sur un chemin existant ne coûte rien. |
| Effacer | 100 % des dalles rendues |
| Annuler | Dernière action (tracé, effacement ou pose), disponible 4 s |
| Pause de fin de journée | Le jeu s'arrête pendant le choix du cadeau |

### Créatures et files

| Paramètre | Valeur |
|---|---|
| Cadence d'une chaumière | 1 créature toutes les `max(3,5 ; 6,0 × 0,96^(journée − 1))` s, soit 6 s en journée 1 et 3,5 s dès la journée 14. Première créature 2 s après l'apparition. |
| Vitesse de base | 2,2 cases par seconde (détail par espèce dans l'onglet Créatures) |
| Écart entre deux créatures | 0,7 case × taille de l'espèce |
| File d'attente max visible | 10 pastilles |
| Seuil de panique | 10 créatures en attente ; compteur de 10 s ; arrêt du compteur à 7 ou moins |
| Déchargement d'un atelier | 1 créature toutes les 0,8 s |
| Choix du destinataire | L'atelier de la couleur le plus rapide à atteindre, recalculé à chaque changement de réseau |

### Croisements et routes spéciales

| Élément | Règle |
|---|---|
| Croisement (point où 3 chemins ou plus se rejoignent) | Une créature à la fois, 0,30 s de traversée, premier arrivé premier servi. Une créature n'entre que si la case de sortie a de la place. |
| Rond-point | 2 créatures en même temps, 0,30 s : débit doublé |
| Feu de lanterne | Les axes alternent toutes les 2 s, traversée de 0,10 s sur l'axe vert : débit moyen environ ×1,5 |
| Pont | Le chemin passe par-dessus un autre chemin sans croisement, ou franchit 1 à 3 cases d'eau |
| Tunnel | Deux portails en ligne droite à 6 cases au plus l'un de l'autre, sous n'importe quel obstacle |
| Chemin doré | Jusqu'à 8 cases consécutives où la vitesse est multipliée par 1,5, de façon permanente |

### Apparition des bâtiments

- Un **chantier** (panneau et poussière) annonce chaque bâtiment 4 s à l'avance. Pendant ce temps, la zone est réservée : on ne peut plus y tracer.
- Position : case libre à au moins 2 cases vides de tout autre bâtiment (1 case en dernier recours quand la carte est pleine), à 2 cases des bords, hors obstacles, à l'écart des chemins déjà tracés. La chaumière et l'atelier de la même couleur sont à 6 cases minimum et 20 cases maximum l'un de l'autre (distance en cases, déplacements horizontaux plus verticaux).
- Règle de proportion : au plus 3 chaumières par atelier d'une même couleur.
- Plafond de 26 bâtiments par carte (20 sur l'île).

| Journée | Apparitions | Total après la journée |
|---|---|---|
| 1 | 0 s : chaumière + atelier bleus ; 18 s : chaumière + atelier rouges | 2 chaumières, 2 ateliers, 2 couleurs |
| 2 | 10 s : chaumière bleue | 3 / 2 |
| 3 | 8 s : chaumière rouge ; 24 s : atelier bleu | 4 / 3 |
| 4 | 5 s : chaumière + atelier jaunes | 5 / 4, 3 couleurs |
| 5 | 12 s : chaumière jaune ; 28 s : atelier rouge | 6 / 5 |
| 6 | 10 s : chaumière bleue ; 25 s : chaumière rouge | 8 / 5 |
| 7 | 5 s : chaumière + atelier verts ; 28 s : chaumière jaune | 10 / 6, 4 couleurs |
| 8 et suivantes | 1 bâtiment à 20 s (70 % chaumière, 30 % atelier, en respectant la règle de proportion) | +1 par journée |
| 10 | 5 s : chaumière + atelier violets, en plus du bâtiment habituel | 5 couleurs |
| 13 | 5 s : chaumière + atelier orange, en plus du bâtiment habituel | 6 couleurs |

### Score et fin

- Score : nombre de livraisons réussies. On retient aussi le nombre de journées tenues.
- Cible de durée : 5 à 8 minutes en moyenne, soit 9 à 12 journées. Les très bonnes parties durent plus longtemps.

### Générateur aléatoire

- Générateur à graine (mulberry32), jamais `Math.random()` dans le jeu. Trois flux séparés : `carte` (obstacles), `apparitions` (positions et couleurs des bâtiments) et `cadeaux` (propositions de fin de journée), pour que les décisions du joueur ne décalent pas les tirages. Seule exception : une position de bâtiment occupée par un chemin est sautée au profit de la suivante de la liste.
- Simulation à pas fixe de 1/30 s, avec rendu interpolé.

## Bonus : les cadeaux du hameau

<!-- section : bonus -->

À la fin de chaque journée, le hameau propose 3 cadeaux différents tirés au hasard. On en prend un seul. Une relance par partie.

| Cadeau | Rareté (poids) | Effet | Précisions |
|---|---|---|---|
| Sac de dalles | Commun (24) | +20 dalles tout de suite | Le plafond de 120 ne limite que le gain automatique de fin de journée, pas ce cadeau |
| Rond-point | Commun (22) | Se pose sur un croisement : 2 créatures à la fois | 1 par cadeau |
| Pont | Commun (18) | Passe par-dessus un chemin, ou franchit 1 à 3 cases d'eau | 2 poses par cadeau |
| Feu de lanterne | Peu commun (12) | Fait alterner les axes d'un croisement, débit moyen ×1,5 | 1 par cadeau |
| Chemin doré | Peu commun (10) | 8 cases de chemin à vitesse ×1,5 | Se pose sur des cases de chemin existantes |
| Tunnel | Rare (6) | Deux portails reliés, 6 cases au plus, sous n'importe quel obstacle | Poids doublé (12) sur la carte Montagnes |
| Cloche de secours | Rare (4) | Vide 5 créatures de la file d'un bâtiment et remet son compteur de panique à zéro | Poids ×3 si un bâtiment a au moins 6 créatures en attente à la fin de la journée |
| Atelier de renfort | Rare (4) | Pose un atelier supplémentaire de la couleur de ton choix, à l'endroit que tu choisis | Respecte la distance minimale de 3 cases entre bâtiments |

### Règles

- Poids total de 100 : 64 % de communs, 22 % de peu communs, 14 % de rares.
- Le Tunnel n'est proposé qu'à partir du rang 3 (voir Progression), les autres dès la première partie.
- Les cadeaux se rangent dans la barre du bas : 6 emplacements au maximum. Si elle est pleine, il faut en jeter un pour en prendre un nouveau.
- Un cadeau non posé reste d'une journée à l'autre.
- Le tirage utilise le flux `cadeaux` : dans le défi du jour, tout le monde voit les mêmes propositions.
