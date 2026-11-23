import {
  STATS, WEAPONS, ELEMENTS, MASTERY_DOMAINS, emptyMastery
} from "./game-data.js";
import { loadSave, saveGame } from "./storage.js";
import { item } from "./game-helpers.js?v=3";
import { heritageProgress, ensureClassAttack } from "./progression.js";

export function newLegacy() {
  return {
    deaths: 0,
    abandoned: 0,
    totalActions: 0,
    bestAge: 16,
    goldEarned: 0,
    unlockedClasses: ["none"],
    unlockedJobs: ["none"],
    talents: [],
    classStatBonuses: {},
    history: {},
    characters: [],
    discoveries: [],
    primalHeart: false
  };
}

export function defaultSave() {
  return { schema: 3, legacy: newLegacy(), run: null };
}

export function newRun() {
  return {
    age: 16,
    actions: 0,
    gold: 40,
    hp: 100,
    maxHp: 100,
    mana: 30,
    classId: "none",
    jobId: "none",
    stats: Object.fromEntries(STATS.map(([id]) => [id, 3 + Math.floor(Math.random() * 3)])),
    maxStats: Object.fromEntries(STATS.map(([id]) => [id, 3])),
    diseases: [],
    statuses: [],
    inventory: { "health-potion": 1 },
    equipment: {},
    weaponMastery: emptyMastery(Object.keys(WEAPONS)),
    elementMastery: emptyMastery(Object.keys(ELEMENTS)),
    techniqueMastery: { concentration: { xp: 0 }, manaExpansion: { xp: 0 } },
    equipmentRefinement: 0,
    discoveredZones: [],
    classXP: 0,
    classXPById: {},
    jobXP: 0,
    explorations: 0,
    studyActions: 0,
    workActions: 0,
    itemsFound: 0,
    materials: 0,
    shopStock: ["iron-sword", "leather-hood", "health-potion", "old-gem"],
    learned: ["punch"],
    equippedAttacks: ["punch", null, null, null],
    log: []
  };
}

export function normalizeLoadedSave(raw) {
  if (raw.schema !== 3) raw.schema = 3;
  if (raw.run) {
    raw.run.discoveredZones ||= [];
    raw.run.techniqueMastery ||= {};
    if (typeof raw.run.techniqueMastery.concentration === "number") {
      raw.run.techniqueMastery.concentration = { xp: raw.run.techniqueMastery.concentration * 5 };
    } else if (!raw.run.techniqueMastery.concentration) {
      raw.run.techniqueMastery.concentration = { xp: 0 };
    }
    raw.run.techniqueMastery.manaExpansion ||= { xp: 0 };
    raw.run.equipmentRefinement ||= 0;
    raw.run.weaponMastery ||= emptyMastery(Object.keys(WEAPONS));
    raw.run.elementMastery ||= emptyMastery(Object.keys(ELEMENTS));
  }
  return raw;
}

export let save = loadSave(defaultSave, normalizeLoadedSave);

export function setSave(newSave) {
  save = newSave;
}

export function setSaveRun(run) {
  save.run = run;
}

export let activeTab = "summary";

export function setActiveTab(tab) {
  activeTab = tab;
}

export let activeActionTab = "study";

export function setActiveActionTab(tab) {
  activeActionTab = tab;
}

export let combat = null;

export function setCombat(c) {
  combat = c;
}

export function persist() {
  saveGame(save);
}

export function runState() {
  const r = save.run;
  if (!r) return null;
  r.discoveredZones ||= [];
  r.techniqueMastery ||= {};
  if (typeof r.techniqueMastery.concentration === "number") {
    r.techniqueMastery.concentration = { xp: r.techniqueMastery.concentration * 5 };
  } else if (!r.techniqueMastery.concentration) {
    r.techniqueMastery.concentration = { xp: 0 };
  }
  r.techniqueMastery.manaExpansion ||= { xp: 0 };
  r.equipmentRefinement ||= 0;
  r.weaponMastery ||= emptyMastery(Object.keys(WEAPONS));
  r.elementMastery ||= emptyMastery(Object.keys(ELEMENTS));
  return r;
}

export function normalizeHeritage() {
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
    legacy.heritageDomains[id] ||= {
      currentLevel: 0,
      lastLevel: 0,
      lastXp: 0,
      lastAcquired: {},
      lastCharacter: "",
      permanent: {}
    };
    const domain = legacy.heritageDomains[id];
    domain.currentLevel = Number.isFinite(domain.currentLevel) ? domain.currentLevel : 0;
    domain.lastLevel = Number.isFinite(domain.lastLevel) ? domain.lastLevel : 0;
    domain.lastXp = Number.isFinite(domain.lastXp) ? domain.lastXp : 0;
    domain.lastAcquired ||= {};
    domain.lastCharacter ||= "";
    domain.permanent ||= {};
  });
}

export function ensureSaveShape() {
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
  r.techniqueMastery ||= {};
  if (typeof r.techniqueMastery.concentration === "number") {
    r.techniqueMastery.concentration = { xp: r.techniqueMastery.concentration * 5 };
  } else if (!r.techniqueMastery.concentration) {
    r.techniqueMastery.concentration = { xp: 0 };
  }
  r.techniqueMastery.manaExpansion ||= { xp: 0 };
  r.equipmentRefinement ||= 0;
  r.discoveredZones ||= [];
  r.log ||= [];
  r.learned ||= ["punch"];
  r.classXPById ||= {};
  if (r.classId && r.classId !== "none" && r.classXP && r.classXPById[r.classId] === undefined) {
    r.classXPById[r.classId] = r.classXP;
  }
  r.learned = r.learned.map(id => id === "slash" ? "punch" : id);
  if (!r.learned.includes("punch")) r.learned.unshift("punch");
  r.equippedAttacks ||= ["punch", null, null, null];
  r.equippedAttacks = r.equippedAttacks.map(id => id === "slash" ? "punch" : id);
  r.shopStock ||= ["iron-sword", "leather-hood", "health-potion", "old-gem"];
  r.masteryLevels ||= {};
  Object.keys(MASTERY_DOMAINS).forEach(id => {
    r.masteryLevels[id] = heritageProgress(id, r).level;
  });
  ensureClassAttack(r);
}

export function qty(id) {
  return save.run?.inventory?.[id] || 0;
}

export function addItem(id, amount = 1) {
  if (!save.run) return;
  save.run.inventory[id] = qty(id) + amount;
}

export function removeItem(id, amount = 1) {
  if (!save.run) return;
  save.run.inventory[id] = Math.max(0, qty(id) - amount);
  if (!save.run.inventory[id]) delete save.run.inventory[id];
}

export function equippedBonuses() {
  const out = {};
  if (!save.run?.equipment) return out;
  const refinement = save.run.equipmentRefinement || 0;
  Object.values(save.run.equipment).forEach(id => {
    Object.entries(item(id)?.bonus || {}).forEach(([k, v]) => {
      const val = refinement > 0 ? Math.round(v * (1 + refinement * 0.2) * 10) / 10 : v;
      out[k] = (out[k] || 0) + val;
    });
  });
  if (refinement > 0) {
    out.defense = (out.defense || 0) + refinement * 2;
    out.damage = (out.damage || 0) + refinement * 2;
  }
  return out;
}
