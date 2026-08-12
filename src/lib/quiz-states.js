// Quiz « États américains » : ce que le noyau (src/lib/quiz-core.js) ne peut pas
// deviner — le corpus, les trois sous-réponses et le clic sur la carte. C'est le
// pendant du quiz des départements : un code court à relier à un nom, à une
// capitale et à une place sur la carte.

import { STATES, accepted } from '../data/states.js';
import { QUESTIONS_PER_DAY, createQuiz } from './quiz-core.js';

export { QUESTIONS_PER_DAY };
export { totalScore } from './quiz-core.js';

export const POINTS_PER_QUESTION = 3;

/**
 * Le vivier de leurres du mode carré : d'abord les États dont le code commence
 * par la même lettre, puis, s'il en manque, ceux de la même région.
 *
 * C'est là que sont les confusions qui valent la peine : MI, MN, MO, MS et MT se
 * ressemblent bien plus que MI et FL. Mais dix-huit États sont seuls ou presque
 * sous leur initiale — le Delaware, la Floride, le Kansas… — et un carré à deux
 * cases n'apprend rien : la région (voir src/data/states.js) complète alors le
 * lot par des voisins, faute de voisins de code.
 */
function decoys(state, states) {
  const initial = states.filter((other) => other !== state && other.code[0] === state.code[0]);
  if (initial.length >= 3) return initial;
  const region = states.filter(
    (other) => other !== state && other.region === state.region && !initial.includes(other),
  );
  return [...initial, ...region];
}

export const QUIZ = createQuiz({
  namespace: 'etats-unis',
  items: STATES,
  textFields: ['name', 'capital'],
  accepted,
  choiceFields: { map: (state, given) => given === state.code },
  // Mode carré : comme pour les départements, les trois sous-réponses parlent des
  // mêmes quatre États — répondre, c'est relier un code à un nom, ce nom à sa
  // capitale et à sa place sur la carte.
  choiceItems: (state, { items }) => decoys(state, items),
  choices: {
    name: {},
    capital: {},
    map: { correct: (state) => state.code },
  },
});

/**
 * Série de questions déterministe pour une graine donnée.
 * @param {string} seed  clé du jour (« 2026-08-08 ») ou graine d'entraînement
 * @param {(code: string) => boolean} [isDrawable]  filtre (ex. présence sur la carte)
 */
export const buildSession = QUIZ.buildSession;

/**
 * Corrige les trois sous-réponses d'une question.
 * @param {object} state État attendu
 * @param {{name: string, capital: string, map: string|null}} given
 */
export const grade = QUIZ.grade;

export const maxScore = QUIZ.maxScore;
