// Boucle à pas fixe : la simulation avance par pas de 1/sim_hz s,
// le rendu est interpolé avec alpha (0 à 1) entre deux pas.
// Rendu plafonné à max_fps, même sur un écran 120 Hz.

export function startLoop(cfg, update, render) {
  const dt = 1 / cfg.sim_hz;
  const interval = 1000 / cfg.max_fps;
  const tolerance = cfg.fps_tolerance_ms;

  let acc = 0;
  let last = null;
  let nextRender = 0;

  function frame(now) {
    requestAnimationFrame(frame);

    if (last === null) {
      last = now;
      nextRender = now;
      return;
    }
    if (now < nextRender - tolerance) return; // écran plus rapide que le plafond

    nextRender += interval;
    if (nextRender < now - interval) nextRender = now; // on a pris du retard : on recale

    let elapsed = now - last;
    last = now;
    if (elapsed > cfg.max_frame_ms) elapsed = cfg.max_frame_ms; // retour d'arrière-plan, veille

    acc += elapsed / 1000;
    while (acc >= dt) {
      update(dt);
      acc -= dt;
    }
    render(acc / dt);
  }

  requestAnimationFrame(frame);

  return {
    dt,
    // à appeler au retour d'arrière-plan pour ne pas rattraper le temps perdu
    resetClock() {
      last = null;
      acc = 0;
    },
  };
}
