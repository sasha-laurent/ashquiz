import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DAILY, PRACTICE, practiceUrl, requestedMode } from '../src/lib/mode.js';
import { THEMES, THEMES_BY_ID } from '../src/lib/themes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('le mode par défaut est le quiz du jour', () => {
  assert.equal(requestedMode(''), DAILY);
  assert.equal(requestedMode('?jour=2026-08-08'), DAILY);
  assert.equal(requestedMode('?mode=jour'), DAILY);
});

test("le lien du menu lance l'entraînement libre", () => {
  assert.equal(practiceUrl('tableaux.html'), 'tableaux.html?mode=libre');
  assert.equal(requestedMode(practiceUrl('tableaux.html').slice('tableaux.html'.length)), PRACTICE);
  assert.equal(requestedMode('?mode=LIBRE'), PRACTICE);
  assert.equal(requestedMode('?mode=practice'), PRACTICE);
});

test('chaque thème a un identifiant, une page et un stockage distincts', () => {
  assert.ok(THEMES.length >= 2);
  assert.equal(THEMES_BY_ID.size, THEMES.length, 'identifiants dupliqués');

  const keys = new Set();
  const hrefs = new Set();
  for (const theme of THEMES) {
    assert.ok(theme.name && theme.icon && theme.prompt, `${theme.id} incomplet`);
    assert.ok(!keys.has(theme.storage.key), `clé de stockage dupliquée : ${theme.storage.key}`);
    assert.ok(!hrefs.has(theme.href), `page dupliquée : ${theme.href}`);
    keys.add(theme.storage.key);
    hrefs.add(theme.href);
  }
});

test('la progression déjà enregistrée reste lisible', () => {
  // Ces clés sont écrites dans le navigateur des utilisateurs : les changer
  // effacerait leur progression.
  assert.equal(THEMES_BY_ID.get('departements').storage.key, 'ashquiz.v1');
  assert.ok(THEMES_BY_ID.get('departements').storage.legacyKeys.includes('quotiquiz.v1'));
  assert.equal(THEMES_BY_ID.get('tableaux').storage.key, 'ashquiz.tableaux.v1');
});

test('le menu pointe vers des pages qui existent et savent démarrer un entraînement', async () => {
  for (const theme of THEMES) {
    const page = await readFile(resolve(ROOT, theme.href), 'utf8');
    assert.match(page, /<script type="module" src="src\/app/, `${theme.href} sans script`);
    assert.match(page, /href="index\.html"/, `${theme.href} sans retour au menu`);
  }

  const menu = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  assert.match(menu, /src="src\/app-menu\.js"/);
  for (const theme of THEMES) {
    assert.ok(menu.includes(theme.href), `${theme.href} absent du menu sans JavaScript`);
  }
});
