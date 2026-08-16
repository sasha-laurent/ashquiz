// L'illustration en grand.
//
// Le tableau et le drapeau partagent la place avec le formulaire : bornés à
// 62 vh au large et à 46 vh dès que les colonnes s'empilent, ils suffisent à
// reconnaître un drapeau, rarement à détailler un tableau — un visage au fond,
// une signature, la matière d'une toile. Un clic les affiche donc sur toute la
// page, et un second referme : c'est le même geste qui ouvre et qui ferme, sans
// croix à viser.
//
// Comme le bouton des thèmes (`theme-nav.js`), la fenêtre et l'affordance sont
// posées ici et non écrites dans les pages : sans JavaScript, une image annoncée
// cliquable ne s'ouvrirait pas. Les pages n'ont qu'à marquer d'un `data-zoom` ce
// qui s'agrandit.

/**
 * Installe la fenêtre d'agrandissement et rend cliquable tout `img[data-zoom]`
 * de la page. Appelée une fois au démarrage (`src/ui/quiz-app.js`) ; sans image
 * à agrandir, ne fait rien.
 *
 * @param {Document} [doc]  le document à équiper ; paramétrable pour les tests
 * @returns {HTMLElement|null} la fenêtre, pour les tests
 */
export function setupLightbox(doc = document) {
  const sources = [...doc.querySelectorAll('img[data-zoom]')];
  if (!sources.length || doc.querySelector('.lightbox')) return null;

  const box = doc.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', "L'illustration en grand");

  const image = doc.createElement('img');
  image.className = 'lightbox-image';
  image.alt = '';

  const caption = doc.createElement('p');
  caption.className = 'lightbox-caption';
  caption.hidden = true;

  // Refermer se fait au clic n'importe où : ce bouton est là pour le clavier, et
  // pour dire que la page assombrie se quitte.
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'lightbox-close';
  close.setAttribute('aria-label', 'Fermer');
  close.textContent = '×';

  box.append(close, image, caption);
  doc.body.append(box);

  // À qui rendre le focus une fois la fenêtre refermée.
  let opener = null;

  function open(source) {
    // `currentSrc` est l'URL réellement chargée ; `src` suffit tant qu'aucune
    // image n'a de `srcset`, mais ne coûte rien de plus.
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    // La légende de la figure, quand il y en a une : vide tant que la réponse
    // n'est pas donnée, elle ne dévoile donc jamais la solution avant l'heure.
    const legend = source.closest('figure')?.querySelector('figcaption')?.textContent ?? '';
    caption.textContent = legend;
    caption.hidden = !legend;

    opener = source;
    box.hidden = false;
    // La page derrière ne doit plus défiler : sur un téléphone, le geste de
    // fermeture est un appui, pas un glissement raté.
    doc.body.classList.add('has-lightbox');
    close.focus();
  }

  function shut() {
    if (box.hidden) return;
    box.hidden = true;
    doc.body.classList.remove('has-lightbox');
    // Le focus revient à l'illustration : on repart d'où l'on avait cliqué.
    opener?.focus();
    opener = null;
  }

  // L'image comprise : recliquer referme, où que soit le pointeur.
  box.addEventListener('click', shut);

  doc.addEventListener('keydown', (event) => {
    if (box.hidden) return;
    if (event.key === 'Escape') shut();
    // La fenêtre ne contient qu'un bouton : à défaut, Tab s'en irait parcourir
    // le formulaire caché derrière la page assombrie.
    else if (event.key === 'Tab') {
      event.preventDefault();
      close.focus();
    }
  });

  for (const source of sources) {
    source.classList.add('zoomable');
    // Une image n'est ni focalisable ni actionnable au clavier : elle le devient
    // ici, pour que l'agrandissement ne soit pas réservé au pointeur. Son nom
    // reste celui de l'`alt` — « Drapeau à identifier », puis le pays une fois la
    // réponse donnée ; le geste, lui, se dit en description.
    source.tabIndex = 0;
    source.setAttribute('role', 'button');
    source.title = 'Afficher en grand';

    source.addEventListener('click', () => open(source));
    source.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // Sans quoi Espace ferait défiler la page sous la fenêtre qui s'ouvre.
      event.preventDefault();
      open(source);
    });
  }

  return box;
}
