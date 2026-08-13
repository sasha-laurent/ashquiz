import assert from 'node:assert/strict';
import test from 'node:test';

import { BY_CODE, ROOTS, accepted, doublet } from '../src/data/roots.js';
import { QUIZ, buildSession, grade, maxScore, totalScore } from '../src/lib/quiz-roots.js';
import { createLocalAdapter, createStore } from '../src/lib/storage.js';
import { check, variants } from '../src/lib/text.js';

const root = (code) => BY_CODE.get(code);

test('le corpus est complet et sans doublon de code', () => {
  assert.equal(BY_CODE.size, ROOTS.length);
  for (const entry of ROOTS) {
    assert.match(entry.code, /^[a-z-]+$/, `code inattendu : ${entry.code}`);
    assert.ok(entry.form?.length, `graphie manquante sur ${entry.code}`);
    assert.ok(entry.sens?.length, `sens manquant sur ${entry.code}`);
    assert.ok(entry.famille?.length, `famille manquante sur ${entry.code}`);
    assert.ok(entry.exemples?.length, `exemple manquant sur ${entry.code}`);
    assert.ok(['préfixe', 'suffixe', 'radical'].includes(entry.type), `type : ${entry.code}`);
    assert.ok(['grec', 'latin'].includes(entry.origine), `origine : ${entry.code}`);
  }
});

test('les deux origines sont à parts égales', () => {
  // L'origine est une sous-réponse à deux valeurs : un corpus déséquilibré
  // ferait payer « répondre toujours grec », et elle ne mesurerait plus rien.
  const grec = ROOTS.filter((entry) => entry.origine === 'grec').length;
  const part = grec / ROOTS.length;
  assert.ok(part > 0.45 && part < 0.55, `${Math.round(part * 100)} % de racines grecques`);
});

test('chaque famille peut remplir un carré de quatre', () => {
  const sizes = new Map();
  for (const entry of ROOTS) sizes.set(entry.famille, (sizes.get(entry.famille) ?? 0) + 1);
  for (const [famille, size] of sizes) {
    assert.ok(size >= 4, `famille « ${famille} » : ${size} racines, il en faut 4`);
  }
});

test('les sens attendus sont ceux qu’on a en tête', () => {
  for (const [code, sens, origine] of [
    ['poly', 'plusieurs', 'grec'],
    ['aqua', 'eau', 'latin'],
    ['cide', 'tuer', 'latin'],
    ['logo', 'parole', 'grec'],
    ['pede', 'pied', 'latin'],
    ['ped-enfant', 'enfant', 'grec'],
  ]) {
    assert.equal(root(code).sens, sens, code);
    assert.equal(root(code).origine, origine, code);
  }
});

test('les formulations équivalentes sont acceptées', () => {
  for (const [code, given] of [
    ['poly', 'nombreux'],
    ['anthropo', 'être humain'],
    ['phile', 'AIMER'],
    ['bio', 'la vie'],
    ['crate', 'gouvernement'],
    ['metre', 'mesurer'],
  ]) {
    assert.equal(check(given, accepted(root(code), 'sens')).status, 'correct', `${given} refusé`);
  }
  // Les tolérances habituelles jouent dès que le mot est assez long.
  assert.equal(check('challeur', accepted(root('thermo'), 'sens')).status, 'typo');
  assert.equal(check('semblabe', accepted(root('homo'), 'sens')).status, 'typo');
});

test('le sens exact d’une autre racine n’est jamais toléré', () => {
  // « droite » (dextr-) est à une lettre de « droit » (rect-, ortho-).
  assert.equal(grade(root('rect'), { sens: 'droite', origine: null }).sens.ok, false);
  assert.equal(grade(root('dext'), { sens: 'droit', origine: null }).sens.ok, false);

  // Et aucune paire de racines ne doit se confondre, dans aucun sens — sauf
  // là où la réponse est légitimement commune (hydro- et aqua- disent « eau »).
  for (const a of ROOTS) {
    const answers = accepted(a, 'sens');
    for (const b of ROOTS) {
      if (a === b) continue;
      const shared = new Set(accepted(b, 'sens').flatMap(variants));
      for (const answer of answers) {
        if (variants(answer).some((form) => shared.has(form))) continue;
        const result = grade(b, { sens: answer, origine: null });
        assert.equal(result.sens.ok, false, `« ${answer} » (${a.code}) accepté pour ${b.code}`);
      }
    }
  }
});

test('les doublets se déduisent du corpus', () => {
  for (const [code, expected] of [
    ['hydro', 'aqua'],
    ['aqua', 'hydro'],
    ['poly', 'multi'],
    ['mono', 'uni'],
    ['necro', 'mort'],
    ['ortho', 'rect'],
  ]) {
    assert.equal(doublet(root(code))?.code, expected, code);
  }
  // Un doublet est toujours de l'autre langue, et dit bien la même chose.
  for (const entry of ROOTS) {
    const pair = doublet(entry);
    if (!pair) continue;
    assert.notEqual(pair.origine, entry.origine, entry.code);
    assert.equal(pair.sens, entry.sens, entry.code);
  }
});

test('la série du jour est déterministe et sans doublon', () => {
  const a = buildSession('2026-08-13').map((entry) => entry.code);
  const b = buildSession('2026-08-13').map((entry) => entry.code);
  const c = buildSession('2026-08-14').map((entry) => entry.code);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 5);
  assert.equal(new Set(a).size, 5);
});

test('une série ne pose jamais deux fois le même sens', () => {
  // Sans quoi hydro- et aqua- tomberaient le même jour, et la réponse serait à
  // taper deux fois.
  for (let day = 1; day <= 60; day++) {
    const seed = `2026-09-${String(day).padStart(2, '0')}`;
    const senses = buildSession(seed).map((entry) => entry.sens);
    assert.equal(new Set(senses).size, senses.length, seed);
  }
});

test('la notation attribue un point par sous-réponse', () => {
  const poly = root('poly');
  const perfect = grade(poly, { sens: 'plusieurs', origine: 'grec' });
  assert.equal(perfect.score, 2);

  const partial = grade(poly, { sens: 'plusieurs', origine: 'latin' });
  assert.equal(partial.score, 1);
  assert.equal(partial.origine.ok, false);

  const none = grade(poly, { sens: '', origine: null });
  assert.equal(none.score, 0);

  assert.equal(totalScore([perfect, partial, none]), 3);
  assert.equal(maxScore(), 10);
});

test('le mode carré ne porte que sur le sens', () => {
  const choices = QUIZ.buildChoices(root('poly'), '2026-08-13');
  assert.ok(choices.sens);
  // L'origine n'a que deux valeurs : un carré à quatre cases n'y a pas sa place.
  assert.equal(choices.origine, undefined);
});

test('les leurres du carré sont du même champ sémantique', () => {
  for (const entry of ROOTS) {
    const { values, correct } = QUIZ.buildChoices(entry, '2026-08-13').sens;
    assert.equal(values.length, 4, `${entry.code} : quatre propositions attendues`);
    assert.ok(values.includes(correct), `${entry.code} : bonne réponse absente`);
    assert.equal(new Set(values).size, 4, `${entry.code} : proposition en double`);

    const family = ROOTS.filter((other) => other.famille === entry.famille);
    if (family.length < 4) continue;
    for (const value of values) {
      assert.ok(
        family.some((other) => other.sens === value),
        `${entry.code} : « ${value} » n'est pas de la famille « ${entry.famille} »`,
      );
    }
  }

  // Même graine, mêmes propositions dans le même ordre.
  assert.deepEqual(
    QUIZ.buildChoices(root('hydro'), '2026-08-13').sens.values,
    QUIZ.buildChoices(root('hydro'), '2026-08-13').sens.values,
  );
});

test('les stats des racines vivent dans leur propre espace', async () => {
  let saved = null;
  const memory = {
    async read() {
      return saved ? structuredClone(saved) : { version: 1, days: {}, roots: {} };
    },
    async write(data) {
      saved = structuredClone(data);
    },
    async clear() {
      saved = null;
    },
  };
  const store = createStore(memory, { statsKey: 'roots' });
  const answers = [grade(root('poly'), { sens: 'plusieurs', origine: 'latin' })];
  await store.saveDay('2026-08-13', { date: '2026-08-13', mode: 'daily', answers, score: 1, max: 2 });

  const progress = await store.getState();
  assert.equal(progress.roots.poly.seen, 1);
  assert.equal(progress.roots.poly.sens, 1);
  assert.equal(progress.roots.poly.origine, 0);
  assert.equal(progress.departments, undefined);
  assert.equal(progress.countries, undefined);
});

test('le quiz des racines a sa propre clé de stockage', async () => {
  const written = new Map();
  globalThis.localStorage = {
    getItem: (key) => written.get(key) ?? null,
    setItem: (key, value) => written.set(key, value),
    removeItem: (key) => written.delete(key),
  };
  const adapter = createLocalAdapter({ key: 'ashquiz.racines.v1', statsKey: 'roots' });
  await adapter.write({ version: 1, days: { '2026-08-13': {} }, roots: {} });
  assert.ok(written.has('ashquiz.racines.v1'));
  assert.equal(written.has('ashquiz.v1'), false);
  delete globalThis.localStorage;
});
