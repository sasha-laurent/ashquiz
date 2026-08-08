// Quiz « drapeaux » : deux sous-réponses au lieu de trois — le drapeau tient
// lieu d'énoncé, il n'y a rien à désigner en plus. Le reste (tirage, correction,
// notation) vient de src/lib/quiz-core.js.

import { COUNTRIES, accepted } from '../data/countries.js';
import { QUESTIONS_PER_DAY, createQuiz } from './quiz-core.js';

export { QUESTIONS_PER_DAY };
export { totalScore } from './quiz-core.js';

export const POINTS_PER_QUESTION = 2;

export const QUIZ = createQuiz({
  namespace: 'pays',
  items: COUNTRIES,
  textFields: ['name', 'capital'],
  accepted,
});

/**
 * Série de questions déterministe pour une graine donnée.
 * @param {string} seed clé du jour (« 2026-08-08 ») ou graine d'entraînement
 */
export const buildSession = QUIZ.buildSession;

/**
 * Corrige les deux sous-réponses d'une question.
 * @param {object} country pays attendu
 * @param {{name: string, capital: string}} given
 */
export const grade = QUIZ.grade;

export const maxScore = QUIZ.maxScore;
