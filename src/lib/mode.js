// Mode de jeu : ce qui est demandé par l'URL, et ce qui est réglé sur
// l'appareil.
//
// Une page de quiz démarre sur la série du jour, sauf si on arrive dessus par le
// bouton « Entraînement libre » du menu : `?mode=libre` lance directement une
// série aléatoire qui ne compte pas dans les statistiques.
//
// Le mode carré (quatre propositions par sous-réponse) est, lui, une préférence
// d'appareil valable pour tous les thèmes : on le règle une fois, il vaut pour
// le quiz du jour comme pour l'entraînement.

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

// Réglage volontairement à part de la progression (`src/lib/storage.js`) : c'est
// une préférence d'affichage, commune aux thèmes, et non un résultat à
// conserver ni à synchroniser un jour.
const CARRE_KEY = 'ashquiz.carre';

/** Le mode carré est-il activé sur cet appareil ? */
export function carreEnabled() {
  try {
    return localStorage.getItem(CARRE_KEY) === '1';
  } catch {
    // Mode privé ou stockage refusé : on joue en saisie libre.
    return false;
  }
}

export function setCarreEnabled(on) {
  try {
    if (on) localStorage.setItem(CARRE_KEY, '1');
    else localStorage.removeItem(CARRE_KEY);
  } catch {
    /* le réglage ne survivra pas au rechargement, tant pis */
  }
}
