import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { BY_CODE, FAMILIES, PLANTS, accepted } from '../src/data/plants.js';
import { QUIZ, buildSession, grade, maxScore, totalScore } from '../src/lib/quiz-plants.js';
import { createLocalAdapter, createStore } from '../src/lib/storage.js';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'plantes');

/** Une plante par son nom français : les codes (`p019`) ne se retiennent pas. */
const plant = (name) => {
  const found = PLANTS.find((entry) => entry.name === name);
  assert.ok(found, `plante absente du corpus : ${name}`);
  return found;
};

test('chaque espèce a un code neutre, un nom, un nom scientifique et une famille', () => {
  assert.ok(PLANTS.length >= 50);
  assert.equal(new Set(PLANTS.map((p) => p.code)).size, PLANTS.length, 'codes dupliqués');
  assert.equal(new Set(PLANTS.map((p) => p.name)).size, PLANTS.length, 'noms dupliqués');
  assert.equal(new Set(PLANTS.map((p) => p.latin)).size, PLANTS.length, 'espèces dupliquées');

  for (const entry of PLANTS) {
    // Le code nomme le fichier image : s'il disait l'espèce, l'onglet réseau
    // donnerait la réponse.
    assert.match(entry.code, /^p\d{3}$/, `code inattendu : ${entry.code}`);
    assert.doesNotMatch(
      entry.code,
      new RegExp(entry.name.slice(0, 4), 'i'),
      `le code ${entry.code} laisse deviner ${entry.name}`,
    );
    assert.match(entry.latin, /^[A-Z][a-z]+ [a-z-]+$/, `nom scientifique douteux : ${entry.latin}`);
    assert.ok(entry.family?.length, `famille manquante sur ${entry.name}`);
    assert.match(entry.familyLatin, /aceae$/, `famille scientifique douteuse sur ${entry.name}`);
  }
});

test('une famille scientifique a toujours le même nom français', () => {
  const byLatin = new Map();
  for (const entry of PLANTS) {
    const known = byLatin.get(entry.familyLatin);
    if (known) assert.equal(entry.family, known, `${entry.familyLatin} traduit de deux façons`);
    else byLatin.set(entry.familyLatin, entry.family);
  }
  assert.equal(FAMILIES.length, byLatin.size);

  // Le thème n'a d'intérêt que si les familles se recoupent : une famille par
  // espèce serait un second nom à retenir, pas un classement. Les familles à
  // espèce unique restent bienvenues (les ginkgoacées n'en comptent qu'une),
  // mais elles ne doivent pas faire le gros du corpus.
  const counts = new Map();
  for (const entry of PLANTS) counts.set(entry.family, (counts.get(entry.family) ?? 0) + 1);
  const shared = PLANTS.filter((entry) => counts.get(entry.family) > 1).length;
  assert.ok(shared > PLANTS.length * 0.6, `familles trop dispersées : ${shared}/${PLANTS.length}`);
});

test('la série du jour est déterministe, sans doublon et de bonne taille', () => {
  const a = buildSession('2026-08-08').map((p) => p.code);
  const b = buildSession('2026-08-08').map((p) => p.code);
  const c = buildSession('2026-08-09').map((p) => p.code);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 5);
  assert.equal(new Set(a).size, 5);
});

test('une même série ne pose jamais deux fois la même famille', () => {
  for (const day of ['2026-08-08', '2026-08-09', '2026-09-01', '2027-01-15']) {
    const families = buildSession(day).map((p) => p.family);
    assert.equal(new Set(families).size, families.length, `familles répétées le ${day}`);
  }
});

test('la correction accepte accents, casse et fautes légères', () => {
  const exact = grade(plant('Coquelicot'), { name: 'coquelicot', family: 'PAPAVÉRACÉES' });
  assert.equal(exact.score, 2);
  assert.equal(exact.name.typo, false);

  const typo = grade(plant('Pâquerette'), { name: 'Paquerete', family: 'Asteracées' });
  assert.equal(typo.name.ok, true);
  assert.equal(typo.name.typo, true);
  assert.equal(typo.family.ok, true);
  assert.equal(typo.score, 2);
});

test('la famille se donne en français comme en latin', () => {
  for (const family of ['Rosacées', 'Rosaceae', 'rosacees']) {
    assert.equal(grade(plant('Merisier'), { name: '', family }).family.ok, true, family);
  }
  // Et les familles d'avant APG, encore dans les manuels, restent acceptées.
  assert.equal(grade(plant('Érable sycomore'), { name: '', family: 'Acéracées' }).family.ok, true);
  assert.equal(grade(plant('Muguet'), { name: '', family: 'Liliacées' }).family.ok, true);
  // La forme française reste celle qui s'affiche à la correction.
  assert.equal(accepted(plant('Merisier'), 'family')[0], 'Rosacées');
});

test('une famille partagée est acceptée sur toutes ses espèces', () => {
  // Le garde-fou anti-faute de frappe refuse une saisie qui est exactement la
  // réponse d'un *autre* item : sans traitement à part, « Rosacées » ne
  // passerait que sur une seule des rosacées du corpus.
  for (const name of ['Merisier', 'Pommier', 'Aubépine', 'Églantier', 'Sorbier des oiseleurs']) {
    assert.equal(grade(plant(name), { name: '', family: 'Rosacées' }).family.ok, true, name);
  }
});

test('le nom exact d’une autre plante n’est jamais toléré', () => {
  // « Figuier » et « Figuier de Barbarie » ne se rattrapent pas l'un l'autre.
  assert.equal(grade(plant('Figuier de Barbarie'), { name: 'Figuier', family: '' }).name.ok, false);
  assert.equal(grade(plant('Charme'), { name: 'Chêne', family: '' }).name.ok, false);
  // Et une famille voisine n'en vaut pas une autre.
  assert.equal(grade(plant('Coquelicot'), { name: '', family: 'Papavéracée' }).family.ok, true);
  assert.equal(grade(plant('Coquelicot'), { name: '', family: 'Rosacées' }).family.ok, false);
});

test('les noms d’usage déclarés sont acceptés', () => {
  for (const [name, given] of [
    ['Noisetier', 'Coudrier'],
    ['Pissenlit', 'Dent-de-lion'],
    ['Robinier faux-acacia', 'Acacia'],
    ['Primevère officinale', 'Coucou'],
    ['Muflier', 'Gueule-de-loup'],
  ]) {
    assert.equal(grade(plant(name), { name: given, family: '' }).name.ok, true, `« ${given} » refusé`);
  }
});

test('une réponse vide ou fantaisiste ne rapporte rien', () => {
  const empty = grade(plant('Houx'), { name: '', family: '' });
  assert.equal(empty.score, 0);
  assert.equal(grade(plant('Houx'), { name: 'Lierre', family: 'Poacées' }).score, 0);
});

test('le score cumule les deux sous-réponses', () => {
  const answers = [
    grade(plant('Tournesol'), { name: 'Tournesol', family: 'Astéracées' }),
    grade(plant('Olivier'), { name: 'Olivier', family: 'Rosacées' }),
  ];
  assert.equal(answers[0].score, 2);
  assert.equal(answers[1].score, 1);
  assert.equal(totalScore(answers), 3);
  assert.equal(maxScore(2), 4);
  assert.equal(maxScore(), 10);
});

test('le mode carré propose quatre familles distinctes', () => {
  for (const day of ['2026-08-08', '2026-08-09']) {
    for (const entry of buildSession(day)) {
      const { name, family } = QUIZ.buildChoices(entry, day);
      assert.equal(family.values.length, 4);
      assert.equal(new Set(family.values).size, 4, `familles répétées sur ${entry.name}`);
      assert.ok(family.values.includes(entry.family));
      assert.equal(name.values.length, 4);
      assert.ok(name.values.includes(entry.name));
    }
  }
});

test('les stats des plantes vivent dans leur propre espace', async () => {
  let saved = null;
  const memory = {
    async read() {
      return saved ? structuredClone(saved) : { version: 1, days: {}, plants: {} };
    },
    async write(data) {
      saved = structuredClone(data);
    },
    async clear() {
      saved = null;
    },
  };
  const store = createStore(memory, { statsKey: 'plants' });
  const answers = [grade(plant('Houx'), { name: 'Houx', family: 'Rosacées' })];
  await store.saveDay('2026-08-08', {
    date: '2026-08-08',
    mode: 'daily',
    answers,
    score: 1,
    max: 2,
  });

  const state = await store.getState();
  const code = plant('Houx').code;
  assert.equal(state.plants[code].seen, 1);
  assert.equal(state.plants[code].name, 1);
  assert.equal(state.plants[code].family, 0);
  assert.equal(state.plants[code].lastSeen, '2026-08-08');
  assert.equal(state.countries, undefined);
  assert.equal(state.paintings, undefined);
});

test('le quiz des plantes a sa propre clé de stockage', async () => {
  const written = new Map();
  globalThis.localStorage = {
    getItem: (key) => written.get(key) ?? null,
    setItem: (key, value) => written.set(key, value),
    removeItem: (key) => written.delete(key),
  };
  const adapter = createLocalAdapter({ key: 'ashquiz.plantes.v1', statsKey: 'plants' });
  await adapter.write({ version: 1, days: { '2026-08-08': {} }, plants: {} });
  assert.ok(written.has('ashquiz.plantes.v1'));
  assert.equal(written.has('ashquiz.v1'), false);
  assert.equal(written.has('ashquiz.pays.v1'), false);
  delete globalThis.localStorage;
});

test('chaque espèce a sa photo vendorisée et son crédit', async () => {
  try {
    await access(DIR);
  } catch {
    // Les photos sont produites par `npm run build:plants` : sans elles, le
    // reste des tests reste valable, on ne fait pas échouer la suite.
    return;
  }

  const files = new Set(await readdir(DIR));
  const credits = JSON.parse(await readFile(resolve(DIR, 'credits.json'), 'utf8'));
  for (const entry of PLANTS) {
    assert.ok(files.has(`${entry.code}.jpg`), `photo manquante : ${entry.name}`);
    const credit = credits.photos[entry.code];
    // Les photos de Commons sont sous licence libre, pas dans le domaine
    // public : sans auteur ni licence, elles ne peuvent pas être publiées.
    assert.ok(credit?.author, `auteur manquant : ${entry.name}`);
    assert.ok(credit?.license, `licence manquante : ${entry.name}`);
  }
  // Et pas de photo orpheline, restée après un retrait de la liste.
  assert.equal(files.size, PLANTS.length + 1, 'fichier inattendu dans data/plantes');
  assert.equal(Object.keys(credits.photos).length, PLANTS.length);
});

test('la plante à revoir est désignée par sa famille', () => {
  // `review` agrège par famille (voir src/app-plants.js) : c'est elle qui se
  // révise, l'espèce ne revient presque jamais deux fois.
  assert.equal(BY_CODE.get(plant('Tilleul à grandes feuilles').code).family, 'Malvacées');
});
