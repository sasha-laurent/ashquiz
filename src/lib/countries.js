// Accès aux drapeaux vendorisés par `npm run build:flags`.
//
// Les données des pays, elles, sont un module JS importé normalement
// (`src/data/countries.js`) : c'est une liste fermée et stable, comme les
// départements, pas un corpus régénéré comme celui des tableaux.

const DIR = 'data/drapeaux';

/**
 * Chemin du drapeau d'un pays, résolu par rapport à la racine du site et non à
 * la page qui l'affiche.
 * @param {string} code code ISO 3166-1 alpha-2 en minuscules
 */
export function flagUrl(code) {
  return new URL(`../../${DIR}/${code}.png`, import.meta.url).href;
}
