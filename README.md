# Ashquiz

Petits quiz de révision quotidiens. La page d'accueil (`index.html`) est un menu : un bloc par
thème, avec son quiz du jour et son entraînement libre.

Six thèmes pour l'instant :

- **Départements et préfectures français** (`departements.html`) ;
- **Tableaux** (`tableaux.html`) : reconnaître une œuvre, son peintre et son siècle ;
- **Drapeaux et capitales** (`pays.html`) : reconnaître un pays à son drapeau et donner sa capitale ;
- **États américains** (`etats-unis.html`) : à partir du code à deux lettres, le nom de l'État, sa
  capitale et sa position sur la carte ;
- **Racines grecques et latines** (`racines.html`) : à partir d'une racine, d'un préfixe ou d'un
  suffixe, son sens en français et son origine ;
- **Plantes, fleurs et arbres** (`plantes.html`) : à partir d'une photo, le nom français de l'espèce
  et sa famille botanique.

Chaque thème a sa propre série du jour, sa propre progression et sa propre série de jours
consécutifs. On y répond au clavier, avec la possibilité de passer une question donnée en **mode
carré** : quatre propositions par sous-réponse. Le menu affiche, pour chacun, si la série du jour
est faite et la série de jours en cours ; une fois le quiz du jour terminé, c'est l'entraînement
libre qui devient l'action mise en avant.

## Départements et préfectures

Chaque jour, cinq questions. Pour chacune, on part du numéro de département et il faut donner :

1. le **nom** du département,
2. sa **préfecture**,
3. sa **position**, en cliquant la bonne zone sur la carte de France.

Un point par sous-réponse, soit 15 points par jour. La série du jour est tirée de façon
déterministe à partir de la date : recharger la page ne rebat pas les cartes, et deux appareils
affichent le même quiz le même jour.

## Démarrer en local

```sh
npm run build:map        # une fois : télécharge le fond de carte dans data/
npm run build:paintings  # une fois : télécharge la liste des œuvres dans data/
npm run build:flags      # une fois : télécharge les drapeaux dans data/drapeaux/
npm run build:states     # une fois : télécharge le fond de carte des États-Unis dans data/
npm run build:plants     # une fois : télécharge les photos de plantes dans data/plantes/
npm run dev              # http://localhost:8080
npm test                 # tests unitaires (aucune dépendance)
```

Il n'y a **aucune étape de build** et aucune dépendance npm : ce sont des fichiers statiques et des
modules ES chargés tels quels. Le serveur `npm run dev` sert juste à éviter les restrictions
`file://` sur les modules.

## Fonds de carte

Deux thèmes ont une carte cliquable, et elles partagent tout sauf leur découpage : `src/lib/geo-model.js`
charge le GeoJSON et projette des **groupes de zones** en tracés SVG, `src/ui/map.js` les rend
cliquables (survol, sélection, surlignage à la correction, restriction aux quatre zones du mode
carré). Un thème n'écrit que sa géographie : où trouver le fichier, où lire le code d'une zone, et
comment découper le cadre entre le bloc principal et les encarts. Côté outils, `tools/geojson.mjs`
fait de même pour le téléchargement, la simplification et l'arrondi des coordonnées.

### Départements

La carte est construite à l'exécution à partir du GeoJSON officiel des départements
(dépôt [france-geojson](https://github.com/gregoiredavid/france-geojson), données Etalab/IGN en
licence ouverte), projeté en SVG par `src/lib/geo.js`.

`npm run build:map` assemble deux fichiers de ce dépôt : la version simplifiée, qui ne couvre que
la métropole (96 départements), et les cinq DOM repris du fichier « avec outre-mer », allégés au
passage (Douglas-Peucker, tolérance proportionnelle à la taille du département). Le fichier écrit
contient les 101 départements.

`src/lib/geo.js` cherche les sources dans cet ordre :

1. `data/departements.geojson` — version locale, écrite par `npm run build:map` ;
2. le dépôt distant, en secours.

Tant que `npm run build:map` n'a pas été lancé (et le fichier commité), le site fonctionne mais
dépend du réseau au chargement. Lancer la commande puis commiter `data/departements.geojson` rend
le site autonome et plus rapide.

La métropole est dessinée d'un bloc ; la petite couronne parisienne (75, 92, 93, 94) et les cinq
départements d'outre-mer sont repris dans des encarts, sans quoi ils seraient illisibles ou hors
cadre. Les encarts occupent les deux colonnes latérales : Antilles et Guyane à l'ouest, petite
couronne et océan Indien à l'est. Un département présent deux fois est cliquable aux deux endroits.

### États américains

Même mécanique, un autre découpage (`src/lib/geo-states.js`). La source est
[Natural Earth](https://www.naturalearthdata.com) 1:50m (domaine public), qui porte le code postal
à deux lettres de chaque État dans `iso_3166_2`. `npm run build:states` n'en garde que les 50 États
— ni district de Columbia, ni territoires — et écrit `data/etats-unis.geojson` (180 ko). Deux
allègements au passage : l'Alaska, dont la chaîne des Aléoutiennes pèse à elle seule plus que le
reste du pays, et Hawaï, ramené à ses îles principales — sans quoi l'encart serait surtout de
l'océan jusqu'à Midway. Les 48 États contigus, eux, gardent leur précision d'origine : simplifier
chacun de son côté ouvrirait des interstices le long des frontières communes.

Les 48 contigus sont dessinés d'un bloc, en haut du cadre ; la bande du bas et la colonne de droite
accueillent quatre encarts : l'Alaska et Hawaï, hors cadre autrement, puis deux zooms sur le
nord-est — la Nouvelle-Angleterre, où le Rhode Island fait huit pixels de large, et le trio
Delaware, Maryland, New Jersey. Comme Paris sur la carte des départements, ces États-là figurent
deux fois, et sont cliquables aux deux endroits.

Faute de `data/etats-unis.geojson`, le site retombe sur le fichier Natural Earth d'origine, qui
couvre le monde entier : les entités qui ne sont pas américaines (provinces canadiennes, États
brésiliens — dont certains ont le même code que des États américains) sont écartées à la lecture.

## Correction des réponses

La saisie est en texte libre, avec une comparaison tolérante (`src/lib/text.js`) :

- casse, accents, tirets et apostrophes ignorés (`cote dor` = `Côte-d'Or`) ;
- `St` / `Saint` interchangeables ;
- fautes de frappe légères acceptées, y compris l'inversion de deux lettres
  (`Grenobel` → `Grenoble`), avec une marge proportionnelle à la longueur du mot ;
- **mais** une réponse qui est exactement le nom d'un autre département n'est jamais tolérée :
  « Loire » ne passe pas pour le Loiret, « Haute-Saône » ne passe pas pour la Haute-Marne.

Des alias explicites sont déclarés là où plusieurs formes sont légitimes (« Évry » pour
« Évry-Courcouronnes », « Cergy-Pontoise » pour « Cergy »…).

## Progression

Tout est stocké dans le navigateur (`localStorage`) : résultat de chaque journée, statistiques par
département, série de jours consécutifs. La persistance est isolée derrière un petit adaptateur
(`src/lib/storage.js`) avec trois méthodes `read` / `write` / `clear`, toutes asynchrones : brancher
un backend plus tard consistera à écrire un autre adaptateur, sans toucher au reste du code.

En dehors du quiz du jour, l'**entraînement libre** tire une série aléatoire qui ne compte pas dans
les statistiques. On y accède depuis le menu ou depuis l'écran de résultat ; le lien du menu ajoute
`?mode=libre` à l'adresse du thème (`departements.html?mode=libre`), ce qui saute la série du jour
même si elle n'est pas encore faite. Sans ce paramètre, une page de thème ouvre toujours le quiz du
jour — ou son résultat s'il est déjà joué.

## Mode carré

Toute question commence au clavier. Le bouton **Passer au carré**, à côté de « Valider », remplace
alors la saisie par **quatre propositions par sous-réponse**, une seule juste — c'est le coup de
pouce quand un nom ne revient pas : on reconnaît avant de savoir restituer.

Il ne vaut que pour la **question en cours** : la suivante repart au clavier. Rien n'est retenu,
ni d'une question à l'autre, ni d'une visite à l'autre — il n'y a pas de réglage à trouver, juste un
bouton à portée de main quand on sèche. Le passage se fait dans un sens seulement : une fois les
propositions affichées, le bouton disparaît jusqu'à la question suivante. Ce qui était déjà répondu
et qui n'est pas du lot proposé (une zone cliquée sur la carte, un siècle coché) est effacé, faute
de case où se montrer.

**Aucun effet sur la note** pour l'instant : le barème ne bouge pas, et le résultat enregistré ne
garde pas trace des questions jouées au carré.

Les leurres sont tirés de façon déterministe, comme la série : mêmes jour et question, mêmes
propositions dans le même ordre. Demander le carré deux fois sur la même question du jour donne les
mêmes quatre cases.

Ce qui est proposé dépend du thème, et c'est là tout l'intérêt.

**Départements** — les trois sous-réponses portent sur **les mêmes quatre départements** : les noms
proposés, leurs préfectures et les quatre zones surlignées sur la carte se répondent. La question
devient « lequel de ces quatre ? », posée trois fois : relier un numéro à un nom, ce nom à sa
préfecture, puis à sa place sur la carte. Ces quatre-là sont la bonne réponse et trois départements
de **numéro voisin (à ±3)** ; les numéros suivant l'ordre alphabétique des noms, ce sont les
confusions qui valent la peine — le 45 se choisit entre Loiret, Loire-Atlantique et Haute-Loire, pas
entre Loiret et Vaucluse. Seul **l'ordre d'affichage** est retiré pour chaque sous-réponse : sans
quoi reconnaître le nom livrerait la position de la préfecture et de la zone à cliquer.

**Drapeaux** — les deux sous-réponses portent sur **les mêmes quatre pays** : les capitales
proposées sont celles des pays proposés. Si la France est du lot, Paris l'est aussi, que le drapeau
soit le sien ou celui d'un leurre. Relier un drapeau à un pays, puis ce pays à sa capitale : une
capitale reconnue peut alors rattraper un nom qui ne revient pas. Rien ne rapproche deux pays comme
le numéro rapproche deux départements — les trois autres sont pris au hasard dans le corpus. Là
encore, seul **l'ordre d'affichage** est retiré pour chaque sous-réponse.

**États américains** — les trois sous-réponses portent sur **les mêmes quatre États**, comme pour
les départements. Les leurres, eux, se prennent d'abord parmi les États dont le **code commence par
la même lettre** : c'est là que sont les confusions qui valent la peine — MI, MN, MO, MS et MT se
ressemblent bien plus que MI et FL. Dix-huit États sont seuls ou presque sous leur initiale (le
Delaware, la Floride, le Kansas…), et un carré à deux cases n'apprendrait rien : leur **région**
(déclarée dans `src/data/states.js`, et qui ne sert qu'à ça) complète alors le lot par des voisins,
faute de voisins de code.

**Racines** — seul le **sens** se joue au carré : l'origine n'a que deux valeurs, et un carré à deux
cases n'est pas un carré — elle garde ses deux boutons, et ce qui y était coché le reste. Les quatre
sens proposés sont ceux de racines du **même champ sémantique** (`famille`, dans
`src/data/roots.js`, qui ne sert qu'à ça) : « poly- » se choisit entre *plusieurs*, *un seul*,
*demi* et *égal* — quatre façons de dire une quantité, donc une vraie question. Entre *plusieurs*,
*pierre*, *cheval* et *écrire*, il n'y aurait qu'un tri par thème, et la bonne case sauterait aux
yeux sans rien apprendre.

**Plantes** (nom, famille) — les noms sont pris au hasard dans le corpus, mais les familles dans la
**liste des familles**, où chacune ne figure qu'une fois. Tirer quatre espèces et lire leur famille,
comme le font les drapeaux avec leurs capitales, aurait souvent proposé deux fois la même famille,
dont l'une fausse : le corpus compte jusqu'à six espèces par famille.

**Tableaux** (titre, peintre, siècle) — quatre propositions quelconques prises dans le corpus,
tirées indépendamment pour chaque sous-réponse : un nom de peintre appartient à toutes ses œuvres,
et deux tableaux proposés ensemble pourraient être du même — ce qui ferait deux cases justes. Les
siècles restent rangés dans l'ordre chronologique : la position d'un bouton ne doit rien dire de la
réponse.

Côté code, un thème déclare ces règles dans son `createQuiz` : `choices` dit, par sous-réponse, la
bonne proposition et le vivier des leurres ; `choiceItems` — celui des départements et des drapeaux
— dit que toutes les sous-réponses tirent d'un même quatuor d'items. Le noyau (`src/lib/choices.js`,
`src/lib/quiz-core.js`) se charge du reste : écarter les leurres qui se lisent comme la bonne réponse
(« St Etienne » à côté de « Saint-Étienne » ferait deux cases justes), respecter le filtre de tirage
du thème (une zone absente du fond de carte n'est jamais proposée) et mélanger. Une sous-réponse
cochée est corrigée exactement comme une réponse tapée, et ne rien cocher vaut ne rien répondre.

Côté écran, `src/ui/quiz-app.js` remplace tout seul les champs texte par leurs propositions ; ce qui
se répond ailleurs que dans le formulaire revient au thème, par le `showChoices` de son
`startQuizApp` : la carte se réduit à quatre zones cliquables, les boutons de siècle à quatre
valeurs.

## Tableaux

Cinq œuvres par jour. Pour chacune, l'image est affichée et il faut donner :

1. le **titre** de l'œuvre,
2. son **peintre**,
3. son **siècle**, en cliquant l'un des boutons proposés.

Un point par sous-réponse, soit 15 points par jour, comme pour les départements. La correction du
titre et du peintre réutilise `src/lib/text.js` : mêmes tolérances, et même garde-fou (« Manet » ne
passe pas pour « Monet », le titre exact d'une autre œuvre n'est jamais accepté comme faute de
frappe). La série du jour évite de tirer deux fois le même peintre.

Pour le peintre, le **nom de famille seul suffit** : « Monet » pour Claude Monet, « van Gogh » (ou
« Gogh ») pour Vincent van Gogh, « Brueghel » pour Pieter Brueghel l'Ancien. Les formes courtes sont
dérivées du nom complet (`shortNames`, dans `src/lib/quiz-paintings.js`) : tout ce qui suit le
prénom, particules comprises, en écartant le qualificatif final. Une particule ou un qualificatif
isolé (« de », « l'Ancien ») ne vaut pas réponse, et ces formes courtes comptent comme les autres
dans le garde-fou : « Renoir » ne passera jamais pour un autre peintre au titre de la faute de
frappe.

### Corpus des œuvres

`npm run build:paintings` écrit `data/tableaux.json` à partir de [Wikidata](https://www.wikidata.org)
(métadonnées en CC0, images hébergées sur Wikimedia Commons).

Wikidata décrit plus d'un million de peintures ; filtrer ce corpus par notoriété fait tomber
l'endpoint SPARQL public en timeout. L'outil part donc d'une liste d'une cinquantaine de peintres
(déclarée en tête de `tools/build-paintings.mjs`) et interroge leurs œuvres par lots — ce qui donne
de toute façon ce qu'on veut pour un quiz : un canon, pas un tirage au hasard. Sont retenues les
œuvres ayant une image sur Commons, une date, un titre français et au moins huit articles Wikipédia,
plafonnées à huit par peintre pour que Monet et Van Gogh n'écrasent pas le tirage.

Deux conséquences à connaître :

- **le corpus penche vers l'art ancien.** Seules les images libres sortent ; les peintres du
  XXe siècle encore sous droits (Frida Kahlo, une bonne partie de Picasso ou Dalí) n'en ont
  pratiquement pas sur Commons ;
- **les images sont chargées depuis Commons à l'exécution**, pas vendorisées : le fichier écrit ne
  contient que des métadonnées (~110 ko). Le nom de fichier Commons apparaît donc dans l'onglet
  réseau du navigateur, et contient souvent le titre de l'œuvre — un curieux déterminé peut y lire
  la réponse.

Relancer la commande régénère le fichier : c'est le seul moyen de faire évoluer la liste des œuvres,
il n'y a rien à modifier dans le code.

## Drapeaux et capitales

Cinq drapeaux par jour. Pour chacun, l'image est affichée et il faut donner :

1. le **nom** du pays,
2. sa **capitale**.

Deux sous-réponses seulement, donc **2 points par question et 10 points par jour** — là où les
départements et les tableaux en valent 15. Le drapeau tient lieu d'énoncé : il n'y a rien à
désigner en plus, et forcer une troisième question (le continent, la monnaie) aurait allongé chaque
tour sans rien apprendre de plus.

Le corpus est la liste des **193 États membres de l'ONU** (`src/data/countries.js`), tirés à parts
égales : c'est une règle simple à énoncer, qui ne demande aucun arbitrage sur les États à
reconnaissance partielle. Le Vatican, la Palestine, le Kosovo et Taïwan en sont donc absents.

La correction réutilise `src/lib/text.js` : mêmes tolérances qu'ailleurs, et même garde-fou
(« Niger » ne passe jamais pour le Nigeria, ni « Vienne » pour Vilnius). Des alias sont déclarés
pour les noms d'usage (« Myanmar », « Swaziland », « RDC », « USA »), les graphies concurrentes
(« Kyiv » pour Kiev, « Dhaka » pour Dacca) et les **capitales multiples** : l'Afrique du Sud accepte
Pretoria, Le Cap et Bloemfontein, la Bolivie Sucre et La Paz. La première de la liste est celle qui
s'affiche à la correction, les autres sont signalées entre parenthèses.

### Les drapeaux

`npm run build:flags` écrit `data/drapeaux/<code>.png` : un rendu de 480 px de large du drapeau de
chaque pays, téléchargé depuis [Wikimedia Commons](https://commons.wikimedia.org). Les 193 fichiers
pèsent environ 1,9 Mo, mais une partie n'est jamais chargée : une page de quiz ne demande que les
cinq drapeaux de sa série.

Deux choix méritent une explication :

- **les images sont vendorisées**, contrairement à celles des tableaux. Une URL Commons contient le
  nom du fichier, donc la réponse (`Flag of France.svg` en clair dans l'onglet réseau). Un fichier
  local nommé par le code ISO ne la donne pas — il faut vouloir la chercher — et le site n'a plus
  besoin du réseau ;
- **des PNG plutôt que les SVG d'origine**, parce que les drapeaux à emblème détaillé sont énormes
  en vectoriel (280 ko pour l'Équateur, 156 ko pour l'Espagne) là où leur rendu en fait 15.

Le drapeau retenu est celui que Wikidata donne pour drapeau *actuel* du pays. C'est une règle
mécanique, qui évite d'arbitrer au cas par cas — mais elle a des conséquences visibles :
l'Afghanistan sort avec le drapeau blanc des talibans et la Syrie avec le drapeau adopté en 2025,
pas ceux des atlas d'il y a quelques années. Changer un drapeau se fait en corrigeant le champ
`commons` du pays puis en relançant `npm run build:flags -- --force`.

Le fichier déjà présent n'est pas retéléchargé : Commons répond `429` au bout de quelques dizaines
de requêtes, et relancer la commande reprend simplement les manquants.

## États américains

Cinq États par jour. Pour chacun, on part du **code postal à deux lettres** (`CA`, `MO`, `RI`…) et
il faut donner :

1. le **nom** de l'État,
2. sa **capitale**,
3. sa **position**, en cliquant la bonne zone sur la carte des États-Unis.

Un point par sous-réponse, soit 15 points par jour : c'est le jumeau du quiz des départements, le
code à deux lettres tenant lieu de numéro.

Le corpus est celui des **50 États** (`src/data/states.js`). Le district de Columbia n'y figure pas :
ce n'est pas un État. Les noms sont donnés en français quand l'usage l'a francisé (Californie,
Caroline du Nord, Nouveau-Mexique), et le nom anglais est accepté à la correction — comme le sont
les tolérances habituelles de `src/lib/text.js`. La capitale attendue est celle de l'État, pas sa
plus grande ville : Albany et non New York, Sacramento et non Los Angeles, Olympia et non Seattle —
c'est d'ailleurs là que le thème se joue. Le garde-fou habituel s'applique : « Dover », capitale du
Delaware, n'est jamais acceptée pour Denver, dont elle n'est qu'à une lettre.

## Racines grecques et latines

Cinq racines par jour. Pour chacune, on part de la racine, du préfixe ou du suffixe — le tiret dit
lequel : `poly-`, `-logie`, `chrono-` — et il faut donner :

1. son **sens** en français,
2. son **origine**, en cliquant l'un des deux boutons : grec ou latin.

Deux sous-réponses, donc **2 points par question et 10 points par jour**, comme les drapeaux.

Le corpus (`src/data/roots.js`) compte 251 entrées, **équilibrées entre les deux origines** — 125
grecques, 126 latines. Ce n'est pas cosmétique : l'origine est une sous-réponse à deux valeurs, et
un corpus penchant d'un côté ferait payer « répondre toujours grec » sans rien mesurer. Un test le
vérifie.

### Le sens : plusieurs formulations acceptées

Une racine se traduit rarement par un mot et un seul. Chaque entrée déclare donc sa réponse
principale et ses variantes (`alias`) : `anthropo-` accepte *homme*, *être humain* et *humain*,
`-crate` accepte *pouvoir*, *puissance* et *gouvernement*. La première s'affiche à la correction, les
autres sont signalées entre parenthèses.

La correction réutilise `src/lib/text.js`. Un point à connaître : la tolérance aux fautes de frappe
est **nulle en dessous de cinq lettres**, et beaucoup de sens sont courts — *eau*, *feu*, *vie*,
*mer* s'écrivent exactement ou pas du tout. En contrepartie, le garde-fou habituel joue à plein :
« droite » (dextr-) ne passe jamais pour « droit » (rect-, ortho-), ni l'inverse. Le test le vérifie
sur les 62 750 paires du corpus.

### Doublets et faux amis

C'est là que le thème se joue. Deux racines qui disent la même chose, une par langue, forment un
**doublet** : hydro-/aqua-, poly-/multi-, mono-/uni-, nécro-/mort-, ortho-/rect-. Rien n'est déclaré
dans les données — `doublet()` les déduit du corpus (même sens principal, origines différentes), ce
qui évite une liste à tenir à jour en double. Il s'affiche à la correction : « Doublet grec :
hélio- (héliocentrique) ».

Deux racines de même sens ne tombent jamais le même jour (`distinctBy` sur le sens) : sinon la même
réponse serait à taper deux fois.

Quand une **autre** racine s'écrit pareil sans rien avoir à voir, l'entrée porte une `note`, affichée
elle aussi à la correction :

- le grec péd(o)- « enfant » (pédiatre, pédagogie) et le latin *pes, pedis* « pied » (pédale,
  bipède) ;
- le latin *sol* « soleil » (solaire, tournesol) et *solus* « seul » (solitude, isoler) ;
- le grec homo- « semblable » (homonyme) et le latin *homo* « homme » (homicide) ;
- le latin *aequus* « égal » (équilibre) et *equus* « cheval » (équitation) ;
- le para- grec « à côté de » (parallèle, parasite) et celui de parapluie, venu de l'italien
  *parare* « protéger ».

Ces racines-là sont dans le corpus sous une graphie qui lève l'ambiguïté — le préfixe `péd-, pédo-`
d'un côté, le suffixe `-pède, pédi-` de l'autre — de sorte qu'une question a toujours une réponse et
une seule.

### Le second coup de pouce

À côté de « Passer au carré », le thème ajoute **« Voir un exemple »** : un mot français bâti sur la
racine. Il obéit aux mêmes règles que le carré — il ne vaut que pour la question en cours, il ne
change rien à la note, et une fois demandé le bouton disparaît jusqu'à la question suivante. Un seul
exemple, pas la liste : c'est un indice, pas la correction. Tous s'affichent de toute façon une fois
la réponse validée.

C'est le pendant du carré pour ce thème : le carré aide à *reconnaître* un sens, l'exemple aide à le
*retrouver* — « télé-, comme dans télévision » suffit souvent à débloquer une racine qu'on connaît
sans savoir la nommer.

## Plantes, fleurs et arbres

Cinq plantes par jour. Pour chacune, la photo est affichée et il faut donner :

1. le **nom français** de l'espèce,
2. sa **famille** botanique.

Deux sous-réponses, donc **2 points par question et 10 points par jour**, comme les drapeaux : la
photo tient lieu d'énoncé, il n'y a rien à désigner en plus. La famille est ce qui fait du thème
autre chose qu'un imagier — reconnaître un pissenlit s'apprend seul, le ranger chez les astéracées
avec la marguerite, le bleuet et le tournesol demande un classement.

Le corpus (`src/data/plants.js`) mêle une centaine d'espèces communes en France et en Europe :
arbres des forêts et des rues, fleurs des prés et des jardins, plantes cultivées et « mauvaises
herbes ». Il compte **plusieurs espèces par famille** — six astéracées, cinq rosacées, cinq
fabacées, cinq pinacées — parce que c'est ce qui rend la seconde sous-réponse apprenable ; une même
série n'en pose d'ailleurs jamais deux de la même famille, sans quoi la réponse serait à taper deux
fois.

Chaque espèce porte son **nom scientifique**, qui ne se demande jamais mais s'affiche à la
correction : c'est lui qui relie le nom français à la famille (*Bellis perennis*, donc astéracées).

Les familles sont celles d'**APG IV**, la classification de Wikidata : le tilleul est chez les
malvacées et non les tiliacées, le muguet chez les asparagacées et non les liliacées. Les anciennes
familles, encore dans tous les manuels, restent acceptées à la correction — « Acéracées » pour
l'érable, « Composées » pour les astéracées, « Labiées » pour les lamiacées — de même que la forme
scientifique de la famille : « Rosacées » comme « Rosaceae ». Un point perdu sur une graphie
n'apprendrait rien à personne.

Deux détails de correction méritent d'être signalés :

- **une famille appartient à toutes ses espèces**. Le garde-fou de `src/lib/text.js` refuse la
  tolérance aux fautes de frappe à une saisie qui est exactement la réponse d'un *autre* item ;
  sans traitement à part, « Rosacées » n'aurait été accepté que sur une seule des cinq rosacées du
  corpus. C'est le `ownerOf` de `createQuiz`, déjà utilisé pour les peintres ;
- **au carré, les familles sont tirées dans la liste des familles**, et non parmi celles de quatre
  espèces prises au hasard comme le fait le thème des drapeaux pour ses capitales : quatre espèces
  au hasard partagent souvent une famille, et deux propositions identiques dont l'une serait fausse
  n'ont pas de sens.

### Les photos

`npm run build:plants` écrit `data/plantes/<code>.jpg` : une photo de 500 px de large par espèce,
téléchargée depuis [Wikimedia Commons](https://commons.wikimedia.org), et
`data/plantes/credits.json`, l'auteur et la licence de chacune. Les 104 fichiers pèsent environ
11 Mo, dont une page de quiz ne charge que les cinq photos de sa série.

Comme les drapeaux, **les images sont vendorisées** : une URL Commons contient le nom du fichier,
donc l'espèce, et souvent la réponse en toutes lettres. C'est aussi pourquoi le code d'une espèce
est un numéro (`p075`) et non un nom : il baptise le fichier, et `paquerette.jpg` dans l'onglet
réseau vaudrait solution. Ces codes ne sont **jamais renumérotés** — ce sont les clés des
statistiques déjà enregistrées ; une espèce retirée laisse simplement un trou dans la suite.

Ce que l'outil va chercher, là où `build:flags` lit un nom de fichier écrit à la main : seul le nom
scientifique est déclaré dans les données, Wikidata donne le reste — l'illustration de l'espèce
(P18), l'article français correspondant, et la famille par remontée des taxons parents (P171)
jusqu'au rang « famille ». Recopier une centaine d'identifiants `Q…` à la main aurait été une source
d'erreurs silencieuses ; un nom de taxon se relit dans la liste.

Deux garde-fous sortent de là :

- **la famille est vérifiée, jamais importée**. Celle que donne Wikidata est comparée au
  `familyLatin` déclaré, et tout écart est signalé en fin de commande. Une famille fausse, dans un
  quiz qui la demande, ne se voit pas autrement ;
- **une planche n'est pas une photo**. P18 sert parfois une planche d'herbier ou une gravure du
  XIXe siècle : elles portent le nom latin **imprimé dessus**, donc la réponse. L'outil préfère donc
  la photo de tête de l'article de Wikipédia, écarte les fichiers dont le nom trahit une planche, et
  ne garde que du JPEG — Commons ne convertit pas une vignette d'un format à l'autre, un PNG
  sortirait tel quel d'un fichier nommé `.jpg`. Il reste deux espèces où rien de bon ne sortait :
  elles déclarent leur image dans le champ `commons`, l'exception plutôt que la règle.

Enfin, ces photos ne sont ni des drapeaux ni des tableaux tombés dans le domaine public : elles sont
sous **licence libre avec attribution**. L'auteur et la licence de chacune s'affichent donc sous
l'image à la correction (pas avant : le nom d'un fichier Commons donne souvent l'espèce), et
`credits.json` est chargé au démarrage — son absence est un écran d'erreur, pas un détail qu'on
passe sous silence.

## L'illustration en grand

Le tableau, le drapeau et la photo de plante partagent la place avec le formulaire : ils sont
bornés à 62 % de la hauteur de la fenêtre, et à 46 % dès que les colonnes s'empilent. C'est assez
pour reconnaître un drapeau, rarement pour détailler un tableau ou la nervure d'une feuille. **Un clic sur l'illustration l'affiche donc sur toute
la page, et un second referme** — c'est le même geste qui ouvre et qui ferme, où que soit le
pointeur : il n'y a pas de croix à viser. La touche Échap referme aussi, et le focus revient à
l'illustration d'où l'on est parti.

La légende reprise sous l'image est celle de la figure, vide tant que la réponse n'est pas donnée :
agrandir une œuvre ne dévoile jamais son titre avant l'heure. Le nom de l'image, lui, reste son
`alt` — « Drapeau à identifier », puis le pays une fois la correction affichée.

La fenêtre est posée par `src/ui/lightbox.js`, une fois au démarrage
(`setupLightbox()` dans `src/ui/quiz-app.js`), et les pages n'ont qu'à marquer d'un `data-zoom`
l'image qui s'agrandit. Comme le bouton des thèmes, l'affordance est ajoutée en JavaScript et non
écrite dans les pages : c'est là aussi que l'image devient focalisable et actionnable au clavier —
une image ne l'est pas — et sans JavaScript, rien ne s'annonce cliquable puisque rien ne s'ouvrirait.
Les thèmes sans illustration ne marquent rien, et ne reçoivent pas de fenêtre.

## Sur téléphone

Les sept pastilles de l'en-tête — l'accueil et les six thèmes — font largement plus de 550 px : sur un
téléphone elles sortaient de l'écran, et toute la page se mettait à défiler horizontalement. En
dessous de 720 px de large, elles se replient donc derrière un bouton, et se déplient en panneau
sous l'en-tête ; il se referme à la touche Échap ou au premier clic à côté.

Ce bouton est posé par `src/ui/theme-nav.js`, pas écrit dans les sept pages : c'est un affordance de
JavaScript, et une duplication de moins entre les pages. Sans JavaScript, il n'apparaît pas et la
barre reste affichée telle quelle — `.themes` passe à la ligne dans `styles.css`, ce qui coûte une
rangée dans l'en-tête mais ne déborde jamais. Les pages n'ont donc rien à porter d'autre que leur
`<nav class="themes">` habituel.

Chaque nouvelle question donne aussi le focus au premier champ, pour qu'on puisse taper sans viser :
sur un téléphone, cela appelait le clavier virtuel, qui couvre la moitié basse de l'écran. Le
tableau, le drapeau, la photo ou la carte se retrouvaient poussés hors de vue, et il fallait refermer le
clavier pour lire la question qu'on venait de recevoir. Sur un appareil tactile, c'est donc l'énoncé
qui prend le focus : on lit la question, puis on tape dans le champ, ce qui appelle le clavier au
moment voulu.

L'énoncé plutôt que rien, car le focus a un second rôle : le bouton « Question suivante » vient de
disparaître, et à défaut le focus retomberait sur `<body>` — un lecteur d'écran n'annoncerait pas la
question suivante, et la page resterait au bas du formulaire. `focusQuestion()`
(`src/ui/quiz-app.js`) vise donc le `<p class="prompt">` de la page, qu'il rend focalisable au
passage : `tabindex="-1"` se vise sans entrer dans l'ordre de tabulation. Comme le bouton des
thèmes, il est posé en JavaScript et non écrit dans les six pages — sans JavaScript, il n'y aurait
rien à viser. Un énoncé n'étant pas un contrôle, `styles.css` lui retire le cadre de mise au point.

Le partage se fait sur `(pointer: coarse)` (`src/ui/keyboard.js`) et non sur la largeur : c'est
l'appareil tactile qui affiche un clavier à l'écran, tablette de 1024 px comprise, quand une fenêtre
de bureau rétrécie à 390 px n'en affiche pas. Le seuil de 720 px de l'en-tête répond à une autre
question — l'encombrement — et se tromperait des deux côtés. Le reste du parcours au clavier ne
bouge pas : Entrée enchaîne les champs, et la correction met le focus sur « Question suivante ».

## Ajouter un thème plus tard

Les six thèmes posent au fond la même question — « voici un item, donne-en deux ou trois
caractéristiques » — et ce déroulé n'est écrit qu'une fois. Un thème ne décrit que ce qui lui est
propre ; les deux briques communes s'occupent du reste :

- **`src/lib/quiz-core.js`** — la logique de jeu, sans DOM. `createQuiz({ items, textFields,
  accepted, choiceFields… })` rend un quiz complet : série du jour déterministe, correction, un
  point par sous-réponse juste, et le garde-fou qui refuse la tolérance aux fautes de frappe à une
  saisie qui est exactement la réponse d'un autre item. `weakest()` en tire le « À revoir » de
  l'écran de résultat ;
- **`src/ui/quiz-app.js`** — l'écran. `startQuizApp({ theme, fields, inputs… })` tient la barre de
  progression, l'enchaînement des questions, la correction affichée, le résultat, les statistiques,
  l'entraînement libre, le mode carré et la persistance. Le thème ne fournit que sa question
  (`ask`), ses propositions sur l'énoncé (`showChoices`) et sa correction visuelle (`reveal`).

Restent, par thème : `src/lib/quiz-<thème>.js` (le corpus et ses sous-réponses),
`src/app-<thème>.js` (une centaine de lignes de DOM propre au thème) et sa page HTML. Les briques
`src/lib/text.js`, `rng.js`, `storage.js` et `date.js` se réutilisent telles quelles.

Concrètement, pour un thème de plus :

1. **les données** — un module de `src/data/` ou un fichier de `data/` produit par un outil de
   `tools/` ;
2. **`src/lib/quiz-<thème>.js`** — un appel à `createQuiz` : les champs en texte libre, la fonction
   `accepted` qui dit les réponses valables, éventuellement un `choiceFields` pour ce qui se
   répond au clic (la carte, le siècle), et un `choices` pour le mode carré ;
3. **`<thème>.html`** — le squelette d'une page existante, en gardant les identifiants attendus
   (`progress`, `answer-form`, `feedback`, `btn-validate`, `screen-summary`…) et la barre
   `<nav class="themes">` de l'en-tête, à laquelle se raccroche le menu des écrans étroits ;
   `btn-carre` est facultatif, une page qui ne le porte pas se joue seulement au clavier ;
4. **`src/app-<thème>.js`** — l'appel à `startQuizApp` ;
5. **une entrée dans `THEMES`** (`src/lib/themes.js`).

Un point à ne pas manquer : le `namespace` passé à `createQuiz` entre dans la graine du tirage. Il
distingue les thèmes entre eux — sans lui, deux thèmes de même taille poseraient les mêmes questions
le même jour — mais **le changer une fois le thème en ligne rebattrait les cartes de tout le
monde**.

Deux façons de ranger les données, selon le thème. Liste fermée et stable (départements, pays,
États américains, racines, plantes) :
un module JS importé normalement, modifiable à la main, et les outils de `tools/` ne servent qu'aux
images. Corpus ouvert et régénérable (tableaux) : un fichier de `data/` produit par un outil et
chargé en JSON à l'exécution, ce qui impose un écran de chargement et un écran d'erreur — le thème
« pays » s'en passe. Les deux se mélangent : les plantes sont une liste tenue à la main, mais les
crédits de leurs photos sont produits par l'outil, donc chargés à l'exécution comme un corpus.

Ajouter une entrée à `THEMES` suffit à faire apparaître le thème dans le menu, avec ses deux
boutons et son état du jour : `src/app-menu.js` ne connaît rien du contenu des thèmes, il lit leur
progression par la clé déclarée là.

`createStore(adapter, { statsKey })` et `createLocalAdapter({ key, statsKey })` isolent la
progression d'un thème de celle des autres : une clé `localStorage` par thème. Les statistiques par
item sont agrégées à partir des sous-réponses corrigées, sans que `storage.js` ait à connaître leurs
noms.

## Déploiement

`.github/workflows/pages.yml` lance les tests puis publie la racine du dépôt sur GitHub Pages à
chaque push sur `main`. Il faut activer Pages sur le dépôt avec la source **GitHub Actions**
(Settings → Pages).
