#!/usr/bin/env node
// Télécharge le GeoJSON des départements et l'écrit dans data/departements.geojson.
// Une fois ce fichier présent (et commité), le site n'a plus besoin du réseau
// pour afficher la carte.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCES = [
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson',
  'https://france-geojson.gregoiredavid.fr/repo/departements-version-simplifiee.geojson',
];

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'departements.geojson');

// ~11 m de précision : largement suffisant pour une carte de 1000 px de large.
const PRECISION = 4;

function roundCoords(node) {
  if (typeof node === 'number') return Number(node.toFixed(PRECISION));
  if (Array.isArray(node)) return node.map(roundCoords);
  return node;
}

async function download() {
  const errors = [];
  for (const url of SOURCES) {
    try {
      process.stdout.write(`Téléchargement : ${url}\n`);
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(`${url} → HTTP ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      errors.push(`${url} → ${error.message}`);
    }
  }
  throw new Error(`Aucune source accessible :\n  ${errors.join('\n  ')}`);
}

const geojson = await download();
if (!Array.isArray(geojson.features) || !geojson.features.length) {
  throw new Error('GeoJSON inattendu : aucune entité trouvée.');
}

for (const feature of geojson.features) {
  if (feature.geometry) feature.geometry.coordinates = roundCoords(feature.geometry.coordinates);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(geojson));

const codes = geojson.features.map((f) => f.properties?.code).filter(Boolean);
process.stdout.write(`Écrit : ${OUT}\n${codes.length} départements.\n`);
