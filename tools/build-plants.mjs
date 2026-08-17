#!/usr/bin/env node
// Écrit data/plantes/<code>.jpg : une photo de chaque espèce de
// src/data/plants.js, plus data/plantes/credits.json — l'auteur et la licence de
// chacune, que le site affiche à la correction.
//
// Les photos sont **vendorisées**, comme les drapeaux et pour la même raison :
// une URL Commons contient le nom du fichier, donc le nom de l'espèce, et
// souvent la réponse en toutes lettres (`Bellis perennis white (aka).jpg`). Un
// fichier local nommé `p075.jpg` ne la donne pas, et le site n'a plus besoin du
// réseau.
//
// Ce que l'outil va chercher, contrairement à `build:flags` où le nom du fichier
// Commons est écrit à la main dans les données : ici seul le **nom scientifique**
// est déclaré, et Wikidata donne le reste — l'illustration de l'espèce (P18) et
// sa famille (la remontée des taxons parents, P171, jusqu'au rang « famille »).
// Recopier des identifiants `Q…` ou des noms de fichiers à la main pour une
// centaine d'espèces aurait été une source d'erreurs silencieuses ; un nom de
// taxon, lui, se vérifie d'un coup d'œil dans la liste.
//
// La famille servie par Wikidata n'est jamais écrite dans les données : elle est
// **comparée** à celle déclarée (`familyLatin`) et tout écart est signalé en fin
// de course. C'est le garde-fou du corpus — une famille fausse, dans un quiz qui
// la demande, ne se voit pas autrement.
//
// Le fichier déjà présent n'est pas retéléchargé : après un échec réseau, on
// relance la commande et seuls les manquants sont repris. `--force` reprend tout.

import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLANTS } from '../src/data/plants.js';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const AGENT = 'ashquiz/0.1 (https://github.com/sasha-laurent/ashquiz)';

// Commons ne rend pas la largeur demandée mais le palier au-dessus : 480 donne
// une vignette de 500 px, la même que les drapeaux, à environ 80 ko l'unité. Le
// palier suivant (960 px) triple le poids du dépôt pour une photo qui n'a besoin
// d'être lisible qu'agrandie sur la page (`src/ui/lightbox.js`), pas imprimée.
const WIDTH = 480;
// L'endpoint public répond mal au-delà : la remontée des taxons parents coûte
// cher.
const CHUNK_SIZE = 10;
// Ni Commons ni Wikidata n'aiment les rafales.
const PAUSE_MS = 150;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'data', 'plantes');
const CREDITS = resolve(OUT_DIR, 'credits.json');

const force = process.argv.includes('--force');

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// Q35409 : le rang taxinomique « famille ».
const query = (taxa) => `
SELECT ?taxon ?item ?image ?famille ?article WHERE {
  VALUES ?taxon { ${taxa.map((name) => JSON.stringify(name)).join(' ')} }
  ?item wdt:P225 ?taxon ; wdt:P18 ?image .
  OPTIONAL { ?item wdt:P171* ?rang . ?rang wdt:P105 wd:Q35409 ; wdt:P225 ?famille . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> }
}`;

async function ask(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': AGENT, accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    // Les deux services publics sont régulièrement saturés : on réessaie en
    // s'espaçant.
    if (attempt >= 5) throw new Error(`service inaccessible (${error.message})`);
    const wait = 2 ** attempt * 1000;
    process.stdout.write(`  ${error.message} — nouvelle tentative dans ${wait / 1000} s\n`);
    await sleep(wait);
    return ask(url, attempt + 1);
  }
}

const sparql = (text) =>
  ask(`${ENDPOINT}?query=${encodeURIComponent(text)}&format=json`).then(
    (data) => data.results.bindings,
  );

/** Le nom du fichier Commons, tel qu'il s'écrit dans une URL `Special:FilePath`. */
const commonsFile = (imageUrl) =>
  decodeURIComponent(imageUrl.split('/Special:FilePath/')[1] ?? '').replace(/_/g, ' ');

const thumbnail = (file) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${WIDTH}`;

async function download(file, attempt = 1) {
  try {
    const response = await fetch(thumbnail(file), { headers: { 'user-agent': AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    // Commons renvoie parfois une page d'erreur en HTML plutôt qu'un 404 : sans
    // ce contrôle, on écrirait du HTML dans un .jpg. Et une vignette n'est pas
    // convertie d'un format à l'autre — un original en PNG ou en TIFF sort tel
    // quel, il faut alors changer d'image côté Commons.
    if (buffer.length < 100 || buffer.subarray(0, 3).toString('hex') !== 'ffd8ff') {
      throw new Error('la réponse n’est pas un JPEG');
    }
    return buffer;
  } catch (error) {
    if (attempt >= 3) throw error;
    await sleep(2 ** attempt * 1000);
    return download(file, attempt + 1);
  }
}

/**
 * Ce qui disqualifie une image, à son seul nom de fichier : une planche
 * d'herbier (une plante séchée sur une feuille d'étiquettes) et une planche
 * botanique du XIXe portent le nom latin de l'espèce **imprimé dessus**. Dans un
 * quiz, elles donnent la réponse ; et une plante séchée ne ressemble de toute
 * façon pas à celle qu'on croise dehors.
 */
const PLATE = /herbari|herbier|museo|specimen|illustration|k[oö]hler|planche|COI0\d|MHNT|flora von|thom[ée]/i;

/**
 * L'image de tête de l'article de Wikipédia en français : c'est presque toujours
 * la photo de l'espèce vivante, là où P18 sert parfois une planche.
 * @param {string} article  URL de l'article, telle que la donne Wikidata
 */
async function leadImage(article) {
  const title = decodeURIComponent(article.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  if (!title) return null;
  const data = await ask(
    'https://fr.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
      `&prop=pageimages&piprop=name&titles=${encodeURIComponent(title)}`,
  );
  const pages = Object.values(data?.query?.pages ?? {});
  return pages[0]?.pageimage?.replace(/_/g, ' ') ?? null;
}

/** Le HTML des métadonnées Commons ramené à du texte : « <a …>Marie</a> » → « Marie ». */
const plain = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * L'auteur et la licence d'une photo : les photographies de Commons ne sont pas
 * dans le domaine public comme le sont les drapeaux et les tableaux du site,
 * elles demandent une attribution.
 */
async function credit(file) {
  const url =
    `${COMMONS_API}?action=query&format=json&origin=*` +
    `&titles=${encodeURIComponent(`File:${file}`)}` +
    `&prop=imageinfo&iiprop=extmetadata|user&iiextmetadatafilter=Artist|LicenseShortName`;
  const data = await ask(url);
  const pages = Object.values(data?.query?.pages ?? {});
  const info = pages[0]?.imageinfo?.[0] ?? {};
  const meta = info.extmetadata ?? {};
  return {
    // Une dizaine de fichiers n'ont pas de champ « auteur » renseigné : à
    // défaut, celui qui l'a versé sur Commons, qui en est presque toujours
    // l'auteur — c'est ce que demandent les licences CC BY et CC BY-SA.
    author: plain(meta.Artist?.value) || info.user || 'auteur inconnu',
    license: plain(meta.LicenseShortName?.value) || 'voir la page du fichier',
  };
}

// --- Ce que Wikidata sait des espèces ---------------------------------------

const found = new Map();
const chunks = [];
for (let i = 0; i < PLANTS.length; i += CHUNK_SIZE) chunks.push(PLANTS.slice(i, i + CHUNK_SIZE));

for (const [index, chunk] of chunks.entries()) {
  process.stdout.write(`Lot ${index + 1}/${chunks.length} : ${chunk.length} espèces… `);
  const rows = await sparql(query(chunk.map((plant) => plant.latin)));

  for (const row of rows) {
    const taxon = row.taxon.value;
    const entry = found.get(taxon) ?? { images: new Set(), families: new Set(), article: null };
    entry.images.add(commonsFile(row.image.value));
    if (row.famille) entry.families.add(row.famille.value);
    if (row.article) entry.article = row.article.value;
    found.set(taxon, entry);
  }
  process.stdout.write(`${rows.length} réponse(s)\n`);
  await sleep(PAUSE_MS);
}

// --- Photos et crédits -------------------------------------------------------

await mkdir(OUT_DIR, { recursive: true });

let credits = {};
try {
  credits = JSON.parse(await readFile(CREDITS, 'utf8')).photos ?? {};
} catch {
  // Premier passage : il n'y a pas encore de crédits à reprendre.
}

let written = 0;
let kept = 0;
const failed = [];
const mismatched = [];

for (const [index, plant] of PLANTS.entries()) {
  const entry = found.get(plant.latin);
  if (!entry?.images.size) {
    failed.push(`${plant.name} (${plant.latin}) : aucune image sur Wikidata`);
    continue;
  }

  // La famille déclarée dans src/data/plants.js contre celle de Wikidata.
  if (entry.families.size && !entry.families.has(plant.familyLatin)) {
    mismatched.push(`${plant.name} : ${plant.familyLatin} déclaré, ${[...entry.families].join(' / ')} sur Wikidata`);
  }

  const path = resolve(OUT_DIR, `${plant.code}.jpg`);
  const already = await stat(path).then(
    (info) => info.size > 0,
    () => false,
  );
  if (!force && already && credits[plant.code]) {
    kept += 1;
    continue;
  }

  process.stdout.write(`${index + 1}/${PLANTS.length} ${plant.name}… `);
  // Une espèce a souvent plusieurs illustrations : la photo de tête de son
  // article, une ou plusieurs P18, une planche ancienne, un schéma vectoriel. On
  // les classe et on prend la meilleure — du JPEG d'abord, Commons ne
  // convertissant pas une vignette d'un format à l'autre (un PNG ou un SVG
  // sortirait tel quel d'un fichier nommé `.jpg`), puis une photo plutôt qu'une
  // planche. `commons`, dans les données, court-circuite ce classement quand il
  // ne donne rien de bon : c'est l'exception, pas la règle.
  const candidates = plant.commons
    ? [plant.commons]
    : [...(entry.article ? [await leadImage(entry.article)] : []), ...entry.images].filter(Boolean);
  const [file] = candidates
    .map((name, rank) => ({ name, rank, plate: PLATE.test(name), jpeg: /\.jpe?g$/i.test(name) }))
    .sort((a, b) => b.jpeg - a.jpeg || a.plate - b.plate || a.rank - b.rank)
    .map((candidate) => candidate.name);

  try {
    const buffer = await download(file);
    await writeFile(path, buffer);
    credits[plant.code] = { file, ...(await credit(file)) };
    written += 1;
    process.stdout.write(`${Math.round(buffer.length / 1024)} ko\n`);
  } catch (error) {
    failed.push(`${plant.name} (${file}) : ${error.message}`);
    process.stdout.write(`échec — ${error.message}\n`);
  }
  await sleep(PAUSE_MS);
}

// Une espèce retirée de la liste laisserait sinon sa photo et son crédit
// derrière elle.
const expected = new Set(PLANTS.map((plant) => `${plant.code}.jpg`));
for (const name of await readdir(OUT_DIR)) {
  if (name === 'credits.json' || expected.has(name)) continue;
  await unlink(resolve(OUT_DIR, name));
  process.stdout.write(`Supprimé (plus dans la liste) : ${name}\n`);
}
for (const code of Object.keys(credits)) {
  if (!expected.has(`${code}.jpg`)) delete credits[code];
}

await writeFile(
  CREDITS,
  `${JSON.stringify(
    {
      source: 'Wikimedia Commons',
      generatedAt: new Date().toISOString().slice(0, 10),
      photos: Object.fromEntries(Object.keys(credits).sort().map((code) => [code, credits[code]])),
    },
    null,
    1,
  )}\n`,
);

process.stdout.write(
  `\nÉcrit : ${OUT_DIR}\n${written} photo(s) téléchargée(s), ${kept} déjà présente(s).\n`,
);
if (mismatched.length) {
  process.stdout.write(`\n${mismatched.length} famille(s) à vérifier dans src/data/plants.js :\n`);
  for (const line of mismatched) process.stdout.write(`  ${line}\n`);
}
if (failed.length) {
  process.stdout.write(`\n${failed.length} échec(s) — relancer la commande les reprendra :\n`);
  for (const line of failed) process.stdout.write(`  ${line}\n`);
  process.exitCode = 1;
}
