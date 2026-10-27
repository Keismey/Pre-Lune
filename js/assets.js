// Images du jeu : atlas WebP + découpe (data/sprites.json), textures d'herbe et de chemin, symboles de couleur.
// Les images ne sont jamais indispensables : si l'une manque, l'écran garde ses formes simples.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image introuvable : ${src}`));
    img.src = src;
  });
}

// Charge data/sprites.json et toutes les images qu'il cite. Retourne null si quelque chose manque (le jeu continue
// alors avec ses formes simples).
export async function loadAssets() {
  try {
    const res = await fetch("data/sprites.json");
    if (!res.ok) throw new Error(`data/sprites.json : ${res.status}`);
    const spec = await res.json();
    const imgs = {};
    await Promise.all(Object.entries(spec.atlases).map(async ([name, a]) => (imgs[name] = await loadImage(a.file))));
    return { spec, imgs };
  } catch (err) {
    console.warn("[assets] images indisponibles, formes simples", err);
    return null;
  }
}

// Dessine le sprite `key` ("house.blue", "work.red", "crea.green"), son point d'ancrage en (x, y), à l'échelle `k`.
// Retourne false si le sprite n'existe pas.
export function drawSprite(ctx, assets, key, x, y, k) {
  const s = assets && assets.spec.sprites[key];
  if (!s) return false;
  ctx.drawImage(assets.imgs[s.atlas], s.x, s.y, s.w, s.h, x - s.ax * k, y - s.ay * k, s.w * k, s.h * k);
  return true;
}

// Herbe : la tuile (256 px) se répète telle quelle ; avec `mirror`, elle est posée en 2 x 2 miroirs (période doublée).
// `tilePx` : côté d'une tuile à l'écran, en pixels du monde logique. Retourne un CanvasPattern, ou null.
export function makeGrassPattern(ctx, assets, tilePx, mirror) {
  if (!assets || !assets.imgs.grass) return null;
  const img = assets.imgs.grass;
  if (!mirror) {
    const plain = ctx.createPattern(img, "repeat");
    if (plain && plain.setTransform) plain.setTransform(new DOMMatrix().scale(tilePx / img.width));
    return plain;
  }
  const n = img.width;
  const cv = document.createElement("canvas");
  cv.width = cv.height = n * 2;
  const g = cv.getContext("2d");
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      g.save();
      g.translate(i * n + (i ? n : 0), j * n + (j ? n : 0));
      g.scale(i ? -1 : 1, j ? -1 : 1);
      g.drawImage(img, 0, 0);
      g.restore();
    }
  }
  const pat = ctx.createPattern(cv, "repeat");
  if (pat && pat.setTransform) pat.setTransform(new DOMMatrix().scale((tilePx * 2) / cv.width));
  return pat;
}

// Chemin : motif de pavés répété, posé comme couleur de trait sur le tracé (il suit la courbe, pas la grille).
export function makePathPattern(ctx, assets, tilePx) {
  if (!assets || !assets.imgs.path) return null;
  const img = assets.imgs.path;
  const pat = ctx.createPattern(img, "repeat");
  if (pat && pat.setTransform) pat.setTransform(new DOMMatrix().scale(tilePx / img.width));
  return pat;
}

// Symbole de couleur (accessibilité) : forme pleine crème avec contour, dessinée par le code.
export function symbolPath(ctx, shape, x, y, r) {
  ctx.beginPath();
  switch (shape) {
    case "triangle":
      ctx.moveTo(x, y - r * 1.1);
      ctx.lineTo(x + r * 1.05, y + r * 0.8);
      ctx.lineTo(x - r * 1.05, y + r * 0.8);
      ctx.closePath();
      break;
    case "square":
      ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
      break;
    case "diamond":
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.0, y);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x - r * 1.0, y);
      ctx.closePath();
      break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r * 1.25 : r * 0.55;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
    case "hexagon":
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1);
        else ctx.lineTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1);
      }
      ctx.closePath();
      break;
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

export function drawSymbol(ctx, shape, x, y, r, fill, stroke, lineWidth) {
  symbolPath(ctx, shape, x, y, r);
  ctx.lineJoin = "round";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.stroke();
  ctx.fill();
}
