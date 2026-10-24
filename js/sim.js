// Simulation de la partie (V1, partie 1) : journées, chantiers et apparitions de bâtiments, réseau de chemins libre,
// tracé au doigt, effacement, créatures, livraisons, dalles.
// Logique pure, sans DOM. Tous les tirages passent par les flux à graine, jamais Math.random().
// Les gestes du joueur (beginStroke, moveStroke, endStroke) sont appliqués entre deux pas de simulation.
//
// Les chemins ne sont pas sur une grille : le réseau est un graphe de nœuds (points) reliés par des arêtes (segments
// droits). Le doigt tire une « tête » qui avance par pas fixes (roads.step_px) : cela lisse le tracé. Un croisement
// avec un autre chemin crée un nœud, un chemin qui passe près d'un nœud ou d'une arête s'y raccorde. Seuls les
// bâtiments restent posés sur la grille (invisible) de la carte.

import { createStreams } from "./rng.js";

const INF = 1e9;

// ---------- Géométrie ----------

// Le segment a→b entre-t-il dans l'intérieur du rectangle ? (toucher le bord ne compte pas)
function segHitsRect(ax, ay, bx, by, x0, y0, x1, y1) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] <= 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t1 - t0 > 1e-6;
}

// Croisement franc de a→b avec c→d : { t, u, x, y } ou null. t est la position sur a→b, u sur c→d.
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = cx - ax;
  const qy = cy - ay;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 0 || u >= 1) return null;
  return { t, u, x: ax + t * rx, y: ay + t * ry };
}

// Point du segment a→b le plus proche de p : { d, u, x, y }.
function nearestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const u = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const x = ax + u * dx;
  const y = ay + u * dy;
  return { d: Math.hypot(px - x, py - y), u, x, y };
}

// Point du bord du rectangle le plus proche de p (p dehors : on le ramène sur le bord ; dedans : on le pousse dehors).
function boundaryPoint(rc, p) {
  const inside = p.x > rc.x0 && p.x < rc.x1 && p.y > rc.y0 && p.y < rc.y1;
  if (!inside) return { x: Math.min(rc.x1, Math.max(rc.x0, p.x)), y: Math.min(rc.y1, Math.max(rc.y0, p.y)) };
  const dl = p.x - rc.x0;
  const dr = rc.x1 - p.x;
  const dt = p.y - rc.y0;
  const db = rc.y1 - p.y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: rc.x0, y: p.y };
  if (m === dr) return { x: rc.x1, y: p.y };
  if (m === dt) return { x: p.x, y: rc.y0 };
  return { x: p.x, y: rc.y1 };
}

const inRect = (rc, p) => p.x > rc.x0 && p.x < rc.x1 && p.y > rc.y0 && p.y < rc.y1;

// Petit tas binaire (distance, identifiant) : l'identifiant départage les égalités, donc c'est déterministe.
function makeHeap() {
  const h = [];
  const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  return {
    get size() {
      return h.length;
    },
    push(item) {
      h.push(item);
      let i = h.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(h[i], h[p])) break;
        [h[i], h[p]] = [h[p], h[i]];
        i = p;
      }
    },
    pop() {
      const top = h[0];
      const last = h.pop();
      if (h.length) {
        h[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < h.length && less(h[l], h[m])) m = l;
          if (r < h.length && less(h[r], h[m])) m = r;
          if (m === i) break;
          [h[i], h[m]] = [h[m], h[i]];
          i = m;
        }
      }
      return top;
    },
  };
}

export function createSim(cfg, layout, seed) {
  const { cols, rows, cell } = layout;
  const B = cfg.buildings;
  const R = cfg.roads;
  const CR = cfg.creatures;
  const T = cfg.traffic;
  const PAN = cfg.panic;
  const TL = cfg.tiles;
  const D = cfg.days;
  const popupLife = cfg.ui.play.popup.life_s;
  const hz = cfg.loop.sim_hz;
  const dt = 1 / hz;
  const ticks = (s) => Math.round(s * hz); // les journées et les chantiers se comptent en pas entiers : exact et déterministe
  const streams = createStreams(seed, cfg.rng.streams);
  const unit = B.size * cell; // côté d'un bâtiment
  const costOf = (len) => (len / cell) * TL.cost_per_cell; // 1 dalle par 54 px de chemin
  const gapPx = (cr) => T.gap_cells * cell * cr.size; // écart entre deux créatures : 0,7 case × taille
  const crossTicks = ticks(T.cross_s);
  const stuckTicks = ticks(T.stuck_s);
  const deadlockTicks = ticks(T.deadlock_s);
  const unloadTicks = ticks(T.unload_s);

  const nodes = new Map(); // id → { id, x, y, door (id du bâtiment, 0 sinon), adj: [{ to, edge }] }
  const edges = new Map(); // id → { id, a, b, len, placedAt }
  let nodeSeq = 1;
  let edgeSeq = 1;

  const sim = {
    cols,
    rows,
    tick: 0,
    day: 1,
    dayTick: 0, // pas écoulés dans la journée en cours
    dayTicks: ticks(D.length_s),
    tiles: TL.start, // nombre réel : un chemin coûte 1 dalle pour 54 px, l'affichage arrondit vers le bas
    deliveries: 0,
    produced: 0, // créatures fabriquées par toutes les chaumières (pour vérifier qu'aucune ne se perd ni ne se dédouble)
    noTilesFlash: 0, // secondes restantes du clignotement « plus de dalles »
    gainFx: null, // { n, age } : « +18 » affiché dans la barre du haut après un gain de fin de journée
    nodes,
    edges,
    graphVersion: 0, // augmente à chaque changement du réseau (l'affichage met son dessin en cache)
    buildings: [],
    sites: [], // chantiers en cours : { id, kind, color, c, r, x, y, left, total }
    creatures: [],
    popups: [],
    panic: { active: false, left: ticks(PAN.seconds), total: ticks(PAN.seconds) }, // compteur de brume
    over: false, // la brume est tombée : la partie est finie
    daysHeld: 0,
    dist: {}, // couleur → Map(nœud → distance jusqu'à l'atelier le plus proche)
    stroke: null,
    nextId: 1,
  };

  let dirty = false; // le réseau a changé : champ de distance à recalculer

  // ---------- Bâtiments et chantiers ----------

  const buildingById = (id) => sim.buildings.find((b) => b.id === id);

  function rectOf(b, grow) {
    const half = unit / 2 + grow;
    return { x0: b.x - half, y0: b.y - half, x1: b.x + half, y1: b.y + half };
  }
  const blockRect = (b) => rectOf(b, R.block_px); // où le chemin ne passe pas
  const ringRect = (b) => rectOf(b, R.door_gap_px); // où se posent les portes
  const captureRect = (b) => rectOf(b, R.capture_px); // où le doigt vise la porte

  function addBuilding(kind, color, c, r) {
    const q = layout.cellRect(c, r);
    const half = unit / 2;
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
      queue: kind === "house" ? 0 : [], // chaumière : nombre de créatures qui attendent ; atelier : créatures arrivées, à décharger
      cool: 0, // chaumière : pas avant la prochaine sortie
      unload: 0, // atelier : pas avant le prochain déchargement
      over: false, // file en débordement (10 ou plus, tant qu'elle n'est pas redescendue à 7)
    };
    sim.buildings.push(b);
    dirty = true; // un nouveau bâtiment change les distances (nouvel atelier, nouvelle couleur)
    return b;
  }

  // Cases vides entre deux emprises (négatif si elles se chevauchent).
  const gap = (c, r, b) => Math.max(Math.abs(c - b.c) - B.size, Math.abs(r - b.r) - B.size);

  // Cases possibles pour un nouveau bâtiment, dans l'ordre de la grille, avec un écart d'au moins minGap cases.
  // Elles ne dépendent que des bâtiments et des chantiers (donc de la graine, pas des chemins du joueur).
  function freeSpots(blocks, minGap) {
    const out = [];
    for (let r = B.edge_margin; r <= rows - B.edge_margin - B.size; r++) {
      for (let c = B.edge_margin; c <= cols - B.edge_margin - B.size; c++) {
        if (blocks.every((b) => gap(c, r, b) >= minGap)) out.push({ c, r });
      }
    }
    return out;
  }

  // Emplacements pour un bâtiment de ce type et de cette couleur. Le partenaire (la chaumière pour un atelier, l'atelier
  // pour une chaumière) doit être à pair_min..pair_max cases. Priorité : à portée de tous les partenaires, puis d'au moins
  // un, puis n'importe où. À chaque niveau, l'écart minimal baisse d'une case (jusqu'à min_gap_floor) si la carte est pleine.
  function candidateSpots(kind, color) {
    const blocks = sim.buildings.concat(sim.sites);
    const partners = blocks.filter((b) => b.color === color && b.kind !== kind);
    const near = (s, b) => {
      const d = Math.abs(s.c - b.c) + Math.abs(s.r - b.r);
      return d >= B.pair_min && d <= B.pair_max;
    };
    const lists = [];
    for (let g = B.min_gap; g >= B.min_gap_floor; g--) lists.push(freeSpots(blocks, g));
    if (partners.length) {
      for (const free of lists) {
        const all = free.filter((s) => partners.every((b) => near(s, b)));
        if (all.length) return all;
      }
      for (const free of lists) {
        const some = free.filter((s) => partners.some((b) => near(s, b)));
        if (some.length) return some;
      }
    }
    return lists.find((l) => l.length) || [];
  }

  // Un chemin passe-t-il trop près de cet emplacement ?
  function roadNear(c, r) {
    const q = layout.cellRect(c, r);
    const x0 = q.x - R.clear_px;
    const y0 = q.y - R.clear_px;
    const x1 = q.x + unit + R.clear_px;
    const y1 = q.y + unit + R.clear_px;
    for (const e of edges.values()) {
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      if (segHitsRect(a.x, a.y, b.x, b.y, x0, y0, x1, y1)) return true;
    }
    return false;
  }

  function addSite(kind, color, c, r) {
    const q = layout.cellRect(c, r);
    const half = unit / 2;
    const left = ticks(B.site_s);
    const s = { id: sim.nextId++, kind, color, c, r, x: q.x + half, y: q.y + half, left, total: left };
    sim.sites.push(s);
    return s;
  }

  function finishSite(s) {
    const b = addBuilding(s.kind, s.color, s.c, s.r);
    b.bumpAt = sim.tick; // petit rebond à l'apparition
  }

  // Choisit l'emplacement d'un bâtiment : exactement 1 tirage du flux « apparitions », quoi qu'il arrive. Si la case
  // tirée est occupée par un chemin, on prend la suivante de la liste (seule exception à l'indépendance des flux).
  function place(kind, color, instant) {
    const list = candidateSpots(kind, color);
    if (!list.length) return false;
    const start = streams.apparitions.int(list.length);
    for (let k = 0; k < list.length; k++) {
      const s = list[(start + k) % list.length];
      if (roadNear(s.c, s.r)) continue;
      if (instant) addBuilding(kind, color, s.c, s.r);
      else addSite(kind, color, s.c, s.r);
      return true;
    }
    return false;
  }

  // Tableau d'apparitions (balance.json > days.schedule). at_s est l'instant où le bâtiment apparaît : le chantier
  // commence site_s plus tôt. Un bâtiment prévu avant site_s (la paire de départ, à 0 s) apparaît sans chantier.
  const events = D.schedule.map((e) => {
    const at = ticks(e.at_s);
    const start = at - ticks(B.site_s);
    return { day: e.day, color: e.color, kinds: e.kinds, instant: start < 0, fireTick: start < 0 ? at : start, fired: false };
  });

  function runSchedule() {
    for (const e of events) {
      if (e.fired || e.day !== sim.day || sim.dayTick < e.fireTick) continue;
      e.fired = true;
      for (const kind of e.kinds) place(kind, e.color, e.instant); // chaumière d'abord : l'atelier se place par rapport à elle
    }
  }

  function stepSites() {
    for (const s of sim.sites) s.left--;
    if (sim.sites.some((s) => s.left <= 0)) {
      const done = sim.sites.filter((s) => s.left <= 0);
      sim.sites = sim.sites.filter((s) => s.left > 0);
      for (const s of done) finishSite(s);
    }
  }

  // Fin de journée : +per_day dalles sans dépasser le plafond (le plafond ne retire jamais de dalles).
  function endDay() {
    sim.day++;
    sim.dayTick -= sim.dayTicks;
    if (sim.tiles < TL.cap) {
      const before = sim.tiles;
      sim.tiles = Math.min(TL.cap, sim.tiles + TL.per_day);
      sim.gainFx = { n: Math.round(sim.tiles - before), age: 0 };
    }
  }

  // ---------- Réseau : nœuds, arêtes, portes ----------

  function addNode(x, y, door = 0) {
    const n = { id: nodeSeq++, x, y, door, adj: [] };
    nodes.set(n.id, n);
    return n;
  }

  function addEdge(a, b, placedAt = sim.tick) {
    const e = { id: edgeSeq++, a: a.id, b: b.id, len: Math.hypot(b.x - a.x, b.y - a.y), placedAt };
    edges.set(e.id, e);
    a.adj.push({ to: b.id, edge: e.id });
    b.adj.push({ to: a.id, edge: e.id });
    dirty = true;
    sim.graphVersion++;
    return e;
  }

  function removeEdgeRaw(e) {
    edges.delete(e.id);
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (a) a.adj = a.adj.filter((x) => x.edge !== e.id);
    if (b) b.adj = b.adj.filter((x) => x.edge !== e.id);
    dirty = true;
    sim.graphVersion++;
  }

  // Supprime un nœud resté sans arête.
  function pruneNode(id) {
    const n = nodes.get(id);
    if (n && !n.adj.length) {
      nodes.delete(id);
      sim.graphVersion++;
    }
  }

  const edgeBetween = (a, b) => {
    const n = nodes.get(a);
    return n ? n.adj.find((x) => x.to === b) || null : null;
  };

  // Nombre de chemins reliés à un bâtiment : les arêtes qui touchent ses portes.
  function doorEdgeCount(b) {
    let n = 0;
    for (const nd of nodes.values()) if (nd.door === b.id) n += nd.adj.length;
    return n;
  }

  // Un nœud peut-il recevoir une arête de plus ? (3 chemins reliés au plus par bâtiment)
  function nodeCanTakeEdge(n) {
    if (!n.door) return true;
    return doorEdgeCount(buildingById(n.door)) < B.max_doors;
  }

  function nearestDoor(b, p, maxD) {
    let best = null;
    let bestD = maxD;
    for (const n of nodes.values()) {
      if (n.door !== b.id) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d <= bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  // Coupe l'arête e en (x, y) : crée le nœud, deux arêtes, et reporte les créatures qui y marchaient.
  function splitEdge(e, x, y) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    const X = addNode(x, y);
    removeEdgeRaw(e);
    addEdge(a, X, e.placedAt);
    addEdge(X, b, e.placedAt);
    for (const cr of sim.creatures) {
      if (cr.stage !== "walk" || !cr.next || cr.node === null) continue;
      const onEdge = (cr.node === a.id && cr.next === b.id) || (cr.node === b.id && cr.next === a.id);
      if (!onEdge) continue;
      const from = nodes.get(cr.node);
      if (Math.hypot(cr.x - from.x, cr.y - from.y) <= Math.hypot(X.x - from.x, X.y - from.y)) {
        cr.next = X.id; // elle n'a pas encore atteint le point de coupe
      } else {
        cr.node = X.id; // elle l'a dépassé : elle est maintenant sur la deuxième moitié
      }
      cr.tx = nodes.get(cr.next).x;
      cr.ty = nodes.get(cr.next).y;
    }
    return X;
  }

  // Chemin le plus proche d'un point du monde (nœud ou arête), à touch_px près au plus.
  function nearestRoad(x, y) {
    let best = null;
    let bestD = R.touch_px;
    for (const e of edges.values()) {
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      const q = nearestOnSeg(x, y, a.x, a.y, b.x, b.y);
      if (q.d < bestD) {
        bestD = q.d;
        best = { edge: e.id, x: q.x, y: q.y, u: q.u };
      }
    }
    if (!best) return null;
    const e = edges.get(best.edge);
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    const da = Math.hypot(best.x - a.x, best.y - a.y);
    const db = Math.hypot(best.x - b.x, best.y - b.y);
    if (Math.min(da, db) <= R.node_pick_px) best.node = da <= db ? a.id : b.id;
    return best;
  }

  // ---------- Distances par couleur (Dijkstra depuis les portes des ateliers) ----------

  function rebuildDist() {
    const colors = new Set(sim.buildings.map((b) => b.color));
    sim.dist = {};
    for (const color of colors) {
      const d = new Map();
      const heap = makeHeap();
      for (const n of nodes.values()) {
        if (!n.door || !n.adj.length) continue;
        const b = buildingById(n.door);
        if (b && b.kind === "workshop" && b.color === color) {
          d.set(n.id, 0);
          heap.push([0, n.id]);
        }
      }
      while (heap.size) {
        const [dd, id] = heap.pop();
        if (dd > d.get(id)) continue;
        for (const { to, edge } of nodes.get(id).adj) {
          const nd = dd + edges.get(edge).len;
          if (!d.has(to) || nd < d.get(to) - 1e-9) {
            d.set(to, nd);
            heap.push([nd, to]);
          }
        }
      }
      sim.dist[color] = d;
    }
    dirty = false;
  }

  function flush() {
    if (dirty) rebuildDist();
  }

  // Une créature qui n'a plus de route (tronçon effacé) retourne dans la file de sa chaumière : ni perdue ni dédoublée.
  function sendHome(cr) {
    if (cr.gone) return;
    cr.gone = true;
    cr.done = true;
    cr.inQueue = 0;
    const h = buildingById(cr.home);
    if (h) h.queue++;
  }

  function dropLostCreatures() {
    for (const cr of sim.creatures) {
      if (cr.stage === "enter") continue;
      if (cr.stage === "exit") {
        if (!nodes.has(cr.next)) sendHome(cr);
      } else if (cr.next !== null) {
        if (!edgeBetween(cr.node, cr.next)) sendHome(cr);
      } else if (!nodes.has(cr.node)) {
        sendHome(cr);
      }
    }
    sim.creatures = sim.creatures.filter((cr) => !cr.done);
  }

  function addPopup(kind, x, y, n) {
    sim.popups.push({ kind, x, y, n, age: 0 });
  }

  // ---------- Tracé ----------

  const blockedRects = () => sim.buildings.concat(sim.sites).map(blockRect);

  function segBlocked(ax, ay, bx, by) {
    return blockedRects().some((rc) => segHitsRect(ax, ay, bx, by, rc.x0, rc.y0, rc.x1, rc.y1));
  }

  // Bâtiment (pas un chantier) dont la zone de capture contient le point.
  function captureAt(p) {
    for (const b of sim.buildings) if (inRect(captureRect(b), p)) return b;
    return null;
  }

  // Raccord d'un point : un nœud proche, sinon une arête proche. Les chemins du tracé en cours et ceux qui touchent
  // sa tête sont ignorés, pour qu'il ne se recolle pas à lui-même ni à la route d'où il part.
  function findSnap(s, p) {
    const mine = new Set(s.stack.map((e) => e.id));
    let node = null;
    let nodeD = R.snap_px;
    for (const n of nodes.values()) {
      if (mine.has(n.id)) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < nodeD && nodeCanTakeEdge(n)) {
        nodeD = d;
        node = n;
      }
    }
    if (node) return { node };
    let edge = null;
    let edgeD = R.snap_px;
    let pt = null;
    for (const e of edges.values()) {
      if (s.own.has(e.id) || mine.has(e.a) || mine.has(e.b)) continue;
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      const q = nearestOnSeg(p.x, p.y, a.x, a.y, b.x, b.y);
      if (q.d < edgeD && q.u * e.len > R.node_pick_px && (1 - q.u) * e.len > R.node_pick_px) {
        edgeD = q.d;
        edge = e;
        pt = q;
      }
    }
    return edge ? { edge, point: { x: pt.x, y: pt.y } } : null;
  }

  // Les croisements du segment head→q avec les chemins existants, dans l'ordre.
  function findCrossings(head, q, s, skipEdge) {
    const out = [];
    for (const e of edges.values()) {
      if (s.own.has(e.id) || (skipEdge && e.id === skipEdge.id)) continue;
      if (e.a === head.id || e.b === head.id) continue;
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      const c = segCross(head.x, head.y, q.x, q.y, a.x, a.y, b.x, b.y);
      if (c) out.push({ ...c, edge: e });
    }
    out.sort((m, n) => m.t - n.t || m.edge.id - n.edge.id);
    return out;
  }

  // Ajoute l'arête cur→fin au tracé et débite les dalles.
  function connect(s, cur, fin, nodeNew) {
    if (cur.id === fin.id) return;
    if (edgeBetween(cur.id, fin.id)) {
      s.stack.push({ id: fin.id, edge: null, nodeNew }); // déjà relié : rien à payer
      return;
    }
    const e = addEdge(cur, fin);
    sim.tiles -= costOf(e.len);
    s.own.add(e.id);
    s.stack.push({ id: fin.id, edge: e.id, nodeNew });
  }

  // Pousse le tracé de sa tête jusqu'à q. `end` précise la fin : un nœud existant, une arête à couper, une porte à créer,
  // ou rien (un nouveau point libre). Renvoie true si la tête a bougé.
  function extendTo(s, q, end) {
    const head = nodes.get(s.headId);
    if (!nodeCanTakeEdge(head)) return false;
    let endNode = null;
    let snapEdge = null;
    if (end.node) {
      endNode = end.node;
      if (endNode.id === head.id || !nodeCanTakeEdge(endNode)) return false;
      q = { x: endNode.x, y: endNode.y };
    } else if (end.edge) {
      snapEdge = end.edge;
    } else if (end.building && doorEdgeCount(end.building) >= B.max_doors) {
      return false;
    }
    if (segBlocked(head.x, head.y, q.x, q.y)) return false;

    const cross = findCrossings(head, q, s, snapEdge);
    // un croisement tombe sur une extrémité d'arête : on s'y raccorde au lieu de couper
    const hits = cross.map((c) => {
      const a = nodes.get(c.edge.a);
      const b = nodes.get(c.edge.b);
      if (c.u * c.edge.len < R.node_pick_px) return { ...c, node: a };
      if ((1 - c.u) * c.edge.len < R.node_pick_px) return { ...c, node: b };
      return c;
    });
    for (const h of hits) if (h.node && !nodeCanTakeEdge(h.node)) return false;

    const total = Math.hypot(q.x - head.x, q.y - head.y);
    if (total < 1e-6) return false;
    if (sim.tiles + 1e-9 < costOf(total)) {
      sim.noTilesFlash = TL.flash_s;
      return false;
    }

    let cur = head;
    for (const h of hits) {
      const X = h.node || splitEdge(h.edge, h.x, h.y);
      if (X.id === cur.id) continue;
      connect(s, cur, X, false);
      cur = X;
    }
    let fin;
    let isNew = false;
    if (endNode) {
      fin = endNode;
    } else if (snapEdge) {
      fin = splitEdge(snapEdge, q.x, q.y);
    } else {
      fin = addNode(q.x, q.y, end.building ? end.building.id : 0);
      isNew = true;
    }
    connect(s, cur, fin, isNew);
    s.headId = fin.id;
    return true;
  }

  // Défait le tracé jusqu'à l'entrée n° keep de la pile (-1 : tout, jusqu'au bâtiment) et rend les dalles.
  function popTo(s, keep) {
    while (s.stack.length - 1 > keep) {
      const e = s.stack.pop();
      if (e.edge) {
        const edge = edges.get(e.edge);
        if (edge) {
          sim.tiles += costOf(edge.len);
          removeEdgeRaw(edge);
        }
        s.own.delete(e.edge);
      }
      if (e.nodeNew) pruneNode(e.id);
    }
    s.headId = s.stack.length ? s.stack[s.stack.length - 1].id : null;
    dropLostCreatures();
  }

  // Le doigt revient sur son propre tracé : on le défait jusque-là.
  function undoCheck(s, tgt) {
    const n = s.stack.length;
    if (n <= R.undo_skip + 1) return;
    let best = -1;
    let bestD = R.undo_px;
    for (let i = 0; i < n - R.undo_skip; i++) {
      const nd = nodes.get(s.stack[i].id);
      const d = Math.hypot(nd.x - tgt.x, nd.y - tgt.y);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) popTo(s, best);
  }

  // Crée la tête du tracé au premier mouvement : sur le chemin saisi, ou sur une porte du bâtiment de départ.
  function ensureHead(s, tgt) {
    if (s.headId) return true;
    if (s.kind === "path") {
      const p = s.pending;
      const n = p.node ? nodes.get(p.node) : splitEdge(edges.get(p.edge), p.x, p.y);
      s.headId = n.id;
      s.stack.push({ id: n.id, edge: null, nodeNew: false });
      return true;
    }
    const b = s.building;
    if (inRect(captureRect(b), tgt)) return false; // le doigt n'est pas encore sorti du bâtiment
    const q = boundaryPoint(ringRect(b), tgt);
    let door = nearestDoor(b, q, R.door_merge_px);
    let isNew = false;
    if (doorEdgeCount(b) >= B.max_doors) return false;
    if (!door) {
      door = addNode(q.x, q.y, b.id);
      isNew = true;
    }
    s.headId = door.id;
    s.stack.push({ id: door.id, edge: null, nodeNew: isNew });
    return true;
  }

  // Un pas libre de la tête vers q, avec raccord à ce qui est proche.
  function stepFree(s, q) {
    const sn = findSnap(s, q);
    if (sn && sn.node) return extendTo(s, null, { node: sn.node });
    if (sn && sn.edge) return extendTo(s, sn.point, { edge: sn.edge });
    return extendTo(s, q, {});
  }

  // La tête est près d'un bâtiment visé : on la relie à une de ses portes.
  function connectDoor(s, b, q) {
    let door = nearestDoor(b, q, R.door_merge_px);
    if (door) return extendTo(s, null, { node: door });
    return extendTo(s, q, { building: b });
  }

  function advanceStroke(s) {
    const tgt = s.target;
    if (s.kind === "building" && s.stack.length && inRect(captureRect(s.building), tgt)) {
      popTo(s, -1); // le doigt retourne sur le bâtiment de départ : on défait tout
      return;
    }
    undoCheck(s, tgt);
    for (let guard = R.max_points_per_move; guard > 0; guard--) {
      if (!ensureHead(s, tgt)) return;
      const head = nodes.get(s.headId);
      const b = captureAt(tgt);
      if (b && !(s.kind === "building" && b === s.building)) {
        const q = boundaryPoint(ringRect(b), head);
        const d = Math.hypot(q.x - head.x, q.y - head.y);
        if (d <= R.step_px) {
          connectDoor(s, b, q);
          return;
        }
        const k = R.step_px / d;
        if (!stepFree(s, { x: head.x + (q.x - head.x) * k, y: head.y + (q.y - head.y) * k })) return;
        continue;
      }
      const d = Math.hypot(tgt.x - head.x, tgt.y - head.y);
      if (d < R.step_px) return;
      const k = R.step_px / d;
      if (!stepFree(s, { x: head.x + (tgt.x - head.x) * k, y: head.y + (tgt.y - head.y) * k })) return;
    }
  }

  // Début d'un geste : sur un chemin existant (embranchement), ou sur un bâtiment (zone d'appui élargie).
  sim.beginStroke = function (x, y, buildingsOnly = false) {
    if (sim.stroke) return false;
    let s = null;
    const road = buildingsOnly ? null : nearestRoad(x, y);
    if (road) {
      s = { kind: "path", building: null, pending: road, start: { x, y }, moved: false, target: { x, y }, headId: null, stack: [], own: new Set() };
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
      if (best) s = { kind: "building", building: best, pending: null, start: { x, y }, moved: false, target: { x, y }, headId: null, stack: [], own: new Set() };
    }
    sim.stroke = s;
    return !!s;
  };

  sim.moveStroke = function (x, y) {
    const s = sim.stroke;
    if (!s) return;
    s.target = { x, y };
    if (Math.hypot(x - s.start.x, y - s.start.y) > R.tap_slop_px) s.moved = true;
    advanceStroke(s);
    flush();
  };

  // Fin du geste. Un toucher bref sur un chemin, sans glisser, efface son tronçon.
  sim.endStroke = function (quick) {
    const s = sim.stroke;
    sim.stroke = null;
    if (!s) return null;
    // une porte créée au départ mais restée sans chemin ne reste pas
    for (const e of s.stack) if (e.nodeNew) pruneNode(e.id);
    flush();
    if (quick && s.kind === "path" && !s.moved) return sim.eraseAt(s.start.x, s.start.y);
    return null;
  };

  // Tête du tracé en cours (pour l'affichage), ou null.
  sim.headPos = function () {
    const s = sim.stroke;
    if (!s || !s.headId) return null;
    const n = nodes.get(s.headId);
    return n ? { x: n.x, y: n.y } : null;
  };

  // Efface le tronçon (entre deux croisements, extrémités ou portes) le plus proche du point et rend ses dalles.
  sim.eraseAt = function (x, y) {
    const hit = nearestRoad(x, y);
    if (!hit) return null;
    const first = edges.get(hit.edge);
    const chain = new Map([[first.id, first]]);
    const queue = [first];
    for (let h = 0; h < queue.length; h++) {
      const e = queue[h];
      for (const id of [e.a, e.b]) {
        const n = nodes.get(id);
        if (n.adj.length !== 2 || n.door) continue; // croisement, bout de chemin ou porte : le tronçon s'arrête
        for (const { edge } of n.adj) {
          if (!chain.has(edge)) {
            chain.set(edge, edges.get(edge));
            queue.push(edges.get(edge));
          }
        }
      }
    }
    let len = 0;
    const touched = new Set();
    for (const e of chain.values()) {
      len += e.len;
      touched.add(e.a);
      touched.add(e.b);
      removeEdgeRaw(e);
    }
    for (const id of touched) pruneNode(id);
    const refund = costOf(len) * TL.refund_ratio;
    sim.tiles += refund;
    addPopup("tiles", hit.x, hit.y, Math.max(1, Math.round(refund)));
    dropLostCreatures();
    flush();
    return { edges: chain.size, refund };
  };

  // ---------- Créatures, files d'attente, croisements ----------

  const spawnInterval = (day) =>
    Math.max(B.house.interval_min_s, B.house.interval_base_s * Math.pow(B.house.interval_decay, day - 1));

  const isJunction = (id) => {
    const n = nodes.get(id);
    return !!n && !n.door && n.adj.length >= 3; // les portes ne verrouillent pas : on y entre et on en sort librement
  };

  // Nœud d'où une créature de cette couleur entre dans son atelier : distance 0 sur une porte d'atelier.
  function isDestNode(n, color) {
    if (!n || !n.door) return false;
    const d = sim.dist[color];
    return !!d && d.get(n.id) === 0;
  }

  // Voisin vers lequel une créature de cette couleur avance depuis le nœud id (le plus court chemin), ou null.
  function chooseNext(id, color) {
    const n = nodes.get(id);
    const d = sim.dist[color];
    if (!n || !d) return null;
    let best = null;
    let bestV = INF;
    for (const { to, edge } of n.adj) {
      const dn = d.get(to);
      if (dn === undefined) continue;
      const v = dn + edges.get(edge).len;
      if (v < bestV - 1e-9) {
        bestV = v;
        best = to;
      }
    }
    return best;
  }

  // Occupation des arêtes (par sens de marche) et des nœuds, photographiée au début du pas.
  let occEdge = new Map();
  let occNode = new Map();
  const occKey = (e, from) => e.id * 2 + (from === e.a ? 0 : 1);

  function buildOcc() {
    occEdge = new Map();
    occNode = new Map();
    for (const cr of sim.creatures) {
      if (cr.stage !== "walk" || cr.node === null) continue;
      if (cr.next !== null) {
        const ad = edgeBetween(cr.node, cr.next);
        if (!ad) continue;
        const from = nodes.get(cr.node);
        const k = occKey(edges.get(ad.edge), cr.node);
        let list = occEdge.get(k);
        if (!list) occEdge.set(k, (list = []));
        list.push({ cr, s: Math.hypot(cr.x - from.x, cr.y - from.y) });
      } else {
        let list = occNode.get(cr.node);
        if (!list) occNode.set(cr.node, (list = []));
        list.push(cr);
      }
    }
  }

  // Distance jusqu'à la créature qui précède sur la route de cr (INF si personne dans l'écart + marge).
  function leaderGap(cr) {
    const look = gapPx(cr) + T.lookahead_px;
    const from0 = nodes.get(cr.node);
    let acc = -Math.hypot(cr.x - from0.x, cr.y - from0.y);
    let a = cr.node;
    let b = cr.next;
    let first = true;
    for (let i = 0; i < 8; i++) {
      const ad = edgeBetween(a, b);
      if (!ad) return INF;
      const e = edges.get(ad.edge);
      const list = occEdge.get(occKey(e, a));
      let best = INF;
      if (list) {
        for (const o of list) {
          if (o.cr === cr) continue;
          const d = acc + o.s;
          if (first && (d < 0 || (d === 0 && o.cr.id > cr.id))) continue; // derrière nous
          if (d < best) best = d;
        }
      }
      if (best < INF) return best;
      acc += e.len;
      if (acc > look) return INF;
      const waiting = occNode.get(b);
      if (waiting && waiting.length) return acc;
      if (isDestNode(nodes.get(b), cr.color)) return INF;
      const nxt = chooseNext(b, cr.color);
      if (nxt === null) return INF;
      a = b;
      b = nxt;
      first = false;
    }
    return INF;
  }

  // Croisements : file d'arrivée par nœud, premier arrivé premier servi, une créature à la fois (cross_s de verrou).
  const jq = new Map(); // nœud → créatures arrêtées à la ligne d'arrêt, dans l'ordre d'arrivée
  const jbusy = new Map(); // nœud → pas jusqu'auquel le croisement est occupé

  function requestEntry(cr) {
    if (cr.inQueue === cr.next) return;
    let q = jq.get(cr.next);
    if (!q) jq.set(cr.next, (q = []));
    q.push(cr);
    cr.inQueue = cr.next;
    cr.wait = 0;
  }

  // La première créature de la file entre si le croisement est libre et si la case de sortie a de la place.
  // Si elle attend depuis plus de deadlock_s (blocage en boucle), elle passe quand même : jamais de blocage définitif.
  function grantJunctions() {
    for (const [nid, q0] of jq) {
      const q = q0.filter((cr) => !cr.gone && cr.inQueue === nid);
      jq.set(nid, q);
      if (!isJunction(nid)) {
        for (const cr of q) cr.inQueue = 0;
        jq.delete(nid);
        continue;
      }
      if (!q.length || (jbusy.get(nid) || 0) > sim.tick) continue;
      const head = q[0];
      let clear = true;
      const nxt = chooseNext(nid, head.color);
      if (nxt !== null) {
        const ad = edgeBetween(nid, nxt);
        const list = ad ? occEdge.get(occKey(edges.get(ad.edge), nid)) : null;
        if (list && list.some((o) => o.s < gapPx(head))) clear = false;
      }
      if (clear || head.wait >= deadlockTicks) {
        q.shift();
        head.inQueue = 0;
        head.granted = nid;
        head.wait = 0;
        jbusy.set(nid, sim.tick + crossTicks);
      }
    }
  }

  // Une chaumière fabrique une créature à intervalle régulier : elle rejoint la file d'attente de la chaumière.
  // Elle sort sur le chemin dès qu'il y a une route et de la place devant la porte.
  function bestDoor(house) {
    const d = sim.dist[house.color];
    if (!d) return null;
    let best = null;
    let bestD = INF;
    for (const n of nodes.values()) {
      if (n.door !== house.id || !n.adj.length) continue;
      const v = d.get(n.id);
      if (v !== undefined && v < bestD) {
        bestD = v;
        best = n;
      }
    }
    return best;
  }

  function release(house) {
    if (house.queue <= 0 || house.cool > 0) return;
    const door = bestDoor(house);
    if (!door) return; // pas de route : la file grossit
    const g = T.gap_cells * cell * CR.size;
    for (const cr of sim.creatures) {
      if (cr.stage === "enter") continue;
      if (Math.hypot(cr.x - door.x, cr.y - door.y) < g) return; // la porte n'est pas libre
    }
    house.queue--;
    house.cool = Math.ceil(g / (CR.speed_cells_per_s * cell * dt));
    sim.creatures.push({
      id: sim.nextId++,
      color: house.color,
      home: house.id,
      size: CR.size,
      speed: CR.speed_cells_per_s * cell,
      x: house.x,
      y: house.y,
      px: house.x,
      py: house.y,
      dx: 0,
      dy: 1,
      age: 0,
      stage: "exit", // exit : de la chaumière à sa porte, walk : sur le chemin, enter : de la porte à l'atelier
      node: null, // dernier nœud atteint
      next: door.id, // nœud visé
      tx: door.x,
      ty: door.y,
      moving: true,
      dest: null,
      inQueue: 0, // nœud de croisement dont elle attend l'accès
      granted: 0, // nœud de croisement qu'elle a le droit de traverser
      wait: 0,
      stuck: 0,
      gone: false,
      done: false,
    });
  }

  // Atelier : une créature arrivée à sa porte entre dans sa file, déchargée une à la fois toutes les 0,8 s.
  function unload(w) {
    if (w.unload > 0) {
      w.unload--;
      return;
    }
    if (!w.queue.length) return;
    const cr = w.queue.shift();
    cr.stage = "enter";
    cr.dest = w;
    cr.tx = w.x;
    cr.ty = w.y;
    cr.moving = true;
    cr.done = false;
    cr.gone = false;
    sim.creatures.push(cr);
    w.unload = unloadTicks;
  }

  // Choisit la prochaine destination d'une créature arrêtée sur un nœud.
  function decide(cr) {
    if (!nodes.has(cr.node)) {
      sendHome(cr);
      return;
    }
    const nxt = chooseNext(cr.node, cr.color);
    if (nxt === null) {
      // coupée du réseau : elle attend un instant, puis retourne dans la file de sa chaumière
      cr.moving = false;
      if (++cr.stuck > stuckTicks) sendHome(cr);
      return;
    }
    cr.stuck = 0;
    const nx = nodes.get(nxt);
    cr.next = nxt;
    cr.tx = nx.x;
    cr.ty = nx.y;
    cr.moving = true;
  }

  function arrive(cr) {
    if (cr.stage === "enter") {
      sim.deliveries++;
      cr.dest.bumpAt = sim.tick;
      addPopup("delivery", cr.dest.x, cr.dest.y - unit / 2, 1);
      cr.done = true;
      cr.gone = true;
      return;
    }
    cr.node = cr.next;
    cr.next = null;
    cr.stage = "walk";
    cr.moving = false;
    cr.granted = 0;
    const n = nodes.get(cr.node);
    if (isDestNode(n, cr.color)) {
      // arrivée à la porte de l'atelier : elle rejoint sa file de déchargement
      const w = buildingById(n.door);
      w.queue.push(cr);
      cr.done = true;
      cr.gone = true;
    }
  }

  function moveCreature(cr, budget) {
    for (let guard = 0; guard < 8 && budget > 1e-9; guard++) {
      if (!cr.moving) {
        decide(cr);
        if (cr.done || !cr.moving) return;
      }
      const dx = cr.tx - cr.x;
      const dy = cr.ty - cr.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        cr.dx = dx / dist;
        cr.dy = dy / dist;
      }
      let allow = budget;
      if (cr.stage === "walk") {
        const g = leaderGap(cr);
        if (g < INF) allow = Math.min(allow, Math.max(0, g - gapPx(cr))); // pas de dépassement : on reste derrière
        if (isJunction(cr.next) && cr.granted !== cr.next) {
          const lim = dist - T.stop_px; // ligne d'arrêt avant le croisement
          if (lim <= 1e-6) {
            requestEntry(cr);
            cr.wait++;
            return;
          }
          allow = Math.min(allow, lim);
        }
      }
      if (allow <= 1e-9) return;
      if (dist <= allow + 1e-9) {
        cr.x = cr.tx;
        cr.y = cr.ty;
        budget -= dist;
        arrive(cr);
        if (cr.done) return;
      } else {
        cr.x += cr.dx * allow;
        cr.y += cr.dy * allow;
        budget -= allow;
      }
    }
  }

  // Brume : une file de 10 ou plus lance le compteur de 10 s ; il s'arrête quand toutes les files sont redescendues
  // à 7 ou moins (et repart de 10 s au prochain débordement) ; à zéro, la partie s'arrête.
  function updatePanic() {
    let any = false;
    for (const b of sim.buildings) {
      const n = b.kind === "house" ? b.queue : b.queue.length;
      if (n >= PAN.queue_max) b.over = true;
      else if (n <= PAN.release_at) b.over = false;
      if (b.over) any = true;
    }
    const p = sim.panic;
    if (any) {
      p.active = true;
      p.left--;
      if (p.left <= 0) {
        p.left = 0;
        sim.over = true;
        sim.daysHeld = sim.day - 1;
      }
    } else {
      p.active = false;
      p.left = p.total;
    }
  }

  // ---------- Pas de simulation ----------

  sim.step = function () {
    if (sim.over) return;
    sim.tick++;
    sim.noTilesFlash = Math.max(0, sim.noTilesFlash - dt);

    // journée : l'horloge avance d'un pas, les chantiers finissent, puis les apparitions prévues pour ce pas
    sim.dayTick++;
    if (sim.dayTick >= sim.dayTicks) endDay();
    stepSites();
    runSchedule();
    if (sim.gainFx) {
      sim.gainFx.age += dt;
      if (sim.gainFx.age >= TL.gain_fx_s) sim.gainFx = null;
    }

    flush();
    buildOcc();
    grantJunctions();

    for (const b of sim.buildings) {
      if (b.kind === "house") {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.queue++;
          sim.produced++;
          b.timer += spawnInterval(sim.day);
        }
        if (b.cool > 0) b.cool--;
        release(b);
      } else {
        unload(b);
      }
    }

    for (const cr of sim.creatures) {
      cr.px = cr.x;
      cr.py = cr.y;
      cr.age += dt;
      moveCreature(cr, cr.speed * dt);
    }
    if (sim.creatures.some((cr) => cr.done)) sim.creatures = sim.creatures.filter((cr) => !cr.done);

    updatePanic();

    for (const p of sim.popups) p.age += dt;
    if (sim.popups.some((p) => p.age >= popupLife)) sim.popups = sim.popups.filter((p) => p.age < popupLife);

    flush();
  };

  runSchedule(); // les bâtiments prévus à 0 s apparaissent tout de suite, sans chantier
  rebuildDist();
  return sim;
}
