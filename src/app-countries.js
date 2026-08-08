// Écran du quiz « drapeaux » : ce que le drapeau ajoute au déroulé commun
// (src/ui/quiz-app.js). Rien à charger avant de démarrer — les pays sont un
// module importé ; seule l'image de la question en cours vient du disque.

import { BY_CODE, accepted } from './data/countries.js';
import { flagUrl } from './lib/countries.js';
import { QUIZ } from './lib/quiz-countries.js';
import { weakest } from './lib/quiz-core.js';
import { THEMES_BY_ID } from './lib/themes.js';
import { startQuizApp } from './ui/quiz-app.js';

/** « Pretoria (ou Le Cap, Bloemfontein) » quand plusieurs capitales comptent. */
function capitalLabel(country) {
  const others = accepted(country, 'capital').slice(1);
  return others.length ? `${country.capital} (ou ${others.join(', ')})` : country.capital;
}

startQuizApp({
  theme: THEMES_BY_ID.get('pays'),
  quiz: QUIZ,
  fields: [
    { key: 'name', label: 'Pays' },
    { key: 'capital', label: 'Capitale' },
  ],
  inputs: { name: 'in-name', capital: 'in-capital' },
  resetPrompt: 'Effacer la progression du quiz des drapeaux sur cet appareil ?',

  ask(country, ctx) {
    const image = ctx.el('flag-image');
    // Le drapeau est vendorisé : une image manquante veut dire que
    // `npm run build:flags` n'a pas été lancé. Sans repli, la question se réduit
    // à un cadre vide sans explication.
    ctx.el('flag').classList.remove('is-broken');
    image.onerror = () => ctx.el('flag').classList.add('is-broken');
    image.src = flagUrl(country.code);
    // Pas d'`alt` descriptif tant que la réponse n'est pas donnée : sinon un
    // lecteur d'écran (ou un clic droit) livre la solution.
    image.alt = 'Drapeau à identifier';
    ctx.el('flag-caption').textContent = '';
  },

  reveal(country, answer, ctx) {
    ctx.el('flag-image').alt = `Drapeau : ${country.name}`;
    ctx.el('flag-caption').textContent = `${country.name} — ${capitalLabel(country)}`;
  },

  expected: (country) => ({ name: country.name, capital: capitalLabel(country) }),

  summaryLead(country, answer) {
    const thumb = document.createElement('img');
    thumb.className = 'summary-flag';
    thumb.loading = 'lazy';
    thumb.src = flagUrl(answer.code);
    thumb.alt = '';
    return thumb;
  },

  summaryLabel: (country, answer) =>
    country ? `${country.name} — ${capitalLabel(country)}` : answer.code,

  review: (state) =>
    weakest(state.countries, {
      points: QUIZ.pointsPerQuestion,
      label: (code) => BY_CODE.get(code)?.name,
    }),
});
