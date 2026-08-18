import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { chipLabel, recapLabel, summarizeDay } from '../src/lib/recap.js';
import { THEMES } from '../src/lib/themes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const theme = (id) => ({ id, name: id, short: id, icon: '•', href: `${id}.html` });

test('le récap additionne les quiz du jour terminés', () => {
  const summary = summarizeDay([
    { theme: theme('a'), day: { score: 5, max: 5 } },
    { theme: theme('b'), day: { score: 3, max: 10 } },
    { theme: theme('c'), day: null },
  ]);

  assert.equal(summary.done, 2);
  assert.equal(summary.total, 3);
  assert.equal(summary.score, 8);
  // Le barème d'un thème jamais joué ne compte pas dans le total.
  assert.equal(summary.max, 15);
  assert.equal(summary.complete, false);
});

test('une journée sans quiz ne présente aucun point', () => {
  const summary = summarizeDay([
    { theme: theme('a'), day: null },
    { theme: theme('b'), day: null },
  ]);

  assert.equal(summary.done, 0);
  assert.equal(summary.score, 0);
  assert.equal(summary.max, 0);
  assert.equal(summary.complete, false);
  assert.match(recapLabel(summary), /Aucun quiz/);
});

test('la journée est complète quand tous les thèmes sont faits', () => {
  const summary = summarizeDay([
    { theme: theme('a'), day: { score: 4, max: 5 } },
    { theme: theme('b'), day: { score: 5, max: 5 } },
  ]);

  assert.equal(summary.complete, true);
  assert.equal(recapLabel(summary), 'Les 2 quiz sont faits · 9 / 10 points');
});

test('les chiffres se lisent en une ligne', () => {
  const summary = summarizeDay([
    { theme: theme('a'), day: { score: 4, max: 5 } },
    { theme: theme('b'), day: null },
    { theme: theme('c'), day: null },
  ]);

  assert.equal(recapLabel(summary), '1 quiz sur 3 · 4 / 5 points');
});

test('chaque pastille dit son thème et son état', () => {
  const summary = summarizeDay([
    { theme: theme('a'), day: { score: 4, max: 5 } },
    { theme: theme('b'), day: null },
  ]);

  assert.equal(chipLabel(summary.themes[0]), 'a : 4 / 5 points');
  assert.equal(chipLabel(summary.themes[1]), 'b : quiz du jour à faire');
});

test('le récap porte une pastille par thème du catalogue', () => {
  const summary = summarizeDay(THEMES.map((entry) => ({ theme: entry, day: null })));

  assert.equal(summary.themes.length, THEMES.length);
  for (const [index, entry] of summary.themes.entries()) {
    assert.equal(entry.href, THEMES[index].href, `${entry.id} sans lien vers sa page`);
    assert.ok(entry.icon, `${entry.id} sans icône`);
  }
});

test("l'accueil réserve l'encart et le menu sait le remplir", async () => {
  const page = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  // Masqué au départ : sans JavaScript il n'y a pas de progression à résumer.
  assert.match(page, /id="daily-recap"[^>]*hidden/);

  const menu = await readFile(resolve(ROOT, 'src/app-menu.js'), 'utf8');
  assert.match(menu, /renderRecap\(summarizeDay\(/);

  const styles = await readFile(resolve(ROOT, 'styles.css'), 'utf8');
  assert.match(styles, /\.recap \{/);
});
