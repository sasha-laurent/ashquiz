#!/usr/bin/env node
// Télécharge les contours des États américains et les écrit dans
// data/etats-unis.geojson. Comme pour les départements, le fichier est commité :
// le site n'a alors plus besoin du réseau pour afficher la carte.
//
// Source : Natural Earth 1:50m (domaine public), qui porte le code postal à deux
// lettres de chaque État dans `iso_3166_2` (« US-CA »). Le fichier couvre le
// monde entier : on n'en garde que les 50 États — ni le district de Columbia, ni
// les territoires, qui ne sont pas au programme du quiz — avec le strict
// nécessaire en propriétés.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { boundsOf, countPoints, download, ringsOf, roundCoords, simplifyGeometry } from './geojson.mjs';
import { BY_CODE, STATES } from '../src/data/states.js';

const FILE = 'geojson/ne_50m_admin_1_states_provinces.geojson';
const MIRRORS = [
  `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/${FILE}`,
  `https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/${FILE}`,
];

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'etats-unis.geojson');

// Alaska et Hawaï sont les seuls États dessinés dans un encart, et les seuls
// sans frontière terrestre avec un autre État : ce sont donc aussi les seuls
// qu'on peut alléger sans risquer d'ouvrir un interstice entre deux voisins.
const INSET_CODES = ['AK', 'HI'];

// Hawaï s'étend jusqu'à Midway, à 2 400 km des îles principales : garder la
// chaîne du nord-ouest reviendrait à dessiner un encart d'océan vide. On ne
// retient que ce qui est à l'est de Nihoa.
const HAWAII_MIN_LON = -161;

function stateCode(feature) {
  const p = feature.properties || {};
  const iso = String(p.iso_3166_2 ?? '');
  return iso.startsWith('US-') ? iso.slice(3) : '';
}

/** Ne garde que les polygones dont tous les points sont à l'est de `minLon`. */
function clipWest(geometry, minLon) {
  if (geometry?.type !== 'MultiPolygon') return geometry;
  return {
    ...geometry,
    coordinates: geometry.coordinates.filter(
      (polygon) => boundsOf(polygon).minLon >= minLon,
    ),
  };
}

const geojson = await download(MIRRORS);
if (!Array.isArray(geojson.features) || !geojson.features.length) {
  throw new Error('GeoJSON inattendu : aucune entité trouvée.');
}

const wanted = new Map(STATES.map((state) => [state.code, state]));
const features = [];

for (const feature of geojson.features) {
  const code = stateCode(feature);
  const state = wanted.get(code);
  if (!state || !feature.geometry) continue;

  let geometry = feature.geometry;
  if (code === 'HI') geometry = clipWest(geometry, HAWAII_MIN_LON);
  if (INSET_CODES.includes(code)) {
    const before = countPoints(geometry);
    geometry = simplifyGeometry(geometry);
    process.stdout.write(`  ${code} ${state.name} : ${before} → ${countPoints(geometry)} points\n`);
  }
  if (!ringsOf(geometry).length) continue;

  geometry = { ...geometry, coordinates: roundCoords(geometry.coordinates) };
  features.push({ type: 'Feature', properties: { code, name: state.name }, geometry });
}

features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ type: 'FeatureCollection', features }));

const missing = [...BY_CODE.keys()].filter(
  (code) => !features.some((feature) => feature.properties.code === code),
);
process.stdout.write(`Écrit : ${OUT}\n${features.length} États.\n`);
if (missing.length) {
  process.stdout.write(`Attention : États absents du fond de carte : ${missing.join(', ')}\n`);
}
