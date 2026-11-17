import {
  STATS, RANDOM_NAMES, ELEMENTS, WEAPONS, SLOTS, MASTERY_LEVELS, MASTERY_XP, MASTERY_DOMAINS,
  STAT_LABELS, PASSIVE_LABELS, RES_KEYS, CLASSES, JOBS, ITEMS, ATTACKS, ZONES, STATUS, emptyMastery
} from "./src/game-data.js";
import { loadSave, saveGame } from "./src/storage.js";
import { esc, fmtBonuses, item, notify, statName } from "./src/game-helpers.js";

function newLegacy() {
  return { deaths: 0, abandoned: 0, totalActions: 0, bestAge: 16, goldEarned: 0, unlockedClasses: ["none"], unlockedJobs: ["none"], talents: [], classStatBonuses: {}, history: {}, characters: [], discoveries: [], primalHeart: false };
}
let save = loadSave(defaultSave, normalizeLoadedSave), activeTab = "summary", combat = null;
function defaultSave() { return { schema: 3, legacy: newLegacy(), run: null }; }
function persist() { saveGame(save); }
function qty(id) { return save.run.inventory[id] || 0; }
function addItem(id, amount = 1) { save.run.inventory[id] = qty(id) + amount; }
function removeItem(id, amount = 1) { save.run.inventory[id] = Math.max(0, qty(id) - amount); if (!save.run.inventory[id]) delete save.run.inventory[id]; }
function equippedBonuses() { const out = {}; Object.values(save.run.equipment).forEach(id => Object.entries(item(id)?.bonus || {}).forEach(([k, v]) => out[k] = (out[k] || 0) + v)); return out; }

let activeActionTab = "study";
function ensureSaveShape() {
  save.legacy ||= newLegacy();
  save.legacy.masteryBonuses ||= {};
  save.legacy.talents ||= [];
  save.legacy.classStatBonuses ||= {};
  save.legacy.unlockedClasses ||= ["none"];
  save.legacy.unlockedJobs ||= ["none"];
  normalizeHeritage();
  if (!save.run) return;
  const r = save.run;
  r.stats ||= Object.fromEntries(STATS.map(([id]) => [id, 3]));
  r.maxStats ||= { ...r.stats };
  r.inventory ||= {};
  r.equipment ||= {};
  r.weaponMastery ||= emptyMastery(Object.keys(WEAPONS));
  r.elementMastery ||= emptyMastery(Object.keys(ELEMENTS));
  Object.keys(WEAPONS).forEach(id => r.weaponMastery[id] ||= { xp: 0 });
  Object.keys(ELEMENTS).forEach(id => r.elementMastery[id] ||= { xp: 0 });
  r.techniqueMastery ||= { concentration: 0 };
  r.discoveredZones ||= [];
  r.log ||= [];
  r.learned ||= ["punch"];
  r.learned = r.learned.map(id => id === "slash" ? "punch" : id);
  if (!r.learned.includes("punch")) r.learned.unshift("punch");
  r.equippedAttacks ||= ["punch", null, null, null];
  r.equippedAttacks = r.equippedAttacks.map(id => id === "slash" ? "punch" : id);
  if (!r.equippedAttacks.some(id => id === "punch")) r.equippedAttacks[0] = "punch";
  r.shopStock ||= ["iron-sword", "leather-hood", "health-potion", "old-gem"];
  r.masteryLevels ||= {};
  Object.keys(MASTERY_DOMAINS).forEach(id => { r.masteryLevels[id] = heritageProgress(id, r).level; });
  ensureClassAttack(r);
}
ensureSaveShape();
function inheritedBonuses() {
  const out = {};
  Object.entries(save.legacy.heritageDomains || {}).forEach(([id, domain]) => {
    if (WEAPONS[id] || ELEMENTS[id] || id === "class") return;
    Object.entries(domain.permanent || {}).forEach(([key, value]) => { out[key] = (out[key] || 0) + value; });
  });
  return out;
}
function inheritedDomainBonuses(id) { return save.legacy.heritageDomains?.[id]?.permanent || {}; }
const HERITAGE_RANK_VALUES = {
  sword: [1, 2, 3, 4, 5, 6, 7], axe: [1, 2, 3, 4, 5, 6, 7],
  hammer: [1, 2, 3, 4, 5, 6, 7], spear: [1, 2, 3, 4, 5, 6, 7],
  bow: [1, 2, 3, 4, 5, 6, 7], dagger: [1, 2, 3, 4, 5, 6, 7],
  unarmed: [1, 2, 3, 4, 5, 6, 7], catalyst: [1, 2, 3, 4, 5, 6, 7],
  fire: [1, 2, 3, 4, 5, 6, 7], ice: [1, 2, 3, 4, 5, 6, 7],
  wind: [1, 2, 3, 4, 5, 6, 7], earth: [1, 2, 3, 4, 5, 6, 7],
  class: [1, 2, 3, 4, 5, 6, 7], farmer: [1, 2, 3, 4, 5, 6, 7],
  merchant: [1, 2, 3, 4, 5, 6, 7], scholar: [1, 2, 3, 4, 5, 6, 7],
  blacksmith: [1, 2, 3, 4, 5, 6, 7], concentration: [1, 2, 3, 4, 5, 6, 7]
};
function heritageRankValue(id, rank) {
  if (rank <= 0) return 0;
  const values = HERITAGE_RANK_VALUES[id] || HERITAGE_RANK_VALUES.class;
  return values[Math.max(0, Math.min(values.length - 1, rank - 1))];
}
function heritageProgress(id, run) {
  if (!run) return { xp: 0, level: 0 };
  if (WEAPONS[id]) return { xp: run.weaponMastery?.[id]?.xp || 0, level: level(run.weaponMastery?.[id]?.xp || 0) };
  if (ELEMENTS[id]) return { xp: run.elementMastery?.[id]?.xp || 0, level: level(run.elementMastery?.[id]?.xp || 0) };
  if (CLASSES[id] && id !== "none") {
    return run.classId === id ? { xp: run.classXP || 0, level: level(run.classXP || 0) } : { xp: 0, level: 0 };
  }
  if (id === "class") return { xp: 0, level: 0 };
  if (id === "concentration") return { xp: (run.techniqueMastery?.concentration || 0) * 8, level: level((run.techniqueMastery?.concentration || 0) * 8) };
  return { xp: run.jobId === id ? run.jobXP || 0 : 0, level: level(run.jobId === id ? run.jobXP || 0 : 0) };
}
function heritageAcquired(id, rank) {
  const multiplier = heritageRankValue(id, rank);
  return Object.fromEntries(Object.entries(masteryDomain(id).passive).map(([key, value]) => [key, +(value * multiplier).toFixed(2)]));
}
function addValues(left = {}, right = {}) {
  const result = { ...left };
  Object.entries(right).forEach(([key, value]) => { result[key] = +((result[key] || 0) + value).toFixed(2); });
  return result;
}
function normalizeHeritage() {
  const legacy = save.legacy;
  legacy.heritageDomains ||= {};
  if (legacy.heritageMigrationVersion !== 1) {
    Object.entries(legacy.masteryBonuses || {}).forEach(([id, old]) => {
      if (legacy.heritageDomains[id]) return;
      const migratedValues = { ...(old.values || {}) };
      if (migratedValues.workYield !== undefined) {
        migratedValues.workGold = migratedValues.workYield;
        delete migratedValues.workYield;
      }
      legacy.heritageDomains[id] = {
        currentLevel: 0,
        lastLevel: Number.isFinite(old.level) ? old.level : 0,
        lastXp: Number.isFinite(old.bestXp) ? old.bestXp : 0,
        lastAcquired: {},
        lastCharacter: "",
        permanent: migratedValues
      };
    });
    legacy.heritageMigrationVersion = 1;
  }
  if (legacy.heritageMigrationVersion !== 2) {
    Object.entries(legacy.masteryBonuses || {}).forEach(([id, old]) => {
      const domain = legacy.heritageDomains[id];
      if (!domain || Object.keys(domain.lastAcquired || {}).length) return;
      domain.lastLevel = Number.isFinite(old.level) ? old.level : domain.lastLevel;
      domain.lastXp = Number.isFinite(old.bestXp) ? old.bestXp : domain.lastXp;
      domain.lastAcquired = { ...(domain.permanent || {}) };
    });
    legacy.heritageMigrationVersion = 2;
  }
  Object.keys(MASTERY_DOMAINS).forEach(id => {
    legacy.heritageDomains[id] ||= { currentLevel: 0, lastLevel: 0, lastXp: 0, lastAcquired: {}, lastCharacter: "", permanent: {} };
    const domain = legacy.heritageDomains[id];
    domain.currentLevel = Number.isFinite(domain.currentLevel) ? domain.currentLevel : 0;
    domain.lastLevel = Number.isFinite(domain.lastLevel) ? domain.lastLevel : 0;
    domain.lastXp = Number.isFinite(domain.lastXp) ? domain.lastXp : 0;
    domain.lastAcquired ||= {};
    domain.lastCharacter ||= "";
    domain.permanent ||= {};
  });
}
function historicalLevel(id) {
  return save.legacy.heritageDomains?.[id]?.lastLevel
    || level(save.legacy.masteryBonuses?.[id]?.bestXp || 0);
}
function historicalClassJobLevels() {
  return Object.keys(CLASSES)
    .filter(id => id !== "none")
    .reduce((total, id) => total + historicalLevel(id), 0) + Object.keys(JOBS)
    .filter(id => id !== "none")
    .reduce((total, id) => total + historicalLevel(id), 0);
}
function recordLegacyMasteriesDeterministically(run) {
  normalizeHeritage();
  Object.keys(MASTERY_DOMAINS).forEach(id => {
    const progress = heritageProgress(id, run);
    const acquired = heritageAcquired(id, progress.level);
    const domain = save.legacy.heritageDomains[id];
    domain.currentLevel = 0;
    if (progress.level > domain.lastLevel || (progress.level === domain.lastLevel && progress.xp > domain.lastXp)) {
      domain.lastLevel = progress.level;
      domain.lastXp = progress.xp;
      domain.lastAcquired = acquired;
      domain.lastCharacter = run.name || "Personnage sans nom";
    }
    domain.permanent = heritageAcquired(id, domain.lastLevel);
  });
  save.legacy.masteryBonuses = Object.fromEntries(Object.entries(save.legacy.heritageDomains).map(([id, domain]) => [id, { level: domain.lastLevel, bestXp: domain.lastXp, values: { ...domain.permanent } }]));
}
function masteryDomain(id) { return MASTERY_DOMAINS[id] || { label: id, source: "Autres", passive: {} }; }
function masteryValue(id, xp) {
  const rank = level(xp);
  return Object.fromEntries(Object.entries(masteryDomain(id).passive).map(([key, value]) => [key, +(value * rank).toFixed(2)]));
}
function fmtPassiveValues(values) {
  return Object.entries(values).map(([key, value]) => `${value >= 0 ? "+" : ""}${value} ${STAT_LABELS[key] || PASSIVE_LABELS[key] || key}`).join(", ") || "Aucun effet";
}
function recordLegacyMasteries(r) {
  const domains = [...Object.entries(r.weaponMastery || {}), ...Object.entries(r.elementMastery || {}), ["class", { xp: r.classXP || 0 }], ...Object.entries({ farmer: r.jobId === "farmer" ? { xp: r.jobXP || 0 } : { xp: 0 }, merchant: r.jobId === "merchant" ? { xp: r.jobXP || 0 } : { xp: 0 }, scholar: r.jobId === "scholar" ? { xp: r.jobXP || 0 } : { xp: 0 }, blacksmith: r.jobId === "blacksmith" ? { xp: r.jobXP || 0 } : { xp: 0 } }), ["concentration", { xp: (r.techniqueMastery?.concentration || 0) * 8 }]];
  domains.forEach(([id, mastery]) => {
    if (!masteryDomain(id) || level(mastery.xp) < 1) return;
    const values = masteryValue(id, mastery.xp);
    const existing = save.legacy.masteryBonuses[id];
    if (!existing || level(existing.bestXp) < level(mastery.xp)) save.legacy.masteryBonuses[id] = { bestXp: mastery.xp, level: level(mastery.xp), values };
  });
}
function masteryRows() {
  const current = save.run ? [...Object.entries(save.run.weaponMastery), ...Object.entries(save.run.elementMastery), ["class", { xp: save.run.classXP }], [save.run.jobId, { xp: save.run.jobXP }], ["concentration", { xp: (save.run.techniqueMastery?.concentration || 0) * 8 }]] : [];
  return Object.entries(MASTERY_DOMAINS).map(([id, domain]) => {
    const active = current.find(([key]) => key === id)?.[1]?.xp || 0;
    const inherited = save.legacy.masteryBonuses[id];
    return `<article class="mastery-card"><header><strong>${domain.label}</strong><span class="tag">${domain.source}</span></header><p>${id === "concentration" ? "Régénération et efficacité de récupération du mana." : `Bonus permanent : ${fmtPassiveValues(domain.passive)} par rang.`}</p><small class="muted">Progression actuelle : ${MASTERY_LEVELS[level(active)]} (${active} XP) · Hérité : ${inherited ? `${MASTERY_LEVELS[inherited.level]} · ${fmtPassiveValues(inherited.values)}` : "aucun"}</small></article>`;
  }).join("");
}
function deterministicMasteryRows() {
  return Object.entries(MASTERY_DOMAINS).filter(([id]) => id !== "class").map(([id, domain]) => {
    const active = heritageProgress(id, save.run);
    const inherited = save.legacy.heritageDomains[id];
    const total = inherited.permanent || {};
    if (inherited.lastLevel <= 0) return "";
    const effect = fmtPassiveValues(total);
    return `<article class="mastery-card"><header><strong>${domain.label}</strong><span class="tag">${domain.source}</span></header><p>Meilleur rang atteint : <b>${MASTERY_LEVELS[inherited.lastLevel]}</b> · par ${esc(inherited.lastCharacter || "Personnage historique")}</p><small class="muted">Effet concret : ${effect}</small></article>`;
  }).join("");
}
masteryRows = deterministicMasteryRows;
function actionButton(activity, id, extra) {
  return `<article class="action-card"><h3>${activity.name}</h3><p>${activity.description}</p><small class="muted">${extra || fmtBonuses(activity.gains)} · 1 an</small><button class="primary-button" data-action="${id}">Effectuer</button></article>`;
}
function actionsMarkup() {
  const subTabs = [["study", "Études"], ["training", "Entraînement"], ["exploration", "Exploration"], ["work", "Travailler"], ["rest", "Se reposer"]];
  const controls = `<div class="subtabs">${subTabs.map(([id, name]) => `<button class="tab ${activeActionTab === id ? "active" : ""}" data-action-tab="${id}">${name}</button>`).join("")}</div>`;
  let content = "";
  if (activeActionTab === "study") content = studyMarkup();
  if (activeActionTab === "training") content = trainingMarkup();
  if (activeActionTab === "exploration") content = explorationMarkup();
  if (activeActionTab === "work") content = `<div class="panel"><h2>Travailler</h2><p class="muted">Les revenus et le rendement progressent avec la maîtrise du métier.</p><div class="action-grid">${actionButton({ name: `Travail de ${JOBS[save.run.jobId].name}`, description: `Rendement estimé : ${estimatedWork()} or.`, gains: {} }, "work", `${estimatedWork()} or · maîtrise ${masteryText({ xp: save.run.jobXP })}`)}</div></div>`;
  if (activeActionTab === "rest") content = `<div class="panel"><h2>Se reposer</h2><p class="muted">Récupère les PV et le mana et peut guérir une maladie.</p><div class="action-grid">${actionButton({ name: "Repos réparateur", description: "Récupération avec une chance de guérison.", gains: {} }, "rest", "PV +18 · mana +12 · 1 an")}</div></div>`;
  return `<div class="panel"><h2>Actions</h2><p class="muted">Chaque action principale fait avancer le personnage d'une année. Les cinq sous-onglets regroupent toutes les activités.</p>${controls}</div>${content}`;
}
function level(xp) { return Math.max(0, Math.min(MASTERY_LEVELS.length - 1, MASTERY_XP.reduce((n, threshold) => xp >= threshold ? n + 1 : n, 0) - 1)); }
function masteryText(data) { return `${MASTERY_LEVELS[level(data.xp)]} (${data.xp} XP)`; }
function growthXp(base, domainId) { return +(base + historicalLevel(domainId) * .5).toFixed(2); }
function log(text) { save.run.log.unshift(`${save.run.age} ans : ${text}`); save.run.log = save.run.log.slice(0, 60); }
function unlockChecks() {
  const before = [...save.legacy.unlockedClasses, ...save.legacy.unlockedJobs];
  Object.entries(CLASSES).forEach(([id, c]) => { if (!save.legacy.unlockedClasses.includes(id) && c.unlock({ run: save.run, legacy: save.legacy })) { save.legacy.unlockedClasses.push(id); log(`Connaissance acquise : classe ${c.name} débloquée.`); notify(`${c.name} débloqué !`); } });
  Object.entries(JOBS).forEach(([id, j]) => { if (!save.legacy.unlockedJobs.includes(id) && j.unlock({ run: save.run, legacy: save.legacy })) { save.legacy.unlockedJobs.push(id); log(`Métier débloqué : ${j.name}.`); notify(`${j.name} débloqué !`); } });
  if (save.legacy.primalHeart && !save.legacy.unlockedClasses.includes("primordial")) save.legacy.unlockedClasses.push("primordial");
  return before.length !== save.legacy.unlockedClasses.length + save.legacy.unlockedJobs.length;
}
function optionMarkup(data, available, group, current = "none") { return Object.entries(data).filter(([, v]) => !v.hidden || available.includes(Object.keys(data).find(id => data[id] === v))).map(([id, v]) => { const ok = available.includes(id); return `<label class="option ${ok ? "" : "locked"}"><input type="radio" name="${group}" value="${id}" ${id === current ? "checked" : ""} ${ok ? "" : "disabled"}><span><strong>${v.name}${ok ? "" : " 🔒"}</strong><small>${ok ? v.description : "Condition non remplie pendant cette run."}</small></span></label>`; }).join(""); }
function renderCreate() {
  document.querySelector("#create-screen").classList.toggle("hidden", Boolean(save.run)); document.querySelector("#game-screen").classList.toggle("hidden", !save.run);
  if (save.run) return renderGame();
  document.querySelector("#class-options").innerHTML = optionMarkup(CLASSES, save.legacy.unlockedClasses, "class");
  document.querySelector("#job-options").innerHTML = optionMarkup(JOBS, save.legacy.unlockedJobs, "job");
  const tags = [...save.legacy.unlockedClasses.filter(id => id !== "none").map(id => CLASSES[id].name), ...save.legacy.unlockedJobs.filter(id => id !== "none").map(id => JOBS[id].name), ...save.legacy.talents.map(t => t.name)];
  document.querySelector("#legacy-preview").innerHTML = tags.length ? `<div class="tag-list">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : "<p>Aucun héritage encore. La première vie commence sans spécialisation.</p>";
}
function startLife(e) {
  e.preventDefault(); const data = new FormData(e.target), r = newRun(); r.classId = data.get("class"); r.jobId = data.get("job");
  const enteredName = String(data.get("name") || "").trim();
  r.name = enteredName || RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  r.maxStats = { ...r.stats };
  save.legacy.talents.filter(t => !t.classId || t.classId === r.classId).forEach(t => { r.stats[t.stat] += t.amount; }); r.talents = [...save.legacy.talents];
  const classStatBonus = save.legacy.classStatBonuses[r.classId];
  if (classStatBonus && CLASSES[r.classId].stat) r.stats[CLASSES[r.classId].stat] += classStatBonus;
  Object.values(save.legacy.masteryBonuses || {}).forEach(domain => Object.entries(domain.values || {}).forEach(([key, value]) => { if (STATS.some(([id]) => id === key)) r.stats[key] += value; }));
  const cls = CLASSES[r.classId], job = JOBS[r.jobId]; if (cls.stat) r.stats[cls.stat]++; if (job.stat) r.stats[job.stat]++;
  r.maxStats = { ...r.stats };
  save.run = r; log("Naissance. Les héritages accélèrent l'apprentissage de cette génération."); persist(); renderCreate();
}
function advanceYear() {
  const r = save.run; r.age++; r.actions++; save.legacy.totalActions++; r.hp = Math.min(r.maxHp, r.hp + totals().lifeRegen); r.mana = Math.min(totals().maxMana, r.mana + totals().manaRegen);
  if (r.age % 5 === 0) refreshShop(); if (Math.random() < Math.max(.03, .14 - totals().constitution * .006)) contractDisease(); progressDisease(); if (r.age >= lifeExpectancy() - 3 && Math.random() < .08 + (r.age - (lifeExpectancy() - 3)) * .1) die("Le vieillissement probabiliste vous emporte.");
  r.maxStats = { ...r.maxStats }; Object.keys(r.stats).forEach(k => r.maxStats[k] = Math.max(r.maxStats[k], r.stats[k])); unlockChecks(); persist();
}
function gainStat(key, amount = .1) { save.run.stats[key] = Math.min(20, save.run.stats[key] + amount); }
function gainClassXp(base) {
  if (!save.run || save.run.classId === "none" || base <= 0) return 0;
  const gained = growthXp(base, save.run.classId);
  const beforeLevel = level(save.run.classXP);
  save.run.classXP += gained;
  if (level(save.run.classXP) > beforeLevel) log(`Niveau de classe atteint : ${masteryText({ xp: save.run.classXP })}.`);
  return gained;
}
function gainJobXp(base) {
  if (!save.run || save.run.jobId === "none" || base <= 0) return 0;
  const gained = growthXp(base, save.run.jobId);
  const beforeLevel = level(save.run.jobXP);
  save.run.jobXP += gained;
  if (level(save.run.jobXP) > beforeLevel) log(`Niveau de métier atteint : ${masteryText({ xp: save.run.jobXP })}.`);
  return gained;
}
function completeAction(text, gains = {}) {
  advanceYear(); if (!save.run) return;
  const beforeStats = { ...save.run.stats };
  Object.entries(gains).forEach(([k, v]) => gainStat(k, v));
  const classStat = CLASSES[save.run.classId]?.stat;
  const classGain = classStat && gains[classStat] ? gainClassXp(gains[classStat]) : 0;
  const details = Object.entries(gains)
    .filter(([key]) => STATS.some(([id]) => id === key) && save.run.stats[key] !== beforeStats[key])
    .map(([key]) => `+${(save.run.stats[key] - beforeStats[key]).toFixed(2)} ${statName(key)}`);
  if (classGain) details.push(`+${classGain} XP de classe`);
  unlockChecks(); log(`${text}${details.length ? ` · ${details.join(" · ")}` : ""}`); persist(); renderGame();
}
function contractDisease() { if (save.run.diseases.length) return; const names = [["Rhume", "Légère", 1], ["Fièvre des marais", "Modérée", 2], ["Peste grise", "Grave", 3]]; const d = names[Math.floor(Math.random() * names.length)]; save.run.diseases.push({ name: d[0], severity: d[1], progression: d[2] }); log(`Maladie contractée : ${d[0]} (${d[1]}).`); }
function progressDisease() { save.run.diseases.forEach(d => { if (Math.random() < .35) { d.progression++; if (d.progression >= 4 && d.severity !== "Critique") { d.severity = d.severity === "Légère" ? "Modérée" : d.severity === "Modérée" ? "Grave" : "Critique"; d.progression = 0; log(`${d.name} s'aggrave : gravité ${d.severity}.`); } if (d.severity === "Critique" && Math.random() < .28) die(`La maladie ${d.name} devient mortelle.`); } }); }
function rest() { advanceYear(); if (!save.run) return; const r = save.run; r.hp = Math.min(r.maxHp, r.hp + 18); r.mana = Math.min(totals().maxMana, r.mana + 12); if (r.diseases.length && Math.random() < .45) { const healed = r.diseases.shift(); log(`Repos efficace : ${healed.name} est guérie.`); } else log("Repos : récupération partielle."); persist(); renderGame(); }
function estimatedWork() { const r = save.run, job = JOBS[r.jobId]; return Math.round(job.work * (1 + level(r.jobXP) * .12) + (r.jobId === "merchant" ? Math.floor(r.gold * .03) : 0) + (inheritedDomainBonuses(r.jobId).workGold || 0)); }
function explore() { const roll = Math.random(); let id = roll < .08 ? "ember" : roll < .2 ? "old-gem" : roll < .4 ? "ore" : roll < .55 ? "health-potion" : null; if (id) { addItem(id); save.run.itemsFound++; if (item(id).kind === "material") save.run.materials++; return `Découverte (${item(id).rarity}) : ${item(id).name} x1.`; } return "La zone explorée ne révèle rien d'utile."; }
function refreshShop() { const candidates = ITEMS.filter(i => i.price && i.kind !== "special"); const shuffled = candidates.sort(() => Math.random() - .5); save.run.shopStock = shuffled.slice(0, 6).map(i => i.id); log("Le commerce se renouvelle pour les cinq prochaines années."); }
function classJobMarkup() {
  const r = save.run, cls = CLASSES[r.classId], job = JOBS[r.jobId];
  const classChoices = save.legacy.unlockedClasses
    .filter(id => id !== r.classId && id !== "none" && canChangeClass(id))
    .map(id => `<button class="mini-button" data-select-class="${id}">${CLASSES[id].name}</button>`).join("");
  const jobChoices = save.legacy.unlockedJobs
    .filter(id => id !== r.jobId && id !== "none")
    .map(id => `<button class="mini-button" data-select-job="${id}">${JOBS[id].name}</button>`).join("");
  return `<div class="two-columns"><div class="panel"><h2>Classe et progression</h2><p><b>${cls.name}</b> · ${cls.description}</p><div class="summary-list"><div>Maîtrise actuelle : <b>${masteryText({ xp: r.classXP })}</b></div><div>Bonus actif : <b>${cls.stat ? `+${fmtBonuses({ [cls.stat]: 1 })}` : "aucun"}</b></div><div>Techniques propres : <b>${r.classId === "none" ? "aucune" : "progression spécifique à la classe"}</b></div></div><h3>Classes disponibles</h3><div class="tag-list">${classChoices || "<span class=\"empty\">Aucune autre classe ou évolution disponible.</span>"}</div></div><div class="panel"><h2>Métier et maîtrise</h2><p><b>${job.name}</b> · ${job.description}</p><div class="summary-list"><div>Niveau actuel : <b>${masteryText({ xp: r.jobXP })}</b></div><div>XP : <b>${r.jobXP} / ${MASTERY_XP[6]}</b></div><div>Effet travail : <b>${job.work} or de base</b></div></div><h3>Métiers disponibles</h3><div class="tag-list">${jobChoices || "<span class=\"empty\">Aucun autre métier disponible.</span>"}</div></div></div>`;
}
function equipmentList() { return Object.entries(SLOTS).map(([slot, name]) => `<div class="summary-list"><div>${name} : <b>${item(save.run.equipment[slot])?.name || "Aucun"}</b></div></div>`).join(""); }
function summaryMarkup() { const r = save.run, s = totals(); return `<div class="dashboard"><div class="panel"><p class="eyebrow">Run actuelle</p><h2>${esc(r.name)} <span class="muted">— ${CLASSES[r.classId].name} (${masteryText({ xp: r.classXP })}) — ${JOBS[r.jobId].name} (${masteryText({ xp: r.jobXP })})</span></h2><div class="summary-list"><div>Âge : <b>${r.age} ans</b> · Espérance estimée : <b>${lifeExpectancy()} ans</b></div><div>Actions : <b>${r.actions}</b> · Richesse : <b class="price">${r.gold} or</b></div></div><div class="stat-grid">${STATS.map(([id,name]) => `<div class="stat"><span>${name}</span><strong>${s[id].toFixed(1)}</strong><div class="meter"><i style="width:${Math.min(100,s[id]*5)}%"></i></div></div>`).join("")}</div><h3>Secondaires et résistances</h3><div class="tag-list">${Object.entries(STAT_LABELS).map(([id,name]) => `<span class="tag">${name} : ${Number(s[id]).toFixed(1)}</span>`).join("")}</div></div><div class="panel"><h3>Vitalité</h3><div class="summary-list"><div class="hp">PV ${Math.ceil(r.hp)} / ${r.maxHp}</div><div class="bar"><i style="width:${r.hp/r.maxHp*100}%"></i></div><div class="mana">Mana ${Math.ceil(r.mana)} / ${Math.ceil(s.maxMana)}</div><div class="bar"><i style="width:${r.mana/s.maxMana*100}%"></i></div></div><h3>Maladies et statuts</h3>${r.diseases.length ? r.diseases.map(d => `<p class="danger">${d.name} · ${d.severity} · progression ${d.progression}/4</p>`).join("") : "<p class=\"good\">Aucune maladie.</p>"}${r.statuses.length ? `<p>${r.statuses.map(x => STATUS[x] || x).join(", ")}</p>` : ""}<h3>Équipement</h3>${equipmentList()}</div></div>`; }
function marketMarkup() { const r = save.run; return `<div class="panel"><h2>Commerce</h2><p class="muted">Stock actuel · renouvellement à ${r.age % 5 === 0 ? "présent" : `${5 - r.age % 5} an(s)`}. Les quantités sont cumulables.</p><div class="item-grid">${r.shopStock.map(id => marketCard(item(id))).join("")}</div></div>`; }
function marketCard(i) { const owned = qty(i.id); return `<article class="item-card"><header><strong>${i.name}</strong><span class="price">${i.price} or</span></header><small class="muted">${i.rarity} · ${i.kind === "equipment" ? "Équipement" : i.kind === "consumable" ? i.description : i.description || "Objet spécial"}</small><small class="muted">Possédé : ${owned} · Revente : ${i.sell} or</small><button class="mini-button" data-buy="${i.id}" ${save.run.gold < i.price ? "disabled" : ""}>Acheter</button></article>`; }
function inventoryMarkup() { const ids = Object.keys(save.run.inventory); return `<div class="panel"><h2>Inventaire</h2><p class="muted">Équipements et objets de valeur peuvent être possédés en plusieurs exemplaires. Les consommables sont utilisés selon leur quantité.</p><div class="item-grid">${ids.length ? ids.map(id => inventoryCard(item(id), qty(id))).join("") : "<p class=\"empty\">Inventaire vide.</p>"}</div></div>`; }
function inventoryCard(i, count) { if (!i) return ""; const equipped = Object.values(save.run.equipment).includes(i.id); const req = Object.entries(i.req || {}).filter(([k,v]) => totals()[k] < v).map(([k,v]) => `${statName(k)} ${v}`); return `<article class="item-card"><header><strong>${i.name}</strong><span class="tag">x${count}</span></header><small class="muted">${i.rarity} · ${i.kind} · ${i.sell} or à la vente</small>${i.bonus ? `<p>${fmtBonuses(i.bonus)}</p>` : `<p>${i.description || ""}</p>`}${i.kind === "equipment" ? `<small class="muted">Prérequis : ${req.join(", ") || "aucun"}</small><button class="mini-button" data-equip="${i.id}" ${req.length ? "disabled" : ""}>${equipped ? "Déséquiper" : "Équiper"}</button>` : i.kind === "consumable" ? `<button class="mini-button" data-use="${i.id}">Utiliser</button>` : ""}<button class="secondary-button" data-sell="${i.id}">Vendre (${i.sell} or)</button></article>`; }
function equipmentMarkup() { return `<div class="panel"><h2>Équipement · 9 emplacements</h2><p class="muted">Les prérequis sont exclusivement statistiques. Les bonus sont recalculés immédiatement.</p><div class="item-grid">${Object.entries(SLOTS).map(([slot,name]) => { const id = save.run.equipment[slot], i = item(id); return `<article class="item-card"><strong>${name}</strong><p>${i ? `${i.name}<br>${fmtBonuses(i.bonus)}` : "Aucun objet équipé"}</p>${i ? `<button class="mini-button" data-equip="${i.id}">Retirer</button>` : ""}</article>`; }).join("")}</div></div>`; }
function statsMarkup() {
  const r = save.run;
  const slots = r.equippedAttacks.map((id, index) => `<article class="attack-slot" data-attack-slot="${index}">${id ? `<strong>${ATTACKS.find(a => a.id === id)?.name || id}</strong><button class="mini-button" data-remove-attack-slot="${index}">Retirer</button>` : "<span class=\"muted\">Emplacement vide</span>"}</article>`).join("");
  const learned = r.learned.map(id => `<article class="attack-card" draggable="true" data-drag-attack="${id}"><strong>${ATTACKS.find(a => a.id === id)?.name || id}</strong><small>Glisser vers un emplacement</small></article>`).join("");
  return `<div class="two-columns"><div class="panel"><h2>Statistiques de combat</h2><h3>Maîtrises d'armes</h3><table><tbody>${Object.entries(r.weaponMastery).map(([id,d]) => `<tr><td>${WEAPONS[id]}</td><td>${masteryText(d)}</td></tr>`).join("")}</tbody></table></div><div class="panel"><h2>Maîtrises élémentaires</h2><table><tbody>${Object.entries(r.elementMastery).map(([id,d]) => `<tr><td>${ELEMENTS[id]}</td><td>${masteryText(d)}</td></tr>`).join("")}</tbody></table></div><div class="panel"><h2>Emplacements d'attaques</h2><p class="muted">Glissez une attaque apprise dans un emplacement, ou retirez-la avec son bouton.</p><div class="attack-slots">${slots}</div><h3>Attaques apprises</h3><div class="attack-grid">${learned}</div></div><div class="panel"><h2>Talents conditionnels</h2><div class="tag-list">${["Riposte", "Berserker", "Prédateur", "Instinct élémentaire", "Dernier souffle"].map(t => `<span class="tag">${t}</span>`).join("")}</div></div></div>`;
}
function combatMarkup() { if (combat) return combatMarkupActive(); return `<div class="panel"><h2>Combat</h2><p class="muted">Choisissez une zone pour lancer immédiatement un combat. Les combats sont indépendants de l'exploration.</p><div class="inline-actions"><label>Mode<select id="combat-mode"><option value="manual">Manuel</option><option value="auto" ${localStorage.getItem("retry-combat-mode") === "auto" ? "selected" : ""}>Automatique</option></select></label></div><div class="zone-grid">${ZONES.map(zone => zoneCard(zone, "combat")).join("")}</div></div>`; }
function combatMarkupActive() { const c = combat, e = c.enemy; return `<div class="panel"><div class="combat-head"><div><h2>${e.name}</h2><p class="hp">PV ${Math.max(0,e.hp)} / ${e.maxHp}</p><div class="bar"><i style="width:${Math.max(0,e.hp/e.maxHp*100)}%"></i></div><p>Résistances : ${Object.entries(e.res).map(([k,v]) => `${statName(RES_KEYS[k])} ${v}%`).join(" · ")}</p></div><div><h3>${save.run.name}</h3><p class="hp">PV ${Math.ceil(save.run.hp)} / ${save.run.maxHp}</p><p class="mana">Mana ${Math.ceil(save.run.mana)} / ${Math.ceil(totals().maxMana)}</p><p>Mode : <b>${c.mode === "auto" ? "Automatique" : "Manuel"}</b> · Tour ${c.turn}</p></div></div>${c.mode === "manual" ? `<h3>Choisir une attaque</h3><div class="attack-grid">${save.run.equippedAttacks.map(id => attackCard(ATTACKS.find(a => a.id === id))).join("")}</div>` : `<div class="notice">L'automatisation choisit une attaque adaptée à vos PV, votre mana et les résistances ennemies.<br><button class="primary-button" data-auto-turn>Résoudre le tour automatique</button></div>`}<div class="battle-log">${c.log.map(x => `<p>${esc(x)}</p>`).join("")}</div></div>`; }
function attackCard(a) { if (!a) return `<article class="attack-card locked"><strong>Emplacement vide</strong><p>Aucune technique équipée.</p></article>`; return `<article class="attack-card"><strong>${a.name}</strong><small>${a.damage || a.type} · puissance ${a.power} · Précision : ${a.accuracy} · ${a.mana} mana</small><p>${a.desc}</p><button class="mini-button" data-attack="${a.id}" ${save.run.mana < a.mana ? "disabled" : ""}>Utiliser</button></article>`; }
function legacyMarkup() { const l = save.legacy; return `<div class="two-columns"><div class="panel"><h2>Héritage</h2><div class="summary-list"><div>Runs terminées : <b>${l.deaths}</b></div><div>Runs abandonnées : <b>${l.abandoned}</b></div><div>Âge record : <b>${l.bestAge} ans</b></div><div>Or gagné : <b>${l.goldEarned}</b></div></div><h3>Classes débloquées</h3><div class="tag-list">${l.unlockedClasses.map(id => `<span class="tag">${CLASSES[id].name}</span>`).join("")}</div><h3>Métiers débloqués</h3><div class="tag-list">${l.unlockedJobs.map(id => `<span class="tag">${JOBS[id].name}</span>`).join("")}</div></div><div class="panel"><h2>Connaissances transmises</h2><p class="muted">Chaque bonus accélère l'apprentissage sans donner automatiquement le niveau.</p>${l.talents.length ? `<table><thead><tr><th>Domaine</th><th>Bonus</th><th>Source</th></tr></thead><tbody>${l.talents.map(t => `<tr><td>${t.name}</td><td>+${t.amount} ${statName(t.stat)} à la création</td><td>${t.source || "Lignée"}</td></tr>`).join("")}</tbody></table>` : "<p class=\"empty\">Aucun talent transmis : atteignez un niveau remarquable avant de mourir.</p>"}</div><div class="panel"><h2>Historique des personnages</h2>${l.characters.length ? `<table><thead><tr><th>Personnage</th><th>Statistiques principales</th><th>Classe / métier</th><th>Fin</th></tr></thead><tbody>${l.characters.map(c => `<tr><td>${esc(c.name)}</td><td>${STATS.map(([id, name]) => `${name} ${Number(c.stats?.[id] || 0).toFixed(1)}`).join("<br>")}</td><td>Classe : ${CLASSES[c.classId].name} (${c.classLevel})<br>Métier : ${JOBS[c.jobId].name} (${c.jobLevel})</td><td>${c.age} ans</td></tr>`).join("")}</tbody></table>` : "<p class=\"empty\">Les personnages terminés apparaîtront ici.</p>"}</div></div>`; }
function buy(id) { const i = item(id); if (!i || save.run.gold < i.price) return; save.run.gold -= i.price; addItem(id); log(`Achat : ${i.name} x1.`); persist(); renderGame(); }
function sell(id) { const i = item(id); if (!i || !qty(id)) return; removeItem(id); save.run.gold += i.sell * (save.run.jobId === "merchant" ? 1.1 : 1); log(`Vente : ${i.name} x1.`); persist(); renderGame(); }
function useItem(id) { const i = item(id); if (!i || !qty(id)) return; const r = save.run; removeItem(id); if (i.effect.hp) r.hp = Math.min(r.maxHp, r.hp + i.effect.hp); if (i.effect.mana) r.mana = Math.min(totals().maxMana, r.mana + i.effect.mana); if (i.effect.stat) { gainStat(i.effect.stat, i.effect.amount); log(`Utilisation : ${i.name} · +${i.effect.amount} ${statName(i.effect.stat)}.`); } else log(`Utilisation : ${i.name}.`); if (i.id === "health-potion" && r.diseases.length && Math.random() < .2) r.diseases.shift(); persist(); renderGame(); }
function equip(id) { const i = item(id); if (!i || i.kind !== "equipment") return; const req = Object.entries(i.req || {}).some(([k,v]) => totals()[k] < v); if (req) return notify("Prérequis statistiques non atteint."); const old = save.run.equipment[i.slot]; if (old === id) delete save.run.equipment[i.slot]; else save.run.equipment[i.slot] = id; log(`${old === id ? "Retrait" : "Équipement"} : ${i.name}.`); persist(); renderGame(); }
function classEvolutionBase(id) {
  if (["knight", "lancer", "archer"].includes(id)) return "warrior";
  if (["fireMage", "iceMage", "primordial"].includes(id)) return "mage";
  return null;
}
function canChangeClass(id) {
  const target = CLASSES[id], base = classEvolutionBase(id);
  return Boolean(target && save.legacy.unlockedClasses.includes(id) && (save.run.classId === "none" || (target.hidden && (!base || base === save.run.classId))));
}
function chooseClass(id) {
  const target = CLASSES[id];
  const isEvolution = Boolean(target?.hidden && save.run.classId !== "none");
  if (!target || save.run.classId === id || !canChangeClass(id)) return;
  save.run.classId = id;
  save.run.classXP = 0;
  ensureClassAttack(save.run);
  log(`${isEvolution ? "Évolution" : "Classe"} choisie pendant la run : ${target.name}.`);
  persist();
  renderGame();
}
function chooseJob(id) { if (save.run.jobId !== "none" || !save.legacy.unlockedJobs.includes(id)) return; save.run.jobId = id; save.run.jobXP += 1; log(`Métier choisi pendant la run : ${JOBS[id].name}.`); persist(); renderGame(); }
function setAttack(id) { if (!save.run.learned.includes(id) || save.run.equippedAttacks.includes(id)) return; const slot = save.run.equippedAttacks.findIndex(value => !value); if (slot < 0) return notify("Tous les emplacements sont occupés."); equipAttackToSlot(id, slot); }
function equipAttackToSlot(id, slot) {
  if (!save.run.learned.includes(id) || slot < 0 || slot >= save.run.equippedAttacks.length) return;
  const previous = save.run.equippedAttacks.findIndex(value => value === id);
  if (previous >= 0) save.run.equippedAttacks[previous] = null;
  save.run.equippedAttacks[slot] = id;
  log(`Attaque équipée : ${ATTACKS.find(a => a.id === id)?.name} dans l'emplacement ${slot + 1}.`);
  persist();
  renderGame();
}
function removeAttackFromSlot(slot) {
  if (slot < 0 || slot >= save.run.equippedAttacks.length) return;
  const id = save.run.equippedAttacks[slot];
  if (!id) return;
  save.run.equippedAttacks[slot] = null;
  log(`Attaque retirée : ${ATTACKS.find(a => a.id === id)?.name}.`);
  persist();
  renderGame();
}
function ensureClassAttack(run) {
  const attack = ATTACKS.find(a => a.classId === run.classId);
  if (attack && !run.learned.includes(attack.id)) run.learned.push(attack.id);
}
function gainMastery(kind, id, amount = 1) {
  const d = save.run[kind][id], beforeLevel = level(d.xp);
  d.xp += amount;
  const unlocks = kind === "elementMastery" ? { fire: ["fire"], ice: ["ice"], wind: ["wind"], earth: ["earth"] } : { sword: ["pierce"], spear: ["shot"], hammer: ["smash"], bow: ["shot"], catalyst: ["wind"], dagger: ["pierce"] };
  const technique = unlocks[id]?.[0];
  if (technique && d.xp >= 8 && !save.run.learned.includes(technique)) { save.run.learned.push(technique); log(`Technique débloquée : ${ATTACKS.find(a => a.id === technique)?.name}.`); }
  const label = kind === "weaponMastery" ? WEAPONS[id] : ELEMENTS[id];
  if (level(d.xp) > beforeLevel) log(`Niveau de compétence atteint : ${label} · ${masteryText(d)}.`);
  return amount;
}
function gainElement(id, amount) { gainMastery("elementMastery", id, amount); }
function studyElement(id) { advanceYear(); if (!save.run) return; gainMastery("elementMastery", id, 3); unlockChecks(); log(`Étude ciblée du ${ELEMENTS[id]} : affinité travaillée activement.`); persist(); renderGame(); }
function enemyFor(zone) { const hp = 42 + zone.difficulty * 18; return { name: zone.enemy[Math.floor(Math.random() * zone.enemy.length)], hp, maxHp: hp, defense: 4 + zone.difficulty * 2, speed: 8 + zone.difficulty, res: { slash: zone.difficulty * 2, pierce: zone.difficulty, blunt: Math.max(0, zone.difficulty - 2), fire: zone.difficulty % 3 === 0 ? 28 : 5, ice: zone.difficulty % 4 === 0 ? 25 : 5, wind: 5, earth: zone.difficulty % 2 ? 18 : 4, magic: zone.difficulty * 2 }, statuses: [] }; }
function chooseAttack(id) { if (!combat || combat.finished) return; const a = ATTACKS.find(x => x.id === id); resolveRound(a); }
function autoTurn() { if (!combat || combat.finished) return; const e = combat.enemy; const usable = save.run.equippedAttacks.filter(Boolean).map(id => ATTACKS.find(a => a.id === id)).filter(a => a && save.run.mana >= a.mana); let a = usable.find(x => x.type === "heal" && save.run.hp < save.run.maxHp * .42) || usable.filter(x => x.type !== "heal").sort((x,y) => ((y.power || 0) - (e.res[y.damage] || 0)) - ((x.power || 0) - (e.res[x.damage] || 0)))[0] || usable[0]; resolveRound(a || ATTACKS[0]); }
function resolveRound(a) { if (!a || !combat) return; const r = save.run, e = combat.enemy, inherited = inheritedBonuses(), weaponLegacy = inheritedDomainBonuses(a.weapon), elementLegacy = inheritedDomainBonuses(a.element); let line = `Tour ${combat.turn} : ${a.name}.`; const cost = Math.max(0, Math.ceil(a.mana * (1 - (inherited.manaEfficiency || 0) / 100))); if (r.mana < cost) return notify("Mana insuffisant."); r.mana -= cost; if (a.classId === r.classId) { const classXp = gainClassXp(.25); line += ` +${classXp} XP de classe.`; log(`Attaque de ${CLASSES[r.classId].name} : +${classXp} XP de classe.`); } if (a.type === "heal") { const heal = 16 + totals().magicPower * .4; r.hp = Math.min(r.maxHp, r.hp + heal); line += ` Soin de ${Math.round(heal)} PV.`; } else if (a.type === "buff") { r.statuses.push("guard"); line += " Protection active."; } else { if (Math.random() * 100 > a.accuracy + (totals().accuracy - 80) + (weaponLegacy.accuracy || 0)) line += " L'attaque échoue."; else { let damage = a.power + (a.type === "magic" ? totals().magicPower + (elementLegacy.magicPower || 0) : totals().strength * .7) + (weaponLegacy.damage || 0) + (inherited.damage || 0); if (r.hp < r.maxHp * .3) { damage *= 1.15; line += " Berserker augmente les dégâts."; } if (e.hp < e.maxHp * .25) { damage *= 1.12; line += " Prédateur profite de la faiblesse."; } const resist = e.res[a.damage] || 0; damage *= Math.max(.2, 1 - resist / 100); const critical = Math.random() * 100 < totals().crit; if (critical) damage *= totals().critDamage / 100; damage = Math.max(1, Math.round(damage)); e.hp -= damage; line += ` ${damage} dégâts${critical ? " critiques" : ""} (${resist}% résistance appliquée).`; if (a.weapon) { const masteryGain = gainMastery("weaponMastery", a.weapon, 1); log(`Attaque avec ${WEAPONS[a.weapon]} : +${masteryGain} XP de compétence.`); } if (a.status?.length) { e.statuses.push(...a.status); line += ` ${a.status.map(x => STATUS[x]).join(", ")}.`; } } } combat.log.unshift(line); if (e.hp <= 0) return finishCombat(true); const enemyDamage = Math.max(1, Math.round(5 + combat.zone.difficulty * 2 - totals().defense * .18)); r.hp -= r.statuses.includes("guard") ? Math.round(enemyDamage * .55) : enemyDamage; combat.log.unshift(`${e.name} inflige ${enemyDamage} dégâts.`); if (r.hp <= 0 && Math.random() < .12) { r.hp = 1; combat.log.unshift("Dernier souffle : vous survivez à l'attaque mortelle."); } if (r.hp <= 0) return finishCombat(false); combat.turn++; persist(); renderGame(); if (combat.mode === "auto") setTimeout(autoTurn, 100); }
function die(reason) {
  const r = save.run;
  log(reason);
  save.legacy.deaths++;
  recordLegacyMasteries(r);
  save.legacy.bestAge = Math.max(save.legacy.bestAge, r.age);
  Object.entries(r.maxStats).forEach(([k, v]) => save.legacy.history[k] = Math.max(save.legacy.history[k] || 0, v));
  const classLevel = r.classId === "none" ? 0 : historicalLevel(r.classId);
  if (r.classId !== "none" && CLASSES[r.classId].stat) {
    save.legacy.classStatBonuses[r.classId] = Math.max(save.legacy.classStatBonuses[r.classId] || 0, Math.min(.9, .25 + classLevel * .1));
  }
  const talents = [{ name: `Connaissances de ${JOBS[r.jobId].name}`, stat: JOBS[r.jobId].stat }].filter(t => t.stat);
  talents.forEach(t => { if (!save.legacy.talents.some(x => x.name === t.name)) save.legacy.talents.push({ ...t, amount: .25, source: r.name }); });
  save.legacy.characters.unshift({ name: r.name, stats: { ...r.stats }, classId: r.classId, jobId: r.jobId, age: r.age, classLevel: masteryText({ xp: r.classXP }), jobLevel: masteryText({ xp: r.jobXP }), achievements: [...r.learned], discoveries: r.itemsFound, reason });
  save.legacy.characters = save.legacy.characters.slice(0, 20);
  save.run = null;
  combat = null;
  persist();
  renderCreate();
  notify("La run est terminée. Une nouvelle génération peut naître.");
}
function abandonLife() { if (!save.run || !confirm("Mettre fin à cette run sans compter une mort ?")) return; save.legacy.abandoned++; save.run = null; combat = null; persist(); renderCreate(); }
document.querySelector("#create-form").addEventListener("submit", startLife);
document.querySelector("#new-life").addEventListener("click", abandonLife);
document.querySelector("#game-screen").addEventListener("click", e => { const t = e.target.closest("[data-tab]"), a = e.target.closest("[data-action]"), es = e.target.closest("[data-element-study]"), b = e.target.closest("[data-buy]"), s = e.target.closest("[data-sell]"), u = e.target.closest("[data-use]"), eq = e.target.closest("[data-equip]"), ez = e.target.closest("[data-explore-zone]"), cz = e.target.closest("[data-combat-zone]"), at = e.target.closest("[data-attack]"), sa = e.target.closest("[data-set-attack]"), cc = e.target.closest("[data-select-class]"), cj = e.target.closest("[data-select-job]"); if (t) { activeTab = t.dataset.tab; renderGame(); } if (a) doAction(a.dataset.action); if (es) studyElement(es.dataset.elementStudy); if (b) buy(b.dataset.buy); if (s) sell(s.dataset.sell); if (u) useItem(u.dataset.use); if (eq) equip(eq.dataset.equip); if (ez) exploreZone(ez.dataset.exploreZone); if (cz) startCombat(cz.dataset.combatZone, true); if (at) chooseAttack(at.dataset.attack); if (sa) setAttack(sa.dataset.setAttack); if (cc) chooseClass(cc.dataset.selectClass); if (cj) chooseJob(cj.dataset.selectJob); if (e.target.closest("[data-auto-turn]")) autoTurn(); });
document.querySelector("#game-screen").addEventListener("change", e => { if (e.target.id === "combat-mode") { localStorage.setItem("retry-combat-mode", e.target.value); renderGame(); } });
renderCreate();

/* The activity catalogue keeps the three action areas extensible without
   coupling their definitions to the tab renderer. */
const STUDIES = [
  { id: "general", name: "Études générales", description: "Lire, observer et structurer les connaissances.", gains: { knowledge: .25, magic: .2 }, available: () => true },
  { id: "mana", name: "Étude sur le mana", description: "Comprendre les flux de mana et préparer les techniques arcaniques.", gains: { magic: .35, knowledge: .15 }, available: r => ["mage", "fireMage", "iceMage", "primordial"].includes(r.classId) },
  ...Object.entries(ELEMENTS).map(([id, name]) => ({ id: `element-${id}`, name: `Étude élémentaire : ${name}`, description: `Développer uniquement l'affinité ${name} et ses évolutions.`, element: id, gains: { knowledge: .1 }, available: r => r.classId === "mage" }))
];
const TRAINING = [
  { id: "physical", category: "Développement physique", name: "Développement physique", description: "Renforcer Force, Agilité et Constitution.", gains: { strength: .22, agility: .16, constitution: .22 } },
  ...Object.entries(WEAPONS).filter(([id]) => id !== "unarmed").map(([id, name]) => ({ id: `weapon-${id}`, category: "Techniques de combat", name: `S'entraîner : ${name}`, description: `Améliorer la maîtrise des ${name.toLowerCase()} et débloquer des techniques.`, weapon: id, requiresWarrior: true, gains: { strength: .1, agility: .1 } })),
  { id: "concentration", category: "Techniques magiques", name: "Concentration de mana", description: "Développer une technique qui améliore durablement la régénération du mana.", magicOnly: true, gains: { magic: .2, concentration: 1 } }
];
function runState() {
  const r = save.run;
  r.discoveredZones ||= [];
  r.techniqueMastery ||= { concentration: 0 };
  r.weaponMastery ||= emptyMastery(Object.keys(WEAPONS));
  r.elementMastery ||= emptyMastery(Object.keys(ELEMENTS));
  return r;
}
function newRun() {
  const r = { age: 16, actions: 0, gold: 40, hp: 100, maxHp: 100, mana: 30, classId: "none", jobId: "none", stats: Object.fromEntries(STATS.map(([id]) => [id, 3 + Math.floor(Math.random() * 3)])), maxStats: Object.fromEntries(STATS.map(([id]) => [id, 3])), diseases: [], statuses: [], inventory: { "health-potion": 1 }, equipment: {}, weaponMastery: emptyMastery(Object.keys(WEAPONS)), elementMastery: emptyMastery(Object.keys(ELEMENTS)), techniqueMastery: { concentration: 0 }, discoveredZones: [], classXP: 0, jobXP: 0, explorations: 0, studyActions: 0, workActions: 0, itemsFound: 0, materials: 0, shopSeed: 0, shopStock: ["iron-sword", "leather-hood", "health-potion", "old-gem"], learned: ["punch"], equippedAttacks: ["punch", null, null, null], log: [] };
  return r;
}
function normalizeLoadedSave(raw) {
  if (raw.schema !== 3) raw.schema = 3;
  if (raw.run) {
    raw.run.discoveredZones ||= [];
    raw.run.techniqueMastery ||= { concentration: 0 };
    raw.run.weaponMastery ||= emptyMastery(Object.keys(WEAPONS));
    raw.run.elementMastery ||= emptyMastery(Object.keys(ELEMENTS));
  }
  return raw;
}
function availableStudies() { return STUDIES.filter(study => study.available(save.run)); }
function hasWeaponInInventory(weapon) {
  return ITEMS.some(i => i.kind === "equipment" && i.weapon === weapon && qty(i.id) > 0);
}
function isWarriorClass(id) {
  return id === "warrior" || Boolean(CLASSES[id]?.weapon);
}
function availableTraining() {
  return TRAINING
    .filter(activity => !activity.requiresWarrior || isWarriorClass(save.run.classId))
    .filter(activity => !activity.weapon || hasWeaponInInventory(activity.weapon))
    .filter(activity => !activity.magicOnly || ["mage", "fireMage", "iceMage", "primordial"].includes(save.run.classId));
}
function activityCard(activity, action, extra = "") {
  return `<article class="action-card"><h3>${activity.name}</h3><p>${activity.description}</p><small class="muted">${extra || fmtBonuses(activity.gains)}${extra?.endsWith("1 an") ? "" : " · 1 an"}</small><button class="primary-button" data-action="${action}">Effectuer</button></article>`;
}
function actionMarkup() {
  const studyGroups = Object.entries(availableStudies().reduce((groups, study) => { const key = study.element ? "Études élémentaires" : "Études disponibles"; (groups[key] ||= []).push(study); return groups; }, {}));
  const studies = studyGroups.map(([title, entries]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${entries.map(study => activityCard(study, `study:${study.id}`, study.element ? `${masteryText(save.run.elementMastery[study.element])} · +${study.gains.knowledge} Savoir` : fmtBonuses(study.gains))).join("")}</div></section>`).join("");
  const training = Object.entries(availableTraining().reduce((groups, activity) => { (groups[activity.category] ||= []).push(activity); return groups; }, {})).map(([title, entries]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${entries.map(activity => activityCard(activity, `train:${activity.id}`, activity.weapon ? `${masteryText(save.run.weaponMastery[activity.weapon])} · ${fmtBonuses(activity.gains)}` : activity.id === "concentration" ? `Niveau ${save.run.techniqueMastery.concentration} · régénération +${save.run.techniqueMastery.concentration * .5}` : fmtBonuses(activity.gains))).join("")}</div></section>`).join("");
  return `<div class="panel"><h2>Études</h2><p class="muted">Les activités affichées dépendent des connaissances et de la classe actuelle. Une étude élémentaire ne progresse que l'élément choisi.</p>${studies}</div><div class="panel"><h2>Entraînement</h2><p class="muted">Chaque activité fait progresser uniquement ses domaines et avance l'âge d'une année.</p>${training}</div><div class="panel"><h2>Autres activités</h2><div class="action-grid">${activityCard({ name: "Travailler", description: `Gagner environ ${estimatedWork()} or.`, gains: {} }, "work", `${estimatedWork()} or · 1 an`)}${activityCard({ name: "Se reposer", description: "Récupérer des PV et du mana, avec une chance de guérison.", gains: {} }, "rest", "Récupération · 1 an")}</div></div>`;
}
function explorationMarkup() {
  const r = runState(), s = totals();
  return `<div class="panel"><h2>Exploration</h2><p class="muted">Explorez les zones pour découvrir des ressources. Les combats se lancent exclusivement depuis le menu Combat.</p><div class="zone-grid">${ZONES.map(zone => zoneCard(zone, "explore")).join("")}</div></div>`;
}
function zoneCard(z, mode = "explore") {
  const r = runState(), s = totals(), req = z.req ? z.req.stat ? `${statName(z.req.stat)} ${z.req.value}` : `${ELEMENTS[z.req.element]} niveau ${z.req.value}` : "aucun";
  const locked = z.req && (z.req.stat ? s[z.req.stat] < z.req.value : level(r.elementMastery[z.req.element]?.xp || 0) < z.req.value);
  const discovered = r.discoveredZones.includes(z.id);
  const encounter = Math.round(Math.max(.05, Math.min(.65, .18 + z.difficulty * .045 - s.agility * .012)) * 100);
  const action = mode === "combat" ? `data-combat-zone="${z.id}"` : `data-explore-zone="${z.id}"`;
  const label = mode === "combat" ? "Combattre" : discovered ? "Explorer" : "Explorer la zone";
  const details = mode === "combat" ? `Difficulté ${z.difficulty} · Prérequis : ${req}` : `Ressources : ${z.reward.map(id => item(id).name).join(", ")} · Prérequis : ${req}`;
  return `<article class="zone-card ${locked ? "locked" : ""}"><header><strong>${z.name}</strong><span class="tag">${discovered ? "Découverte" : "Inconnue"} · Difficulté ${z.difficulty}</span></header><p>${z.description}<br><span class="muted">Ennemis : ${z.enemy.join(", ")}</span></p><small class="muted">${details}${mode === "combat" ? "" : `<br>Risque de rencontre : aucun`}</small><button class="primary-button" ${action} ${locked ? "disabled" : ""}>${label}</button></article>`;
}
function renderGame() {
  const tabs = [["summary", "Résumé"], ["study", "Études"], ["training", "Entraînement"], ["exploration", "Exploration"], ["classjob", "Classes / métiers"], ["market", "Commerce"], ["inventory", "Inventaire"], ["equipment", "Équipement"], ["combat", "Combat"], ["stats", "Stats combat"], ["legacy", "Héritage"]];
  const views = { summary: summaryMarkup, study: studyMarkup, training: trainingMarkup, exploration: explorationMarkup, classjob: classJobMarkup, market: marketMarkup, inventory: inventoryMarkup, equipment: equipmentMarkup, combat: combatMarkup, stats: statsMarkup, legacy: legacyMarkup };
  document.querySelector("#tabs").innerHTML = tabs.map(([id, name]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`).join("");
  document.querySelector("#tab-content").innerHTML = views[activeTab]();
  document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join("");
}
function studyMarkup() {
  const groups = Object.entries(availableStudies().reduce((out, study) => { const key = study.element ? "Études élémentaires" : "Études disponibles"; (out[key] ||= []).push(study); return out; }, {}));
  return `<div class="panel"><h2>Études</h2><p class="muted">Les études accessibles dépendent de la classe et des connaissances du personnage.</p>${groups.map(([title, studies]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${studies.map(study => activityCard(study, `study:${study.id}`, study.element ? `${masteryText(save.run.elementMastery[study.element])} · +${study.gains.knowledge} Savoir` : fmtBonuses(study.gains))).join("")}</div></section>`).join("")}</div>`;
}
function trainingMarkup() {
  const groups = Object.entries(availableTraining().reduce((out, activity) => { (out[activity.category] ||= []).push(activity); return out; }, {}));
  return `<div class="panel"><h2>Entraînement</h2><p class="muted">Chaque catégorie affiche les gains et la progression attendue. Les techniques de classe et magiques apparaissent après leur déblocage.</p>${groups.map(([title, activities]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${activities.map(activity => activityCard(activity, `train:${activity.id}`, activity.weapon ? `${masteryText(save.run.weaponMastery[activity.weapon])} · ${fmtBonuses(activity.gains)}` : activity.id === "concentration" ? `Niveau ${save.run.techniqueMastery.concentration} · régénération +${save.run.techniqueMastery.concentration * .5}` : fmtBonuses(activity.gains))).join("")}</div></section>`).join("")}</div><div class="panel"><h2>Autres activités</h2><div class="action-grid">${activityCard({ name: "Travailler", description: `Gagner environ ${estimatedWork()} or.`, gains: {} }, "work", `${estimatedWork()} or · 1 an`)}${activityCard({ name: "Se reposer", description: "Récupérer des PV et du mana.", gains: {} }, "rest", "Récupération · 1 an")}</div></div>`;
}
function doAction(id) {
  const r = runState();
  if (id.startsWith("study:")) {
    const study = STUDIES.find(x => x.id === id.slice(6));
    if (!study || !study.available(r)) return notify("Cette étude n'est pas encore accessible.");
    r.studyActions++;
    if (study.element) gainMastery("elementMastery", study.element, 3);
    return completeAction(`${study.name} : ${fmtBonuses(study.gains)}.`, study.gains);
  }
  if (id.startsWith("train:")) {
    const activity = TRAINING.find(x => x.id === id.slice(6));
    if (!activity || !availableTraining().includes(activity)) return notify("Cet entraînement n'est pas accessible.");
    if (activity.weapon) gainMastery("weaponMastery", activity.weapon, 2);
    if (activity.id === "concentration") r.techniqueMastery.concentration++;
    return completeAction(`${activity.name} : ${fmtBonuses(activity.gains)}.`, Object.fromEntries(Object.entries(activity.gains).filter(([key]) => key !== "classXP")));
  }
  if (id === "work") {
    const job = JOBS[r.jobId], earnings = Math.round(job.work * (1 + level(r.jobXP) * .12) + (r.jobId === "merchant" ? Math.floor(r.gold * .03) : 0));
    advanceYear(); if (!save.run) return; r.gold += earnings; save.legacy.goldEarned += earnings; r.workActions++; if (r.jobId !== "none") r.jobXP += growthXp(2, r.jobId); if (job.stat) gainStat(job.stat, .2); log(`Travail de ${job.name} : +${earnings} or.`); persist(); return renderGame();
  }
  if (id === "rest") return rest();
}
function exploreZone(zoneId) {
  const z = ZONES.find(x => x.id === zoneId); if (!z) return;
  const r = runState(), s = totals();
  const locked = z.req && (z.req.stat ? s[z.req.stat] < z.req.value : level(r.elementMastery[z.req.element].xp || 0) < z.req.value);
  if (locked) return notify("Cette zone n'est pas encore accessible.");
  if (!r.discoveredZones.includes(z.id)) { r.discoveredZones.push(z.id); save.legacy.discoveries = [...new Set([...(save.legacy.discoveries || []), z.id])]; }
  r.explorations++;
  const reward = Math.random() < .7 ? z.reward[Math.floor(Math.random() * z.reward.length)] : null;
  if (reward) { addItem(reward); r.itemsFound++; if (item(reward).kind === "material") r.materials++; }
  completeAction(reward ? `Exploration de ${z.name} : ${item(reward).name} trouvé.` : `Exploration de ${z.name} : aucune ressource trouvée.`, { agility: .2, luck: .15 });
}
function startCombat(zoneId, force = false) {
  const z = ZONES.find(x => x.id === zoneId); if (!z) return;
  const r = runState(), s = totals();
  if (!r.discoveredZones.includes(z.id)) { r.discoveredZones.push(z.id); save.legacy.discoveries = [...new Set([...(save.legacy.discoveries || []), z.id])]; }
  const chance = Math.max(.05, Math.min(.65, .18 + z.difficulty * .045 - s.agility * .012));
  r.explorations++;
  if (!force && Math.random() >= chance) {
    const reward = Math.random() < .5 ? z.reward[0] : null;
    if (reward) { addItem(reward); r.itemsFound++; if (item(reward).kind === "material") r.materials++; }
    const result = reward ? `Exploration de ${z.name} sans combat : ${item(reward).name} x1 trouvé.` : `Exploration de ${z.name} sans combat : aucune ressource trouvée.`;
    return completeAction(result, { agility: .2, luck: .15 });
  }
  combat = { zone: z, enemy: enemyFor(z), mode: document.querySelector("#combat-mode")?.value || "manual", turn: 1, log: [`Entrée dans ${z.name}. Une rencontre survient (${Math.round(chance * 100)}%).`], finished: false };
  localStorage.setItem("retry-combat-mode", combat.mode); renderGame(); if (combat.mode === "auto") setTimeout(autoTurn, 80);
}
function finishCombat(win) {
  const r = save.run, z = combat.zone, e = combat.enemy; combat.finished = true;
  if (!win) { combat.log.unshift(`Défaite dans ${z.name} contre ${e.name}.`); log(`Défaite dans ${z.name} contre ${e.name}.`); return die("Vos blessures de combat sont mortelles."); }
  const reward = z.reward[Math.floor(Math.random() * z.reward.length)], gained = [];
  addItem(reward); r.itemsFound++; if (item(reward).kind === "material") r.materials++; gained.push(`${item(reward).name} x1`);
  const classXp = gainClassXp(2);
  combat.log.unshift(`Victoire dans ${z.name} contre ${e.name}.`);
  combat.log.unshift(`Récompenses réellement obtenues : ${gained.join(", ")}${classXp ? ` · +${classXp} XP de classe` : ""}.`);
  log(`Combat remporté dans ${z.name} contre ${e.name} : ${gained.join(", ")}${classXp ? ` ; +${classXp} XP de classe` : ""}.`);
  advanceYear(); if (!save.run) return; combat = null; persist(); renderGame();
}
function totals() {
  const c = save.run, eq = equippedBonuses(), s = { ...c.stats };
  Object.entries(eq).forEach(([k, v]) => s[k] = (s[k] || 0) + v);
  const inherited = inheritedBonuses();
  return { ...s, accuracy: 80 + s.agility * 2 + (eq.accuracy || 0) + (inherited.accuracy || 0), evasion: 3 + s.agility + (eq.evasion || 0) + (inherited.evasion || 0), crit: 3 + s.luck * .4 + (eq.crit || 0), critDamage: 150 + s.strength * 2 + (eq.critDamage || 0), attackSpeed: 10 + s.agility + (eq.attackSpeed || 0), defense: s.constitution * 2 + (eq.defense || 0) + (inherited.defense || 0), lifeRegen: Math.floor(s.constitution / 5) + (eq.lifeRegen || 0) + (inherited.lifeRegen || 0), maxMana: 25 + s.magic * 4 + s.knowledge * 2 + (eq.maxMana || 0), manaRegen: 2 + Math.floor(s.magic / 5) + (eq.manaRegen || 0) + (c.techniqueMastery?.concentration || 0) * .5 + (inherited.manaRegen || 0), magicPower: s.magic * 2 + s.knowledge + (eq.magicPower || 0) + (inherited.magicPower || 0), magicResistance: s.magic + s.knowledge / 2 + (eq.magicResistance || 0), slashRes: Math.floor(s.constitution / 2) + (eq.slashRes || 0), pierceRes: Math.floor(s.agility / 2) + (eq.pierceRes || 0), bluntRes: Math.floor(s.strength / 3) + (eq.bluntRes || 0) + (inherited.bluntRes || 0), fireRes: Math.floor(s.magic / 3) + (eq.fireRes || 0) + (inherited.fireRes || 0), iceRes: Math.floor(s.magic / 3) + (eq.iceRes || 0) + (inherited.iceRes || 0), windRes: Math.floor(s.agility / 3) + (eq.windRes || 0) + (inherited.windRes || 0), earthRes: Math.floor(s.constitution / 3) + (eq.earthRes || 0) + (inherited.earthRes || 0), damage: inherited.damage || 0 };
}

function finalDoAction(id) {
  const r = save.run;
  if (id.startsWith("study:")) {
    const type = id.slice(6);
    const study = STUDIES.find(activity => activity.id === type);
    if (!study || !study.available(r)) return notify("Cette étude n'est pas encore accessible.");
    const masteryGain = type.startsWith("element-") ? gainMastery("elementMastery", type.slice(8), 3) : 0;
    r.studyActions++;
    return completeAction(`Étude accomplie${masteryGain ? ` : +${masteryGain} XP de compétence.` : "."}`, study.gains);
  }
  if (id.startsWith("train:")) {
    const type = id.slice(6);
    const activity = TRAINING.find(entry => entry.id === type);
    if (!activity || !availableTraining().includes(activity)) return notify("Cet entraînement n'est pas accessible.");
    const masteryGain = type.startsWith("weapon-") ? gainMastery("weaponMastery", type.slice(7), 2) : 0;
    if (type === "concentration") r.techniqueMastery.concentration++;
    const gains = Object.fromEntries(Object.entries(activity.gains).filter(([key]) => key !== "concentration"));
    return completeAction(`Entraînement accompli${masteryGain ? ` : +${masteryGain} XP de compétence.` : "."}`, gains);
  }
  if (id === "explore") { r.explorations++; const found = Math.random() < .7 ? ["ore", "old-gem", "health-potion"][Math.floor(Math.random() * 3)] : null; if (found) { addItem(found); r.itemsFound++; } return completeAction(found ? `Exploration : ${item(found).name} trouvé.` : "Exploration : rien trouvé.", { agility: .2, luck: .15 }); }
  if (id === "work") { const job = JOBS[r.jobId], earnings = estimatedWork(), jobXp = gainJobXp(2); r.gold += earnings; save.legacy.goldEarned += earnings; r.workActions++; return completeAction(`Travail de ${job.name} : +${earnings} or${jobXp ? ` · +${jobXp} XP de métier` : ""}.`, job.stat ? { [job.stat]: .2 } : {}); }
  if (id === "rest") return rest();
}
function lifeExpectancy() {
  const r = save.run;
  return 30 + historicalClassJobLevels() * .5;
}
function finalRenderGame() {
  ensureSaveShape();
  Object.entries(save.legacy.heritageDomains).forEach(([id, domain]) => {
    if (domain.lastLevel > 0) domain.permanent = heritageAcquired(id, domain.lastLevel);
  });
  const tabs = [["summary", "Résumé"], ["actions", "Actions"], ["classjob", "Classes / métiers"], ["market", "Commerce"], ["inventory", "Inventaire"], ["equipment", "Équipement"], ["combat", "Combat"], ["stats", "Stats combat"], ["legacy", "Héritage"]];
  const views = { summary: summaryMarkup, actions: actionsMarkup, classjob: classJobMarkup, market: marketMarkup, inventory: inventoryMarkup, equipment: equipmentMarkup, combat: combatMarkup, stats: statsMarkup, legacy: legacyMarkup };
  document.querySelector("#tabs").innerHTML = tabs.map(([id, name]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`).join("");
  document.querySelector("#tab-content").innerHTML = (views[activeTab] || actionsMarkup)();
  document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join("");
}
function finalTrainingMarkup() {
  const activities = availableTraining();
  const weapons = activities.filter(activity => activity.weapon).map(activity => actionButton({ name: activity.name, description: activity.description, gains: activity.gains }, `train:${activity.id}`, `${masteryText(save.run.weaponMastery[activity.weapon])} · ${fmtPassiveValues(masteryDomain(activity.weapon).passive)}`)).join("");
  const physical = activities.find(activity => activity.id === "physical");
  const concentration = activities.find(activity => activity.id === "concentration");
  return `<div class="panel"><h2>Entraînement</h2><p class="muted">Les armes nécessitent un équipement possédé et une classe de Guerrier ou une évolution martiale. La progression de classe vient des statistiques associées ou des combats.</p><div class="action-grid">${physical ? actionButton(physical, "train:physical") : ""}${weapons}${concentration ? actionButton(concentration, "train:concentration", `Niveau ${save.run.techniqueMastery.concentration} · héritage : ${fmtPassiveValues(masteryDomain("concentration").passive)}`) : ""}</div></div>`;
}
trainingMarkup = finalTrainingMarkup;
function characterHistoryMarkup() {
  const characters = save.legacy.characters || [];
  if (!characters.length) return "<p class=\"empty\">Les personnages terminés apparaîtront ici.</p>";
  return `<table><thead><tr><th>Personnage</th><th>Statistiques principales</th><th>Classe / métier</th><th>Fin</th></tr></thead><tbody>${characters.map(c => `<tr><td>${esc(c.name)}</td><td>${STATS.map(([id, name]) => `${name} ${Number(c.stats?.[id] || 0).toFixed(1)}`).join("<br>")}</td><td>Classe : ${CLASSES[c.classId].name} (${c.classLevel})<br>Métier : ${JOBS[c.jobId].name} (${c.jobLevel})</td><td>${c.age} ans</td></tr>`).join("")}</tbody></table>`;
}
function finalLegacyMarkup() {
  return `<div class="panel"><h2>Héritage évolutif</h2><p class="muted">Chaque domaine conserve le meilleur rang atteint au cours des vies précédentes. Les effets affichés correspondent à ce meilleur rang.</p><div class="item-grid">${masteryRows()}</div></div><div class="panel"><h2>Historique</h2><p class="muted">${save.legacy.deaths} mort(s), ${save.legacy.abandoned} vie(s) abandonnée(s), record : ${save.legacy.bestAge} ans.</p>${characterHistoryMarkup()}</div>`;
}
legacyMarkup = finalLegacyMarkup;
function finalSummaryMarkup() {
  const r = save.run, s = totals(), equipment = equippedBonuses();
  return `<div class="dashboard"><div class="panel"><p class="eyebrow">Run actuelle</p><h2>${esc(r.name)} <span class="muted">· ${r.age} ans</span></h2><p>Classe : <b>${CLASSES[r.classId].name}</b> · ${masteryText({ xp: r.classXP })}<br>Métier : <b>${JOBS[r.jobId].name}</b> · ${masteryText({ xp: r.jobXP })}</p><p class="muted">Espérance de vie de base : 30 ans · Bonus historiques des niveaux : +${(historicalClassJobLevels() * .5).toFixed(1)} ans · Total : ${lifeExpectancy()} ans</p><div class="stat-grid">${STATS.map(([id, name]) => `<div class="stat"><span>${name}</span><strong>${s[id].toFixed(1)} (${(equipment[id] || 0).toFixed(1)})</strong></div>`).join("")}</div><p class="hp">PV ${Math.round(r.hp)} / ${r.maxHp}</p><div class="bar"><i style="width:${Math.max(0, Math.min(100, r.hp / r.maxHp * 100))}%"></i></div><p class="mana">Mana ${Math.round(r.mana)} / ${Math.round(s.maxMana)}</p><div class="bar"><i style="width:${Math.max(0, Math.min(100, r.mana / s.maxMana * 100))}%"></i></div></div><div class="panel"><h2>Passifs hérités</h2><div class="item-grid">${masteryRows()}</div></div></div>`;
}
summaryMarkup = finalSummaryMarkup;
recordLegacyMasteries = recordLegacyMasteriesDeterministically;
renderGame = finalRenderGame;
doAction = finalDoAction;
persist();
document.querySelector("#game-screen").addEventListener("click", e => {
  const actionTab = e.target.closest("[data-action-tab]");
  if (actionTab) { activeActionTab = actionTab.dataset.actionTab; activeTab = "actions"; renderGame(); }
});
document.querySelector("#game-screen").addEventListener("click", e => {
  const remove = e.target.closest("[data-remove-attack-slot]");
  if (remove) removeAttackFromSlot(Number(remove.dataset.removeAttackSlot));
});
document.querySelector("#game-screen").addEventListener("dragstart", e => {
  const attack = e.target.closest("[data-drag-attack]");
  if (attack) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", attack.dataset.dragAttack); }
});
document.querySelector("#game-screen").addEventListener("dragover", e => {
  if (e.target.closest("[data-attack-slot]")) e.preventDefault();
});
document.querySelector("#game-screen").addEventListener("drop", e => {
  const slot = e.target.closest("[data-attack-slot]");
  if (slot) equipAttackToSlot(e.dataTransfer.getData("text/plain"), Number(slot.dataset.attackSlot));
});
if (save.run) renderGame();
