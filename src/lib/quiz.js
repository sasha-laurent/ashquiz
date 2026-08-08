// Logique de jeu, indépendante du DOM : tirage de la série et correction.

import { DEPARTMENTS, accepted } from '../data/departments.js';
import { makeRng, sample } from './rng.js';
import { check, variants } from './text.js';

// Index « forme canonique → départements qui l'acceptent », pour repérer les
// réponses qui désignent exactement un autre département.
const INDEX = { name: new Map(), prefecture: new Map() };
for (const dep of DEPARTMENTS) {
  for (const field of ['name', 'prefecture']) {
    for (const answer of accepted(dep, field)) {
      for (const variant of variants(answer)) {
        const codes = INDEX[field].get(variant) ?? new Set();
        codes.add(dep.code);
        INDEX[field].set(variant, codes);
      }
    }
  }
}

const otherAnswerTest = (field, code) => (variant) => {
  const codes = INDEX[field].get(variant);
  return Boolean(codes) && !codes.has(code);
};

export const QUESTIONS_PER_DAY = 5;
export const POINTS_PER_QUESTION = 3;

/**
 * Série de questions déterministe pour une graine donnée.
 * @param {string} seed  clé du jour (« 2026-08-08 ») ou graine d'entraînement
 * @param {(code: string) => boolean} [isDrawable]  filtre (ex. présence sur la carte)
 */
export function buildSession(seed, isDrawable = () => true) {
  const pool = DEPARTMENTS.filter((dep) => isDrawable(dep.code));
  const rng = makeRng(`quotiquiz:${seed}`);
  return sample(pool, QUESTIONS_PER_DAY, rng);
}

/**
 * Corrige les trois sous-réponses d'une question.
 * @param {object} dep département attendu
 * @param {{name: string, prefecture: string, map: string|null}} given
 */
export function grade(dep, given) {
  const nameResult = check(given.name ?? '', accepted(dep, 'name'), otherAnswerTest('name', dep.code));
  const prefResult = check(
    given.prefecture ?? '',
    accepted(dep, 'prefecture'),
    otherAnswerTest('prefecture', dep.code),
  );
  const mapOk = given.map === dep.code;

  const answer = {
    code: dep.code,
    name: { given: given.name ?? '', ok: nameResult.status !== 'wrong', typo: nameResult.status === 'typo' },
    prefecture: {
      given: given.prefecture ?? '',
      ok: prefResult.status !== 'wrong',
      typo: prefResult.status === 'typo',
    },
    map: { given: given.map ?? null, ok: mapOk },
  };
  answer.score = (answer.name.ok ? 1 : 0) + (answer.prefecture.ok ? 1 : 0) + (mapOk ? 1 : 0);
  return answer;
}

export function totalScore(answers) {
  return answers.reduce((sum, answer) => sum + answer.score, 0);
}

export function maxScore(count = QUESTIONS_PER_DAY) {
  return count * POINTS_PER_QUESTION;
}
