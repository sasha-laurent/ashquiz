// Assemblage du quiz « tableaux » : corpus + série du jour + correction +
// persistance. Même squelette que src/app.js, avec l'image à la place de la
// carte et un choix de siècle à la place du clic sur un département.

import { dateKey, humanDate } from './lib/date.js';
import { DAILY, requestedMode } from './lib/mode.js';
import { centuryLabel, century, loadPaintings } from './lib/paintings.js';
import { createPaintingQuiz, maxScore, totalScore } from './lib/quiz-paintings.js';
import { streak } from './lib/storage.js';
import { THEMES_BY_ID, createThemeStore } from './lib/themes.js';

const el = (id) => document.getElementById(id);

const screens = {
  loading: el('screen-loading'),
  error: el('screen-error'),
  quiz: el('screen-quiz'),
  summary: el('screen-summary'),
};

// Clé distincte du quiz des départements : deux thèmes, deux progressions.
const store = createThemeStore(THEMES_BY_ID.get('tableaux'));
const today = dateKey();
// `?mode=libre` (le bouton « Entraînement libre » du menu) saute la série du jour.
const startMode = requestedMode(location.search);

const run = {
  mode: 'daily',
  session: [],
  index: 0,
  answers: [],
  selection: null,
  revealed: false,
};

let quiz = null;

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
}

async function main() {
  el('today-label').textContent = humanDate(today);

  let corpus;
  try {
    corpus = await loadPaintings();
  } catch (error) {
    el('error-detail').textContent = error.message;
    show('error');
    return;
  }

  quiz = createPaintingQuiz(corpus.paintings);
  el('data-credit').textContent =
    `${corpus.paintings.length} œuvres — ${corpus.source ?? 'Wikidata'}.`;

  renderCenturyChoices();
  wireEvents();
  await refreshStreak();

  const existing = startMode === DAILY ? await store.getDay(today) : null;
  if (existing) {
    await showSummary(existing, { alreadyDone: true });
  } else {
    startRun(startMode);
  }
}

function renderCenturyChoices() {
  const box = el('centuries');
  box.replaceChildren();
  for (const value of quiz.centuries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'century';
    button.dataset.century = String(value);
    button.textContent = centuryLabel(value);
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    button.addEventListener('click', () => selectCentury(value));
    box.appendChild(button);
  }
}

function selectCentury(value) {
  if (run.revealed) return;
  run.selection = value;
  for (const button of el('centuries').children) {
    const picked = Number(button.dataset.century) === value;
    button.classList.toggle('is-picked', picked);
    button.setAttribute('aria-checked', String(picked));
  }
}

function wireEvents() {
  el('answer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (run.revealed) nextQuestion();
    else validate();
  });

  el('btn-next').addEventListener('click', nextQuestion);

  el('in-title').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !run.revealed) {
      event.preventDefault();
      el('in-painter').focus();
    }
  });

  el('btn-practice').addEventListener('click', () => startRun('practice'));

  el('btn-reset').addEventListener('click', async () => {
    if (!confirm('Effacer la progression du quiz des tableaux sur cet appareil ?')) return;
    await store.reset();
    await refreshStreak();
    startRun(startMode);
  });
}

function startRun(mode) {
  const seed = mode === 'daily' ? today : `practice-${Date.now()}`;
  run.mode = mode;
  run.session = quiz.buildSession(seed);
  run.index = 0;
  run.answers = [];
  el('mode-badge').hidden = mode !== 'practice';
  show('quiz');
  renderQuestion();
}

function renderQuestion() {
  const painting = run.session[run.index];
  run.selection = null;
  run.revealed = false;

  const image = el('artwork-image');
  // Commons peut être injoignable : sans repli, la question se réduit à un
  // cadre vide sans explication.
  el('artwork').classList.remove('is-broken');
  image.onerror = () => el('artwork').classList.add('is-broken');
  image.src = painting.image;
  // Le titre reste caché : pas d'`alt` descriptif tant que la réponse n'est pas
  // donnée, sinon un lecteur d'écran (ou un clic droit) livre la solution.
  image.alt = 'Tableau à identifier';
  el('artwork-caption').textContent = '';

  el('in-title').value = '';
  el('in-painter').value = '';
  el('in-title').disabled = false;
  el('in-painter').disabled = false;
  for (const button of el('centuries').children) {
    button.disabled = false;
    button.classList.remove('is-picked', 'is-ok', 'is-ko');
    button.setAttribute('aria-checked', 'false');
  }
  el('feedback').hidden = true;
  el('feedback').replaceChildren();
  el('btn-validate').hidden = false;
  el('btn-next').hidden = true;

  renderProgress();
  el('in-title').focus();
}

function renderProgress() {
  const list = el('progress');
  list.replaceChildren();
  for (let i = 0; i < run.session.length; i++) {
    const item = document.createElement('li');
    item.className = 'progress-dot';
    if (i < run.answers.length) {
      const { score } = run.answers[i];
      item.classList.add(score === 3 ? 'is-full' : score ? 'is-partial' : 'is-empty');
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
  const painting = run.session[run.index];
  const answer = quiz.grade(painting, {
    title: el('in-title').value,
    painter: el('in-painter').value,
    century: run.selection,
  });
  run.answers.push(answer);
  run.revealed = true;

  el('in-title').disabled = true;
  el('in-painter').disabled = true;
  revealCenturies(century(painting.year));

  const feedback = el('feedback');
  feedback.replaceChildren(
    feedbackRow('Titre', answer.title, painting.title),
    feedbackRow('Peintre', answer.painter, painting.painter),
    feedbackRow('Siècle', answer.century, centuryLabel(century(painting.year))),
  );
  feedback.hidden = false;

  el('artwork-image').alt = `${painting.title}, ${painting.painter}`;
  el('artwork-caption').textContent = [
    `${painting.title} — ${painting.painter}, ${painting.year}`,
    painting.collection,
  ]
    .filter(Boolean)
    .join(' · ');

  el('btn-validate').hidden = true;
  const next = el('btn-next');
  next.hidden = false;
  next.textContent = run.index + 1 < run.session.length ? 'Question suivante' : 'Voir le résultat';
  next.focus();

  renderProgress();
}

function revealCenturies(expected) {
  for (const button of el('centuries').children) {
    const value = Number(button.dataset.century);
    button.disabled = true;
    if (value === expected) button.classList.add('is-ok');
    else if (value === run.selection) button.classList.add('is-ko');
  }
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
  } else if (label === 'Siècle') {
    detail.textContent = run.selection
      ? `Attendu : ${expected} — tu as répondu ${centuryLabel(run.selection)}`
      : `Attendu : ${expected} — aucun siècle choisi`;
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
    const painting = quiz.byId.get(answer.code);
    const item = document.createElement('li');
    item.className = 'summary-item';

    const thumb = document.createElement('img');
    thumb.className = 'summary-thumb';
    thumb.loading = 'lazy';
    thumb.src = painting?.image ?? '';
    thumb.alt = '';

    const label = document.createElement('span');
    label.className = 'summary-label';
    label.textContent = painting
      ? `${painting.title} — ${painting.painter}, ${painting.year}`
      : answer.code;

    const marks = document.createElement('span');
    marks.className = 'summary-marks';
    for (const [key, title] of [
      ['title', 'Titre'],
      ['painter', 'Peintre'],
      ['century', 'Siècle'],
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

  // Le peintre le plus manqué est plus utile que l'œuvre : on agrège par
  // peintre, une même œuvre revenant rarement deux fois.
  const perPainter = new Map();
  for (const [id, stat] of Object.entries(state.paintings ?? {})) {
    const name = quiz.byId.get(id)?.painter;
    if (!name) continue;
    const entry = perPainter.get(name) ?? { seen: 0, ok: 0 };
    entry.seen += stat.seen * 3;
    entry.ok += (stat.title ?? 0) + (stat.painter ?? 0) + (stat.century ?? 0);
    perPainter.set(name, entry);
  }
  const worst = [...perPainter]
    .map(([name, entry]) => ({ name, rate: entry.ok / entry.seen }))
    .filter((entry) => entry.rate < 1)
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
