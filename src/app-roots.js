// Écran du quiz « racines » : ce que la racine ajoute au déroulé commun
// (src/ui/quiz-app.js) — un énoncé de deux mots, deux boutons d'origine, et un
// second coup de pouce à côté du carré : un mot français bâti sur la racine.

import { BY_CODE, accepted, doublet } from './data/roots.js';
import { weakest } from './lib/quiz-core.js';
import { QUIZ } from './lib/quiz-roots.js';
import { THEMES_BY_ID } from './lib/themes.js';
import { startQuizApp } from './ui/quiz-app.js';

const el = (id) => document.getElementById(id);

// Les deux boutons d'origine et le coup de pouce vivent en dehors du formulaire
// commun : ils sont câblés une fois pour toutes, à la fin de ce module. Il leur
// faut donc de quoi savoir de quoi ils parlent — la racine en cours, et le
// déroulé où enregistrer un clic.
let current = null;
let ctxRef = null;

/** « plusieurs (ou nombreux, multiple) » quand plusieurs formulations comptent. */
function sensLabel(root) {
  const others = accepted(root, 'sens').slice(1);
  return others.length ? `${root.sens} (ou ${others.join(', ')})` : root.sens;
}

/** Les boutons d'origine : remis à zéro à chaque question. */
function resetOrigins() {
  for (const button of el('origins').children) {
    button.disabled = false;
    button.classList.remove('is-picked', 'is-ok', 'is-ko');
    button.setAttribute('aria-checked', 'false');
  }
}

function selectOrigin(value) {
  if (!ctxRef || ctxRef.revealed) return;
  ctxRef.select(value);
  for (const button of el('origins').children) {
    const picked = button.dataset.origine === value;
    button.classList.toggle('is-picked', picked);
    button.setAttribute('aria-checked', String(picked));
  }
}

/**
 * Le second coup de pouce, sur le même principe que le carré : il ne vaut que
 * pour la question en cours, il ne change rien à la note, et une fois demandé
 * le bouton disparaît jusqu'à la question suivante.
 *
 * Un seul exemple, pas la liste : c'est un indice, pas la correction. Le reste
 * s'affiche de toute façon une fois la réponse validée.
 */
function showExample() {
  if (!current) return;
  el('example').textContent = `Comme dans « ${current.exemples[0]} ».`;
  el('example').classList.add('hint-set');
  el('btn-exemple').hidden = true;
}

startQuizApp({
  theme: THEMES_BY_ID.get('racines'),
  quiz: QUIZ,
  fields: [
    { key: 'sens', label: 'Sens' },
    { key: 'origine', label: 'Origine' },
  ],
  inputs: { sens: 'in-sens' },
  resetPrompt: 'Effacer la progression du quiz des racines sur cet appareil ?',

  ask(root, ctx) {
    current = root;
    ctxRef = ctx;
    ctx.el('q-type').textContent = root.type;
    ctx.el('q-root').textContent = root.form;

    resetOrigins();
    ctx.el('example').textContent = '';
    ctx.el('example').classList.remove('hint-set');
    ctx.el('btn-exemple').hidden = false;
    ctx.el('root-detail').textContent = '';
  },

  // Passage au carré : seul le sens s'y joue. L'origine garde ses deux boutons,
  // et ce qui y était déjà coché reste coché — il n'y a pas de carré à deux
  // cases, donc rien à rétrécir et rien à effacer.
  showChoices() {},

  reveal(root, answer, ctx) {
    for (const button of ctx.el('origins').children) {
      button.disabled = true;
      if (button.dataset.origine === root.origine) button.classList.add('is-ok');
      else if (button.dataset.origine === ctx.selection) button.classList.add('is-ko');
    }

    ctx.el('example').textContent = root.exemples.join(', ');
    ctx.el('example').classList.add('hint-set');
    ctx.el('btn-exemple').hidden = true;

    // Ce qui fait le sel du thème, une fois la réponse tombée : le doublet de
    // l'autre langue (hydro- / aqua-) et le faux ami qui s'écrit pareil.
    const pair = doublet(root);
    ctx.el('root-detail').textContent = [
      pair && `Doublet ${pair.origine} : ${pair.form} (${pair.exemples[0]}).`,
      root.note,
    ]
      .filter(Boolean)
      .join(' ');
  },

  expected: (root) => ({ sens: sensLabel(root), origine: root.origine }),

  wrongDetail: (root, ctx) => ({
    origine: `Attendu : ${root.origine} — ${
      ctx.selection ? `tu as répondu ${ctx.selection}` : 'aucune origine choisie'
    }`,
  }),

  summaryLabel: (root, answer) =>
    root ? `${root.form} — ${root.sens} (${root.origine})` : answer.code,

  review: (state) =>
    weakest(state.roots, {
      points: QUIZ.pointsPerQuestion,
      label: (code) => BY_CODE.get(code)?.form,
    }),
});

// Un module ES est chargé en `defer` : le DOM est là, et ces deux branchements
// n'ont à se faire qu'une fois — les boutons, eux, ne sont jamais reconstruits.
for (const button of el('origins').children) {
  button.addEventListener('click', () => selectOrigin(button.dataset.origine));
}
el('btn-exemple').addEventListener('click', showExample);
