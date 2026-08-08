// Mode « carré » : quatre propositions par sous-réponse, une seule juste.
//
// Le noyau (src/lib/quiz-core.js) sait mélanger une bonne réponse avec des
// leurres ; ce qui change d'un thème à l'autre, c'est le vivier où les prendre.
// Un département se cache derrière ses voisins de numéro (donc, à peu de chose
// près, ses voisins alphabétiques) ; un pays derrière trois capitales au hasard.
//
// Le tirage reste déterministe : la graine du jour donne toujours les mêmes
// propositions, comme elle donne toujours les mêmes questions.

import { sample } from './rng.js';
import { normalize } from './text.js';

export const CHOICES_PER_QUESTION = 4;

/** Deux propositions qui se lisent pareil n'en font qu'une. */
const defaultKey = (value) => normalize(String(value));

/**
 * La bonne réponse plus des leurres tirés d'un vivier, le tout mélangé.
 *
 * @param {object} spec
 * @param {unknown} spec.correct  la bonne réponse
 * @param {unknown[]} spec.pool  vivier de leurres ; il peut contenir la bonne
 *   réponse et des doublons, ils sont écartés
 * @param {() => number} spec.rng
 * @param {(value: unknown) => string} [spec.keyOf]  ce qui rend deux
 *   propositions identiques aux yeux du joueur
 * @param {number} [spec.count]  propositions attendues, bonne réponse comprise
 * @returns {unknown[]}  au plus `count` propositions, dans un ordre imprévisible
 */
export function pickChoices({
  correct,
  pool,
  rng,
  keyOf = defaultKey,
  count = CHOICES_PER_QUESTION,
}) {
  const seen = new Set([keyOf(correct)]);
  const decoys = [];
  for (const value of pool) {
    const key = keyOf(value);
    if (seen.has(key)) continue;
    seen.add(key);
    decoys.push(value);
  }

  const drawn = [correct, ...sample(decoys, count - 1, rng)];
  return sample(drawn, drawn.length, rng);
}

/**
 * Les voisins d'un item dans sa liste, à `span` places près.
 *
 * Les départements étant rangés par numéro — et le numéro suivant l'ordre
 * alphabétique des noms — c'est ce qui donne les leurres les plus instructifs :
 * pour le 45 (Loiret), on propose le Loir-et-Cher et la Loire-Atlantique.
 */
export function neighbours(items, index, span = 3) {
  if (index < 0) return [];
  const out = [];
  const last = Math.min(items.length - 1, index + span);
  for (let i = Math.max(0, index - span); i <= last; i++) {
    if (i !== index) out.push(items[i]);
  }
  return out;
}
