import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { BY_CODE, COUNTRIES, accepted } from '../src/data/countries.js';
import { buildSession, grade, maxScore, totalScore } from '../src/lib/quiz-countries.js';
import { createLocalAdapter, createStore } from '../src/lib/storage.js';

const country = (code) => BY_CODE.get(code);

test('la liste couvre les 193 États membres de l’ONU, sans doublon', () => {
  assert.equal(COUNTRIES.length, 193);
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, 193);
  for (const entry of COUNTRIES) {
    assert.match(entry.code, /^[a-z]{2}$/, `code ISO inattendu : ${entry.code}`);
    assert.ok(entry.name?.length, `nom manquant sur ${entry.code}`);
    assert.ok(entry.capital?.length, `capitale manquante sur ${entry.code}`);
    assert.ok(entry.commons?.endsWith('.svg'), `drapeau Commons manquant sur ${entry.code}`);
  }
});

test('la série du jour est déterministe, sans doublon et de bonne taille', () => {
  const a = buildSession('2026-08-08').map((c) => c.code);
  const b = buildSession('2026-08-08').map((c) => c.code);
  const c = buildSession('2026-08-09').map((c) => c.code);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 5);
  assert.equal(new Set(a).size, 5);
});

test('la correction accepte accents, casse et fautes légères', () => {
  const exact = grade(country('de'), { name: 'allemagne', capital: 'BERLIN' });
  assert.equal(exact.score, 2);
  assert.equal(exact.name.typo, false);

  const typo = grade(country('pt'), { name: 'Portugual', capital: 'Lisbone' });
  assert.equal(typo.name.ok, true);
  assert.equal(typo.name.typo, true);
  assert.equal(typo.capital.ok, true);
  assert.equal(typo.score, 2);
});

test('le nom exact d’un autre pays n’est jamais toléré', () => {
  // « Niger » et « Nigeria » sont à deux lettres l'un de l'autre.
  assert.equal(grade(country('ng'), { name: 'Niger', capital: '' }).name.ok, false);
  assert.equal(grade(country('si'), { name: 'Slovaquie', capital: '' }).name.ok, false);
  // Et la même garde vaut pour les capitales.
  assert.equal(grade(country('at'), { name: '', capital: 'Vilnius' }).capital.ok, false);
});

test('les alias déclarés sont acceptés', () => {
  for (const [code, name] of [
    ['mm', 'Myanmar'],
    ['cz', 'République tchèque'],
    ['us', 'USA'],
    ['sz', 'Swaziland'],
    ['cd', 'RDC'],
  ]) {
    assert.equal(grade(country(code), { name, capital: '' }).name.ok, true, `« ${name} » refusé`);
  }
  for (const [code, capital] of [
    ['ua', 'Kyiv'],
    ['cn', 'Beijing'],
    ['bd', 'Dhaka'],
  ]) {
    assert.equal(
      grade(country(code), { name: '', capital }).capital.ok,
      true,
      `« ${capital} » refusé`,
    );
  }
});

test('les pays à plusieurs capitales les acceptent toutes', () => {
  for (const capital of ['Pretoria', 'Le Cap', 'Bloemfontein']) {
    assert.equal(grade(country('za'), { name: '', capital }).capital.ok, true, capital);
  }
  for (const capital of ['Sucre', 'La Paz']) {
    assert.equal(grade(country('bo'), { name: '', capital }).capital.ok, true, capital);
  }
  // La première reste la réponse affichée.
  assert.equal(accepted(country('za'), 'capital')[0], 'Pretoria');
});

test('une réponse vide ou fantaisiste ne rapporte rien', () => {
  const empty = grade(country('fr'), { name: '', capital: '' });
  assert.equal(empty.score, 0);
  assert.equal(grade(country('fr'), { name: 'Belgique', capital: 'Bruxelles' }).score, 0);
});

test('le score cumule les deux sous-réponses', () => {
  const answers = [
    grade(country('jp'), { name: 'Japon', capital: 'Tokyo' }),
    grade(country('br'), { name: 'Brésil', capital: 'Rio' }),
  ];
  assert.equal(answers[0].score, 2);
  assert.equal(answers[1].score, 1);
  assert.equal(totalScore(answers), 3);
  assert.equal(maxScore(2), 4);
  assert.equal(maxScore(), 10);
});

test('les stats des pays vivent dans leur propre espace', async () => {
  let saved = null;
  const memory = {
    async read() {
      return saved ? structuredClone(saved) : { version: 1, days: {}, countries: {} };
    },
    async write(data) {
      saved = structuredClone(data);
    },
    async clear() {
      saved = null;
    },
  };
  const store = createStore(memory, { statsKey: 'countries' });
  const answers = [grade(country('fr'), { name: 'France', capital: 'Lyon' })];
  await store.saveDay('2026-08-08', { date: '2026-08-08', mode: 'daily', answers, score: 1, max: 2 });

  const state = await store.getState();
  assert.equal(state.countries.fr.seen, 1);
  assert.equal(state.countries.fr.name, 1);
  assert.equal(state.countries.fr.capital, 0);
  assert.equal(state.countries.fr.lastSeen, '2026-08-08');
  assert.equal(state.paintings, undefined);
  assert.equal(state.departments, undefined);
});

test('le quiz des pays a sa propre clé de stockage', async () => {
  const written = new Map();
  globalThis.localStorage = {
    getItem: (key) => written.get(key) ?? null,
    setItem: (key, value) => written.set(key, value),
    removeItem: (key) => written.delete(key),
  };
  const adapter = createLocalAdapter({ key: 'ashquiz.pays.v1', statsKey: 'countries' });
  await adapter.write({ version: 1, days: { '2026-08-08': {} }, countries: {} });
  assert.ok(written.has('ashquiz.pays.v1'));
  assert.equal(written.has('ashquiz.v1'), false);
  assert.equal(written.has('ashquiz.tableaux.v1'), false);
  delete globalThis.localStorage;
});

test('chaque pays a son drapeau vendorisé', async () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'drapeaux');
  try {
    await access(dir);
  } catch {
    // Les images sont produites par `npm run build:flags` : sans elles, le reste
    // des tests reste valable, on ne fait pas échouer la suite.
    return;
  }

  const files = new Set(await readdir(dir));
  for (const entry of COUNTRIES) {
    assert.ok(files.has(`${entry.code}.png`), `drapeau manquant : ${entry.code} (${entry.name})`);
  }
  // Et pas de drapeau orphelin, resté après un retrait de la liste.
  assert.equal(files.size, COUNTRIES.length);
});
