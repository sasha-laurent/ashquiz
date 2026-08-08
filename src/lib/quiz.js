// Quiz « départements » : ce que le noyau (src/lib/quiz-core.js) ne peut pas
// deviner — le corpus, les trois sous-réponses et le clic sur la carte.

import { DEPARTMENTS, accepted } from '../data/departments.js';
import { QUESTIONS_PER_DAY, createQuiz } from './quiz-core.js';

export { QUESTIONS_PER_DAY };
export { totalScore } from './quiz-core.js';

export const POINTS_PER_QUESTION = 3;

export const QUIZ = createQuiz({
  items: DEPARTMENTS,
  textFields: ['name', 'prefecture'],
  accepted,
  choiceFields: { map: (dep, given) => given === dep.code },
});

/**
 * Série de questions déterministe pour une graine donnée.
 * @param {string} seed  clé du jour (« 2026-08-08 ») ou graine d'entraînement
 * @param {(code: string) => boolean} [isDrawable]  filtre (ex. présence sur la carte)
 */
export const buildSession = QUIZ.buildSession;

/**
 * Corrige les trois sous-réponses d'une question.
 * @param {object} dep département attendu
 * @param {{name: string, prefecture: string, map: string|null}} given
 */
export const grade = QUIZ.grade;

export const maxScore = QUIZ.maxScore;
