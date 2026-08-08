#!/usr/bin/env node
// Écrit data/drapeaux/<code>.png : un rendu PNG du drapeau de chaque pays de
// src/data/countries.js, téléchargé depuis Wikimedia Commons.
//
// Pourquoi vendoriser plutôt que pointer sur Commons à l'exécution, comme le
// fait le thème « tableaux » : l'URL Commons contient le nom du fichier, donc la
// réponse (« Flag of France.svg » dans l'onglet réseau). Un fichier local nommé
// par le code ISO ne la donne pas, et le site n'a plus besoin du réseau.
//
// Pourquoi un PNG plutôt que le SVG d'origine : les drapeaux à emblème détaillé
// pèsent très lourd en vectoriel (280 ko pour l'Équateur, 156 ko pour l'Espagne)
// alors qu'un rendu de 480 px de large en fait 15 ko. Sur les drapeaux
// géométriques, l'écart est inverse mais négligeable.
//
// Le fichier déjà présent n'est pas retéléchargé : après un échec réseau, on
// relance la commande et seuls les manquants sont repris. `--force` reprend tout
// (par exemple après un changement de drapeau).

import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTRIES } from '../src/data/countries.js';

const AGENT = 'ashquiz/0.1 (https://github.com/sasha-laurent/ashquiz)';
// Assez large pour rester net sur un écran à haute densité, assez petit pour que
// les 193 drapeaux tiennent dans le dépôt.
const WIDTH = 480;
// Commons n'aime pas les rafales : une requête à la fois, espacée.
const PAUSE_MS = 120;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'data', 'drapeaux');

const force = process.argv.includes('--force');

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const fileUrl = (commons) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons)}?width=${WIDTH}`;

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function download(commons, attempt = 1) {
  try {
    const response = await fetch(fileUrl(commons), { headers: { 'user-agent': AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    // Commons renvoie une page d'erreur en HTML plutôt qu'un 404 dans certains
    // cas : sans ce contrôle, on écrirait du HTML dans un .png.
    if (buffer.length < 100 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error('la réponse n’est pas un PNG');
    }
    return buffer;
  } catch (error) {
    if (attempt >= 3) throw error;
    await sleep(2 ** attempt * 1000);
    return download(commons, attempt + 1);
  }
}

await mkdir(OUT_DIR, { recursive: true });

let written = 0;
let kept = 0;
const failed = [];

for (const [index, country] of COUNTRIES.entries()) {
  const path = resolve(OUT_DIR, `${country.code}.png`);
  if (!force && (await exists(path))) {
    kept += 1;
    continue;
  }
  process.stdout.write(`${index + 1}/${COUNTRIES.length} ${country.name}… `);
  try {
    const buffer = await download(country.commons);
    await writeFile(path, buffer);
    written += 1;
    process.stdout.write(`${Math.round(buffer.length / 1024)} ko\n`);
  } catch (error) {
    failed.push(`${country.name} (${country.commons}) : ${error.message}`);
    process.stdout.write(`échec — ${error.message}\n`);
  }
  await sleep(PAUSE_MS);
}

// Un pays retiré de la liste laisserait sinon son drapeau derrière lui.
const expected = new Set(COUNTRIES.map((country) => `${country.code}.png`));
for (const name of await readdir(OUT_DIR)) {
  if (expected.has(name)) continue;
  await unlink(resolve(OUT_DIR, name));
  process.stdout.write(`Supprimé (plus dans la liste) : ${name}\n`);
}

process.stdout.write(`\nÉcrit : ${OUT_DIR}\n${written} drapeau(x) téléchargé(s), ${kept} déjà présent(s).\n`);
if (failed.length) {
  process.stdout.write(`\n${failed.length} échec(s) — relancer la commande les reprendra :\n`);
  for (const line of failed) process.stdout.write(`  ${line}\n`);
  process.exitCode = 1;
}
