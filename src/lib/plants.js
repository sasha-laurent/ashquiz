// Accès aux photos vendorisées par `npm run build:plants`, et à leurs crédits.
//
// Les espèces, elles, sont un module JS importé normalement
// (`src/data/plants.js`) : une liste tenue à la main, comme les pays et les
// départements. Seuls les crédits des photos sont un fichier produit par
// l'outil, donc chargé à l'exécution — ils changent avec les images, pas avec le
// corpus.

const DIR = 'data/plantes';

/** Résout un fichier de `data/plantes/` par rapport à la racine du site. */
const fileUrl = (name) => new URL(`../../${DIR}/${name}`, import.meta.url).href;

/**
 * Chemin de la photo d'une plante.
 * @param {string} code identifiant de l'espèce (`p075`)
 */
export function plantUrl(code) {
  return fileUrl(`${code}.jpg`);
}

/**
 * Auteur et licence de chaque photo, par code d'espèce.
 *
 * Les photographies de Commons ne sont ni des drapeaux ni des tableaux tombés
 * dans le domaine public : elles sont sous licence libre **avec attribution**.
 * Le crédit s'affiche donc sous la photo à la correction, et son absence est une
 * erreur de chargement, pas un détail — d'où l'exception plutôt qu'un repli
 * silencieux.
 */
export async function loadCredits() {
  const file = `${DIR}/credits.json`;
  const response = await fetch(fileUrl('credits.json'));
  if (!response.ok) throw new Error(`${file} : HTTP ${response.status}`);
  const data = await response.json();
  if (!data?.photos || !Object.keys(data.photos).length) {
    throw new Error(`${file} : aucun crédit dans le fichier.`);
  }
  return { photos: data.photos, source: data.source };
}

/** « Photo : Marie Dupont — CC BY-SA 4.0 », ou rien si la photo n'a pas de crédit. */
export function creditLabel(credit) {
  if (!credit) return '';
  return `Photo : ${credit.author} — ${credit.license}`;
}
