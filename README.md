# Ashquiz

Petits quiz de révision quotidiens. La page d'accueil (`index.html`) est un menu : un bloc par
thème, avec son quiz du jour et son entraînement libre.

Trois thèmes pour l'instant :

- **Départements et préfectures français** (`departements.html`) ;
- **Tableaux** (`tableaux.html`) : reconnaître une œuvre, son peintre et son siècle ;
- **Drapeaux et capitales** (`pays.html`) : reconnaître un pays à son drapeau et donner sa capitale.

Chaque thème a sa propre série du jour, sa propre progression et sa propre série de jours
consécutifs. Le menu affiche, pour chacun, si la série du jour est faite et la série de jours en
cours ; une fois le quiz du jour terminé, c'est l'entraînement libre qui devient l'action mise en
avant.

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
npm run dev              # http://localhost:8080
npm test                 # tests unitaires (aucune dépendance)
```

Il n'y a **aucune étape de build** et aucune dépendance npm : ce sont des fichiers statiques et des
modules ES chargés tels quels. Le serveur `npm run dev` sert juste à éviter les restrictions
`file://` sur les modules.

## Fond de carte

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

## Ajouter un thème plus tard

Les trois thèmes posent au fond la même question — « voici un item, donne-en deux ou trois
caractéristiques » — et ce déroulé n'est écrit qu'une fois. Un thème ne décrit que ce qui lui est
propre ; les deux briques communes s'occupent du reste :

- **`src/lib/quiz-core.js`** — la logique de jeu, sans DOM. `createQuiz({ items, textFields,
  accepted, choiceFields… })` rend un quiz complet : série du jour déterministe, correction, un
  point par sous-réponse juste, et le garde-fou qui refuse la tolérance aux fautes de frappe à une
  saisie qui est exactement la réponse d'un autre item. `weakest()` en tire le « À revoir » de
  l'écran de résultat ;
- **`src/ui/quiz-app.js`** — l'écran. `startQuizApp({ theme, fields, inputs… })` tient la barre de
  progression, l'enchaînement des questions, la correction affichée, le résultat, les statistiques,
  l'entraînement libre et la persistance. Le thème ne fournit que sa question (`ask`) et sa
  correction visuelle (`reveal`).

Restent, par thème : `src/lib/quiz-<thème>.js` (le corpus et ses sous-réponses),
`src/app-<thème>.js` (une centaine de lignes de DOM propre au thème) et sa page HTML. Les briques
`src/lib/text.js`, `rng.js`, `storage.js` et `date.js` se réutilisent telles quelles.

Concrètement, pour un quatrième thème :

1. **les données** — un module de `src/data/` ou un fichier de `data/` produit par un outil de
   `tools/` ;
2. **`src/lib/quiz-<thème>.js`** — un appel à `createQuiz` : les champs en texte libre, la fonction
   `accepted` qui dit les réponses valables, et éventuellement un `choiceFields` pour ce qui se
   répond au clic (la carte, le siècle) ;
3. **`<thème>.html`** — le squelette d'une page existante, en gardant les identifiants attendus
   (`progress`, `answer-form`, `feedback`, `btn-validate`, `screen-summary`…) ;
4. **`src/app-<thème>.js`** — l'appel à `startQuizApp` ;
5. **une entrée dans `THEMES`** (`src/lib/themes.js`).

Un point à ne pas manquer : le `namespace` passé à `createQuiz` entre dans la graine du tirage. Il
distingue les thèmes entre eux — sans lui, deux thèmes de même taille poseraient les mêmes questions
le même jour — mais **le changer une fois le thème en ligne rebattrait les cartes de tout le
monde**.

Deux façons de ranger les données, selon le thème. Liste fermée et stable (départements, pays) :
un module JS importé normalement, modifiable à la main, et les outils de `tools/` ne servent qu'aux
images. Corpus ouvert et régénérable (tableaux) : un fichier de `data/` produit par un outil et
chargé en JSON à l'exécution, ce qui impose un écran de chargement et un écran d'erreur — le thème
« pays » s'en passe.

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
