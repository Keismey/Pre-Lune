# Pré-Lune · ÉTAT du projet

Dernière mise à jour : 23 oct. 2026, fin de C1 (V0, socle).

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

Existe après C1 : `index.html`, `js/` (voir ci-dessous), `data/balance.json`, `lang/fr.json`, `lang/en.json`. Pas encore : `species.json`, `bonus.json`, `maps.json`, `img/`, `snd/`, `sw.js`, `manifest.webmanifest`.

### Modules JS (`js/`)

| Fichier | Rôle |
|---|---|
| `main.js` | point d'entrée : charge `balance.json` et les langues, crée affichage, boucle, écrans ; `game.goto(nom)`, `game.setLanguage(code)` |
| `loop.js` | boucle `requestAnimationFrame` plafonnée à 60 i/s, simulation à pas fixe `1/sim_hz`, `render(alpha)` interpolé, `resetClock()` au retour d'arrière-plan |
| `display.js` | canvas plein écran, monde logique 1080 × 1920 mis à l'échelle et centré (bandes `letterbox`), dpr plafonné à 2, `toWorld(x, y)` |
| `world.js` | disposition : barres haut/bas, grille ; `cellAt(x, y)`, `cellRect(c, r)` |
| `input.js` | pointer events, un seul doigt ; le gestionnaire reçoit `down`/`move`/`up`/`cancel` en coordonnées du monde |
| `rng.js` | mulberry32 : `next`, `int`, `range`, `pick`, `getState`/`setState` (pour la sauvegarde). Un générateur par flux (`carte`, `apparitions`, `cadeaux`) à créer en C2/C3 |
| `i18n.js` | `t("clé", {param})`, `loadLangs`, `detectLang` (fr → FR sinon EN), `setLang` ; avertit une fois par clé manquante, repli sur EN |
| `save.js` | `localStorage` clé `pl_save_v1`, version 1, réglages (`settings.lang`) ; identifiants uniquement |
| `draw.js` | `roundRectPath`, `wrapLines`, `drawText` (retour à la ligne automatique, ombre) |
| `screens/title.js` | écran titre : ciel, hameau en formes simples, 3 créatures sur une boucle (interpolées), version, boutons FR/EN, toucher pour continuer |
| `screens/grid.js` | écran provisoire : barres + grille 20 × 30, case touchée surlignée, bouton retour. À remplacer par la partie en C2 |

## Fait

- **C1 (socle V0)** : `index.html`, boucle à pas fixe 1/30 s avec rendu interpolé (testée à 45, 60 et 120 Hz simulés : 30 pas/s, alpha dans [0, 1[), monde logique 1080 × 1920 (barre du haut 130, grille 20 × 30 de 54 px, barre du bas 170), langues FR/EN (détection, mémorisation, bascule depuis l'écran titre), mulberry32 (vérifié : même graine, même suite ; première valeur de la graine 1 = 0,62707…), écran titre minimal, écran provisoire de la grille. Vérifié dans Chromium en 393 × 851 : aucune erreur console, 60 i/s, la case touchée est la bonne.
- GDD découpé en 5 fichiers markdown dans `docs/gdd/`, fidèle à l'artefact (texte vérifié section par section), sauf le renommage ci-dessous.
- `docs/ETAT.md` créé.
- Dépôt `Keismey/Pre-Lune` créé (public, vide au départ) et `docs/` poussé sur `main`.
- Réglages du Projet mis à jour avec le nouveau nom.

## Reste à faire

- Tout le reste du développement : prochaine étape C2 (V0, tracé et livraison).
- Pas encore de flux aléatoires nommés (`carte`, `apparitions`, `cadeaux`) : `rng.js` fournit le générateur, les flux seront créés quand la partie en aura besoin.
- Pas encore de `manifest.webmanifest` ni de `sw.js` (étape V5).
- Test sur le téléphone du socle (voir ci-dessous) à faire par Nicolas.
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

## Décisions

- Nom Pré-Lune : c'est le nom du hameau du GDD, court, identique en FR et en EN, donc un seul nom pour le dépôt, la PWA et la carte du hub.
- Le nom du dépôt s'écrit sans accent (`Pre-Lune`) pour garder une URL propre.
- Le nom du dépôt GitHub réel est `Keismey/pre-lune` (GitHub l'écrit en minuscules ; l'URL de Pages est insensible à la casse côté dépôt mais pas côté chemin : à vérifier à la publication que `https://keismey.github.io/Pre-Lune/` répond bien).
- Modules ES (`<script type="module">`) : le jeu doit être servi en HTTP (GitHub Pages, ou un petit serveur local), il ne s'ouvre pas en double-cliquant sur `index.html`.
- La pause automatique en arrière-plan sera branchée avec la partie ; pour l'instant la boucle ne rattrape pas le temps perdu (`resetClock`).
- Préfixe `pl` à la place de `hx` dans la sauvegarde et la graine, fixé maintenant avant qu'une sauvegarde existe.

## Prochaine conversation du plan

**C2 : V0, tracé et livraison.** Lire `docs/ETAT.md` et `docs/gdd/01-gameplay.md` (Gameplay et Specs). Ajouter la couleur bleue (1 chaumière, 1 atelier), le tracé au doigt aimanté sans diagonale, une créature qui suit le chemin et livre, le score, l'effacement d'un tap avec rendu des dalles, l'option de décalage du curseur. Remplace `screens/grid.js`.

## À tester sur le téléphone (C1)

1. Activer GitHub Pages (Settings, Pages, branche `main`, dossier `/ (root)`), puis ouvrir `https://keismey.github.io/Pre-Lune/`.
2. Écran titre : 3 points colorés tournent sur le chemin, FR/EN change la langue et reste choisi après rechargement.
3. Toucher ailleurs : la grille s'affiche, la case sous le doigt s'éclaire, le chevron du bas revient au titre.
