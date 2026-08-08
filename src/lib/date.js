/** Clé de journée au format AAAA-MM-JJ, en heure locale. */
export function dateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** « samedi 8 août 2026 » */
export function humanDate(key) {
  return FORMATTER.format(new Date(`${key}T12:00:00`));
}
