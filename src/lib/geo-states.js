// Fond de carte des États américains : où trouver le GeoJSON, et comment
// découper le cadre. Le reste (chargement, projection, tracés) vit dans
// src/lib/geo-model.js.
//
// Les 48 États contigus sont dessinés d'un bloc, en haut du cadre — ils forment
// un rectangle deux fois plus large que haut, qui laisse la bande du bas libre.
// S'y logent les encarts : l'Alaska et Hawaï, hors cadre autrement, et deux
// zooms sur le nord-est, où le Rhode Island fait huit pixels de large et le
// Delaware dix. Comme Paris sur la carte des départements, ces États-là figurent
// deux fois : dans le bloc principal et dans leur encart, l'un et l'autre
// cliquables.

import { indexRings, loadGeojson as load, makeGroup } from './geo-model.js';

const SOURCES = {
  local: 'data/etats-unis.geojson',
  // À défaut du fichier vendorisé (`npm run build:states`), la source d'origine :
  // le monde entier, dont on ne retiendra que les États américains.
  remote: [
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson',
    'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_1_states_provinces.geojson',
  ],
};

/** Récupère le GeoJSON : version vendorée si présente, sinon source distante. */
export const loadGeojson = () => load(SOURCES);

/**
 * Le code à deux lettres d'une entité : celui écrit par `npm run build:states`,
 * ou `iso_3166_2` (« US-CA ») sur le fichier Natural Earth d'origine. Une entité
 * qui n'est pas un État américain — province canadienne, État brésilien — n'a
 * pas de code ici, et sort donc de la carte.
 */
function codeOf(feature) {
  const p = feature.properties || {};
  if (p.code) return String(p.code).toUpperCase();
  const iso = String(p.iso_3166_2 ?? '');
  return iso.startsWith('US-') ? iso.slice(3).toUpperCase() : '';
}

export const VIEW = { width: 1000, height: 640 };

// Les 48 contigus occupent la largeur ; les encarts se partagent la bande du bas
// et la colonne de droite, restée libre sous le Maine.
const MAINLAND_BOX = { x: 4, y: 4, w: 752, h: 420 };
const PAD = 9;

const INSETS = [
  { id: 'AK', label: 'Alaska', codes: ['AK'], box: { x: 30, y: 452, w: 300, h: 182 } },
  { id: 'HI', label: 'Hawaï', codes: ['HI'], box: { x: 360, y: 462, w: 240, h: 172 } },
  {
    id: 'nouvelle-angleterre',
    label: 'Nouvelle-Angleterre',
    codes: ['CT', 'MA', 'ME', 'NH', 'RI', 'VT'],
    box: { x: 762, y: 34, w: 234, h: 300 },
  },
  {
    id: 'atlantique',
    label: 'Delaware, Maryland, New Jersey',
    codes: ['DE', 'MD', 'NJ'],
    box: { x: 762, y: 374, w: 234, h: 172 },
  },
];

// Les deux États dessinés uniquement en encart : sur le bloc principal, ils
// tireraient le cadre jusqu'au Pacifique.
const REMOTE_CODES = ['AK', 'HI'];

/**
 * Construit le modèle d'affichage de la carte.
 * @returns {{ groups: Array<{id, label, box, shapes: Array<{code, d}>}> }}
 */
export function buildMapModel(geojson) {
  const byCode = indexRings(geojson, codeOf);

  const remote = new Set(REMOTE_CODES);
  const mainlandCodes = [...byCode.keys()].filter((code) => !remote.has(code));

  const groups = [makeGroup('contigus', null, mainlandCodes, byCode, MAINLAND_BOX)];

  for (const inset of INSETS) {
    groups.push(makeGroup(inset.id, inset.label, inset.codes, byCode, inset.box, PAD));
  }

  // Un encart dont aucun code n'est présent dans le GeoJSON est simplement omis.
  return { groups: groups.filter(Boolean), view: VIEW };
}
