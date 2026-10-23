// Sauvegarde en localStorage. Identifiants uniquement, jamais de texte traduit.
// Un numéro de version permet de migrer plus tard.

const KEY = "pl_save_v1";
const VERSION = 1;

let data = defaults();

function defaults() {
  return { v: VERSION, settings: { lang: null } };
}

function migrate(raw) {
  const out = defaults();
  if (raw && typeof raw === "object" && raw.settings && typeof raw.settings === "object") {
    Object.assign(out.settings, raw.settings);
  }
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
