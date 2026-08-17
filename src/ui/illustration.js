// L'illustration de la question, le temps qu'elle arrive.
//
// Trois thèmes posent leur question en image — le tableau, le drapeau, la photo
// de plante — et passer à la question suivante ne fait que changer le `src` de
// la même balise. Le navigateur, lui, garde l'image précédente à l'écran tant
// que la nouvelle n'est pas chargée : sur un bon réseau cela ne se voit pas,
// sur un mauvais la question suivante s'ouvre sur l'illustration de la
// précédente — celle dont on vient justement de lire la réponse. On croit
// reconnaître, on répond, et l'image change sous les doigts.
//
// D'où ce module : pendant le chargement, l'illustration cède la place à un
// cadre d'attente. Mieux vaut ne rien montrer qu'une réponse périmée.
//
// Le cadre est posé ici et non écrit dans les trois pages : sans JavaScript,
// aucune image ne se remplace, et il n'y aurait donc rien à faire patienter.
//
// Ce qui se montre et ce qui se cache passe par `hidden`, jamais par une classe
// que `styles.css` traduirait en `display`. Les deux fichiers ne sont pas servis
// à la même heure : GitHub Pages garde la feuille de style dix minutes en cache,
// si bien qu'un script fraîchement déployé tourne un moment avec l'ancienne
// feuille. Une classe n'y voudrait rien dire — le cadre resterait affiché sous
// l'ancienne image, c'est-à-dire le contraire de ce qu'il vient faire. `hidden`,
// lui, est compris du navigateur seul ; `styles.css` ne fait plus que l'allure.

/**
 * Affiche l'illustration d'une question, et un cadre d'attente tant qu'elle
 * charge. Prend en charge le repli des images injoignables (`is-broken`), que
 * les pages décrivent chacune à leur façon.
 *
 * @param {HTMLElement} figure  la `<figure>` du thème (`#artwork`, `#flag`, `#plant`)
 * @param {HTMLImageElement} image  l'image de cette figure
 * @param {string} src  l'illustration à charger
 */
export function showIllustration(figure, image, src) {
  const placeholder = ensurePlaceholder(figure, image);

  /** Fin d'attente : l'illustration s'affiche, ou la page explique son absence. */
  const settle = (broken) => {
    figure.classList.remove('is-loading');
    figure.classList.toggle('is-broken', broken);
    placeholder.hidden = true;
    image.hidden = false;
  };

  // Les mains sont posées avant le `src` : un chargement chasse l'autre, et le
  // navigateur abandonne la requête en cours sans plus prévenir personne.
  image.onload = () => settle(false);
  image.onerror = () => settle(true);

  figure.classList.remove('is-broken');
  image.src = src;

  // Une image déjà en cache est là avant même cette ligne : le cadre d'attente
  // n'aurait fait que clignoter d'une question à l'autre. `naturalWidth` à zéro
  // dit l'autre cas déjà tranché — une image dont le chargement a échoué est
  // « complète » elle aussi.
  if (image.complete) {
    settle(!image.naturalWidth);
    return;
  }

  figure.classList.add('is-loading');
  image.hidden = true;
  placeholder.hidden = false;
}

/** Le cadre d'attente de la figure, créé à la première question. */
function ensurePlaceholder(figure, image) {
  const existing = figure.querySelector('.illustration-placeholder');
  if (existing) return existing;

  const placeholder = figure.ownerDocument.createElement('p');
  placeholder.className = 'illustration-placeholder';
  placeholder.textContent = "Chargement de l'illustration…";
  // Il n'entre en scène qu'entre deux images ; le reste du temps, il n'existe
  // pour personne.
  placeholder.hidden = true;
  // L'`alt` de l'image annonce déjà la question à un lecteur d'écran, et il ne
  // change pas pendant le chargement : le redire à chaque question n'ajouterait
  // que du bruit.
  placeholder.setAttribute('aria-hidden', 'true');
  image.before(placeholder);
  return placeholder;
}
