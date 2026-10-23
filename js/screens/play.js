// Écran de partie (V0, partie 2) : une couleur, le tracé au doigt, les créatures qui livrent,
// l'effacement d'un tap, l'option de décalage du curseur. Formes simples en attendant les images.

import { t } from "../i18n.js";
import { getSettings, setSetting } from "../save.js";
import { createSim } from "../sim.js";
import { drawText, roundRectPath } from "../draw.js";

export function createPlayScreen(game) {
  const { cfg, layout } = game;
  const ui = cfg.ui;
  const S = ui.sizes;
  const C = ui.colors;
  const P = ui.play;
  const PC = P.colors;
  const H = P.hud;
  const CRT = P.creature;
  const W = layout.width;
  const unit = cfg.buildings.size * layout.cell; // côté d'un bâtiment

  let sim = null;
  let cursorOffset = false;
  let finger = null; // doigt posé (monde)
  let downAt = 0;
  let startedAtDown = false;
  let pressed = null;

  const bar = layout.bottomBar;
  const by = bar.y + (bar.h - S.button_h) / 2;
  const buttons = {
    back: { id: "back", x: S.bar_margin, y: by, w: S.back_w, h: S.button_h },
    offset: { id: "offset", x: W - S.bar_margin - S.toggle_w, y: by, w: S.toggle_w, h: S.button_h },
  };

  const inRect = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const buttonAt = (x, y) => Object.values(buttons).find((b) => inRect(b, x, y)) || null;

  // Point utilisé pour tracer : le doigt, ou le curseur décalé au-dessus du doigt.
  const aim = (x, y) => (cursorOffset ? { x, y: y - cfg.input.cursor_offset_px } : { x, y });

  // ---------- Dessin ----------

  function drawTile(ctx, c, r, scale) {
    const q = layout.cellRect(c, r);
    ctx.fillStyle = PC.grout;
    ctx.fillRect(q.x, q.y, q.w, q.h);
    const side = (q.w - 2 * P.tile_inset) * scale;
    ctx.fillStyle = PC.tile;
    roundRectPath(ctx, q.x + q.w / 2 - side / 2, q.y + q.h / 2 - side / 2, side, side, P.tile_radius);
    ctx.fill();
  }

  function drawBuilding(ctx, b, tickF) {
    const pal = cfg.palette[b.color];
    const u = unit;
    let scale = 1;
    const age = tickF - b.bumpAt;
    if (age >= 0 && age < P.building_bump_ticks) {
      scale = 1 + P.building_bump_amp * Math.sin((Math.PI * age) / P.building_bump_ticks);
    }
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(scale, scale);
    ctx.translate(-b.x, -b.y);

    ctx.fillStyle = PC.shadow;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 0.42 * u, 0.46 * u, 0.12 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    if (b.kind === "house") {
      ctx.fillStyle = pal.main;
      roundRectPath(ctx, b.x - 0.36 * u, b.y - 0.02 * u, 0.72 * u, 0.46 * u, 0.06 * u);
      ctx.fill();
      ctx.fillStyle = pal.dark;
      ctx.beginPath();
      ctx.moveTo(b.x - 0.46 * u, b.y + 0.02 * u);
      ctx.lineTo(b.x, b.y - 0.46 * u);
      ctx.lineTo(b.x + 0.46 * u, b.y + 0.02 * u);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.text_dark;
      roundRectPath(ctx, b.x - 0.08 * u, b.y + 0.2 * u, 0.16 * u, 0.24 * u, 0.04 * u);
      ctx.fill();
      ctx.fillStyle = pal.light;
      ctx.beginPath();
      ctx.arc(b.x + 0.22 * u, b.y + 0.14 * u, 0.06 * u, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = pal.main;
      roundRectPath(ctx, b.x - 0.42 * u, b.y - 0.1 * u, 0.84 * u, 0.54 * u, 0.06 * u);
      ctx.fill();
      ctx.fillStyle = pal.dark;
      ctx.fillRect(b.x + 0.2 * u, b.y - 0.46 * u, 0.14 * u, 0.26 * u);
      roundRectPath(ctx, b.x - 0.46 * u, b.y - 0.22 * u, 0.92 * u, 0.18 * u, 0.05 * u);
      ctx.fill();
      ctx.fillStyle = C.text_dark;
      roundRectPath(ctx, b.x - 0.14 * u, b.y + 0.14 * u, 0.28 * u, 0.3 * u, 0.05 * u);
      ctx.fill();
      ctx.fillStyle = pal.light;
      ctx.beginPath();
      ctx.arc(b.x - 0.27 * u, b.y + 0.12 * u, 0.07 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCreature(ctx, cr, alpha) {
    const pal = cfg.palette[cr.color];
    const x = cr.px + (cr.x - cr.px) * alpha;
    const y = cr.py + (cr.y - cr.py) * alpha;
    const pop = Math.min(1, cr.age / CRT.pop_in_s);
    const rad = CRT.radius * pop;
    ctx.fillStyle = PC.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y + CRT.shadow_dy, CRT.shadow_rx * pop, CRT.shadow_ry * pop, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.main;
    ctx.strokeStyle = pal.dark;
    ctx.lineWidth = CRT.outline;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.beginPath();
    ctx.arc(x + cr.dx * CRT.eye_reach * pop, y + cr.dy * CRT.eye_reach * pop - 2, CRT.eye_r * pop, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud(ctx) {
    const L = layout;
    ctx.fillStyle = C.bar;
    ctx.fillRect(L.topBar.x, L.topBar.y, L.topBar.w, L.topBar.h);
    ctx.fillRect(L.bottomBar.x, L.bottomBar.y, L.bottomBar.w, L.bottomBar.h);

    const flash = sim.noTilesFlash > 0;
    const shake = flash ? Math.sin(sim.noTilesFlash * H.shake_hz) * H.shake_px : 0;
    const valueColor = flash ? PC.warn : C.text;

    // dalles : icône à gauche, valeur à sa droite
    const ix = H.pad + H.icon / 2 + shake;
    ctx.fillStyle = PC.grout;
    roundRectPath(ctx, ix - H.icon / 2, H.value_y - H.icon / 2, H.icon, H.icon, P.tile_radius);
    ctx.fill();
    ctx.fillStyle = flash ? PC.warn : PC.tile;
    const inner = H.icon - 2 * P.tile_inset * 2;
    roundRectPath(ctx, ix - inner / 2, H.value_y - inner / 2, inner, inner, P.tile_radius / 2);
    ctx.fill();
    drawText(ctx, String(sim.tiles), ix + H.icon / 2 + H.gap, H.value_y, {
      font: ui.font,
      size: H.value_font,
      color: valueColor,
      weight: 800,
      align: "left",
    });
    drawText(ctx, t("hud.tiles"), H.pad + shake, H.label_y, {
      font: ui.font,
      size: H.label_font,
      color: C.text,
      weight: 600,
      align: "left",
      alpha: 0.8,
    });

    // livraisons : icône à droite, valeur à sa gauche
    const rx = W - H.pad - H.icon / 2;
    const pal = cfg.palette[cfg.game.start_colors[0]];
    ctx.fillStyle = pal.main;
    ctx.strokeStyle = pal.dark;
    ctx.lineWidth = CRT.outline;
    ctx.beginPath();
    ctx.arc(rx, H.value_y, H.icon / 2 - CRT.outline, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawText(ctx, String(sim.deliveries), rx - H.icon / 2 - H.gap, H.value_y, {
      font: ui.font,
      size: H.value_font,
      color: C.text,
      weight: 800,
      align: "right",
    });
    drawText(ctx, t("hud.deliveries"), W - H.pad, H.label_y, {
      font: ui.font,
      size: H.label_font,
      color: C.text,
      weight: 600,
      align: "right",
      alpha: 0.8,
    });
  }

  function drawButtons(ctx) {
    const down = (b) => (pressed === b ? S.shadow_dy / 2 : 0);

    // retour (chevron)
    const b = buttons.back;
    ctx.fillStyle = C.button;
    roundRectPath(ctx, b.x, b.y + down(b), b.w, b.h, S.button_radius);
    ctx.fill();
    ctx.strokeStyle = C.text;
    ctx.lineWidth = S.back_line;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 + down(b);
    ctx.beginPath();
    ctx.moveTo(cx + S.back_chevron / 2, cy - S.back_chevron);
    ctx.lineTo(cx - S.back_chevron / 2, cy);
    ctx.lineTo(cx + S.back_chevron / 2, cy + S.back_chevron);
    ctx.stroke();

    // décalage du curseur : jaune quand il est actif
    const o = buttons.offset;
    ctx.fillStyle = cursorOffset ? C.button_selected : C.button;
    roundRectPath(ctx, o.x, o.y + down(o), o.w, o.h, S.button_radius);
    ctx.fill();
    drawText(ctx, t(cursorOffset ? "opt.offset_on" : "opt.offset_off"), o.x + o.w / 2, o.y + o.h / 2 + down(o), {
      font: ui.font,
      size: S.toggle_font,
      color: cursorOffset ? C.text_dark : C.text,
      weight: 800,
      maxWidth: o.w - 40,
    });
  }

  return {
    enter() {
      cursorOffset = !!getSettings().cursor_offset;
      sim = createSim(cfg, layout, Date.now() >>> 0); // la graine vient de l'horloge ; tout le reste est déterministe
      finger = null;
      pressed = null;
      startedAtDown = false;
    },

    update() {
      sim.step();
    },

    render(ctx, alpha) {
      const L = layout;
      const tickF = sim.tick + alpha;

      // herbe en damier léger
      for (let r = 0; r < L.rows; r++) {
        for (let c = 0; c < L.cols; c++) {
          const q = L.cellRect(c, r);
          ctx.fillStyle = (c + r) % 2 === 0 ? C.grass_a : C.grass_b;
          ctx.fillRect(q.x, q.y, q.w, q.h);
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

      // dalles : celles qui viennent d'être posées rebondissent, et passent par-dessus
      const bouncing = [];
      for (let r = 0; r < L.rows; r++) {
        for (let c = 0; c < L.cols; c++) {
          const i = r * L.cols + c;
          if (!sim.path[i]) continue;
          const age = tickF - sim.placedAt[i];
          if (sim.placedAt[i] >= 0 && age < P.bounce_ticks) bouncing.push([c, r, age]);
          else drawTile(ctx, c, r, 1);
        }
      }
      for (const [c, r, age] of bouncing) {
        drawTile(ctx, c, r, 1 + P.bounce_amp * Math.sin((Math.PI * age) / P.bounce_ticks));
      }

      // tête du tracé : case entourée, ou anneau autour du bâtiment de départ
      const s = sim.stroke;
      if (s) {
        ctx.strokeStyle = PC.head;
        ctx.lineWidth = P.head_ring_w;
        if (s.stack.length) {
          const e = s.stack[s.stack.length - 1];
          const q = L.cellRect(e.c, e.r);
          roundRectPath(ctx, q.x + 2, q.y + 2, q.w - 4, q.h - 4, P.tile_radius);
          ctx.stroke();
        } else {
          ctx.save();
          ctx.globalAlpha = P.start_ring_alpha;
          ctx.beginPath();
          ctx.arc(s.building.x, s.building.y, cfg.buildings.start_radius_cells * L.cell, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // créatures sous les bâtiments : elles sortent de la chaumière et entrent dans l'atelier
      for (const cr of sim.creatures) drawCreature(ctx, cr, alpha);
      for (const b of sim.buildings) drawBuilding(ctx, b, tickF);

      // petits « +N » qui montent
      for (const p of sim.popups) {
        const k = p.age / P.popup.life_s;
        drawText(ctx, t("fx.plus", { n: p.n }), p.x, p.y - P.popup.rise_px * k, {
          font: ui.font,
          size: P.popup.font,
          color: p.kind === "tiles" ? PC.popup_tile : PC.popup_delivery,
          weight: 800,
          alpha: 1 - k,
          shadow: { color: C.text_shadow, dy: S.shadow_dy / 2 },
        });
      }

      // curseur décalé : anneau au-dessus du doigt, relié au doigt par un trait
      if (cursorOffset && finger) {
        const a = aim(finger.x, finger.y);
        ctx.strokeStyle = PC.cursor;
        ctx.fillStyle = PC.cursor;
        ctx.lineWidth = P.cursor.w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(finger.x, finger.y);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(a.x, a.y, P.cursor.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(finger.x, finger.y, P.cursor.dot_r, 0, Math.PI * 2);
        ctx.fill();
      }

      drawHud(ctx);
      drawButtons(ctx);
    },

    pointer(type, x, y) {
      if (type === "down") {
        const b = buttonAt(x, y);
        if (b) {
          pressed = b;
          return;
        }
        finger = { x, y };
        downAt = performance.now();
        const a = aim(x, y);
        startedAtDown = sim.beginStroke(a.x, a.y);
      } else if (type === "move") {
        if (pressed) return;
        finger = { x, y };
        const a = aim(x, y);
        if (sim.stroke) {
          sim.moveStroke(a.x, a.y);
        } else if (cursorOffset) {
          // avec le curseur décalé, on peut aussi démarrer en glissant le curseur sur un bâtiment
          sim.beginStroke(a.x, a.y, true);
        }
      } else {
        if (pressed) {
          const b = pressed;
          pressed = null;
          if (type === "up" && inRect(b, x, y)) {
            if (b.id === "back") {
              game.goto("title");
            } else {
              cursorOffset = !cursorOffset;
              setSetting("cursor_offset", cursorOffset);
            }
          }
          return;
        }
        const quick = type === "up" && startedAtDown && performance.now() - downAt < cfg.input.tap_max_ms;
        sim.endStroke(quick);
        finger = null;
        startedAtDown = false;
      }
    },
  };
}
