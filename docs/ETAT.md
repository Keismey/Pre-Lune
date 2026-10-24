# Pré-Lune · ÉTAT du projet

Dernière mise à jour : 24 oct. 2026, fin de C3 (V1, bâtiments et journées, avec passage au tracé libre).

## Projet

- **Nom : Pré-Lune** (choisi le 22 oct. 2026 ; ancien nom de travail : Hameau Express). Même titre en FR et en EN.
- Jeu navigateur mobile de réseau de chemins, Canvas 2D et JS pur, par Keismey Studio.
- Dépôt : `Keismey/Pre-Lune` (sans accent). URL cible : `https://keismey.github.io/Pre-Lune/`, dans le hub `keismey.github.io`.
- Le GDD d'origine est l'artefact « GDD Hameau Express » (lu en entier une seule fois, en C0). Ne plus le relire : tout est dans `docs/gdd/`.

## Où lire quoi (`docs/gdd/`)

| Fichier | Sections |
|---|---|
| `00-base.md` | vision, ecrans, ux, tech, roadmap, deploy, recette |
| `01-gameplay.md` | gameplay, specs, bonus |
| `02-progression.md` | cartes, defi, progression |
| `03-contenu.md` | creatures, textes |
| `04-audio-assets.md` | audio, assets (style commun et 17 prompts Gemini, repris tels quels) |

Chaque section est repérée par un commentaire `<!-- section : id -->` (l'id est celui de l'artefact).

## Structure prévue du dépôt (GDD, section Technique)

`index.html`, modules JS, `data/` (`balance.json`, `species.json`, `bonus.json`, `maps.json`), `lang/` (`fr.json`, `en.json`), `img/`, `snd/`, `sw.js`, `manifest.webmanifest`.

Existe après C3 : `index.html`, `js/` (voir ci-dessous), `data/balance.json`, `lang/fr.json`, `lang/en.json`. Pas encore : `species.json`, `bonus.json`, `maps.json`, `img/`, `snd/`, `sw.js`, `manifest.webmanifest`.

### Modules JS (`js/`)

| Fichier | Rôle |
|---|---|
| `main.js` | point d'entrée : charge `balance.json` et les langues, crée affichage, boucle, écrans ; `game.goto(nom)`, `game.setLanguage(code)` |
| `loop.js` | boucle `requestAnimationFrame` plafonnée à 60 i/s, simulation à pas fixe `1/sim_hz`, `render(alpha)` interpolé, `resetClock()` au retour d'arrière-plan |
| `display.js` | canvas plein écran, monde logique 1080 × 1920 mis à l'échelle et centré (bandes `letterbox`), dpr plafonné à 2, `toWorld(x, y)` |
| `world.js` | disposition : barres haut/bas, grille ; `cellAt(x, y)` (null hors grille), `clampCell(x, y)` (case la plus proche), `cellRect(c, r)` |
| `input.js` | pointer events, un seul doigt ; le gestionnaire reçoit `down`/`move`/`up`/`cancel` en coordonnées du monde |
| `rng.js` | mulberry32 : `next`, `int`, `range`, `pick`, `getState`/`setState` (pour la sauvegarde). `createStreams(graine, noms)` crée un générateur indépendant par flux (`carte`, `apparitions`, `cadeaux`, noms dans `balance.json` > `rng.streams`) |
| `i18n.js` | `t("clé", {param})`, `loadLangs`, `detectLang` (fr → FR sinon EN), `setLang` ; avertit une fois par clé manquante, repli sur EN |
| `save.js` | `localStorage` clé `pl_save_v1`, version 1, réglages (`settings.lang`) ; identifiants uniquement |
| `draw.js` | `roundRectPath`, `wrapLines`, `drawText` (retour à la ligne automatique, ombre) |
| `screens/title.js` | écran titre : ciel, hameau en formes simples, 3 créatures sur une boucle (interpolées), version, boutons FR/EN, toucher pour continuer |
| `sim.js` | simulation de la partie, logique pure sans DOM, testable sous Node. **Journées** (40 s = 1200 pas, gain de dalles, plafond), **chantiers** (4 s) et **tableau d'apparitions** (`days.schedule`), placement des bâtiments par le flux `apparitions`. **Réseau libre** : graphe de nœuds et d'arêtes (`sim.nodes`, `sim.edges`, `sim.graphVersion`), portes de bâtiments, tracé (`beginStroke`/`moveStroke`/`endStroke`), effacement (`eraseAt(x, y)`), distances par couleur (Dijkstra depuis les portes des ateliers), créatures, livraisons, popups. `step()` avance de 1/30 s |
| `screens/play.js` | écran de partie : herbe sans damier (dégradés tirés d'une graine, dessinés une fois), routes lissées en courbes (chaînes entre croisements, mises en cache par `graphVersion`), chantiers, bâtiments en formes simples, créatures interpolées, curseur décalé, barre du haut (dalles, anneau d'horloge avec le numéro de journée, livraisons, « +18 » de fin de journée), barre du bas (retour, curseur décalé), gestes |
| `screens/grid.js` | supprimé (remplacé par `play.js`) |

## Fait

- **C1 (socle V0)** : `index.html`, boucle à pas fixe 1/30 s avec rendu interpolé (testée à 45, 60 et 120 Hz simulés : 30 pas/s, alpha dans [0, 1[), monde logique 1080 × 1920 (barre du haut 130, grille 20 × 30 de 54 px, barre du bas 170), langues FR/EN (détection, mémorisation, bascule depuis l'écran titre), mulberry32 (vérifié : même graine, même suite ; première valeur de la graine 1 = 0,62707…), écran titre minimal, écran provisoire de la grille. Vérifié dans Chromium en 393 × 851 : aucune erreur console, 60 i/s, la case touchée est la bonne.
- GDD découpé en 5 fichiers markdown dans `docs/gdd/`, fidèle à l'artefact (texte vérifié section par section), sauf le renommage ci-dessous.
- `docs/ETAT.md` créé.
- Dépôt `Keismey/Pre-Lune` créé (public, vide au départ) et `docs/` poussé sur `main`.
- Réglages du Projet mis à jour avec le nouveau nom.

- **C2 (V0, tracé et livraison)** : couleur bleue (1 chaumière, 1 atelier, posés dès le début au hasard du flux `apparitions`, avec les règles du GDD : 2 cases des bords, 3 cases d'écart, 6 à 20 cases entre les deux) ; tracé au doigt aimanté sur la grille sans diagonale (un saut du doigt se décompose en pas orthogonaux), depuis un bâtiment (zone d'appui 1,5 case) ou un chemin existant (embranchement), 1 dalle par case nouvelle, retracer ne coûte rien, 3 chemins reliés au plus par bâtiment, revenir en arrière avec le doigt défait le tracé et rend les dalles ; la chaumière produit une créature 2 s après le début puis toutes les 6 s si un chemin mène à l'atelier ; la créature suit le plus court chemin (distance recalculée à chaque changement de réseau), entre dans l'atelier et la livraison s'ajoute au score ; effacement d'un toucher bref (moins de 200 ms, sans glisser) : le tronçon entre deux croisements disparaît et rend 100 % des dalles (« +N » qui monte) ; option de décalage du curseur (bouton dans la barre du bas, mémorisée dans la sauvegarde, réglage `cursor_offset`).
- Vérifié sous Node (`sim.js`, 14 contrôles) : placement sur 300 graines, même graine = mêmes bâtiments, tracé sans case isolée, 1re livraison à 9,8 s pour un chemin de 15 cases, effacement qui rend tout, toucher long et glissement qui n'effacent pas, limite de 3 portes, manque de dalles, déterminisme (mêmes gestes, même état après 20 s), aucun `Math.random`, mêmes clés en FR et EN. Vérifié dans Chromium en 393 × 851 : tracé, créature, livraisons, effacement avec rendu des dalles, curseur décalé, aucune erreur console.

- **C3 (V1, bâtiments et journées)** : **le tracé est devenu libre** (retour de test de Nicolas après C2 : le damier et le tracé collé à la grille ne lui plaisaient pas). Les chemins ne suivent plus la grille : le doigt tire une tête qui avance par pas de 24 px (lissage), le chemin est un graphe, un croisement se crée tout seul quand deux chemins se coupent, un chemin proche d'un nœud ou d'une arête s'y raccorde, repasser sur son tracé le défait. Coût : 1 dalle par 54 px de chemin neuf (les 40 dalles de départ valent donc la même distance qu'avant). Plus de damier d'herbe ni de lignes de grille. Les bâtiments restent posés sur la grille invisible.
- Journée de 40 s (1200 pas) avec anneau d'horloge et numéro dans la barre du haut ; +18 dalles par journée, plafond 120 (le plafond ne retire jamais de dalles) ; « +18 » qui monte à côté du compteur. Couleurs rouge, jaune et verte (le vert est dans le tableau, journée 7). Chantiers de 4 s (zone réservée en pointillés, panneau, poussière, anneau de progression) : on ne peut pas tracer dessus. Tableau d'apparitions des journées 1 à 7 lu dans `balance.json` (`days.schedule`) : 2/2 après J1, 3/2, 4/3, 5/4, 6/5, 8/5, 10/6 ; la paire bleue de 0 s apparaît sans chantier. Cadence des chaumières : `max(3,5 ; 6,0 × 0,96^(journée − 1))`, 2 s avant la première créature. Un bâtiment prévu sur un emplacement où passe un chemin est décalé sur l'emplacement suivant de la liste (un seul tirage du flux `apparitions` par bâtiment, quoi qu'il arrive).
- Vérifié sous Node (`sim.js`, 38 contrôles) : totaux du tableau après chaque journée sur la graine de test, instants exacts (chantier à `at − 4 s`, bâtiment à `at`), 200 graines sur 8 journées (16 bâtiments toujours posés, jamais moins d'une case entre deux, bords à 2 cases, partenaire à 6–20 cases pour tous), dalles 40 → 58, 76, 94, 112, 120, plafond et gain partiel, cadence 6 s / 5,76 s / 3,53 s / 3,5 s, tracé libre (coût = longueur / 54, créature qui suit une courbe en S, segments diagonaux, plus de dalles, retour en arrière, croisement automatique, effacement d'un tronçon avec remboursement, appui long et glissement qui n'effacent pas, 3 chemins au plus par bâtiment, chantier infranchissable), déterminisme (mêmes gestes, même graine : même état au pas près), aucun `Math.random`. Vérifié dans Chromium en 393 × 851 : tracé à la main, créature, livraisons, chantiers rouges à 14 s, horloge, aucune erreur console.

## Reste à faire

- Prochaine étape : C4 (V1, trafic et défaite).
- Pas de files d'attente, de panique ni de défaite : sans route, la chaumière ne produit rien (C4). Pas de croisement géré (les créatures se traversent), pas de dépassement (C4). Les créatures sortent d'une porte et marchent sur l'arête sans se gêner.
- Pas d'aide au tracé (demi-vitesse), d'Annuler, de pause, d'appui long (C5). Pas de sauvegarde de partie (C5). Pas de fin de journée avec choix de cadeau : la journée suivante démarre toute seule (C6).
- Pas d'apparitions après la journée 7 (le tableau s'arrête là), pas de couleurs violette et orange (C7).
- Pas d'obstacles, d'eau ni de ponts (C8).
- La graine de la partie vient de l'horloge (`Date.now()`) : à remplacer par la graine de la carte / du défi du jour (C11). Flux nommés : `apparitions` est utilisé ; `carte` et `cadeaux` viendront avec les cartes et les cadeaux.
- Pas encore de `manifest.webmanifest` ni de `sw.js` (étape V5).
- Test sur le téléphone de C3 (voir ci-dessous) à faire par Nicolas.
- Vérifier que le nom Pré-Lune est libre avant la publication (Play Store, itch.io, INPI).
- Activer GitHub Pages sur le dépôt (Settings, Pages, branche `main`, dossier `/ (root)`) dès qu'il y a un `index.html` à afficher.
- Réglages du Projet : la ligne Dépôt doit dire `Keismey/Pre-Lune` sans accent (elle dit `Keismey/Pré-Lune`). Le plan `claude/plan-conversations.md` du Projet décrit encore C2 avec « tracé aimanté sur la grille sans diagonale » : périmé, le tracé est libre depuis C3.
- Images (I2) : la « texture de chemin » devra se poser sur un tracé libre (trait épais courbe), pas sur des cases : prévoir un motif répété le long du trait plutôt qu'une tuile par case.
- Valeurs du GDD exprimées en cases (chemin doré 8 cases, pont 1 à 3 cases d'eau, tunnel 6 cases, écart entre créatures 0,7 case) : une « case » vaut 54 px de chemin. À reprendre telles quelles aux étapes concernées.

## Valeurs changées par rapport au GDD v1

**Règles du GDD modifiées en C3** (`docs/gdd/01-gameplay.md` et `00-base.md` mis à jour) :

- **Tracé libre** au lieu d'aimanté sur la grille sans diagonale : le chemin suit le doigt (courbes, diagonales), se raccorde aux chemins et aux bâtiments proches, et le graphe remplace le tableau de cases (réseau, distances, croisements, effacement : section Technique de `00-base.md`).
- **Coût d'un chemin** : 1 dalle par 54 px de chemin neuf (était 1 dalle par case nouvelle). Les dalles sont comptées au dixième, l'affichage arrondit vers le bas.
- **Écart minimal entre bâtiments** : 2 cases vides (était 3), avec repli à 1 case si la carte est pleine. Raison : avec 3 cases d'écart et des bâtiments de 2 × 2 sur 20 × 30 cases avec 2 cases de marge, il tient au plus 15 bâtiments (9 à 15 en tirage aléatoire sur 400 graines), alors que le tableau d'apparitions en demande 16 dès la journée 7 et que le plafond est à 26. Avec 2 cases : 15 à 22 bâtiments (16 ou plus dans 97 % des tirages). Le repli à 1 case garantit le tableau sur toutes les graines testées ; le plafond de 26 bâtiments reste à voir en C7 (il faudra sans doute descendre à 1 case d'écart ou agrandir la carte).
- Un emplacement n'est retenu que si aucun chemin ne passe à moins de 30 px de l'emprise du bâtiment.

Autres changements, identifiants liés au nom :

- graine du défi du jour : `fnv1a("pl-" + règles_version + "-" + AAAA-MM-JJ)` (était `hx-`)
- clé de sauvegarde : `pl_save_v1` (était `hx_save_v1`)
- `game.title` : « Pré-Lune » en FR et en EN (était « Hameau Express » / « Hamlet Express »)
- dépôt : `Keismey/Pre-Lune` (était `Keismey/Hameau-Express`)
- vision : la ligne « À décider plus tard » devient « Nom » (décision prise)

## Valeurs ajoutées dans `data/balance.json` (C1)

Sections `game` (version), `world` (dimensions du GDD), `loop` (`sim_hz` 30, `max_fps` 60, `fps_tolerance_ms` 2, `max_frame_ms` 250), `display` (`dpr_max` 2) et `ui` (couleurs, tailles et réglages de l'écran titre, tous provisoires en attendant les images). Les textes sont dans `lang/`. Boutons de 240 × 140 en monde logique (environ 51 px à l'écran sur un téléphone de 393 px de large, au-dessus des 48 px du GDD).

## Valeurs ajoutées dans `data/balance.json` (C3)

`game.version` 0.3.0 (`start_colors` supprimé : le tableau d'apparitions donne les couleurs). `palette` : rouge, jaune, vert. `tiles` : `per_day` 18, `cap` 120, `gain_fx_s` 1,4 (`cost_per_cell` 1 vaut maintenant par 54 px). `days` : `length_s` 40 et `schedule` (12 lignes : journée, `at_s`, couleur, types). `roads` (nouveau) : `step_px` 24, `snap_px` 26, `node_pick_px` 12, `touch_px` 34, `width_px` 34, `door_gap_px` 24, `capture_px` 34, `door_merge_px` 44, `block_px` 8, `clear_px` 30, `undo_px` 18, `undo_skip` 4, `tap_slop_px` 20, `max_points_per_move` 40. `buildings` : `site_s` 4, `min_gap` 2, `min_gap_floor` 1. `ui.play` : `grass`, `clock`, `site`, `head_ring_gap`, `hud.gain_dx` et `gain_rise`, couleurs `site_*`, `dust`, `clock_*`, `hud_delivery_*`. Supprimés : `ui.colors.grass_b`, `grid_line`, `ui.sizes.grid_line_w` (plus de damier ni de grille). Texte ajouté : `hud.day` (« Journée » / « Day »).

## Valeurs ajoutées dans `data/balance.json` (C2)

`game.version` 0.2.0 et `game.start_colors` (`["blue"]`), `rng.streams`, `palette` (bleu : `main`, `dark`, `light`), `tiles` (`start` 40, `cost_per_cell` 1, `refund_ratio` 1.0, `flash_s` 0,5), `buildings` (taille 2, rayon d'appui 1,5, 3 portes, écart 3, marge 2, paire 6 à 20, cadence de la chaumière : 2 s, 6,0 s, ×0,96 par journée, plancher 3,5 s), `creatures.speed_cells_per_s` 2,2, `input` (`tap_max_ms` 200, `cursor_offset_px` 150), et dans `ui` : `sizes.toggle_*`, `bar_margin` et toute la section `play` (couleurs des dalles, rebond, créatures, HUD, popups, curseur). Valeurs du GDD reprises telles quelles, rien de changé.

## Décisions

- Aimantation : la tête du tracé avance d'une case à la fois vers la case sous le doigt, sur l'axe où il reste le plus de distance (alternance à égalité), et contourne un obstacle en essayant l'autre axe. Si les deux sont bloqués, elle attend que le doigt bouge.
- Un tronçon se mesure entre deux cases ayant 3 voisins ou plus. Un toucher bref sur un croisement lui-même n'efface rien. Une créature sur un tronçon effacé disparaît (pas de remboursement, pas de score).
- Tracé qui arrive sur un autre bâtiment : il vise la case de son pourtour la plus proche, et respecte la limite de 3 portes (le tracé s'arrête devant).
- Curseur décalé : désactivé par défaut, 150 px (monde logique) au-dessus du doigt, soit environ 55 px à l'écran. C'est la valeur à trancher en test (le GDD demande de décider en V0). Avec le curseur décalé, faire glisser le curseur sur un bâtiment démarre le tracé.
- C2, devenu faux : l'aimantation sur la grille, les « tronçons entre deux cases à 3 voisins » et les portes comptées sur le pourtour de cases (voir C3 ci-dessous).

- **C3, réseau libre** : un tronçon se mesure entre deux nœuds de degré différent de 2 ou deux portes. Un toucher bref sur un croisement efface le tronçon le plus proche du doigt. Les arêtes du tracé en cours ne peuvent pas être croisées ni raccordées par ce même tracé (pas de boucle qui se coupe elle-même). Une porte est un nœud posé à 24 px d'un mur de bâtiment ; deux portes à moins de 44 px sont la même. Un bâtiment accepte 3 chemins reliés au plus (arêtes qui touchent ses portes), pas 3 portes. Une créature dont l'arête disparaît s'évanouit (pas de remboursement, pas de score), comme en C2 ; si une arête est coupée par un nouveau croisement, la créature qui y marche continue sans rien perdre.
- **C3, journées** : l'horloge de journée se compte en pas entiers (1200), pas en secondes flottantes, pour que les instants d'apparition tombent juste. À la fin de la journée 1 la journée 2 démarre sans pause (le choix du cadeau vient en C6). Si une chaumière ou un atelier n'a plus d'emplacement libre, le bâtiment n'apparaît pas (aucun cas observé sur 200 graines jusqu'à la journée 8).
- **C3, apparitions** : la chaumière est posée avant l'atelier de la même couleur ; l'atelier se place à 6–20 cases (distance en cases, horizontal plus vertical) de toutes les chaumières de sa couleur si possible, sinon d'au moins une, sinon n'importe où. Les chantiers comptent comme des bâtiments pour les écarts, la proportion et les partenaires.
- Règle de proportion (3 chaumières par atelier au plus) : non appliquée en C3, le tableau des journées 1 à 7 la respecte déjà (10 chaumières pour 6 ateliers). Elle servira à partir de la journée 8 (C7).

- Nom Pré-Lune : c'est le nom du hameau du GDD, court, identique en FR et en EN, donc un seul nom pour le dépôt, la PWA et la carte du hub.
- Le nom du dépôt s'écrit sans accent (`Pre-Lune`) pour garder une URL propre.
- Le nom du dépôt GitHub réel est `Keismey/pre-lune` (GitHub l'écrit en minuscules ; l'URL de Pages est insensible à la casse côté dépôt mais pas côté chemin : à vérifier à la publication que `https://keismey.github.io/Pre-Lune/` répond bien).
- Modules ES (`<script type="module">`) : le jeu doit être servi en HTTP (GitHub Pages, ou un petit serveur local), il ne s'ouvre pas en double-cliquant sur `index.html`.
- La pause automatique en arrière-plan sera branchée avec la partie ; pour l'instant la boucle ne rattrape pas le temps perdu (`resetClock`).
- Préfixe `pl` à la place de `hx` dans la sauvegarde et la graine, fixé maintenant avant qu'une sauvegarde existe.

## Prochaine conversation du plan

**C4 : V1, trafic et défaite** (après le test de C3 sur le téléphone). Lire `docs/ETAT.md`, `docs/gdd/01-gameplay.md` (Gameplay : le trafic et la défaite ; Specs : créatures, croisements) et `docs/gdd/00-base.md` (Technique : réseau et trafic). Ajouter les files d'attente avec l'anneau de 10 pastilles, les vitesses et écarts, les croisements premier arrivé premier servi sans blocage, la panique de 10 s (relâche à 7), la brume et la fin de partie. Le champ de distance par couleur existe déjà (graphe, Dijkstra depuis les portes des ateliers) : il reste à gérer les créatures en file et les croisements (nœuds à 3 arêtes ou plus).

## À tester sur le téléphone (C3)

1. Ouvrir `https://keismey.github.io/Pre-Lune/` (recharger sans cache), toucher l'écran titre : herbe unie sans damier ni lignes, une chaumière et un atelier bleus, 40 dalles, anneau d'horloge au centre avec « 1 ».
2. Poser le doigt sur la chaumière et glisser vers l'atelier en faisant une courbe : le chemin doit suivre ton doigt, lisse, sans diagonale imposée. Le coût doit monter de façon régulière. Dis si le tracé est assez fidèle, si la tête (anneau blanc) est facile à voir, et si 24 px de pas donnent un tracé trop mou ou trop nerveux.
3. Reviens en arrière avec le doigt sur ton tracé : il se défait et rend les dalles. Reviens sur le bâtiment de départ : tout se défait.
4. Trace un chemin qui en coupe un autre : un croisement se crée tout seul. Pars du milieu d'un chemin : embranchement. Termine ton tracé près d'un autre chemin : il s'y raccorde.
5. Un 4e chemin sur le même bâtiment est refusé. Toucher brièvement un chemin : le tronçon disparaît et « +N » monte.
6. À 14 s, deux chantiers rouges apparaissent (panneau, poussière, anneau qui se remplit), puis la chaumière et l'atelier rouges à 18 s. Essaie de tracer sur un chantier : impossible.
7. À 40 s, la journée passe à 2 : « +18 » monte à côté des dalles (plafond 120). Une chaumière bleue de plus arrive à 10 s de la journée 2, et ainsi de suite jusqu'à la journée 7 (jaune en J4, vert en J7).
8. Observe la cadence des créatures qui s'accélère de journée en journée, et dis si la carte devient trop pleine pour passer des chemins (écart de 2 cases entre bâtiments).

## À tester sur le téléphone (C2)

1. Ouvrir `https://keismey.github.io/Pre-Lune/` (recharger sans cache si l'ancienne version s'affiche), toucher l'écran titre : une chaumière (toit pointu) et un atelier (cheminée) bleus, 40 dalles en haut à gauche.
2. Poser le doigt sur la chaumière et glisser jusqu'à l'atelier : les dalles se posent case par case sans diagonale, avec un petit rebond, le compteur baisse. Une créature sort au bout de 2 s, suit le chemin, entre dans l'atelier : « Livraisons » monte.
3. Glisser trop vite ou en zigzag : le tracé doit rester sur la grille, sans case en diagonale ni trou. Revenir en arrière avec le doigt doit défaire le tracé et rendre les dalles.
4. Poser le doigt sur un chemin existant et glisser : embranchement. Un 4e chemin sur le même bâtiment doit être refusé.
5. Toucher brièvement le chemin : il disparaît, « +N » monte, les dalles sont rendues. Un appui long ou un glissement ne doit rien effacer.
6. Épuiser les dalles : le compteur devient rouge et tremble, le tracé s'arrête.
7. Bouton « Curseur décalé » (en bas à droite) : un anneau apparaît au-dessus du doigt et c'est lui qui trace. Dire si c'est confortable (150 px de décalage) et si on veut le garder par défaut.
8. Le chevron revient au titre, FR/EN change les textes.

## À tester sur le téléphone (C1, déjà vu)

1. Activer GitHub Pages (Settings, Pages, branche `main`, dossier `/ (root)`), puis ouvrir `https://keismey.github.io/Pre-Lune/`.
2. Écran titre : 3 points colorés tournent sur le chemin, FR/EN change la langue et reste choisi après rechargement.
3. Toucher ailleurs : la grille s'affiche, la case sous le doigt s'éclaire, le chevron du bas revient au titre.
