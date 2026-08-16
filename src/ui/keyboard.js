// Le clavier virtuel, et le focus automatique qui le fait surgir.
//
// Poser le curseur dans le premier champ à chaque nouvelle question fait gagner
// un geste : on lit l'énoncé, on tape. Sur un téléphone, le même focus appelle
// le clavier à l'écran, qui couvre la moitié basse de la page : l'énoncé — un
// tableau, un drapeau, une carte — est poussé hors de vue ou réduit à une
// bande, et il faut refermer le clavier pour lire la question qu'on vient de
// recevoir. Le raccourci se paie donc précisément là où il coûte le plus cher.
//
// La ligne de partage n'est pas la largeur de l'écran mais le pointeur : c'est
// l'appareil tactile qui affiche un clavier, tablette de 1024 px comprise, et
// une fenêtre de bureau rétrécie qui n'en affiche pas. `(pointer: coarse)` dit
// exactement cela, là où `(max-width: 720px)` — le seuil de l'en-tête, qui est
// une question d'encombrement — se tromperait des deux côtés.

/**
 * L'appareil fait-il apparaître un clavier à l'écran quand un champ prend le
 * focus ?
 *
 * @param {Window|object} [view]  la fenêtre à interroger ; paramétrable pour les tests
 * @returns {boolean} faux quand rien ne permet d'en décider — sans `matchMedia`
 *   le focus automatique reste en place, comme avant
 */
export function hasVirtualKeyboard(view = globalThis) {
  return view?.matchMedia?.('(pointer: coarse)')?.matches === true;
}
