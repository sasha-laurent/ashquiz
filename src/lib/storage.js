// Couche de persistance. Volontairement asynchrone et isolée derrière une
// petite interface : brancher un backend plus tard ne demandera que d'écrire un
// autre `adapter` ayant les mêmes trois méthodes, sans toucher au reste du code.

import { dateKey } from './date.js';

const KEY = 'ashquiz.v1';
// Ancien nom du site : on relit cette clé une fois pour ne pas perdre la
// progression déjà enregistrée. À supprimer dans quelques mois.
const LEGACY_KEY = 'quotiquiz.v1';

const empty = () => ({ version: 1, days: {}, departments: {} });

/** Adapter par défaut : localStorage du navigateur. */
export const localAdapter = {
  async read() {
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (!raw) return empty();
      const data = JSON.parse(raw);
      return { ...empty(), ...data };
    } catch {
      return empty();
    }
  },
  async write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* quota plein ou mode privé : on continue sans persistance */
    }
  },
  async clear() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function createStore(adapter = localAdapter) {
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

    /** Enregistre une journée terminée et met à jour les stats par département. */
    async saveDay(dateKey, day) {
      const state = await load();
      state.days[dateKey] = day;
      for (const answer of day.answers) {
        const stat = (state.departments[answer.code] ??= { seen: 0, name: 0, prefecture: 0, map: 0 });
        stat.seen += 1;
        stat.name += answer.name.ok ? 1 : 0;
        stat.prefecture += answer.prefecture.ok ? 1 : 0;
        stat.map += answer.map.ok ? 1 : 0;
        stat.lastSeen = dateKey;
      }
      await adapter.write(state);
    },

    async reset() {
      cache = empty();
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
