// Ce que les fonds de carte ont en commun : charger le GeoJSON, puis projeter
// des groupes de zones vers des tracés SVG.
//
// Un thème cartographique (src/lib/geo.js pour les départements,
// src/lib/geo-states.js pour les États américains) n'a plus alors qu'à dire où
// il prend le code d'une zone, et comment il découpe son cadre : un grand bloc
// pour le territoire principal, des encarts pour ce qui serait sinon hors cadre
// ou trop petit pour être cliqué.

/**
 * Récupère le GeoJSON : version vendorée si présente, sinon source distante.
 * @param {{local: string, remote?: string[]}} sources
 * @returns {Promise<{data: object, source: 'local'|'remote'}>}
 */
export async function loadGeojson({ local, remote = [] }) {
  const errors = [];
  for (const url of [local, ...remote]) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(`${url} → HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      if (data && Array.isArray(data.features) && data.features.length) {
        return { data, source: url === local ? 'local' : 'remote' };
      }
      errors.push(`${url} → GeoJSON inattendu`);
    } catch (error) {
      errors.push(`${url} → ${error.message}`);
    }
  }
  throw new Error(`Impossible de charger la carte.\n${errors.join('\n')}`);
}

/** Anneaux (tableaux de [lon, lat]) d'un Polygon ou MultiPolygon. */
export function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

/**
 * Index « code de zone → anneaux », en écartant ce que le thème ne reconnaît pas.
 * @param {object} geojson
 * @param {(feature: object) => string} codeOf
 */
export function indexRings(geojson, codeOf) {
  const byCode = new Map();
  for (const feature of geojson.features) {
    const code = codeOf(feature);
    if (code) byCode.set(code, ringsOf(feature.geometry));
  }
  return byCode;
}

/**
 * Projette un groupe de zones dans son cadre.
 *
 * La projection est équirectangulaire, calée sur la latitude moyenne du groupe :
 * suffisant à cette échelle, et sans dépendance externe. Chaque groupe a la
 * sienne — un encart zoome donc sur son contenu.
 *
 * @param {string} id
 * @param {string|null} label  le titre de l'encart ; `null` pour le bloc principal
 * @param {string[]} codes  les zones du groupe, dans l'ordre de dessin
 * @param {Map<string, number[][][]>} byCode
 * @param {{x: number, y: number, w: number, h: number}} box
 * @param {number} [pad]  marge intérieure, pour que les côtes ne collent pas au
 *   cadre pointillé de l'encart
 * @returns {{id, label, box, shapes: Array<{code, d}>}|null}  `null` si aucune
 *   zone du groupe n'est présente dans le GeoJSON
 */
export function makeGroup(id, label, codes, byCode, box, pad = 0) {
  const present = codes.filter((code) => byCode.has(code) && byCode.get(code).length);
  if (!present.length) return null;

  // Le cadre reste `box` ; le tracé, lui, vise l'intérieur.
  const inner = { x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad };

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const code of present) {
    for (const ring of byCode.get(code)) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * k || 1e-6;
  const spanY = maxLat - minLat || 1e-6;
  const scale = Math.min(inner.w / spanX, inner.h / spanY);
  const offsetX = inner.x + (inner.w - spanX * scale) / 2;
  const offsetY = inner.y + (inner.h - spanY * scale) / 2;

  const project = ([lon, lat]) => [
    offsetX + (lon - minLon) * k * scale,
    offsetY + (maxLat - lat) * scale,
  ];

  const shapes = present.map((code) => ({
    code,
    d: byCode
      .get(code)
      .map((ring) => ringToPath(ring, project))
      .filter(Boolean)
      .join(' '),
  }));

  return { id, label, box, shapes };
}

function ringToPath(ring, project) {
  if (ring.length < 3) return '';
  let path = '';
  let previous = null;
  for (const point of ring) {
    const [x, y] = project(point);
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    // On saute les points qui retombent au même endroit après projection.
    if (previous && previous[0] === rx && previous[1] === ry) continue;
    path += `${path ? 'L' : 'M'}${rx} ${ry}`;
    previous = [rx, ry];
  }
  return path ? `${path}Z` : '';
}
