// Générateur pseudo-aléatoire déterministe : une même graine donne toujours la
// même suite. C'est ce qui permet d'avoir « le quiz du jour » stable, même si
// on recharge la page.

/** Hash 32 bits d'une chaîne (FNV-1a). */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG mulberry32 : renvoie une fonction () => nombre dans [0, 1). */
export function makeRng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tire `count` éléments distincts de `items` (Fisher-Yates partiel). */
export function sample(items, count, rng) {
  const pool = items.slice();
  const out = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }
  return out;
}
