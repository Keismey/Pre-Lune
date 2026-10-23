// Écran titre minimal : ciel du soir, hameau en formes simples, quelques créatures
// qui circulent (rendu interpolé), version, sélecteur FR/EN, toucher pour continuer.

import { createRng } from "../rng.js";
import { t, getLang } from "../i18n.js";
import { drawText, roundRectPath } from "../draw.js";

export function createTitleScreen(game) {
  const { cfg, display } = game;
  const ui = cfg.ui;
  const S = ui.sizes;
  const C = ui.colors;
  const T = ui.title;
  const O = T.orbit;

  // Décor tiré avec la graine du titre (flux dédié, indépendant de la partie).
  const rng = createRng(T.seed);
  const houses = [];
  for (let i = 0; i < 6; i++) {
    houses.push({
      x: 140 + i * 160 + rng.range(-30, 30),
      y: T.ground_y + 90 + rng.range(0, 60),
      w: rng.range(90, 130),
      h: rng.range(70, 100),
      color: rng.pick(O.dots),
    });
  }
  const stars = [];
  for (let i = 0; i < 28; i++) {
    stars.push({ x: rng.range(0, cfg.world.width), y: rng.range(0, 520), r: rng.range(2, 5) });
  }

  // Créatures : angle précédent et courant, interpolés au rendu.
  const walkers = O.dots.map((color, i) => {
    const a = (i / O.dots.length) * Math.PI * 2;
    return { color, prev: a, cur: a };
  });

  // Boutons FR / EN, côte à côte au bas de l'écran.
  const langs = ["fr", "en"];
  const totalW = langs.length * S.button_w + (langs.length - 1) * S.button_gap;
  const buttons = langs.map((code, i) => ({
    code,
    x: (cfg.world.width - totalW) / 2 + i * (S.button_w + S.button_gap),
    y: T.buttons_y - S.button_h / 2,
    w: S.button_w,
    h: S.button_h,
  }));

  let pressed = null; // bouton langue enfoncé, ou "screen"
  let clock = 0;

  function hit(b, x, y) {
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }
  function buttonAt(x, y) {
    return buttons.find((b) => hit(b, x, y)) || null;
  }

  function orbitPoint(a) {
    return { x: O.cx + Math.cos(a) * O.rx, y: O.cy + Math.sin(a) * O.ry };
  }

  return {
    update(dt) {
      clock += dt;
      for (const w of walkers) {
        w.prev = w.cur;
        w.cur += O.speed * dt;
      }
    },

    render(ctx, alpha) {
      const W = cfg.world.width;
      const H = cfg.world.height;

      // ciel
      const sky = ctx.createLinearGradient(0, 0, 0, T.ground_y);
      sky.addColorStop(0, T.sky[0]);
      sky.addColorStop(0.55, T.sky[1]);
      sky.addColorStop(1, T.sky[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, T.ground_y + 2);

      ctx.fillStyle = "#fff8e7";
      for (const s of stars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // lune
      ctx.fillStyle = T.moon.color;
      ctx.beginPath();
      ctx.arc(T.moon.x, T.moon.y, T.moon.r, 0, Math.PI * 2);
      ctx.fill();

      // terrain
      ctx.fillStyle = T.ground;
      ctx.fillRect(0, T.ground_y, W, H - T.ground_y);

      // chaumières en formes simples
      for (const h of houses) {
        ctx.fillStyle = h.color;
        ctx.fillRect(h.x - h.w / 2, h.y - h.h, h.w, h.h);
        ctx.fillStyle = C.bar;
        ctx.beginPath();
        ctx.moveTo(h.x - h.w / 2 - 10, h.y - h.h);
        ctx.lineTo(h.x, h.y - h.h - 55);
        ctx.lineTo(h.x + h.w / 2 + 10, h.y - h.h);
        ctx.closePath();
        ctx.fill();
      }

      // chemin en boucle
      ctx.strokeStyle = O.path_color;
      ctx.lineWidth = O.path_width;
      ctx.beginPath();
      ctx.ellipse(O.cx, O.cy, O.rx, O.ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // créatures, position interpolée entre deux pas de simulation
      for (const w of walkers) {
        const a = w.prev + (w.cur - w.prev) * alpha;
        const p = orbitPoint(a);
        ctx.fillStyle = w.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, O.dot_r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.text;
        ctx.beginPath();
        ctx.arc(p.x + 8, p.y - 8, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // titre
      drawText(ctx, t("game.title"), W / 2, T.title_y, {
        font: ui.font,
        size: S.title_font,
        color: C.text,
        weight: 800,
        shadow: { color: C.text_shadow, dy: S.shadow_dy },
        maxWidth: W - 120,
      });
      drawText(ctx, t("title.tagline"), W / 2, T.tagline_y, {
        font: ui.font,
        size: S.tagline_font,
        color: C.text,
        weight: 600,
        shadow: { color: C.text_shadow, dy: S.shadow_dy / 2 },
        maxWidth: T.tagline_max_w,
      });

      // toucher pour continuer (pulse lente)
      const pulse = 0.65 + 0.35 * Math.sin(clock * Math.PI * 2 * T.tap_pulse_hz);
      drawText(ctx, t("title.tap"), W / 2, T.tap_y, {
        font: ui.font,
        size: S.tap_font,
        color: C.text_dark,
        weight: 700,
        alpha: pulse,
        maxWidth: W - 160,
      });

      // sélecteur de langue
      for (const b of buttons) {
        const selected = getLang() === b.code;
        const down = pressed === b;
        ctx.fillStyle = C.text_shadow;
        roundRectPath(ctx, b.x, b.y + S.shadow_dy, b.w, b.h, S.button_radius);
        ctx.fill();
        ctx.fillStyle = selected ? C.button_selected : C.button;
        roundRectPath(ctx, b.x, b.y + (down ? S.shadow_dy / 2 : 0), b.w, b.h, S.button_radius);
        ctx.fill();
        drawText(ctx, t(`lang.${b.code}`), b.x + b.w / 2, b.y + b.h / 2 + (down ? S.shadow_dy / 2 : 0), {
          font: ui.font,
          size: S.button_font,
          color: selected ? C.text_dark : C.text,
          weight: 800,
        });
      }

      // version
      drawText(ctx, t("title.version", { v: cfg.game.version }), W / 2, T.version_y, {
        font: ui.font,
        size: S.version_font,
        color: C.text,
        weight: 500,
        alpha: 0.75,
      });
    },

    pointer(type, x, y) {
      if (type === "down") {
        pressed = buttonAt(x, y) || "screen";
      } else if (type === "up") {
        const target = pressed;
        pressed = null;
        if (target === "screen") {
          game.goto("play");
        } else if (target && hit(target, x, y)) {
          game.setLanguage(target.code);
        }
      } else if (type === "cancel") {
        pressed = null;
      }
    },
  };
}
