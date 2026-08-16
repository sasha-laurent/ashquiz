import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { THEMES } from '../src/lib/themes.js';
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
  // (`renderQuestion` → `focusQuestion`) : c'est là que la condition doit se lire.
  const source = await readFile(resolve(ROOT, 'src/ui/quiz-app.js'), 'utf8');
  assert.match(
    source,
    /!hasVirtualKeyboard\(\)\) return el\(inputIds\[0\]\)\.focus\(\)/,
    'quiz-app.js donne le focus au premier champ sans consulter le clavier virtuel',
  );
});

test("l'énoncé prend le focus à la place du champ", async () => {
  // À défaut, le focus retomberait sur `<body>` — le bouton « Question
  // suivante » venant de disparaître — et un lecteur d'écran n'annoncerait pas
  // la nouvelle question. Chaque page doit donc porter l'énoncé que vise
  // `focusQuestion()`.
  const source = await readFile(resolve(ROOT, 'src/ui/quiz-app.js'), 'utf8');
  assert.match(source, /querySelector\('\.prompt'\)/);
  assert.match(source, /prompt\.tabIndex = -1/, "l'énoncé n'est pas rendu focalisable");

  for (const theme of THEMES) {
    const page = await readFile(resolve(ROOT, theme.href), 'utf8');
    assert.match(page, /<p class="prompt"/, `${theme.href} sans énoncé à viser`);
  }

  // Un énoncé focalisé n'est pas un contrôle : pas de cadre de mise au point.
  const styles = await readFile(resolve(ROOT, 'styles.css'), 'utf8');
  assert.match(styles, /\.prompt:focus \{[^}]*outline: none/);
});
