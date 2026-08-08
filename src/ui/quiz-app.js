// Écran de quiz commun aux thèmes.
//
// Les trois pages de quiz ont le même squelette HTML (une barre de progression,
// un formulaire, un écran de résultat) et le même déroulé : série du jour ou
// entraînement libre, une question à la fois, correction affichée, résultat
// enregistré. Tout cela vit ici une seule fois.
//
// Un thème ne décrit que ce qui lui est propre : ses champs, la façon de poser
// la question (une image, un numéro, une carte) et de la dévoiler. Voir
// `src/app.js`, `src/app-paintings.js`, `src/app-countries.js`.

import { dateKey, humanDate } from '../lib/date.js';
import { DAILY, PRACTICE, requestedMode } from '../lib/mode.js';
import { streak } from '../lib/storage.js';
import { createThemeStore } from '../lib/themes.js';

const el = (id) => document.getElementById(id);

const SCREENS = ['loading', 'error', 'quiz', 'summary'];

/**
 * Démarre la page de quiz d'un thème.
 *
 * @param {object} spec
 * @param {object} spec.theme  l'entrée de `src/lib/themes.js`
 * @param {object} [spec.quiz]  le quiz, quand il est disponible d'emblée
 * @param {(ctx: object) => Promise<object>} [spec.setup]  charge ce dont le thème
 *   a besoin (carte, corpus) et renvoie son quiz ; une exception affiche l'écran
 *   d'erreur `screen-error` de la page
 * @param {{key: string, label: string}[]} spec.fields  les sous-réponses, dans
 *   l'ordre d'affichage : elles nourrissent la correction et le résultat
 * @param {Record<string, string>} spec.inputs  sous-réponse → identifiant du champ
 *   texte ; l'ordre donne l'enchaînement des champs à la touche Entrée. Une
 *   sous-réponse absente d'ici se répond autrement (carte, siècle) et vaut
 *   `ctx.selection`
 * @param {(code: string, item: object) => boolean} [spec.filter]  restreint le tirage
 * @param {string} spec.resetPrompt  la confirmation avant effacement
 * @param {(item: object, ctx: object) => void} [spec.ask]  affiche l'énoncé
 * @param {(item: object, answer: object, ctx: object) => void} [spec.reveal]  dévoile
 *   la réponse sur l'énoncé
 * @param {(item: object) => Record<string, string>} spec.expected  réponse attendue,
 *   en toutes lettres, par sous-réponse
 * @param {(item: object, ctx: object) => Record<string, string>} [spec.wrongDetail]
 *   le détail affiché quand une sous-réponse est fausse, quand « Attendu : … »
 *   ne suffit pas (rappeler ce qui a été cliqué)
 * @param {(item: object, answer: object) => Node|null} [spec.summaryLead]  vignette
 *   en tête de ligne du résultat
 * @param {(item: object, answer: object) => string} spec.summaryLabel
 * @param {(state: object, quiz: object) => string[]} [spec.review]  les items à revoir
 */
export function startQuizApp(spec) {
  const {
    theme,
    fields,
    inputs,
    filter,
    resetPrompt,
    setup = null,
    ask = () => {},
    reveal = () => {},
    expected = () => ({}),
    wrongDetail = () => ({}),
    summaryLead = () => null,
    summaryLabel = (item, answer) => answer.code,
    review = () => [],
  } = spec;

  const store = createThemeStore(theme);
  const today = dateKey();
  // `?mode=libre` (le bouton « Entraînement libre » du menu) saute la série du jour.
  const startMode = requestedMode(location.search);
  const inputIds = Object.values(inputs);
  const screens = Object.fromEntries(
    SCREENS.map((name) => [name, el(`screen-${name}`)]).filter(([, node]) => node),
  );

  const run = {
    mode: DAILY,
    session: [],
    index: 0,
    answers: [],
    selection: null,
    revealed: false,
  };

  let quiz = spec.quiz ?? null;

  /** Ce que le thème voit du déroulé en cours. */
  const ctx = {
    el,
    get quiz() {
      return quiz;
    },
    get selection() {
      return run.selection;
    },
    get revealed() {
      return run.revealed;
    },
    /** Enregistre la sous-réponse qui ne se saisit pas au clavier. */
    select(value) {
      run.selection = value;
    },
  };

  function show(name) {
    for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
  }

  async function main() {
    el('today-label').textContent = humanDate(today);

    if (setup) {
      try {
        quiz = await setup(ctx);
      } catch (error) {
        el('error-detail').textContent = error.message;
        show('error');
        return;
      }
    }

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

    // Entrée passe au champ suivant plutôt que de valider la question.
    for (const [i, id] of inputIds.slice(0, -1).entries()) {
      el(id).addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !run.revealed) {
          event.preventDefault();
          el(inputIds[i + 1]).focus();
        }
      });
    }

    el('btn-practice').addEventListener('click', () => startRun(PRACTICE));

    el('btn-reset').addEventListener('click', async () => {
      if (!confirm(resetPrompt)) return;
      await store.reset();
      await refreshStreak();
      startRun(startMode);
    });
  }

  function startRun(mode) {
    const seed = mode === DAILY ? today : `practice-${Date.now()}`;
    run.mode = mode;
    run.session = quiz.buildSession(seed, filter);
    run.index = 0;
    run.answers = [];
    el('mode-badge').hidden = mode !== PRACTICE;
    show('quiz');
    renderQuestion();
  }

  function renderQuestion() {
    const item = run.session[run.index];
    run.selection = null;
    run.revealed = false;

    for (const id of inputIds) {
      el(id).value = '';
      el(id).disabled = false;
    }
    el('feedback').hidden = true;
    el('feedback').replaceChildren();
    el('btn-validate').hidden = false;
    el('btn-next').hidden = true;

    ask(item, ctx);

    renderProgress();
    if (inputIds.length) el(inputIds[0]).focus();
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
          score === quiz.pointsPerQuestion ? 'is-full' : score ? 'is-partial' : 'is-empty',
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
    const item = run.session[run.index];
    const given = {};
    for (const { key } of fields) {
      given[key] = key in inputs ? el(inputs[key]).value : run.selection;
    }

    const answer = quiz.grade(item, given);
    run.answers.push(answer);
    run.revealed = true;

    for (const id of inputIds) el(id).disabled = true;
    reveal(item, answer, ctx);

    const answers = expected(item, ctx);
    const details = wrongDetail(item, ctx);
    const feedback = el('feedback');
    feedback.replaceChildren(
      ...fields.map(({ key, label }) =>
        feedbackRow(label, answer[key], answers[key], details[key]),
      ),
    );
    feedback.hidden = false;

    el('btn-validate').hidden = true;
    const next = el('btn-next');
    next.hidden = false;
    next.textContent = run.index + 1 < run.session.length ? 'Question suivante' : 'Voir le résultat';
    next.focus();

    renderProgress();
  }

  async function nextQuestion() {
    if (run.index + 1 < run.session.length) {
      run.index += 1;
      renderQuestion();
      return;
    }

    const day = {
      date: run.mode === DAILY ? today : null,
      mode: run.mode,
      answers: run.answers,
      score: quiz.totalScore(run.answers),
      max: quiz.maxScore(run.answers.length),
      completedAt: new Date().toISOString(),
    };

    if (run.mode === DAILY) {
      await store.saveDay(today, day);
      await refreshStreak();
    }
    await showSummary(day, { alreadyDone: false });
  }

  async function showSummary(day, { alreadyDone }) {
    const practice = day.mode === PRACTICE;
    el('summary-title').textContent = practice
      ? 'Entraînement terminé'
      : alreadyDone
        ? `Quiz du jour déjà fait — ${humanDate(today)}`
        : 'Quiz du jour terminé';
    el('summary-score').textContent = `${day.score} / ${day.max} points`;

    const list = el('summary-list');
    list.replaceChildren();
    for (const answer of day.answers) {
      const item = quiz.byKey.get(answer.code);
      const line = document.createElement('li');
      line.className = 'summary-item';

      const label = document.createElement('span');
      label.className = 'summary-label';
      label.textContent = summaryLabel(item, answer);

      const marks = document.createElement('span');
      marks.className = 'summary-marks';
      for (const { key, label: title } of fields) {
        const mark = document.createElement('span');
        mark.className = `mark ${answer[key].ok ? 'is-ok' : 'is-ko'}`;
        mark.title = title;
        mark.textContent = answer[key].ok ? '✓' : '✗';
        marks.appendChild(mark);
      }

      line.append(...[summaryLead(item, answer), label, marks].filter(Boolean));
      list.appendChild(line);
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
    const worst = review(state, quiz);

    const rows = [
      ['Jours joués', String(days.length)],
      ['Série en cours', `${streak(state.days, today)} jour(s)`],
      ['Réussite globale', possible ? `${Math.round((points / possible) * 100)} %` : '—'],
      ['À revoir', worst.length ? worst.join(', ') : '—'],
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

  return main();
}

/**
 * Une ligne de correction : l'icône, le libellé et le détail.
 * `detail` remplace le « Attendu : … » par défaut quand la réponse est fausse.
 */
function feedbackRow(label, result, answer, detail) {
  const row = document.createElement('div');
  row.className = `fb-row ${result.ok ? 'is-ok' : 'is-ko'}`;

  const icon = document.createElement('span');
  icon.className = 'fb-icon';
  icon.textContent = result.ok ? '✓' : '✗';

  const body = document.createElement('div');
  const title = document.createElement('span');
  title.className = 'fb-label';
  title.textContent = label;

  const text = document.createElement('span');
  text.className = 'fb-detail';
  if (result.ok && result.typo) text.textContent = `${answer} (orthographe approximative acceptée)`;
  else if (result.ok) text.textContent = answer;
  else text.textContent = detail ?? `Attendu : ${answer}`;

  body.append(title, text);
  row.append(icon, body);
  return row;
}
