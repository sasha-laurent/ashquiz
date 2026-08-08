// Assemblage du quiz « drapeaux » : série du jour + correction + persistance.
// Même squelette que src/app-paintings.js, en plus court : les pays sont un
// module importé, il n'y a donc rien à charger avant de démarrer — seul le
// drapeau de la question en cours est une image.

import { BY_CODE, accepted } from './data/countries.js';
import { flagUrl } from './lib/countries.js';
import { dateKey, humanDate } from './lib/date.js';
import { DAILY, requestedMode } from './lib/mode.js';
import {
  POINTS_PER_QUESTION,
  buildSession,
  grade,
  maxScore,
  totalScore,
} from './lib/quiz-countries.js';
import { streak } from './lib/storage.js';
import { THEMES_BY_ID, createThemeStore } from './lib/themes.js';

const el = (id) => document.getElementById(id);

const screens = {
  quiz: el('screen-quiz'),
  summary: el('screen-summary'),
};

// Clé distincte des autres thèmes : trois quiz, trois progressions.
const store = createThemeStore(THEMES_BY_ID.get('pays'));
const today = dateKey();
// `?mode=libre` (le bouton « Entraînement libre » du menu) saute la série du jour.
const startMode = requestedMode(location.search);

const run = {
  mode: 'daily',
  session: [],
  index: 0,
  answers: [],
  revealed: false,
};

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
}

async function main() {
  el('today-label').textContent = humanDate(today);

  wireEvents();
  await refreshStreak();

  const existing = startMode === DAILY ? await store.getDay(today) : null;
  if (existing) {
    await showSummary(existing, { alreadyDone: true });
  } else {
    startRun(startMode);
  }
}

function wireEvents() {
  el('answer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (run.revealed) nextQuestion();
    else validate();
  });

  el('btn-next').addEventListener('click', nextQuestion);

  el('in-name').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !run.revealed) {
      event.preventDefault();
      el('in-capital').focus();
    }
  });

  el('btn-practice').addEventListener('click', () => startRun('practice'));

  el('btn-reset').addEventListener('click', async () => {
    if (!confirm('Effacer la progression du quiz des drapeaux sur cet appareil ?')) return;
    await store.reset();
    await refreshStreak();
    startRun(startMode);
  });
}

function startRun(mode) {
  const seed = mode === 'daily' ? today : `practice-${Date.now()}`;
  run.mode = mode;
  run.session = buildSession(seed);
  run.index = 0;
  run.answers = [];
  el('mode-badge').hidden = mode !== 'practice';
  show('quiz');
  renderQuestion();
}

function renderQuestion() {
  const country = run.session[run.index];
  run.revealed = false;

  const image = el('flag-image');
  // Le drapeau est vendorisé : une image manquante veut dire que
  // `npm run build:flags` n'a pas été lancé. Sans repli, la question se réduit
  // à un cadre vide sans explication.
  el('flag').classList.remove('is-broken');
  image.onerror = () => el('flag').classList.add('is-broken');
  image.src = flagUrl(country.code);
  // Pas d'`alt` descriptif tant que la réponse n'est pas donnée : sinon un
  // lecteur d'écran (ou un clic droit) livre la solution.
  image.alt = 'Drapeau à identifier';
  el('flag-caption').textContent = '';

  for (const id of ['in-name', 'in-capital']) {
    el(id).value = '';
    el(id).disabled = false;
  }
  el('feedback').hidden = true;
  el('feedback').replaceChildren();
  el('btn-validate').hidden = false;
  el('btn-next').hidden = true;

  renderProgress();
  el('in-name').focus();
}

function renderProgress() {
  const list = el('progress');
  list.replaceChildren();
  for (let i = 0; i < run.session.length; i++) {
    const item = document.createElement('li');
    item.className = 'progress-dot';
    if (i < run.answers.length) {
      const { score } = run.answers[i];
      item.classList.add(
        score === POINTS_PER_QUESTION ? 'is-full' : score ? 'is-partial' : 'is-empty',
      );
      item.textContent = score;
    } else if (i === run.index) {
      item.classList.add('is-current');
      item.textContent = i + 1;
    } else {
      item.textContent = i + 1;
    }
    list.appendChild(item);
  }
}

function validate() {
  const country = run.session[run.index];
  const answer = grade(country, {
    name: el('in-name').value,
    capital: el('in-capital').value,
  });
  run.answers.push(answer);
  run.revealed = true;

  el('in-name').disabled = true;
  el('in-capital').disabled = true;

  const feedback = el('feedback');
  feedback.replaceChildren(
    feedbackRow('Pays', answer.name, country.name),
    feedbackRow('Capitale', answer.capital, capitalLabel(country)),
  );
  feedback.hidden = false;

  el('flag-image').alt = `Drapeau : ${country.name}`;
  el('flag-caption').textContent = `${country.name} — ${capitalLabel(country)}`;

  el('btn-validate').hidden = true;
  const next = el('btn-next');
  next.hidden = false;
  next.textContent = run.index + 1 < run.session.length ? 'Question suivante' : 'Voir le résultat';
  next.focus();

  renderProgress();
}

/** « Pretoria (ou Le Cap, Bloemfontein) » quand plusieurs capitales comptent. */
function capitalLabel(country) {
  const others = accepted(country, 'capital').slice(1);
  return others.length ? `${country.capital} (ou ${others.join(', ')})` : country.capital;
}

function feedbackRow(label, result, expected) {
  const row = document.createElement('div');
  row.className = `fb-row ${result.ok ? 'is-ok' : 'is-ko'}`;

  const icon = document.createElement('span');
  icon.className = 'fb-icon';
  icon.textContent = result.ok ? '✓' : '✗';

  const body = document.createElement('div');
  const title = document.createElement('span');
  title.className = 'fb-label';
  title.textContent = label;
  body.appendChild(title);

  const detail = document.createElement('span');
  detail.className = 'fb-detail';
  if (result.ok && result.typo) {
    detail.textContent = `${expected} (orthographe approximative acceptée)`;
  } else if (result.ok) {
    detail.textContent = expected;
  } else {
    detail.textContent = `Attendu : ${expected}`;
  }
  body.appendChild(detail);

  row.append(icon, body);
  return row;
}

async function nextQuestion() {
  if (run.index + 1 < run.session.length) {
    run.index += 1;
    renderQuestion();
    return;
  }

  const day = {
    date: run.mode === 'daily' ? today : null,
    mode: run.mode,
    answers: run.answers,
    score: totalScore(run.answers),
    max: maxScore(run.answers.length),
    completedAt: new Date().toISOString(),
  };

  if (run.mode === 'daily') {
    await store.saveDay(today, day);
    await refreshStreak();
  }
  await showSummary(day, { alreadyDone: false });
}

async function showSummary(day, { alreadyDone }) {
  const practice = day.mode === 'practice';
  el('summary-title').textContent = practice
    ? 'Entraînement terminé'
    : alreadyDone
      ? `Quiz du jour déjà fait — ${humanDate(today)}`
      : 'Quiz du jour terminé';
  el('summary-score').textContent = `${day.score} / ${day.max} points`;

  const list = el('summary-list');
  list.replaceChildren();
  for (const answer of day.answers) {
    const country = BY_CODE.get(answer.code);
    const item = document.createElement('li');
    item.className = 'summary-item';

    const thumb = document.createElement('img');
    thumb.className = 'summary-flag';
    thumb.loading = 'lazy';
    thumb.src = flagUrl(answer.code);
    thumb.alt = '';

    const label = document.createElement('span');
    label.className = 'summary-label';
    label.textContent = country ? `${country.name} — ${capitalLabel(country)}` : answer.code;

    const marks = document.createElement('span');
    marks.className = 'summary-marks';
    for (const [key, title] of [
      ['name', 'Pays'],
      ['capital', 'Capitale'],
    ]) {
      const mark = document.createElement('span');
      mark.className = `mark ${answer[key].ok ? 'is-ok' : 'is-ko'}`;
      mark.title = title;
      mark.textContent = answer[key].ok ? '✓' : '✗';
      marks.appendChild(mark);
    }

    item.append(thumb, label, marks);
    list.appendChild(item);
  }

  el('btn-practice').textContent = practice ? 'Nouvel entraînement' : 'Entraînement libre';
  await renderStats();
  show('summary');
}

async function renderStats() {
  const state = await store.getState();
  const days = Object.values(state.days);
  const points = days.reduce((sum, day) => sum + day.score, 0);
  const possible = days.reduce((sum, day) => sum + day.max, 0);

  const worst = Object.entries(state.countries ?? {})
    .map(([code, stat]) => ({
      name: BY_CODE.get(code)?.name,
      rate: ((stat.name ?? 0) + (stat.capital ?? 0)) / (stat.seen * POINTS_PER_QUESTION),
    }))
    .filter((entry) => entry.name && entry.rate < 1)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 4);

  const rows = [
    ['Jours joués', String(days.length)],
    ['Série en cours', `${streak(state.days, today)} jour(s)`],
    ['Réussite globale', possible ? `${Math.round((points / possible) * 100)} %` : '—'],
    ['À revoir', worst.length ? worst.map((entry) => entry.name).join(', ') : '—'],
  ];

  const list = el('stats-list');
  list.replaceChildren();
  for (const [term, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    list.append(dt, dd);
  }
}

async function refreshStreak() {
  const state = await store.getState();
  const count = streak(state.days, today);
  const badge = el('streak');
  badge.hidden = count === 0;
  badge.textContent = `🔥 ${count} jour${count > 1 ? 's' : ''}`;
}

main();
