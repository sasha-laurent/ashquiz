// Logique du quiz « tableaux », indépendante du DOM.
//
// Le corpus étant chargé à l'exécution (et non importé comme les départements),
// tout passe par une fabrique : `createPaintingQuiz(paintings)`. C'est aussi ce
// qui rend le module testable avec une poignée d'œuvres factices.

import { century } from './paintings.js';
import { makeRng, sample } from './rng.js';
import { check, variants } from './text.js';

export const QUESTIONS_PER_DAY = 5;
export const POINTS_PER_QUESTION = 3;

/** Réponses acceptées pour un champ : la valeur attendue plus ses alias. */
export function accepted(painting, field) {
  return [painting[field], ...(painting.alias?.[field] ?? [])].filter(Boolean);
}

export function createPaintingQuiz(paintings) {
  // Index « forme canonique → valeurs qui l'acceptent », pour refuser la
  // tolérance aux fautes de frappe à une saisie qui est exactement la réponse
  // d'une *autre* œuvre : « Le Baiser » ne doit pas passer pour « Le Bain »,
  // ni « Manet » pour « Monet ».
  const titles = new Map();
  const painters = new Map();

  for (const painting of paintings) {
    for (const [field, index, key] of [
      ['title', titles, painting.id],
      ['painter', painters, painting.painter],
    ]) {
      for (const answer of accepted(painting, field)) {
        for (const variant of variants(answer)) {
          const owners = index.get(variant) ?? new Set();
          owners.add(key);
          index.set(variant, owners);
        }
      }
    }
  }

  const otherAnswerTest = (index, key) => (variant) => {
    const owners = index.get(variant);
    return Boolean(owners) && !owners.has(key);
  };

  /** Les siècles représentés dans le corpus, ordonnés : les choix proposés. */
  const centuries = [...new Set(paintings.map((p) => century(p.year)))].sort((a, b) => a - b);

  const byId = new Map(paintings.map((painting) => [painting.id, painting]));

  /**
   * Série déterministe pour une graine donnée.
   * @param {string} seed clé du jour (« 2026-08-08 ») ou graine d'entraînement
   */
  function buildSession(seed) {
    const rng = makeRng(`ashquiz:tableaux:${seed}`);
    const drawn = sample(paintings, QUESTIONS_PER_DAY * 3, rng);
    // Un même peintre deux fois dans la série gâche l'intérêt : on tire large,
    // puis on ne garde qu'une œuvre par peintre tant qu'il en reste assez.
    const kept = [];
    const seen = new Set();
    for (const painting of drawn) {
      if (seen.has(painting.painter)) continue;
      seen.add(painting.painter);
      kept.push(painting);
      if (kept.length === QUESTIONS_PER_DAY) break;
    }
    for (const painting of drawn) {
      if (kept.length === QUESTIONS_PER_DAY) break;
      if (!kept.includes(painting)) kept.push(painting);
    }
    return kept;
  }

  /**
   * Corrige les trois sous-réponses d'une question.
   * @param {object} painting œuvre attendue
   * @param {{title: string, painter: string, century: number|null}} given
   */
  function grade(painting, given) {
    const title = check(
      given.title ?? '',
      accepted(painting, 'title'),
      otherAnswerTest(titles, painting.id),
    );
    const painter = check(
      given.painter ?? '',
      accepted(painting, 'painter'),
      otherAnswerTest(painters, painting.painter),
    );
    const expectedCentury = century(painting.year);

    const answer = {
      code: painting.id,
      title: {
        given: given.title ?? '',
        ok: title.status !== 'wrong',
        typo: title.status === 'typo',
      },
      painter: {
        given: given.painter ?? '',
        ok: painter.status !== 'wrong',
        typo: painter.status === 'typo',
      },
      century: { given: given.century ?? null, ok: given.century === expectedCentury },
    };
    answer.score =
      (answer.title.ok ? 1 : 0) + (answer.painter.ok ? 1 : 0) + (answer.century.ok ? 1 : 0);
    return answer;
  }

  return { paintings, byId, centuries, buildSession, grade };
}

export function totalScore(answers) {
  return answers.reduce((sum, answer) => sum + answer.score, 0);
}

export function maxScore(count = QUESTIONS_PER_DAY) {
  return count * POINTS_PER_QUESTION;
}
