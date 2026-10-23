// Disposition du monde logique : barre du haut, grille, barre du bas.
// Toutes les valeurs viennent de balance.json (section world).

export function createLayout(world) {
  const { width, height, top_bar, bottom_bar, cols, rows, cell } = world;

  const gridW = cols * cell;
  const gridH = rows * cell;
  if (top_bar + gridH + bottom_bar !== height || gridW > width) {
    console.warn("[world] les dimensions de balance.json ne tiennent pas dans le monde logique");
  }

  const gridX = (width - gridW) / 2;
  const gridY = top_bar;

  return {
    width,
    height,
    cols,
    rows,
    cell,
    gridX,
    gridY,
    gridW,
    gridH,
    topBar: { x: 0, y: 0, w: width, h: top_bar },
    bottomBar: { x: 0, y: gridY + gridH, w: width, h: bottom_bar },

    // case sous un point du monde, ou null hors de la grille
    cellAt(x, y) {
      const c = Math.floor((x - gridX) / cell);
      const r = Math.floor((y - gridY) / cell);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
      return { c, r };
    },

    // rectangle d'une case
    cellRect(c, r) {
      return { x: gridX + c * cell, y: gridY + r * cell, w: cell, h: cell };
    },
  };
}
