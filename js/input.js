// Pointer events, un seul doigt à la fois. Le gestionnaire reçoit
// (type, x, y) avec type = "down" | "move" | "up" | "cancel" et x, y en coordonnées du monde.

export function createInput(canvas, display, handler) {
  let active = null;

  function pos(e) {
    return display.toWorld(e.clientX, e.clientY);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (active !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    active = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      // sans capture, les événements continuent tant que le doigt reste sur le canvas
    }
    const p = pos(e);
    handler("down", p.x, p.y);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== active) return;
    const p = pos(e);
    handler("move", p.x, p.y);
    e.preventDefault();
  });

  function end(type) {
    return (e) => {
      if (e.pointerId !== active) return;
      active = null;
      const p = pos(e);
      handler(type, p.x, p.y);
      e.preventDefault();
    };
  }
  canvas.addEventListener("pointerup", end("up"));
  canvas.addEventListener("pointercancel", end("cancel"));

  // pas de menu contextuel sur appui long
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}
