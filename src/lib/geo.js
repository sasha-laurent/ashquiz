// Fond de carte des départements : où trouver le GeoJSON, et comment découper le
// cadre. Le reste (chargement, projection, tracés) vit dans src/lib/geo-model.js.
//
// La métropole est dessinée d'un bloc ; la petite couronne parisienne et les
// départements d'outre-mer sont repris dans des encarts, sinon ils sont
// impossibles à cliquer (ou hors cadre).

import { indexRings, loadGeojson as load, makeGroup } from './geo-model.js';

const SOURCES = {
  local: 'data/departements.geojson',
  remote: [
    'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson',
    'https://france-geojson.gregoiredavid.fr/repo/departements-version-simplifiee.geojson',
  ],
};

/** Récupère le GeoJSON : version vendorée si présente, sinon source distante. */
export const loadGeojson = () => load(SOURCES);

function codeOf(feature) {
  const p = feature.properties || {};
  return String(p.code ?? p.INSEE_DEP ?? p.code_insee ?? p.CODE_DEPT ?? '').toUpperCase();
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
  const byCode = indexRings(geojson, codeOf);

  const overseasCodes = new Set(OVERSEAS_CODES);
  const mainlandCodes = [...byCode.keys()].filter((code) => !overseasCodes.has(code));

  const groups = [makeGroup('metropole', null, mainlandCodes, byCode, METROPOLE_BOX)];

  for (const inset of INSETS) {
    groups.push(
      makeGroup(
        inset.id,
        inset.label,
        inset.codes,
        byCode,
        {
          x: inset.column === 'left' ? INSET.left : INSET.right,
          y: INSET.top + inset.row * INSET.step,
          w: INSET.w,
          h: INSET.h,
        },
        INSET.pad,
      ),
    );
  }

  // Un encart dont aucun code n'est présent dans le GeoJSON est simplement omis.
  return { groups: groups.filter(Boolean), view: VIEW };
}
