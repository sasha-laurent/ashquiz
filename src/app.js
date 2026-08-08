// Écran du quiz « départements » : ce que la carte ajoute au déroulé commun
// (src/ui/quiz-app.js) — un fond de carte à charger, une zone à cliquer, et la
// bonne zone surlignée à la correction.

import { BY_CODE } from './data/departments.js';
import { buildMapModel, loadGeojson } from './lib/geo.js';
import { QUIZ } from './lib/quiz.js';
import { weakest } from './lib/quiz-core.js';
import { THEMES_BY_ID } from './lib/themes.js';
import { createMap } from './ui/map.js';
import { startQuizApp } from './ui/quiz-app.js';

let map = null;

/** « 38 Isère », le libellé d'un département cliqué. */
function mapLabel(code) {
  if (!code) return null;
  const dep = BY_CODE.get(code);
  return dep ? `${dep.code} ${dep.name}` : code;
}

startQuizApp({
  theme: THEMES_BY_ID.get('departements'),
  fields: [
    { key: 'name', label: 'Nom' },
    { key: 'prefecture', label: 'Préfecture' },
    { key: 'map', label: 'Carte' },
  ],
  inputs: { name: 'in-name', prefecture: 'in-prefecture' },
  resetPrompt: 'Effacer toute la progression enregistrée sur cet appareil ?',

  async setup(ctx) {
    const { data } = await loadGeojson();
    map = createMap(ctx.el('map'), buildMapModel(data));
    map.onSelect((code) => {
      ctx.select(code);
      const hint = ctx.el('map-hint');
      hint.textContent = BY_CODE.has(code)
        ? 'Département sélectionné (la réponse reste cachée).'
        : 'Sélection enregistrée.';
      hint.classList.add('hint-set');
    });
    return QUIZ;
  },

  // Un département absent du fond de carte ne serait pas cliquable.
  filter: (code) => map.has(code),

  ask(dep, ctx) {
    ctx.el('q-code').textContent = dep.code;
    ctx.el('map-hint').textContent = 'Clique le département sur la carte.';
    ctx.el('map-hint').classList.remove('hint-set');
    map.reset();
  },

  reveal(dep, answer, ctx) {
    map.reveal({ correct: dep.code, given: ctx.selection });
    ctx.el('map-hint').textContent = ctx.selection
      ? ''
      : 'Aucun département cliqué : la bonne zone est surlignée en vert.';
  },

  expected: (dep) => ({
    name: dep.name,
    prefecture: dep.prefecture,
    map: `${dep.code} ${dep.name}`,
  }),

  wrongDetail: (dep, ctx) => ({
    map: `Attendu : ${dep.code} ${dep.name}${
      ctx.selection ? ` — tu as cliqué ${mapLabel(ctx.selection)}` : ''
    }`,
  }),

  summaryLead(dep) {
    const code = document.createElement('span');
    code.className = 'summary-code';
    code.textContent = dep.code;
    return code;
  },

  summaryLabel: (dep) => `${dep.name} — ${dep.prefecture}`,

  review: (state) =>
    weakest(state.departments, {
      points: QUIZ.pointsPerQuestion,
      label: (code) => `${code} ${BY_CODE.get(code)?.name ?? ''}`,
      limit: 5,
    }),
});
