// Point d'entrée : charge les données et les langues, crée l'affichage, la boucle et les écrans.

import { loadLangs, detectLang, hasLang, setLang, getLang, t } from "./i18n.js";
import { loadSave, getSettings, setSetting } from "./save.js";
import { createDisplay } from "./display.js";
import { createInput } from "./input.js";
import { startLoop } from "./loop.js";
import { createLayout } from "./world.js";
import { createTitleScreen } from "./screens/title.js";
import { createPlayScreen } from "./screens/play.js";
import { loadAssets } from "./assets.js";

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} : ${res.status}`);
  return res.json();
}

async function boot() {
  const canvas = document.getElementById("game");
  const [cfg, , assets] = await Promise.all([loadJson("data/balance.json"), loadLangs(), loadAssets()]);

  loadSave();
  const saved = getSettings().lang;
  setLang(hasLang(saved) ? saved : detectLang());

  const display = createDisplay(canvas, cfg.world, cfg.display);
  display.background = cfg.ui.colors.letterbox;
  const layout = createLayout(cfg.world);

  const game = { cfg, display, layout, assets, screen: null, screens: {} };

  game.goto = (name) => {
    game.screen = game.screens[name];
    if (game.screen.enter) game.screen.enter();
  };
  game.setLanguage = (code) => {
    setLang(code);
    setSetting("lang", code);
  };

  game.screens.title = createTitleScreen(game);
  game.screens.play = createPlayScreen(game);
  game.goto("title");
  if (new URLSearchParams(location.search).has("debug")) window.__game = game; // pour les tests dans le navigateur

  createInput(canvas, display, (type, x, y) => game.screen.pointer(type, x, y));

  const loop = startLoop(
    cfg.loop,
    (dt) => game.screen.update(dt),
    (alpha) => {
      display.begin();
      game.screen.render(display.ctx, alpha);
      display.end();
    }
  );

  // pas de rattrapage du temps perdu au retour d'arrière-plan ; l'écran peut se mettre en pause et sauvegarder
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (game.screen && game.screen.hidden) game.screen.hidden();
    } else {
      loop.resetClock();
    }
  });

  document.title = t("game.title");
  document.documentElement.lang = getLang();
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "beforeend",
    '<pre style="color:#fff;padding:16px;white-space:pre-wrap">' + String(err) + "</pre>"
  );
});
