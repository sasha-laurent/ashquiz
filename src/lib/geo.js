// Chargement du GeoJSON des départements et projection vers des tracés SVG.
//
// La métropole est dessinée d'un bloc ; la petite couronne parisienne et les
// départements d'outre-mer sont repris dans des encarts, sinon ils sont
// impossibles à cliquer (ou hors cadre).

const REMOTE_SOURCES = [
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson',
  'https://france-geojson.gregoiredavid.fr/repo/departements-version-simplifiee.geojson',
];

const LOCAL_SOURCE = 'data/departements.geojson';

/** Récupère le GeoJSON : version vendorée si présente, sinon source distante. */
export async function loadGeojson() {
  const errors = [];
  for (const url of [LOCAL_SOURCE, ...REMOTE_SOURCES]) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(`${url} → HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      if (data && Array.isArray(data.features) && data.features.length) {
        return { data, source: url === LOCAL_SOURCE ? 'local' : 'remote' };
      }
      errors.push(`${url} → GeoJSON inattendu`);
    } catch (error) {
      errors.push(`${url} → ${error.message}`);
    }
  }
  throw new Error(`Impossible de charger la carte.\n${errors.join('\n')}`);
}

function codeOf(feature) {
  const p = feature.properties || {};
  return String(p.code ?? p.INSEE_DEP ?? p.code_insee ?? p.CODE_DEPT ?? '').toUpperCase();
}

/** Anneaux (tableaux de [lon, lat]) d'un Polygon ou MultiPolygon. */
function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

export const VIEW = { width: 1000, height: 660 };

const PETITE_COURONNE = ['75', '92', '93', '94'];

// La métropole tient au centre ; les encarts occupent les deux colonnes
// latérales, Antilles-Guyane à l'ouest et océan Indien à l'est, ce qui évite de
// laisser la moitié du cadre vide.
const METROPOLE_BOX = { x: 170, y: 6, w: 656, h: 648 };
// `pad` : marge intérieure, pour que les côtes ne collent pas au cadre pointillé.
const INSET = { w: 142, h: 186, top: 32, step: 208, left: 6, right: 856, pad: 9 };

const INSETS = [
  { id: '971', label: 'Guadeloupe', codes: ['971'], column: 'left', row: 0 },
  { id: '972', label: 'Martinique', codes: ['972'], column: 'left', row: 1 },
  { id: '973', label: 'Guyane', codes: ['973'], column: 'left', row: 2 },
  { id: 'idf', label: 'Petite couronne', codes: PETITE_COURONNE, column: 'right', row: 0 },
  { id: '974', label: 'La Réunion', codes: ['974'], column: 'right', row: 1 },
  { id: '976', label: 'Mayotte', codes: ['976'], column: 'right', row: 2 },
];

const OVERSEAS_CODES = ['971', '972', '973', '974', '976'];

/**
 * Construit le modèle d'affichage de la carte.
 * @returns {{ groups: Array<{id, label, box, shapes: Array<{code, d}>}> }}
 */
export function buildMapModel(geojson) {
  const byCode = new Map();
  for (const feature of geojson.features) {
    const code = codeOf(feature);
    if (code) byCode.set(code, ringsOf(feature.geometry));
  }

  const overseasCodes = new Set(OVERSEAS_CODES);
  const mainlandCodes = [...byCode.keys()].filter((code) => !overseasCodes.has(code));

  const groups = [makeGroup('metropole', null, mainlandCodes, byCode, METROPOLE_BOX)];

  for (const inset of INSETS) {
    groups.push(
      makeGroup(inset.id, inset.label, inset.codes, byCode, {
        x: inset.column === 'left' ? INSET.left : INSET.right,
        y: INSET.top + inset.row * INSET.step,
        w: INSET.w,
        h: INSET.h,
      }, INSET.pad),
    );
  }

  // Un encart dont aucun code n'est présent dans le GeoJSON est simplement omis.
  return { groups: groups.filter(Boolean), view: VIEW };
}

function makeGroup(id, label, codes, byCode, box, pad = 0) {
  const present = codes.filter((code) => byCode.has(code) && byCode.get(code).length);
  if (!present.length) return null;

  // Le cadre reste `box` ; le tracé, lui, vise l'intérieur.
  const inner = { x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad };

  // Projection équirectangulaire calée sur la latitude moyenne du groupe :
  // suffisant à cette échelle, et sans dépendance externe.
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
