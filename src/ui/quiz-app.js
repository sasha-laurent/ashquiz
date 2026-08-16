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
import { hasVirtualKeyboard } from './keyboard.js';
import { setupThemeNav } from './theme-nav.js';

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
 * @param {(item: object, ctx: object) => void} [spec.showChoices]  la question
 *   passe au mode carré : le thème rétrécit ce qui ne se coche pas dans le
 *   formulaire (la carte aux quatre zones proposées, les siècles aux quatre
 *   valeurs) d'après `ctx.choices`. Les champs texte, eux, sont pris en charge ici
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
    showChoices = () => {},
    reveal = () => {},
    expected = () => ({}),
    wrongDetail = () => ({}),
    summaryLead = () => null,
    summaryLabel = (item, answer) => answer.code,
    review = () => [],
  } = spec;

  // Avant tout le reste : l'en-tête doit rester navigable même si le thème ne
  // parvient pas à charger sa carte ou son corpus.
  setupThemeNav();

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
    seed: today,
    session: [],
    index: 0,
    answers: [],
    selection: null,
    revealed: false,
    // Mode carré : les propositions de la question en cours — nulles tant que le
    // joueur ne les a pas demandées — et celles qu'il a cochées.
    choices: null,
    picked: {},
  };

  let quiz = spec.quiz ?? null;
  // Par sous-réponse en texte libre : le bloc de propositions qui remplace la
  // saisie en mode carré. Construit une fois, rempli à chaque question.
  const choiceFields = new Map();

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
    /** Les propositions de la question en cours, ou null tant qu'on répond au clavier. */
    get choices() {
      return run.choices;
    },
    /** Enregistre la sous-réponse qui ne se saisit pas au clavier. */
    select(value) {
      run.selection = value;
    },
  };

  let screen = 'loading';

  function show(name) {
    screen = name;
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

    buildChoiceFields();
    wireEvents();
    await refreshStreak();

    const existing = startMode === DAILY ? await store.getDay(today) : null;
    if (existing) {
      await showSummary(existing, { alreadyDone: true });
    } else {
      startRun(startMode);
    }
  }

  /**
   * Le pendant « carré » de chaque champ texte : même libellé, quatre boutons à
   * la place de la saisie. Il est glissé juste après le champ, et c'est l'un ou
   * l'autre qui est affiché selon le mode.
   */
  function buildChoiceFields() {
    if (!quiz.hasChoices) return;

    for (const { key, label } of fields) {
      if (!(key in inputs)) continue;
      const field = el(inputs[key]).closest('.field');
      if (!field) continue;

      const box = document.createElement('div');
      box.className = 'field choice-field';
      box.hidden = true;

      const title = document.createElement('span');
      title.className = 'field-label';
      title.id = `choices-${key}-label`;
      // Le libellé du champ de saisie, quand il est plus explicite que celui de
      // la correction (« Nom du département » plutôt que « Nom »).
      title.textContent = field.querySelector('.field-label')?.textContent ?? label;

      const grid = document.createElement('div');
      grid.className = 'choice-grid';
      grid.setAttribute('role', 'radiogroup');
      grid.setAttribute('aria-labelledby', title.id);

      box.append(title, grid);
      field.after(box);
      choiceFields.set(key, { field, box, grid });
    }
  }

  /** Les propositions d'un champ texte, ou rien si la question n'est pas au carré. */
  function renderChoiceField(key) {
    const slot = choiceFields.get(key);
    if (!slot) return;

    const choices = run.choices?.[key] ?? null;
    slot.field.hidden = Boolean(choices);
    slot.box.hidden = !choices;
    if (!choices) return;

    slot.grid.replaceChildren(
      ...choices.values.map((value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'choice';
        button.dataset.value = String(value);
        button.textContent = String(value);
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        button.addEventListener('click', () => pickChoice(key, value));
        return button;
      }),
    );
  }

  function pickChoice(key, value) {
    if (run.revealed) return;
    run.picked[key] = value;
    for (const button of choiceFields.get(key).grid.children) {
      const picked = button.dataset.value === String(value);
      button.classList.toggle('is-picked', picked);
      button.setAttribute('aria-checked', String(picked));
    }
  }

  /** Correction d'un champ texte joué au carré : la bonne case, et l'erreur. */
  function revealChoiceField(key) {
    const choices = run.choices?.[key];
    if (!choices) return;
    const picked = run.picked[key];

    for (const button of choiceFields.get(key).grid.children) {
      button.disabled = true;
      const value = button.dataset.value;
      if (value === String(choices.correct)) button.classList.add('is-ok');
      else if (picked !== undefined && value === String(picked)) button.classList.add('is-ko');
    }
  }

  /**
   * Le coup de pouce : la question en cours passe au carré. Elle seule — la
   * suivante repartira au clavier — et sans effet sur la note.
   */
  function askChoices() {
    const item = run.session[run.index];
    if (run.revealed || run.choices) return;

    run.choices = quiz.buildChoices(item, run.seed, filter);
    run.picked = {};
    for (const id of inputIds) el(id).value = '';
    for (const key of choiceFields.keys()) renderChoiceField(key);
    // Le thème rétrécit ce qui ne se coche pas ici : la carte, les siècles.
    showChoices(item, ctx);
    syncCarreButton();
    focusFirstChoice();
  }

  /** Le bouton n'a de sens qu'une fois par question, avant la correction. */
  function syncCarreButton() {
    const button = el('btn-carre');
    if (!button) return;
    button.hidden = !quiz.hasChoices || run.revealed || Boolean(run.choices);
  }

  function wireEvents() {
    el('btn-carre')?.addEventListener('click', askChoices);

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
    run.seed = seed;
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
    run.picked = {};
    // Toute question commence au clavier : le carré se demande, question par
    // question.
    run.choices = null;

    for (const id of inputIds) {
      el(id).value = '';
      el(id).disabled = false;
    }
    for (const key of choiceFields.keys()) renderChoiceField(key);
    el('feedback').hidden = true;
    el('feedback').replaceChildren();
    el('btn-validate').hidden = false;
    el('btn-next').hidden = true;
    syncCarreButton();

    ask(item, ctx);

    renderProgress();
    focusQuestion();
  }

  /**
   * Où poser le focus quand la question change.
   *
   * Au pointeur fin, le premier champ : on lit, on tape. Sur un appareil
   * tactile, ce même focus appellerait le clavier virtuel par-dessus l'énoncé
   * (voir `keyboard.js`) — c'est alors l'énoncé qui le prend. Le champ s'obtient
   * d'une tape, et le focus a de toute façon un second rôle : le bouton
   * « Question suivante » vient de disparaître, et sans cela le focus retomberait
   * sur `<body>`. Un lecteur d'écran repart donc du début de la nouvelle
   * question, et la page défile jusqu'à elle plutôt que de rester au bas du
   * formulaire.
   */
  function focusQuestion() {
    if (inputIds.length && !hasVirtualKeyboard()) return el(inputIds[0]).focus();

    const prompt = el('answer-form').querySelector('.prompt');
    if (!prompt) return;
    // Un énoncé n'est pas un contrôle : il se vise, mais n'entre pas dans
    // l'ordre de tabulation. Posé ici et non dans les cinq pages — sans
    // JavaScript, il n'y aurait rien à viser.
    prompt.tabIndex = -1;
    prompt.focus();
  }

  /** Après le passage au carré, il n'y a plus rien à saisir : on va cocher. */
  function focusFirstChoice() {
    for (const { key } of fields) {
      const first = choiceFields.get(key)?.grid.firstElementChild;
      if (first) return first.focus();
    }
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
      if (!(key in inputs)) given[key] = run.selection;
      // Au carré, une proposition cochée vaut la saisie ; rien de coché vaut
      // réponse vide, donc fausse.
      else if (run.choices?.[key]) given[key] = run.picked[key] ?? '';
      else given[key] = el(inputs[key]).value;
    }

    const answer = quiz.grade(item, given);
    run.answers.push(answer);
    run.revealed = true;

    for (const id of inputIds) el(id).disabled = true;
    for (const key of choiceFields.keys()) revealChoiceField(key);
    syncCarreButton();
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
