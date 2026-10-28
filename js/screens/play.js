// Écran de partie (V1) : chemins libres au doigt, chantiers et bâtiments qui apparaissent, créatures qui livrent, files
// d'attente (anneau de 10 pastilles), brume de panique, journées de 40 s avec leur anneau d'horloge, effacement d'un tap,
// et le confort : aide au tracé (demi-vitesse), Annuler pendant 4 s, pause, appui long (partenaire de même couleur),
// sauvegarde à chaque fin de journée avec reprise, tutoriel et écran de fin de partie.
// Formes simples en attendant les images.

import { t, tn } from "../i18n.js";
import { getSettings, setSetting, getGame, setGame, clearGame, getTuto, setTuto, recordGame } from "../save.js";
import { createSim } from "../sim.js";
import { createRng } from "../rng.js";
import { drawText, roundRectPath, wrapLines } from "../draw.js";
import { drawSprite, drawSymbol, makeGrassPattern, makePathPattern } from "../assets.js";

export function createPlayScreen(game) {
  const { cfg, layout, assets } = game;
  const ui = cfg.ui;
  const S = ui.sizes;
  const C = ui.colors;
  const P = ui.play;
  const PC = P.colors;
  const H = P.hud;
  const CRT = P.creature;
  const SP = P.sprites;
  const CF = cfg.comfort;
  const TU = cfg.tutorial;
  const M = P.menu;
  const E = P.end;
  const W = layout.width;
  const hz = cfg.loop.sim_hz;
  const unit = cfg.buildings.size * layout.cell; // côté d'un bâtiment

  let sim = null;
  let mode = "play"; // play | paused | resume (partie sauvegardée : continuer ou non) | end
  let cursorOffset = false;
  let assist = true;
  let finger = null; // doigt posé (monde)
  let downAt = 0;
  let startedAtDown = false;
  let pressed = null;
  let mistK = 0; // intensité de la brume affichée (0 à 1), lissée
  let assistK = 0; // intensité du voile d'aide au tracé (0 à 1), lissée
  let slowCount = 0;
  let peek = null; // bâtiment dont l'appui long montre les partenaires
  let lastDay = 1;
  let endInfo = null; // { best, newRecord } une fois la partie finie
  let tuto = { draw: false, erase: false, mist: false };
  let bubble = null; // bulle du tutoriel : { key, until (pas de simulation), warn, eraseBase }

  // ---------- Boutons ----------

  const bar = layout.bottomBar;
  const by = bar.y + (bar.h - S.button_h) / 2;
  const buttons = {
    pause: { id: "pause", x: 0, y: 0, w: P.pause.w, h: P.pause.h },
    undo: { id: "undo", x: S.bar_margin, y: by, w: P.undo.w, h: S.button_h },
  };

  const column = (ids, y0, h) => ids.map((id, i) => ({ id, x: (W - M.btn_w) / 2, y: y0 + i * (h + M.btn_gap), w: M.btn_w, h }));
  const endX0 = (W - (2 * E.btn_w + E.btn_gap)) / 2;
  const menus = {
    paused: [
      ...column(["resume", "restart", "quit"], M.first_y, M.btn_h),
      ...column(["assist", "offset"], M.first_y + 3 * (M.btn_h + M.btn_gap) + M.section_gap, M.toggle_h),
    ],
    resume: column(["continue", "newgame"], M.first_y, M.btn_h),
    end: [
      { id: "replay", x: endX0, y: E.btn_y, w: E.btn_w, h: E.btn_h },
      { id: "back", x: endX0 + E.btn_w + E.btn_gap, y: E.btn_y, w: E.btn_w, h: E.btn_h },
    ],
  };

  const inRect = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const activeButtons = () => (mode === "play" ? Object.values(buttons) : menus[mode] || []);
  const buttonAt = (x, y) => activeButtons().find((b) => inRect(b, x, y)) || null;
  const dn = (b) => (pressed === b ? S.shadow_dy / 2 : 0);

  // Point utilisé pour tracer : le doigt, ou le curseur décalé au-dessus du doigt.
  const aim = (x, y) => (cursorOffset ? { x, y: y - cfg.input.cursor_offset_px } : { x, y });

  const qlen = (b) => (b.kind === "house" ? b.queue : b.queue.length);
  const partnersOf = (b) => sim.buildings.filter((o) => o.color === b.color && o.kind !== b.kind);

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

  // Textures d'herbe et de chemin (images) : créées au premier dessin, avec repli sur l'herbe dessinée et les dalles unies.
  let grassPat = null;
  let pathPat = null;
  let patternsReady = false;
  function ensurePatterns(ctx) {
    if (patternsReady) return;
    patternsReady = true;
    grassPat = makeGrassPattern(ctx, assets, SP.grass_tile_px, SP.grass_mirror);
    pathPat = makePathPattern(ctx, assets, SP.path_tile_px);
  }

  function drawGrass(ctx) {
    ensurePatterns(ctx);
    if (!grassPat) {
      ctx.drawImage(grass, layout.gridX, layout.gridY);
      return;
    }
    ctx.save();
    ctx.translate(layout.gridX, layout.gridY);
    ctx.fillStyle = grassPat;
    ctx.fillRect(0, 0, layout.gridW, layout.gridH);
    ctx.restore();
  }

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
    ctx.strokeStyle = pathPat || PC.tile;
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
      ctx.strokeStyle = pathPat || PC.tile;
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

  // Bâtiment en image (chaumière ou atelier) avec son symbole de couleur sur le toit. Faux si l'image manque.
  function drawBuildingSprite(ctx, b) {
    if (!assets) return false;
    const key = `${b.kind === "house" ? "house" : "work"}.${b.color}`;
    const spr = assets.spec.sprites[key];
    if (!spr) return false;
    const k = (unit * SP.building_w_units) / assets.spec.ref_house_w;
    const y = b.y + SP.building_dy;
    drawSprite(ctx, assets, key, b.x, y, k);
    const Y = SP.symbol;
    const [bx0, by0, bx1, by1] = spr.body;
    const work = b.kind !== "house";
    const roofY = work ? Y.work_roof_y[b.color] : Y.roof_y;
    const roofDx = work ? Y.work_roof_dx : Y.roof_dx;
    const sx = b.x + ((bx0 + bx1) / 2 - spr.ax + roofDx * (bx1 - bx0)) * k;
    const sy = y + (by0 + roofY * (by1 - by0) - spr.ay) * k;
    const pal = cfg.palette[b.color];
    drawSymbol(ctx, Y.shapes[b.color], sx, sy, (b.kind === "house" ? Y.house_r : Y.work_r) * unit, pal ? pal.light : Y.fill, pal ? pal.dark : C.text_dark, Y.outline_w);
    return true;
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

    const sprited = drawBuildingSprite(ctx, b);
    if (!sprited) {
      ctx.fillStyle = PC.shadow;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 0.42 * u, 0.46 * u, 0.12 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (sprited) {
      // l'image porte déjà son jardin et son ombre ; formes simples seulement en repli
    } else if (b.kind === "house") {
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

  // État d'animation des créatures (affichage seulement, la simulation n'en dépend pas) : cap lissé et phase de marche,
  // mis à jour à chaque pas de simulation puis interpolés au rendu.
  const walkers = new Map(); // id de créature -> { a0, a1 (cap, rad), ph0, ph1 (phase de marche, en foulées) }

  function updateWalkers() {
    const alive = new Set();
    for (const cr of sim.creatures) {
      alive.add(cr.id);
      const target = Math.atan2(cr.dy, cr.dx) + Math.PI / 2; // l'image a la tête vers le haut
      let w = walkers.get(cr.id);
      if (!w) {
        w = { a0: target, a1: target, ph0: 0, ph1: 0 };
        walkers.set(cr.id, w);
      }
      w.a0 = w.a1;
      w.ph0 = w.ph1;
      if (cr.dx || cr.dy) {
        const d = target - w.a1;
        w.a1 += Math.atan2(Math.sin(d), Math.cos(d)) * SP.turn_ease; // virage par le plus court côté
      }
      w.ph1 += Math.hypot(cr.x - cr.px, cr.y - cr.py) / SP.stride_px;
    }
    for (const id of walkers.keys()) if (!alive.has(id)) walkers.delete(id);
  }

  // Ombre douce : un dégradé radial (opaque au centre, transparent au bord) préparé une fois, étiré en ellipse sous la créature.
  let shadowImg = null;
  function softShadowImage() {
    if (shadowImg) return shadowImg;
    const n = 64;
    const cv = document.createElement("canvas");
    cv.width = cv.height = n;
    const g = cv.getContext("2d");
    const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    for (const [at, a] of SP.shadow.stops) grad.addColorStop(at, `rgba(${SP.shadow.color}, ${a})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, n, n);
    shadowImg = cv;
    return cv;
  }

  function drawSoftShadow(ctx, x, y, H) {
    const D = SP.shadow;
    const rx = D.rx * H;
    const ry = D.ry * H;
    ctx.save();
    ctx.globalAlpha = D.alpha;
    ctx.drawImage(softShadowImage(), x + D.dx * H - rx, y + D.dy * H - ry, 2 * rx, 2 * ry);
    ctx.restore();
  }

  // Créature en image : tournée selon son cap, léger balancement et rebond en marchant, symbole de couleur sur le dos.
  function drawCreatureSprite(ctx, cr, x, y, pop, alpha) {
    const key = `crea.${cr.color}`;
    const spr = assets && assets.spec.sprites[key];
    if (!spr) return false;
    const w = walkers.get(cr.id);
    const ang = w ? w.a0 + (w.a1 - w.a0) * alpha : Math.atan2(cr.dy, cr.dx) + Math.PI / 2;
    const ph = w ? w.ph0 + (w.ph1 - w.ph0) * alpha : 0;
    const wob = Math.sin(ph * Math.PI * 2) * ((SP.wobble_deg * Math.PI) / 180);
    const bob = 1 + SP.bob * Math.sin(ph * Math.PI * 4);
    const H = SP.creature_h * cr.size * pop;
    drawSoftShadow(ctx, x, y, H);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + wob);
    ctx.scale(bob, bob);
    drawSprite(ctx, assets, key, 0, 0, H / spr.h);
    const Y = SP.symbol;
    const pal = cfg.palette[cr.color];
    drawSymbol(ctx, Y.shapes[cr.color], 0, Y.creature_dy * H, Y.creature_r * H, pal ? pal.light : Y.fill, pal ? pal.dark : C.text_dark, Y.outline_w * 0.6);
    ctx.restore();
    return true;
  }

  function drawCreature(ctx, cr, alpha) {
    const pal = cfg.palette[cr.color];
    const x = cr.px + (cr.x - cr.px) * alpha;
    const y = cr.py + (cr.y - cr.py) * alpha;
    const pop = Math.min(1, cr.age / CRT.pop_in_s);
    if (drawCreatureSprite(ctx, cr, x, y, pop, alpha)) return;
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
    const ix = H.left_pad + H.icon / 2 + shake;
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
      drawText(ctx, t("fx.plus", { n: sim.gainFx.n }), H.left_pad + H.gain_dx, H.value_y - H.gain_rise * k, {
        font: ui.font,
        size: P.popup.font,
        color: PC.popup_tile,
        weight: 800,
        align: "left",
        alpha: 1 - k * k,
        shadow: { color: C.text_shadow, dy: S.shadow_dy / 2 },
      });
    }
    drawText(ctx, t("hud.tiles"), H.left_pad + shake, H.label_y, {
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

  // ---------- Appui long : le partenaire de même couleur s'illumine, avec un pointillé ----------

  function drawPeekLines(ctx, tickF) {
    if (!peek) return;
    const K = P.peek;
    const pal = cfg.palette[peek.color];
    ctx.save();
    ctx.lineCap = "round";
    ctx.setLineDash(K.dash);
    ctx.lineDashOffset = -(tickF / hz) * K.dash_speed;
    for (const o of partnersOf(peek)) {
      ctx.globalAlpha = K.outline_alpha;
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = K.line_w + K.outline_extra;
      ctx.beginPath();
      ctx.moveTo(peek.x, peek.y);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
      ctx.globalAlpha = K.line_alpha;
      ctx.strokeStyle = pal.light;
      ctx.lineWidth = K.line_w;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPeekRings(ctx, tickF) {
    if (!peek) return;
    const K = P.peek;
    const pal = cfg.palette[peek.color];
    const pulse = 1 + K.pulse_amp * Math.sin((tickF / hz) * Math.PI * 2 * K.pulse_hz);
    ctx.save();
    ctx.globalAlpha = K.ring_alpha;
    for (const b of [peek, ...partnersOf(peek)]) {
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = K.ring_w + K.outline_extra / 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, K.ring_r * unit * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = pal.light;
      ctx.lineWidth = K.ring_w;
      ctx.beginPath();
      ctx.arc(b.x, b.y, K.ring_r * unit * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- Aide au tracé : un voile bleuté et un cadre quand le temps passe à moitié vitesse ----------

  function drawAssist(ctx) {
    if (assistK < 0.01) return;
    const K = P.assist;
    const L = layout;
    ctx.save();
    ctx.globalAlpha = assistK;
    ctx.fillStyle = K.tint;
    ctx.fillRect(L.gridX, L.gridY, L.gridW, L.gridH);
    ctx.strokeStyle = K.edge;
    ctx.lineWidth = K.edge_w;
    ctx.strokeRect(L.gridX + K.edge_w / 2, L.gridY + K.edge_w / 2, L.gridW - K.edge_w, L.gridH - K.edge_w);
    ctx.restore();
  }

  // ---------- Tutoriel : une flèche animée pour le premier tracé, puis des bulles ----------

  // La bulle se met en haut de la carte, ou en bas si un bâtiment se trouve à cet endroit.
  function bubbleCenterY(h) {
    const K = P.tuto;
    const hit = (cy) => sim.buildings.concat(sim.sites).some((b) => Math.abs(b.y - cy) < h / 2 + unit / 2 + K.clear);
    return hit(K.y) && !hit(K.y_bottom) ? K.y_bottom : K.y;
  }

  function drawBubble(ctx, text, warn) {
    const K = P.tuto;
    ctx.save();
    ctx.font = `700 ${K.font}px ${ui.font}`;
    const lines = wrapLines(ctx, text, K.w - 2 * K.pad);
    ctx.restore();
    const h = lines.length * K.font * K.line_h + 2 * K.pad;
    const cy = bubbleCenterY(h);
    const x = (W - K.w) / 2;
    const y = cy - h / 2;
    ctx.save();
    ctx.fillStyle = K.bg;
    roundRectPath(ctx, x, y, K.w, h, K.radius);
    ctx.fill();
    ctx.strokeStyle = warn ? K.warn_border : K.border;
    ctx.lineWidth = K.border_w;
    ctx.stroke();
    ctx.restore();
    drawText(ctx, text, W / 2, cy, { font: ui.font, size: K.font, color: C.text, weight: 700, maxWidth: K.w - 2 * K.pad, lineHeight: K.line_h });
  }

  // Un « doigt » qui glisse de la première chaumière non reliée jusqu'à son atelier, en boucle.
  function drawFingerHint(ctx, tickF) {
    const K = P.tuto;
    const house = sim.buildings.find((b) => b.kind === "house" && !sim.isConnected(b));
    if (!house) return;
    let ws = null;
    let bestD = Infinity;
    for (const o of partnersOf(house)) {
      const d = Math.hypot(o.x - house.x, o.y - house.y);
      if (d < bestD) {
        bestD = d;
        ws = o;
      }
    }
    if (!ws) return;
    const phase = ((tickF / hz) % K.cycle_s) / K.cycle_s;
    const k = Math.min(1, Math.max(0, (phase - 0.15) / 0.7));
    const e = k * k * (3 - 2 * k);
    const alpha = Math.min(1, phase / 0.1, (1 - phase) / 0.1);
    const x = house.x + (ws.x - house.x) * e;
    const y = house.y + (ws.y - house.y) * e;
    ctx.save();
    ctx.lineCap = "round";
    ctx.setLineDash(K.dash);
    ctx.strokeStyle = C.text;
    ctx.lineWidth = K.line_w;
    ctx.globalAlpha = K.line_alpha;
    ctx.beginPath();
    ctx.moveTo(house.x, house.y);
    ctx.lineTo(ws.x, ws.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = K.finger_fill;
    ctx.strokeStyle = K.finger_stroke;
    ctx.lineWidth = CRT.outline;
    ctx.beginPath();
    ctx.arc(x, y, K.finger_r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawTutorial(ctx, tickF) {
    if (mode !== "play") return;
    if (bubble && sim.tick < bubble.until) {
      drawBubble(ctx, t(bubble.key), bubble.warn);
      return;
    }
    if (!tuto.draw && sim.day <= TU.days) {
      if (!sim.stroke) drawFingerHint(ctx, tickF);
      drawBubble(ctx, t("tuto.draw"), false);
    }
  }

  function updateTutorial() {
    if (bubble && sim.tick >= bubble.until) bubble = null;
    // la brume : la première fois qu'une file dépasse le seuil de relâche
    if (!tuto.mist && sim.buildings.some((b) => qlen(b) > cfg.panic.release_at)) {
      tuto.mist = true;
      setTuto("mist");
      bubble = { key: "tuto.mist", until: sim.tick + Math.round(TU.mist_bubble_s * hz), warn: true };
    }
    // le tracé : jusqu'à ce qu'une chaumière soit reliée à son atelier (les 3 premières journées seulement)
    if (!tuto.draw) {
      const house = sim.buildings.find((b) => b.kind === "house");
      if (sim.day > TU.days || (house && sim.isConnected(house))) {
        const connected = sim.day <= TU.days;
        tuto.draw = true;
        setTuto("draw");
        if (connected && !tuto.erase) {
          tuto.erase = true;
          setTuto("erase");
          if (!bubble) bubble = { key: "tuto.erase", until: sim.tick + Math.round(TU.bubble_s * hz), warn: false, eraseBase: sim.eraseCount };
        }
      }
    }
    // un effacement réussi ferme la bulle de l'effacement
    if (bubble && bubble.key === "tuto.erase" && sim.eraseCount > bubble.eraseBase) bubble = null;
  }

  // ---------- Boutons dessinés ----------

  function drawPill(ctx, b, label, o = {}) {
    const { fill = C.button, color = C.text, font = M.btn_font } = o;
    ctx.fillStyle = C.text_shadow;
    roundRectPath(ctx, b.x, b.y + S.shadow_dy, b.w, b.h, S.button_radius);
    ctx.fill();
    ctx.fillStyle = fill;
    roundRectPath(ctx, b.x, b.y + dn(b), b.w, b.h, S.button_radius);
    ctx.fill();
    drawText(ctx, label, b.x + b.w / 2, b.y + b.h / 2 + dn(b), { font: ui.font, size: font, color, weight: 800, maxWidth: b.w - 40 });
  }

  function drawPauseButton(ctx) {
    const b = buttons.pause;
    const K = P.pause;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 + dn(b);
    ctx.fillStyle = C.button;
    roundRectPath(ctx, cx - K.size / 2, cy - K.size / 2, K.size, K.size, K.radius);
    ctx.fill();
    ctx.fillStyle = C.text;
    const x0 = cx - K.bar_gap / 2 - K.bar_w;
    const x1 = cx + K.bar_gap / 2;
    roundRectPath(ctx, x0, cy - K.bar_h / 2, K.bar_w, K.bar_h, K.bar_w / 2);
    ctx.fill();
    roundRectPath(ctx, x1, cy - K.bar_h / 2, K.bar_w, K.bar_h, K.bar_w / 2);
    ctx.fill();
  }

  // Annuler : jaune tant que la dernière action peut être défaite, avec une barre qui se vide pendant 4 s.
  function drawUndoButton(ctx) {
    const b = buttons.undo;
    const U = P.undo;
    const u = sim.undoState;
    const on = !!u && !sim.stroke && !sim.over;
    ctx.save();
    if (!on) ctx.globalAlpha = U.disabled_alpha;
    ctx.fillStyle = on ? C.button_selected : C.button;
    roundRectPath(ctx, b.x, b.y + dn(b), b.w, b.h, S.button_radius);
    ctx.fill();
    drawText(ctx, t("undo.label"), b.x + b.w / 2, b.y + b.h / 2 - 8 + dn(b), {
      font: ui.font,
      size: U.font,
      color: on ? C.text_dark : C.text,
      weight: 800,
      maxWidth: b.w - 40,
    });
    if (on) {
      const frac = Math.max(0, u.left / u.total);
      ctx.fillStyle = C.text_dark;
      ctx.globalAlpha = 0.7;
      roundRectPath(ctx, b.x + U.bar_inset, b.y + b.h - U.bar_gap - U.bar_h + dn(b), (b.w - 2 * U.bar_inset) * frac, U.bar_h, U.bar_h / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawButtons(ctx) {
    drawPauseButton(ctx);
    drawUndoButton(ctx);
  }

  // ---------- Écrans par-dessus la partie : pause, reprise, fin ----------

  function drawVeil(ctx) {
    ctx.fillStyle = M.veil;
    ctx.fillRect(0, 0, W, layout.height);
  }

  const titleStyle = (size) => ({ font: ui.font, size, color: C.text, weight: 800, maxWidth: E.title_max_w, shadow: { color: C.text_shadow, dy: S.shadow_dy } });

  function drawPauseMenu(ctx) {
    drawVeil(ctx);
    drawText(ctx, t("pause.title"), W / 2, M.title_y, titleStyle(M.title_font));
    for (const b of menus.paused) {
      if (b.id === "assist" || b.id === "offset") {
        const on = b.id === "assist" ? assist : cursorOffset;
        drawPill(ctx, b, t(b.id === "assist" ? (on ? "opt.assist_on" : "opt.assist_off") : on ? "opt.offset_on" : "opt.offset_off"), {
          fill: on ? C.button_selected : C.button,
          color: on ? C.text_dark : C.text,
          font: M.toggle_font,
        });
      } else {
        const primary = b.id === "resume";
        drawPill(ctx, b, t(`pause.${b.id}`), { fill: primary ? C.button_selected : C.button, color: primary ? C.text_dark : C.text });
      }
    }
  }

  function drawResumeMenu(ctx) {
    drawVeil(ctx);
    drawText(ctx, t("resume.title"), W / 2, M.title_y, titleStyle(M.title_font));
    drawText(ctx, tn("resume.sub", sim.deliveries, { day: sim.day }), W / 2, M.sub_y, { font: ui.font, size: M.sub_font, color: C.text, weight: 700, maxWidth: E.title_max_w });
    for (const b of menus.resume) {
      const primary = b.id === "continue";
      drawPill(ctx, b, t(primary ? "resume.continue" : "resume.new"), { fill: primary ? C.button_selected : C.button, color: primary ? C.text_dark : C.text });
    }
  }

  // Fin de partie : voile, titre, carte avec les livraisons en gros, les journées tenues et le record, deux boutons.
  function drawEnd(ctx) {
    drawVeil(ctx);
    drawText(ctx, t("end.title"), W / 2, E.title_y, titleStyle(E.title_font));
    ctx.fillStyle = E.card_bg;
    roundRectPath(ctx, E.card_x, E.card_y, E.card_w, E.card_h, E.card_radius);
    ctx.fill();
    const cx = E.card_x + E.card_w / 2;
    const T0 = E.card_y;
    drawText(ctx, String(sim.deliveries), cx, T0 + E.big_dy, { font: ui.font, size: E.big_font, color: C.text, weight: 800, shadow: { color: C.text_shadow, dy: S.shadow_dy } });
    drawText(ctx, tn("end.deliveries_label", sim.deliveries), cx, T0 + E.label_dy, { font: ui.font, size: E.label_font, color: C.text, weight: 700, alpha: 0.85 });
    drawText(ctx, tn("end.days", sim.daysHeld), cx, T0 + E.days_dy, { font: ui.font, size: E.days_font, color: C.text, weight: 800, maxWidth: E.card_w - 80 });
    if (endInfo && endInfo.newRecord) {
      const label = t("end.new_record");
      ctx.save();
      ctx.font = `800 ${E.badge_font}px ${ui.font}`;
      const bw = ctx.measureText(label).width + 2 * E.badge_pad;
      ctx.restore();
      ctx.fillStyle = E.badge_color;
      roundRectPath(ctx, cx - bw / 2, T0 + E.badge_dy - E.badge_h / 2, bw, E.badge_h, E.badge_h / 2);
      ctx.fill();
      drawText(ctx, label, cx, T0 + E.badge_dy, { font: ui.font, size: E.badge_font, color: E.badge_text, weight: 800 });
    } else if (endInfo) {
      drawText(ctx, t("end.record", { n: endInfo.best }), cx, T0 + E.record_dy, { font: ui.font, size: E.record_font, color: C.text, weight: 700, alpha: 0.8 });
    }
    for (const b of menus.end) {
      const primary = b.id === "replay";
      drawPill(ctx, b, t(primary ? "end.replay" : "end.back"), { fill: primary ? C.button_selected : C.button, color: primary ? C.text_dark : C.text, font: E.btn_font });
    }
  }

  // ---------- Partie : début, pause, sauvegarde, fin ----------

  function resetRuntime() {
    mistK = 0;
    assistK = 0;
    slowCount = 0;
    finger = null;
    pressed = null;
    startedAtDown = false;
    peek = null;
    lastDay = sim.day;
    endInfo = null;
    bubble = null;
    tuto = { ...getTuto() };
    roadCache = { version: -1, chains: [] };
    walkers.clear();
  }

  function newGame() {
    sim = createSim(cfg, layout, Date.now() >>> 0); // la graine vient de l'horloge ; tout le reste est déterministe
    resetRuntime();
    mode = "play";
  }

  // Le plan de la partie en cours est gardé à chaque fin de journée, à la pause et en quittant. Les créatures en route
  // retournent dans la file de leur chaumière à la reprise.
  function saveNow() {
    if (!sim || sim.over || mode === "end" || mode === "resume") return;
    try {
      setGame(sim.serialize());
    } catch (err) {
      console.warn("[save] sauvegarde impossible", err);
    }
  }

  function pauseGame() {
    if (mode !== "play") return;
    if (sim.stroke) sim.endStroke(false);
    finger = null;
    peek = null;
    mode = "paused";
    saveNow();
  }

  function handleEnd() {
    mode = "end";
    peek = null;
    finger = null;
    clearGame();
    const prev = recordGame(sim.deliveries, sim.daysHeld);
    endInfo = { best: Math.max(prev.deliveries, sim.deliveries), newRecord: prev.deliveries > 0 && sim.deliveries > prev.deliveries };
  }

  function overlayAction(id) {
    switch (id) {
      case "resume":
        mode = "play";
        break;
      case "restart":
      case "newgame":
        clearGame();
        newGame();
        break;
      case "quit":
        saveNow();
        game.goto("title");
        break;
      case "assist":
        assist = !assist;
        setSetting("assist", assist);
        break;
      case "offset":
        cursorOffset = !cursorOffset;
        setSetting("cursor_offset", cursorOffset);
        break;
      case "continue":
        mode = "play";
        break;
      case "replay":
        newGame();
        break;
      case "back":
        game.goto("title");
        break;
      default:
    }
  }

  return {
    enter() {
      const st = getSettings();
      cursorOffset = !!st.cursor_offset;
      assist = st.assist !== false;
      const saved = getGame();
      if (saved) {
        try {
          sim = createSim(cfg, layout, saved.seed, saved);
          resetRuntime();
          mode = "resume";
          return;
        } catch (err) {
          console.warn("[save] partie illisible, ignorée", err);
          clearGame();
        }
      }
      newGame();
    },

    // Pour les tests dans le navigateur (?debug) : état interne de l'écran.
    debug: () => ({ sim, mode, tuto, bubble, peek, assistK, endInfo }),

    // Appelé quand l'appli passe en arrière-plan : pause automatique et sauvegarde.
    hidden() {
      pauseGame();
    },

    update() {
      let slow = false;
      if (mode === "play") {
        slow = assist && !!sim.stroke && !!finger;
        let doStep = true;
        if (slow) {
          slowCount = (slowCount + 1) % CF.assist_divisor; // aide au tracé : un pas sur deux, le temps passe à moitié vitesse
          doStep = slowCount === 0;
        } else {
          slowCount = 0;
        }
        if (doStep) {
          sim.step();
          updateWalkers();
          if (sim.over) handleEnd();
          else {
            if (sim.day !== lastDay) {
              lastDay = sim.day;
              saveNow(); // fin de journée : point de reprise
            }
            updateTutorial();
          }
        }
        const st = sim.stroke;
        if (finger && st && st.kind === "building" && !st.moved && !st.headId && performance.now() - downAt >= CF.long_press_ms) peek = st.building;
        else if (!finger || !st || st.moved || st.headId) peek = null;
      }
      assistK += ((slow ? 1 : 0) - assistK) * P.assist.ease;
      const target = sim.over ? 1 : sim.panic.active ? 1 - sim.panic.left / sim.panic.total : 0;
      mistK += (target - mistK) * P.mist.ease;
    },

    render(ctx, alpha) {
      const L = layout;
      const tickF = sim.tick + alpha;

      drawGrass(ctx);
      drawRoads(ctx, tickF);
      for (const s of sim.sites) drawSite(ctx, s, tickF);
      drawPeekLines(ctx, tickF);

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
        } else if (s.building && !peek) {
          ctx.save();
          ctx.globalAlpha = P.start_ring_alpha;
          ctx.beginPath();
          ctx.arc(s.building.x, s.building.y, cfg.buildings.start_radius_cells * L.cell, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Perspective : bâtiments et créatures sont dessinés du plus au nord au plus au sud. Une créature derrière un
      // bâtiment (ou à son côté, ou qui y entre) passe sous son toit et ses murs ; devant, elle marche sur le terrain.
      const order = [];
      for (const b of sim.buildings) order.push({ y: b.y + SP.depth_front * unit, b, cr: null });
      for (const cr of sim.creatures) order.push({ y: cr.py + (cr.y - cr.py) * alpha, b: null, cr });
      order.sort((p, q) => p.y - q.y);
      for (const o of order) {
        if (o.b) drawBuilding(ctx, o.b, tickF);
        else drawCreature(ctx, o.cr, alpha);
      }
      for (const b of sim.buildings) drawQueue(ctx, b);
      for (const b of sim.buildings) if (b.over) drawPanicRing(ctx, b);
      drawPeekRings(ctx, tickF);

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
      drawAssist(ctx);
      drawTutorial(ctx, tickF);
      drawHud(ctx, alpha);
      drawButtons(ctx);
      if (mode === "paused") drawPauseMenu(ctx);
      else if (mode === "resume") drawResumeMenu(ctx);
      else if (mode === "end") drawEnd(ctx);
    },

    pointer(type, x, y) {
      if (mode !== "play") {
        // pause, reprise, fin : seuls les boutons répondent
        if (type === "down") pressed = buttonAt(x, y);
        else if (type !== "move") {
          const b = pressed;
          pressed = null;
          if (type === "up" && b && inRect(b, x, y)) overlayAction(b.id);
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
        peek = null;
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
            if (b.id === "pause") pauseGame();
            else if (b.id === "undo") sim.undo();
          }
          return;
        }
        const quick = type === "up" && startedAtDown && performance.now() - downAt < cfg.input.tap_max_ms;
        sim.endStroke(quick);
        finger = null;
        peek = null;
        startedAtDown = false;
      }
    },
  };
}
