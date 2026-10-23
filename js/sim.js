// Simulation de la partie (V0) : grille, bâtiments, tracé, effacement, créatures, livraisons.
// Logique pure, sans DOM. Tous les tirages passent par les flux à graine, jamais Math.random().
// Les gestes du joueur (beginStroke, moveStroke, endStroke) sont appliqués entre deux pas de simulation.

import { createStreams } from "./rng.js";

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // haut, droite, bas, gauche : ordre fixe, donc déterministe
const INF = 1e9;

export function createSim(cfg, layout, seed) {
  const { cols, rows, cell } = layout;
  const B = cfg.buildings;
  const CR = cfg.creatures;
  const TL = cfg.tiles;
  const popupLife = cfg.ui.play.popup.life_s;
  const dt = 1 / cfg.loop.sim_hz;
  const streams = createStreams(seed, cfg.rng.streams);
  const N = cols * rows;

  const idx = (c, r) => r * cols + c;
  const inGrid = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  const cellCenter = (c, r) => {
    const q = layout.cellRect(c, r);
    return { x: q.x + q.w / 2, y: q.y + q.h / 2 };
  };

  const path = new Uint8Array(N); // 1 = case de chemin
  const occ = new Int16Array(N); // identifiant du bâtiment qui occupe la case, 0 si libre
  const placedAt = new Int32Array(N).fill(-1); // pas de simulation de la pose (animation de rebond)

  const sim = {
    cols,
    rows,
    tick: 0,
    day: 1,
    tiles: TL.start,
    deliveries: 0,
    noTilesFlash: 0, // secondes restantes du clignotement « plus de dalles »
    path,
    occ,
    placedAt,
    buildings: [],
    creatures: [],
    popups: [],
    dist: {},
    stroke: null,
    nextId: 1,
  };

  let dirty = false; // le réseau a changé : champ de distance à recalculer

  // ---------- Bâtiments ----------

  const buildingById = (id) => sim.buildings.find((b) => b.id === id);

  function addBuilding(kind, color, c, r) {
    const q = layout.cellRect(c, r);
    const half = (B.size * cell) / 2;
    const b = {
      id: sim.nextId++,
      kind,
      color,
      c,
      r,
      x: q.x + half,
      y: q.y + half,
      timer: kind === "house" ? B.house.first_spawn_s : 0,
      bumpAt: -1000,
    };
    for (let dy = 0; dy < B.size; dy++) {
      for (let dx = 0; dx < B.size; dx++) occ[idx(c + dx, r + dy)] = b.id;
    }
    sim.buildings.push(b);
    return b;
  }

  // Cases collées à l'emprise du bâtiment (par un côté) : ses « portes ». Ordre fixe.
  function perimeter(b) {
    const out = [];
    for (let i = 0; i < B.size; i++) {
      out.push([b.c + i, b.r - 1], [b.c + i, b.r + B.size], [b.c - 1, b.r + i], [b.c + B.size, b.r + i]);
    }
    return out.filter(([c, r]) => inGrid(c, r));
  }

  const doorCount = (b) => perimeter(b).filter(([c, r]) => path[idx(c, r)]).length;

  // Une nouvelle case de chemin ne doit pas dépasser le maximum de chemins reliés d'un bâtiment.
  function doorOk(c, r) {
    for (const [dx, dy] of DIRS) {
      const nc = c + dx;
      const nr = r + dy;
      if (!inGrid(nc, nr)) continue;
      const id = occ[idx(nc, nr)];
      if (id && doorCount(buildingById(id)) >= B.max_doors) return false;
    }
    return true;
  }

  // Cases vides entre deux emprises (négatif si elles se chevauchent).
  const gap = (c, r, b) => Math.max(Math.abs(c - b.c) - B.size, Math.abs(r - b.r) - B.size);

  function freeSpots() {
    const out = [];
    for (let r = B.edge_margin; r <= rows - B.edge_margin - B.size; r++) {
      for (let c = B.edge_margin; c <= cols - B.edge_margin - B.size; c++) {
        if (sim.buildings.every((b) => gap(c, r, b) >= B.min_gap)) out.push({ c, r });
      }
    }
    return out;
  }

  // V0 : une chaumière et un atelier de chaque couleur de départ, présents dès le début.
  function placeStart() {
    const rng = streams.apparitions;
    for (const color of cfg.game.start_colors) {
      const free = freeSpots();
      const hs = free[rng.int(free.length)];
      addBuilding("house", color, hs.c, hs.r);
      let cand = freeSpots().filter((s) => {
        const d = Math.abs(s.c - hs.c) + Math.abs(s.r - hs.r);
        return d >= B.pair_min && d <= B.pair_max;
      });
      if (!cand.length) cand = freeSpots();
      const ws = cand[rng.int(cand.length)];
      addBuilding("workshop", color, ws.c, ws.r);
    }
  }

  // ---------- Réseau : champ de distance par couleur ----------

  function rebuildDist() {
    const colors = new Set(sim.buildings.map((b) => b.color));
    for (const color of colors) {
      const d = sim.dist[color] || (sim.dist[color] = new Int32Array(N));
      d.fill(INF);
      const queue = [];
      for (const b of sim.buildings) {
        if (b.kind !== "workshop" || b.color !== color) continue;
        for (const [c, r] of perimeter(b)) {
          const i = idx(c, r);
          if (path[i] && d[i] === INF) {
            d[i] = 0;
            queue.push(i);
          }
        }
      }
      for (let h = 0; h < queue.length; h++) {
        const i = queue[h];
        const c = i % cols;
        const r = (i / cols) | 0;
        for (const [dx, dy] of DIRS) {
          const nc = c + dx;
          const nr = r + dy;
          if (!inGrid(nc, nr)) continue;
          const ni = idx(nc, nr);
          if (path[ni] && d[ni] === INF) {
            d[ni] = d[i] + 1;
            queue.push(ni);
          }
        }
      }
    }
    dirty = false;
  }

  function flush() {
    if (dirty) rebuildDist();
  }

  function degree(c, r) {
    let n = 0;
    for (const [dx, dy] of DIRS) {
      const nc = c + dx;
      const nr = r + dy;
      if (inGrid(nc, nr) && path[idx(nc, nr)]) n++;
    }
    return n;
  }

  function removeCells(list) {
    const gone = new Set();
    for (const { c, r } of list) {
      const i = idx(c, r);
      path[i] = 0;
      placedAt[i] = -1;
      gone.add(i);
    }
    // une créature sur une case disparue (ou en route vers elle) s'évanouit
    for (const cr of sim.creatures) {
      if (cr.stage === "enter") continue;
      const lost =
        (cr.cell && gone.has(idx(cr.cell.c, cr.cell.r))) || (cr.next && gone.has(idx(cr.next.c, cr.next.r)));
      if (lost) cr.done = true;
    }
    sim.creatures = sim.creatures.filter((cr) => !cr.done);
    dirty = true;
  }

  function addPopup(kind, x, y, n) {
    sim.popups.push({ kind, x, y, n, age: 0 });
  }

  // ---------- Tracé ----------

  function nearestFirst(cells, tc, tr) {
    return cells
      .map(([c, r], i) => ({ c, r, i, d: Math.abs(c - tc) + Math.abs(r - tr) }))
      .sort((a, b) => a.d - b.d || a.i - b.i);
  }

  // Avance la tête du tracé d'une case vers (nc, nr). Renvoie true si elle a bougé.
  function stepInto(s, nc, nr) {
    if (!inGrid(nc, nr)) return false;
    const i = idx(nc, nr);
    if (occ[i]) return false;
    if (s.stack.some((e) => e.c === nc && e.r === nr)) return false;
    if (path[i]) {
      s.stack.push({ c: nc, r: nr, isNew: false }); // retracer une case existante ne coûte rien
      return true;
    }
    if (sim.tiles < TL.cost_per_cell) {
      sim.noTilesFlash = TL.flash_s;
      return false;
    }
    if (!doorOk(nc, nr)) return false;
    path[i] = 1;
    placedAt[i] = sim.tick;
    sim.tiles -= TL.cost_per_cell;
    s.stack.push({ c: nc, r: nr, isNew: true });
    dirty = true;
    return true;
  }

  // Retour en arrière : défait le tracé jusqu'à la case n° keep de la pile (-1 = retour au bâtiment).
  function popTo(s, keep) {
    const gone = [];
    while (s.stack.length - 1 > keep) {
      const e = s.stack.pop();
      if (e.isNew) {
        gone.push(e);
        sim.tiles += TL.cost_per_cell;
      }
    }
    if (gone.length) removeCells(gone);
  }

  function extend(s, tc, tr) {
    const ti = idx(tc, tr);

    // la cible est le bâtiment de départ : on défait tout
    if (s.building && occ[ti] === s.building.id) {
      if (s.stack.length) popTo(s, -1);
      return;
    }
    // la cible est une case déjà tracée dans ce geste : on revient dessus
    const at = s.stack.findIndex((e) => e.c === tc && e.r === tr);
    if (at >= 0) {
      if (at < s.stack.length - 1) popTo(s, at);
      return;
    }

    // la cible est dans un autre bâtiment : on vise la case de son pourtour la plus proche de la tête
    let gc = tc;
    let gr = tr;
    if (occ[ti]) {
      const other = buildingById(occ[ti]);
      const last = s.stack.length ? s.stack[s.stack.length - 1] : { c: s.building.c, r: s.building.r };
      const door = nearestFirst(perimeter(other).filter(([c, r]) => !occ[idx(c, r)]), last.c, last.r)[0];
      if (!door) return;
      gc = door.c;
      gr = door.r;
      if (s.stack.some((e) => e.c === gc && e.r === gr)) return;
    }

    for (let guard = cols + rows + 4; guard > 0; guard--) {
      if (!s.stack.length) {
        // départ d'un bâtiment : première case sur son pourtour, la plus proche de la cible
        const entries = nearestFirst(
          perimeter(s.building).filter(([c, r]) => !occ[idx(c, r)]),
          gc,
          gr
        );
        let entered = false;
        for (const e of entries) {
          if (stepInto(s, e.c, e.r)) {
            entered = true;
            break;
          }
        }
        if (!entered) break;
        continue;
      }
      const cur = s.stack[s.stack.length - 1];
      if (cur.c === gc && cur.r === gr) break;
      const dx = gc - cur.c;
      const dy = gr - cur.r;
      // pas de diagonale : un pas à la fois, sur l'axe où la cible est la plus loin
      const first = Math.abs(dx) > Math.abs(dy) ? 0 : Math.abs(dy) > Math.abs(dx) ? 1 : s.axis;
      let moved = false;
      for (const axis of [first, 1 - first]) {
        const d = axis === 0 ? Math.sign(dx) : Math.sign(dy);
        if (!d) continue;
        const nc = axis === 0 ? cur.c + d : cur.c;
        const nr = axis === 0 ? cur.r : cur.r + d;
        if (stepInto(s, nc, nr)) {
          s.axis = axis;
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
  }

  // Début d'un geste : sur un chemin existant (embranchement), ou sur un bâtiment (zone d'appui élargie).
  sim.beginStroke = function (x, y, buildingsOnly = false) {
    if (sim.stroke) return false;
    const start = layout.clampCell(x, y);
    const under = layout.cellAt(x, y);
    let s = null;
    if (!buildingsOnly && under && path[idx(under.c, under.r)]) {
      s = {
        kind: "path",
        building: null,
        start,
        moved: false,
        axis: 0,
        stack: [{ c: under.c, r: under.r, isNew: false }],
      };
    } else {
      let best = null;
      let bestD = B.start_radius_cells * cell;
      for (const b of sim.buildings) {
        const d = Math.hypot(x - b.x, y - b.y);
        if (d <= bestD) {
          bestD = d;
          best = b;
        }
      }
      if (best) s = { kind: "building", building: best, start, moved: false, axis: 0, stack: [] };
    }
    sim.stroke = s;
    return !!s;
  };

  sim.moveStroke = function (x, y) {
    const s = sim.stroke;
    if (!s) return;
    const tgt = layout.clampCell(x, y);
    if (tgt.c !== s.start.c || tgt.r !== s.start.r) s.moved = true;
    extend(s, tgt.c, tgt.r);
    flush();
  };

  // Fin du geste. Un toucher bref sur un chemin, sans glisser, efface son tronçon.
  sim.endStroke = function (quick) {
    const s = sim.stroke;
    sim.stroke = null;
    if (!s) return null;
    if (quick && s.kind === "path" && !s.moved) return sim.eraseAt(s.start.c, s.start.r);
    return null;
  };

  // Efface le tronçon entre deux croisements qui contient la case (c, r) et rend ses dalles.
  sim.eraseAt = function (c, r) {
    if (!inGrid(c, r) || !path[idx(c, r)]) return null;
    if (degree(c, r) >= 3) return null; // un croisement n'est pas un tronçon
    const seg = [];
    const seen = new Set([idx(c, r)]);
    const queue = [{ c, r }];
    for (let h = 0; h < queue.length; h++) {
      const cur = queue[h];
      seg.push(cur);
      for (const [dx, dy] of DIRS) {
        const nc = cur.c + dx;
        const nr = cur.r + dy;
        if (!inGrid(nc, nr)) continue;
        const ni = idx(nc, nr);
        if (!path[ni] || seen.has(ni) || degree(nc, nr) >= 3) continue;
        seen.add(ni);
        queue.push({ c: nc, r: nr });
      }
    }
    const refund = Math.floor(seg.length * TL.cost_per_cell * TL.refund_ratio);
    const mid = cellCenter(seg[seg.length >> 1].c, seg[seg.length >> 1].r);
    removeCells(seg);
    sim.tiles += refund;
    addPopup("tiles", mid.x, mid.y, refund);
    flush();
    return { cells: seg.length, refund };
  };

  // ---------- Créatures ----------

  const spawnInterval = (day) =>
    Math.max(B.house.interval_min_s, B.house.interval_base_s * Math.pow(B.house.interval_decay, day - 1));

  function workshopNextTo(cellRef, color) {
    for (const [dx, dy] of DIRS) {
      const nc = cellRef.c + dx;
      const nr = cellRef.r + dy;
      if (!inGrid(nc, nr)) continue;
      const id = occ[idx(nc, nr)];
      if (!id) continue;
      const b = buildingById(id);
      if (b.kind === "workshop" && b.color === color) return b;
    }
    return null;
  }

  // Sans route vers un atelier de sa couleur, la chaumière ne produit rien (les files d'attente viennent en V1).
  function trySpawn(house) {
    const d = sim.dist[house.color];
    if (!d) return false;
    let best = null;
    let bestD = INF;
    for (const [c, r] of perimeter(house)) {
      const i = idx(c, r);
      if (path[i] && d[i] < bestD) {
        bestD = d[i];
        best = { c, r };
      }
    }
    if (!best) return false;
    const p = cellCenter(best.c, best.r);
    sim.creatures.push({
      id: sim.nextId++,
      color: house.color,
      x: house.x,
      y: house.y,
      px: house.x,
      py: house.y,
      dx: 0,
      dy: 1,
      age: 0,
      stage: "exit", // exit : de la chaumière à sa porte, walk : sur le chemin, enter : de la porte à l'atelier
      cell: null,
      next: best,
      tx: p.x,
      ty: p.y,
      moving: true,
      dest: null,
      done: false,
    });
    return true;
  }

  // Choisit la prochaine destination d'une créature arrêtée sur une case de chemin.
  function decide(cr) {
    const d = sim.dist[cr.color];
    const here = idx(cr.cell.c, cr.cell.r);
    if (d[here] === 0) {
      const w = workshopNextTo(cr.cell, cr.color);
      if (w) {
        cr.stage = "enter";
        cr.dest = w;
        cr.tx = w.x;
        cr.ty = w.y;
        cr.moving = true;
        return;
      }
    }
    if (d[here] >= INF) {
      cr.moving = false; // coupée du réseau : elle attend
      return;
    }
    for (const [dx, dy] of DIRS) {
      const nc = cr.cell.c + dx;
      const nr = cr.cell.r + dy;
      if (!inGrid(nc, nr)) continue;
      const ni = idx(nc, nr);
      if (path[ni] && d[ni] === d[here] - 1) {
        const p = cellCenter(nc, nr);
        cr.next = { c: nc, r: nr };
        cr.tx = p.x;
        cr.ty = p.y;
        cr.moving = true;
        return;
      }
    }
    cr.moving = false;
  }

  function arrive(cr) {
    if (cr.stage === "enter") {
      sim.deliveries++;
      cr.dest.bumpAt = sim.tick;
      addPopup("delivery", cr.dest.x, cr.dest.y - (B.size * cell) / 2, 1);
      cr.done = true;
    } else {
      cr.cell = cr.next;
      cr.next = null;
      cr.stage = "walk";
      cr.moving = false;
    }
  }

  function moveCreature(cr, step) {
    let budget = step;
    for (let guard = 0; guard < 8 && budget > 0; guard++) {
      if (!cr.moving) {
        decide(cr);
        if (!cr.moving) return;
      }
      const dx = cr.tx - cr.x;
      const dy = cr.ty - cr.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        cr.dx = dx / dist;
        cr.dy = dy / dist;
      }
      if (dist > budget) {
        cr.x += cr.dx * budget;
        cr.y += cr.dy * budget;
        return;
      }
      cr.x = cr.tx;
      cr.y = cr.ty;
      budget -= dist;
      arrive(cr);
      if (cr.done) return;
    }
  }

  // ---------- Pas de simulation ----------

  sim.step = function () {
    sim.tick++;
    sim.noTilesFlash = Math.max(0, sim.noTilesFlash - dt);

    const stepPx = CR.speed_cells_per_s * cell * dt;
    for (const cr of sim.creatures) {
      cr.px = cr.x;
      cr.py = cr.y;
      cr.age += dt;
      moveCreature(cr, stepPx);
    }
    if (sim.creatures.some((cr) => cr.done)) sim.creatures = sim.creatures.filter((cr) => !cr.done);

    for (const b of sim.buildings) {
      if (b.kind !== "house") continue;
      b.timer -= dt;
      if (b.timer <= 0) {
        trySpawn(b);
        b.timer += spawnInterval(sim.day);
      }
    }

    for (const p of sim.popups) p.age += dt;
    if (sim.popups.some((p) => p.age >= popupLife)) sim.popups = sim.popups.filter((p) => p.age < popupLife);

    flush();
  };

  placeStart();
  rebuildDist();
  return sim;
}
