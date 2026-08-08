import assert from 'node:assert/strict';
import test from 'node:test';

import { createQuiz, weakest } from '../src/lib/quiz-core.js';

// Un thème factice, avec ce que le noyau doit savoir gérer : deux sous-réponses
// en texte libre, une au clic, des alias et des familles (ici la région).
const ITEMS = [
  { code: 'a', name: 'Moselle', chief: 'Metz', region: 'Est' },
  { code: 'b', name: 'Mosellane', chief: 'Nancy', region: 'Est', alias: { name: ['Meurthe'] } },
  { code: 'c', name: 'Gironde', chief: 'Bordeaux', region: 'Ouest' },
  { code: 'd', name: 'Landes', chief: 'Mont-de-Marsan', region: 'Ouest' },
  { code: 'e', name: 'Savoie', chief: 'Chambéry', region: 'Alpes' },
  { code: 'f', name: 'Isère', chief: 'Grenoble', region: 'Alpes' },
  { code: 'g', name: 'Var', chief: 'Toulon', region: 'Sud' },
];

const accepted = (item, field) => [item[field], ...(item.alias?.[field] ?? [])];

const quiz = createQuiz({
  namespace: 'test',
  items: ITEMS,
  textFields: ['name', 'chief'],
  accepted,
  choiceFields: { region: (item, given) => given === item.region },
  questionsPerDay: 3,
});

test('un quiz connaît ses sous-réponses et ce que vaut une question', () => {
  assert.deepEqual(quiz.fields, ['name', 'chief', 'region']);
  assert.equal(quiz.pointsPerQuestion, 3);
  assert.equal(quiz.maxScore(), 9);
  assert.equal(quiz.maxScore(2), 6);
  assert.equal(quiz.byKey.get('c').chief, 'Bordeaux');
});

test('la série est déterministe, sans doublon, et propre à son thème', () => {
  const a = quiz.buildSession('2026-08-08').map((item) => item.code);
  assert.deepEqual(a, quiz.buildSession('2026-08-08').map((item) => item.code));
  assert.notDeepEqual(a, quiz.buildSession('2026-08-09').map((item) => item.code));
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3);

  // Deux thèmes qui partagent un corpus ne doivent pas poser les mêmes questions
  // le même jour : c'est tout le rôle du préfixe de graine.
  const other = createQuiz({ ...quizSpec(), namespace: 'autre' });
  assert.notDeepEqual(a, other.buildSession('2026-08-08').map((item) => item.code));
});

test('le filtre de tirage est respecté', () => {
  const codes = quiz.buildSession('2026-08-08', (code) => 'abc'.includes(code)).map((i) => i.code);
  assert.equal(codes.length, 3);
  assert.ok(codes.every((code) => 'abc'.includes(code)));
});

test('une série évite deux items de la même famille quand elle le peut', () => {
  const grouped = createQuiz({ ...quizSpec(), distinctBy: (item) => item.region });
  for (const seed of ['2026-01-01', '2026-05-12', 'practice-1', 'practice-2']) {
    const regions = grouped.buildSession(seed).map((item) => item.region);
    assert.equal(new Set(regions).size, 3, `doublon de région pour ${seed}`);
  }

  // Quatre familles seulement : au-delà, la série se complète malgré tout.
  const five = createQuiz({ ...quizSpec(), distinctBy: (item) => item.region, questionsPerDay: 5 });
  const drawn = five.buildSession('2026-08-08');
  assert.equal(drawn.length, 5);
  assert.equal(new Set(drawn.map((item) => item.code)).size, 5);
});

test('la correction rend une sous-réponse par champ et un point par bonne réponse', () => {
  const item = quiz.byKey.get('a');

  const perfect = quiz.grade(item, { name: 'moselle', chief: 'METZ', region: 'Est' });
  assert.equal(perfect.code, 'a');
  assert.equal(perfect.score, 3);
  assert.deepEqual(perfect.name, { given: 'moselle', ok: true, typo: false });
  assert.deepEqual(perfect.region, { given: 'Est', ok: true });

  const typo = quiz.grade(item, { name: 'Mosele', chief: 'Lyon', region: 'Ouest' });
  assert.equal(typo.score, 1);
  assert.equal(typo.name.typo, true);
  assert.equal(typo.chief.ok, false);
  assert.equal(typo.region.ok, false);

  // Une sous-réponse absente vaut réponse vide, sans planter.
  const empty = quiz.grade(item, {});
  assert.equal(empty.score, 0);
  assert.deepEqual(empty.region, { given: null, ok: false });
});

test("la réponse exacte d'un autre item n'est jamais tolérée", () => {
  // « Moselle » et « Mosellane » sont à deux lettres l'un de l'autre.
  assert.equal(quiz.grade(quiz.byKey.get('b'), { name: 'Moselle' }).name.ok, false);
  // Y compris quand c'est un alias qui la revendique.
  assert.equal(quiz.grade(quiz.byKey.get('a'), { name: 'Meurthe' }).name.ok, false);
  // Et la garde vaut par champ : un chef-lieu ne bloque pas un nom.
  assert.equal(quiz.grade(quiz.byKey.get('a'), { name: 'Mosell' }).name.ok, true);
});

test('deux items du même propriétaire se prêtent leurs réponses', () => {
  // C'est le cas des tableaux : le nom d'un peintre appartient à toutes ses
  // œuvres, pas à une seule.
  const items = [
    { code: 'x', name: 'Alpha', chief: 'Bordeaux', region: 'Ouest' },
    { code: 'y', name: 'Bêta', chief: 'Bordeau', region: 'Ouest' },
    { code: 'z', name: 'Gamma', chief: 'Toulouse', region: 'Sud' },
  ];
  const spec = { items, textFields: ['chief'], accepted };
  const perItem = createQuiz(spec);
  const perRegion = createQuiz({ ...spec, ownerOf: (field, item) => item.region });

  // « Bordeau » est la réponse exacte de y : pour x, ce n'est pas une faute de
  // frappe sur « Bordeaux », c'est la réponse du voisin.
  assert.equal(perItem.grade(items[0], { chief: 'Bordeau' }).chief.ok, false);
  // Sauf quand x et y relèvent du même propriétaire.
  assert.equal(perRegion.grade(items[0], { chief: 'Bordeau' }).chief.ok, true);
});

test('le total additionne les scores de la série', () => {
  const answers = [
    quiz.grade(quiz.byKey.get('a'), { name: 'Moselle', chief: 'Metz', region: 'Est' }),
    quiz.grade(quiz.byKey.get('c'), { name: 'Gironde', chief: '', region: '' }),
  ];
  assert.equal(quiz.totalScore(answers), 4);
  assert.equal(quiz.totalScore([]), 0);
});

test('« À revoir » classe du moins bien su au mieux su', () => {
  const stats = {
    a: { seen: 2, name: 0, chief: 0, region: 0, lastSeen: '2026-08-08' },
    c: { seen: 1, name: 1, chief: 0, region: 1 },
    e: { seen: 1, name: 1, chief: 1, region: 1 },
    g: { seen: 1, name: 0, chief: 0, region: 1 },
  };
  const label = (code) => quiz.byKey.get(code)?.name;

  const worst = weakest(stats, { points: 3, label });
  // « e » est su, il ne remonte pas ; « a » (0 / 6) est le pire, puis « g »
  // (1 / 3) et « c » (2 / 3).
  assert.deepEqual(worst, ['Moselle', 'Var', 'Gironde']);
  assert.deepEqual(weakest(stats, { points: 3, label, limit: 1 }), ['Moselle']);

  // Un item disparu du corpus n'a pas de libellé : il est ignoré.
  assert.deepEqual(weakest({ zz: { seen: 1, name: 0 } }, { points: 3, label }), []);
  assert.deepEqual(weakest(undefined, { points: 3, label }), []);
});

test('les items partageant un libellé sont fondus en une seule entrée', () => {
  // Les tableaux comptent par peintre, pas par œuvre.
  const stats = {
    a: { seen: 1, name: 0, chief: 0, region: 0 },
    b: { seen: 1, name: 1, chief: 1, region: 1 },
    c: { seen: 1, name: 1, chief: 1, region: 0 },
  };
  const worst = weakest(stats, { points: 3, label: (code) => quiz.byKey.get(code)?.region });
  // Est : 3 justes sur 6. Ouest : 2 sur 3.
  assert.deepEqual(worst, ['Est', 'Ouest']);
});

/** La description du quiz factice, à ré-décliner d'un test à l'autre. */
function quizSpec() {
  return {
    namespace: 'test',
    items: ITEMS,
    textFields: ['name', 'chief'],
    accepted,
    choiceFields: { region: (item, given) => given === item.region },
    questionsPerDay: 3,
  };
}
