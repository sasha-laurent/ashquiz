// Quiz « tableaux ». Ce qui lui est propre par rapport au noyau
// (src/lib/quiz-core.js) : les formes courtes d'un nom de peintre, le siècle
// déduit de l'année, et une série qui évite deux fois le même peintre.
//
// Le corpus étant chargé à l'exécution (et non importé comme les départements),
// tout passe par une fabrique : `createPaintingQuiz(paintings)`. C'est aussi ce
// qui rend le module testable avec une poignée d'œuvres factices.

import { century } from './paintings.js';
import { QUESTIONS_PER_DAY, createQuiz } from './quiz-core.js';
import { normalize } from './text.js';

export { QUESTIONS_PER_DAY };
export { totalScore } from './quiz-core.js';

export const POINTS_PER_QUESTION = 3;

// Mots qui ne désignent personne à eux seuls : les particules qui précèdent un
// nom (« van » Gogh, « de La » Tour) et les qualificatifs qui le suivent
// (Brueghel « l'Ancien »).
const PARTICLES = new Set(
  'de du des da di del della dos van von der den ten ter le la les l y af of the'.split(' '),
);
const QUALIFIERS = new Set(['l ancien', 'le jeune', 'l aine', 'ancien', 'jeune', 'aine', 'dit']);

const isParticle = (word) => PARTICLES.has(normalize(word));
const isQualifier = (word) => QUALIFIERS.has(normalize(word));

/**
 * Formes courtes d'un nom de peintre : tout ce qui suit le prénom.
 * « Claude Monet » → « Monet », « Vincent van Gogh » → « van Gogh », « Gogh »,
 * « Pieter Brueghel l'Ancien » → « Brueghel l'Ancien », « Brueghel ».
 * Un nom d'un seul mot (« Rembrandt », « Titien ») n'en produit aucune.
 */
export function shortNames(painter) {
  const words = String(painter).trim().split(/\s+/).filter(Boolean);
  // Le nom de famille seul, c'est aussi le nom sans son qualificatif final.
  const core = [...words];
  while (core.length > 1 && isQualifier(core.at(-1))) core.pop();

  const out = new Set();
  for (const list of [words, core]) {
    for (let i = 1; i < list.length; i++) {
      const rest = list.slice(i);
      // « l'Ancien » ou « de » isolés ne sont pas une réponse.
      if (rest.every((word) => isParticle(word) || isQualifier(word))) continue;
      out.add(rest.join(' '));
    }
  }
  return [...out];
}

/**
 * Réponses acceptées pour un champ : la valeur attendue plus ses alias — et,
 * pour le peintre, ses formes courtes : le nom de famille suffit.
 */
export function accepted(painting, field) {
  const answers = [painting[field], ...(painting.alias?.[field] ?? [])].filter(Boolean);
  if (field !== 'painter') return answers;
  return [...new Set([...answers, ...answers.flatMap(shortNames)])];
}

export function createPaintingQuiz(paintings) {
  const quiz = createQuiz({
    namespace: 'tableaux',
    items: paintings,
    keyOf: (painting) => painting.id,
    textFields: ['title', 'painter'],
    accepted,
    // Un titre n'appartient qu'à son œuvre, un nom de peintre à toutes les
    // siennes : sans quoi « Monet » serait refusé sur la moitié de ses tableaux.
    ownerOf: (field, painting) => (field === 'painter' ? painting.painter : painting.id),
    choiceFields: { century: (painting, given) => given === century(painting.year) },
    // Leurres au hasard : trois autres titres, trois autres peintres, et trois
    // autres siècles pris parmi ceux que le corpus représente.
    choices: {
      title: {},
      painter: {},
      century: { correct: (painting) => century(painting.year) },
    },
    distinctBy: (painting) => painting.painter,
  });

  /** Les siècles représentés dans le corpus, ordonnés : les choix proposés. */
  const centuries = [...new Set(paintings.map((p) => century(p.year)))].sort((a, b) => a - b);

  return { ...quiz, paintings, centuries };
}

export const maxScore = (count = QUESTIONS_PER_DAY) => count * POINTS_PER_QUESTION;
