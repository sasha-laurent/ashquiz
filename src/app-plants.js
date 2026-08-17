// Écran du quiz « plantes » : ce que la photo ajoute au déroulé commun
// (src/ui/quiz-app.js) — une illustration à afficher, et le crédit du
// photographe à porter une fois la réponse donnée.
//
// Les espèces sont un module importé, mais les crédits sont un fichier produit
// par `npm run build:plants` : d'où un `setup` (et donc les écrans de chargement
// et d'erreur de la page), là où les drapeaux démarrent sans rien charger.

import { BY_CODE } from './data/plants.js';
import { creditLabel, loadCredits, plantUrl } from './lib/plants.js';
import { weakest } from './lib/quiz-core.js';
import { QUIZ } from './lib/quiz-plants.js';
import { THEMES_BY_ID } from './lib/themes.js';
import { showIllustration } from './ui/illustration.js';
import { startQuizApp } from './ui/quiz-app.js';

// Auteur et licence de chaque photo, chargés au démarrage.
let credits = {};

startQuizApp({
  theme: THEMES_BY_ID.get('plantes'),
  quiz: QUIZ,
  fields: [
    { key: 'name', label: 'Nom français' },
    { key: 'family', label: 'Famille' },
  ],
  inputs: { name: 'in-name', family: 'in-family' },
  resetPrompt: 'Effacer la progression du quiz des plantes sur cet appareil ?',

  async setup(ctx) {
    const loaded = await loadCredits();
    credits = loaded.photos;
    ctx.el('data-credit').textContent =
      `Photos : ${loaded.source ?? 'Wikimedia Commons'}, sous licence libre — chaque auteur est cité sous sa photo, une fois la réponse donnée.`;
    return QUIZ;
  },

  ask(plant, ctx) {
    const image = ctx.el('plant-image');
    // La photo est vendorisée mais reste servie par le réseau : `showIllustration`
    // fait patienter le temps du chargement, sinon la plante précédente — dont la
    // réponse vient d'être lue — resterait affichée. Une image manquante, elle,
    // veut dire que `npm run build:plants` n'a pas été lancé : sans repli, la
    // question se réduirait à un cadre vide sans explication.
    showIllustration(ctx.el('plant'), image, plantUrl(plant.code));
    // Pas d'`alt` descriptif tant que la réponse n'est pas donnée : sinon un
    // lecteur d'écran (ou un clic droit) livre la solution.
    image.alt = 'Plante à identifier';
    ctx.el('plant-caption').textContent = '';
    // Le crédit non plus n'apparaît qu'à la correction : le nom d'un fichier
    // Commons contient souvent le nom de l'espèce.
    ctx.el('plant-credit').textContent = '';
  },

  reveal(plant, answer, ctx) {
    ctx.el('plant-image').alt = `${plant.name} (${plant.latin})`;
    // Le nom scientifique n'est pas demandé, mais c'est lui qui relie le nom
    // français à la famille : « Bellis perennis », donc astéracées.
    ctx.el('plant-caption').textContent = `${plant.name} — ${plant.latin} · ${plant.family} (${plant.familyLatin})`;
    ctx.el('plant-credit').textContent = creditLabel(credits[plant.code]);
  },

  expected: (plant) => ({ name: plant.name, family: `${plant.family} (${plant.familyLatin})` }),

  summaryLead(plant, answer) {
    const thumb = document.createElement('img');
    thumb.className = 'summary-thumb';
    thumb.loading = 'lazy';
    thumb.src = plantUrl(answer.code);
    thumb.alt = '';
    return thumb;
  },

  summaryLabel: (plant, answer) =>
    plant ? `${plant.name} — ${plant.latin} (${plant.family})` : answer.code,

  // La famille manquée est plus utile que l'espèce : c'est elle qui se révise,
  // et une même espèce revient rarement deux fois.
  review: (state) =>
    weakest(state.plants, {
      points: QUIZ.pointsPerQuestion,
      label: (code) => BY_CODE.get(code)?.family,
    }),
});
