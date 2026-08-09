// Mode de jeu demandé par l'URL.
//
// Une page de quiz démarre sur la série du jour, sauf si on arrive dessus par le
// bouton « Entraînement libre » du menu : `?mode=libre` lance directement une
// série aléatoire qui ne compte pas dans les statistiques.

export const DAILY = 'daily';
export const PRACTICE = 'practice';

const PARAM = 'mode';
const PRACTICE_VALUES = new Set(['libre', 'practice', 'entrainement']);

/** Lien vers l'entraînement libre d'un thème. */
export function practiceUrl(href) {
  return `${href}?${PARAM}=libre`;
}

/**
 * @param {string} [search]  `location.search`
 * @returns {'daily' | 'practice'}
 */
export function requestedMode(search = '') {
  const value = new URLSearchParams(search).get(PARAM);
  return value && PRACTICE_VALUES.has(value.toLowerCase()) ? PRACTICE : DAILY;
}
