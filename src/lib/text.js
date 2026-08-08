// Comparaison tolérante des réponses en texte libre : on ignore la casse, les
// accents, les tirets, les apostrophes, les abréviations « St / Saint » et les
// petites fautes de frappe.

/** Forme canonique d'une réponse. */
export function normalize(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/[-–—_.]/g, ' ')
    .replace(/\bsainte\b/g, 'ste')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Variantes comparables d'une réponse : avec/sans espaces, avec/sans article. */
export function variants(str) {
  const base = normalize(str);
  const noArticle = base.replace(/^(le|la|les|l|du|de|des) /, '');
  const set = new Set([base, noArticle, base.replace(/ /g, ''), noArticle.replace(/ /g, '')]);
  set.delete('');
  return [...set];
}

/**
 * Distance de Damerau-Levenshtein (l'inversion de deux lettres coûte 1, comme
 * dans « Grenobel »), avec abandon dès que `max` est dépassé.
 */
export function editDistance(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prev2[j - 2] + 1);
      }
      cur[j] = value;
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Fautes de frappe tolérées, proportionnelles à la longueur du mot attendu. */
function tolerance(len) {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  if (len <= 14) return 2;
  return 3;
}

/**
 * Compare une saisie aux réponses acceptées.
 * @param {string} given saisie de l'utilisateur
 * @param {string[]} acceptedAnswers réponses attendues (nom officiel + alias)
 * @param {(variant: string) => boolean} [isOtherAnswer] vrai si la saisie est la
 *   réponse exacte d'un *autre* département : « Loire » ne doit alors pas passer
 *   pour « Loiret » au titre de la tolérance aux fautes de frappe.
 * @returns {{ status: 'correct'|'typo'|'wrong' }}
 */
export function check(given, acceptedAnswers, isOtherAnswer = () => false) {
  const input = variants(given);
  if (!input.length) return { status: 'wrong' };

  let closest = Infinity;
  for (const answer of acceptedAnswers) {
    for (const target of variants(answer)) {
      for (const candidate of input) {
        if (candidate === target) return { status: 'correct' };
        if (isOtherAnswer(candidate)) continue;
        const max = tolerance(target.length);
        if (max > 0) {
          const d = editDistance(candidate, target, max);
          if (d <= max) closest = Math.min(closest, d);
        }
      }
    }
  }
  return { status: closest < Infinity ? 'typo' : 'wrong' };
}
