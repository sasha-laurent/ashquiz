import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { showIllustration } from '../src/ui/illustration.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Les trois thèmes qui posent leur question en image.
const ILLUSTRATED = ['src/app-paintings.js', 'src/app-countries.js', 'src/app-plants.js'];

/**
 * Une figure de poche : une image, les classes de la figure, et de quoi
 * insérer le cadre d'attente. Le cache dit les URL que le navigateur pose sans
 * attendre — largeur de l'image, ou 0 pour un chargement déjà en échec.
 */
function makeFigure(cache = new Map()) {
  const doc = {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      attributes: new Map(),
      setAttribute(name, value) {
        this.attributes.set(name, String(value));
      },
      getAttribute(name) {
        return this.attributes.get(name) ?? null;
      },
    }),
  };

  const inserted = [];
  const image = {
    ownerDocument: doc,
    complete: false,
    naturalWidth: 0,
    onload: null,
    onerror: null,
    alt: '',
    url: '',
    before(node) {
      inserted.push(node);
    },
    get src() {
      return this.url;
    },
    set src(value) {
      this.url = value;
      const width = cache.get(value);
      this.complete = width !== undefined;
      this.naturalWidth = width ?? 0;
    },
  };

  const classes = new Set();
  const figure = {
    ownerDocument: doc,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    querySelector: (selector) =>
      inserted.find((node) => `.${node.className}` === selector) ?? null,
  };

  return { figure, image, inserted };
}

test("le temps du chargement, l'illustration cède la place au cadre d'attente", () => {
  const { figure, image, inserted } = makeFigure();

  showIllustration(figure, image, 'data/plantes/p001.jpg');

  assert.equal(image.src, 'data/plantes/p001.jpg');
  assert.equal(figure.classList.contains('is-loading'), true);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].className, 'illustration-placeholder');
  // L'`alt` de l'image annonce déjà la question : le cadre n'est pas relu.
  assert.equal(inserted[0].getAttribute('aria-hidden'), 'true');
  assert.match(inserted[0].textContent, /\S/);
  // Ce qui se voit tient à `hidden`, pas à une classe : la feuille de style
  // peut être en cache quand le script vient d'être déployé.
  assert.equal(image.hidden, true);
  assert.equal(inserted[0].hidden, false);
});

test("l'image arrivée, le cadre s'efface", () => {
  const { figure, image, inserted } = makeFigure();

  showIllustration(figure, image, 'data/drapeaux/fr.png');
  image.onload();

  assert.equal(figure.classList.contains('is-loading'), false);
  assert.equal(figure.classList.contains('is-broken'), false);
  assert.equal(image.hidden, false);
  assert.equal(inserted[0].hidden, true);
});

test("l'image injoignable rend la main au repli de la page", () => {
  const { figure, image, inserted } = makeFigure();

  showIllustration(figure, image, 'data/drapeaux/fr.png');
  image.onerror();

  assert.equal(figure.classList.contains('is-loading'), false);
  assert.equal(figure.classList.contains('is-broken'), true);
  // Le repli de la page prend le relais : ni cadre d'attente, ni image cachée
  // par autre chose que la feuille de style.
  assert.equal(inserted[0].hidden, true);
  assert.equal(image.hidden, false);

  // La question suivante repart d'une figure nette : un repli affiché une fois
  // ne doit pas survivre à l'image qui charge derrière.
  showIllustration(figure, image, 'data/drapeaux/de.png');
  assert.equal(figure.classList.contains('is-broken'), false);
});

test("une image déjà en cache n'affiche pas de cadre", () => {
  // Sinon le cadre clignoterait entre deux questions, ce qui coûte plus qu'il
  // ne rapporte : l'image est là avant même le retour de `showIllustration`.
  const { figure, image, inserted } = makeFigure(new Map([['data/drapeaux/fr.png', 640]]));

  showIllustration(figure, image, 'data/drapeaux/fr.png');

  assert.equal(figure.classList.contains('is-loading'), false);
  assert.equal(figure.classList.contains('is-broken'), false);
  assert.equal(inserted[0].hidden, true);
  assert.equal(image.hidden, false);
});

test('une image en cache dont le chargement a échoué reste en repli', () => {
  // « Complète » et sans largeur : le navigateur ne renverra pas d'erreur, il
  // n'y a plus rien à charger.
  const { figure, image } = makeFigure(new Map([['data/drapeaux/fr.png', 0]]));

  showIllustration(figure, image, 'data/drapeaux/fr.png');

  assert.equal(figure.classList.contains('is-loading'), false);
  assert.equal(figure.classList.contains('is-broken'), true);
});

test("le cadre d'attente n'est posé qu'une fois", () => {
  const { figure, image, inserted } = makeFigure();

  showIllustration(figure, image, 'data/plantes/p001.jpg');
  image.onload();
  showIllustration(figure, image, 'data/plantes/p002.jpg');

  assert.equal(inserted.length, 1);
});

test("les trois thèmes illustrés passent par le cadre d'attente", async () => {
  for (const file of ILLUSTRATED) {
    const source = await readFile(resolve(ROOT, file), 'utf8');
    assert.match(source, /showIllustration\(/, `${file} pose son image sans faire patienter`);
    // Un `src` posé directement laisserait l'illustration précédente à l'écran.
    assert.doesNotMatch(source, /^\s*image\.src =/m, `${file} pose encore un src à la main`);
  }
});

test("le cadre ne dépend pas de la feuille de style pour se cacher", async () => {
  // La feuille et le script ne sont pas servis à la même heure : GitHub Pages
  // garde `styles.css` dix minutes en cache, et un script fraîchement déployé
  // tourne un moment avec l'ancienne feuille. Rien de ce qui s'affiche ne doit
  // donc tenir à une classe.
  const source = await readFile(resolve(ROOT, 'src/ui/illustration.js'), 'utf8');
  assert.match(source, /placeholder\.hidden = /);
  assert.match(source, /image\.hidden = /);

  // Le `display` de l'allure couvrirait celui du navigateur : sans cette règle,
  // un cadre `hidden` resterait affiché.
  const styles = await readFile(resolve(ROOT, 'styles.css'), 'utf8');
  assert.match(styles, /\.illustration-placeholder\[hidden\] \{\n {2}display: none;/);
});
