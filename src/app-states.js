// Écran du quiz « États américains » : ce que la carte ajoute au déroulé commun
// (src/ui/quiz-app.js) — un fond de carte à charger, une zone à cliquer, et la
// bonne zone surlignée à la correction. Le jumeau de src/app.js, à ceci près que
// l'énoncé est un code à deux lettres au lieu d'un numéro.

import { BY_CODE } from './data/states.js';
import { buildMapModel, loadGeojson } from './lib/geo-states.js';
import { weakest } from './lib/quiz-core.js';
import { QUIZ } from './lib/quiz-states.js';
import { THEMES_BY_ID } from './lib/themes.js';
import { createMap } from './ui/map.js';
import { startQuizApp } from './ui/quiz-app.js';

let map = null;

/** « CA Californie », le libellé d'un État cliqué. */
function mapLabel(code) {
  if (!code) return null;
  const state = BY_CODE.get(code);
  return state ? `${state.code} ${state.name}` : code;
}

startQuizApp({
  theme: THEMES_BY_ID.get('etats-unis'),
  fields: [
    { key: 'name', label: 'Nom' },
    { key: 'capital', label: 'Capitale' },
    { key: 'map', label: 'Carte' },
  ],
  inputs: { name: 'in-name', capital: 'in-capital' },
  resetPrompt: 'Effacer la progression du quiz des États américains sur cet appareil ?',

  async setup(ctx) {
    const { data } = await loadGeojson();
    map = createMap(ctx.el('map'), buildMapModel(data), {
      ariaLabel: 'Carte des États américains',
      label: (code) => {
        const state = BY_CODE.get(code);
        return state ? `${state.code} — ${state.name}` : code;
      },
    });
    map.onSelect((code) => {
      ctx.select(code);
      const hint = ctx.el('map-hint');
      hint.textContent = BY_CODE.has(code)
        ? 'État sélectionné (la réponse reste cachée).'
        : 'Sélection enregistrée.';
      hint.classList.add('hint-set');
    });
    return QUIZ;
  },

  // Un État absent du fond de carte ne serait pas cliquable.
  filter: (code) => map.has(code),

  ask(state, ctx) {
    ctx.el('q-code').textContent = state.code;
    map.reset();
    ctx.el('map-hint').textContent = "Clique l'État sur la carte.";
    ctx.el('map-hint').classList.remove('hint-set');
  },

  // Passage au carré : seules restent cliquables les zones des quatre États
  // proposés au-dessus — dans un autre ordre, mais ce sont les mêmes.
  showChoices(state, ctx) {
    const zones = ctx.choices.map.values;
    map.restrict(zones);
    // Un État déjà cliqué qui n'est pas du lot n'a plus lieu d'être sélectionné.
    if (ctx.selection && !zones.includes(ctx.selection)) {
      map.clearSelection();
      ctx.select(null);
    }
    if (!ctx.selection) {
      ctx.el('map-hint').textContent =
        "Clique le bon parmi les quatre États en surbrillance (les mêmes qu'au-dessus).";
      ctx.el('map-hint').classList.remove('hint-set');
    }
  },

  reveal(state, answer, ctx) {
    map.reveal({ correct: state.code, given: ctx.selection });
    ctx.el('map-hint').textContent = ctx.selection
      ? ''
      : 'Aucun État cliqué : la bonne zone est surlignée en vert.';
  },

  expected: (state) => ({
    name: state.name,
    capital: state.capital,
    map: `${state.code} ${state.name}`,
  }),

  wrongDetail: (state, ctx) => ({
    map: `Attendu : ${state.code} ${state.name}${
      ctx.selection ? ` — tu as cliqué ${mapLabel(ctx.selection)}` : ''
    }`,
  }),

  summaryLead(state) {
    const code = document.createElement('span');
    code.className = 'summary-code';
    code.textContent = state.code;
    return code;
  },

  summaryLabel: (state) => `${state.name} — ${state.capital}`,

  // `progress`, et non `state` : ici, un « state » est un État américain.
  review: (progress) =>
    weakest(progress.states, {
      points: QUIZ.pointsPerQuestion,
      label: (code) => `${code} ${BY_CODE.get(code)?.name ?? ''}`,
      limit: 5,
    }),
});
