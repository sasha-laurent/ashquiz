// Couche de persistance. Volontairement asynchrone et isolée derrière une
// petite interface : brancher un backend plus tard ne demandera que d'écrire un
// autre `adapter` ayant les mêmes trois méthodes, sans toucher au reste du code.

import { dateKey } from './date.js';

const KEY = 'ashquiz.v1';
// Ancien nom du site : on relit cette clé une fois pour ne pas perdre la
// progression déjà enregistrée. À supprimer dans quelques mois.
const LEGACY_KEY = 'quotiquiz.v1';

const empty = (statsKey = 'departments') => ({ version: 1, days: {}, [statsKey]: {} });

/**
 * Adapter localStorage. Chaque thème a sa propre clé : le quiz des tableaux ne
 * doit pas écraser la progression du quiz des départements, ni compter dans sa
 * série de jours.
 */
export function createLocalAdapter({ key = KEY, legacyKeys = [], statsKey } = {}) {
  return {
    async read() {
      try {
        const raw = [key, ...legacyKeys].map((k) => localStorage.getItem(k)).find(Boolean);
        if (!raw) return empty(statsKey);
        return { ...empty(statsKey), ...JSON.parse(raw) };
      } catch {
        return empty(statsKey);
      }
    },
    async write(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        for (const old of legacyKeys) localStorage.removeItem(old);
      } catch {
        /* quota plein ou mode privé : on continue sans persistance */
      }
    },
    async clear() {
      try {
        for (const k of [key, ...legacyKeys]) localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
}

/** Adapter par défaut : le quiz des départements. */
export const localAdapter = createLocalAdapter({ legacyKeys: [LEGACY_KEY], statsKey: 'departments' });

/**
 * @param {object} adapter  couche de persistance (`read` / `write` / `clear`)
 * @param {{statsKey?: string}} [options]  nom du sous-objet où agréger les
 *   statistiques par item — un par thème.
 */
export function createStore(adapter = localAdapter, { statsKey = 'departments' } = {}) {
  let cache = null;
  const load = async () => (cache ??= await adapter.read());

  return {
    async getState() {
      return structuredClone(await load());
    },

    /** Le résultat déjà enregistré pour ce jour, ou null. */
    async getDay(dateKey) {
      const state = await load();
      return state.days[dateKey] ?? null;
    },

    /**
     * Enregistre une journée terminée et met à jour les stats par item.
     * Les sous-réponses sont découvertes sur l'objet corrigé (toute propriété
     * portant un `ok`), ce qui rend la fonction indépendante du thème : le quiz
     * des départements y range `name`/`prefecture`/`map`, celui des tableaux
     * `title`/`painter`/`century`.
     */
    async saveDay(dateKey, day) {
      const state = await load();
      state.days[dateKey] = day;
      const stats = (state[statsKey] ??= {});
      for (const answer of day.answers) {
        const stat = (stats[answer.code] ??= { seen: 0 });
        stat.seen += 1;
        for (const [field, result] of Object.entries(answer)) {
          if (result && typeof result === 'object' && 'ok' in result) {
            stat[field] = (stat[field] ?? 0) + (result.ok ? 1 : 0);
          }
        }
        stat.lastSeen = dateKey;
      }
      await adapter.write(state);
    },

    async reset() {
      cache = empty(statsKey);
      await adapter.clear();
    },
  };
}

/** Série de jours consécutifs terminés, en remontant depuis `todayKey`. */
export function streak(days, todayKey) {
  const date = new Date(`${todayKey}T12:00:00`);
  let count = 0;
  // Si le quiz du jour n'est pas encore fait, la série court jusqu'à hier.
  if (!days[todayKey]) date.setDate(date.getDate() - 1);
  for (;;) {
    const key = dateKey(date);
    if (!days[key]) return count;
    count += 1;
    date.setDate(date.getDate() - 1);
  }
}
