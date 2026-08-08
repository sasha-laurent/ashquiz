#!/usr/bin/env node
// Construit data/tableaux.json à partir de Wikidata (SPARQL) : titre français,
// peintre, année et image Wikimedia Commons.
//
// Pourquoi partir d'une liste de peintres plutôt que « toutes les peintures » :
// Wikidata en compte plus d'un million, et filtrer ce corpus par notoriété fait
// tomber l'endpoint public en timeout. Interroger peintre par peintre est
// rapide (l'index sur P170 fait le tri), et donne de toute façon ce qu'on veut
// pour un quiz : un canon, pas un tirage au hasard dans un million d'œuvres.
//
// Seules les œuvres ayant une image sur Commons sortent : les peintres du
// XXe siècle encore sous droits n'en ont quasiment pas, le corpus penche donc
// vers l'art ancien. C'est voulu — le site ne sert que des images libres.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const AGENT = 'ashquiz/0.1 (https://github.com/sasha-laurent/ashquiz)';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'tableaux.json');

// Nombre de Wikipédias qui consacrent un article à l'œuvre : le seul indicateur
// de notoriété disponible sans jugement de valeur maison.
const MIN_SITELINKS = 8;
// Plafond par peintre, sinon Van Gogh et Monet écrasent le reste du tirage.
const MAX_PER_PAINTER = 8;
// Au-delà, l'endpoint public répond trop lentement.
const CHUNK_SIZE = 6;

// Le nom retenu est celui de cette table, pas le libellé Wikidata : il sert de
// réponse attendue et doit rester stable. Le libellé Wikidata est ajouté comme
// alias accepté quand il diffère (« Auguste Renoir » / « Pierre-Auguste Renoir »).
const PAINTERS = [
  ['Q762', 'Léonard de Vinci'],
  ['Q5592', 'Michel-Ange'],
  ['Q5597', 'Raphaël'],
  ['Q5669', 'Sandro Botticelli'],
  ['Q47551', 'Titien'],
  ['Q42207', 'Le Caravage'],
  ['Q130531', 'Jérôme Bosch'],
  ['Q43270', "Pieter Brueghel l'Ancien"],
  ['Q102272', 'Jan van Eyck'],
  ['Q5580', 'Albrecht Dürer'],
  ['Q5598', 'Rembrandt'],
  ['Q41264', 'Johannes Vermeer'],
  ['Q297', 'Diego Vélasquez'],
  ['Q5432', 'Francisco de Goya'],
  ['Q5599', 'Pierre Paul Rubens'],
  ['Q41554', 'Nicolas Poussin'],
  ['Q203371', 'Georges de La Tour'],
  ['Q212657', 'Artemisia Gentileschi'],
  ['Q213163', 'Élisabeth Vigée Le Brun'],
  ['Q83155', 'Jacques-Louis David'],
  ['Q33477', 'Eugène Delacroix'],
  ['Q184212', 'Théodore Géricault'],
  ['Q23380', 'Jean-Auguste-Dominique Ingres'],
  ['Q104884', 'Caspar David Friedrich'],
  ['Q159758', 'William Turner'],
  ['Q34618', 'Gustave Courbet'],
  ['Q148458', 'Jean-François Millet'],
  ['Q40599', 'Édouard Manet'],
  ['Q296', 'Claude Monet'],
  ['Q39931', 'Pierre-Auguste Renoir'],
  ['Q46373', 'Edgar Degas'],
  ['Q134741', 'Camille Pissarro'],
  ['Q175130', 'Alfred Sisley'],
  ['Q105320', 'Berthe Morisot'],
  ['Q173223', 'Mary Cassatt'],
  ['Q35548', 'Paul Cézanne'],
  ['Q5582', 'Vincent van Gogh'],
  ['Q37693', 'Paul Gauguin'],
  ['Q34013', 'Georges Seurat'],
  ['Q82445', 'Henri de Toulouse-Lautrec'],
  ['Q156386', 'Henri Rousseau'],
  ['Q34661', 'Gustav Klimt'],
  ['Q41406', 'Edvard Munch'],
  ['Q5589', 'Henri Matisse'],
  ['Q61064', 'Vassily Kandinsky'],
  ['Q151803', 'Piet Mondrian'],
  ['Q93284', 'Marc Chagall'],
  ['Q120993', 'Amedeo Modigliani'],
  ['Q203401', 'Edward Hopper'],
  ['Q5588', 'Frida Kahlo'],
  ['Q5577', 'Salvador Dalí'],
  ['Q7836', 'René Magritte'],
  ['Q5593', 'Pablo Picasso'],
  ['Q5586', 'Katsushika Hokusai'],
];

const query = (qids) => `
SELECT ?item ?titre ?peintre ?peintreLabel ?annee ?naissance ?mort ?image ?links ?collectionLabel WHERE {
  VALUES ?peintre { ${qids.map((id) => `wd:${id}`).join(' ')} }
  OPTIONAL { ?peintre wdt:P569 ?ne . BIND(YEAR(?ne) AS ?naissance) }
  OPTIONAL { ?peintre wdt:P570 ?mo . BIND(YEAR(?mo) AS ?mort) }
  ?item wdt:P170 ?peintre ;
        wdt:P31 wd:Q3305213 ;
        wdt:P18 ?image ;
        wdt:P571 ?date ;
        wikibase:sitelinks ?links .
  FILTER(?links >= ${MIN_SITELINKS})
  BIND(YEAR(?date) AS ?annee)
  ?item rdfs:label ?titre . FILTER(LANG(?titre) = "fr")
  ?peintre rdfs:label ?peintreLabel . FILTER(LANG(?peintreLabel) = "fr")
  OPTIONAL { ?item wdt:P195 ?collection . ?collection rdfs:label ?collectionLabel .
             FILTER(LANG(?collectionLabel) = "fr") }
}`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function ask(sparql, attempt = 1) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  try {
    const response = await fetch(url, { headers: { 'user-agent': AGENT, accept: 'application/sparql-results+json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).results.bindings;
  } catch (error) {
    // L'endpoint public est régulièrement saturé : on réessaie en s'espaçant.
    if (attempt >= 4) throw new Error(`Wikidata inaccessible (${error.message})`);
    const wait = 2 ** attempt * 1000;
    process.stdout.write(`  ${error.message} — nouvelle tentative dans ${wait / 1000} s\n`);
    await sleep(wait);
    return ask(sparql, attempt + 1);
  }
}

/** Vignette Commons : l'original pèse souvent plusieurs dizaines de Mo. */
function thumbnail(imageUrl, width = 1000) {
  const file = decodeURIComponent(imageUrl.split('/Special:FilePath/')[1] ?? '');
  if (!file) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

// --- Collecte ---------------------------------------------------------------

const byPainter = new Map(PAINTERS.map(([qid, name]) => [qid, { name, works: new Map() }]));
const chunks = [];
for (let i = 0; i < PAINTERS.length; i += CHUNK_SIZE) chunks.push(PAINTERS.slice(i, i + CHUNK_SIZE));

for (const [index, chunk] of chunks.entries()) {
  process.stdout.write(
    `Lot ${index + 1}/${chunks.length} : ${chunk.map(([, name]) => name).join(', ')}\n`,
  );
  const rows = await ask(query(chunk.map(([qid]) => qid)));

  for (const row of rows) {
    const painterId = row.peintre.value.split('/').pop();
    const painter = byPainter.get(painterId);
    if (!painter) continue;

    const id = row.item.value.split('/').pop();
    const year = Number(row.annee?.value);
    if (!Number.isFinite(year)) continue;
    const image = thumbnail(row.image.value);
    if (!image) continue;

    // Quelques dates Wikidata sont fautives (« La Danse de la vie » de Munch
    // datée 2000). Une œuvre peinte avant les 10 ans du peintre ou après sa
    // mort est écartée : le siècle est une des réponses attendues, une date
    // fausse rendrait la question incorrigible.
    const born = Number(row.naissance?.value);
    const died = Number(row.mort?.value);
    if (Number.isFinite(born) && year < born + 10) continue;
    if (Number.isFinite(died) && year > died) continue;

    const existing = painter.works.get(id);
    if (existing) {
      // Plusieurs dates (début / fin d'exécution) : on garde la plus ancienne.
      existing.year = Math.min(existing.year, year);
      existing.collection ??= row.collectionLabel?.value;
      continue;
    }
    painter.works.set(id, {
      id,
      title: row.titre.value,
      painter: painter.name,
      painterLabel: row.peintreLabel.value,
      year,
      image,
      collection: row.collectionLabel?.value,
      links: Number(row.links.value),
    });
  }
}

// --- Sélection --------------------------------------------------------------

const paintings = [];
const empty = [];

for (const [, painter] of byPainter) {
  const works = [...painter.works.values()]
    .sort((a, b) => b.links - a.links || a.year - b.year)
    .slice(0, MAX_PER_PAINTER);
  if (!works.length) {
    empty.push(painter.name);
    continue;
  }
  for (const work of works) {
    const entry = {
      id: work.id,
      title: work.title,
      painter: work.painter,
      year: work.year,
      image: work.image,
    };
    if (work.collection) entry.collection = work.collection;
    // Le libellé Wikidata diffère parfois du nom retenu : on l'accepte aussi.
    if (work.painterLabel && work.painterLabel !== work.painter) {
      entry.alias = { painter: [work.painterLabel] };
    }
    paintings.push(entry);
  }
}

paintings.sort((a, b) => a.painter.localeCompare(b.painter, 'fr') || a.year - b.year);

if (!paintings.length) throw new Error('Aucune œuvre récupérée : rien à écrire.');

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  `${JSON.stringify(
    {
      source: 'Wikidata (CC0) — images Wikimedia Commons',
      generatedAt: new Date().toISOString().slice(0, 10),
      paintings,
    },
    null,
    1,
  )}\n`,
);

const painters = new Set(paintings.map((p) => p.painter));
process.stdout.write(`\nÉcrit : ${OUT}\n${paintings.length} œuvres, ${painters.size} peintres.\n`);
if (empty.length) {
  process.stdout.write(
    `Sans image libre sur Commons (souvent : œuvres encore sous droits) : ${empty.join(', ')}\n`,
  );
}
