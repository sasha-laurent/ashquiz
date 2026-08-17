// Quiz « plantes, fleurs et arbres » : deux sous-réponses, comme les drapeaux —
// la photo tient lieu d'énoncé, il n'y a rien à désigner en plus. Le reste
// (tirage, correction, notation) vient de src/lib/quiz-core.js.

import { FAMILIES, PLANTS, accepted } from '../data/plants.js';
import { QUESTIONS_PER_DAY, createQuiz } from './quiz-core.js';

export { QUESTIONS_PER_DAY };
export { totalScore } from './quiz-core.js';

export const POINTS_PER_QUESTION = 2;

export const QUIZ = createQuiz({
  namespace: 'plantes',
  items: PLANTS,
  textFields: ['name', 'family'],
  accepted,
  // Un nom français n'appartient qu'à son espèce, une famille à toutes les
  // siennes : sans quoi « Rosacées » serait refusé sur la moitié du corpus, au
  // titre d'être la réponse exacte d'une *autre* plante.
  ownerOf: (field, plant) => (field === 'family' ? plant.family : plant.code),
  // Une série qui poserait deux fois la même famille ferait taper deux fois la
  // même réponse : une espèce par famille et par série.
  distinctBy: (plant) => plant.family,
  // Mode carré : les deux sous-réponses ne parlent **pas** des mêmes quatre
  // espèces, contrairement aux drapeaux. Quatre plantes tirées au hasard
  // partagent souvent une famille (le corpus en compte plusieurs par famille) :
  // deux propositions identiques, dont l'une serait fausse. Les familles sont
  // donc tirées dans la liste des familles, où chacune ne figure qu'une fois.
  choices: {
    name: {},
    family: { pool: () => FAMILIES },
  },
});

/**
 * Série de questions déterministe pour une graine donnée.
 * @param {string} seed clé du jour (« 2026-08-08 ») ou graine d'entraînement
 */
export const buildSession = QUIZ.buildSession;

/**
 * Corrige les deux sous-réponses d'une question.
 * @param {object} plant plante attendue
 * @param {{name: string, family: string}} given
 */
export const grade = QUIZ.grade;

export const maxScore = QUIZ.maxScore;
