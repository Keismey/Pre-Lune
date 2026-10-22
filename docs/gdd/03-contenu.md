# Pré-Lune · GDD v1 · 03 Contenu

## Créatures et bâtiments

<!-- section : creatures -->

Chaque couleur a aussi un symbole dessiné sur le toit de la chaumière, l'atelier et la créature, pour rester lisible sans distinguer les couleurs.

| Couleur | Créature | Elle livre | Atelier | Vitesse (cases/s) | Taille | Arrive |
|---|---|---|---|---|---|---|
| ● Bleu | Luciole | Pots de lumière | Lanternerie | 2,8 | 0,8 | Journée 1 |
| ▲ Rouge | Hérisson | Braises | Forge | 2,2 | 1,0 | Journée 1 |
| ■ Jaune | Escargot | Miel | Miellerie | 1,6 | 1,0 | Journée 4 |
| ◆ Vert | Golem de mousse | Terreau | Serre | 2,0 | 1,3 | Journée 7 |
| ★ Violet | Lutin | Poudre d'étoiles | Observatoire | 2,4 | 0,9 | Journée 10 |
| ⬢ Orange | Crapaud | Citrouilles | La Marmite | 2,0 | 1,0 | Journée 13 |

- La **taille** multiplie l'écart entre deux créatures : le golem prend plus de place dans une file, la luciole moins.
- Les vitesses différentes créent des ralentissements naturels, car on ne dépasse pas : un escargot devant une luciole la ralentit. C'est voulu, et c'est ce qui rend les chemins par couleur intéressants.
- Toutes les valeurs sont dans `species.json`. Pour simplifier l'équilibrage en test, un réglage `vitesses_uniques` met toutes les espèces à 2,2.
- Les noms des ateliers sont indicatifs et peuvent changer sans toucher au gameplay.

### Bâtiments

- **Chaumière :** fabrique les créatures de sa couleur, affiche l'anneau de 10 pastilles de sa file d'attente.
- **Atelier :** reçoit les créatures de sa couleur, une toutes les 0,8 s, et fait tinter une clochette à chaque livraison.
- **Chantier :** panneau et poussière 4 s avant l'apparition, avec la couleur du futur bâtiment.
- **Obstacles :** arbres, rochers, buissons, eau, montagnes : infranchissables sans pont ou tunnel.

## Textes d'exemple (clés FR / EN)

<!-- section : textes -->

Une clé par texte, jamais de phrase en dur dans le code. Les variables entre accolades sont remplacées à l'affichage. Tutoiement partout en français.

| Clé | Français | English |
|---|---|---|
| game.title | Pré-Lune | Pré-Lune |
| ui.play | Jouer | Play |
| ui.continue | Continuer | Continue |
| ui.daily | Défi du jour | Daily challenge |
| ui.journal | Carnet | Journal |
| ui.settings | Réglages | Settings |
| ui.pause | Pause | Pause |
| ui.undo | Annuler | Undo |
| ui.retry | Rejouer | Play again |
| hud.day | Journée {n} | Day {n} |
| hud.tiles | {n} dalles | {n} tiles |
| hud.deliveries | {n} livraisons | {n} deliveries |
| panic.warning | Embouteillage ! Encore {n} s | Traffic jam! {n} s left |
| gift.title | Choisis un cadeau du hameau | Pick a gift from the hamlet |
| gift.reroll | Relancer (1 fois) | Reroll (once) |
| gift.roundabout | Rond-point | Roundabout |
| gift.bridge | Pont | Bridge |
| gift.light | Feu de lanterne | Lantern light |
| gift.tunnel | Tunnel | Tunnel |
| gift.tiles | Sac de dalles | Bag of tiles |
| gift.gold | Chemin doré | Golden path |
| gift.bell | Cloche de secours | Rescue bell |
| gift.workshop | Atelier de renfort | Extra workshop |
| species.firefly | Luciole | Firefly |
| species.hedgehog | Hérisson | Hedgehog |
| species.snail | Escargot | Snail |
| species.golem | Golem de mousse | Moss golem |
| species.sprite | Lutin | Sprite |
| species.toad | Crapaud | Toad |
| rank.1 à rank.5 | Hameau, Village, Bourg, Cité, Capitale | Hamlet, Village, Town, City, Capital |
| end.title | La brume tombe sur le hameau | Mist falls over the hamlet |
| end.score | {n} livraisons en {d} journées | {n} deliveries over {d} days |
| end.best | Nouveau record ! | New best! |
| tuto.draw | Glisse ton doigt de la chaumière bleue jusqu'à la lanternerie. | Drag your finger from the blue cottage to the lantern workshop. |
| tuto.erase | Touche un chemin pour l'effacer. | Tap a path to erase it. |
| tuto.mist | Quand une file déborde, la brume monte. Fais vite ! | When a queue overflows, the mist rises. Hurry! |
| daily.streak | {n} jours d'affilée | {n} days in a row |
| journal.day5 | Les escargots sont arrivés. Patience, ils ne sont pas pressés. | The snails have arrived. Be patient, they are in no hurry. |

### Règles de traduction

- Pluriels et nombres passent par une petite fonction de formatage, pas par des chaînes coupées (« 1 livraison » / « 2 livraisons »).
- Prévoir 30 % de place en plus dans les boutons et bulles (l'anglais et le français n'ont pas la même longueur).
- Les clés des deux fichiers doivent être identiques ; un test automatique signale toute clé manquante.
- Les images ne contiennent aucun texte : une seule version pour les deux langues.
