// Carte cliquable des départements.

import { BY_CODE } from '../data/departments.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createMap(container, model) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${model.view.width} ${model.view.height}`);
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Carte des départements français');
  svg.classList.add('map');

  const paths = new Map();
  let listener = null;
  let locked = false;
  // Mode carré : les seules zones cliquables, ou `null` si toute la carte l'est.
  let allowed = null;

  for (const group of model.groups) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('map-group');

    if (group.label) {
      const frame = document.createElementNS(SVG_NS, 'rect');
      frame.setAttribute('x', group.box.x);
      frame.setAttribute('y', group.box.y);
      frame.setAttribute('width', group.box.w);
      frame.setAttribute('height', group.box.h);
      frame.setAttribute('rx', 8);
      frame.classList.add('map-inset');
      g.appendChild(frame);

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', group.box.x + 4);
      text.setAttribute('y', group.box.y - 6);
      text.classList.add('map-inset-label');
      text.textContent = group.label;
      g.appendChild(text);
    }

    for (const shape of group.shapes) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', shape.d);
      path.dataset.code = shape.code;
      path.classList.add('dept');
      g.appendChild(path);
      // Un département peut apparaître deux fois (métropole + encart IDF).
      const list = paths.get(shape.code) || [];
      list.push(path);
      paths.set(shape.code, list);
    }

    svg.appendChild(g);
  }

  svg.addEventListener('click', (event) => {
    if (locked) return;
    const target = event.target.closest('path.dept');
    if (!target) return;
    const code = target.dataset.code;
    if (allowed && !allowed.has(code)) return;
    setClass('is-selected', code);
    listener?.(code);
  });

  container.replaceChildren(svg);

  function setClass(className, code) {
    for (const [key, list] of paths) {
      for (const path of list) path.classList.toggle(className, key === code);
    }
  }

  /**
   * Mode carré : surligne les seules zones proposées et rend les autres
   * inertes. `null` rend toute la carte cliquable.
   * @param {string[]|null} codes
   */
  function restrict(codes) {
    allowed = codes ? new Set(codes) : null;
    svg.classList.toggle('is-restricted', Boolean(allowed));
    for (const [code, list] of paths) {
      for (const path of list) path.classList.toggle('is-option', Boolean(allowed?.has(code)));
    }
  }

  function clearSelection() {
    setClass('is-selected', null);
  }

  function clearClasses() {
    for (const list of paths.values()) {
      for (const path of list) path.classList.remove('is-selected', 'is-correct', 'is-wrong');
    }
  }

  function setTitles(enabled) {
    for (const [code, list] of paths) {
      for (const path of list) {
        const existing = path.querySelector('title');
        if (!enabled) {
          existing?.remove();
          continue;
        }
        const dep = BY_CODE.get(code);
        const label = dep ? `${dep.code} — ${dep.name}` : code;
        if (existing) existing.textContent = label;
        else {
          const title = document.createElementNS(SVG_NS, 'title');
          title.textContent = label;
          path.appendChild(title);
        }
      }
    }
  }

  return {
    element: svg,
    onSelect(callback) {
      listener = callback;
    },
    reset() {
      locked = false;
      clearClasses();
      setTitles(false);
      svg.classList.remove('is-locked');
      restrict(null);
    },
    restrict,
    clearSelection,
    /** Correction : on verrouille, on montre la bonne réponse et l'erreur. */
    reveal({ correct, given }) {
      locked = true;
      svg.classList.add('is-locked');
      clearClasses();
      // La correction reprend toute la carte : le vert et le rouge se lisent
      // mieux sans le surlignage des propositions par-dessus.
      restrict(null);
      for (const path of paths.get(correct) || []) path.classList.add('is-correct');
      if (given && given !== correct) {
        for (const path of paths.get(given) || []) path.classList.add('is-wrong');
      }
      setTitles(true);
    },
    has(code) {
      return paths.has(code);
    },
  };
}
