import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { hasVirtualKeyboard } from '../src/ui/keyboard.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Une fenêtre de test dont `matchMedia` répond d'après la requête posée. */
const view = (matches) => ({ matchMedia: (query) => ({ matches: matches(query) }) });

test("un appareil tactile est réputé afficher un clavier à l'écran", () => {
  assert.equal(hasVirtualKeyboard(view((query) => query === '(pointer: coarse)')), true);
});

test('une souris ou un pavé tactile, non', () => {
  // Y compris dans une fenêtre étroite : le seuil de l'en-tête ne dit rien du
  // clavier.
  assert.equal(hasVirtualKeyboard(view(() => false)), false);
});

test('sans matchMedia, le focus automatique reste en place', () => {
  assert.equal(hasVirtualKeyboard({}), false);
  assert.equal(hasVirtualKeyboard(null), false);
  // En dehors d'un navigateur — ici, sous Node — le défaut ne lève pas.
  assert.equal(hasVirtualKeyboard(), false);
});

test("le premier champ ne prend pas le focus quand il appellerait le clavier", async () => {
  // Le focus est donné en un seul endroit, à chaque nouvelle question
  // (`renderQuestion`) : c'est là que la condition doit se lire.
  const source = await readFile(resolve(ROOT, 'src/ui/quiz-app.js'), 'utf8');
  assert.match(
    source,
    /!hasVirtualKeyboard\(\)\) el\(inputIds\[0\]\)\.focus\(\)/,
    'quiz-app.js donne le focus au premier champ sans consulter le clavier virtuel',
  );
});
