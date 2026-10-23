// Canvas plein écran. Le monde logique (1080 × 1920) est mis à l'échelle pour tenir
// dans l'écran, centré. devicePixelRatio plafonné.

export function createDisplay(canvas, worldCfg, displayCfg) {
  const ctx = canvas.getContext("2d");
  const W = worldCfg.width;
  const H = worldCfg.height;

  const d = {
    canvas,
    ctx,
    width: W,
    height: H,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dpr: 1,
    background: "#000",
  };

  d.resize = function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, displayCfg.dpr_max);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    d.dpr = dpr;
    d.scale = Math.min(w / W, h / H);
    d.offsetX = (w - W * d.scale) / 2;
    d.offsetY = (h - H * d.scale) / 2;
  };

  // Efface tout l'écran, puis place le repère sur le monde logique (rogné à ses bords).
  d.begin = function begin() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = d.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const k = d.scale * d.dpr;
    ctx.setTransform(k, 0, 0, k, d.offsetX * d.dpr, d.offsetY * d.dpr);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
  };

  d.end = function end() {
    ctx.restore();
  };

  // Coordonnées écran (pointer events) → coordonnées du monde logique.
  d.toWorld = function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - d.offsetX) / d.scale,
      y: (clientY - rect.top - d.offsetY) / d.scale,
    };
  };

  window.addEventListener("resize", d.resize);
  window.addEventListener("orientationchange", d.resize);
  d.resize();

  return d;
}
