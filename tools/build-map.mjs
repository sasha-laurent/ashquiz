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

const MIRRORS = [
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/',
  'https://france-geojson.gregoiredavid.fr/repo/',
];

const MAINLAND_FILE = 'departements-version-simplifiee.geojson';
const OVERSEAS_FILE = 'departements-avec-outre-mer.geojson';
const OVERSEAS_CODES = ['971', '972', '973', '974', '976'];

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'departements.geojson');

// ~11 m de précision : largement suffisant pour une carte de 1000 px de large.
const PRECISION = 4;

function roundCoords(node) {
  if (typeof node === 'number') return Number(node.toFixed(PRECISION));
  if (Array.isArray(node)) return node.map(roundCoords);
  return node;
}

async function download(file) {
  const errors = [];
  for (const mirror of MIRRORS) {
    const url = mirror + file;
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
  throw new Error(`Aucune source accessible pour ${file} :\n  ${errors.join('\n  ')}`);
}

// --- Simplification (Douglas-Peucker) --------------------------------------
// Le fichier « avec outre-mer » est en pleine précision : sans allègement, les
// cinq DOM pèseraient plus lourd que toute la métropole simplifiée, pour un
// rendu final de 170 px de large.

function segmentDistance(point, start, end) {
  // Distances en degrés, avec correction de longitude : suffisant à cette
  // échelle et sans dépendance externe.
  const k = Math.cos((point[1] * Math.PI) / 180);
  const px = point[0] * k;
  const ax = start[0] * k;
  const bx = end[0] * k;
  const dx = bx - ax;
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, point[1] - start[1]);
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(px - (ax + t * dx), point[1] - (start[1] + t * dy));
}

function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let index = -1;
    let best = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const distance = segmentDistance(ring[i], ring[first], ring[last]);
      if (distance > best) {
        best = distance;
        index = i;
      }
    }
    if (index === -1) continue;
    keep[index] = 1;
    stack.push([first, index], [index, last]);
  }
  return ring.filter((_, i) => keep[i]);
}

function boundsOf(rings) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Allège une géométrie avec une tolérance proportionnelle à sa taille : le même
 * budget de détail pour la Guyane (4° de haut) et pour Mayotte (0,3°).
 */
function simplifyGeometry(geometry) {
  if (!geometry) return geometry;
  const rings =
    geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  if (!rings.length) return geometry;
  const { minLon, maxLon, minLat, maxLat } = boundsOf(rings);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const span = Math.max((maxLon - minLon) * k, maxLat - minLat);
  const tolerance = span / 600; // ~0,3 px sur un encart de 170 px.

  const simplifyRings = (list) =>
    list.map((ring) => simplifyRing(ring, tolerance)).filter((ring) => ring.length >= 4);

  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: simplifyRings(geometry.coordinates) };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates
        .map(simplifyRings)
        .filter((polygon) => polygon.length),
    };
  }
  return geometry;
}

function countPoints(geometry) {
  let total = 0;
  const walk = (node) => {
    if (typeof node[0] === 'number') total += 1;
    else node.forEach(walk);
  };
  if (geometry) walk(geometry.coordinates);
  return total;
}

// --- Assemblage -------------------------------------------------------------

const geojson = await download(MAINLAND_FILE);
if (!Array.isArray(geojson.features) || !geojson.features.length) {
  throw new Error('GeoJSON inattendu : aucune entité trouvée.');
}

const present = new Set(geojson.features.map((f) => f.properties?.code));
const missing = OVERSEAS_CODES.filter((code) => !present.has(code));

if (missing.length) {
  process.stdout.write(`Outre-mer absent de ${MAINLAND_FILE} : ${missing.join(', ')}\n`);
  const overseas = await download(OVERSEAS_FILE);
  const wanted = new Set(missing);
  for (const feature of overseas.features || []) {
    const code = feature.properties?.code;
    if (!wanted.has(code)) continue;
    const before = countPoints(feature.geometry);
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
