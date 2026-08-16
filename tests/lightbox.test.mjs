import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { setupLightbox } from '../src/ui/lightbox.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Un document de poche : de quoi poser la fenêtre, cliquer et suivre le focus,
// sans dépendance ni navigateur. Il ne comprend des sélecteurs que les trois
// formes utilisées par `lightbox.js` — `img[data-zoom]`, `.lightbox`,
// `figcaption`.
class El {
  #classes = new Set();

  constructor(doc, tag) {
    this.doc = doc;
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.hidden = false;
    this.textContent = '';
  }

  get className() {
    return [...this.#classes].join(' ');
  }

  set className(value) {
    this.#classes = new Set(value.split(/\s+/).filter(Boolean));
  }

  get classList() {
    const classes = this.#classes;
    return {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    };
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  matches(selector) {
    if (selector === 'img[data-zoom]') {
      return this.tagName === 'IMG' && this.attributes.has('data-zoom');
    }
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return this.tagName === selector.toUpperCase();
  }

  closest(selector) {
    for (let node = this; node; node = node.parentNode) if (node.matches(selector)) return node;
    return null;
  }

  *descendants() {
    for (const child of this.children) {
      yield child;
      yield* child.descendants();
    }
  }

  querySelectorAll(selector) {
    return [...this.descendants()].filter((node) => node.matches(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  focus() {
    this.doc.activeElement = this;
  }
}

/** Un événement qui remonte les parents, jusqu'au document. */
function dispatch(target, type, props = {}) {
  const event = { type, target, defaultPrevented: false, ...props };
  event.preventDefault = () => {
    event.defaultPrevented = true;
  };
  for (let node = target; node; node = node.parentNode) {
    for (const handler of node.listeners.get(type) ?? []) handler(event);
  }
  for (const handler of target.doc.listeners.get(type) ?? []) handler(event);
  return event;
}

/** Une page de quiz : la figure d'illustration, sa légende, et rien d'autre. */
function page({ zoom = true, legend = '' } = {}) {
  const doc = {
    listeners: new Map(),
    activeElement: null,
    createElement: (tag) => new El(doc, tag),
    addEventListener(type, handler) {
      if (!doc.listeners.has(type)) doc.listeners.set(type, []);
      doc.listeners.get(type).push(handler);
    },
    querySelector: (selector) => doc.body.querySelector(selector),
    querySelectorAll: (selector) => doc.body.querySelectorAll(selector),
  };

  doc.body = new El(doc, 'body');
  const figure = new El(doc, 'figure');
  const image = new El(doc, 'img');
  image.src = 'data/drapeaux/fr.svg';
  image.alt = 'Drapeau à identifier';
  if (zoom) image.setAttribute('data-zoom', '');
  const caption = new El(doc, 'figcaption');
  caption.textContent = legend;
  figure.append(image, caption);
  doc.body.append(figure);

  return { doc, image, caption };
}

/** Les parties de la fenêtre, une fois posée. */
function parts(box) {
  return {
    close: box.querySelector('.lightbox-close'),
    image: box.querySelector('.lightbox-image'),
    caption: box.querySelector('.lightbox-caption'),
  };
}

test("l'illustration devient actionnable, au pointeur comme au clavier", () => {
  const { doc, image } = page();
  setupLightbox(doc);

  assert.ok(image.classList.contains('zoomable'));
  assert.equal(image.tabIndex, 0, "l'image n'entre pas dans l'ordre de tabulation");
  assert.equal(image.getAttribute('role'), 'button');
  // Le nom reste celui de l'`alt`, qui ne dévoile rien avant la correction.
  assert.equal(image.alt, 'Drapeau à identifier');
});

test('un clic affiche la même image en grand', () => {
  const { doc, image } = page({ legend: 'France — Paris' });
  const box = setupLightbox(doc);
  const { close, image: big, caption } = parts(box);

  assert.equal(box.hidden, true, 'la fenêtre est ouverte avant le moindre clic');
  dispatch(image, 'click');

  assert.equal(box.hidden, false);
  assert.equal(big.src, image.src);
  assert.equal(big.alt, image.alt);
  assert.equal(caption.textContent, 'France — Paris');
  assert.equal(caption.hidden, false);
  // La page derrière ne défile plus, et le focus entre dans la fenêtre.
  assert.ok(doc.body.classList.contains('has-lightbox'));
  assert.equal(doc.activeElement, close);
});

test("recliquer referme, et rend le focus à l'illustration", () => {
  const { doc, image } = page();
  const box = setupLightbox(doc);

  dispatch(image, 'click');
  // N'importe où dans la fenêtre, l'image agrandie comprise.
  dispatch(parts(box).image, 'click');

  assert.equal(box.hidden, true);
  assert.equal(doc.body.classList.contains('has-lightbox'), false);
  assert.equal(doc.activeElement, image);
});

test('Échap referme aussi, et Tab ne sort pas de la fenêtre', () => {
  const { doc, image } = page();
  const box = setupLightbox(doc);
  const { close } = parts(box);

  dispatch(image, 'click');
  const tab = dispatch(doc.body, 'keydown', { key: 'Tab' });
  assert.equal(tab.defaultPrevented, true, "Tab s'en va parcourir le formulaire caché");
  assert.equal(doc.activeElement, close);

  dispatch(doc.body, 'keydown', { key: 'Escape' });
  assert.equal(box.hidden, true);
  assert.equal(doc.activeElement, image);
});

test('Entrée et Espace ouvrent la fenêtre sans emporter le formulaire', () => {
  const { doc, image } = page();
  const box = setupLightbox(doc);

  const space = dispatch(image, 'keydown', { key: ' ' });
  assert.equal(box.hidden, false);
  // Sans quoi Espace ferait défiler la page sous la fenêtre qui s'ouvre.
  assert.equal(space.defaultPrevented, true);

  dispatch(parts(box).close, 'click');
  dispatch(image, 'keydown', { key: 'Enter' });
  assert.equal(box.hidden, false);
});

test("la légende ne dévoile rien tant que la réponse n'est pas donnée", () => {
  // Avant la correction, `figcaption` est vide : la fenêtre n'affiche que
  // l'image, sans ligne vide sous elle.
  const { doc, image } = page({ legend: '' });
  const box = setupLightbox(doc);

  dispatch(image, 'click');
  assert.equal(parts(box).caption.hidden, true);
});

test('une page sans illustration ne reçoit pas de fenêtre', () => {
  const { doc } = page({ zoom: false });
  assert.equal(setupLightbox(doc), null);
  assert.equal(doc.querySelector('.lightbox'), null);
});

test("les deux pages illustrées marquent ce qui s'agrandit", async () => {
  for (const [file, id] of [
    ['tableaux.html', 'artwork-image'],
    ['pays.html', 'flag-image'],
  ]) {
    const source = await readFile(resolve(ROOT, file), 'utf8');
    assert.match(
      source,
      new RegExp(`<img id="${id}"[^>]*data-zoom`),
      `${file} : l'illustration ne s'agrandit pas`,
    );
  }

  // La fenêtre est posée au démarrage, une fois pour les cinq thèmes ; les pages
  // sans `data-zoom` n'en reçoivent pas.
  const app = await readFile(resolve(ROOT, 'src/ui/quiz-app.js'), 'utf8');
  assert.match(app, /setupLightbox\(\)/);
});
