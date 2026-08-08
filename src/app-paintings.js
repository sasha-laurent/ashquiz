// Écran du quiz « tableaux » : ce que l'œuvre ajoute au déroulé commun
// (src/ui/quiz-app.js) — un corpus à charger, une image à afficher et un siècle
// à choisir parmi des boutons.

import { centuryLabel, century, loadPaintings } from './lib/paintings.js';
import { weakest } from './lib/quiz-core.js';
import { createPaintingQuiz } from './lib/quiz-paintings.js';
import { THEMES_BY_ID } from './lib/themes.js';
import { startQuizApp } from './ui/quiz-app.js';

/** Les boutons de siècle, un par siècle représenté dans le corpus. */
function renderCenturyChoices(centuries, ctx) {
  const box = ctx.el('centuries');
  box.replaceChildren();
  for (const value of centuries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'century';
    button.dataset.century = String(value);
    button.textContent = centuryLabel(value);
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    button.addEventListener('click', () => selectCentury(value, ctx));
    box.appendChild(button);
  }
}

function selectCentury(value, ctx) {
  if (ctx.revealed) return;
  ctx.select(value);
  for (const button of ctx.el('centuries').children) {
    const picked = Number(button.dataset.century) === value;
    button.classList.toggle('is-picked', picked);
    button.setAttribute('aria-checked', String(picked));
  }
}

startQuizApp({
  theme: THEMES_BY_ID.get('tableaux'),
  fields: [
    { key: 'title', label: 'Titre' },
    { key: 'painter', label: 'Peintre' },
    { key: 'century', label: 'Siècle' },
  ],
  inputs: { title: 'in-title', painter: 'in-painter' },
  resetPrompt: 'Effacer la progression du quiz des tableaux sur cet appareil ?',

  async setup(ctx) {
    const corpus = await loadPaintings();
    const quiz = createPaintingQuiz(corpus.paintings);
    ctx.el('data-credit').textContent =
      `${corpus.paintings.length} œuvres — ${corpus.source ?? 'Wikidata'}.`;
    renderCenturyChoices(quiz.centuries, ctx);
    return quiz;
  },

  ask(painting, ctx) {
    const image = ctx.el('artwork-image');
    // Commons peut être injoignable : sans repli, la question se réduit à un
    // cadre vide sans explication.
    ctx.el('artwork').classList.remove('is-broken');
    image.onerror = () => ctx.el('artwork').classList.add('is-broken');
    image.src = painting.image;
    // Le titre reste caché : pas d'`alt` descriptif tant que la réponse n'est pas
    // donnée, sinon un lecteur d'écran (ou un clic droit) livre la solution.
    image.alt = 'Tableau à identifier';
    ctx.el('artwork-caption').textContent = '';

    for (const button of ctx.el('centuries').children) {
      button.disabled = false;
      button.classList.remove('is-picked', 'is-ok', 'is-ko');
      button.setAttribute('aria-checked', 'false');
    }
  },

  reveal(painting, answer, ctx) {
    const expectedCentury = century(painting.year);
    for (const button of ctx.el('centuries').children) {
      const value = Number(button.dataset.century);
      button.disabled = true;
      if (value === expectedCentury) button.classList.add('is-ok');
      else if (value === ctx.selection) button.classList.add('is-ko');
    }

    ctx.el('artwork-image').alt = `${painting.title}, ${painting.painter}`;
    ctx.el('artwork-caption').textContent = [
      `${painting.title} — ${painting.painter}, ${painting.year}`,
      painting.collection,
    ]
      .filter(Boolean)
      .join(' · ');
  },

  expected: (painting) => ({
    title: painting.title,
    painter: painting.painter,
    century: centuryLabel(century(painting.year)),
  }),

  wrongDetail: (painting, ctx) => ({
    century: `Attendu : ${centuryLabel(century(painting.year))} — ${
      ctx.selection ? `tu as répondu ${centuryLabel(ctx.selection)}` : 'aucun siècle choisi'
    }`,
  }),

  summaryLead(painting) {
    const thumb = document.createElement('img');
    thumb.className = 'summary-thumb';
    thumb.loading = 'lazy';
    thumb.src = painting?.image ?? '';
    thumb.alt = '';
    return thumb;
  },

  summaryLabel: (painting, answer) =>
    painting ? `${painting.title} — ${painting.painter}, ${painting.year}` : answer.code,

  // Le peintre le plus manqué est plus utile que l'œuvre : les statistiques sont
  // agrégées par peintre, une même œuvre revenant rarement deux fois.
  review: (state, quiz) =>
    weakest(state.paintings, {
      points: quiz.pointsPerQuestion,
      label: (id) => quiz.byKey.get(id)?.painter,
    }),
});
