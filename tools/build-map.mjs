#!/usr/bin/env node
// Télécharge le GeoJSON des départements et l'écrit dans data/departements.geojson.
// Une fois ce fichier présent (et commité), le site n'a plus besoin du réseau
// pour afficher la carte.
//
// Deux sources sont nécessaires : le fichier simplifié du dépôt france-geojson
// ne couvre que la métropole (96 départements). Les cinq DOM sont repris du
// fichier « avec outre-mer », en pleine précision, puis simplifiés ici.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { countPoints, download, roundCoords, simplifyGeometry } from './geojson.mjs';

const MIRRORS = [
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/',
  'https://france-geojson.gregoiredavid.fr/repo/',
];

const MAINLAND_FILE = 'departements-version-simplifiee.geojson';
const OVERSEAS_FILE = 'departements-avec-outre-mer.geojson';
const OVERSEAS_CODES = ['971', '972', '973', '974', '976'];

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'departements.geojson');

const fetchFile = (file) => download(MIRRORS.map((mirror) => mirror + file));

// --- Assemblage -------------------------------------------------------------

const geojson = await fetchFile(MAINLAND_FILE);
if (!Array.isArray(geojson.features) || !geojson.features.length) {
  throw new Error('GeoJSON inattendu : aucune entité trouvée.');
}

const present = new Set(geojson.features.map((f) => f.properties?.code));
const missing = OVERSEAS_CODES.filter((code) => !present.has(code));

if (missing.length) {
  process.stdout.write(`Outre-mer absent de ${MAINLAND_FILE} : ${missing.join(', ')}\n`);
  const overseas = await fetchFile(OVERSEAS_FILE);
  const wanted = new Set(missing);
  for (const feature of overseas.features || []) {
    const code = feature.properties?.code;
    if (!wanted.has(code)) continue;
    const before = countPoints(feature.geometry);
    // Sans allègement, les cinq DOM — en pleine précision — pèseraient plus
    // lourd que toute la métropole simplifiée, pour un rendu de 170 px de large.
    feature.geometry = simplifyGeometry(feature.geometry);
    const after = countPoints(feature.geometry);
    process.stdout.write(`  ${code} ${feature.properties?.nom} : ${before} → ${after} points\n`);
    geojson.features.push(feature);
  }
}

for (const feature of geojson.features) {
  if (feature.geometry) feature.geometry.coordinates = roundCoords(feature.geometry.coordinates);
}

geojson.features.sort((a, b) =>
  String(a.properties?.code).localeCompare(String(b.properties?.code)),
);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(geojson));

const codes = geojson.features.map((f) => f.properties?.code).filter(Boolean);
const stillMissing = OVERSEAS_CODES.filter((code) => !codes.includes(code));
process.stdout.write(`Écrit : ${OUT}\n${codes.length} départements.\n`);
if (stillMissing.length) {
  process.stdout.write(`Attention : départements toujours absents : ${stillMissing.join(', ')}\n`);
}
