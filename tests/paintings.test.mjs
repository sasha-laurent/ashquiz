// Contrôles de cohérence du corpus de tableaux. Ces tests ne touchent pas au
// réseau : ils vérifient la liste écrite à la main, pas les données Wikidata
// (c'est le rôle de `npm run build:paintings`, qui signale les écarts).

import assert from 'node:assert/strict';
import test from 'node:test';

import { PAINTINGS, dateLabel } from '../src/data/paintings.js';
import { normalize } from '../src/lib/text.js';

test('le corpus est assez fourni pour un quiz quotidien', () => {
  assert.ok(PAINTINGS.length >= 100, `seulement ${PAINTINGS.length} tableaux`);
});

test('les identifiants sont uniques', () => {
  const ids = PAINTINGS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('chaque tableau a un titre, un auteur, une date et un lieu', () => {
  for (const painting of PAINTINGS) {
    assert.ok(painting.title, `${painting.id} : titre manquant`);
    assert.ok(painting.artist, `${painting.id} : auteur manquant`);
    assert.ok(painting.museum, `${painting.id} : lieu manquant`);
    assert.ok(
      Number.isInteger(painting.year) && painting.year > 1200 && painting.year < 1950,
      `${painting.id} : année invalide (${painting.year})`,
    );
    if (painting.yearEnd !== undefined) {
      assert.ok(
        Number.isInteger(painting.yearEnd) && painting.yearEnd >= painting.year,
        `${painting.id} : fourchette invalide (${painting.year}-${painting.yearEnd})`,
      );
    }
  }
});

test('le domaine public est respecté : rien après 1930', () => {
  // Garde-fou grossier mais utile : les auteurs retenus sont tous morts avant
  // 1950, donc aucune œuvre du corpus ne peut être postérieure à ~1930.
  for (const painting of PAINTINGS) {
    assert.ok(
      (painting.yearEnd ?? painting.year) <= 1930,
      `${painting.id} : œuvre trop récente pour être sûrement dans le domaine public`,
    );
  }
});

test('les artistes demandés sont présents', () => {
  const artists = PAINTINGS.map((p) => normalize(p.artist));
  for (const wanted of [
    'Léonard de Vinci',
    'Edvard Munch',
    'Eugène Delacroix',
    'Vincent van Gogh',
    'Claude Monet',
    'Jacques-Louis David',
    'Théodore Géricault',
  ]) {
    assert.ok(artists.includes(normalize(wanted)), `${wanted} absent du corpus`);
  }
});

test('aucun couple titre + auteur en double', () => {
  const keys = PAINTINGS.map((p) => `${normalize(p.title)}|${normalize(p.artist)}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('les titres homonymes appartiennent bien à des auteurs différents', () => {
  // « Le Printemps », « Le Baiser », « Judith décapitant Holopherne » et « La
  // Naissance de Vénus » existent en plusieurs versions : c'est voulu, mais
  // l'auteur doit alors les départager.
  const byTitle = new Map();
  for (const painting of PAINTINGS) {
    const key = normalize(painting.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), normalize(painting.artist)]);
  }
  for (const [title, artists] of byTitle) {
    assert.equal(new Set(artists).size, artists.length, `${title} : auteur dupliqué`);
  }
});

test('dateLabel affiche une année seule ou une fourchette', () => {
  assert.equal(dateLabel({ year: 1893 }), '1893');
  assert.equal(dateLabel({ year: 1893, yearEnd: 1893 }), '1893');
  assert.equal(dateLabel({ year: 1503, yearEnd: 1519 }), '1503-1519');
});
