# Quotiquiz

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
