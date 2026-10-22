# Pré-Lune · GDD v1 · 00 Base

Keismey Studio. Jeu navigateur mobile · Canvas 2D · une main · sessions de 5 à 8 minutes · 0 € · sans pub ni micro-transaction

## Vision

<!-- section : vision -->

> Un petit village de conte de fées grandit sous tes doigts. Des chaumières colorées y apparaissent, des créatures en sortent chargées de marchandises, et chacune doit rejoindre l'atelier de sa couleur. Tu traces les chemins d'un seul glissement de doigt, et tu évites l'embouteillage qui fait monter la brume.

**Promesse :** la satisfaction de voir un réseau de chemins se mettre à couler, jouable d'une main, en parties courtes qui donnent envie de refaire mieux.

### Piliers

- **Un geste, un résultat visible** : tracer un chemin se fait d'un glissement, et les créatures l'empruntent tout de suite.
- **Le trafic se lit à l'œil** : files, anneaux de remplissage, brume qui monte. Aucun chiffre à décoder pour comprendre qu'un bâtiment souffre.
- **Optimiser sans punir à chaque faute** : effacer un chemin rend ses dalles, on peut toujours repenser son réseau. Seule la saturation prolongée fait perdre.
- **Chaque partie raconte autre chose** : cadeaux de fin de journée tirés au hasard, cartes aux contraintes différentes, défi du jour.

### L'univers en bref

- Le hameau de Pré-Lune compte six familles de créatures : lucioles, hérissons, escargots, golems de mousse, lutins et crapauds. Chaque famille habite une chaumière de sa couleur et travaille pour un atelier de la même couleur.
- Quand le trafic bouche un bâtiment trop longtemps, la brume du soir descend sur le hameau et la partie s'arrête.
- Pas de scénario à suivre : un ton chaleureux et quelques phrases du journal du hameau suffisent à donner de la vie.

### Cible et contraintes

- Joueurs mobiles casual, 8 ans et plus. Français et anglais dès le départ, textes isolés dans des fichiers de langue.
- HTML, Canvas 2D et JavaScript pur, sans bibliothèque. Hébergé sur GitHub Pages dans le hub du studio, installable (PWA), jouable hors ligne.
- Aucune dépense : outils gratuits, assets générés avec Gemini, pas de publicité.
- Inspiration assumée : le plaisir des jeux de réseau routier minimalistes. Le thème, les créatures, les bonus et le style visuel sont propres à Pré-Lune.

### Nom

- **Pré-Lune** est le nom définitif (choisi le 22 oct. 2026, ancien nom de travail : Hameau Express). Reste à vérifier qu'il est libre avant la publication (Play Store, itch.io, INPI).

## Enchaînement des écrans

<!-- section : ecrans -->

> **Lancement** (logo « K » de Keismey Studio) → **Titre** → **Menu** → **Choix de la carte** → **Partie** ⇄ **Fin de journée** (choix du cadeau) → **Fin de partie** → retour au Menu.

| Écran | Contenu | Actions |
|---|---|---|
| Lancement | Logo « K » seul de Keismey Studio, 1,5 s | Aucune, passe tout seul |
| Titre | Hameau animé (quelques créatures qui circulent), version, sélecteur FR/EN | Toucher pour continuer |
| Menu | Gros boutons empilés en bas : Jouer (ou Continuer), Défi du jour, Carnet, Réglages | Choisir |
| Choix de la carte | Cartes en vignettes, verrouillées avec le rang requis, meilleur score affiché | Lancer une carte |
| Partie | Haut : pause, journée avec anneau d'horloge, dalles, livraisons. Centre : la carte. Bas : Annuler et emplacements de cadeaux. | Tracer, effacer, poser, appui long |
| Fin de journée | Le jeu s'arrête, 3 cadeaux en cartes, bouton de relance (1 fois) | Choisir 1 cadeau |
| Pause | Reprendre, Recommencer, Quitter, accès aux Réglages | Choisir |
| Fin de partie | La brume tombe, livraisons, journées, record, rang gagné, succès débloqués | Rejouer, Menu |
| Carnet | Rang, statistiques par carte, succès, historique du défi | Consulter |
| Réglages | Langue, son, musique, vibration, aide au tracé, décalage du curseur, gaucher, animations réduites, saison, effacer la sauvegarde | Modifier |

### Règles d'ergonomie

- Actions principales dans la moitié basse de l'écran, accessibles au pouce.
- Boutons d'au moins 48 px à l'écran, un seul geste à la fois.
- La pause est toujours disponible et la partie reprend exactement où elle était. Pause automatique si l'application passe en arrière-plan.
- Confirmation uniquement pour effacer la sauvegarde. Les erreurs de tracé se rattrapent avec Annuler.

## UX et ambiance

<!-- section : ux -->

- **Vue :** carte vue de dessus, fixe, tout le hameau visible. Pas de zoom ni de déplacement de caméra.
- **Lumière :** la journée est visible. Le terrain passe du matin clair au soir chaud en 40 s, puis revient au matin. La brume violette n'apparaît que pour la panique, afin qu'elle reste un signal clair.
- **Lisibilité du trafic :** les créatures se serrent, une file se voit sur l'anneau de 10 pastilles, un croisement chargé vibre légèrement.
- **Retour sensoriel :** tic de bois et léger rebond à chaque case posée, clochette de couleur à chaque livraison, vibration courte à la pose d'un cadeau, battement qui accélère pendant la panique.
- **Accessibilité :** symbole sur chaque couleur, animations réduites, mode gaucher (barre du bas et emplacements inversés), aide au tracé, contrastes forts, sons réglables.
- **Ton :** chaleureux, fantasy colorée, miniature vivante. Textes courts, tutoiement partout.
- **Tutoriel :** les 3 premières journées, sans écran de règles. Une flèche animée montre le premier tracé, puis une bulle explique l'effacement, puis la panique la première fois qu'une file dépasse 7.

## Technique

<!-- section : tech -->

- Un `index.html` et des modules JS, Canvas 2D plein écran, boucle `requestAnimationFrame` plafonnée à 60 images par seconde, pointer events (un seul doigt).
- Simulation à pas fixe de 1/30 s, rendu interpolé, générateur à graine : une même graine donne la même partie sur tous les appareils.
- Rendu en couches : terrain (image + texture), chemins, bâtiments, créatures, effets, interface.

### Réseau et trafic

- La carte est un tableau de cases (`Uint8Array` pour l'état, un tableau pour les connexions). Deux cases de chemin voisines sont reliées ; un pont coupe le lien latéral de sa case ; un tunnel ajoute un lien entre ses deux portails.
- **Champ de distance par couleur :** à chaque changement du réseau, un Dijkstra part de tous les ateliers d'une couleur et donne à chaque case le temps de trajet jusqu'au plus proche. Une créature avance vers la case voisine de plus faible valeur. Aucun trajet n'est mémorisé : changer le réseau reroute tout le monde sans calcul spécial. 6 couleurs × 600 cases, très léger.
- Chaque case de chemin tient une file ordonnée de créatures. La vitesse est le minimum entre la vitesse de l'espèce et celle de la créature qui précède.
- Croisements : un verrou par case (capacité 1, 2 pour un rond-point, alternance pour un feu), file d'arrivée premier servi, entrée refusée si la case de sortie est pleine pour éviter les blocages.
- Effacement d'un tronçon : suppression des cases de degré 2 entre deux croisements, extrémités ou bâtiments, et rendu des dalles. Les créatures présentes sur ces cases retournent dans la file de leur chaumière.
- Tracé : le doigt est converti en case, les sauts rapides sont comblés par une ligne à 4 voisins, sans diagonale.

### Données et fichiers

- `data/` : `balance.json`, `species.json`, `bonus.json`, `maps.json`. `lang/` : `fr.json`, `en.json`. `img/` : planches WebP et JSON de découpe. `snd/` : musiques et effets. `sw.js` et `manifest.webmanifest` pour l'installation et le hors ligne.
- Sauvegarde en `localStorage`, clé `pl_save_v1` : rang, livraisons cumulées, meilleurs scores, succès, historique du défi, réglages. Identifiants uniquement, jamais de texte traduit, avec un numéro de version pour migrer.
- Partie en cours sauvegardée à chaque fin de journée (bâtiments, chemins, cadeaux, états des flux aléatoires). Les créatures en route retournent dans la file de leur chaumière à la reprise.
- Sons : WebAudio pour les clochettes et effets simples, mp3 pour les musiques. Vibration via `navigator.vibrate` si disponible.
- Budget : images WebP, poids total visé inférieur à 12 Mo.

### Format de données (exemples)

```jsonc
// maps.json
{
  "id": "fleuve",
  "rank": 2,
  "grid": [20, 30],
  "seed": 20261,
  "building_cap": 26,
  "obstacles": [[3,4,2,2],[14,9,1,1]],
  "water": [[9,0,2,12],[11,12,2,18]],
  "fixed_bridges": [[9,8,4,1],[10,22,4,1]],
  "start": [{ "color": "bleu", "home": [4,6], "work": [15,22] }]
}

// balance.json (extrait)
{
  "day_seconds": 40,
  "tiles_start": 40, "tiles_per_day": 18, "tiles_cap": 120,
  "spawn_period": { "start": 6.0, "factor": 0.96, "min": 3.5 },
  "panic": { "queue_max": 10, "seconds": 10, "release_at": 7 },
  "junction": { "cross_time": 0.30, "roundabout_capacity": 2, "light_period": 2.0, "light_cross_time": 0.10 },
  "draw_slowmo": 0.5
}
```

## Feuille de route de développement

<!-- section : roadmap -->

Chaque étape se termine par un jeu jouable que tu testes sur ton téléphone. On ne passe à la suivante qu'une fois la validation faite.

| Étape | Livrable | Validation (test sur téléphone) |
|---|---|---|
| **V0** Prototype | Système de langues FR/EN, grille 20 × 30, tracé au doigt aimanté, une couleur (1 chaumière, 1 atelier), créatures qui suivent le chemin, livraison et score, effacement d'un tap, décalage du curseur en option | Tracer, voir la créature arriver, effacer, le tout d'une main ; le tracé est agréable |
| **V1** Cœur de jeu | Couleurs rouge et jaune, apparitions des journées 1 à 7 avec chantiers, croisements, files d'attente, panique et défaite, dalles, journées de 40 s, aide au tracé, Annuler, sauvegarde | Une partie complète de 4 à 6 minutes ; l'embouteillage se comprend sans texte ; la sauvegarde survit à un rechargement |
| **V2** Cadeaux et couleurs | Fin de journée avec 3 choix, barre de cadeaux, rond-point, pont, feu, sac de dalles, chemin doré, couleurs verte, violette et orange, espèces et vitesses, appui long | Les cadeaux changent les décisions ; une partie dure 5 à 8 minutes ; les 6 couleurs restent lisibles |
| **V3** Cartes et rangs | Fleuve, Montagnes, Île, tunnel, cloche de secours, atelier de renfort, rangs, Carnet, succès, saisons | Chaque carte se joue différemment ; les déblocages arrivent au bon rythme |
| **V4** Défi et habillage | Défi du jour par graine, historique et série, musiques, effets sonores, vibrations, particules, options d'accessibilité, mode gaucher | La même graine donne la même partie sur deux téléphones ; les clochettes font plaisir ; aucune option n'est cassée |
| **V5** Publication | PWA hors ligne, relecture complète FR/EN, carte sur le hub, logo « K » au lancement, recette finale | Installation depuis le hub, jeu complet hors ligne, deux langues sans clé manquante |

### Principes de travail

- Le développeur livre à chaque étape un lien ou des fichiers prêts à tester, avec les consignes pour l'essayer.
- Tes retours sont classés en corrections (tout de suite) et envies (étape suivante).
- Les images et sons arrivent au fil des étapes ; en attendant, des formes simples colorées servent de remplacement.
- Aucune dépense : outils gratuits, hébergement GitHub Pages, assets générés par toi.
- Une conversation par étape (ou par moitié d'étape), qui ne relit que l'état du projet et les fichiers du GDD utiles.

## Déploiement et langues

<!-- section : deploy -->

### Déploiement sur le hub

- **Cible :** le jeu est publié sur le hub `https://keismey.github.io/` (GitHub Pages), depuis le dépôt `Keismey/Pre-Lune` (le nom du dépôt s'écrit sans accent). Il est référencé depuis la page d'accueil du hub (carte : titre, icône, lien, description courte, en français et en anglais), au même format que les autres jeux.
- **Chemins relatifs uniquement** (jamais de `/` absolu) : le jeu vit dans un sous-chemin du hub. Le `manifest` PWA (`start_url`, `scope`) et le service worker utilisent aussi des chemins relatifs.
- **Aucun outil à installer :** toute la publication se fait depuis l'interface web de GitHub, avec un guidage pas à pas si besoin.
- **Logo :** écran de lancement avec le « K » seul de Keismey Studio.
- **Suivi :** script Cloudflare Web Analytics ajouté à la page, comme sur le hub et les autres jeux.
- **Recette avant mise en ligne :** tester sur smartphone via l'URL du hub (chargement, hors ligne, ajout à l'écran d'accueil, sauvegarde).

### Traduction française / anglaise

- **Deux langues dès la V0 :** FR et EN, traduction faite par le développeur, relue par toi.
- **Aucun texte en dur dans le code :** tous les textes passent par `fr.json` et `en.json`, indexés par identifiants, via une fonction unique `t("clé")`.
- **Choix de la langue :** détection automatique (`navigator.language` : français → FR, sinon EN), sélecteur FR/EN sur l'écran titre, choix mémorisé, changement possible en cours de partie.
- **Sauvegardes indépendantes de la langue :** identifiants uniquement, jamais de texte traduit.
- **Mise en page :** marge dans les boutons et bulles, retours à la ligne automatiques, pas de largeur fixe.
- **Titre et fiche du jeu :** titre, description du hub et textes du manifest PWA fournis en FR et EN.

### Spécifique à ce jeu

- À traduire en priorité : noms des cadeaux, des espèces et des ateliers, textes du tutoriel, de fin de journée et de fin de partie, succès. Plan de dev : système de langues dès **V0**, relecture FR/EN et publication sur le hub à **V5**.

## Recette et équilibrage

<!-- section : recette -->

### Tests à chaque étape

- Test principal sur ton Motorola G84 5G, en main gauche et main droite. Ajouter un téléphone d'entrée de gamme (2 Go de RAM) avant la V5.
- Cibles de performance : 60 images par seconde, 30 minimum. Boucle plafonnée à 60 même sur un écran à 120 Hz. Au plus 120 particules à la fois.
- Aucun blocage de croisement (deux créatures qui se bloquent mutuellement) lors d'une partie de 12 journées chargée.
- Déterminisme : la même graine, avec les mêmes actions rejouées, donne exactement la même partie.
- Rotation d'écran, retour d'une autre application, mise en veille : aucune perte de partie.
- Test d'endurance : 30 minutes de parties enchaînées sans ralentissement ni fuite mémoire.
- Effacer un tronçon en pleine circulation : les créatures concernées retournent en file sans disparaître ni se dédoubler.

### Réglages d'équilibrage

| Symptôme en test | Réglage à essayer |
|---|---|
| Les parties finissent avant la journée 7 | Allonger la cadence (factor de 0,96 vers 0,97) ou donner 22 dalles par journée |
| Les parties passent la journée 14 sans souci | Baisser la cadence minimale à 3,0 s ou avancer les couleurs orange et violette |
| Le joueur manque de dalles | Passer à 20 dalles par journée ou augmenter le poids du Sac de dalles |
| Les files semblent injustes | Élargir le seuil de relâche à 8 ou allonger le compteur à 12 s |
| Les escargots frustrent | Monter leur vitesse à 1,8 ou activer `vitesses_uniques` |
| Le tracé au doigt manque de précision | Activer le décalage du curseur par défaut ou agrandir la zone d'appui des bâtiments |
