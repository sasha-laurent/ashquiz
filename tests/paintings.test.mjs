import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { century, centuryLabel } from '../src/lib/paintings.js';
import { accepted, createPaintingQuiz, shortNames, totalScore } from '../src/lib/quiz-paintings.js';
import { createLocalAdapter, createStore } from '../src/lib/storage.js';

const CORPUS = [
  { id: 'Q1', title: 'La Nuit étoilée', painter: 'Vincent van Gogh', year: 1889, image: 'a.jpg' },
  { id: 'Q2', title: 'Les Tournesols', painter: 'Vincent van Gogh', year: 1888, image: 'b.jpg' },
  { id: 'Q3', title: 'Impression, soleil levant', painter: 'Claude Monet', year: 1872, image: 'c.jpg' },
  { id: 'Q4', title: 'La Joconde', painter: 'Léonard de Vinci', year: 1503, image: 'd.jpg' },
  { id: 'Q5', title: 'Le Déjeuner sur l’herbe', painter: 'Édouard Manet', year: 1863, image: 'e.jpg' },
  { id: 'Q6', title: 'Le Cri', painter: 'Edvard Munch', year: 1893, image: 'f.jpg' },
  {
    id: 'Q7',
    title: 'Le Bal du moulin de la Galette',
    painter: 'Pierre-Auguste Renoir',
    year: 1876,
    image: 'g.jpg',
    alias: { painter: ['Auguste Renoir'] },
  },
];

const quiz = createPaintingQuiz(CORPUS);

test('le siècle est calculé et écrit en chiffres romains', () => {
  assert.equal(century(1889), 19);
  assert.equal(century(1900), 19);
  assert.equal(century(1901), 20);
  assert.equal(century(1503), 16);
  assert.equal(centuryLabel(16), 'XVIe');
  assert.equal(centuryLabel(19), 'XIXe');
  assert.equal(centuryLabel(20), 'XXe');
});

test('la série du jour est déterministe, sans doublon et de bonne taille', () => {
  const a = quiz.buildSession('2026-08-08').map((p) => p.id);
  const b = quiz.buildSession('2026-08-08').map((p) => p.id);
  const c = quiz.buildSession('2026-08-09').map((p) => p.id);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 5);
  assert.equal(new Set(a).size, 5);
});

test('la série évite de tirer deux fois le même peintre quand elle le peut', () => {
  // Le corpus compte six peintres pour cinq questions : aucun doublon possible.
  for (const seed of ['2026-01-01', '2026-05-12', 'practice-1', 'practice-2']) {
    const painters = quiz.buildSession(seed).map((p) => p.painter);
    assert.equal(new Set(painters).size, 5, `doublon de peintre pour ${seed}`);
  }
});

test('la correction accepte accents, apostrophes et fautes légères', () => {
  const vanGogh = CORPUS[0];
  const exact = quiz.grade(vanGogh, {
    title: 'la nuit etoilee',
    painter: 'Van Gogh, Vincent',
    century: 19,
  });
  assert.equal(exact.title.ok, true);
  assert.equal(exact.century.ok, true);

  const typo = quiz.grade(vanGogh, { title: 'La Nuit étoillée', painter: 'Vincent van Gogh', century: 19 });
  assert.equal(typo.title.ok, true);
  assert.equal(typo.title.typo, true);
  assert.equal(typo.score, 3);
});

test('le titre exact d’une autre œuvre n’est jamais toléré', () => {
  const answer = quiz.grade(CORPUS[0], { title: 'Le Cri', painter: '', century: null });
  assert.equal(answer.title.ok, false);
  assert.equal(answer.score, 0);
});

test('le nom exact d’un autre peintre n’est jamais toléré', () => {
  // « Manet » et « Monet » sont à une lettre l'un de l'autre.
  const monet = quiz.grade(CORPUS[2], { title: '', painter: 'Manet', century: null });
  assert.equal(monet.painter.ok, false);
});

test('les alias de peintre déclarés sont acceptés', () => {
  const renoir = CORPUS[6];
  assert.deepEqual(accepted(renoir, 'painter'), [
    'Pierre-Auguste Renoir',
    'Auguste Renoir',
    'Renoir',
  ]);
  assert.equal(quiz.grade(renoir, { title: '', painter: 'Auguste Renoir', century: null }).painter.ok, true);
});

test('le nom de famille seul suffit pour le peintre', () => {
  const cases = [
    [CORPUS[2], 'Monet'],
    [CORPUS[0], 'van Gogh'],
    [CORPUS[0], 'Gogh'],
    [CORPUS[3], 'de Vinci'],
    [CORPUS[3], 'Vinci'],
    [CORPUS[6], 'Renoir'],
    // La tolérance aux fautes de frappe vaut aussi sur la forme courte.
    [CORPUS[5], 'Munsh'],
  ];
  for (const [painting, given] of cases) {
    const answer = quiz.grade(painting, { title: '', painter: given, century: null });
    assert.equal(answer.painter.ok, true, `« ${given} » refusé pour ${painting.painter}`);
  }
});

test('une particule ou un qualificatif seul ne vaut pas réponse', () => {
  for (const given of ['de', 'van', 'Le']) {
    const answer = quiz.grade(CORPUS[3], { title: '', painter: given, century: null });
    assert.equal(answer.painter.ok, false, `« ${given} » accepté pour ${CORPUS[3].painter}`);
  }
  assert.deepEqual(shortNames("Pieter Brueghel l'Ancien"), ["Brueghel l'Ancien", 'Brueghel']);
  assert.deepEqual(shortNames('Élisabeth Vigée Le Brun'), ['Vigée Le Brun', 'Le Brun', 'Brun']);
  // Un nom d'un seul mot n'a pas de forme courte : rien à ajouter.
  assert.deepEqual(shortNames('Rembrandt'), []);
});

test('le siècle attendu est celui de l’année de l’œuvre', () => {
  assert.deepEqual(quiz.centuries, [16, 19]);
  const joconde = CORPUS[3];
  assert.equal(quiz.grade(joconde, { title: '', painter: '', century: 16 }).century.ok, true);
  assert.equal(quiz.grade(joconde, { title: '', painter: '', century: 15 }).century.ok, false);
  assert.equal(quiz.grade(joconde, { title: '', painter: '', century: null }).century.ok, false);
});

test('le score cumule les trois sous-réponses', () => {
  const answers = [
    quiz.grade(CORPUS[0], { title: 'La Nuit étoilée', painter: 'Vincent van Gogh', century: 19 }),
    quiz.grade(CORPUS[2], { title: 'Impression, soleil levant', painter: 'Renoir', century: 18 }),
  ];
  assert.equal(answers[0].score, 3);
  assert.equal(answers[1].score, 1);
  assert.equal(totalScore(answers), 4);
});

test('les stats des tableaux vivent dans leur propre espace', async () => {
  let saved = null;
  const memory = {
    async read() {
      return saved ? structuredClone(saved) : { version: 1, days: {}, paintings: {} };
    },
    async write(data) {
      saved = structuredClone(data);
    },
    async clear() {
      saved = null;
    },
  };
  const store = createStore(memory, { statsKey: 'paintings' });
  const answers = [quiz.grade(CORPUS[0], { title: 'La Nuit étoilée', painter: 'Picasso', century: 19 })];
  await store.saveDay('2026-08-08', { date: '2026-08-08', mode: 'daily', answers, score: 2, max: 3 });

  const state = await store.getState();
  assert.equal(state.paintings.Q1.seen, 1);
  assert.equal(state.paintings.Q1.title, 1);
  assert.equal(state.paintings.Q1.painter, 0);
  assert.equal(state.paintings.Q1.century, 1);
  assert.equal(state.paintings.Q1.lastSeen, '2026-08-08');
  assert.equal(state.departments, undefined);
});

test('chaque thème a sa propre clé de stockage', async () => {
  const written = new Map();
  globalThis.localStorage = {
    getItem: (key) => written.get(key) ?? null,
    setItem: (key, value) => written.set(key, value),
    removeItem: (key) => written.delete(key),
  };
  const adapter = createLocalAdapter({ key: 'ashquiz.tableaux.v1', statsKey: 'paintings' });
  await adapter.write({ version: 1, days: { '2026-08-08': {} }, paintings: {} });
  assert.ok(written.has('ashquiz.tableaux.v1'));
  assert.equal(written.has('ashquiz.v1'), false);
  delete globalThis.localStorage;
});

test('le corpus produit par build:paintings est exploitable', async () => {
  const file = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'tableaux.json');
  let corpus;
  try {
    corpus = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // Le fichier est produit par `npm run build:paintings` : sans lui, le reste
    // des tests reste valable, on ne fait pas échouer la suite.
    return;
  }

  assert.ok(corpus.paintings.length >= 50, 'corpus trop petit pour un quiz');
  const ids = new Set();
  for (const painting of corpus.paintings) {
    assert.match(painting.id, /^Q\d+$/, `identifiant inattendu : ${painting.id}`);
    assert.equal(ids.has(painting.id), false, `doublon : ${painting.id}`);
    ids.add(painting.id);
    assert.ok(painting.title?.length, `titre manquant sur ${painting.id}`);
    assert.ok(painting.painter?.length, `peintre manquant sur ${painting.id}`);
    assert.ok(painting.image?.startsWith('https://'), `image non https sur ${painting.id}`);
    assert.ok(
      Number.isInteger(painting.year) && painting.year > 1000 && painting.year <= 1970,
      `année invraisemblable sur ${painting.id} : ${painting.year}`,
    );
  }

  // Cinq questions par jour, une œuvre par peintre : il en faut au moins cinq.
  const painters = new Set(corpus.paintings.map((p) => p.painter));
  assert.ok(painters.size >= 5, 'pas assez de peintres distincts');
});
