// Écran d'accueil : un bloc par thème, avec son quiz du jour et son entraînement
// libre. Les cartes sont construites à partir de `src/lib/themes.js`, puis
// complétées par l'état lu dans la progression de chaque thème.

import { dateKey, humanDate } from './lib/date.js';
import { practiceUrl } from './lib/mode.js';
import { chipLabel, recapLabel, summarizeDay } from './lib/recap.js';
import { streak } from './lib/storage.js';
import { THEMES, createThemeStore } from './lib/themes.js';
import { setupThemeNav } from './ui/theme-nav.js';

const today = dateKey();

function card(theme) {
  const item = document.createElement('li');
  item.className = 'theme-card';

  const icon = document.createElement('span');
  icon.className = 'theme-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = theme.icon;

  const body = document.createElement('div');
  body.className = 'theme-body';

  const name = document.createElement('h2');
  name.className = 'theme-name';
  name.textContent = theme.name;

  const prompt = document.createElement('p');
  prompt.className = 'theme-prompt muted';
  prompt.textContent = theme.prompt;

  const status = document.createElement('p');
  status.className = 'theme-status';
  status.textContent = 'Progression…';

  body.append(name, prompt, status);

  const actions = document.createElement('div');
  actions.className = 'theme-actions';

  const daily = document.createElement('a');
  daily.className = 'btn btn-primary';
  daily.href = theme.href;
  daily.textContent = 'Quiz du jour';

  const practice = document.createElement('a');
  practice.className = 'btn';
  practice.href = practiceUrl(theme.href);
  practice.textContent = 'Entraînement libre';

  actions.append(daily, practice);
  item.append(icon, body, actions);
  return { item, status, daily, practice };
}

/**
 * Complète une carte avec l'état du thème, et rend le résultat du jour pour le
 * récapitulatif. Les cartes sont affichées avant que la progression soit lue :
 * le menu reste utilisable même si un magasin est lent ou indisponible.
 */
async function fillStatus(theme, nodes) {
  let state;
  try {
    state = await createThemeStore(theme).getState();
  } catch {
    nodes.status.replaceChildren();
    return null;
  }

  const day = state.days[today] ?? null;
  const days = Object.keys(state.days).length;
  const run = streak(state.days, today);

  const parts = [];
  if (day) {
    parts.push(mark('is-done', '✓', `Quiz du jour fait — ${day.score} / ${day.max} points`));
    // Le quiz du jour ne se rejoue pas : c'est l'entraînement libre qui prend la
    // main une fois la série faite.
    nodes.daily.textContent = 'Revoir le résultat';
    nodes.daily.classList.remove('btn-primary');
    nodes.practice.classList.add('btn-primary');
  } else {
    parts.push(mark('is-todo', '•', days ? 'Quiz du jour à faire' : 'Jamais joué — cinq questions'));
  }
  if (run > 0) parts.push(mark('is-streak', '🔥', `${run} jour${run > 1 ? 's' : ''} d'affilée`));

  nodes.status.replaceChildren(...parts);
  return day;
}

function mark(className, symbol, label) {
  const span = document.createElement('span');
  span.className = `theme-mark ${className}`;

  const icon = document.createElement('span');
  icon.className = 'theme-mark-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = symbol;

  span.append(icon, document.createTextNode(label));
  return span;
}

/**
 * L'encart de récap : une ligne de chiffres et une pastille par thème. Il n'est
 * révélé qu'une fois la progression lue, pour ne pas afficher un « 0 quiz » le
 * temps que les magasins répondent.
 */
function renderRecap(summary) {
  const box = document.getElementById('daily-recap');
  if (!box || summary.total === 0) return;

  const title = document.createElement('h2');
  title.className = 'recap-title';
  title.textContent = "Aujourd'hui";

  const figures = document.createElement('p');
  figures.className = 'recap-figures';
  figures.textContent = recapLabel(summary);

  const chips = document.createElement('ul');
  chips.className = 'recap-themes';
  chips.append(...summary.themes.map(chip));

  box.classList.toggle('is-complete', summary.complete);
  box.replaceChildren(title, figures, chips);
  box.hidden = false;
}

/** Une pastille de thème : son icône, et son score si le quiz du jour est fait. */
function chip(entry) {
  const item = document.createElement('li');

  const link = document.createElement('a');
  link.className = `recap-chip ${entry.done ? 'is-done' : 'is-todo'}`;
  link.href = entry.href;

  const label = chipLabel(entry);
  link.title = label;
  link.setAttribute('aria-label', label);

  const icon = document.createElement('span');
  icon.className = 'recap-chip-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = entry.icon;

  const score = document.createElement('span');
  score.className = 'recap-chip-score';
  score.setAttribute('aria-hidden', 'true');
  score.textContent = entry.done ? String(entry.score) : '–';

  link.append(icon, score);
  item.append(link);
  return item;
}

async function main() {
  setupThemeNav();
  document.getElementById('today-label').textContent = humanDate(today);

  const list = document.getElementById('theme-list');
  const cards = THEMES.map((theme) => [theme, card(theme)]);
  list.replaceChildren(...cards.map(([, nodes]) => nodes.item));

  const days = await Promise.all(cards.map(([theme, nodes]) => fillStatus(theme, nodes)));
  renderRecap(summarizeDay(THEMES.map((theme, index) => ({ theme, day: days[index] }))));
}

main();
