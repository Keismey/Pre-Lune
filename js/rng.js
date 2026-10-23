// Générateur à graine mulberry32. Jamais Math.random() dans le jeu.
// L'état est lisible et modifiable pour pouvoir le sauvegarder et le restaurer.

export function createRng(seed) {
  let a = seed >>> 0;

  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    // entier dans [0, n[
    int(n) {
      return Math.floor(next() * n);
    },
    // réel dans [min, max[
    range(min, max) {
      return min + next() * (max - min);
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    getState() {
      return a >>> 0;
    },
    setState(state) {
      a = state >>> 0;
    },
  };
}
