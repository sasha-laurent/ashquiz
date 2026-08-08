import assert from 'node:assert/strict';
import test from 'node:test';

import { BY_CODE, DEPARTMENTS, accepted } from '../src/data/departments.js';
import { buildMapModel } from '../src/lib/geo.js';
import { buildSession, grade, totalScore } from '../src/lib/quiz.js';
import { makeRng, sample } from '../src/lib/rng.js';
import { createStore, streak } from '../src/lib/storage.js';
import { check, normalize } from '../src/lib/text.js';

test('les 101 départements sont présents et uniques', () => {
  assert.equal(DEPARTMENTS.length, 101);
  assert.equal(BY_CODE.size, 101);
  for (const dep of DEPARTMENTS) {
    assert.ok(dep.name && dep.prefecture, `${dep.code} incomplet`);
  }
  for (const code of ['2A', '2B', '75', '976']) {
    assert.ok(BY_CODE.has(code), `${code} manquant`);
  }
});

test('la correction tolère casse, accents, tirets et abréviations', () => {
  assert.equal(normalize('Saint-Étienne'), 'st etienne');
  const cases = [
    ['ISERE', 'Isère'],
    ['cote dor', "Côte-d'Or"],
    ['st brieuc', 'Saint-Brieuc'],
    ['bourg en bresse', 'Bourg-en-Bresse'],
    ['chalons en champagne', 'Châlons-en-Champagne'],
  ];
  for (const [given, expected] of cases) {
    assert.equal(check(given, [expected]).status, 'correct', `${given} → ${expected}`);
  }
});

test('une petite faute de frappe passe, une mauvaise réponse non', () => {
  assert.equal(check('Grenoble', ['Grenoble']).status, 'correct');
  assert.equal(check('Grenobles', ['Grenoble']).status, 'typo');
  assert.equal(check('Lyon', ['Grenoble']).status, 'wrong');
  assert.equal(check('', ['Grenoble']).status, 'wrong');
  // Mots courts : aucune tolérance, sinon Gap ≈ Pau.
  assert.equal(check('Pau', ['Gap']).status, 'wrong');
});

test('les alias déclarés sont acceptés', () => {
  const essonne = BY_CODE.get('91');
  assert.equal(check('Évry', accepted(essonne, 'prefecture')).status, 'correct');
  const valDoise = BY_CODE.get('95');
  assert.equal(check('Cergy-Pontoise', accepted(valDoise, 'prefecture')).status, 'correct');
});

test('la série du jour est déterministe et sans doublon', () => {
  const a = buildSession('2026-08-08').map((d) => d.code);
  const b = buildSession('2026-08-08').map((d) => d.code);
  const c = buildSession('2026-08-09').map((d) => d.code);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(new Set(a).size, 5);
});

test('le filtre de tirage est respecté', () => {
  const codes = buildSession('2026-08-08', (code) => code.startsWith('7')).map((d) => d.code);
  assert.ok(codes.every((code) => code.startsWith('7')));
});

test("le nom exact d'un autre département n'est jamais toléré", () => {
  const loiret = BY_CODE.get('45');
  assert.equal(grade(loiret, { name: 'Loire', prefecture: 'Orléans', map: '45' }).name.ok, false);

  const hauteMarne = BY_CODE.get('52');
  assert.equal(grade(hauteMarne, { name: 'Haute-Saône', prefecture: '', map: null }).name.ok, false);

  // Aucune paire de départements ne doit être confondue, dans aucun sens.
  for (const field of ['name', 'prefecture']) {
    for (const a of DEPARTMENTS) {
      for (const b of DEPARTMENTS) {
        if (a === b || a[field] === b[field]) continue;
        const answer = grade(b, { name: a.name, prefecture: a.prefecture, map: null });
        assert.equal(answer[field].ok, false, `${a[field]} accepté pour ${b.code} ${b[field]}`);
      }
    }
  }
});

test('sample tire des éléments distincts', () => {
  const rng = makeRng('seed');
  const drawn = sample([1, 2, 3, 4, 5, 6], 4, rng);
  assert.equal(new Set(drawn).size, 4);
});

test('la notation attribue un point par sous-réponse', () => {
  const isere = BY_CODE.get('38');
  const perfect = grade(isere, { name: 'isere', prefecture: 'Grenoble', map: '38' });
  assert.equal(perfect.score, 3);

  const partial = grade(isere, { name: 'Isère', prefecture: 'Lyon', map: '69' });
  assert.equal(partial.score, 1);
  assert.equal(partial.prefecture.ok, false);
  assert.equal(partial.map.ok, false);

  const typo = grade(isere, { name: 'Isere', prefecture: 'Grenobel', map: null });
  assert.equal(typo.score, 2);
  assert.equal(typo.prefecture.typo, true);

  assert.equal(totalScore([perfect, partial, typo]), 6);
});

test('la carte est projetée en groupes cliquables', () => {
  const square = (lon, lat) => ({
    type: 'Polygon',
    coordinates: [
      [
        [lon, lat],
        [lon + 1, lat],
        [lon + 1, lat + 1],
        [lon, lat + 1],
        [lon, lat],
      ],
    ],
  });
  const geojson = {
    type: 'FeatureCollection',
    features: [
      { properties: { code: '38' }, geometry: square(5, 45) },
      { properties: { code: '75' }, geometry: square(2, 48) },
      { properties: { code: '974' }, geometry: square(55, -21) },
    ],
  };

  const model = buildMapModel(geojson);
  const ids = model.groups.map((g) => g.id);
  assert.ok(ids.includes('metropole'));
  assert.ok(ids.includes('idf'));
  assert.ok(ids.includes('974'));
  // Pas d'encart pour les DOM absents du GeoJSON.
  assert.ok(!ids.includes('971'));

  const codes = model.groups.flatMap((g) => g.shapes.map((s) => s.code));
  assert.ok(codes.includes('38'));
  // Paris figure deux fois : dans la métropole et dans l'encart.
  assert.equal(codes.filter((code) => code === '75').length, 2);

  for (const group of model.groups) {
    for (const shape of group.shapes) {
      assert.match(shape.d, /^M[\d.]+ [\d.]+/);
      for (const [x, y] of coordsOf(shape.d)) {
        assert.ok(x >= 0 && x <= model.view.width, `x hors cadre : ${x}`);
        assert.ok(y >= 0 && y <= model.view.height, `y hors cadre : ${y}`);
      }
    }
  }
});

function coordsOf(path) {
  return [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

test('la persistance agrège les statistiques par département', async () => {
  let saved = null;
  const memory = {
    async read() {
      return saved ? structuredClone(saved) : { version: 1, days: {}, departments: {} };
    },
    async write(data) {
      saved = structuredClone(data);
    },
    async clear() {
      saved = null;
    },
  };
  const store = createStore(memory);
  const isere = BY_CODE.get('38');
  const day = {
    date: '2026-08-08',
    mode: 'daily',
    answers: [grade(isere, { name: 'Isère', prefecture: 'Lyon', map: '38' })],
    score: 2,
    max: 3,
  };

  await store.saveDay('2026-08-08', day);
  const state = await store.getState();
  assert.equal(state.departments['38'].seen, 1);
  assert.equal(state.departments['38'].prefecture, 0);
  assert.equal(state.departments['38'].map, 1);
  assert.equal((await store.getDay('2026-08-08')).score, 2);
});

test('la série compte les jours consécutifs', () => {
  const days = { '2026-08-06': {}, '2026-08-07': {}, '2026-08-08': {} };
  assert.equal(streak(days, '2026-08-08'), 3);
  // Quiz du jour pas encore fait : la série court jusqu'à la veille.
  assert.equal(streak(days, '2026-08-09'), 3);
  assert.equal(streak(days, '2026-08-10'), 0);
  assert.equal(streak({}, '2026-08-08'), 0);
});
