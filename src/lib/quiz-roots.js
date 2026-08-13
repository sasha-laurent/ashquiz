// Quiz « racines grecques et latines » : ce que le noyau (src/lib/quiz-core.js)
// ne peut pas deviner — le corpus, le sens à taper et l'origine à cocher.
//
// Deux sous-réponses seulement, comme les drapeaux : la racine tient lieu
// d'énoncé, il n'y a rien à désigner en plus. L'origine ne se joue **pas** au
// carré : entre deux valeurs, quatre propositions n'auraient pas de sens — elle
// est déjà, par nature, une question à deux cases.

import { ROOTS, accepted } from '../data/roots.js';
import { QUESTIONS_PER_DAY, createQuiz } from './quiz-core.js';

export { QUESTIONS_PER_DAY };
export { totalScore } from './quiz-core.js';

export const POINTS_PER_QUESTION = 2;

/**
 * Le vivier de leurres du mode carré : les racines du même champ sémantique,
 * puis, s'il en manque, le reste du corpus.
 *
 * C'est là que sont les confusions qui valent la peine. « poly- » se choisit
 * entre *plusieurs*, *tout*, *demi* et *un seul* — quatre façons de dire une
 * quantité, donc une vraie question. Entre *plusieurs*, *pierre*, *cheval* et
 * *écrire*, il n'y aurait qu'un tri par thème, et la bonne case sauterait aux
 * yeux sans rien apprendre.
 */
function decoys(root, roots) {
  const family = roots.filter((other) => other !== root && other.famille === root.famille);
  if (family.length >= 3) return family;
  return [...family, ...roots.filter((other) => other !== root && !family.includes(other))];
}

export const QUIZ = createQuiz({
  namespace: 'racines',
  items: ROOTS,
  textFields: ['sens'],
  accepted,
  choiceFields: { origine: (root, given) => given === root.origine },
  // Deux racines de même sens (hydro-/aqua-, poly-/multi-) sont le cœur du
  // thème, mais les tirer le même jour ferait taper deux fois la même réponse :
  // une seule par série.
  distinctBy: (root) => root.sens,
  choices: {
    sens: { pool: (root, { items }) => decoys(root, items).map((other) => other.sens) },
  },
});

/**
 * Série de questions déterministe pour une graine donnée.
 * @param {string} seed  clé du jour (« 2026-08-08 ») ou graine d'entraînement
 */
export const buildSession = QUIZ.buildSession;

/**
 * Corrige les deux sous-réponses d'une question.
 * @param {object} root  racine attendue
 * @param {{sens: string, origine: string|null}} given
 */
export const grade = QUIZ.grade;

export const maxScore = QUIZ.maxScore;
