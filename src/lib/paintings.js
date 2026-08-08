// Chargement du corpus d'œuvres écrit par `npm run build:paintings`.
//
// Contrairement aux départements, la liste n'est pas un module JS : elle est
// produite par un outil et peut être régénérée sans toucher au code. Elle est
// donc chargée en JSON à l'exécution.

const FILE = 'data/tableaux.json';

/** Résout `data/tableaux.json` relativement à la racine du site, pas à la page. */
function fileUrl() {
  return new URL(`../../${FILE}`, import.meta.url).href;
}

export async function loadPaintings() {
  const response = await fetch(fileUrl());
  if (!response.ok) throw new Error(`${FILE} : HTTP ${response.status}`);
  const data = await response.json();
  const paintings = data?.paintings;
  if (!Array.isArray(paintings) || !paintings.length) {
    throw new Error(`${FILE} : aucune œuvre dans le fichier.`);
  }
  return { paintings, source: data.source, generatedAt: data.generatedAt };
}

/** Siècle d'une année : 1889 → 19. */
export function century(year) {
  return Math.floor((year - 1) / 100) + 1;
}

const ROMAN = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** 19 → « XIXe ». */
export function centuryLabel(value) {
  let rest = value;
  let out = '';
  for (const [amount, letters] of ROMAN) {
    while (rest >= amount) {
      out += letters;
      rest -= amount;
    }
  }
  return `${out}${value === 1 ? 'er' : 'e'}`;
}
