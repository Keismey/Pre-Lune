// Écran provisoire du socle : barre du haut, grille 20 × 30, barre du bas.
// Sert à vérifier le monde logique et la conversion doigt → case. Remplacé par la partie en V0 partie 2.

import { t } from "../i18n.js";
import { drawText, roundRectPath } from "../draw.js";

export function createGridScreen(game) {
  const { cfg, layout } = game;
  const ui = cfg.ui;
  const S = ui.sizes;
  const C = ui.colors;

  const back = {
    x: layout.bottomBar.x + (layout.width - S.back_w) / 2,
    y: layout.bottomBar.y + (layout.bottomBar.h - S.button_h) / 2,
    w: S.back_w,
    h: S.button_h,
  };

  let touched = null; // case sous le doigt
  let pressedBack = false;

  function inBack(x, y) {
    return x >= back.x && x <= back.x + back.w && y >= back.y && y <= back.y + back.h;
  }

  return {
    update() {},

    render(ctx) {
      const L = layout;

      // herbe en damier léger
      for (let r = 0; r < L.rows; r++) {
        for (let c = 0; c < L.cols; c++) {
          const rect = L.cellRect(c, r);
          ctx.fillStyle = (c + r) % 2 === 0 ? C.grass_a : C.grass_b;
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
      }
      ctx.strokeStyle = C.grid_line;
      ctx.lineWidth = S.grid_line_w;
      ctx.beginPath();
      for (let c = 0; c <= L.cols; c++) {
        ctx.moveTo(L.gridX + c * L.cell, L.gridY);
        ctx.lineTo(L.gridX + c * L.cell, L.gridY + L.gridH);
      }
      for (let r = 0; r <= L.rows; r++) {
        ctx.moveTo(L.gridX, L.gridY + r * L.cell);
        ctx.lineTo(L.gridX + L.gridW, L.gridY + r * L.cell);
      }
      ctx.stroke();

      if (touched) {
        const rect = L.cellRect(touched.c, touched.r);
        ctx.fillStyle = C.cell_highlight;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }

      // barres
      ctx.fillStyle = C.bar;
      ctx.fillRect(L.topBar.x, L.topBar.y, L.topBar.w, L.topBar.h);
      ctx.fillRect(L.bottomBar.x, L.bottomBar.y, L.bottomBar.w, L.bottomBar.h);

      drawText(ctx, t("game.title"), L.width / 2, L.topBar.h / 2, {
        font: ui.font,
        size: S.button_font,
        color: C.text,
        weight: 800,
      });

      // bouton retour (chevron) dans la barre du bas
      const down = pressedBack ? S.shadow_dy / 2 : 0;
      ctx.fillStyle = C.button;
      roundRectPath(ctx, back.x, back.y + down, back.w, back.h, S.button_radius);
      ctx.fill();
      ctx.strokeStyle = C.text;
      ctx.lineWidth = S.back_line;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const cx = back.x + back.w / 2;
      const cy = back.y + back.h / 2 + down;
      ctx.beginPath();
      ctx.moveTo(cx + S.back_chevron / 2, cy - S.back_chevron);
      ctx.lineTo(cx - S.back_chevron / 2, cy);
      ctx.lineTo(cx + S.back_chevron / 2, cy + S.back_chevron);
      ctx.stroke();

      drawText(ctx, t("game.wip"), L.width / 2, L.gridY + L.gridH / 2, {
        font: ui.font,
        size: S.wip_font,
        color: C.text_dark,
        weight: 700,
        maxWidth: L.width - 200,
      });
    },

    pointer(type, x, y) {
      if (type === "down") {
        pressedBack = inBack(x, y);
        touched = pressedBack ? null : game.layout.cellAt(x, y);
      } else if (type === "move") {
        if (!pressedBack) touched = game.layout.cellAt(x, y);
      } else {
        const wasBack = pressedBack;
        pressedBack = false;
        touched = null;
        if (type === "up" && wasBack && inBack(x, y)) game.goto("title");
      }
    },
  };
}
