// Récapitulatif du jour, tous thèmes confondus : le petit encart d'accueil qui
// dit d'un coup d'œil ce qui est fait et ce qui reste.
//
// La fonction est pure — elle reçoit ce que le menu a déjà lu dans chaque
// magasin — pour rester testable sans navigateur.

/**
 * @param {Array<{theme: object, day: {score: number, max: number}|null}>} entries
 *   un couple par thème, `day` valant null si le quiz du jour n'est pas fait
 *   (ou si la progression n'a pas pu être lue).
 */
export function summarizeDay(entries) {
  const themes = entries.map(({ theme, day }) => ({
    id: theme.id,
    icon: theme.icon,
    name: theme.name,
    href: theme.href,
    done: Boolean(day),
    score: day?.score ?? 0,
    max: day?.max ?? 0,
  }));

  const done = themes.filter((entry) => entry.done);

  return {
    themes,
    done: done.length,
    total: themes.length,
    // Le total ne porte que sur les quiz faits : le barème d'un thème jamais
    // joué n'est pas connu, et « 11 / 15 » se lit mieux que « 11 / 30 ».
    score: done.reduce((sum, entry) => sum + entry.score, 0),
    max: done.reduce((sum, entry) => sum + entry.max, 0),
    complete: done.length > 0 && done.length === themes.length,
  };
}

/** « 3 quiz sur 6 · 11 / 15 points » */
export function recapLabel(summary) {
  if (summary.total === 0) return '';
  if (summary.done === 0) return `Aucun quiz fait — ${summary.total} à découvrir`;

  const counts = summary.complete
    ? `Les ${summary.total} quiz sont faits`
    : `${summary.done} quiz sur ${summary.total}`;
  return `${counts} · ${summary.score} / ${summary.max} points`;
}

/** L'intitulé d'une pastille, pour les lecteurs d'écran et l'infobulle. */
export function chipLabel(entry) {
  return entry.done
    ? `${entry.name} : ${entry.score} / ${entry.max} points`
    : `${entry.name} : quiz du jour à faire`;
}
