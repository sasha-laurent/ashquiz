// Briques communes aux scripts qui vendorisent un fond de carte
// (tools/build-map.mjs, tools/build-states.mjs) : téléchargement avec miroirs,
// allègement des géométries (Douglas-Peucker) et arrondi des coordonnées.
//
// Une fois le fichier écrit dans data/ (et commité), le site n'a plus besoin du
// réseau pour afficher la carte.

/**
 * Télécharge la première URL qui répond, les autres servant de miroirs.
 * @param {string[]} urls
 */
export async function download(urls) {
  const errors = [];
  for (const url of urls) {
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

/**
 * Arrondit toutes les coordonnées d'un tableau imbriqué.
 * @param {unknown} node
 * @param {number} [precision]  4 décimales ≈ 11 m : largement suffisant pour une
 *   carte de 1000 px de large.
 */
export function roundCoords(node, precision = 4) {
  if (typeof node === 'number') return Number(node.toFixed(precision));
  if (Array.isArray(node)) return node.map((child) => roundCoords(child, precision));
  return node;
}

// --- Simplification (Douglas-Peucker) --------------------------------------
//
// Deux réserves avant de s'en servir : elle ne s'applique qu'aux géométries sans
// frontière commune (îles, territoires isolés), sinon deux voisins simplifiés
// chacun de leur côté laissent des interstices ; et elle ne vaut la peine que
// pour une géométrie en pleine précision, dessinée petit.

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

export function boundsOf(rings) {
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

/** Anneaux (tableaux de [lon, lat]) d'un Polygon ou MultiPolygon. */
export function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

/**
 * Allège une géométrie avec une tolérance proportionnelle à sa taille : le même
 * budget de détail pour la Guyane (4° de haut) et pour Mayotte (0,3°).
 *
 * @param {object} geometry
 * @param {number} [ratio]  la géométrie est découpée en ~`ratio` pas de
 *   simplification sur sa plus grande dimension. 600 pour un rendu de 170 px de
 *   large, soit ~0,3 px de tolérance.
 */
export function simplifyGeometry(geometry, ratio = 600) {
  if (!geometry) return geometry;
  const rings = ringsOf(geometry);
  if (!rings.length) return geometry;
  const { minLon, maxLon, minLat, maxLat } = boundsOf(rings);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const span = Math.max((maxLon - minLon) * k, maxLat - minLat);
  const tolerance = span / ratio;

  const simplifyRings = (list) =>
    list.map((ring) => simplifyRing(ring, tolerance)).filter((ring) => ring.length >= 4);

  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: simplifyRings(geometry.coordinates) };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(simplifyRings).filter((polygon) => polygon.length),
    };
  }
  return geometry;
}

export function countPoints(geometry) {
  let total = 0;
  const walk = (node) => {
    if (typeof node[0] === 'number') total += 1;
    else node.forEach(walk);
  };
  if (geometry) walk(geometry.coordinates);
  return total;
}
