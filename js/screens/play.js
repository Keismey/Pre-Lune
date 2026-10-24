// Écran de partie (V1, parties 1 et 2) : chemins libres au doigt, chantiers et bâtiments qui apparaissent, créatures qui
// livrent, files d'attente (anneau de 10 pastilles), brume de panique et fin de partie, journée de 40 s avec son anneau
// d'horloge, effacement d'un tap, option de décalage du curseur.
// Formes simples en attendant les images.

import { t } from "../i18n.js";
import { getSettings, setSetting } from "../save.js";
import { createSim } from "../sim.js";
import { createRng } from "../rng.js";
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
  let mistK = 0; // intensité de la brume affichée (0 à 1), lissée

  const bar = layout.bottomBar;
  const by = bar.y + (bar.h - S.button_h) / 2;
  const buttons = {
    back: { id: "back", x: S.bar_margin, y: by, w: S.back_w, h: S.button_h },
    offset: { id: "offset", x: W - S.bar_margin - S.toggle_w, y: by, w: S.toggle_w, h: S.button_h },
  };

  const E = P.end;
  const endX0 = (W - (2 * E.btn_w + E.btn_gap)) / 2;
  const endButtons = {
    replay: { id: "replay", x: endX0, y: E.btn_y, w: E.btn_w, h: E.btn_h },
    back: { id: "back", x: endX0 + E.btn_w + E.btn_gap, y: E.btn_y, w: E.btn_w, h: E.btn_h },
  };

  const inRect = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const buttonAt = (x, y) => Object.values(sim && sim.over ? endButtons : buttons).find((b) => inRect(b, x, y)) || null;

  // Point utilisé pour tracer : le doigt, ou le curseur décalé au-dessus du doigt.
  const aim = (x, y) => (cursorOffset ? { x, y: y - cfg.input.cursor_offset_px } : { x, y });

  // ---------- Dessin ----------

  // Herbe : un aplat et quelques taches très douces (dégradés radiaux) tirées d'une graine fixe, dessinées une seule
  // fois dans une image. Pas de damier, pas de grille.
  const grass = (() => {
    const L = layout;
    const cv = document.createElement("canvas");
    cv.width = L.gridW;
    cv.height = L.gridH;
    const g = cv.getContext("2d");
    g.fillStyle = C.grass_a;
    g.fillRect(0, 0, cv.width, cv.height);
    const rng = createRng(P.grass.seed);
    for (let i = 0; i < P.grass.patches; i++) {
      const x = rng.next() * cv.width;
      const y = rng.next() * cv.height;
      const r = rng.range(P.grass.r_min, P.grass.r_max);
      const col = rng.next() < 0.5 ? P.grass.light : P.grass.dark;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, col);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = P.grass.alpha;
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    return cv;
  })();

  const drawGrass = (ctx) => ctx.drawImage(grass, layout.gridX, layout.gridY);

  // Les chemins sont découpés en chaînes (entre deux croisements, bouts ou portes), redessinées en courbes lissées.
  // Le découpage est mis en cache tant que le réseau ne change pas.
  let roadCache = { version: -1, chains: [] };

  function buildChains() {
    const nodes = sim.nodes;
    const edges = sim.edges;
    const used = new Set();
    const chains = [];
    const follow = (startId, first) => {
      const pts = [nodes.get(startId)];
      let prevEdge = first.edge;
      let cur = nodes.get(first.to);
      used.add(first.edge);
      pts.push(cur);
      while (cur.adj.length === 2 && !cur.door && cur.id !== startId) {
        const nxt = cur.adj.find((a) => a.edge !== prevEdge);
        if (!nxt || used.has(nxt.edge)) break;
        used.add(nxt.edge);
        prevEdge = nxt.edge;
        cur = nodes.get(nxt.to);
        pts.push(cur);
      }
      chains.push(pts.map((n) => ({ x: n.x, y: n.y })));
    };
    for (const n of nodes.values()) {
      if (n.adj.length === 2 && !n.door) continue;
      for (const a of n.adj) if (!used.has(a.edge)) follow(n.id, a);
    }
    for (const e of edges.values()) {
      if (!used.has(e.id)) follow(e.a, nodes.get(e.a).adj.find((a) => a.edge === e.id)); // boucle fermée
    }
    // petit tronçon entre chaque porte et le mur du bâtiment
    for (const n of nodes.values()) {
      if (!n.door) continue;
      const b = sim.buildings.find((x) => x.id === n.door);
      if (!b) continue;
      const half = unit / 2;
      const bx = Math.min(b.x + half, Math.max(b.x - half, n.x));
      const by = Math.min(b.y + half, Math.max(b.y - half, n.y));
      chains.push([{ x: n.x, y: n.y }, { x: bx, y: by }]);
    }
    roadCache = { version: sim.graphVersion, chains };
  }

  function chainPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  function drawRoads(ctx, tickF) {
    if (roadCache.version !== sim.graphVersion) buildChains();
    const W0 = cfg.roads.width_px;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = PC.grout;
    ctx.lineWidth = W0;
    for (const pts of roadCache.chains) {
      chainPath(ctx, pts);
      ctx.stroke();
    }
    ctx.strokeStyle = PC.tile;
    ctx.lineWidth = W0 - 2 * P.tile_inset;
    for (const pts of roadCache.chains) {
      chainPath(ctx, pts);
      ctx.stroke();
    }
    // les segments qui viennent d'être posés rebondissent (un renflement qui s'estompe)
    for (const e of sim.edges.values()) {
      const age = tickF - e.placedAt;
      if (age < 0 || age >= P.bounce_ticks) continue;
      const a = sim.nodes.get(e.a);
      const b = sim.nodes.get(e.b);
      const k = 1 + P.bounce_amp * Math.sin((Math.PI * age) / P.bounce_ticks);
      ctx.strokeStyle = PC.tile;
      ctx.lineWidth = (W0 - 2 * P.tile_inset) * k;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // Chantier : zone réservée en pointillés, panneau, poussière, anneau qui se remplit pendant les 4 s.
  function drawSite(ctx, s, tickF) {
    const pal = cfg.palette[s.color];
    const K = P.site;
    const u = unit;
    const prog = Math.min(1, Math.max(0, 1 - (s.left - (tickF - sim.tick)) / s.total));
    const x0 = s.x - u / 2;
    const y0 = s.y - u / 2;

    ctx.save();
    ctx.globalAlpha = K.fill_alpha;
    ctx.fillStyle = pal.main;
    roundRectPath(ctx, x0, y0, u, u, P.tile_radius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.setLineDash(K.dash);
    ctx.strokeStyle = PC.site_border;
    ctx.lineWidth = K.border_w;
    roundRectPath(ctx, x0, y0, u, u, P.tile_radius);
    ctx.stroke();
    ctx.restore();

    // panneau planté au milieu : un poteau et une planche de la couleur du bâtiment
    ctx.fillStyle = PC.site_post;
    ctx.fillRect(s.x - K.post_w / 2, s.y - u * 0.02, K.post_w, u * K.post_h);
    ctx.fillStyle = pal.main;
    ctx.strokeStyle = pal.dark;
    ctx.lineWidth = CRT.outline;
    roundRectPath(ctx, s.x - (u * K.board_w) / 2, s.y - u * 0.24, u * K.board_w, u * K.board_h, 8);
    ctx.fill();
    ctx.stroke();

    // poussière : quelques ronds qui tournent autour du chantier
    const time = (tickF / cfg.loop.sim_hz) / K.dust_period_s;
    ctx.fillStyle = PC.dust;
    for (let i = 0; i < K.dust_count; i++) {
      const a = (time + i / K.dust_count) * Math.PI * 2;
      const wob = Math.sin(a * 2);
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * u * 0.38, s.y + u * 0.26 + wob * K.dust_swing, K.dust_r * (0.75 + 0.25 * wob), 0, Math.PI * 2);
      ctx.fill();
    }

    // anneau de progression
    ctx.save();
    ctx.globalAlpha = K.ring_alpha;
    ctx.strokeStyle = pal.main;
    ctx.lineWidth = K.ring_w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(s.x, s.y, u * K.ring_r, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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

  // File d'attente : anneau de 10 pastilles autour du bâtiment, une pastille pleine par créature qui attend.
  function drawQueue(ctx, b) {
    const n = b.kind === "house" ? b.queue : b.queue.length;
    if (n <= 0) return;
    const Q = P.queue;
    const pal = cfg.palette[b.color];
    const slots = cfg.panic.queue_max;
    for (let i = 0; i < slots; i++) {
      const a = -Math.PI / 2 + (i / slots) * Math.PI * 2;
      const x = b.x + Math.cos(a) * Q.ring_r * unit;
      const y = b.y + Math.sin(a) * Q.ring_r * unit;
      ctx.beginPath();
      ctx.arc(x, y, Q.dot_r, 0, Math.PI * 2);
      if (i < n) {
        ctx.fillStyle = pal.main;
        ctx.strokeStyle = pal.dark;
        ctx.lineWidth = Q.outline;
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.save();
        ctx.globalAlpha = Q.empty_alpha;
        ctx.strokeStyle = C.text;
        ctx.lineWidth = Q.outline;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Anneau rouge qui se vide autour d'une file en débordement : le temps qu'il reste avant la brume.
  function drawPanicRing(ctx, b) {
    const K = P.panic;
    const frac = sim.panic.left / sim.panic.total;
    ctx.save();
    ctx.globalAlpha = K.ring_color_alpha;
    ctx.strokeStyle = PC.warn;
    ctx.lineWidth = K.ring_w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(b.x, b.y, K.ring_r * unit, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Brume violette qui monte sur les bords de la carte.
  function drawMist(ctx) {
    if (mistK <= 0.002) return;
    const L = layout;
    const cx = L.gridX + L.gridW / 2;
    const cy = L.gridY + L.gridH / 2;
    const rMax = Math.hypot(L.gridW, L.gridH) / 2;
    const M = P.mist;
    const rIn = rMax * (M.inner_start + (M.inner_end - M.inner_start) * mistK);
    const g = ctx.createRadialGradient(cx, cy, Math.min(rIn, rMax - 1), cx, cy, rMax);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, M.color);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.gridX, L.gridY, L.gridW, L.gridH);
    ctx.clip();
    ctx.globalAlpha = M.max_alpha * mistK;
    ctx.fillStyle = g;
    ctx.fillRect(L.gridX, L.gridY, L.gridW, L.gridH);
    ctx.restore();
  }

  // Fin de partie (provisoire : l'écran complet viendra à l'étape C5) : voile, titre, score, deux boutons.
  function drawEnd(ctx) {
    ctx.fillStyle = E.veil;
    ctx.fillRect(0, 0, W, layout.height);
    drawText(ctx, t("end.title"), W / 2, E.title_y, {
      font: ui.font, size: E.title_font, color: C.text, weight: 800, maxWidth: E.title_max_w,
      shadow: { color: C.text_shadow, dy: S.shadow_dy },
    });
    drawText(ctx, t("end.deliveries", { n: sim.deliveries }), W / 2, E.stats_y, { font: ui.font, size: E.line_font, color: C.text, weight: 700 });
    drawText(ctx, t("end.days", { n: sim.daysHeld }), W / 2, E.stats_y + E.line_gap, { font: ui.font, size: E.line_font, color: C.text, weight: 700 });
    const down = (b) => (pressed === b ? S.shadow_dy / 2 : 0);
    for (const b of Object.values(endButtons)) {
      const primary = b.id === "replay";
      ctx.fillStyle = primary ? C.button_selected : C.button;
      roundRectPath(ctx, b.x, b.y + down(b), b.w, b.h, S.button_radius);
      ctx.fill();
      drawText(ctx, t(primary ? "end.replay" : "end.back"), b.x + b.w / 2, b.y + b.h / 2 + down(b), {
        font: ui.font, size: E.btn_font, color: primary ? C.text_dark : C.text, weight: 800, maxWidth: b.w - 40,
      });
    }
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

  function drawHud(ctx, alpha) {
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
    drawText(ctx, String(Math.floor(sim.tiles + 1e-6)), ix + H.icon / 2 + H.gap, H.value_y, {
      font: ui.font,
      size: H.value_font,
      color: valueColor,
      weight: 800,
      align: "left",
    });
    // gain de fin de journée : « +18 » qui monte à côté du compteur
    if (sim.gainFx) {
      const k = sim.gainFx.age / cfg.tiles.gain_fx_s;
      drawText(ctx, t("fx.plus", { n: sim.gainFx.n }), H.pad + H.gain_dx, H.value_y - H.gain_rise * k, {
        font: ui.font,
        size: P.popup.font,
        color: PC.popup_tile,
        weight: 800,
        align: "left",
        alpha: 1 - k * k,
        shadow: { color: C.text_shadow, dy: S.shadow_dy / 2 },
      });
    }
    drawText(ctx, t("hud.tiles"), H.pad + shake, H.label_y, {
      font: ui.font,
      size: H.label_font,
      color: C.text,
      weight: 600,
      align: "left",
      alpha: 0.8,
    });

    // journée : anneau d'horloge au centre, le numéro dedans, « Journée » dessous
    const K = P.clock;
    const cx = W / 2;
    const frac = Math.min(1, (sim.dayTick + alpha) / sim.dayTicks);
    ctx.lineCap = "round";
    ctx.lineWidth = K.w;
    ctx.strokeStyle = PC.clock_track;
    ctx.beginPath();
    ctx.arc(cx, K.y, K.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PC.clock_fill;
    ctx.beginPath();
    ctx.arc(cx, K.y, K.r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    drawText(ctx, String(sim.day), cx, K.y, { font: ui.font, size: K.num_font, color: C.text, weight: 800 });
    drawText(ctx, t("hud.day"), cx, K.label_y, { font: ui.font, size: H.label_font, color: C.text, weight: 600, alpha: 0.8 });

    // livraisons : icône à droite, valeur à sa gauche
    const rx = W - H.pad - H.icon / 2;
    ctx.fillStyle = PC.hud_delivery_fill;
    ctx.strokeStyle = PC.hud_delivery_stroke;
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
      mistK = 0;
      finger = null;
      pressed = null;
      startedAtDown = false;
    },

    update() {
      sim.step();
      const target = sim.over ? 1 : sim.panic.active ? 1 - sim.panic.left / sim.panic.total : 0;
      mistK += (target - mistK) * P.mist.ease;
    },

    render(ctx, alpha) {
      const L = layout;
      const tickF = sim.tick + alpha;

      drawGrass(ctx);
      drawRoads(ctx, tickF);
      for (const s of sim.sites) drawSite(ctx, s, tickF);

      // tête du tracé : anneau sur son extrémité, ou autour du bâtiment de départ avant le premier mouvement
      const s = sim.stroke;
      if (s) {
        ctx.strokeStyle = PC.head;
        ctx.lineWidth = P.head_ring_w;
        const head = sim.headPos();
        if (head) {
          ctx.beginPath();
          ctx.arc(head.x, head.y, cfg.roads.width_px / 2 + P.head_ring_gap, 0, Math.PI * 2);
          ctx.stroke();
        } else if (s.building) {
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
      for (const b of sim.buildings) drawQueue(ctx, b);
      for (const b of sim.buildings) if (b.over) drawPanicRing(ctx, b);

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

      drawMist(ctx);
      drawHud(ctx, alpha);
      drawButtons(ctx);
      if (sim.over) drawEnd(ctx);
    },

    pointer(type, x, y) {
      if (sim.over) {
        // fin de partie : seuls les deux boutons répondent
        if (type === "down") pressed = buttonAt(x, y);
        else if (type !== "move") {
          const b = pressed;
          pressed = null;
          if (type === "up" && b && inRect(b, x, y)) game.goto(b.id === "replay" ? "play" : "title");
        }
        return;
      }
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
