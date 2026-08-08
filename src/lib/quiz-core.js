// Noyau commun aux quiz, indépendant du DOM : index des réponses, tirage de la
// série, correction et notation.
//
// Les trois thèmes posent la même question sous des habits différents : « voici
// un item, donne-en deux ou trois caractéristiques ». Ce module décrit ce
// déroulé une fois ; un thème ne fournit plus que son corpus, ses sous-réponses
// et ses alias (`src/lib/quiz.js`, `quiz-countries.js`, `quiz-paintings.js`).

import { pickChoices } from './choices.js';
import { makeRng, sample } from './rng.js';
import { check, variants } from './text.js';

export const QUESTIONS_PER_DAY = 5;

/**
 * Index « forme canonique → propriétaires de cette réponse », pour refuser la
 * tolérance aux fautes de frappe à une saisie qui est exactement la réponse d'un
 * *autre* item : « Loire » ne doit pas passer pour le Loiret, « Niger » pour le
 * Nigeria, ni « Manet » pour « Monet ».
 *
 * @param {object} spec
 * @param {object[]} spec.items  corpus du thème
 * @param {string[]} spec.fields  sous-réponses en texte libre
 * @param {(item: object, field: string) => string[]} spec.accepted
 * @param {(field: string, item: object) => string} spec.ownerOf  ce qui distingue
 *   deux réponses : le plus souvent l'item lui-même, mais le peintre pour les
 *   tableaux — deux œuvres du même peintre ne doivent pas se refuser son nom.
 * @returns {(field: string, item: object) => (variant: string) => boolean}
 */
export function createAnswerIndex({ items, fields, accepted, ownerOf }) {
  const index = new Map(fields.map((field) => [field, new Map()]));

  for (const item of items) {
    for (const field of fields) {
      const owner = ownerOf(field, item);
      const byVariant = index.get(field);
      for (const answer of accepted(item, field)) {
        for (const variant of variants(answer)) {
          const owners = byVariant.get(variant) ?? new Set();
          owners.add(owner);
          byVariant.set(variant, owners);
        }
      }
    }
  }

  return (field, item) => (variant) => {
    const owners = index.get(field).get(variant);
    return Boolean(owners) && !owners.has(ownerOf(field, item));
  };
}

/**
 * Fabrique le quiz d'un thème.
 *
 * @param {object} spec
 * @param {string} [spec.namespace]  préfixe de graine. Il fige la série du jour
 *   d'un thème : le changer rebattrait les cartes de tout le monde.
 * @param {object[]} spec.items  corpus
 * @param {(item: object) => string} [spec.keyOf]  identifiant d'un item
 * @param {string[]} spec.textFields  sous-réponses en texte libre
 * @param {(item: object, field: string) => string[]} spec.accepted
 * @param {(field: string, item: object) => string} [spec.ownerOf]
 * @param {Record<string, (item: object, given: unknown) => boolean>} [spec.choiceFields]
 *   sous-réponses qui ne se saisissent pas au clavier (la carte, le siècle) :
 *   pour chacune, le test de justesse.
 * @param {Record<string, {correct?: Function, pool?: Function}>} [spec.choices]
 *   mode carré, sous-réponse par sous-réponse : `correct(item)` donne la bonne
 *   proposition (par défaut la première réponse acceptée) et `pool(item, {items,
 *   index})` le vivier où prendre les leurres (par défaut la même sous-réponse
 *   de tous les items). Une sous-réponse absente d'ici ne se joue pas au carré.
 * @param {(item: object) => string} [spec.distinctBy]  évite deux items de la
 *   même famille dans une série (deux œuvres du même peintre).
 * @param {number} [spec.questionsPerDay]
 */
export function createQuiz({
  namespace = '',
  items,
  keyOf = (item) => item.code,
  textFields,
  accepted,
  ownerOf = (field, item) => keyOf(item),
  choiceFields = {},
  choices = {},
  distinctBy = null,
  questionsPerDay = QUESTIONS_PER_DAY,
}) {
  const fields = [...textFields, ...Object.keys(choiceFields)];
  const pointsPerQuestion = fields.length;
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const isOtherAnswer = createAnswerIndex({ items, fields: textFields, accepted, ownerOf });
  const choiceSpecs = Object.entries(choices).map(([field, spec]) => {
    const correct = spec.correct ?? ((item) => accepted(item, field)[0]);
    return [field, { correct, pool: spec.pool ?? ((item, ctx) => ctx.items.map(correct)) }];
  });

  /** Le vivier du tirage : le corpus, moins ce que le thème écarte. */
  function drawablePool(isDrawable) {
    return isDrawable ? items.filter((item) => isDrawable(keyOf(item), item)) : items;
  }

  /**
   * Série de questions déterministe pour une graine donnée.
   * @param {string} seed  clé du jour (« 2026-08-08 ») ou graine d'entraînement
   * @param {(code: string, item: object) => boolean} [isDrawable]  filtre
   *   optionnel (ex. présence sur la carte)
   */
  function buildSession(seed, isDrawable) {
    const pool = drawablePool(isDrawable);
    const rng = makeRng(`ashquiz:${namespace ? `${namespace}:` : ''}${seed}`);
    if (!distinctBy) return sample(pool, questionsPerDay, rng);

    // Deux items de la même famille dans une série gâchent l'intérêt : on tire
    // large, puis on n'en garde qu'un par famille tant qu'il en reste assez.
    const drawn = sample(pool, questionsPerDay * 3, rng);
    const kept = [];
    const seen = new Set();
    for (const item of drawn) {
      const family = distinctBy(item);
      if (seen.has(family)) continue;
      seen.add(family);
      kept.push(item);
      if (kept.length === questionsPerDay) break;
    }
    for (const item of drawn) {
      if (kept.length === questionsPerDay) break;
      if (!kept.includes(item)) kept.push(item);
    }
    return kept;
  }

  /**
   * Les propositions du mode carré pour une question : par sous-réponse, la
   * bonne réponse noyée parmi des leurres.
   *
   * Le tirage est déterministe comme celui de la série : mêmes graine et item,
   * mêmes propositions dans le même ordre — recharger la page ne redistribue
   * rien.
   *
   * @param {object} item  item de la question
   * @param {string} seed  la même graine que `buildSession`
   * @param {(code: string, item: object) => boolean} [isDrawable]  le même filtre
   * @returns {Record<string, {values: unknown[], correct: unknown}>}
   */
  function buildChoices(item, seed, isDrawable) {
    const pool = drawablePool(isDrawable);
    const index = pool.findIndex((other) => keyOf(other) === keyOf(item));
    const out = {};

    for (const [field, spec] of choiceSpecs) {
      const rng = makeRng(`ashquiz:choices:${namespace}:${seed}:${keyOf(item)}:${field}`);
      const correct = spec.correct(item);
      const values = pickChoices({ correct, pool: spec.pool(item, { items: pool, index }), rng });
      out[field] = { values, correct };
    }
    return out;
  }

  /**
   * Corrige les sous-réponses d'une question : un point par sous-réponse juste.
   * @param {object} item  item attendu
   * @param {Record<string, unknown>} given  saisie, une entrée par sous-réponse
   */
  function grade(item, given) {
    const answer = { code: keyOf(item) };

    for (const field of textFields) {
      const value = given[field] ?? '';
      const { status } = check(value, accepted(item, field), isOtherAnswer(field, item));
      answer[field] = { given: value, ok: status !== 'wrong', typo: status === 'typo' };
    }
    for (const [field, isCorrect] of Object.entries(choiceFields)) {
      const value = given[field] ?? null;
      answer[field] = { given: value, ok: isCorrect(item, value) };
    }

    answer.score = fields.reduce((sum, field) => sum + (answer[field].ok ? 1 : 0), 0);
    return answer;
  }

  return {
    items,
    byKey,
    fields,
    questionsPerDay,
    pointsPerQuestion,
    /** Le thème sait-il proposer des réponses ? Sinon, pas de mode carré. */
    hasChoices: choiceSpecs.length > 0,
    buildSession,
    buildChoices,
    grade,
    totalScore,
    maxScore: (count = questionsPerDay) => count * pointsPerQuestion,
  };
}

export function totalScore(answers) {
  return answers.reduce((sum, answer) => sum + answer.score, 0);
}

/**
 * Les libellés les moins bien réussis, du pire au moins pire : le « À revoir »
 * de l'écran de résultat.
 *
 * Les statistiques enregistrées sont `{ seen, <sous-réponse>: nombre de fois
 * juste, lastSeen }` par item ; deux items partageant un libellé sont fondus
 * (les tableaux comptent par peintre, pas par œuvre).
 *
 * @param {Record<string, object>} stats  sous-objet de statistiques du thème
 * @param {object} options
 * @param {number} options.points  sous-réponses par question
 * @param {(key: string) => string|undefined} options.label  libellé d'un item,
 *   ou rien s'il a disparu du corpus
 * @param {number} [options.limit]
 */
export function weakest(stats, { points, label, limit = 4 }) {
  const groups = new Map();

  for (const [key, stat] of Object.entries(stats ?? {})) {
    const name = label(key);
    if (!name) continue;
    const entry = groups.get(name) ?? { seen: 0, ok: 0 };
    entry.seen += stat.seen * points;
    for (const [field, value] of Object.entries(stat)) {
      if (field !== 'seen' && typeof value === 'number') entry.ok += value;
    }
    groups.set(name, entry);
  }

  return [...groups]
    .map(([name, entry]) => ({ name, rate: entry.ok / entry.seen }))
    .filter((entry) => entry.rate < 1)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, limit)
    .map((entry) => entry.name);
}
