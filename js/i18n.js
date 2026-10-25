// Système de langues FR/EN. Tous les textes passent par t("clé").

export const LANGS = ["fr", "en"];
const FALLBACK = "en";

const tables = {};
const warned = new Set();
let current = FALLBACK;

export async function loadLangs() {
  await Promise.all(
    LANGS.map(async (code) => {
      const res = await fetch(`lang/${code}.json`);
      if (!res.ok) throw new Error(`lang/${code}.json : ${res.status}`);
      tables[code] = await res.json();
    })
  );
}

// Français → FR, sinon EN.
export function detectLang() {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function hasLang(code) {
  return LANGS.includes(code) && !!tables[code];
}

export function getLang() {
  return current;
}

export function setLang(code) {
  if (!hasLang(code)) return;
  current = code;
  if (typeof document !== "undefined") {
    document.documentElement.lang = code;
    document.title = t("game.title");
  }
}

export function t(key, params) {
  let text = tables[current] && tables[current][key];
  if (text === undefined) {
    text = tables[FALLBACK] && tables[FALLBACK][key];
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] clé manquante (${current}) : ${key}`);
    }
    if (text === undefined) return key;
  }
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));
  }
  return text;
}

// Texte avec pluriel : cherche « clé.one » (FR : 0 et 1 ; EN : 1) ou « clé.other ». {n} est ajouté aux paramètres.
export function tn(key, n, params = {}) {
  const one = current === "fr" ? n < 2 : n === 1;
  return t(`${key}.${one ? "one" : "other"}`, { ...params, n });
}
