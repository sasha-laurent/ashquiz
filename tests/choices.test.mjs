import assert from 'node:assert/strict';
import test from 'node:test';

import { COUNTRIES } from '../src/data/countries.js';
import { BY_CODE, DEPARTMENTS } from '../src/data/departments.js';
import { CHOICES_PER_QUESTION, neighbours, pickChoices } from '../src/lib/choices.js';
import { QUIZ } from '../src/lib/quiz.js';
import { createQuiz } from '../src/lib/quiz-core.js';
import { QUIZ as PAYS } from '../src/lib/quiz-countries.js';
import { createPaintingQuiz } from '../src/lib/quiz-paintings.js';
import { makeRng } from '../src/lib/rng.js';

test('un tirage de propositions contient la bonne réponse, sans doublon', () => {
  const values = pickChoices({
    correct: 'Isère',
    pool: ['Drôme', 'Savoie', 'Rhône', 'Ain', 'Loire'],
    rng: makeRng('graine'),
  });
  assert.equal(values.length, CHOICES_PER_QUESTION);
  assert.ok(values.includes('Isère'));
  assert.equal(new Set(values).size, CHOICES_PER_QUESTION);
});

test('un leurre qui se lit comme la bonne réponse est écarté', () => {
  // « Saint-Étienne » et « St Etienne » ne feraient qu'une case aux yeux du
  // joueur : ce serait une question à deux réponses justes.
  const values = pickChoices({
    correct: 'Saint-Étienne',
    pool: ['St Etienne', 'Saint-Etienne', 'Lyon', 'Valence', 'Roanne'],
    rng: makeRng('graine'),
  });
  assert.equal(values.length, 4);
  assert.ok(values.includes('Saint-Étienne'));
  assert.ok(!values.includes('St Etienne'));
  assert.ok(!values.includes('Saint-Etienne'));
});

test('un vivier trop maigre donne moins de propositions, sans planter', () => {
  const values = pickChoices({ correct: 'Ain', pool: ['Aisne'], rng: makeRng('graine') });
  assert.deepEqual(values.sort(), ['Ain', 'Aisne']);
});

test('les voisins de liste sont pris à `span` places, sans déborder', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  assert.deepEqual(neighbours(items, 4, 2), ['c', 'd', 'f', 'g']);
  assert.deepEqual(neighbours(items, 0, 3), ['b', 'c', 'd']);
  assert.deepEqual(neighbours(items, 8, 3), ['f', 'g', 'h']);
  assert.deepEqual(neighbours(items, -1, 3), []);
});

test('les propositions sont déterministes et propres à la question', () => {
  const isere = BY_CODE.get('38');
  const a = QUIZ.buildChoices(isere, '2026-08-08');
  const b = QUIZ.buildChoices(isere, '2026-08-08');

  assert.deepEqual(a.name.values, b.name.values);
  assert.equal(a.name.correct, 'Isère');
  assert.deepEqual(a.map.values, b.map.values);

  // Un autre jour rebat les propositions, sans changer la bonne réponse.
  const other = QUIZ.buildChoices(isere, '2026-08-09');
  assert.equal(other.name.correct, 'Isère');
  assert.notDeepEqual(other.name.values, a.name.values);
});

test('chaque sous-réponse a ses quatre propositions, dont une seule juste', () => {
  for (const dep of DEPARTMENTS) {
    const choices = QUIZ.buildChoices(dep, '2026-08-08');
    assert.deepEqual(Object.keys(choices), ['name', 'prefecture', 'map']);
    for (const [field, { values, correct }] of Object.entries(choices)) {
      assert.equal(values.length, 4, `${dep.code} ${field}`);
      assert.equal(new Set(values).size, 4, `${dep.code} ${field}`);
      assert.equal(values.filter((value) => value === correct).length, 1, `${dep.code} ${field}`);
    }
    assert.equal(choices.map.correct, dep.code);
  }
});

test('les noms proposés sont des départements de numéro voisin', () => {
  for (const dep of DEPARTMENTS) {
    const index = DEPARTMENTS.indexOf(dep);
    const close = new Set(neighbours(DEPARTMENTS, index, 3).map((d) => d.name));
    const { values, correct } = QUIZ.buildChoices(dep, '2026-08-08').name;
    for (const value of values) {
      if (value === correct) continue;
      assert.ok(close.has(value), `${dep.code} : ${value} n'est pas un voisin de ${correct}`);
    }
  }
});

test('les trois sous-réponses parlent des mêmes quatre départements', () => {
  // La préfecture proposée est celle d'un département proposé, et la carte
  // surligne ces quatre-là : la question est « lequel de ces quatre ? », posée
  // trois fois.
  for (const dep of DEPARTMENTS) {
    const { name, prefecture, map } = QUIZ.buildChoices(dep, '2026-08-08');
    const proposed = map.values.map((code) => BY_CODE.get(code));

    assert.deepEqual(new Set(name.values), new Set(proposed.map((d) => d.name)), dep.code);
    assert.deepEqual(
      new Set(prefecture.values),
      new Set(proposed.map((d) => d.prefecture)),
      dep.code,
    );
  }
});

test("l'ordre d'affichage, lui, est propre à chaque sous-réponse", () => {
  // Sinon, reconnaître le nom livrerait la position de la préfecture et de la
  // zone à cliquer.
  const alignés = DEPARTMENTS.filter((dep) => {
    const { name, map } = QUIZ.buildChoices(dep, '2026-08-08');
    return name.values.every((value, i) => value === BY_CODE.get(map.values[i]).name);
  });
  assert.ok(alignés.length < 10, `${alignés.length} départements alignent leurs sous-réponses`);
});

test('le filtre de tirage vaut aussi pour les propositions', () => {
  // Un département absent de la carte ne serait pas cliquable : il ne peut pas
  // non plus être proposé.
  const metropole = (code) => !code.startsWith('9') || Number(code) < 90;
  const choices = QUIZ.buildChoices(BY_CODE.get('75'), '2026-08-08', metropole);
  for (const code of choices.map.values) assert.ok(metropole(code), code);
});

test('une proposition cochée se corrige comme une réponse tapée', () => {
  const isere = BY_CODE.get('38');
  const { name, prefecture, map } = QUIZ.buildChoices(isere, '2026-08-08');

  const right = QUIZ.grade(isere, {
    name: name.correct,
    prefecture: prefecture.correct,
    map: map.correct,
  });
  assert.equal(right.score, 3);

  const wrong = name.values.find((value) => value !== name.correct);
  assert.equal(QUIZ.grade(isere, { name: wrong }).name.ok, false);
  // Ne rien cocher, c'est ne rien répondre.
  assert.equal(QUIZ.grade(isere, { name: '' }).score, 0);
});

test('les pays proposent des noms et des capitales quelconques', () => {
  const france = PAYS.byKey.get('fr');
  const choices = PAYS.buildChoices(france, '2026-08-08');
  const names = new Set(COUNTRIES.map((country) => country.name));
  const capitals = new Set(COUNTRIES.map((country) => country.capital));

  assert.deepEqual(Object.keys(choices), ['name', 'capital']);
  assert.equal(choices.name.correct, 'France');
  assert.equal(choices.capital.correct, 'Paris');
  for (const value of choices.name.values) assert.ok(names.has(value), value);
  for (const value of choices.capital.values) assert.ok(capitals.has(value), value);
});

test('les tableaux proposent titres, peintres et siècles du corpus', () => {
  const paintings = [
    { id: 'a', title: 'Impression', painter: 'Claude Monet', year: 1872 },
    { id: 'b', title: 'Guernica', painter: 'Pablo Picasso', year: 1937 },
    { id: 'c', title: 'La Joconde', painter: 'Léonard de Vinci', year: 1503 },
    { id: 'd', title: 'Le Cri', painter: 'Edvard Munch', year: 1893 },
    { id: 'e', title: 'Olympia', painter: 'Édouard Manet', year: 1863 },
  ];
  const quiz = createPaintingQuiz(paintings);
  const { title, painter, century } = quiz.buildChoices(paintings[0], '2026-08-08');

  assert.equal(title.correct, 'Impression');
  assert.equal(painter.correct, 'Claude Monet');
  assert.equal(century.correct, 19);
  for (const value of title.values) assert.ok(paintings.some((p) => p.title === value), value);
  for (const value of painter.values) assert.ok(paintings.some((p) => p.painter === value), value);
  for (const value of century.values) assert.ok(quiz.centuries.includes(value), value);
});

test("un thème sans propositions n'a pas de mode carré", () => {
  const quiz = createQuiz({
    items: [{ code: 'a', name: 'Alpha' }],
    textFields: ['name'],
    accepted: (item, field) => [item[field]],
  });
  assert.equal(quiz.hasChoices, false);
  assert.deepEqual(quiz.buildChoices(quiz.byKey.get('a'), '2026-08-08'), {});
  assert.equal(QUIZ.hasChoices, true);
});
