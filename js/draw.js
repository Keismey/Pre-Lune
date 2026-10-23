// Petits outils de dessin partagés par les écrans.

export function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// Coupe un texte en lignes qui tiennent dans maxWidth (la police doit déjà être réglée sur ctx).
export function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Texte centré (ou aligné) avec retour à la ligne automatique et ombre portée facultative.
// opts : font, size, color, weight, align, maxWidth, lineHeight, shadow { color, dy }, alpha
export function drawText(ctx, text, x, y, opts) {
  const {
    font,
    size,
    color,
    weight = 700,
    align = "center",
    maxWidth = Infinity,
    lineHeight = 1.2,
    shadow = null,
    alpha = 1,
  } = opts;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  const lines = Number.isFinite(maxWidth) ? wrapLines(ctx, text, maxWidth) : [text];
  const step = size * lineHeight;
  const top = y - ((lines.length - 1) * step) / 2;

  lines.forEach((line, i) => {
    const ly = top + i * step;
    if (shadow) {
      ctx.fillStyle = shadow.color;
      ctx.fillText(line, x, ly + shadow.dy);
    }
    ctx.fillStyle = color;
    ctx.fillText(line, x, ly);
  });
  ctx.restore();
}
