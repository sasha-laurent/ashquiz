#!/usr/bin/env node
// Résout chaque tableau de src/data/paintings.js contre Wikidata, télécharge la
// reproduction depuis Wikimedia Commons dans data/paintings/, et écrit
// data/paintings.json (métadonnées vérifiées + crédits).
//
// Pourquoi Wikidata plutôt qu'une API de musée : le canon recherché est
// multi-musées (Louvre, Orsay, Prado, Rijksmuseum, Oslo, Offices…). Une API de
// collection unique — Met, Art Institute of Chicago, Rijksmuseum — ne contient
// que ses propres œuvres et raterait la Joconde, Le Cri ou Le Radeau de La
// Méduse. Wikidata est le seul index qui les couvre toutes, avec l'image sur
// Commons et un modèle de données stable (P170 auteur, P571 date, P18 image).
//
// Le script ne fait pas confiance à la liste : il vérifie que l'entité trouvée
// est bien un tableau du bon auteur, et signale tout écart de datation avec la
// valeur écrite à la main. Rien n'est corrigé en silence.

import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAINTINGS } from '../src/data/paintings.js';
import { normalize } from '../src/lib/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'data', 'paintings');
const OUT_JSON = resolve(ROOT, 'data', 'paintings.json');

// Largeur des reproductions téléchargées. 1000 px suffit largement pour un
// affichage plein cadre ; au-delà, le dépôt gonfle pour rien.
const WIDTH = Number(process.env.WIDTH || 1000);

// Wikimedia exige un User-Agent identifiable, sans quoi les requêtes sont
// rejetées (HTTP 403). https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
const UA = 'Ashquiz/0.1 (https://github.com/sasha-laurent/ashquiz)';

const Q_PAINTING = 'Q3305213';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (response.status === 429 || response.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error('inatteignable');
}

const entityCache = new Map();

async function entity(id) {
  if (!entityCache.has(id)) {
    const data = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`);
    entityCache.set(id, data.entities?.[id] ?? null);
  }
  return entityCache.get(id);
}

const label = (item) =>
  item?.labels?.fr?.value ?? item?.labels?.en?.value ?? item?.labels?.mul?.value ?? '';

const claims = (item, property) =>
  (item?.claims?.[property] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);

/** Année de P571, en gérant les dates négatives et les précisions grossières. */
function inceptionYear(item) {
  const [value] = claims(item, 'P571');
  if (!value?.time) return null;
  const year = Number(value.time.slice(0, 5).replace('+', ''));
  return Number.isFinite(year) ? year : null;
}

/**
 * À quel point ce nom d'auteur correspond-il à celui attendu ?
 * 2 = identique, 1 = inclusion mot à mot, 0 = sans rapport.
 *
 * L'inclusion est indispensable (« Rembrandt » vs « Rembrandt van Rijn »), mais
 * elle est trop permissive seule : l'alias « Bruegel » vaudrait aussi pour
 * Bruegel le Jeune. D'où le score, qui laisse l'appelant préférer un homonyme
 * exact quand il en existe un.
 */
function artistScore(found, expected, aliases = []) {
  const target = normalize(found);
  if (!target) return 0;
  const targetWords = new Set(target.split(' '));
  let best = 0;
  for (const candidate of [expected, ...aliases].map(normalize)) {
    if (!candidate) continue;
    if (target === candidate) return 2;
    const candidateWords = candidate.split(' ');
    const included =
      candidateWords.every((word) => targetWords.has(word)) ||
      [...targetWords].every((word) => candidateWords.includes(word));
    if (included) best = Math.max(best, 1);
  }
  return best;
}

/** Cherche l'entité Wikidata correspondant à un tableau, et la vérifie. */
async function findEntity(painting) {
  const searches = [
    [painting.title, 'fr'],
    ...(painting.alias?.title ?? []).map((t) => [t, 'fr']),
    [`${painting.title} ${painting.artist}`, 'fr'],
  ];

  const seen = new Set();
  const matches = [];

  for (const [term, language] of searches) {
    const url =
      `${WIKIDATA_API}?action=wbsearchentities&format=json&origin=*` +
      `&language=${language}&uselang=${language}&type=item&limit=15&search=${encodeURIComponent(term)}`;
    const found = await getJson(url);

    for (const hit of found.search ?? []) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);

      const item = await entity(hit.id);
      if (!item) continue;

      const types = claims(item, 'P31').map((v) => v.id);
      if (!types.includes(Q_PAINTING)) continue;

      const [creatorRef] = claims(item, 'P170');
      if (!creatorRef?.id) continue;
      const creator = await entity(creatorRef.id);
      const score = artistScore(label(creator), painting.artist, painting.alias?.artist);
      if (!score) continue;

      const [image] = claims(item, 'P18');
      if (!image) continue;

      matches.push({
        id: hit.id,
        item,
        creatorLabel: label(creator),
        image,
        score,
        // Nombre de Wikipédias liées : le meilleur indicateur disponible pour
        // départager plusieurs versions d'une même œuvre (Le Cri en compte
        // quatre) et retenir celle que tout le monde connaît.
        fame: Object.keys(item.sitelinks ?? {}).length,
      });
    }

    // Le titre exact a répondu : inutile d'élargir aux alias, ce qui
    // multiplierait les requêtes sans rien améliorer.
    if (matches.some((match) => match.score === 2)) break;
  }

  if (!matches.length) return null;
  matches.sort((a, b) => b.score - a.score || b.fame - a.fame);
  return matches[0];
}

/** Licence et crédit de la reproduction, à afficher dans le pied de page. */
async function credits(filename) {
  const url =
    `${COMMONS_API}?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata|url` +
    `&titles=${encodeURIComponent(`File:${filename}`)}`;
  const data = await getJson(url);
  const page = Object.values(data.query?.pages ?? {})[0];
  const meta = page?.imageinfo?.[0]?.extmetadata ?? {};
  const strip = (html) => (html ? String(html).replace(/<[^>]*>/g, '').trim() : '');
  return {
    licence: strip(meta.LicenseShortName?.value) || 'Domaine public',
    credit: strip(meta.Artist?.value) || '',
    page: page?.imageinfo?.[0]?.descriptionurl ?? '',
  };
}

function thumbUrl(filename) {
  return (
    'https://commons.wikimedia.org/wiki/Special:FilePath/' +
    encodeURIComponent(filename.replace(/ /g, '_')) +
    `?width=${WIDTH}`
  );
}

async function download(filename, target) {
  const response = await fetch(thumbUrl(filename), { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`image HTTP ${response.status}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return (await stat(target)).size;
}

// --- Boucle principale ------------------------------------------------------

await mkdir(OUT_DIR, { recursive: true });

const records = [];
const problems = [];
let bytes = 0;

for (const [index, painting] of PAINTINGS.entries()) {
  const position = `${String(index + 1).padStart(3)}/${PAINTINGS.length}`;
  process.stdout.write(`${position} ${painting.title} — ${painting.artist}… `);

  let found;
  try {
    found = await findEntity(painting);
  } catch (error) {
    problems.push(`${painting.id} : recherche impossible (${error.message})`);
    process.stdout.write('ERREUR RÉSEAU\n');
    continue;
  }

  if (!found) {
    problems.push(`${painting.id} : aucune entité Wikidata « tableau de ${painting.artist} » trouvée`);
    process.stdout.write('INTROUVABLE\n');
    continue;
  }

  // Contrôle croisé de la datation : la liste est écrite à la main, Wikidata
  // sert d'arbitre. Un écart n'annule pas l'entrée, mais doit être vu.
  const wikidataYear = inceptionYear(found.item);
  const low = painting.year;
  const high = painting.yearEnd ?? painting.year;
  if (wikidataYear && (wikidataYear < low - 1 || wikidataYear > high + 1)) {
    problems.push(
      `${painting.id} : date à vérifier — liste ${low}${high !== low ? `-${high}` : ''}, ` +
        `Wikidata ${wikidataYear} (${found.id})`,
    );
  }

  const extension = found.image.split('.').pop().toLowerCase();
  const file = `${painting.id}.${extension === 'jpeg' ? 'jpg' : extension}`;

  try {
    bytes += await download(found.image, resolve(OUT_DIR, file));
  } catch (error) {
    problems.push(`${painting.id} : image non téléchargée (${error.message})`);
    process.stdout.write('IMAGE KO\n');
    continue;
  }

  records.push({
    id: painting.id,
    wikidata: found.id,
    file,
    remote: thumbUrl(found.image),
    commonsFile: found.image,
    creator: found.creatorLabel,
    wikidataYear,
    ...(await credits(found.image)),
  });

  process.stdout.write(`ok (${found.id})\n`);
  await sleep(120); // courtoisie envers les serveurs Wikimedia
}

records.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(OUT_JSON, `${JSON.stringify({ width: WIDTH, paintings: records }, null, 2)}\n`);

// Nettoyage des images orphelines (entrée renommée ou retirée de la liste).
const keep = new Set(records.map((r) => r.file));
for (const name of await readdir(OUT_DIR)) {
  if (!keep.has(name)) await unlink(resolve(OUT_DIR, name));
}

const megabytes = (bytes / 1024 / 1024).toFixed(1);
process.stdout.write(
  `\n${records.length}/${PAINTINGS.length} tableaux, ${megabytes} Mo dans data/paintings/\n`,
);
process.stdout.write(`Écrit : ${OUT_JSON}\n`);

if (problems.length) {
  process.stdout.write(`\n${problems.length} point(s) à revoir :\n`);
  for (const problem of problems) process.stdout.write(`  - ${problem}\n`);
  process.stdout.write('\nCorrige src/data/paintings.js puis relance.\n');
}
