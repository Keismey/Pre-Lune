// Dessin des cadeaux en formes simples (en attendant les images du lot I3) : icônes de la barre, pont, rond-point, flèche
// d'Annuler. Toutes les mesures viennent de balance.json (ui.play.gifts), rien n'est choisi ici.

// Icône d'un cadeau centrée en (cx, cy), `size` de côté. `color` pour les traits, `dark` pour les détails sur fond clair.
export function drawGiftIcon(ctx, kind, cx, cy, size, color, dark) {
  const r = size / 2;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.1;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (kind === "roundabout") {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58);
      ctx.lineTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98);
      ctx.stroke();
    }
  } else if (kind === "bridge") {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.05);
    ctx.lineTo(cx + r, cy - r * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.72, cy - r * 0.05);
    ctx.quadraticCurveTo(cx, cy + r * 1.05, cx + r * 0.72, cy - r * 0.05);
    ctx.stroke();
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.92, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.92, cy - r * 0.55);
    ctx.stroke();
    for (const k of [-0.62, 0, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(cx + r * k, cy - r * 0.55);
      ctx.lineTo(cx + r * k, cy - r * 0.05);
      ctx.stroke();
    }
  } else if (kind === "sack") {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.28, cy - r * 0.5);
    ctx.quadraticCurveTo(cx - r * 1.0, cy + r * 0.1, cx - r * 0.62, cy + r * 0.85);
    ctx.lineTo(cx + r * 0.62, cy + r * 0.85);
    ctx.quadraticCurveTo(cx + r * 1.0, cy + r * 0.1, cx + r * 0.28, cy - r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy - r * 0.52);
    ctx.lineTo(cx + r * 0.4, cy - r * 0.52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.26, cy + r * 0.25);
    ctx.lineTo(cx + r * 0.26, cy + r * 0.25);
    ctx.moveTo(cx, cy - r * 0.01);
    ctx.lineTo(cx, cy + r * 0.51);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Flèche d'Annuler : un arc qui tourne vers la gauche avec une pointe.
export function drawUndoIcon(ctx, cx, cy, size, lineW, color) {
  const r = size / 2;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineW;
  const a0 = -Math.PI * 0.15;
  const a1 = Math.PI * 1.1;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.1, r * 0.78, a0, a1, true);
  ctx.stroke();
  // pointe au bout de l'arc (côté gauche), tournée dans le sens du trait
  const ex = cx + Math.cos(a1) * r * 0.78;
  const ey = cy + r * 0.1 + Math.sin(a1) * r * 0.78;
  ctx.beginPath();
  ctx.moveTo(ex - r * 0.5, ey - r * 0.12);
  ctx.lineTo(ex + r * 0.08, ey + r * 0.62);
  ctx.lineTo(ex + r * 0.5, ey - r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Pont : ombre, tablier en bois avec planches, garde-corps. Dessiné par-dessus les chemins, d'un nœud à l'autre.
export function drawBridge(ctx, a, b, roadW, G, tilePat) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const deckW = roadW * G.deck_w;
  ctx.save();
  ctx.lineCap = "butt";
  ctx.strokeStyle = G.shade;
  ctx.lineWidth = deckW;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + G.shade_dy);
  ctx.lineTo(b.x, b.y + G.shade_dy);
  ctx.stroke();
  ctx.strokeStyle = G.deck_edge;
  ctx.lineWidth = deckW;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = G.deck_fill;
  ctx.lineWidth = deckW - 2 * G.rail_w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  // planches
  ctx.strokeStyle = G.deck_edge;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = G.rail_w / 2;
  const nx = -uy;
  const ny = ux;
  const half = deckW / 2 - G.rail_w;
  for (let d = G.plank_px / 2; d < len; d += G.plank_px) {
    const px = a.x + ux * d;
    const py = a.y + uy * d;
    ctx.beginPath();
    ctx.moveTo(px + nx * half, py + ny * half);
    ctx.lineTo(px - nx * half, py - ny * half);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // garde-corps : deux lignes le long des bords, un peu en retrait des extrémités
  ctx.strokeStyle = G.rail;
  ctx.lineWidth = G.rail_w;
  ctx.lineCap = "round";
  const inset = Math.min(len * 0.12, roadW * 0.5);
  for (const s of [-1, 1]) {
    const o = (deckW / 2 - G.rail_w / 2) * s;
    ctx.beginPath();
    ctx.moveTo(a.x + ux * inset + nx * o, a.y + uy * inset + ny * o);
    ctx.lineTo(b.x - ux * inset + nx * o, b.y - uy * inset + ny * o);
    ctx.stroke();
  }
  ctx.restore();
}

// Rond-point : une couronne de pavés de la largeur d'un chemin autour d'un îlot d'herbe. `rc` est le rayon de sa ligne
// centrale (celui que suivent les créatures).
export function drawRoundabout(ctx, n, roadW, rc, G, tilePat, tileColor) {
  const outer = rc + roadW / 2;
  const island = Math.max(4, rc - roadW / 2);
  ctx.save();
  ctx.fillStyle = G.ring_edge;
  ctx.beginPath();
  ctx.arc(n.x, n.y, outer, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tilePat || tileColor;
  ctx.beginPath();
  ctx.arc(n.x, n.y, outer - G.ring_edge_w, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = G.island_edge;
  ctx.beginPath();
  ctx.arc(n.x, n.y, island + G.ring_edge_w * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = G.island;
  ctx.beginPath();
  ctx.arc(n.x, n.y, island, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
