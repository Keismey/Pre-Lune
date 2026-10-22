# Pré-Lune · ÉTAT du projet

Dernière mise à jour : 22 oct. 2026, fin de C0 (mise en place).

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

`index.html`, modules JS, `data/` (`balance.json`, `species.json`, `bonus.json`, `maps.json`), `lang/` (`fr.json`, `en.json`), `img/`, `snd/`, `sw.js`, `manifest.webmanifest`. Rien de tout ça n'existe encore.

## Fait

- GDD découpé en 5 fichiers markdown dans `docs/gdd/`, fidèle à l'artefact (texte vérifié section par section), sauf le renommage ci-dessous.
- `docs/ETAT.md` créé.
- Dépôt `Keismey/Pre-Lune` créé (public, vide au départ) et `docs/` poussé sur `main`.
- Réglages du Projet mis à jour avec le nouveau nom.

## Reste à faire

- Tout le développement : prochaine étape C1 (V0, socle).
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

## Décisions

- Nom Pré-Lune : c'est le nom du hameau du GDD, court, identique en FR et en EN, donc un seul nom pour le dépôt, la PWA et la carte du hub.
- Le nom du dépôt s'écrit sans accent (`Pre-Lune`) pour garder une URL propre.
- Préfixe `pl` à la place de `hx` dans la sauvegarde et la graine, fixé maintenant avant qu'une sauvegarde existe.

## Prochaine conversation du plan

**C1 : V0, socle.** Lire `docs/ETAT.md`, `docs/gdd/00-base.md` et, dans `docs/gdd/01-gameplay.md`, la section Specs (écran et grille, générateur aléatoire).
