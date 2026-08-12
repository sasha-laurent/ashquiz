// Catalogue des thèmes : la seule liste à compléter pour qu'un nouveau quiz
// apparaisse dans le menu.
//
// Chaque thème y déclare aussi sa clé de persistance, que l'écran du thème et le
// menu utilisent tous les deux — le menu lit la progression de chaque thème sans
// rien savoir de son contenu.

import { createLocalAdapter, createStore } from './storage.js';

export const THEMES = [
  {
    id: 'departements',
    name: 'Départements & préfectures',
    icon: '🗺️',
    href: 'departements.html',
    short: 'Départements',
    prompt: 'À partir du numéro : le nom du département, sa préfecture et sa position sur la carte.',
    storage: { key: 'ashquiz.v1', legacyKeys: ['quotiquiz.v1'], statsKey: 'departments' },
  },
  {
    id: 'tableaux',
    name: 'Tableaux',
    icon: '🖼️',
    href: 'tableaux.html',
    short: 'Tableaux',
    prompt: "À partir de l'image : le titre de l'œuvre, son peintre et son siècle.",
    storage: { key: 'ashquiz.tableaux.v1', statsKey: 'paintings' },
  },
  {
    id: 'pays',
    name: 'Drapeaux & capitales',
    icon: '🚩',
    href: 'pays.html',
    short: 'Pays',
    prompt: 'À partir du drapeau : le nom du pays et sa capitale.',
    storage: { key: 'ashquiz.pays.v1', statsKey: 'countries' },
  },
  {
    id: 'etats-unis',
    name: 'États américains',
    icon: '🦅',
    href: 'etats-unis.html',
    short: 'États-Unis',
    prompt:
      "À partir du code à deux lettres : le nom de l'État, sa capitale et sa position sur la carte.",
    storage: { key: 'ashquiz.etats-unis.v1', statsKey: 'states' },
  },
];

export const THEMES_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

/** Le magasin de progression d'un thème, isolé de celui des autres. */
export function createThemeStore(theme) {
  return createStore(createLocalAdapter(theme.storage), { statsKey: theme.storage.statsKey });
}
