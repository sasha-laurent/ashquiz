# Ashquiz

Petits quiz de révision quotidiens. Premier thème : **les départements et préfectures français**.

Chaque jour, cinq questions. Pour chacune, on part du numéro de département et il faut donner :

1. le **nom** du département,
2. sa **préfecture**,
3. sa **position**, en cliquant la bonne zone sur la carte de France.

Un point par sous-réponse, soit 15 points par jour. La série du jour est tirée de façon
déterministe à partir de la date : recharger la page ne rebat pas les cartes, et deux appareils
affichent le même quiz le même jour.

## Démarrer en local

```sh
npm run build:map   # une fois : télécharge le fond de carte dans data/
npm run dev         # http://localhost:8080
npm test            # tests unitaires (aucune dépendance)
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

En dehors du quiz du jour, le bouton **Entraînement libre** relance une série aléatoire qui ne
compte pas dans les statistiques.

## Thème « tableaux célèbres » (données prêtes, écran à faire)

Le corpus vit dans `src/data/paintings.js` : 113 tableaux, 58 artistes, de 1432
(*L'Agneau mystique*) à 1930 (*American Gothic*). Chaque entrée porte le titre,
l'auteur, la datation et le lieu de conservation.

```sh
npm run build:paintings   # résout chaque tableau, télécharge les images
```

Le script écrit `data/paintings/` (une image par tableau) et `data/paintings.json`
(identifiant Wikidata, crédits, licence, URL distante de secours). Compter
environ 20 Mo à 1000 px de large ; `WIDTH=700 npm run build:paintings` réduit à
peu près de moitié.

### Pourquoi Wikidata plutôt qu'un musée

Les API de musée (Met, Art Institute of Chicago, Rijksmuseum) sont excellentes
mais ne contiennent que leur propre collection. Le canon visé est par nature
multi-musées : Louvre, Orsay, Prado, Rijksmuseum, Offices, Oslo. Wikidata est le
seul index qui les couvre toutes, avec un modèle stable (`P170` auteur, `P571`
date, `P18` image) et les reproductions hébergées sur Wikimedia Commons.

La liste, elle, est tenue à la main : un classement automatique par notoriété
(nombre de Wikipédias liées) produit un corpus déséquilibré, très centré
Renaissance italienne, mêlé de doublons et d'œuvres qui ne sont pas des tableaux.
Wikidata sert donc d'arbitre plutôt que de source : `build:paintings` vérifie que
l'entité trouvée est bien un tableau du bon auteur, et **signale tout écart de
datation** avec la valeur écrite à la main, sans jamais corriger en silence.

### Domaine public seulement

Le corpus s'arrête aux auteurs morts avant 1950, avec une marge sur la règle
française des 70 ans après la mort. C'est ce qui exclut Picasso, Dalí, Magritte,
Hopper, Kahlo et Matisse : *Guernica*, *La Persistance de la mémoire* et
*Nighthawks* sont dans la culture générale de tout le monde, mais pas
publiables ici. Un test (`tests/paintings.test.mjs`) garde la limite.

### Corriger les réponses

Le titre et l'auteur passent par `src/lib/text.js`, comme les départements. La
date demande une règle à part : beaucoup d'œuvres sont datées par fourchette
(*La Joconde*, 1503-1519) ou de façon incertaine, donc une comparaison exacte
serait injuste. D'où `year` + `yearEnd` dans les données, et une tolérance à
définir à l'écriture de l'écran.

## Ajouter un thème plus tard

Le code est découpé pour ça :

- `src/data/` — les données du thème ;
- `src/lib/quiz.js` — tirage de la série et notation, sans DOM ;
- `src/lib/text.js`, `src/lib/rng.js`, `src/lib/storage.js` — briques réutilisables telles quelles ;
- `src/ui/`, `src/app.js` — l'écran, spécifique au thème « départements ».

## Déploiement

`.github/workflows/pages.yml` lance les tests puis publie la racine du dépôt sur GitHub Pages à
chaque push sur `main`. Il faut activer Pages sur le dépôt avec la source **GitHub Actions**
(Settings → Pages).
