import { ELEMENTS, ITEMS, STAT_LABELS, STATS, WEAPONS } from "./game-data.js";

export function esc(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[ch]);
}

export function statName(id) {
  return STATS.find(stat => stat[0] === id)?.[1] || STAT_LABELS[id] || ELEMENTS[id] || WEAPONS[id] || id;
}

export function fmtBonuses(obj = {}) {
  return Object.entries(obj)
    .map(([key, value]) => `${value >= 0 ? "+" : ""}${value} ${statName(key)}`)
    .join(", ") || "Aucun bonus";
}

export function item(id) {
  return ITEMS.find(entry => entry.id === id);
}

export function notify(text) {
  const toast = document.querySelector("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}
