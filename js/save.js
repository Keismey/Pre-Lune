// Sauvegarde en localStorage. Identifiants uniquement, jamais de texte traduit.
// Un numéro de version permet de migrer plus tard (v1 : réglages ; v2 : + partie en cours, tutoriel, records).

const KEY = "pl_save_v1";
const VERSION = 2;

let data = defaults();

function defaults() {
  return {
    v: VERSION,
    settings: { lang: null, cursor_offset: false, assist: true },
    tuto: { draw: false, erase: false, mist: false }, // vrai quand l'étape a été vue
    stats: { best_deliveries: 0, best_days: 0, games: 0 },
    game: null, // partie en cours (sim.serialize()), ou null
  };
}

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

function migrate(raw) {
  const out = defaults();
  if (!isObj(raw)) return out;
  if (isObj(raw.settings)) Object.assign(out.settings, raw.settings);
  if (isObj(raw.tuto)) Object.assign(out.tuto, raw.tuto);
  if (isObj(raw.stats)) Object.assign(out.stats, raw.stats);
  if (isObj(raw.game)) out.game = raw.game;
  return out;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (_) {
    // stockage indisponible : le jeu continue sans sauvegarde
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? migrate(JSON.parse(raw)) : defaults();
  } catch (_) {
    data = defaults();
  }
  return data;
}

export function getSettings() {
  return data.settings;
}

export function setSetting(key, value) {
  data.settings[key] = value;
  persist();
}

// ---------- Partie en cours ----------

export function getGame() {
  return data.game;
}

export function setGame(game) {
  data.game = game;
  persist();
}

export function clearGame() {
  data.game = null;
  persist();
}

// ---------- Tutoriel ----------

export function getTuto() {
  return data.tuto;
}

export function setTuto(key) {
  data.tuto[key] = true;
  persist();
}

// ---------- Records ----------

export function getStats() {
  return data.stats;
}

// Enregistre une partie finie. Renvoie les records d'avant (pour afficher « Nouveau record ! »).
export function recordGame(deliveries, days) {
  const prev = { deliveries: data.stats.best_deliveries, days: data.stats.best_days, games: data.stats.games };
  data.stats.games++;
  data.stats.best_deliveries = Math.max(prev.deliveries, deliveries);
  data.stats.best_days = Math.max(prev.days, days);
  persist();
  return prev;
}
