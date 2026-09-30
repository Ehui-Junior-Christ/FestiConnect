# FestiConnect — « Le point de rendez-vous »

**Script de production — vidéo de présentation en motion design, 16:9**
Version 1.0 — 30 septembre 2026 — statut : script validable, en attente de l'audio

| | |
|---|---|
| Format | 16:9, 1920 × 1080, 30 i/s (60 i/s possible), MP4 H.264 yuv420p, audio AAC 48 kHz |
| Durée master | **80 s** (40 mesures à 120 BPM) |
| Déclinaison | **30 s** réseaux sociaux (15 mesures), même univers, mêmes scènes resserrées |
| Langue | Français, voix off en tutoiement, sous-titrage recommandé pour la diffusion sans le son |
| Fichier maître des temps | `video/timeline.json` (80 s) et `video/timeline-30s.json` (30 s) |
| Version actuelle | Toutes les séquences (A à H) animées ; audio provisoire généré (voix de synthèse + musique originale, 7.4) |

Notation des temps dans ce document : `mm:ss.d` (minutes, secondes, dixièmes). À 120 BPM, un temps = 0,5 s, une mesure = 2 s ; la mesure *n* commence à (n − 1) × 2 s. Les timecodes seront recalés sur l'audio réel (section 7.3) : ce qui compte ici, c'est l'ordre, les durées relatives et les temps forts.

---

## 1. Concept créatif

### 1.1 L'idée maîtresse : la pastille

Tout le film tient dans **un point orange**.

C'est la pastille de l'interface de FestiConnect, le bouton qu'on touche, le point de rendez-vous sur la carte, la couleur du soleil sur l'affiche de l'Abissa. Dans la vidéo, ce point naît dans le noir à 21 h à Abidjan, devient une ville dans une constellation, se transforme en aplat qui remplit l'écran, puis se pose **sur le i de FestiConnect**. Il devient ensuite le bouton de recherche, l'indicateur de toucher, le bouton de paiement qui se resserre pendant l'attente, l'œil du QR code du billet. À la fin, il reste seul dans le noir et se referme : **le point final**.

Un seul signe graphique fait donc à la fois le logo, le lien entre les scènes et le sens du produit : FestiConnect, c'est l'endroit où tout se retrouve. L'expression « mettre les points sur les i » rejoint la promesse du produit : l'information est claire (prix, lieu, places restantes), le paiement confirmé et le billet vérifié.

### 1.2 Message clé

> Trouver sa sortie, payer avec son mobile money, entrer avec un scan. Et pour l'organisateur : créer, vendre, encaisser. Tout au même endroit.

Signature de fin : **« On est ensemble. »** L'expression est courante en Côte d'Ivoire et elle est sincère : elle dit la communauté, la fête et la confiance sans slogan publicitaire.

### 1.3 Ton

- **Nocturne, chaleureux, confiant.** Abidjan un vendredi soir : l'énergie d'une ville qui sort, sans carte postale.
- **Clair avant d'être spectaculaire.** Chaque effet sert une information : un chiffre, un geste ou une étape. On voit l'app fonctionner.
- **Rythmé.** Coupes sur les premiers temps, accents sur les temps, jamais plus d'une seconde sans mouvement.
- **Proche.** Tutoiement, phrases courtes, vocabulaire du quotidien (maquis, file, monnaie). Pas de jargon « plateforme », « solution », « écosystème », « révolutionner ».

### 1.4 Public cible

| Cible | Ce qu'elle doit retenir | Où c'est dit |
|---|---|---|
| Primaire : 18–35 ans urbains (Abidjan, Bouaké, Yamoussoukro, Grand-Bassam, San-Pédro), équipés smartphone et mobile money | « Je trouve, je paie avec Wave / Orange Money / Moov Money, j'entre avec mon code » | Séquences D, E, H |
| Secondaire : organisateurs (collectifs, promoteurs, maquis, festivals, créateurs de mode) | « Je publie vite, je vois mes ventes en direct, je retire sur mobile money » | Séquence F |
| Tertiaire : partenaires, sponsors, investisseurs, presse | « Produit réel, complet, sérieux (validation des événements) et ancré localement » | Séquences C, G et l'ensemble |

### 1.5 Durées et déclinaisons

- **Master 80 s** (recommandé ; la fourchette de 60 à 90 s est tenable en élaguant E ou G). C'est la durée qu'il faut pour montrer les deux côtés du produit sans sacrifier la lisibilité.
- **Version courte 30 s** (section 6) : parcours client seulement, avec un clin d'œil organisateur et le carton final. Destinée à Instagram, Facebook, TikTok (en 16:9 dans le fil ou recadrée), YouTube pre-roll et WhatsApp Status.
- Déclinaisons possibles ensuite, avec les mêmes scènes : 15 s (A2 + C1 + D3 + H2), bumper 6 s (C1 + H2), formats 9:16 et 1:1. Les scènes sont codées en coordonnées 1920 × 1080 : un recadrage vertical demandera une mise en page dédiée des séquences D et F.

---

## 2. Direction artistique

### 2.1 Palette

La palette part des visuels déjà présents dans l'app (`public/assets/img/*.svg` : orange `#ff5f1f`, sable `#ffd08a`, crème `#f7f2ea`, brun `#21130d`) et de l'accent cyan de l'interface actuelle (`#78d8ff`), resserré en « lagune ».

| Nom | Hex | Rôle | Part de l'image |
|---|---|---|---|
| Nuit d'Abidjan | `#0D0B0A` | Fond principal, noir chaud (jamais de noir pur, sauf le noir final) | ~65 % |
| Nuit chaude | `#171210` | Surfaces d'interface, cartes | ~8 % |
| Latérite | `#2A1810` | Fonds d'affiches, halos sombres | ~4 % |
| Brun | `#4A2A1A` | Motifs de trame ton sur ton | ~2 % |
| **Orange pastille** | `#FF5F1F` | Couleur signature : la pastille, les actions, les accents | ~8 % |
| Or | `#FFB938` | Dégradé de jauge, touches de lumière | ~1 % |
| Sable | `#FFD08A` | Montants, labels, panneaux de trame | ~3 % |
| Crème pagne | `#F7F2EA` | Texte principal, billet papier | ~8 % |
| Lagune | `#4CC9F0` | Accent froid rare : littoral, lagune Ébrié | < 1 % |
| Vert validé | `#2EE07A` | **Uniquement** les confirmations (paiement reçu, accès validé, événement validé) | < 1 % |

Règle : un seul accent chaud dominant par plan (l'orange) ; le vert n'apparaît que lorsqu'une action réussit, pour que le spectateur l'associe à « c'est bon ».

### 2.2 Typographies

Toutes sous licence libre (SIL OFL), embarquées localement (`@fontsource`) pour un rendu identique partout.

| Usage | Police | Réglages |
|---|---|---|
| Titres, verbes, logo | **Bricolage Grotesque** (variable) | Graisse 800, interlettrage −3,5 %, interlignage 0,92. Grotesque expressive aux contre-formes vivantes, qui a l'air dessinée à la main sans être fantaisiste. |
| Interface, phrases, signature | **Sora** | 400 à 800. C'est la police actuelle de l'app : les écrans du film ressemblent au produit. |
| Codes, montants, heures, étiquettes | **JetBrains Mono** | 500 à 700, capitales espacées de +16 %. Pour ce qui se lit comme une donnée : `FC-DEMO-2026`, `21:00:00`, `30 000 F`, `01 / 04 · RECHERCHE`. |

Montants : espace fine insécable comme séparateur de milliers (`15 000 F`), suffixe « F » (usage courant pour le franc CFA), « FCFA » dans les contextes formels.

### 2.3 Style graphique : « la trame »

**Principe.** Le wax n'est pas copié : on lui emprunte sa logique. Des modules géométriques simples, répétés en grille, en couleurs franches, qui prennent du sens par la répétition et le contraste. On en tire cinq modules, chacun venu d'un visuel existant de l'app :

| Module | Origine | Sens porté |
|---|---|---|
| **Cercles** concentriques | Affiche « Maquis Electronic Night » | Le son, l'enceinte, l'onde qui se propage (la pastille qui pulse) |
| **Tirets** épais | Ligne pointillée de l'affiche Abissa | La route, la perforation du billet, la file qu'on évite |
| **Chevrons** | Affiche « Salon Mode Sahel » | Le défilé, la mode, le mouvement vers l'avant |
| **Grille et points** | Motif du visuel d'accueil | La ville la nuit, les lumières, le réseau |
| **Arcs** | Collines et ondulations des affiches | La lagune, les ponts d'Abidjan, les vagues de Grand-Bassam |

Les modules mesurent 160 px de base et s'utilisent en panneaux pleins (transitions, mots-chocs), en bandes (bas d'affiche), en fond ton sur ton (écart de luminosité inférieur à 10 %) ou en détail (œil du QR, séparateurs).

**La ville.** Abidjan n'est pas montrée en carte postale. On la montre par des données : coordonnées (05°20′N 04°01′O), horloge qui bascule à 21:00:00, constellation des villes reliées (Abidjan, Grand-Bassam, Yamoussoukro, Bouaké, San-Pédro, Korhogo), trois lignes de littoral couleur lagune.

**Les interfaces** sont recréées en vectoriel et non filmées : téléphone sombre en légère perspective (rotation Y de −9° et X de 3°, dérive lente), écrans lisibles à 1080p (texte d'interface de 15 px minimum dans l'écran du téléphone, 24 px minimum à l'écran).

**Textures.** Grain fin animé (opacité 5,5 %, mode incrustation), vignettage doux, halos orange flous derrière les sujets. Pas d'effets de verre ni de reflets chromés.

**Ce qu'on s'interdit** : masques, djembés, silhouettes de baobab ou de savane, couchers de soleil « Afrique », contour du continent, motifs kente ou wax reproduits tels quels, typographies « tribales », foules en clip-art. L'ancrage vient des lieux, des noms, des usages (maquis, mobile money, Abissa) et de la lumière, pas des symboles.

### 2.4 Grammaire de mouvement

**Courbes** (définies dans `stage/lib/motion.js`) :

| Nom | Courbe | Usage |
|---|---|---|
| `festi` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrée signature : départ franc, long atterrissage. Textes, cartes, éléments d'interface. |
| `glisse` | `cubic-bezier(0.65, 0, 0.35, 1)` | Déplacements de caméra, changements d'écran, iris. |
| `sortie` | `cubic-bezier(0.55, 0, 1, 0.45)` | Sorties : on accélère vers l'extérieur, on ne « freine » jamais en sortant. |
| `pop` | retour arrière 1,7 | Impacts sur les temps : chiffres qui roulent, tampons. |
| Ressort | 2,2 à 2,8 Hz, amortissement 6 à 8 | Naissance de la pastille, boutons, coches. |

**Durées de référence** : entrée 0,45 à 0,6 s ; décalage entre caractères 25 à 40 ms ; sortie 0,3 s ; transition d'écran 0,5 s ; aucun élément ne reste immobile plus d'une seconde (dérive de caméra permanente de 1 à 3 %).

**Rythme** : les **coupes** tombent sur le premier temps de la mesure, les **accents** (apparition d'un mot, d'une carte, d'un tap) sur les temps. Les mouvements **commencent 0,2 à 0,3 s avant** le temps pour **atterrir dessus** : c'est l'anticipation qui donne l'impression que l'image joue la musique.

**Transitions signatures** :

1. **La Pastille** (iris) : un disque orange grandit depuis un point de l'image jusqu'à couvrir le cadre, ou un aplat orange se referme sur un élément du plan suivant (le i du logo, le bouton de recherche). C'est le raccord principal du film (B2 vers C1, C2 vers D1, H1 vers H2).
2. **Le Pagne** : un panneau de trame entre en biais (bord d'attaque à 12°) de droite à gauche en 0,2 s et arrive exactement sur le temps (B1, H1, et en bande de trame pour E1).
3. **Le Scan** : une ligne lumineuse verte balaie un élément et le valide (billet D4, validation G1).
4. **Le Push** : changement d'écran à l'intérieur du téléphone (poussée latérale, l'écran sortant recule de 32 % et s'assombrit).
5. **Raccord de forme** : un rond devient un autre rond (pastille, bouton, tap, coche, œil de QR, point final).

**Caméra** : 2,5D, profondeur faible. Un seul grand mouvement par séquence (recul A2, plongée C2), le reste en dérive.

### 2.5 Traitement du logo

- **Mot-symbole** : « FestiConnect » en Bricolage Grotesque 800, crème sur nuit, interlettrage serré, **le point du i remplacé par la pastille orange** (i sans point + disque orange de 9,2 % du corps, légèrement surdimensionné par rapport au point typographique).
- **Animations de marque** :
  - *Atterrissage* (C1) : un aplat plein cadre se contracte en 0,62 s sur le point du i, avec un rebond et deux ondes ; les lettres montent depuis le i vers l'extérieur (35 ms par rang).
  - *Respiration* : la pastille sautille de 14 px sur chaque temps tant que le logo est seul à l'écran.
  - *Aspiration* (C2) : les trois promesses (Billetterie, Boutique, Paiement mobile) glissent dans la pastille, qui grossit à chaque absorption : « tout au même endroit ».
  - *Point final* (H2) : le logo s'éteint, la pastille glisse au centre, grossit une dernière fois et se referme sur le noir.
- **Zone de protection** : hauteur d'une capitale autour du mot-symbole. Pas d'ombre, pas de contour, pas de dégradé sur le logo.
- **Statut** : c'est une proposition pour la vidéo. Si la refonte de l'interface fixe un logo différent, l'animation reste valable tant que le logo garde un point (la pastille peut devenir le point d'un autre signe ou une pastille à côté du mot).

### 2.6 Alignement avec la refonte de l'interface

L'interface est en cours de refonte. Pour aligner la vidéo sans la reconstruire :

- Les couleurs sont centralisées dans `stage/styles.css` (variables `:root`) et `stage/lib/motifs.js` (objet `C`) ; les polices dans les `@font-face` de `stage/styles.css`.
- Les données affichées (événements, prix, produits, client, code billet) sont centralisées dans `video/content.json`.
- Les écrans du téléphone sont décrits en HTML/CSS simple dans `stage/scenes/parcours.js` : on peut reprendre composants, rayons et espacements de la nouvelle UI en une passe.
- Ce qu'il ne faut pas perdre : un seul orange signal, des fonds sombres chauds et le vert réservé aux confirmations.

---

## 3. Structure (version longue 80 s)

| Séq. | Temps | Mesures | Rôle narratif | Énergie musicale |
|---|---|---|---|---|
| **A** Ouverture — Abidjan, 21 h | 00:00.0 → 00:08.0 | 1–4 | Installer le lieu, l'heure, l'envie de sortir | Intro nocturne, kick filtré qui s'ouvre |
| **B** La fête sous toutes ses formes | 00:08.0 → 00:16.0 | 5–8 | L'offre (concerts, festivals, maquis, défilés), puis la question : comment avoir sa place ? | Le groove entre, frappes sur les temps, montée |
| **C** Révélation du logo | 00:16.0 → 00:22.0 | 9–11 | La réponse : FestiConnect | **Drop** sur 00:16.0 |
| **D** Parcours client | 00:22.0 → 00:48.0 | 12–24 | Trouve, choisis, paie, entre : la démonstration | Groove principal, allégé sous la voix |
| **E** Boutique officielle | 00:48.0 → 00:54.0 | 25–27 | Le merch : prolonger la fête | Variation (motif mélodique percussif) |
| **F** Espace organisateur | 00:54.0 → 01:06.0 | 28–33 | Créer, suivre, encaisser | Pulsation régulière, plus « machine » |
| **G** Validation et confiance | 01:06.0 → 01:10.0 | 34–35 | Sérieux : chaque événement est vérifié | Break, tension, impact sur 01:08.0 |
| **H** Final | 01:10.0 → 01:20.0 | 36–40 | Récapitulatif en trois mots, logo, signature | Relance, dernier impact à 01:14.0, queue jusqu'à 01:20.0 |

---

## 4. Découpage plan par plan — version longue

Pour chaque plan : visuel, animation, texte à l'écran, voix off (heure de départ indicative), musique et sound design, et les **temps forts** sur lesquels l'image doit tomber.

### SÉQUENCE A — Ouverture « Abidjan, 21 h »

#### Plan A1 — 00:00.0 → 00:04.0 (4,0 s) — mesures 1–2

- **Visuel** : noir chaud. Cadre serré (zoom × 3,1 → × 3,35) sur un point de la ville. Une pastille orange naît au centre droit, entourée d'ondes. À gauche, grande typographie. En haut à droite, une horloge.
- **Animation** : la pastille naît en ressort ; une onde part de la pastille à **chaque temps** (crème et fine sur les temps faibles, orange et large sur les premiers temps). La grille de points de la ville se révèle en cercle autour de la pastille. Le titre monte lettre par lettre depuis la ligne de base. L'horloge défile seconde par seconde et bascule sur 21:00:00.
- **Texte à l'écran** : `CÔTE D'IVOIRE · 05°20′N 04°01′O` (tapé en mono) / **Abidjan.** (le point du titre en orange) / *Vendredi, 21 h* / horloge `VEN. 20:59:58` → `21:00:00`.
- **Voix off** (00:01.0) : « Abidjan. Vendredi, vingt et une heures. »
- **Musique / SD** : nappe grave, ambiance urbaine lointaine (circulation, conversation de maquis très filtrée). Un « pop » sourd à la naissance de la pastille, puis un kick filtré dont chaque coup coïncide avec une onde.
- **Temps forts** : 00:00.5 naissance de la pastille · 00:01.0 « Abidjan. » · **00:02.0 horloge à 21:00:00, sous-titre, grande onde orange** · puis une onde à chaque temps.

#### Plan A2 — 00:04.0 → 00:08.0 (4,0 s) — mesures 3–4

- **Visuel** : la caméra recule (× 3,35 → × 1, en 1,65 s, courbe `glisse`). La pastille devient **Abidjan** dans une constellation de villes. Trois lignes de littoral couleur lagune se tracent sous Abidjan et Grand-Bassam.
- **Animation** : le texte de A1 sort par le haut. Les liaisons partent de la ville source et **atterrissent sur le temps** ; à l'arrivée, la ville apparaît en ressort avec une onde orange et son nom en mono. Une fois tracées, des étincelles sable circulent sur les liaisons (le réseau est vivant).
- **Texte à l'écran** : **Ce soir, / tout le monde / sort.** — étiquettes `ABIDJAN`, `GRAND-BASSAM`, `YAMOUSSOUKRO`, `BOUAKÉ`, `SAN-PÉDRO`, `KORHOGO`.
- **Voix off** (00:04.3) : « Au Plateau, à Grand-Bassam, à Bouaké… ce soir, tout le monde sort. »
- **Musique / SD** : le filtre s'ouvre, hi-hats. Un « tic » léger à chaque arrivée de ville. Riser court à partir de 00:07.0.
- **Temps forts** : 00:04.0 début du recul · 00:04.5 Grand-Bassam + « Ce soir, » · 00:05.0 Yamoussoukro · 00:05.5 Bouaké + « tout le monde » · 00:06.0 San-Pédro · 00:06.5 Korhogo · 00:07.6 sortie des textes · **00:08.0 coupe franche**.

### SÉQUENCE B — La fête sous toutes ses formes

#### Plan B1 — 00:08.0 → 00:12.0 (4,0 s) — mesures 5–6

- **Visuel** : quatre panneaux plein cadre, un par temps fort, chacun avec son module de trame ton sur ton et un mot géant.
  1. **Concerts.** — orange, module *cercles*, texte nuit, point crème.
  2. **Festivals.** — sable, module *tirets*, texte nuit, point orange.
  3. **Maquis.** — nuit, module *grille*, texte crème, point orange.
  4. **Défilés.** — crème, module *chevrons*, texte nuit, point orange.
- **Animation** : transition « Le Pagne » (bord à 12°, 0,2 s avant le temps). Le mot claque avec ses lettres montantes et un léger recul d'échelle (1,07 → 1). La trame dérive lentement en diagonale. Compteur `01 / 04` en mono.
- **Voix off** (00:08.1) : « Concert, festival, soirée maquis, défilé. »
- **Musique / SD** : le groove entre à 00:08.0. Une frappe (tom grave ou log drum) par panneau, un « swish » de tissu à chaque entrée de panneau.
- **Temps forts** : **00:08.0 Concerts** · **00:09.0 Festivals** · **00:10.0 Maquis** · **00:11.0 Défilés**.

#### Plan B2 — 00:12.0 → 00:16.0 (4,0 s) — mesures 7–8

- **Visuel** : fond nuit. Trois affiches en éventail (Festival Abissa Experience, Maquis Electronic Night, Salon Mode Sahel) avec catégorie, ville, date et prix. Au-dessus, une question en trois mots.
- **Animation** : les affiches montent depuis le bas en ressort, une par temps, et dérivent en s'écartant. Les mots de la question tombent sur les temps. À 00:15.3, **iris orange** depuis le centre qui couvre tout le cadre à 00:16.0, pendant que les affiches reculent.
- **Texte à l'écran** : **Où ? Quand ? Comment ?** (« Comment ? » en orange) — sur les affiches : `TRADITION · GRAND-BASSAM`, `Ven. 14 août 2026 · dès 15 000 F`, etc.
- **Voix off** (00:12.2) : « Et toujours la même question : où, quand… et comment avoir sa place ? »
- **Musique / SD** : la montée s'intensifie, roulement de caisse claire ou de percussions sur la mesure 8, coupure d'une demi-mesure (silence ou aspiration inversée) avant le drop.
- **Temps forts** : 00:12.0 / 00:12.5 / 00:13.0 affiches · 00:13.5 « Où ? » · 00:14.0 « Quand ? » · 00:14.5 « Comment ? » · 00:15.3 début de l'iris · **00:16.0 plein orange**.

### SÉQUENCE C — Révélation du logo

#### Plan C1 — 00:16.0 → 00:20.0 (4,0 s) — mesures 9–10

- **Visuel** : l'aplat orange plein cadre se contracte et **devient le point du i** de FestiConnect. Fond nuit, anneaux concentriques pointillés très discrets qui tournent lentement, halo orange.
- **Animation** : contraction en 0,62 s (courbe `glisse`), rebond en ressort, deux ondes (orange, crème). Les lettres montent depuis le i vers l'extérieur. Puis la pastille sautille sur chaque temps. Les trois promesses apparaissent une par temps, séparées par de petites pastilles.
- **Texte à l'écran** : **FestiConnect** — `Billetterie · Boutique · Paiement mobile`.
- **Voix off** (00:16.65, sur l'atterrissage de la pastille) : « FestiConnect. Billetterie, boutique, paiement mobile : »
- **Musique / SD** : **drop à 00:16.0**, impact grave avec une courte queue de réverbération. Le logo est accompagné d'un son de marque court (voir 7.1.4, « sonal »).
- **Temps forts** : **00:16.0 drop, contraction** · 00:16.6 atterrissage sur le i · 00:18.0 Billetterie · 00:18.5 Boutique · 00:19.0 Paiement mobile.

#### Plan C2 — 00:20.0 → 00:22.0 (2,0 s) — mesure 11

- **Visuel** : les trois promesses sont aspirées dans la pastille, qui gonfle à chaque absorption puis pulse. Puis **plongée** dans la pastille : zoom exponentiel jusqu'à ce que l'orange remplisse le cadre.
- **Texte à l'écran** : FestiConnect seul.
- **Voix off** (00:20.0) : « tout au même endroit. »
- **Musique / SD** : trois petits « blips » ascendants (un par promesse absorbée), puis une aspiration (reverse cymbal) pendant la plongée.
- **Temps forts** : 00:20.0 / 00:20.2 / 00:20.4 absorptions · 00:20.8 pulsation · 00:21.4 début de la plongée · **00:22.0 plein orange**.

### SÉQUENCE D — Parcours client dans l'app

Dispositif commun aux plans D1 à D4 : un seul téléphone reste à l'écran, à droite (continuité). À gauche, une légende en trois étages :

- l'étape en mono orange (`01 / 04 · RECHERCHE`) ;
- **un verbe à l'impératif**, en Bricolage 200 px, avec un point orange ;
- un sous-titre en Sora 40 px ;
- dessous, une barre de progression en 4 segments.

Le verbe change sur le premier temps de chaque plan. Derrière le téléphone, de grands anneaux concentriques couleur sable (4 à 13 % d'opacité) tournent lentement et « respirent » sur le premier temps de chaque mesure. Chaque interaction est signalée par un **tap** : une pastille orange translucide et un anneau qui s'ouvre, 0,1 s avant l'action.

#### Plan D1 — 00:22.0 → 00:28.0 (6,0 s) — mesures 12–14 — « Trouve. »

- **Visuel** : écran d'accueil de l'app. « Salut Awa », « Qu'est-ce qu'on fait ce soir ? », champ de recherche avec bouton rond orange, filtres, trois résultats.
- **Animation** : **raccord Pastille**, l'aplat orange se referme exactement sur le bouton de recherche (0,7 s) pendant que le téléphone monte. Saisie lettre par lettre de « Abissa », avec un curseur qui clignote sur les temps. Les filtres « Tradition » puis « Grand-Bassam » s'allument sur deux temps. Les trois cartes de résultat montent une par temps. Tap sur la première carte.
- **Texte à l'écran** : légende `01 / 04 · RECHERCHE` — **Trouve.** — *Artiste, ville, date.* ; à l'écran du téléphone : `3 résultats`, « Festival Abissa Experience — Grand-Bassam · 14 août — dès 15 000 F », « Maquis Electronic Night — Abidjan · 21 juin — dès 25 000 F », « Salon Mode Sahel — Bouaké · 5 juil. — dès 8 000 F ».
- **Voix off** (00:22.3) : « Tu cherches un artiste, une ville, une date ? L'événement est là, en quelques secondes. »
- **Musique / SD** : groove principal, allégé (ducking de −4 à −6 dB sous la voix). Cliquetis de clavier doux, un « tick » par filtre, un « pop » par carte.
- **Temps forts** : 00:22.0 raccord pastille · 00:22.8 → 00:24.0 saisie · 00:24.0 Tradition · 00:24.3 Grand-Bassam · 00:24.5 / 00:25.0 / 00:25.5 cartes · 00:27.4 tap.

#### Plan D2 — 00:28.0 → 00:34.0 (6,0 s) — mesures 15–17 — « Choisis. »

- **Visuel** : fiche de l'événement. Visuel Abissa en tête, étiquettes « Tradition » et « Officiel », titre, date, lieu, organisateur, jauge de places, barre d'achat en bas avec le prix et le bouton « Réserver ».
- **Animation** : poussée latérale de l'écran (de 00:27.7 à 00:28.2, atterrit sur le temps). L'image de tête se dézoome (1,18 → 1). Les infos montent en décalé. La jauge se remplit de 0 à 384 / 1 200 en 1,4 s, et le compteur « places restantes » descend jusqu'à 816. Le bouton « Réserver » pulse avec un halo, puis tap.
- **Texte à l'écran** : `02 / 04 · ÉVÉNEMENT` — **Choisis.** — *Prix, lieu, places restantes.* ; téléphone : « Festival Abissa Experience », « Ven. 14 août 2026 · 18:00 », « Place Abissa, Grand-Bassam », « Collectif Nouchi Live », « Places vendues 384 / 1 200 », « 816 places restantes », « 15 000 F par billet », « Réserver ».
- **Voix off** (00:28.3) : « Date, lieu, prix, places restantes : tout est clair avant même de payer. »
- **Musique / SD** : un « whoosh » court pour la poussée, un tic-tic de compteur pendant la jauge, un accord léger sur le halo du bouton.
- **Temps forts** : **00:28.0 poussée** · 00:28.3 infos · 00:29.5 → 00:30.9 jauge · 00:31.5 halo du bouton · 00:33.4 tap « Réserver ».

#### Plan D3 — 00:34.0 → 00:42.0 (8,0 s) — mesures 18–21 — « Paie. »

- **Visuel** : feuille de paiement qui monte sur la fiche assombrie : quantité, total, choix du moyen de paiement (Wave, Orange Money, Moov Money), bouton de paiement. Puis écran de confirmation vert et notification.
- **Animation** : la feuille monte (00:33.7 → 00:34.3). Tap sur « + » : le chiffre roule de 1 à 2 et le total passe de 15 000 à 30 000 F. Les trois moyens de paiement entrent en décalé. Tap sur Wave : bouton radio en ressort, cadre orange. Tap sur « Payer 30 000 F avec Wave » : **le bouton se resserre en pastille**, trois points rebondissent sur les temps, et on lit « Confirme le paiement sur ton téléphone ». **La pastille devient la coche verte** : cercle vert, coche tracée, « Paiement reçu ». Une notification descend du haut de l'écran.
- **Texte à l'écran** : `03 / 04 · PAIEMENT` — **Paie.** — *Wave, Orange Money, Moov Money.* ; téléphone : « Ton paiement », « Billets 2 », « Total 30 000 F », « Payer avec », « Payer 30 000 F avec Wave », « Paiement reçu », « 30 000 F · Wave », « 2 billets · Festival Abissa Experience », « Voir mes billets » ; notification : « Paiement confirmé — 30 000 F via Wave · 2 billets ».
- **Voix off** (00:34.3) : « Tu paies avec Wave, Orange Money ou Moov Money, depuis ton téléphone. Pas de file, pas de monnaie. »
- **Musique / SD** : clics d'interface, un roulement de chiffre, un tic d'attente sur les temps pendant la confirmation, puis un **carillon de succès** à deux notes (la pièce maîtresse du sound design produit) et un son de notification discret.
- **Temps forts** : 00:34.0 feuille · 00:35.0 +1 billet · 00:35.5 moyens de paiement · **00:37.0 Wave** · **00:38.0 Payer** · 00:38.3 → 00:40.0 attente (points sur les temps) · **00:40.0 paiement reçu** · 00:40.5 notification.

#### Plan D4 — 00:42.0 → 00:48.0 (6,0 s) — mesures 22–24 — « Entre. »

- **Visuel** : le téléphone sort par la droite en pivotant ; **le billet** en sort et vient se poser au centre-droit, en grand. C'est un billet papier crème à encoches : visuel Abissa à gauche, infos au centre, talon à droite avec le QR code et le code du billet.
- **Animation** : le billet arrive en 3D (rotation Y de −38° à 0°, échelle 0,45 → 1). Le QR se construit module par module en diagonale (0,7 s), ses trois yeux orange apparaissent en ressort (encore la pastille). Le code se tape caractère par caractère. **Le Scan** : une ligne verte balaie le QR en 0,5 s. Le tampon « ACCÈS VALIDÉ » **claque sur le temps** (échelle 2,2 → 1, rotation −6°), accompagné d'un éclat vert.
- **Texte à l'écran** : `04 / 04 · BILLET` — **Entre.** — *Un code unique. Un scan.* ; billet : `BILLET · TRADITION`, « Festival Abissa Experience », « Ven. 14 août 2026 · 18:00 », « Place Abissa, Grand-Bassam », « 2 billets · Awa Yao », « Payé via Wave · 30 000 F », `FC-DEMO-2026`, « Présente ce code à l'entrée », tampon `ACCÈS VALIDÉ`.
- **Voix off** (00:42.3) : « Ton billet arrive avec son code unique. À l'entrée : un scan, et tu es dedans. »
- **Musique / SD** : un froissé de papier à l'arrivée du billet, un grésillement numérique pendant la construction du QR, une frappe de clavier mécanique pour le code, le **bip de scanner** à 00:45.5, un **coup de tampon grave** à 00:46.0, puis la rumeur de la foule qui s'ouvre (on « entre » dans la fête).
- **Temps forts** : 00:41.8 le téléphone sort · 00:42.0 « Entre. » · 00:42.8 QR · 00:43.8 code · 00:45.5 scan · **00:46.0 ACCÈS VALIDÉ** · 00:47.6 sortie.

### SÉQUENCE E — Boutique officielle

#### Plan E1 — 00:48.0 → 00:54.0 (6,0 s) — mesures 25–27

- **Visuel** : transition « Le Pagne » en bande de trame multicolore qui révèle la boutique. Trois produits en carrousel horizontal, sur des socles aux couleurs de la trame : **Casquette Kente Edition** (12 000 F), **Tote Bag Baoulé** (9 000 F), **Affiche Collector Abissa** (15 000 F, tirage numéroté). À gauche, légende : `BOUTIQUE OFFICIELLE` / **Garde la fête.**
- **Animation** : les produits entrent un par temps (00:48.5, 00:49.0, 00:49.5) avec une rotation 3D légère. Trois taps « Ajouter » sur les temps (00:50.5, 00:51.5, 00:52.5) ; à chaque tap, une pastille orange vole du produit jusqu'à l'icône panier, dont le badge passe 1 → 2 → 3 avec un rebond. À 00:53.5, le carrousel file vers la gauche.
- **Texte à l'écran** : `BOUTIQUE OFFICIELLE` — **Garde la fête.** — *Casquettes, tote bags, affiches.* — noms, catégories et prix des produits, boutons « Ajouter » qui deviennent « Ajouté », panier avec badge `3` et `36 000 F`.
- **Voix off** (00:48.3) : « Et pour garder la fête avec toi, la boutique officielle : casquettes, tote bags, affiches collector. »
- **Musique / SD** : variation mélodique (motif percussif boisé, type balafon ou marimba traité moderne, joué comme un riff). Un « plop » par produit ajouté, accordé sur la tonalité.
- **Temps forts** : 00:48.0 Pagne · 00:48.5 / 00:49.0 / 00:49.5 produits · 00:50.5 / 00:51.5 / 00:52.5 ajouts au panier · 00:53.5 sortie.

### SÉQUENCE F — Espace organisateur

Dispositif : on change de point de vue. Ce n'est plus un téléphone mais un **écran d'ordinateur** en perspective (tableau de bord), cadré à droite. Le client utilise un téléphone, l'organisateur travaille sur un ordinateur : le spectateur comprend le changement de rôle sans explication.

#### Plan F1 — 00:54.0 → 00:58.0 (4,0 s) — mesures 28–29

- **Visuel** : carton de bascule sur le premier temps (fond sable, **Tu organises ?** en nuit), puis le tableau de bord « Collectif Nouchi Live » avec le formulaire « Nouvel événement ».
- **Animation** : les champs se remplissent un par temps : titre « Maquis Electronic Night » (00:55.0), lieu « Sofitel Ivoire, Abidjan » (00:55.5), date « Dim. 21 juin 2026 · 20:00 » (00:56.0), prix « 25 000 F » (00:56.5), places « 900 » (00:57.0). Une affiche se génère en vignette. Tap « Soumettre » à 00:57.5.
- **Texte à l'écran** : `ORGANISATEUR · 01 / 03` — **Crée.** — *Un événement en quelques minutes.* — champs ci-dessus, bouton « Soumettre pour validation » qui devient « Envoyé pour validation », statut de l'aperçu « Brouillon » → « En attente de validation » (sable).
- **Voix off** (00:54.2) : « Tu organises ? Crée ton événement en quelques minutes. »
- **Musique / SD** : la pulsation devient régulière (kick en quatre temps, arpège synthétique discret). Une frappe de touche par champ.
- **Temps forts** : **00:54.0 bascule** · 00:55.0 → 00:57.0 champs · 00:57.5 Soumettre.

#### Plan F2 — 00:58.0 → 01:02.0 (4,0 s) — mesures 30–31

- **Visuel** : tableau de bord des ventes de « Maquis Electronic Night » : grand compteur de billets, compteur de recettes, histogramme par jour, fil de ventes en direct.
- **Animation** : le compteur roule de 0 à **621 / 900** billets et les recettes de 0 à **15 525 000 F** (621 × 25 000 F) en 2 s. L'histogramme pousse une barre par temps. Trois notifications de vente glissent dans le fil sur les temps (« +2 billets · Wave », « +1 billet · Orange Money », « +4 billets · Moov Money »).
- **Texte à l'écran** : `ORGANISATEUR · 02 / 03` — **Vends.** — *Tes ventes, en direct.* — `621 / 900 billets` — `15 525 000 F` — jauge 69 %.
- **Voix off** (00:58.2) : « Suis tes ventes en direct, billet par billet… »
- **Musique / SD** : tic de compteur, un « ding » doux par notification, qui suit le rythme.
- **Temps forts** : 00:58.0 compteurs · 00:59.0 / 01:00.0 / 01:01.0 notifications · barres de l'histogramme sur chaque temps.

#### Plan F3 — 01:02.0 → 01:06.0 (4,0 s) — mesures 32–33

- **Visuel** : vue « Retraits » : recettes de la vente, compte mobile money de destination (Wave, numéro masqué, « Compte vérifié »), bouton « Retirer vers Wave ».
- **Animation** : la vue monte sur le premier temps, tap sur « Retirer » à 01:03.5 ; le bouton se resserre en pastille (même geste qu'en D3, pour la cohérence), puis coche verte à 01:04.0 et « Retrait envoyé » à 01:04.5. La pastille part vers la droite du cadre (le « chemin de l'argent ») et sert de transition.
- **Texte à l'écran** : `ORGANISATEUR · 03 / 03` — **Encaisse.** — *Tes recettes, sur mobile money.* — « Recettes de la vente · Maquis Electronic Night », `15 525 000 F`, « Retirer vers Wave », « Retrait envoyé », `15 525 000 F vers Wave`.
- **Voix off** (01:02.2) : « … et retire tes recettes sur mobile money. »
- **Musique / SD** : carillon de succès en variation (même famille que D3, une tierce au-dessus).
- **Temps forts** : 01:03.5 tap · **01:04.0 coche** · 01:04.5 confirmation.

> Les montants de solde et de retrait dépendent des règles de commission de FestiConnect : **à confirmer avec le propriétaire** avant production. La prévisualisation affiche la recette brute de démonstration (621 × 25 000 F), sans commission.

### SÉQUENCE G — Validation et confiance

#### Plan G1 — 01:06.0 → 01:10.0 (4,0 s) — mesures 34–35

- **Visuel** : file de modération de l'administration, en cartes empilées. En tête, « Nuit Mandingue Premium — Yamoussoukro — En attente » ; à côté, la fiche détaillée (Fondation FHB, Sam. 12 sept. 2026 · 19:30, Collectif Nouchi Live, 18 000 F · 700 places) avec sa liste de contrôle, et les boutons « Refuser » / « Valider ».
- **Animation** : trois coches tombent sur les temps : « Organisateur vérifié » (01:06.5), « Lieu et date confirmés » (01:07.0), « Billetterie conforme » (01:07.5). **Le Scan** balaie la fiche, tap sur « Valider » à 01:07.9, puis le **tampon VALIDÉ** claque à **01:08.0** sur le visuel de la fiche, avec un éclat et une onde verts (premier temps de la mesure 35). Le statut passe de « En attente » (sable) à « Publié » (vert) à 01:08.5, et le badge de la file disparaît.
- **Texte à l'écran** : `ADMINISTRATION` — **Vérifié.** — *Avant chaque publication.* — items ci-dessus, tampon `VALIDÉ`, URL `festiconnect.ci/admin`.
- **Voix off** (01:06.2) : « Chaque événement est vérifié avant publication. Ton public achète en confiance. »
- **Musique / SD** : break : la batterie s'arrête, il ne reste qu'une nappe et une pulsation sourde. Trois tics pour les coches, puis **impact grave + tampon** à 01:08.0. La relance commence à 01:09.0.
- **Temps forts** : 01:06.5 / 01:07.0 / 01:07.5 coches · **01:08.0 VALIDÉ** · 01:08.5 Publié.

### SÉQUENCE H — Final

#### Plan H1 — 01:10.0 → 01:14.0 (4,0 s) — mesures 36–37

- **Visuel** : triptyque en panneaux de trame, en écho à B1 : **Trouve.** (orange, cercles) / **Paie.** (nuit, grille) / **Entre.** (sable, tirets). Chaque mot est centré, en 340 px.
- **Animation** : transition « Le Pagne » sur chaque temps fort. Sur le dernier temps (01:13.0), **iris orange depuis le point de « Entre. »**, qui couvre le cadre à 01:14.0.
- **Voix off** (01:10.1) : « Trouve ta sortie. Paie en un geste. Entre en un scan. »
- **Musique / SD** : relance à pleine énergie, une frappe par mot, roulement et aspiration sur la mesure 37.
- **Temps forts** : **01:10.0 Trouve.** · **01:11.0 Paie.** · **01:12.0 Entre.** · 01:13.0 iris · **01:14.0 plein orange**.

#### Plan H2 — 01:14.0 → 01:20.0 (6,0 s) — mesures 38–40

- **Visuel** : carton final. Même geste que le premier logo : l'aplat orange se contracte sur le i de FestiConnect. Dessous, la signature ; en bas, l'adresse web. Anneaux et halo. Puis extinction.
- **Animation** : contraction et atterrissage (01:14.6), ondes, lettres qui montent depuis le i. URL en fondu montant à 01:15.5, signature lettre par lettre à 01:17.0. À 01:18.8, tout passe au noir **sauf la pastille**, qui glisse au centre, grossit une dernière fois et **se referme** à 01:19.95 : le point final.
- **Texte à l'écran** : **FestiConnect** — **On est ensemble.** — `festiconnect.ci`.
- **Voix off** (01:14.4) : « FestiConnect. Rendez-vous sur festiconnect point c i. On est ensemble. »
- **Musique / SD** : dernier impact à 01:14.0, sonal de marque sur l'atterrissage, puis la musique se resserre en un dernier accord tenu. La fermeture de la pastille est accompagnée d'un « pop » inversé, puis silence. Fondu audio sur 1,5 s.
- **Temps forts** : **01:14.0 impact** · 01:14.6 atterrissage · 01:15.5 URL · 01:17.0 signature · 01:18.8 extinction · **01:19.95 point final**.

---

## 5. Mises en scène de l'interface (mockups)

Principe : **l'app est recréée, pas filmée**. Les écrans sont reconstruits en vectoriel (HTML/CSS dans `stage/scenes/parcours.js`) : ils restent nets à toutes les tailles, s'animent élément par élément et s'alignent en une passe sur la refonte. Données : `src/db/seed.js` (reprises dans `video/content.json`).

| Écran | Contenu | Geste animé | Plan |
|---|---|---|---|
| Recherche | Salut Awa, « Qu'est-ce qu'on fait ce soir ? », champ + bouton orange, filtres (Tout, Tradition, Grand-Bassam, Août), 3 résultats avec vignette, catégorie, ville, date, « dès … F », barre de navigation (accueil, recherche, billets, boutique) | Saisie, filtres, cartes par temps, tap | D1 |
| Fiche événement | Visuel plein écran, retour, favori, étiquettes, titre, date/heure, lieu, organisateur, jauge vendues/capacité, places restantes, barre prix + « Réserver » | Poussée, jauge qui se remplit, bouton qui pulse | D2 |
| Paiement | Feuille « Ton paiement », quantité (− 2 +), total, « Payer avec » (Wave, Orange Money, Moov Money), bouton payer, message d'attente | +1, sélection, bouton → pastille → coche | D3 |
| Confirmation | Coche verte, « Paiement reçu », montant et moyen, nombre de billets, « Voir mes billets », notification système | Coche tracée, notification | D3 |
| Billet | Billet papier : visuel, catégorie, titre, date, lieu, titulaire, paiement, perforation à encoches, talon QR + `FC-DEMO-2026` | QR construit, code tapé, scan, tampon | D4 |
| Boutique | 3 produits, prix, « Ajouter », panier avec badge | Ajouts sur les temps, pastille qui vole | E1 |
| Tableau de bord organisateur (ordinateur) | Formulaire de création, compteurs billets/recettes, histogramme, fil de ventes, retrait | Remplissage, compteurs, histogramme, retrait | F1–F3 |
| Administration (ordinateur) | File de modération, liste de contrôle, statut | Coches, scan, tampon, statut Publié | G1 |

**Moyens de paiement** : on affiche les **noms** Wave, Orange Money et Moov Money (comme dans l'app), avec une pastille de couleur neutre et une icône de portefeuille générique. **Aucun logo officiel n'est reproduit.** Pour montrer les vrais logos, il faut l'accord écrit de chaque opérateur et leurs chartes.

**Le QR code** du billet est un vrai QR (bibliothèque locale `qrcode-generator`, correction d'erreur M, 21 × 21 modules) qui encode le code du billet `FC-DEMO-2026` (`content.json`). Ses trois repères gardent un cœur orange et il est posé sur une plaque blanche pour le contraste. `npm run qc:qr` rend le plan D4, recadre sur le QR et vérifie qu'il se décode. Pour qu'il mène à une page (par exemple festiconnect.ci), il suffit de changer le texte encodé.

---

## 6. Version courte 30 s (réseaux sociaux)

Même univers, mêmes modules. Grille 120 BPM, 15 mesures. Fichier : `video/timeline-30s.json`. Pas de séquence boutique ni validation ; un plan organisateur de 2 s.

| Plan | Temps | Visuel | Voix off |
|---|---|---|---|
| A1–A2 | 00:00.0 → 00:04.0 | Pastille, « Abidjan. », recul sur la constellation, « Ce soir, tout le monde sort. » | (00:01.7) « Ce soir, tout le monde sort. » |
| B1 | 00:04.0 → 00:06.0 | Quatre mots-chocs, un par temps (Concerts. Festivals. Maquis. Défilés.) | (00:04.0) « Concert, festival, maquis, défilé… » |
| B2 | 00:06.0 → 00:08.0 | Trois affiches, « Où ? Quand ? Comment ? », iris orange | — |
| C1–C2 | 00:08.0 → 00:12.0 | La pastille se pose sur le i, promesses, aspiration, plongée | (00:08.8) « Avec FestiConnect, » |
| D1 | 00:12.0 → 00:14.5 | Recherche « Abissa », résultats | (00:12.3) « tu trouves ton événement, » |
| D2 | 00:14.5 → 00:17.0 | Fiche, jauge, « Réserver » | (00:14.7) « tu choisis ta place, » |
| D3 | 00:17.0 → 00:21.5 | Paiement Wave, pastille d'attente, coche verte | (00:17.2) « tu paies avec Wave, Orange Money ou Moov Money… » |
| D4 | 00:21.5 → 00:25.0 | Billet, QR, scan, ACCÈS VALIDÉ (00:23.8) | (00:22.0) « et tu entres en un scan. » |
| F2 | 00:25.0 → 00:27.0 | Tableau de bord en accéléré : 621 / 900, 15 525 000 F, « Retirer vers Wave » | (00:25.1) « Tu organises ? Crée, vends, encaisse. » |
| H2 | 00:27.0 → 00:30.0 | La pastille tombe sur le i, signature, URL, point final | (00:27.15) « FestiConnect. On est ensemble. » |

Pour les réseaux, prévoir des sous-titres incrustés (une grande partie des vidéos y est regardée sans le son) : les textes ci-dessus servent de fichier de sous-titres ; la zone basse des plans est libre à partir de y = 900 px, sauf en D4.

---

## 7. Brief audio

### 7.1 Ce que le propriétaire doit fournir

#### 7.1.1 Livrables audio (option recommandée)

Idéalement, **deux pistes séparées plus le mix** :

1. `musique.wav` : la musique seule (stéréo) ;
2. `voix.wav` : la voix off seule (mono), **enregistrée en écoutant la musique** au casque ;
3. `mix.wav` : le mixage final de référence (si un ingénieur son le réalise).

Avec les pistes séparées, on cale la grille visuelle sur la musique (tempo, premier temps fort) et chaque plan sur les phrases de la voix, puis on remixe proprement (ducking, loudness).

Options acceptées :

- **mix unique** (musique + voix) : la synchronisation se fait sur la grille musicale et on ajuste les plans à la main ;
- **voix seule** : on se cale sur les phrases et les silences ; la musique pourra venir d'une banque, choisie ensemble.

#### 7.1.2 Spécifications techniques

| | Exigé | Accepté |
|---|---|---|
| Format | WAV PCM 48 kHz, 24 bits | WAV 44,1 kHz 16 bits ; MP3 320 kb/s ; M4A/AAC 256 kb/s |
| Voix | Mono, crêtes à −3 dBFS, sans traitement agressif, sans musique | Stéréo |
| Mix | Crêtes réelles ≤ −1 dBTP, loudness cible **−14 LUFS intégrés** (web et réseaux) | On peut normaliser au rendu (`audio.loudnorm`) |
| Durée | Version longue : **80 s** (fourchette 75 à 90 s) ; version courte : **30,0 s** exactement | Si la musique est plus longue, indiquer le point de coupe |
| Début | Premier temps fort à 0,0 s, ou décalage indiqué (par exemple « la musique commence à 0,35 s ») | Détecté automatiquement |
| Nommage | `festiconnect_80s_musique.wav`, `festiconnect_80s_voix.wav`, `festiconnect_30s_mix.wav` | — |

#### 7.1.3 Musique

- **Tempo : 120 BPM** en 4/4 (accepté de 115 à 124 BPM ; toute la grille se recalcule automatiquement). À 120 BPM, une mesure dure exactement 2 s, ce qui simplifie tous les timecodes.
- **Couleur** : afro-house / afrobeats électronique, avec percussions ivoiriennes contemporaines (coupé-décalé, influences zouglou modernisées), basse ronde et log drum léger. Chaleureuse, nocturne, élégante. Éviter les boucles « Afrique » de banque trop connues.
- **Structure attendue**, calée sur les séquences :

| Mesures | Temps | Section musicale | Moments de synchro obligatoires |
|---|---|---|---|
| 1–4 | 00:00 → 00:08 | Intro nocturne, kick filtré, ambiance ville | Pulsation audible dès 00:00.5 (les ondes de la pastille) |
| 5–8 | 00:08 → 00:16 | Entrée du groove, montée | Frappes sur 00:08, 00:09, 00:10, 00:11 ; coupure juste avant 00:16 |
| 9–11 | 00:16 → 00:22 | **Drop** + sonal de marque | Impact exact à **00:16.0** |
| 12–24 | 00:22 → 00:48 | Groove principal, sobre (laisse de la place à la voix) | Espace pour le carillon de succès vers 00:40, le bip de scan à 00:45.5 et le tampon à 00:46.0 |
| 25–27 | 00:48 → 00:54 | Variation mélodique (riff percussif boisé) | — |
| 28–33 | 00:54 → 01:06 | Pulsation régulière, plus « machine » | — |
| 34–35 | 01:06 → 01:10 | **Break** (tension), impact | Impact à **01:08.0** |
| 36–37 | 01:10 → 01:14 | Relance, trois frappes | Frappes à 01:10, 01:11, 01:12 |
| 38–40 | 01:14 → 01:20 | Final, accord tenu, queue | Impact à **01:14.0**, fin nette à 01:20 |

- **Sonal de marque** (facultatif, recommandé) : 1 à 1,5 s, deux ou trois notes, joué sur l'atterrissage du logo (00:16.6 et 01:14.6). Il pourra servir ailleurs (notifications de l'app, pré-roll).
- **Droits** : musique originale commandée (idéal, avec cession pour tous supports et toutes durées) ou banque sous licence commerciale couvrant YouTube, les réseaux sociaux, la publicité en ligne et les événements. Fournir la licence.

#### 7.1.4 Voix off

- **Casting** : voix ivoirienne, 25–35 ans, chaleureuse et souriante, **accent ivoirien naturel, sans caricature**, diction nette. Masculine ou féminine (une voix féminine fait bien contraste avec la musique grave ; les deux fonctionnent).
- **Direction** : on parle à un ami, pas à une foule. Débit vif mais posé (environ 2,6 mots par seconde), sourire dans la voix, pauses marquées aux points. Les phrases énumératives (« Concert, festival, soirée maquis, défilé ») sont dites **sur le rythme**. « On est ensemble » est dit simplement, sans emphase.
- **Enregistrement** : pièce traitée ou cabine, micro statique à 15–20 cm, anti-pop. Enregistrer **chaque ligne 3 fois** (neutre, plus d'énergie, plus intime) en laissant 1 s de silence entre les lignes. Livrer aussi une version « au propre » montée sur la musique si possible.
- **Texte exact — version longue (80 s)** :

| Plan | Départ indicatif | Fenêtre max | Texte |
|---|---|---|---|
| A1 | 00:01.0 | 2,8 s | Abidjan. Vendredi, vingt et une heures. |
| A2 | 00:04.3 | 3,6 s | Au Plateau, à Grand-Bassam, à Bouaké… ce soir, tout le monde sort. |
| B1 | 00:08.1 | 3,6 s | Concert, festival, soirée maquis, défilé. |
| B2 | 00:12.2 | 3,6 s | Et toujours la même question : où, quand… et comment avoir sa place ? |
| C1 | 00:16.65 | 3,2 s | FestiConnect. Billetterie, boutique, paiement mobile : |
| C2 | 00:20.0 | 1,8 s | tout au même endroit. |
| D1 | 00:22.3 | 5,5 s | Tu cherches un artiste, une ville, une date ? L'événement est là, en quelques secondes. |
| D2 | 00:28.3 | 5,5 s | Date, lieu, prix, places restantes : tout est clair avant même de payer. |
| D3 | 00:34.3 | 7,0 s | Tu paies avec Wave, Orange Money ou Moov Money, depuis ton téléphone. Pas de file, pas de monnaie. |
| D4 | 00:42.3 | 5,5 s | Ton billet arrive avec son code unique. À l'entrée : un scan, et tu es dedans. |
| E1 | 00:48.3 | 5,5 s | Et pour garder la fête avec toi, la boutique officielle : casquettes, tote bags, affiches collector. |
| F1 | 00:54.2 | 3,6 s | Tu organises ? Crée ton événement en quelques minutes. |
| F2 | 00:58.2 | 3,6 s | Suis tes ventes en direct, billet par billet… |
| F3 | 01:02.2 | 3,6 s | … et retire tes recettes sur mobile money. |
| G1 | 01:06.2 | 3,7 s | Chaque événement est vérifié avant publication. Ton public achète en confiance. |
| H1 | 01:10.1 | 3,8 s | Trouve ta sortie. Paie en un geste. Entre en un scan. |
| H2 | 01:14.4 | 4,5 s | FestiConnect. Rendez-vous sur festiconnect point c i. On est ensemble. |

- **Texte exact — version courte (30 s)** :

| Plan | Départ indicatif | Texte |
|---|---|---|
| A2 | 00:01.7 | Ce soir, tout le monde sort. |
| B1 | 00:04.0 | Concert, festival, maquis, défilé… |
| C1 | 00:08.8 | Avec FestiConnect, |
| D1 | 00:12.3 | tu trouves ton événement, |
| D2 | 00:14.7 | tu choisis ta place, |
| D3 | 00:17.2 | tu paies avec Wave, Orange Money ou Moov Money… |
| D4 | 00:22.0 | et tu entres en un scan. |
| F2 | 00:25.1 | Tu organises ? Crée, vends, encaisse. |
| H2 | 00:27.15 | FestiConnect. On est ensemble. |

Les fenêtres indiquent la durée disponible avant la phrase suivante ; ce qui compte le plus est le **début** de chaque phrase (c'est lui qui déclenche le plan). Une fin de phrase peut déborder de quelques dixièmes sur le plan suivant.

Prononciation : « FestiConnect » = *fès-ti-co-nècte* ; « festiconnect.ci » se dit « festiconnect point c i » ; « Moov » = *mouv*.

#### 7.1.5 Sound design

Le sound design peut être livré par l'ingénieur son ou construit par nous à partir d'une banque sous licence. Liste des sons utiles : pop de pastille, onde grave, tics de ville, swish de panneau, whoosh de poussée, clics d'interface, frappes de clavier, roulement de chiffres, **carillon de succès**, notification, froissé de papier, bip de scanner, **coup de tampon**, ambiance de foule, aspiration inversée, pop inversé final.

### 7.2 Questions à poser au propriétaire

1. Musique originale ou banque ? Qui la produit, qui détient les droits, pour quels supports ?
2. Voix : comédien professionnel ou voix maison ? Homme ou femme ? Qui dirige l'enregistrement ?
3. Livrera-t-il des pistes séparées (musique, voix) ou un mix unique ?
4. Adresse web à afficher : `festiconnect.ci` est-elle bien le domaine public ?
5. La signature « On est ensemble. » lui convient-elle ? (Alternative : « Ta sortie commence ici. »)
6. Données de démonstration : faut-il remplacer les événements du seed (dates d'août 2026 déjà passées) par de vrais événements à venir, avec l'accord des organisateurs ? Les noms « Festival Abissa Experience », « Collectif Nouchi Live », « Sofitel Ivoire » et « Fondation FHB » sont-ils utilisables publiquement ?
7. Commission et délais de retrait des organisateurs (pour les montants affichés en F3).
8. Logos des opérateurs mobile money : partenariat signé qui autorise leur usage, ou noms seuls ?
9. Logo définitif : le mot-symbole « FestiConnect » avec pastille sur le i est-il adopté, ou faut-il intégrer le logo issu de la refonte ?
10. Diffusion : quelles plateformes, avec ou sans sous-titres incrustés, besoin de versions 9:16 ou 1:1 ?

### 7.3 Comment se fait la synchronisation

Tous les temps du film sont dans **un seul fichier** par version (`video/timeline.json`, `video/timeline-30s.json`). Chaque plan a un début, une fin et des *cues* relatives à son début. Recaler l'audio revient à recalculer ces nombres ; les scènes suivent automatiquement.

1. **Déposer** les fichiers dans `video/audio/` (ce dossier n'est pas versionné).
2. **Analyser** : `npm run analyze -- audio/festiconnect_80s_musique.wav`. On obtient la durée, le tempo (précision au centième de BPM par régression sur les attaques), le premier temps fort, la grille des temps et des mesures, les attaques et accents (temps forts), les silences (filtre ffmpeg `silencedetect`) et les phrases (zones non silencieuses). Le résultat est écrit dans `audio/analysis.json`, avec un résumé à l'écran.
3. **Recaler** selon le cas :
   - musique seule ou mix : `npm run sync -- --mode grid` étire toute la grille de conception (120 BPM, temps 0) sur le tempo et le premier temps fort réels ; toutes les coupes restent sur les premiers temps ;
   - voix + musique séparées : `npm run analyze -- audio/voix.wav --out audio/analysis-voix.json`, puis `npm run sync -- --mode phrases --analysis audio/analysis-voix.json --beats audio/analysis.json --snap`. Chaque plan démarre sur sa phrase de voix, puis s'aligne sur le temps musical le plus proche (tolérance 0,15 s) ;
   - ajustements fins : repères manuels dans `audio/markers.json` (`{ "C1": 16.25, "D3": 34.1 }`), puis `npm run sync -- --markers audio/markers.json`.
   Dans tous les cas, les cues d'un plan sont étirées au prorata de sa nouvelle durée, une sauvegarde de l'ancienne timeline est écrite dans `out/backups/`, et `--dry` montre le résultat sans rien écrire.
4. **Déclarer l'audio** dans la timeline (`audio.file`, ou `audio.stems` pour mixer musique et voix avec leur gain et leur décalage, `audio.loudnorm: -14` pour normaliser).
5. **Vérifier** : `npm run serve`, puis ouvrir l'URL affichée avec `&audio=../audio/mix.wav` pour une relecture en temps réel (sous-titres de voix off et timecode affichés avec `hud=2`), ou `npm run preview` pour une prévisualisation MP4 rapide.
6. **Rendre** : `npm run render` produit le master 1920 × 1080 avec l'audio mixé.

---

### 7.4 Audio de la version actuelle (généré, provisoire)

À la demande du propriétaire, la version livrée embarque une voix off et une musique **produites par nos soins**, en attendant (ou à la place de) l'enregistrement décrit en 7.1. `npm run audio` les régénère à partir des timelines.

- **Voix off** : synthèse vocale locale sherpa-onnx, modèle **Kokoro-82M v1.0, voix française `ff_siwis`**. Le modèle est sous licence Apache-2.0, la voix est entraînée sur le corpus SIWIS (CC-BY 4.0) ; l'usage promotionnel est permis, **avec la mention « Voix de synthèse : Kokoro-82M (Apache-2.0), corpus SIWIS (CC-BY 4.0) »** dans la description de la vidéo ou le générique.
  - Choix objectivé sur 7 voix testées : même phrase, puis aller-retour par reconnaissance vocale (Whisper) pour mesurer le taux d'erreur par mot, ainsi que l'étendue de la hauteur (prosodie) et le débit. Kokoro obtient 22 % contre 39 à 94 % pour les voix Piper. Deux voix « low » perdent les voyelles nasales ; la voix « tom » est sous AGPLv3 et a été écartée.
  - Limite assumée : **aucune voix de synthèse disponible n'a l'accent ivoirien**. C'est une voix française standard, féminine et claire. Pour une diffusion publique, une vraie voix ivoirienne (7.1.4) reste recommandée.
  - Prononciation : le texte envoyé au moteur est adapté sans changer l'écran (`voice/prononciation.json`) : « Festi Connecte », « Ouève » pour Wave, « Orange Monni », « Mouv Monni », énumérations séparées par des points pour une diction nette.
  - Calage : chaque ligne démarre à son temps prévu (`voAt`) et sa vitesse est ajustée pour tenir dans sa fenêtre (×0,94 à ×1,18).
  - Traitement : passe-haut 80 Hz, chaleur, présence, de-esser, compression douce, saturation légère, 48 kHz.
- **Musique** : composition originale entièrement synthétisée par code (`music/compose.py`, aucun échantillon externe), donc libre de droits.
  - Afro-house à 120 BPM en la mineur : kick, clap, shaker, clave 3-2, djembé, log drum, basse, nappes, riff boisé en E, arpège en F.
  - Break de 01:06 à 01:10, impacts à 00:16, 00:46, 01:08 et 01:14, son de marque (cloche et lame boisée, la–mi–la) sur l'atterrissage du logo.
  - Sound design synchronisé sur les cues (taps, carillon de paiement, bip de scan, tampons, notifications).
- **Mix** (`music/mix.py`) : la musique baisse de 7 dB sous la voix (anticipation de 60 ms), le master est à **-14 LUFS intégrés, crête vraie ≤ -1 dBTP**.
- **Remplacer par une vraie voix** : déposer la voix enregistrée (48 kHz), déjà calée sur le film, dans `audio/voix_80s/voix.wav`, puis lancer `npm run audio -- --version 80 --skip-voice` et `npm run render`. On peut aussi la découper en une ligne par plan et recaler avec `npm run analyze` / `npm run sync -- --mode phrases` (7.3). La musique se remplace de la même façon (`audio/musique_80s/musique.wav`, option `--skip-music`).

## 8. Livrables, spécifications d'export, contrôle qualité

**Livrables** :

- `festiconnect_1920x1080_30fps.mp4` (master 80 s) ;
- `festiconnect_30s_1920x1080.mp4` ;
- version 60 i/s sur demande (`npm run render:60fps`) ;
- images clés PNG (vignettes YouTube, presse) ;
- fichier de sous-titres (à produire à partir des tableaux 7.1.4).

**Export** : H.264 High, yuv420p, BT.709 (plage TV), CRF 18 (preset `slow`), image clé toutes les 2 s, `faststart` pour la lecture web, audio AAC 320 kb/s à 48 kHz.

**Contrôle qualité avant livraison** :

- [ ] Synchronisation : les coupes tombent sur les premiers temps (vérifier 00:08, 00:16, 00:22, 00:46, 01:08, 01:14) ; lèvres et voix non concernées (pas de personnage).
- [ ] Lisibilité : chaque texte reste à l'écran au moins le temps de le lire deux fois ; aucun texte hors de la zone de sécurité (90 % du cadre).
- [ ] Orthographe et typographie française : accents, espaces insécables avant « : ? ! », montants `15 000 F`.
- [ ] Cohérence des données : 2 billets × 15 000 F = 30 000 F ; 621 × 25 000 F = 15 525 000 F ; 1 200 − 384 = 816.
- [ ] Couleurs : vert réservé aux confirmations ; pas de noir pur sauf à la fin.
- [ ] Audio : −14 LUFS intégrés, crêtes ≤ −1 dBTP, voix intelligible au-dessus de la musique, fondu final propre.
- [ ] Mentions légales : noms des opérateurs sans logos (sauf accord), droits de la musique fournis, accord des organisateurs cités.
- [ ] Lecture sur téléphone (petit écran, luminosité faible) et sur grand écran.

---

## Annexe A — État de production

| Séquence | Module | État |
|---|---|---|
| A Ouverture | `stage/scenes/ouverture.js` | Animée, prête à être synchronisée |
| B Affiches | `stage/scenes/affiches.js` | Animée |
| C Logo | `stage/scenes/logo.js` | Animée |
| D Parcours client | `stage/scenes/parcours.js` | Animée (recherche, fiche, paiement, confirmation, billet, scan) |
| E Boutique | `stage/scenes/boutique.js` | Animée (bande de trame, produits, ajouts au panier) |
| F Organisateur | `stage/scenes/organisateur.js` | Animée (création, ventes, retrait) ; gère aussi le plan F2 seul de la version courte |
| G Validation | `stage/scenes/validation.js` | Animée (contrôles, scan, tampon, publication) |
| H Final | `stage/scenes/final.js` | Animé (triptyque + carton final, et variante courte) |

Le module `carton.js` (animatic) reste le repli automatique de toute séquence déclarée dans la timeline sans module : on peut ainsi ajouter un plan, le caler sur l'audio, puis l'animer sans toucher aux timecodes. Les composants partagés des séquences E, F et G (légende, fenêtre de navigateur, indicateur de tap) sont dans `stage/lib/ui.js`.

## Annexe B — Chaîne de rendu

**Principe** : chaque scène est une page HTML/SVG dont l'état est une **fonction pure du temps** `t` (`window.__seek(t)`), sans `requestAnimationFrame`, sans horloge et sans hasard (générateur pseudo-aléatoire à graine fixe). Playwright + Chromium capturent chaque image en PNG sans perte, ffmpeg les encode en H.264. Deux rendus du même fichier donnent les mêmes images.

**Installation** (Node ≥ 20) :

```bash
cd video
npm install              # playwright-core, ffmpeg-static (binaire ffmpeg), polices @fontsource, qrcode-generator
```

Chromium n'est pas téléchargé par `npm install`. Les scripts cherchent `PLAYWRIGHT_BROWSERS_PATH` (par défaut `/opt/pw-browsers`, où `chromium_headless_shell-1194` correspond à playwright 1.56.1) ; ailleurs, définir `CHROMIUM_PATH=/chemin/vers/chrome`. Pour utiliser un autre ffmpeg : `FFMPEG_PATH=/chemin/ffmpeg`.

**Commandes** :

| Commande | Effet |
|---|---|
| `npm run preview` | MP4 960 × 540 muet avec timecode incrusté (`out/preview_*.mp4`) ; `-- --from 16 --to 22` pour un extrait |
| `npm run preview:30s` | Idem pour la version courte |
| `npm run still -- 17.5 46.2` | Images PNG 1920 × 1080 aux temps donnés (`out/stills/`) |
| `npm run serve` | Serveur local pour relire en temps réel dans un navigateur (espace, flèches) |
| `npm run audio` | Régénère voix off TTS, musique, sound design et mix maître des deux versions (7.4) |
| `npm run analyze -- audio/x.wav` | Analyse audio vers `audio/analysis.json` |
| `npm run sync -- --mode grid` | Recalage de la timeline (voir 7.3) |
| `npm run render` | Master 1920 × 1080, 30 i/s, CRF 18, avec audio si déclaré |
| `npm run render:60fps` | Master à 60 i/s |
| `npm run render:30s` | Version courte |
| `npm run qc:qr` | Vérifie que le QR du billet se décode (plan D4) |

Options de `render` : `--width`, `--fps`, `--crf`, `--preset`, `--workers` (rendu parallèle par segments, 3 par défaut), `--from`/`--to`, `--audio`, `--mute`, `--hud 0|1|2`, `--frames` (conserve les PNG dans `frames/`), `--timeline`. Temps mesurés dans ce conteneur (4 cœurs) : environ 20 i/s en 960 × 540 et 4,5 i/s en 1920 × 1080 preset `slow`, soit une dizaine de minutes pour le master 80 s.

**Arborescence** :

```
video/
  SCRIPT.md              ce document
  timeline.json          temps de la version longue (fichier unique à recaler)
  timeline-30s.json      temps de la version courte
  content.json           données affichées (événements, prix, client, code billet)
  stage/                 la scène rendue
    index.html, styles.css (jetons de couleur, polices)
    lib/engine.js        moteur : chargement des séquences, __seek(t), grain, HUD, lecteur temps réel
    lib/motion.js        courbes, interpolations, ressorts, révélations typographiques
    lib/motifs.js        palette, trame (5 modules), affiches, pseudo-QR, icônes
    scenes/*.js          une séquence par fichier ; carton.js = animatic par défaut
  scripts/               render, still, analyze-audio, sync-timeline, serve, lib
  audio/                 fichiers audio (non versionnés)
  out/, frames/          sorties (non versionnées)
```

**Ajouter une scène** : créer `stage/scenes/<module>.js` qui exporte `{ css, build(el, ctx), update(state, t, ctx, tGlobal) }`. Dans `update`, utiliser `ctx.c('E1.nomDeCue', défaut)` pour lire les temps de la timeline, `ctx.pulse(tGlobal)` pour pulser sur les temps et `ctx.content` pour les données. Déclarer `"module": "<module>"` dans la séquence de la timeline : elle remplace automatiquement le carton.

## Annexe C — Données de démonstration

Toutes les données sont issues de `src/db/seed.js` :

- **Événements** : Festival Abissa Experience (Grand-Bassam, Place Abissa, 15 000 F, 384 / 1 200) ; Maquis Electronic Night (Abidjan, Sofitel Ivoire, 25 000 F, 621 / 900) ; Salon Mode Sahel (Bouaké, Palais de la Culture, 8 000 F, 147 / 600) ; Nuit Mandingue Premium (Yamoussoukro, Fondation FHB, en attente).
- **Produits** : Casquette Kente Edition 12 000 F, Tote Bag Baoulé 9 000 F, Affiche Collector Abissa 15 000 F.
- **Personnes et billet** : client fictif Awa Yao (remplace le compte de démo Junior Ehui du seed, pour ne pas afficher un nom de compte réel) ; organisateur Collectif Nouchi Live ; billet `FC-DEMO-2026`, 2 places, 30 000 F, payé par Wave.

Elles se modifient dans `video/content.json` sans toucher au code.
