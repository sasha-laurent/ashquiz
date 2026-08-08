// Assemblage : carte + série du jour + correction + persistance.

import { BY_CODE } from './data/departments.js';
import { dateKey, humanDate } from './lib/date.js';
import { buildMapModel, loadGeojson } from './lib/geo.js';
import { DAILY, requestedMode } from './lib/mode.js';
import { buildSession, grade, maxScore, totalScore } from './lib/quiz.js';
import { streak } from './lib/storage.js';
import { THEMES_BY_ID, createThemeStore } from './lib/themes.js';
import { createMap } from './ui/map.js';

const el = (id) => document.getElementById(id);

const screens = {
  loading: el('screen-loading'),
  error: el('screen-error'),
  quiz: el('screen-quiz'),
  summary: el('screen-summary'),
};

const store = createThemeStore(THEMES_BY_ID.get('departements'));
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

let map = null;

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
}

async function main() {
  el('today-label').textContent = humanDate(today);

  let model;
  try {
    const { data } = await loadGeojson();
    model = buildMapModel(data);
  } catch (error) {
    el('error-detail').textContent = error.message;
    show('error');
    return;
  }

  map = createMap(el('map'), model);
  map.onSelect((code) => {
    run.selection = code;
    const dep = BY_CODE.get(code);
    el('map-hint').textContent = dep
      ? 'Département sélectionné (la réponse reste cachée).'
      : 'Sélection enregistrée.';
    el('map-hint').classList.add('hint-set');
  });

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
      el('in-prefecture').focus();
    }
  });

  el('btn-practice').addEventListener('click', () => startRun('practice'));

  el('btn-reset').addEventListener('click', async () => {
    if (!confirm('Effacer toute la progression enregistrée sur cet appareil ?')) return;
    await store.reset();
    await refreshStreak();
    startRun(startMode);
  });
}

function startRun(mode) {
  const seed = mode === 'daily' ? today : `practice-${Date.now()}`;
  run.mode = mode;
  run.session = buildSession(seed, (code) => map.has(code));
  run.index = 0;
  run.answers = [];
  el('mode-badge').hidden = mode !== 'practice';
  show('quiz');
  renderQuestion();
}

function renderQuestion() {
  const dep = run.session[run.index];
  run.selection = null;
  run.revealed = false;

  el('q-code').textContent = dep.code;
  el('in-name').value = '';
  el('in-prefecture').value = '';
  el('in-name').disabled = false;
  el('in-prefecture').disabled = false;
  el('feedback').hidden = true;
  el('feedback').replaceChildren();
  el('btn-validate').hidden = false;
  el('btn-next').hidden = true;
  el('map-hint').textContent = 'Clique le département sur la carte.';
  el('map-hint').classList.remove('hint-set');

  map.reset();
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
      item.classList.add(run.answers[i].score === 3 ? 'is-full' : run.answers[i].score ? 'is-partial' : 'is-empty');
      item.textContent = run.answers[i].score;
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
  const dep = run.session[run.index];
  const answer = grade(dep, {
    name: el('in-name').value,
    prefecture: el('in-prefecture').value,
    map: run.selection,
  });
  run.answers.push(answer);
  run.revealed = true;

  el('in-name').disabled = true;
  el('in-prefecture').disabled = true;
  map.reveal({ correct: dep.code, given: run.selection });

  const feedback = el('feedback');
  feedback.replaceChildren(
    feedbackRow('Nom', answer.name, dep.name),
    feedbackRow('Préfecture', answer.prefecture, dep.prefecture),
    feedbackRow('Carte', answer.map, mapAnswerLabel(run.selection)),
  );
  feedback.hidden = false;

  el('btn-validate').hidden = true;
  const next = el('btn-next');
  next.hidden = false;
  next.textContent = run.index + 1 < run.session.length ? 'Question suivante' : 'Voir le résultat';
  next.focus();

  el('map-hint').textContent = run.selection
    ? ''
    : 'Aucun département cliqué : la bonne zone est surlignée en vert.';
  renderProgress();
}

function mapAnswerLabel(code) {
  if (!code) return null;
  const dep = BY_CODE.get(code);
  return dep ? `${dep.code} ${dep.name}` : code;
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
  if (label === 'Carte') {
    const dep = run.session[run.index];
    detail.textContent = result.ok
      ? `${dep.code} ${dep.name}`
      : `Attendu : ${dep.code} ${dep.name}${expected ? ` — tu as cliqué ${expected}` : ''}`;
  } else if (result.ok && result.typo) {
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
    const dep = BY_CODE.get(answer.code);
    const item = document.createElement('li');
    item.className = 'summary-item';

    const code = document.createElement('span');
    code.className = 'summary-code';
    code.textContent = dep.code;

    const label = document.createElement('span');
    label.className = 'summary-label';
    label.textContent = `${dep.name} — ${dep.prefecture}`;

    const marks = document.createElement('span');
    marks.className = 'summary-marks';
    for (const [key, title] of [
      ['name', 'Nom'],
      ['prefecture', 'Préfecture'],
      ['map', 'Carte'],
    ]) {
      const mark = document.createElement('span');
      mark.className = `mark ${answer[key].ok ? 'is-ok' : 'is-ko'}`;
      mark.title = title;
      mark.textContent = answer[key].ok ? '✓' : '✗';
      marks.appendChild(mark);
    }

    item.append(code, label, marks);
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

  const worst = Object.entries(state.departments)
    .map(([code, stat]) => ({
      code,
      rate: (stat.name + stat.prefecture + stat.map) / (stat.seen * 3),
      seen: stat.seen,
    }))
    .filter((entry) => entry.rate < 1)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  const rows = [
    ['Jours joués', String(days.length)],
    ['Série en cours', `${streak(state.days, today)} jour(s)`],
    ['Réussite globale', possible ? `${Math.round((points / possible) * 100)} %` : '—'],
    [
      'À revoir',
      worst.length
        ? worst.map((entry) => `${entry.code} ${BY_CODE.get(entry.code)?.name ?? ''}`).join(', ')
        : '—',
    ],
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
