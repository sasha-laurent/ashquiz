// Logique du quiz « drapeaux », indépendante du DOM : tirage de la série et
// correction. Même squelette que src/lib/quiz.js, avec deux sous-réponses au
// lieu de trois — le drapeau tient lieu d'énoncé, il n'y a rien à désigner.

import { COUNTRIES, accepted } from '../data/countries.js';
import { makeRng, sample } from './rng.js';
import { check, variants } from './text.js';

// Index « forme canonique → pays qui l'acceptent », pour refuser la tolérance
// aux fautes de frappe à une saisie qui est exactement la réponse d'un *autre*
// pays : « Niger » ne doit pas passer pour le Nigeria, ni « Vienne » pour Vilnius.
const INDEX = { name: new Map(), capital: new Map() };
for (const country of COUNTRIES) {
  for (const field of ['name', 'capital']) {
    for (const answer of accepted(country, field)) {
      for (const variant of variants(answer)) {
        const codes = INDEX[field].get(variant) ?? new Set();
        codes.add(country.code);
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
export const POINTS_PER_QUESTION = 2;

/**
 * Série de questions déterministe pour une graine donnée.
 * @param {string} seed clé du jour (« 2026-08-08 ») ou graine d'entraînement
 */
export function buildSession(seed) {
  const rng = makeRng(`ashquiz:pays:${seed}`);
  return sample(COUNTRIES, QUESTIONS_PER_DAY, rng);
}

/**
 * Corrige les deux sous-réponses d'une question.
 * @param {object} country pays attendu
 * @param {{name: string, capital: string}} given
 */
export function grade(country, given) {
  const nameResult = check(
    given.name ?? '',
    accepted(country, 'name'),
    otherAnswerTest('name', country.code),
  );
  const capitalResult = check(
    given.capital ?? '',
    accepted(country, 'capital'),
    otherAnswerTest('capital', country.code),
  );

  const answer = {
    code: country.code,
    name: {
      given: given.name ?? '',
      ok: nameResult.status !== 'wrong',
      typo: nameResult.status === 'typo',
    },
    capital: {
      given: given.capital ?? '',
      ok: capitalResult.status !== 'wrong',
      typo: capitalResult.status === 'typo',
    },
  };
  answer.score = (answer.name.ok ? 1 : 0) + (answer.capital.ok ? 1 : 0);
  return answer;
}

export function totalScore(answers) {
  return answers.reduce((sum, answer) => sum + answer.score, 0);
}

export function maxScore(count = QUESTIONS_PER_DAY) {
  return count * POINTS_PER_QUESTION;
}
