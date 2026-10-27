# Pré-Lune · GDD v1 · 04 Audio et assets

## Audio

<!-- section : audio -->

Musiques à générer de ton côté (mp3, boucles propres). Les clochettes et petits effets sont produits par le code (WebAudio), donc sans fichier à fournir.

**Musique du hameau (boucle 2 min)**

```
Musique d'ambiance douce et lumineuse, fantasy pastorale, harpe, flûte, glockenspiel, petites percussions boisées, basse ronde, tempo calme 90 BPM, instrumental, boucle sans fin.
```

**Musique de tension (boucle 90 s, jouée quand une file dépasse 7)**

```
Variation tendue de la musique du hameau, mêmes instruments, pulsation de tambour léger qui accélère doucement, cordes pizzicato, tempo 110 BPM, instrumental, boucle.
```

**Jingle de fin de journée (3 s)**

```
Jingle court et joyeux, notes de glockenspiel ascendantes, accord lumineux, sensation de coucher de soleil.
```

**Jingle de fin de partie (5 s)**

```
Nappe douce et descendante, harpe et voix murmurée sans paroles, brume qui tombe, mélancolique mais apaisante.
```

### Effets sonores

- **Clochette de livraison :** une note par couleur, sur une gamme pentatonique (do, ré, mi, sol, la, puis do aigu pour la sixième). Un réseau qui tourne bien joue une petite mélodie.
- Pose d'une case de chemin : tic de bois dont la hauteur monte avec la longueur du tracé.
- Effacement : pop doux. Annuler : petit retour en arrière.
- Croisement chargé : léger tchak. Rond-point, feu de lanterne (tic-tac), pont, tunnel, chemin doré.
- Chantier : coups de marteau. Apparition d'un bâtiment : petit carillon.
- File qui grossit : tintement discret. Panique : battement grave qui accélère. Panique évitée : soupir de soulagement.
- Choix d'un cadeau : arpège. Cloche de secours : grosse cloche.
- Interface : toucher, pause, ouverture et fermeture de menu.

## Assets (Gemini)

<!-- section : assets -->

Règle : pas plus de 3 à 4 éléments par planche, un style commun collé au début de chaque prompt (le bouton le fait pour toi). Fonds unis pour découper facilement. Aucune image ne contient de texte. Les créatures sont dessinées tête vers le haut : le code les fait tourner selon leur direction.

**Style commun (à coller dans chaque prompt)**

```
Illustration 2D de jeu mobile en vue de dessus (top-down), style cartoon vectoriel doux et très coloré, contours nets, palette fantasy saturée (bleu, rouge, jaune, vert, violet, orange), lumière douce de fin d'après-midi, formes simples et lisibles à petite taille, sans texte, sans personnage existant.
```

Chaque prompt ci-dessous se colle **après** ce style commun (sur la page du GDD, le bouton « Copier le prompt » l'ajoutait tout seul).

**Règle de lisibilité chaumière / atelier (planches 1 à 4).** La **couleur** relie une chaumière à son atelier (même couleur dominante, très saturée, identique sur les deux planches : à joindre en image de référence dans Gemini pour garder la même teinte) ; le **design** les distingue au premier coup d'œil, même à 40 px.

| | Chaumière | Atelier |
|---|---|---|
| Silhouette | petite, presque carrée, toit en pente à deux pans | environ 1,3 fois plus grand, large et bas, jamais de toit de chaumière |
| Sol | jardin d'herbe avec fleurs | socle carré de pavés beiges, sans herbe |
| Cheminée | petite cheminée en briques qui fume | pas de cheminée qui fume (seule la forge a une énorme cheminée à flammes) |
| Repère | porte ronde, aspect douillet | un grand objet emblématique bien visible (lanterne, enclume, dôme de ruche, dôme d'observatoire, marmite) |

### Planche 1 : chaumières bleue, rouge, jaune (3)

```
Planche sur fond uni clair, 3 petites chaumières de conte de fées vues de dessus, grille 1x3, même taille et mêmes proportions, silhouette presque carrée lisible à petite taille. Chaque chaumière a un toit en pente à deux pans, entièrement d'une seule couleur très saturée (un toit bleu en tuiles rondes, un toit rouge en tuiles, un toit jaune de chaume), une petite cheminée en briques qui fume, une porte ronde en bois, et un petit jardin d'herbe avec quelques fleurs et un buisson. Aspect douillet et habité : c'est une maison, pas un atelier. Aucun grand objet, aucun outil.
```

### Planche 2 : chaumières verte, violette, orange (3)

```
Même cadrage, même style et mêmes règles que la planche précédente (grille 1x3, maisons douillettes à toit en pente, cheminée qui fume, porte ronde, jardin d'herbe) : un toit de mousse verte, un toit violet en tuiles, un toit orange de chaume.
```

### Planche 3 : ateliers bleu, rouge, jaune (3)

```
Planche sur fond uni clair, 3 ateliers vus de dessus, grille 1x3, même taille entre eux, environ 1,3 fois plus grands que des chaumières, silhouette large et basse, chacun posé sur un socle carré de pavés beiges (pas d'herbe). Ils ne doivent surtout pas ressembler à des maisons : pas de toit de chaumière en pente, pas de petite cheminée qui fume. Chacun a une couleur dominante très saturée portée par son auvent, son toit ou son dôme, et un grand objet emblématique bien visible : 1) la lanternerie (bleu) : un pavillon ouvert sous un auvent bleu rayé, avec une énorme lanterne lumineuse sur le faîte et des guirlandes de lanternes ; 2) la forge (rouge) : un bâtiment trapu en pierre sombre à toit plat rouge, avec une énorme cheminée de pierre qui crache des flammes et des étincelles, et une grande enclume devant ; 3) la miellerie (jaune) : un grand dôme en forme de ruche jaune rayée de miel, avec des tonneaux de miel et quelques abeilles.
```

### Planche 4 : ateliers vert, violet, orange (3)

```
Même cadrage et mêmes règles que la planche précédente (grille 1x3, environ 1,3 fois plus grands que des chaumières, silhouette large et basse, socle carré de pavés beiges sans herbe, jamais de toit de maison ni de petite cheminée qui fume) : 1) la serre (vert) : une grande serre en verre à ossature verte pleine de plantes ; 2) l'observatoire (violet) : une tour ronde à grand dôme violet ouvert avec une grande lunette dorée ; 3) la marmite (orange) : un auvent à toit orange abritant une énorme marmite noire fumante sur un feu.
```

### Planche 5 : créatures bleue, rouge, jaune (3)

```
Planche sur fond uni clair, 3 petites créatures vues de dessus, tête vers le haut, une seule pose, grille 1x3 : une luciole portant un pot de lumière, un hérisson avec un petit sac de braises, un escargot dont la coquille déborde de miel. Même échelle, silhouettes lisibles à 40 pixels.
```

### Planche 6 : créatures verte, violette, orange (3)

```
Même cadrage que la planche précédente, grille 1x3 : un golem de mousse trapu portant un sac de terreau, un lutin à chapeau pointu avec un sac d'étoiles, un crapaud qui porte une citrouille sur le dos.
```

### Marche de la luciole (4 images, optionnel V4)

```
Planche de 4 images en grille 2x2 sur fond uni, même luciole vue de dessus, tête vers le haut, 4 étapes d'un petit battement d'ailes et d'un balancement du pot de lumière. Cadrage et taille identiques. Répéter pour chaque espèce avec la même méthode.
```

### Texture d'herbe (1 image)

```
Texture d'herbe de prairie vue de dessus, douce, légèrement fleurie, parfaitement répétable sans coutures visibles, sans élément remarquable, contrastes faibles pour ne pas gêner la lisibilité.
```

### Texture de chemin (1 image)

```
Texture de chemin de pierre claire et de terre vue de dessus, répétable sans coutures, petits pavés arrondis, teinte chaude et claire, contrastes faibles.
```

### Obstacles (4)

```
Planche sur fond uni clair, 4 obstacles vus de dessus en grille 2x2 : un grand chêne rond, un bosquet de sapins, un rocher moussu, un massif de fleurs sauvages.
```

### Eau et montagne (4)

```
Planche sur fond uni clair, 4 éléments de terrain vus de dessus en grille 2x2 : une tuile d'eau de rivière avec reflets, une rive herbeuse au bord de l'eau, un bloc de montagne aux sommets neigeux, un portail de tunnel en pierre.
```

### Cadeaux 1 : rond-point, pont, feu, tunnel (4)

```
Planche sur fond uni clair, 4 icônes d'objets de jeu en grille 2x2 : un rond-point pavé avec une petite fontaine au centre, un pont de pierre en dos d'âne, une lanterne à deux flammes sur un poteau, une entrée de tunnel creusée dans un rocher.
```

### Cadeaux 2 : dalles, chemin doré, cloche, atelier (4)

```
Planche sur fond uni clair, 4 icônes d'objets de jeu en grille 2x2 : un petit sac de dalles de pierre, un morceau de chemin aux pavés dorés brillants, une cloche de laiton avec une corde, une petite maquette d'atelier posée sur un chantier.
```

### Chantier et effets (4)

```
Planche sur fond uni clair, 4 effets en grille 2x2 : un panneau de chantier en planches avec un pot de peinture colorée (sans texte), des confettis de livraison multicolores, un nuage de brume violette douce, un éclat d'alerte rouge.
```

### Fond de fin de partie (1 image)

```
Image verticale du hameau vu de haut au crépuscule, couvert d'une brume violette qui monte, toits colorés encore visibles, grand espace libre en bas pour poser des boutons. Sans texte.
```

### Icône du jeu et écran titre (2 images séparées)

```
Deux images séparées sur fond uni : 1) une icône carrée d'application, une petite luciole souriante portant un pot de lumière sur un chemin pavé, centrée ; 2) un écran titre vertical, un petit hameau coloré vu de dessus avec des chemins qui serpentent et quelques créatures qui circulent, grand espace libre en haut pour poser le logo. Sans texte dans les deux cas.
```

### Variantes de saisons (méthode)

```
Pas de nouvelle planche : dans Gemini, repartir de l'image d'herbe et de chemin et demander : même image en automne (herbe dorée, feuilles rousses), en hiver (neige légère), ou de nuit (bleu profond, petites lueurs), sans changer le cadrage ni la répétabilité.
```
