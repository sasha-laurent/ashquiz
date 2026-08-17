// La barre des thèmes de l'en-tête, repliée quand l'écran est étroit.
//
// Les sept pastilles tiennent sur une ligne au large, mais font plus de 550 px :
// sur un téléphone elles débordaient de la page, qui se mettait alors à défiler
// horizontalement. À l'étroit, un bouton les remplace et les déplie sous
// l'en-tête.
//
// Le bouton est créé ici et non dans les sept pages HTML : c'est un affordance de
// JavaScript, et sans JavaScript il ne doit pas apparaître. Dans ce cas la barre
// reste affichée telle quelle — `styles.css` la fait passer à la ligne, ce qui
// coûte une rangée mais ne déborde jamais. C'est aussi une duplication de moins
// à tenir à jour entre les pages.

const OPEN = 'is-open';

/**
 * Ajoute le bouton qui replie la barre des thèmes. Appelé une fois par page, au
 * démarrage (`src/ui/quiz-app.js`, `src/app-menu.js`) ; sans en-tête ni barre,
 * ne fait rien.
 *
 * @returns {HTMLButtonElement|null} le bouton, pour les tests
 */
export function setupThemeNav() {
  const bar = document.querySelector('.topbar');
  const nav = bar?.querySelector('.themes');
  if (!nav || bar.querySelector('.nav-toggle')) return null;

  if (!nav.id) nav.id = 'theme-nav';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  // Le bouton n'affiche qu'un pictogramme : son nom se lit dans `aria-label`.
  toggle.setAttribute('aria-label', 'Thèmes');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', nav.id);

  const icon = document.createElement('span');
  icon.className = 'nav-toggle-icon';
  icon.setAttribute('aria-hidden', 'true');
  toggle.append(icon);

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const setOpen = (open) => {
    nav.classList.toggle(OPEN, open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  // Le menu se referme au clic à côté et à la touche Échap, comme tout menu
  // déroulant. Un clic sur un lien de la barre, lui, change de page.
  document.addEventListener('click', (event) => {
    if (isOpen() && !bar.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    toggle.focus();
  });

  // Devant la barre : le bouton la précède au clavier comme à l'écran.
  nav.before(toggle);
  // Ce n'est qu'une fois le bouton en place que la barre peut se replier ;
  // la feuille de style ne le fait qu'à partir de cette classe.
  bar.classList.add('has-nav-toggle');

  return toggle;
}
