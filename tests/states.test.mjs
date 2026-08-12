import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { BY_CODE, STATES, accepted } from '../src/data/states.js';
import { buildMapModel } from '../src/lib/geo-states.js';
import { QUIZ, buildSession, grade, maxScore, totalScore } from '../src/lib/quiz-states.js';
import { createLocalAdapter, createStore } from '../src/lib/storage.js';
import { check } from '../src/lib/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = (code) => BY_CODE.get(code);

test('les 50 États sont présents, uniques et complets', () => {
  assert.equal(STATES.length, 50);
  assert.equal(BY_CODE.size, 50);
  for (const entry of STATES) {
    assert.match(entry.code, /^[A-Z]{2}$/, `code inattendu : ${entry.code}`);
    assert.ok(entry.name?.length, `nom manquant sur ${entry.code}`);
    assert.ok(entry.capital?.length, `capitale manquante sur ${entry.code}`);
    assert.ok(entry.region?.length, `région manquante sur ${entry.code}`);
  }
  // Le district de Columbia n'est pas un État.
  assert.equal(BY_CODE.has('DC'), false);
});

test('la capitale est bien celle de l’État, pas sa plus grande ville', () => {
  const cases = [
    ['NY', 'Albany'],
    ['CA', 'Sacramento'],
    ['IL', 'Springfield'],
    ['WA', 'Olympia'],
    ['AK', 'Juneau'],
    ['TX', 'Austin'],
  ];
  for (const [code, capital] of cases) {
    assert.equal(state(code).capital, capital, code);
  }
});

test('les noms anglais et les variantes sont acceptés', () => {
  for (const [code, name] of [
    ['CA', 'California'],
    ['NC', 'North Carolina'],
    ['NM', 'New Mexico'],
    ['WV', 'West Virginia'],
    ['HI', 'Hawaii'],
    ['GA', 'Georgia'],
    ['PA', 'Pennsylvania'],
  ]) {
    assert.equal(check(name, accepted(state(code), 'name')).status, 'correct', `${name} refusé`);
  }
  // Accents, tirets et casse restent tolérés, comme partout ailleurs.
  assert.equal(check('nouveau mexique', accepted(state('NM'), 'name')).status, 'correct');
  assert.equal(check('BATON-ROUGE', accepted(state('LA'), 'capital')).status, 'correct');
  assert.equal(check('St. Paul', accepted(state('MN'), 'capital')).status, 'correct');
});

test('le nom exact d’un autre État n’est jamais toléré', () => {
  // « Dover » (Delaware) est à une lettre de « Denver » (Colorado).
  assert.equal(grade(state('CO'), { name: '', capital: 'Dover', map: null }).capital.ok, false);
  assert.equal(
    grade(state('ND'), { name: 'Dakota du Sud', capital: '', map: null }).name.ok,
    false,
  );

  // Et aucune paire d'États ne doit être confondue, dans aucun sens.
  for (const field of ['name', 'capital']) {
    for (const a of STATES) {
      for (const b of STATES) {
        if (a === b || a[field] === b[field]) continue;
        const answer = grade(b, { name: a.name, capital: a.capital, map: null });
        assert.equal(answer[field].ok, false, `${a[field]} accepté pour ${b.code} ${b[field]}`);
      }
    }
  }
});

test('la série du jour est déterministe et sans doublon', () => {
  const a = buildSession('2026-08-08').map((s) => s.code);
  const b = buildSession('2026-08-08').map((s) => s.code);
  const c = buildSession('2026-08-09').map((s) => s.code);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 5);
  assert.equal(new Set(a).size, 5);
  // Chaque thème a sa propre graine : deux quiz du même jour ne se calquent pas.
  assert.notDeepEqual(a, buildSession('2026-08-08', (code) => code !== a[0]).map((s) => s.code));
});

test('le filtre de tirage est respecté', () => {
  const codes = buildSession('2026-08-08', (code) => code.startsWith('N')).map((s) => s.code);
  assert.equal(codes.length, 5);
  assert.ok(codes.every((code) => code.startsWith('N')));
});

test('la notation attribue un point par sous-réponse', () => {
  const utah = state('UT');
  const perfect = grade(utah, { name: 'utah', capital: 'Salt Lake City', map: 'UT' });
  assert.equal(perfect.score, 3);

  const partial = grade(utah, { name: 'Utah', capital: 'Denver', map: 'CO' });
  assert.equal(partial.score, 1);
  assert.equal(partial.capital.ok, false);
  assert.equal(partial.map.ok, false);

  const typo = grade(utah, { name: 'Utah', capital: 'Salt Lake Citty', map: null });
  assert.equal(typo.score, 2);
  assert.equal(typo.capital.typo, true);

  assert.equal(totalScore([perfect, partial, typo]), 6);
  assert.equal(maxScore(), 15);
});

test('le mode carré propose quatre États, les mêmes pour les trois sous-réponses', () => {
  for (const code of ['MO', 'DE', 'RI', 'CA', 'TX']) {
    const item = state(code);
    const choices = QUIZ.buildChoices(item, '2026-08-08');
    assert.equal(choices.map.values.length, 4, `${code} : quatre zones attendues`);
    assert.ok(choices.map.values.includes(code), `${code} : bonne réponse absente`);

    // Les noms et les capitales proposés sont ceux des quatre États en jeu.
    const proposed = choices.map.values.map((value) => BY_CODE.get(value));
    assert.deepEqual(
      [...choices.name.values].sort(),
      proposed.map((s) => s.name).sort(),
    );
    assert.deepEqual(
      [...choices.capital.values].sort(),
      proposed.map((s) => s.capital).sort(),
    );

    // Un même tirage donne toujours les mêmes propositions, dans le même ordre.
    assert.deepEqual(QUIZ.buildChoices(item, '2026-08-08').name.values, choices.name.values);
  }
});

test('les leurres du carré sont des confusions plausibles', () => {
  // Missouri : les autres États en M, pas la Floride.
  const missouri = QUIZ.buildChoices(state('MO'), '2026-08-08').map.values;
  assert.ok(missouri.every((code) => code.startsWith('M')));

  // Delaware est seul sous son initiale : sa région complète le carré.
  const delaware = QUIZ.buildChoices(state('DE'), '2026-08-08').map.values;
  assert.ok(
    delaware.every((code) => BY_CODE.get(code).region === state('DE').region),
    `région attendue, obtenu ${delaware.join(', ')}`,
  );
});

test('la carte est projetée en groupes cliquables', async () => {
  const path = resolve(ROOT, 'data/etats-unis.geojson');
  const raw = await readFile(path, 'utf8').catch(() => {
    assert.fail(`${path} manquant : lancer \`npm run build:states\`.`);
  });
  const geojson = JSON.parse(raw);
  const model = buildMapModel(geojson);

  const ids = model.groups.map((g) => g.id);
  assert.ok(ids.includes('contigus'));
  for (const inset of ['AK', 'HI', 'nouvelle-angleterre', 'atlantique']) {
    assert.ok(ids.includes(inset), `encart manquant : ${inset}`);
  }

  const codes = model.groups.flatMap((g) => g.shapes.map((s) => s.code));
  for (const entry of STATES) {
    assert.ok(codes.includes(entry.code), `${entry.code} absent du fond de carte`);
  }
  // Aucune zone étrangère au corpus : ni district de Columbia, ni province voisine.
  for (const code of codes) assert.ok(BY_CODE.has(code), `zone inattendue : ${code}`);
  // Le Rhode Island figure deux fois : dans les 48 contigus et dans son encart.
  assert.equal(codes.filter((code) => code === 'RI').length, 2);
  // L'Alaska et Hawaï, seulement dans le leur.
  assert.equal(codes.filter((code) => code === 'AK').length, 1);

  for (const group of model.groups) {
    for (const shape of group.shapes) {
      assert.match(shape.d, /^M[\d.]+ [\d.]+/, `${shape.code} : tracé inattendu`);
      for (const [x, y] of coordsOf(shape.d)) {
        assert.ok(x >= 0 && x <= model.view.width, `${shape.code} : x hors cadre (${x})`);
        assert.ok(y >= 0 && y <= model.view.height, `${shape.code} : y hors cadre (${y})`);
      }
    }
  }
});

function coordsOf(path) {
  return [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

test('la carte lit aussi le fichier Natural Earth d’origine', () => {
  // Repli du site quand `npm run build:states` n'a pas été lancé : le fichier
  // mondial, où les États américains se reconnaissent à leur `iso_3166_2`.
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
  const model = buildMapModel({
    type: 'FeatureCollection',
    features: [
      { properties: { iso_3166_2: 'US-TX' }, geometry: square(-99, 31) },
      { properties: { iso_3166_2: 'US-CO' }, geometry: square(-105, 39) },
      // Sonora (Mexique) et Colombie-Britannique : hors sujet, donc hors carte.
      { properties: { iso_3166_2: 'MX-SON' }, geometry: square(-110, 29) },
      { properties: { iso_3166_2: 'CA-BC' }, geometry: square(-125, 54) },
    ],
  });

  const codes = model.groups.flatMap((g) => g.shapes.map((s) => s.code));
  assert.deepEqual(codes.sort(), ['CO', 'TX']);
});

test('les stats des États vivent dans leur propre espace', async () => {
  let saved = null;
  const memory = {
    async read() {
      return saved ? structuredClone(saved) : { version: 1, days: {}, states: {} };
    },
    async write(data) {
      saved = structuredClone(data);
    },
    async clear() {
      saved = null;
    },
  };
  const store = createStore(memory, { statsKey: 'states' });
  const answers = [grade(state('OR'), { name: 'Oregon', capital: 'Portland', map: 'OR' })];
  await store.saveDay('2026-08-08', {
    date: '2026-08-08',
    mode: 'daily',
    answers,
    score: 2,
    max: 3,
  });

  const progress = await store.getState();
  assert.equal(progress.states.OR.seen, 1);
  assert.equal(progress.states.OR.name, 1);
  assert.equal(progress.states.OR.capital, 0);
  assert.equal(progress.states.OR.map, 1);
  assert.equal(progress.departments, undefined);
  assert.equal(progress.countries, undefined);
});

test('le quiz des États a sa propre clé de stockage', async () => {
  const written = new Map();
  globalThis.localStorage = {
    getItem: (key) => written.get(key) ?? null,
    setItem: (key, value) => written.set(key, value),
    removeItem: (key) => written.delete(key),
  };
  const adapter = createLocalAdapter({ key: 'ashquiz.etats-unis.v1', statsKey: 'states' });
  await adapter.write({ version: 1, days: { '2026-08-08': {} }, states: {} });
  assert.ok(written.has('ashquiz.etats-unis.v1'));
  assert.equal(written.has('ashquiz.v1'), false);
  delete globalThis.localStorage;
});
