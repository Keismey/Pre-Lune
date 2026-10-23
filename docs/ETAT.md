# Pré-Lune · ÉTAT du projet

Dernière mise à jour : 23 oct. 2026, fin de C2 (V0, tracé et livraison).

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

Existe après C2 : `index.html`, `js/` (voir ci-dessous), `data/balance.json`, `lang/fr.json`, `lang/en.json`. Pas encore : `species.json`, `bonus.json`, `maps.json`, `img/`, `snd/`, `sw.js`, `manifest.webmanifest`.

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
| `sim.js` | simulation de la partie, logique pure sans DOM, testable sous Node : grille de chemin, bâtiments (placement par le flux `apparitions`), tracé (`beginStroke`/`moveStroke`/`endStroke`), effacement (`eraseAt`), champ de distance par couleur (BFS depuis les portes des ateliers), créatures, livraisons, popups. `step()` avance de 1/30 s |
| `screens/play.js` | écran de partie : rendu (herbe, dalles avec rebond, bâtiments en formes simples, créatures interpolées, curseur décalé), barre du haut (dalles, livraisons), barre du bas (retour, bouton curseur décalé), gestes |
| `screens/grid.js` | supprimé (remplacé par `play.js`) |

## Fait

- **C1 (socle V0)** : `index.html`, boucle à pas fixe 1/30 s avec rendu interpolé (testée à 45, 60 et 120 Hz simulés : 30 pas/s, alpha dans [0, 1[), monde logique 1080 × 1920 (barre du haut 130, grille 20 × 30 de 54 px, barre du bas 170), langues FR/EN (détection, mémorisation, bascule depuis l'écran titre), mulberry32 (vérifié : même graine, même suite ; première valeur de la graine 1 = 0,62707…), écran titre minimal, écran provisoire de la grille. Vérifié dans Chromium en 393 × 851 : aucune erreur console, 60 i/s, la case touchée est la bonne.
- GDD découpé en 5 fichiers markdown dans `docs/gdd/`, fidèle à l'artefact (texte vérifié section par section), sauf le renommage ci-dessous.
- `docs/ETAT.md` créé.
- Dépôt `Keismey/Pre-Lune` créé (public, vide au départ) et `docs/` poussé sur `main`.
- Réglages du Projet mis à jour avec le nouveau nom.

- **C2 (V0, tracé et livraison)** : couleur bleue (1 chaumière, 1 atelier, posés dès le début au hasard du flux `apparitions`, avec les règles du GDD : 2 cases des bords, 3 cases d'écart, 6 à 20 cases entre les deux) ; tracé au doigt aimanté sur la grille sans diagonale (un saut du doigt se décompose en pas orthogonaux), depuis un bâtiment (zone d'appui 1,5 case) ou un chemin existant (embranchement), 1 dalle par case nouvelle, retracer ne coûte rien, 3 chemins reliés au plus par bâtiment, revenir en arrière avec le doigt défait le tracé et rend les dalles ; la chaumière produit une créature 2 s après le début puis toutes les 6 s si un chemin mène à l'atelier ; la créature suit le plus court chemin (distance recalculée à chaque changement de réseau), entre dans l'atelier et la livraison s'ajoute au score ; effacement d'un toucher bref (moins de 200 ms, sans glisser) : le tronçon entre deux croisements disparaît et rend 100 % des dalles (« +N » qui monte) ; option de décalage du curseur (bouton dans la barre du bas, mémorisée dans la sauvegarde, réglage `cursor_offset`).
- Vérifié sous Node (`sim.js`, 14 contrôles) : placement sur 300 graines, même graine = mêmes bâtiments, tracé sans case isolée, 1re livraison à 9,8 s pour un chemin de 15 cases, effacement qui rend tout, toucher long et glissement qui n'effacent pas, limite de 3 portes, manque de dalles, déterminisme (mêmes gestes, même état après 20 s), aucun `Math.random`, mêmes clés en FR et EN. Vérifié dans Chromium en 393 × 851 : tracé, créature, livraisons, effacement avec rendu des dalles, curseur décalé, aucune erreur console.

## Reste à faire

- Prochaine étape : C3 (V1, bâtiments et journées).
- Pas de journées, de chantiers ni d'apparitions en cours de partie : les deux bâtiments bleus sont posés au début (V1).
- Pas de files d'attente, de panique ni de défaite : sans route, la chaumière ne produit rien (V1, C4). Pas de croisement géré (les créatures se traversent), pas de dépassement (C4).
- Pas de pause, d'Annuler, d'aide au tracé (demi-vitesse), d'appui long (C5). Pas de sauvegarde de partie (C5).
- Pas d'obstacles, d'eau ni de ponts (V2, V3).
- La graine de la partie vient de l'horloge (`Date.now()`) : à remplacer par la graine de la carte / du défi du jour (C11). Les bâtiments sont tirés avec cette graine, le reste de la simulation est déterministe.
- Pas encore de flux aléatoires nommés (`carte`, `apparitions`, `cadeaux`) : `rng.js` fournit le générateur, les flux seront créés quand la partie en aura besoin.
- Pas encore de `manifest.webmanifest` ni de `sw.js` (étape V5).
- Test sur le téléphone de C2 (voir ci-dessous) à faire par Nicolas.
- Vérifier que le nom Pré-Lune est libre avant la publication (Play Store, itch.io, INPI).
- Activer GitHub Pages sur le dépôt (Settings, Pages, branche `main`, dossier `/ (root)`) dès qu'il y a un `index.html` à afficher.
- Réglages du Projet : la ligne Dépôt doit dire `Keismey/Pre-Lune` sans accent (elle dit `Keismey/Pré-Lune`).

## Valeurs changées par rapport au GDD v1

Aucune valeur d'équilibrage. Seuls les identifiants liés au nom changent :

- graine du défi du jour : `fnv1a("pl-" + règles_version + "-" + AAAA-MM-JJ)` (était `hx-`)
- clé de sauvegarde : `pl_save_v1` (était `hx_save_v1`)
- `game.title` : « Pré-Lune » en FR et en EN (était « Hameau Express » / « Hamlet Express »)
- dépôt : `Keismey/Pre-Lune` (était `Keismey/Hameau-Express`)
- vision : la ligne « À décider plus tard » devient « Nom » (décision prise)

## Valeurs ajoutées dans `data/balance.json` (C1)

Sections `game` (version), `world` (dimensions du GDD), `loop` (`sim_hz` 30, `max_fps` 60, `fps_tolerance_ms` 2, `max_frame_ms` 250), `display` (`dpr_max` 2) et `ui` (couleurs, tailles et réglages de l'écran titre, tous provisoires en attendant les images). Les textes sont dans `lang/`. Boutons de 240 × 140 en monde logique (environ 51 px à l'écran sur un téléphone de 393 px de large, au-dessus des 48 px du GDD).

## Valeurs ajoutées dans `data/balance.json` (C2)

`game.version` 0.2.0 et `game.start_colors` (`["blue"]`), `rng.streams`, `palette` (bleu : `main`, `dark`, `light`), `tiles` (`start` 40, `cost_per_cell` 1, `refund_ratio` 1.0, `flash_s` 0,5), `buildings` (taille 2, rayon d'appui 1,5, 3 portes, écart 3, marge 2, paire 6 à 20, cadence de la chaumière : 2 s, 6,0 s, ×0,96 par journée, plancher 3,5 s), `creatures.speed_cells_per_s` 2,2, `input` (`tap_max_ms` 200, `cursor_offset_px` 150), et dans `ui` : `sizes.toggle_*`, `bar_margin` et toute la section `play` (couleurs des dalles, rebond, créatures, HUD, popups, curseur). Valeurs du GDD reprises telles quelles, rien de changé.

## Décisions

- Aimantation : la tête du tracé avance d'une case à la fois vers la case sous le doigt, sur l'axe où il reste le plus de distance (alternance à égalité), et contourne un obstacle en essayant l'autre axe. Si les deux sont bloqués, elle attend que le doigt bouge.
- Un tronçon se mesure entre deux cases ayant 3 voisins ou plus. Un toucher bref sur un croisement lui-même n'efface rien. Une créature sur un tronçon effacé disparaît (pas de remboursement, pas de score).
- Tracé qui arrive sur un autre bâtiment : il vise la case de son pourtour la plus proche, et respecte la limite de 3 portes (le tracé s'arrête devant).
- Curseur décalé : désactivé par défaut, 150 px (monde logique) au-dessus du doigt, soit environ 55 px à l'écran. C'est la valeur à trancher en test (le GDD demande de décider en V0). Avec le curseur décalé, faire glisser le curseur sur un bâtiment démarre le tracé.
- Pas de nouvelle règle de GDD : `docs/gdd/` inchangé.

- Nom Pré-Lune : c'est le nom du hameau du GDD, court, identique en FR et en EN, donc un seul nom pour le dépôt, la PWA et la carte du hub.
- Le nom du dépôt s'écrit sans accent (`Pre-Lune`) pour garder une URL propre.
- Le nom du dépôt GitHub réel est `Keismey/pre-lune` (GitHub l'écrit en minuscules ; l'URL de Pages est insensible à la casse côté dépôt mais pas côté chemin : à vérifier à la publication que `https://keismey.github.io/Pre-Lune/` répond bien).
- Modules ES (`<script type="module">`) : le jeu doit être servi en HTTP (GitHub Pages, ou un petit serveur local), il ne s'ouvre pas en double-cliquant sur `index.html`.
- La pause automatique en arrière-plan sera branchée avec la partie ; pour l'instant la boucle ne rattrape pas le temps perdu (`resetClock`).
- Préfixe `pl` à la place de `hx` dans la sauvegarde et la graine, fixé maintenant avant qu'une sauvegarde existe.

## Prochaine conversation du plan

**C3 : V1, bâtiments et journées** (après le test V0 sur le téléphone). Lire `docs/ETAT.md` et `docs/gdd/01-gameplay.md` (Specs : journées et ressources, créatures et files, apparition des bâtiments). Ajouter les couleurs rouge et jaune, les chantiers de 4 s, le tableau d'apparitions des journées 1 à 7, la cadence des chaumières, les dalles (départ, gain, plafond) et la journée de 40 s avec son anneau d'horloge dans la barre du haut.

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
