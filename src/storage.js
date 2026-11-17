const STORAGE_KEY = "retry-rpg-save-v2";

export function loadSave(defaultSave, normalize = value => value) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw?.legacy || raw.run === undefined) return defaultSave();
    return normalize(raw);
  } catch (error) {
    console.warn("Impossible de charger la sauvegarde locale.", error);
    return defaultSave();
  }
}

export function saveGame(save) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  const status = document.querySelector("#save-status");
  if (status) status.textContent = "Sauvegardé à l'instant";
}
