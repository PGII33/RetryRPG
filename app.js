import {
  STATS, RANDOM_NAMES, ELEMENTS, WEAPONS, SLOTS, MASTERY_LEVELS, MASTERY_XP, MASTERY_DOMAINS,
  STAT_LABELS, PASSIVE_LABELS, RES_KEYS, CLASSES, JOBS, ITEMS, ATTACKS, ZONES, STATUS, emptyMastery
} from "./src/game-data.js";
import { loadSave, saveGame } from "./src/storage.js";
import { esc, fmtBonuses, fmtNumber, item, notify, statName } from "./src/game-helpers.js?v=3";

// ---------------------------------------------------------------------------
// 1. Constants & Static Configurations
// ---------------------------------------------------------------------------

const DEFAULT_RANK_CURVE = [1, 2, 3, 4, 5, 6, 7];

const HERITAGE_RANK_VALUES = {
  class: DEFAULT_RANK_CURVE
};

const CLASS_EVOLUTION_STATS = {
  knight: [{ strength: 0.5 }, { strength: 0.5, constitution: 0.5 }],
  lancer: [{ strength: 0.5 }, { strength: 0.5, agility: 0.5 }],
  hammerer: [{ strength: 0.5 }, { strength: 0.5, constitution: 0.5 }],
  reaver: [{ strength: 0.5 }, { strength: 0.5, agility: 0.5 }],
  archer: [{ agility: 0.5 }, { agility: 0.5, strength: 0.5 }],
  rogue: [{ agility: 0.5 }, { agility: 0.5, luck: 0.5 }],
  fireMage: [{ magic: 0.5 }, { magic: 0.5, luck: 0.5 }],
  evoker: [{ magic: 0.5 }, { magic: 0.5, knowledge: 0.5 }],
  iceMage: [{ magic: 0.5 }, { magic: 0.5, constitution: 0.5 }],
  windMage: [{ magic: 0.5 }, { magic: 0.5, agility: 0.5 }],
  earthMage: [{ magic: 0.5 }, { magic: 0.5, constitution: 0.5 }],
  primordial: [{ magic: 0.5 }, { magic: 0.5, knowledge: 0.5 }]
};

const CLASS_WEAPON_TRAINING = {
  warrior: ["sword", "axe", "hammer"],
  ranger: ["bow", "dagger"],
  mage: ["catalyst"]
};

const STUDIES = [
  {
    id: "general",
    name: "Études générales",
    description: "Lire, observer et structurer les connaissances.",
    gains: { knowledge: 0.25, magic: 0.2 },
    available: () => true
  },
  {
    id: "mana",
    name: "Étude sur le mana",
    description: "Comprendre les flux de mana et préparer les techniques arcaniques.",
    gains: { magic: 0.35, knowledge: 0.15 },
    available: r => ["mage", "fireMage", "iceMage", "windMage", "earthMage", "primordial"].includes(r.classId)
  },
  ...Object.entries(ELEMENTS).map(([id, name]) => ({
    id: `element-${id}`,
    name: `Étude élémentaire : ${name}`,
    description: `Développer uniquement l'affinité ${name} et ses évolutions.`,
    element: id,
    gains: { knowledge: 0.1 },
    available: r => isClassOrSubclassOf(r.classId, "mage")
  }))
];

const TRAINING = [
  {
    id: "physical",
    category: "Développement physique",
    name: "Développement physique",
    description: "Renforcer Force, Agilité et Constitution.",
    gains: { strength: 0.22, agility: 0.16, constitution: 0.22 }
  },
  ...Object.entries(WEAPONS)
    .filter(([id]) => id !== "unarmed")
    .map(([id, name]) => ({
      id: `weapon-${id}`,
      category: "Techniques de combat",
      name: `S'entraîner : ${name}`,
      description: `Améliorer la maîtrise des ${name.toLowerCase()} et débloquer des techniques.`,
      weapon: id,
      gains: { strength: 0.1, agility: 0.1 }
    })),
  {
    id: "concentration",
    category: "Techniques magiques",
    name: "Concentration de mana",
    description: "Développer une technique qui améliore durablement la régénération du mana.",
    magicOnly: true,
    gains: { magic: 0.2, concentration: 1 }
  }
];

const TABS = [
  ["summary", "Résumé"],
  ["actions", "Actions"],
  ["classjob", "Classes / métiers"],
  ["market", "Commerce"],
  ["inventory", "Inventaire"],
  ["equipment", "Équipement"],
  ["combat", "Combat"],
  ["stats", "Stats combat"],
  ["legacy", "Héritage"]
];

const ACTION_SUBTABS = [
  ["study", "Études"],
  ["training", "Entraînement"],
  ["exploration", "Exploration"],
  ["work", "Travailler"],
  ["rest", "Se reposer"]
];

// ---------------------------------------------------------------------------
// 2. Game State Initialization & Persistence
// ---------------------------------------------------------------------------

function newLegacy() {
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

function defaultSave() {
  return { schema: 3, legacy: newLegacy(), run: null };
}

function newRun() {
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
    techniqueMastery: { concentration: 0 },
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

let save = loadSave(defaultSave, normalizeLoadedSave);
let activeTab = "summary";
let activeActionTab = "study";
let combat = null;

function persist() {
  saveGame(save);
}

function runState() {
  const r = save.run;
  if (!r) return null;
  r.discoveredZones ||= [];
  r.techniqueMastery ||= { concentration: 0 };
  r.weaponMastery ||= emptyMastery(Object.keys(WEAPONS));
  r.elementMastery ||= emptyMastery(Object.keys(ELEMENTS));
  return r;
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
ensureSaveShape();

// ---------------------------------------------------------------------------
// 3. Inventory Helpers
// ---------------------------------------------------------------------------

function qty(id) {
  return save.run?.inventory?.[id] || 0;
}

function addItem(id, amount = 1) {
  if (!save.run) return;
  save.run.inventory[id] = qty(id) + amount;
}

function removeItem(id, amount = 1) {
  if (!save.run) return;
  save.run.inventory[id] = Math.max(0, qty(id) - amount);
  if (!save.run.inventory[id]) delete save.run.inventory[id];
}

function equippedBonuses() {
  const out = {};
  if (!save.run?.equipment) return out;
  Object.values(save.run.equipment).forEach(id => {
    Object.entries(item(id)?.bonus || {}).forEach(([k, v]) => {
      out[k] = (out[k] || 0) + v;
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// 4. Heritage, Mastery & Progression Formulas
// ---------------------------------------------------------------------------

function masteryDomain(id) {
  return MASTERY_DOMAINS[id] || { label: id, source: "Autres", passive: {} };
}

function level(xp) {
  return Math.max(0, Math.min(MASTERY_LEVELS.length - 1, MASTERY_XP.reduce((n, threshold) => xp >= threshold ? n + 1 : n, 0) - 1));
}

function masteryText(data) {
  return `${MASTERY_LEVELS[level(data.xp)]} (${fmtNumber(data.xp)} XP)`;
}

function historicalLevel(id) {
  return save.legacy.heritageDomains?.[id]?.lastLevel || level(save.legacy.masteryBonuses?.[id]?.bestXp || 0);
}

function historicalClassJobLevels() {
  const classTotal = Object.keys(CLASSES)
    .filter(id => id !== "none")
    .reduce((sum, id) => sum + historicalLevel(id), 0);
  const jobTotal = Object.keys(JOBS)
    .filter(id => id !== "none")
    .reduce((sum, id) => sum + historicalLevel(id), 0);
  return classTotal + jobTotal;
}

function lifeExpectancy() {
  return 30 + historicalClassJobLevels() * 0.5;
}

function growthXp(base, domainId) {
  return +(base + historicalLevel(domainId) * 0.5).toFixed(2);
}

function heritageRankValue(id, rank) {
  if (rank <= 0) return 0;
  const values = HERITAGE_RANK_VALUES[id] || DEFAULT_RANK_CURVE;
  return values[Math.max(0, Math.min(values.length - 1, rank - 1))];
}

function heritageProgress(id, run) {
  if (!run) return { xp: 0, level: 0 };
  if (WEAPONS[id]) return { xp: run.weaponMastery?.[id]?.xp || 0, level: level(run.weaponMastery?.[id]?.xp || 0) };
  if (ELEMENTS[id]) return { xp: run.elementMastery?.[id]?.xp || 0, level: level(run.elementMastery?.[id]?.xp || 0) };
  if (CLASSES[id] && id !== "none") {
    const xp = run.classXPById?.[id] ?? (run.classId === id ? run.classXP || 0 : 0);
    return { xp, level: level(xp) };
  }
  if (id === "class") return { xp: 0, level: 0 };
  if (id === "concentration") {
    const xp = (run.techniqueMastery?.concentration || 0) * 8;
    return { xp, level: level(xp) };
  }
  const jobXp = run.jobId === id ? run.jobXP || 0 : 0;
  return { xp: jobXp, level: level(jobXp) };
}

function classHeritageValues(id, rank) {
  const result = { lifeExpectancy: +(rank * 0.5).toFixed(2) };
  const main = CLASSES[id]?.stat;
  const increments = CLASS_EVOLUTION_STATS[id] || [];
  if (!increments.length && main && rank > 0) {
    result[main] = +(0.5 + Math.max(0, rank - 1)).toFixed(2);
  }
  for (let rankIndex = 0; rankIndex < rank; rankIndex++) {
    const values = increments[Math.min(rankIndex, increments.length - 1)];
    if (!values) continue;
    Object.entries(values).forEach(([key, value]) => {
      result[key] = +((result[key] || 0) + value).toFixed(2);
    });
  }
  return result;
}

function heritageAcquired(id, rank) {
  if (CLASSES[id] && id !== "none") return classHeritageValues(id, rank);
  const multiplier = heritageRankValue(id, rank);
  return Object.fromEntries(
    Object.entries(masteryDomain(id).passive).map(([key, value]) => [key, +(value * multiplier).toFixed(2)])
  );
}

function recordLegacyMasteries(run) {
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
  save.legacy.masteryBonuses = Object.fromEntries(
    Object.entries(save.legacy.heritageDomains).map(([id, domain]) => [
      id,
      { level: domain.lastLevel, bestXp: domain.lastXp, values: { ...domain.permanent } }
    ])
  );
}

function inheritedBonuses() {
  const out = {};
  Object.entries(save.legacy.heritageDomains || {}).forEach(([id, domain]) => {
    if (WEAPONS[id] || ELEMENTS[id] || id === "class") return;
    Object.entries(domain.permanent || {}).forEach(([key, value]) => {
      out[key] = (out[key] || 0) + value;
    });
  });
  return out;
}

function inheritedDomainBonuses(id) {
  return save.legacy.heritageDomains?.[id]?.permanent || {};
}

function totals() {
  const r = save.run;
  if (!r) return {};
  const eq = equippedBonuses();
  const s = { ...r.stats };
  Object.entries(eq).forEach(([k, v]) => s[k] = (s[k] || 0) + v);
  const inherited = inheritedBonuses();
  return {
    ...s,
    accuracy: 80 + s.agility * 2 + (eq.accuracy || 0) + (inherited.accuracy || 0),
    evasion: 3 + s.agility + (eq.evasion || 0) + (inherited.evasion || 0),
    crit: 3 + s.luck * 0.4 + (eq.crit || 0),
    critDamage: 150 + s.strength * 2 + (eq.critDamage || 0),
    attackSpeed: 10 + s.agility + (eq.attackSpeed || 0),
    defense: s.constitution * 2 + (eq.defense || 0) + (inherited.defense || 0),
    lifeRegen: Math.floor(s.constitution / 5) + (eq.lifeRegen || 0) + (inherited.lifeRegen || 0),
    maxMana: 25 + s.magic * 4 + s.knowledge * 2 + (eq.maxMana || 0),
    manaRegen: 2 + Math.floor(s.magic / 5) + (eq.manaRegen || 0) + (r.techniqueMastery?.concentration || 0) * 0.5 + (inherited.manaRegen || 0),
    magicPower: s.magic * 2 + s.knowledge + (eq.magicPower || 0) + (inherited.magicPower || 0),
    magicResistance: s.magic + s.knowledge / 2 + (eq.magicResistance || 0),
    slashRes: Math.floor(s.constitution / 2) + (eq.slashRes || 0),
    pierceRes: Math.floor(s.agility / 2) + (eq.pierceRes || 0),
    bluntRes: Math.floor(s.strength / 3) + (eq.bluntRes || 0) + (inherited.bluntRes || 0),
    fireRes: Math.floor(s.magic / 3) + (eq.fireRes || 0) + (inherited.fireRes || 0),
    iceRes: Math.floor(s.magic / 3) + (eq.iceRes || 0) + (inherited.iceRes || 0),
    windRes: Math.floor(s.agility / 3) + (eq.windRes || 0) + (inherited.windRes || 0),
    earthRes: Math.floor(s.constitution / 3) + (eq.earthRes || 0) + (inherited.earthRes || 0),
    damage: inherited.damage || 0
  };
}

// ---------------------------------------------------------------------------
// 5. Class & Job Progression
// ---------------------------------------------------------------------------

function classLineage(id) {
  const lineage = [];
  let current = id;
  while (current && current !== "none" && CLASSES[current]) {
    lineage.unshift(current);
    current = CLASSES[current].parent;
  }
  return lineage;
}

function classEvolutionBase(id) {
  return CLASSES[id]?.parent || null;
}

function canChangeClass(id) {
  const target = CLASSES[id];
  const base = classEvolutionBase(id);
  return Boolean(
    target &&
    save.legacy.unlockedClasses.includes(id) &&
    (save.run.classId === "none" || (target.hidden && (!base || base === save.run.classId)))
  );
}

function canUseClassItem(i) {
  const target = CLASSES[i?.classWeapon];
  if (!target || save.run.classId === i.classWeapon) return false;
  if (!target.hidden) return save.run.classId === "none" && save.legacy.unlockedClasses.includes(i.classWeapon);
  return true;
}

function isClassOrSubclassOf(classId, parentClassId) {
  let currentId = classId;
  while (currentId) {
    if (currentId === parentClassId) return true;
    const currentClass = CLASSES[currentId];
    if (!currentClass) return false;
    currentId = currentClass.parent;
  }
  return false;
}

function hasWeaponInInventory(weapon) {
  return ITEMS.some(i => i.kind === "equipment" && i.weapon === weapon && qty(i.id) > 0);
}

function elementalStudyGain(classId, element) {
  return 3 + (CLASSES[classId]?.element === element ? 2 : 0);
}

function availableStudies() {
  return STUDIES.filter(study => study.available(save.run));
}

function availableTraining() {
  const classId = save.run.classId;
  return TRAINING.filter(activity => {
    if (activity.id === "physical") return true;
    if (activity.weapon) {
      const requiredClass = Object.entries(CLASS_WEAPON_TRAINING)
        .find(([, weapons]) => weapons.includes(activity.weapon))?.[0];
      if (!requiredClass) return false;
      return isClassOrSubclassOf(classId, requiredClass) && hasWeaponInInventory(activity.weapon);
    }
    if (activity.magicOnly) {
      return isClassOrSubclassOf(classId, "mage");
    }
    return true;
  });
}

function chooseClass(id, fromItem = false) {
  const target = CLASSES[id];
  const isEvolution = Boolean(target?.hidden && save.run.classId !== "none");
  if (!target || save.run.classId === id || (!fromItem && !canChangeClass(id))) return;
  save.run.classId = id;
  save.run.classXP = 0;
  save.run.classXPById[id] ||= 0;
  ensureClassAttack(save.run);
  log(`${isEvolution ? "Évolution" : "Classe"} choisie pendant la run : ${target.name}.`);
  persist();
  renderGame();
}

function chooseJob(id) {
  if (save.run.jobId !== "none" || !save.legacy.unlockedJobs.includes(id)) return;
  save.run.jobId = id;
  save.run.jobXP += 1;
  log(`Métier choisi pendant la run : ${JOBS[id].name}.`);
  persist();
  renderGame();
}

// ---------------------------------------------------------------------------
// 6. Attack Skills & Mastery Tracking
// ---------------------------------------------------------------------------

function ensureClassAttack(run) {
  const attack = ATTACKS.find(a => a.classId === run.classId);
  if (attack) learnAttack(run, attack.id);
}

function learnAttack(run, id) {
  if (run.learned.includes(id)) return;
  run.learned.push(id);
  const slot = run.equippedAttacks.findIndex(value => !value);
  if (slot >= 0) run.equippedAttacks[slot] = id;
}

function setAttack(id) {
  if (!save.run.learned.includes(id) || save.run.equippedAttacks.includes(id)) return;
  const slot = save.run.equippedAttacks.findIndex(value => !value);
  if (slot < 0) return notify("Tous les emplacements sont occupés.");
  equipAttackToSlot(id, slot);
}

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

function gainStat(key, amount = 0.1) {
  save.run.stats[key] += amount;
}

function gainClassXp(base, domainId = null) {
  if (!save.run || save.run.classId === "none" || base <= 0) return 0;
  const current = save.run.classId;
  let currentGain = 0;
  const domains = domainId ? [domainId] : classLineage(current);
  domains.forEach(id => {
    if (!CLASSES[id]) return;
    const gained = growthXp(base, id);
    const beforeXp = save.run.classXPById[id] || 0;
    save.run.classXPById[id] = beforeXp + gained;
    if (id === current) {
      save.run.classXP = save.run.classXPById[id];
      currentGain = gained;
    }
    if (level(save.run.classXPById[id]) > level(beforeXp)) {
      log(`Niveau de classe atteint : ${CLASSES[id].name} · ${masteryText({ xp: save.run.classXPById[id] })}.`);
    }
  });
  return currentGain;
}

function gainJobXp(base) {
  if (!save.run || save.run.jobId === "none" || base <= 0) return 0;
  const gained = growthXp(base, save.run.jobId);
  const beforeLevel = level(save.run.jobXP);
  save.run.jobXP += gained;
  if (level(save.run.jobXP) > beforeLevel) {
    log(`Niveau de métier atteint : ${masteryText({ xp: save.run.jobXP })}.`);
  }
  return gained;
}

function gainMastery(kind, id, amount = 1) {
  const d = save.run[kind][id];
  const beforeLevel = level(d.xp);
  d.xp += amount;
  const unlocks = kind === "elementMastery"
    ? { fire: ["fire"], ice: ["ice"], wind: ["wind"], earth: ["earth"] }
    : { sword: ["pierce"], spear: ["shot"], hammer: ["smash"], bow: ["shot"], catalyst: ["wind"], dagger: ["pierce"] };
  const technique = unlocks[id]?.[0];
  if (technique && d.xp >= 8 && !save.run.learned.includes(technique)) {
    learnAttack(save.run, technique);
    log(`Technique débloquée : ${ATTACKS.find(a => a.id === technique)?.name}.`);
  }
  const label = kind === "weaponMastery" ? WEAPONS[id] : ELEMENTS[id];
  if (level(d.xp) > beforeLevel) {
    log(`Niveau de compétence atteint : ${label} · ${masteryText(d)}.`);
  }
  return amount;
}

// ---------------------------------------------------------------------------
// 7. Shop & Equipment Actions
// ---------------------------------------------------------------------------

function buy(id) {
  const i = item(id);
  if (!i || save.run.gold < i.price) return;
  save.run.gold -= i.price;
  addItem(id);
  log(`Achat : ${i.name} x1.`);
  persist();
  renderGame();
}

function sell(id) {
  const i = item(id);
  if (!i || !qty(id)) return;
  removeItem(id);
  save.run.gold += i.sell * (save.run.jobId === "merchant" ? 1.1 : 1);
  log(`Vente : ${i.name} x1.`);
  persist();
  renderGame();
}

function useItem(id) {
  const i = item(id);
  if (!i || !qty(id)) return;
  const r = save.run;
  if (i.classWeapon) {
    const target = CLASSES[i.classWeapon];
    if (!canUseClassItem(i)) {
      return notify(`Cette évolution nécessite la classe ${target?.parent ? CLASSES[target.parent].name : target?.name || "associée"}.`);
    }
    removeItem(id);
    if (i.classWeapon === "primordial") save.legacy.primalHeart = true;
    if (!save.legacy.unlockedClasses.includes(i.classWeapon)) save.legacy.unlockedClasses.push(i.classWeapon);
    chooseClass(i.classWeapon, true);
    return;
  }
  removeItem(id);
  if (i.effect?.hp) r.hp = Math.min(r.maxHp, r.hp + i.effect.hp);
  if (i.effect?.mana) r.mana = Math.min(totals().maxMana, r.mana + i.effect.mana);
  if (i.effect?.stat) {
    gainStat(i.effect.stat, i.effect.amount);
    log(`Utilisation : ${i.name} · +${i.effect.amount} ${statName(i.effect.stat)}.`);
  } else {
    log(`Utilisation : ${i.name}.`);
  }
  if (i.id === "health-potion" && r.diseases.length && Math.random() < 0.2) r.diseases.shift();
  persist();
  renderGame();
}

function equip(id) {
  const i = item(id);
  if (!i || i.kind !== "equipment") return;
  const req = Object.entries(i.req || {}).some(([k, v]) => totals()[k] < v);
  if (req) return notify("Prérequis statistiques non atteint.");
  const old = save.run.equipment[i.slot];
  if (old === id) delete save.run.equipment[i.slot];
  else save.run.equipment[i.slot] = id;
  log(`${old === id ? "Retrait" : "Équipement"} : ${i.name}.`);
  persist();
  renderGame();
}

function shopItemCount() {
  return 4 + (save.run.discoveredZones?.length || 0);
}

function refreshShop(notifyPlayer = true) {
  const candidates = ITEMS.filter(i => i.price && i.kind !== "special");
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  save.run.shopStock = shuffled.slice(0, shopItemCount()).map(i => i.id);
  if (notifyPlayer) log("Le commerce se renouvelle pour les cinq prochaines années.");
}

function estimatedWork() {
  const r = save.run;
  const job = JOBS[r.jobId];
  return Math.round(
    job.work * (1 + level(r.jobXP) * 0.12) +
    (r.jobId === "merchant" ? Math.floor(r.gold * 0.03) : 0) +
    (inheritedDomainBonuses(r.jobId).workGold || 0)
  );
}

// ---------------------------------------------------------------------------
// 8. Turn Actions & Life Cycle
// ---------------------------------------------------------------------------

function log(text) {
  save.run.log.unshift(`${save.run.age} ans : ${text}`);
  save.run.log = save.run.log.slice(0, 60);
}

function unlockChecks() {
  const before = [...save.legacy.unlockedClasses, ...save.legacy.unlockedJobs];
  Object.entries(CLASSES).forEach(([id, c]) => {
    if (!save.legacy.unlockedClasses.includes(id) && c.unlock({ run: save.run, legacy: save.legacy })) {
      save.legacy.unlockedClasses.push(id);
      log(`Connaissance acquise : classe ${c.name} débloquée.`);
      notify(`${c.name} débloqué !`);
    }
  });
  Object.entries(JOBS).forEach(([id, j]) => {
    if (!save.legacy.unlockedJobs.includes(id) && j.unlock({ run: save.run, legacy: save.legacy })) {
      save.legacy.unlockedJobs.push(id);
      log(`Métier débloqué : ${j.name}.`);
      notify(`${j.name} débloqué !`);
    }
  });
  if (save.legacy.primalHeart && !save.legacy.unlockedClasses.includes("primordial")) {
    save.legacy.unlockedClasses.push("primordial");
  }
  return before.length !== save.legacy.unlockedClasses.length + save.legacy.unlockedJobs.length;
}

function contractDisease() {
  if (save.run.diseases.length) return;
  const names = [["Rhume", "Légère", 1], ["Fièvre des marais", "Modérée", 2], ["Peste grise", "Grave", 3]];
  const d = names[Math.floor(Math.random() * names.length)];
  save.run.diseases.push({ name: d[0], severity: d[1], progression: d[2] });
  log(`Maladie contractée : ${d[0]} (${d[1]}).`);
}

function progressDisease() {
  save.run.diseases.forEach(d => {
    if (Math.random() < 0.35) {
      d.progression++;
      if (d.progression >= 4 && d.severity !== "Critique") {
        d.severity = d.severity === "Légère" ? "Modérée" : d.severity === "Modérée" ? "Grave" : "Critique";
        d.progression = 0;
        log(`${d.name} s'aggrave : gravité ${d.severity}.`);
      }
      if (d.severity === "Critique" && Math.random() < 0.28) {
        die(`La maladie ${d.name} devient mortelle.`);
      }
    }
  });
}

function advanceYear() {
  const r = save.run;
  r.age++;
  r.actions++;
  save.legacy.totalActions++;
  const s = totals();
  r.hp = Math.min(r.maxHp, r.hp + s.lifeRegen);
  r.mana = Math.min(s.maxMana, r.mana + s.manaRegen);
  if (r.age % 5 === 0) refreshShop();
  if (Math.random() < Math.max(0.03, 0.14 - s.constitution * 0.006)) contractDisease();
  progressDisease();
  const maxAge = lifeExpectancy();
  if (r.age >= maxAge - 3 && Math.random() < 0.08 + (r.age - (maxAge - 3)) * 0.1) {
    die("Le vieillissement probabiliste vous emporte.");
  }
  r.maxStats = { ...r.maxStats };
  Object.keys(r.stats).forEach(k => r.maxStats[k] = Math.max(r.maxStats[k], r.stats[k]));
  unlockChecks();
  persist();
}

function completeAction(text, gains = {}) {
  advanceYear();
  if (!save.run) return;
  const beforeStats = { ...save.run.stats };
  Object.entries(gains).forEach(([k, v]) => gainStat(k, v));
  const classGain = classLineage(save.run.classId)
    .map(id => CLASSES[id].stat && gains[CLASSES[id].stat] ? gainClassXp(gains[CLASSES[id].stat], id) : 0)
    .reduce((total, value) => total + value, 0);
  const details = Object.entries(gains)
    .filter(([key]) => STATS.some(([id]) => id === key) && save.run.stats[key] !== beforeStats[key])
    .map(([key]) => `+${(save.run.stats[key] - beforeStats[key]).toFixed(2)} ${statName(key)}`);
  if (classGain) details.push(`+${classGain} XP de classe`);
  unlockChecks();
  log(`${text}${details.length ? ` · ${details.join(" · ")}` : ""}`);
  persist();
  renderGame();
}

function rest() {
  advanceYear();
  if (!save.run) return;
  const r = save.run;
  r.hp = Math.min(r.maxHp, r.hp + 18);
  r.mana = Math.min(totals().maxMana, r.mana + 12);
  if (r.diseases.length && Math.random() < 0.45) {
    const healed = r.diseases.shift();
    log(`Repos efficace : ${healed.name} est guérie.`);
  } else {
    log("Repos : récupération partielle.");
  }
  persist();
  renderGame();
}

function doAction(id) {
  const r = save.run;
  if (id.startsWith("study:")) {
    const type = id.slice(6);
    const study = STUDIES.find(activity => activity.id === type);
    if (!study || !study.available(r)) return notify("Cette étude n'est pas encore accessible.");
    const masteryGain = type.startsWith("element-")
      ? gainMastery("elementMastery", type.slice(8), elementalStudyGain(r.classId, type.slice(8)))
      : 0;
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
  if (id === "explore") {
    r.explorations++;
    const found = Math.random() < 0.7 ? ["ore", "old-gem", "health-potion"][Math.floor(Math.random() * 3)] : null;
    if (found) {
      addItem(found);
      r.itemsFound++;
    }
    return completeAction(found ? `Exploration : ${item(found).name} trouvé.` : "Exploration : rien trouvé.", { agility: 0.2, luck: 0.15 });
  }
  if (id === "work") {
    const job = JOBS[r.jobId];
    const earnings = estimatedWork();
    const jobXp = gainJobXp(2);
    r.gold += earnings;
    save.legacy.goldEarned += earnings;
    r.workActions++;
    return completeAction(
      `Travail de ${job.name} : +${earnings} or${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      job.stat ? { [job.stat]: 0.2 } : {}
    );
  }
  if (id === "rest") return rest();
}

function exploreZone(zoneId) {
  const z = ZONES.find(x => x.id === zoneId);
  if (!z) return;
  const r = runState();
  const s = totals();
  const locked = z.req && (z.req.stat ? s[z.req.stat] < z.req.value : level(r.elementMastery[z.req.element]?.xp || 0) < z.req.value);
  if (locked) return notify("Cette zone n'est pas encore accessible.");
  if (!r.discoveredZones.includes(z.id)) {
    r.discoveredZones.push(z.id);
    save.legacy.discoveries = [...new Set([...(save.legacy.discoveries || []), z.id])];
    refreshShop(false);
  }
  r.explorations++;
  const reward = Math.random() < 0.7 ? z.reward[Math.floor(Math.random() * z.reward.length)] : null;
  if (reward) {
    addItem(reward);
    r.itemsFound++;
    if (item(reward).kind === "material") r.materials++;
  }
  completeAction(
    reward ? `Exploration de ${z.name} : ${item(reward).name} trouvé.` : `Exploration de ${z.name} : aucune ressource trouvée.`,
    { agility: 0.2, luck: 0.15 }
  );
}

// ---------------------------------------------------------------------------
// 9. Combat Engine
// ---------------------------------------------------------------------------

function enemyFor(zone) {
  const hp = 42 + zone.difficulty * 18;
  return {
    name: zone.enemy[Math.floor(Math.random() * zone.enemy.length)],
    hp,
    maxHp: hp,
    defense: 4 + zone.difficulty * 2,
    speed: 8 + zone.difficulty,
    res: {
      slash: zone.difficulty * 2,
      pierce: zone.difficulty,
      blunt: Math.max(0, zone.difficulty - 2),
      fire: zone.difficulty % 3 === 0 ? 28 : 5,
      ice: zone.difficulty % 4 === 0 ? 25 : 5,
      wind: 5,
      earth: zone.difficulty % 2 ? 18 : 4,
      magic: zone.difficulty * 2
    },
    statuses: []
  };
}

function startCombat(zoneId, force = false) {
  const z = ZONES.find(x => x.id === zoneId);
  if (!z) return;
  const r = runState();
  const s = totals();
  if (!r.discoveredZones.includes(z.id)) {
    r.discoveredZones.push(z.id);
    save.legacy.discoveries = [...new Set([...(save.legacy.discoveries || []), z.id])];
    refreshShop(false);
  }
  const chance = Math.max(0.05, Math.min(0.65, 0.18 + z.difficulty * 0.045 - s.agility * 0.012));
  if (!force && Math.random() >= chance) {
    r.explorations++;
    const reward = Math.random() < 0.5 ? z.reward[0] : null;
    if (reward) {
      addItem(reward);
      r.itemsFound++;
      if (item(reward).kind === "material") r.materials++;
    }
    const result = reward
      ? `Exploration de ${z.name} sans combat : ${item(reward).name} x1 trouvé.`
      : `Exploration de ${z.name} sans combat : aucune ressource trouvée.`;
    return completeAction(result, { agility: 0.2, luck: 0.15 });
  }
  combat = {
    zone: z,
    enemy: enemyFor(z),
    mode: document.querySelector("#combat-mode")?.value || "manual",
    turn: 1,
    log: [`Entrée dans ${z.name}. Une rencontre survient (${Math.round(chance * 100)}%).`],
    finished: false
  };
  localStorage.setItem("retry-combat-mode", combat.mode);
  renderGame();
  if (combat.mode === "auto") setTimeout(autoTurn, 80);
}

function chooseAttack(id) {
  if (!combat || combat.finished) return;
  const a = ATTACKS.find(x => x.id === id);
  resolveRound(a);
}

function autoTurn() {
  if (!combat || combat.finished) return;
  const e = combat.enemy;
  const usable = save.run.equippedAttacks
    .filter(Boolean)
    .map(id => ATTACKS.find(a => a.id === id))
    .filter(a => a && save.run.mana >= a.mana);
  const a = usable.find(x => x.type === "heal" && save.run.hp < save.run.maxHp * 0.42)
    || usable.filter(x => x.type !== "heal").sort((x, y) => ((y.power || 0) - (e.res[y.damage] || 0)) - ((x.power || 0) - (e.res[x.damage] || 0)))[0]
    || usable[0];
  resolveRound(a || ATTACKS[0]);
}

function resolveRound(a) {
  if (!a || !combat) return;
  const r = save.run;
  const e = combat.enemy;
  const inherited = inheritedBonuses();
  const weaponLegacy = inheritedDomainBonuses(a.weapon);
  const elementLegacy = inheritedDomainBonuses(a.element);
  const tot = totals();
  let line = `Tour ${combat.turn} : ${a.name}.`;
  const cost = Math.max(0, Math.ceil(a.mana * (1 - (inherited.manaEfficiency || 0) / 100)));
  if (r.mana < cost) return notify("Mana insuffisant.");
  r.mana -= cost;
  if (a.classId && classLineage(r.classId).includes(a.classId)) {
    const classXp = gainClassXp(0.25);
    line += ` +${classXp} XP de classe.`;
    log(`Attaque de ${CLASSES[a.classId].name} : +${classXp} XP de classe.`);
  }
  if (a.type === "heal") {
    const heal = 16 + tot.magicPower * 0.4;
    r.hp = Math.min(r.maxHp, r.hp + heal);
    line += ` Soin de ${Math.round(heal)} PV.`;
  } else if (a.type === "buff") {
    r.statuses.push("guard");
    line += " Protection active.";
  } else {
    if (Math.random() * 100 > a.accuracy + (tot.accuracy - 80) + (weaponLegacy.accuracy || 0)) {
      line += " L'attaque échoue.";
    } else {
      let damage = a.power +
        (a.type === "magic" ? tot.magicPower + (elementLegacy.magicPower || 0) : tot.strength * 0.7) +
        (weaponLegacy.damage || 0) +
        (inherited.damage || 0);
      if (r.hp < r.maxHp * 0.3) {
        damage *= 1.15;
        line += " Berserker augmente les dégâts.";
      }
      if (e.hp < e.maxHp * 0.25) {
        damage *= 1.12;
        line += " Prédateur profite de la faiblesse.";
      }
      const resist = e.res[a.damage] || 0;
      damage *= Math.max(0.2, 1 - resist / 100);
      const critical = Math.random() * 100 < tot.crit;
      if (critical) damage *= tot.critDamage / 100;
      damage = Math.max(1, Math.round(damage));
      e.hp -= damage;
      line += ` ${damage} dégâts${critical ? " critiques" : ""} (${resist}% résistance appliquée).`;
      if (a.weapon) {
        const masteryGain = gainMastery("weaponMastery", a.weapon, 1);
        log(`Attaque avec ${WEAPONS[a.weapon]} : +${masteryGain} XP de compétence.`);
      }
      if (a.status?.length) {
        e.statuses.push(...a.status);
        line += ` ${a.status.map(x => STATUS[x]).join(", ")}.`;
      }
    }
  }
  combat.log.unshift(line);
  if (e.hp <= 0) return finishCombat(true);
  const enemyDamage = Math.max(1, Math.round(5 + combat.zone.difficulty * 2 - tot.defense * 0.18));
  r.hp -= r.statuses.includes("guard") ? Math.round(enemyDamage * 0.55) : enemyDamage;
  combat.log.unshift(`${e.name} inflige ${enemyDamage} dégâts.`);
  if (r.hp <= 0 && Math.random() < 0.12) {
    r.hp = 1;
    combat.log.unshift("Dernier souffle : vous survivez à l'attaque mortelle.");
  }
  if (r.hp <= 0) return finishCombat(false);
  combat.turn++;
  persist();
  renderGame();
  if (combat.mode === "auto") setTimeout(autoTurn, 100);
}

function finishCombat(win) {
  const r = save.run;
  const z = combat.zone;
  const e = combat.enemy;
  combat.finished = true;
  if (!win) {
    combat.log.unshift(`Défaite dans ${z.name} contre ${e.name}.`);
    log(`Défaite dans ${z.name} contre ${e.name}.`);
    return die("Vos blessures de combat sont mortelles.");
  }
  const reward = z.reward[Math.floor(Math.random() * z.reward.length)];
  const gained = [];
  addItem(reward);
  r.itemsFound++;
  if (item(reward).kind === "material") r.materials++;
  gained.push(`${item(reward).name} x1`);
  const classXp = gainClassXp(2);
  combat.log.unshift(`Victoire dans ${z.name} contre ${e.name}.`);
  combat.log.unshift(`Récompenses réellement obtenues : ${gained.join(", ")}${classXp ? ` · +${classXp} XP de classe` : ""}.`);
  log(`Combat remporté dans ${z.name} contre ${e.name} : ${gained.join(", ")}${classXp ? ` ; +${classXp} XP de classe` : ""}.`);
  advanceYear();
  if (!save.run) return;
  combat = null;
  persist();
  renderGame();
}

// ---------------------------------------------------------------------------
// 10. Character Life End & Creation
// ---------------------------------------------------------------------------

function die(reason) {
  const r = save.run;
  log(reason);
  save.legacy.deaths++;
  recordLegacyMasteries(r);
  save.legacy.bestAge = Math.max(save.legacy.bestAge, r.age);
  Object.entries(r.maxStats).forEach(([k, v]) => save.legacy.history[k] = Math.max(save.legacy.history[k] || 0, v));
  const classLevel = r.classId === "none" ? 0 : historicalLevel(r.classId);
  if (r.classId !== "none" && CLASSES[r.classId].stat) {
    save.legacy.classStatBonuses[r.classId] = Math.max(
      save.legacy.classStatBonuses[r.classId] || 0,
      Math.min(0.9, 0.25 + classLevel * 0.1)
    );
  }
  const talents = [{ name: `Connaissances de ${JOBS[r.jobId].name}`, stat: JOBS[r.jobId].stat }].filter(t => t.stat);
  talents.forEach(t => {
    if (!save.legacy.talents.some(x => x.name === t.name)) {
      save.legacy.talents.push({ ...t, amount: 0.25, source: r.name });
    }
  });
  save.legacy.characters.unshift({
    name: r.name,
    stats: { ...r.stats },
    classId: r.classId,
    jobId: r.jobId,
    age: r.age,
    classLevel: masteryText({ xp: r.classXP }),
    jobLevel: masteryText({ xp: r.jobXP }),
    achievements: [...r.learned],
    discoveries: r.itemsFound,
    reason
  });
  save.legacy.characters = save.legacy.characters.slice(0, 20);
  save.run = null;
  combat = null;
  persist();
  renderCreate();
  notify("La run est terminée. Une nouvelle génération peut naître.");
}

function abandonLife() {
  if (!save.run || !confirm("Tuer le personnage actuel et commencer une nouvelle vie ?")) return;
  die("Personnage tué volontairement pour commencer une nouvelle vie.");
}

function startLife(e) {
  e.preventDefault();
  const data = new FormData(e.target);
  const r = newRun();
  r.classId = data.get("class");
  r.jobId = data.get("job");
  const enteredName = String(data.get("name") || "").trim();
  r.name = enteredName || RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  r.maxStats = { ...r.stats };
  save.legacy.talents.filter(t => !t.classId || t.classId === r.classId).forEach(t => {
    r.stats[t.stat] += t.amount;
  });
  r.talents = [...save.legacy.talents];
  const classStatBonus = save.legacy.classStatBonuses[r.classId];
  if (classStatBonus && CLASSES[r.classId].stat) r.stats[CLASSES[r.classId].stat] += classStatBonus;
  Object.values(save.legacy.masteryBonuses || {}).forEach(domain => {
    Object.entries(domain.values || {}).forEach(([key, value]) => {
      if (STATS.some(([id]) => id === key)) r.stats[key] += value;
    });
  });
  const cls = CLASSES[r.classId];
  const job = JOBS[r.jobId];
  if (cls.stat) r.stats[cls.stat]++;
  if (job.stat) r.stats[job.stat]++;
  r.maxStats = { ...r.stats };
  r.mana = 25 + r.stats.magic * 4 + r.stats.knowledge * 2;
  save.run = r;
  log("Naissance. Les héritages accélèrent l'apprentissage de cette génération.");
  persist();
  renderCreate();
}

// ---------------------------------------------------------------------------
// 11. UI Rendering Components
// ---------------------------------------------------------------------------

function renderActionCard(activity, action, extra = "") {
  const hasAccessibleName = Boolean(activity.element || action.startsWith("train:"));
  const accessibleName = hasAccessibleName ? ` aria-label="${activity.name}"` : "";
  const subtitle = extra || fmtBonuses(activity.gains);
  const duration = subtitle.endsWith("1 an") ? "" : " · 1 an";
  return `<article class="action-card"><h3>${activity.name}</h3><p>${activity.description}</p><small class="muted">${subtitle}${duration}</small><button class="primary-button"${accessibleName} data-action="${action}">Effectuer</button></article>`;
}

function optionMarkup(data, available, group, current = "none") {
  return Object.entries(data)
    .filter(([, v]) => !v.hidden || available.includes(Object.keys(data).find(id => data[id] === v)))
    .map(([id, v]) => {
      const ok = available.includes(id);
      return `<label class="option ${ok ? "" : "locked"}"><input type="radio" name="${group}" value="${id}" ${id === current ? "checked" : ""} ${ok ? "" : "disabled"}><span><strong>${v.name}${ok ? "" : " 🔒"}</strong><small>${ok ? v.description : "Condition non remplie pendant cette run."}</small></span></label>`;
    })
    .join("");
}

function renderCreate() {
  document.querySelector("#create-screen").classList.toggle("hidden", Boolean(save.run));
  document.querySelector("#game-screen").classList.toggle("hidden", !save.run);
  if (save.run) return renderGame();
  document.querySelector("#class-options").innerHTML = optionMarkup(CLASSES, save.legacy.unlockedClasses, "class");
  document.querySelector("#job-options").innerHTML = optionMarkup(JOBS, save.legacy.unlockedJobs, "job");
  const tags = [
    ...save.legacy.unlockedClasses.filter(id => id !== "none").map(id => CLASSES[id].name),
    ...save.legacy.unlockedJobs.filter(id => id !== "none").map(id => JOBS[id].name),
    ...save.legacy.talents.map(t => t.name)
  ];
  document.querySelector("#legacy-preview").innerHTML = tags.length
    ? `<div class="tag-list">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>`
    : "<p>Aucun héritage encore. La première vie commence sans spécialisation.</p>";
}

function summaryMarkup() {
  const r = save.run;
  const s = totals();
  const equipment = equippedBonuses();
  const journal = r.log.map(entry => `<li>${esc(entry)}</li>`).join("");
  return `<div class="dashboard"><div class="panel"><p class="eyebrow">Run actuelle</p><h2>${esc(r.name)} <span class="muted">· ${r.age} ans</span></h2><p>Classe : <b>${CLASSES[r.classId].name}</b> · ${masteryText({ xp: r.classXP })}<br>Métier : <b>${JOBS[r.jobId].name}</b> · ${masteryText({ xp: r.jobXP })}</p><p class="muted">Espérance de vie : ${fmtNumber(lifeExpectancy())} ans</p><div class="stat-grid">${STATS.map(([id, name]) => `<div class="stat"><span>${name}</span> <strong>${fmtNumber(s[id])} (${fmtNumber(equipment[id] || 0)})</strong></div>`).join("")}</div><p class="hp">PV ${fmtNumber(r.hp)} / ${fmtNumber(r.maxHp)}</p><div class="bar"><i style="width:${Math.max(0, Math.min(100, r.hp / r.maxHp * 100))}%"></i></div><p class="mana">Mana ${fmtNumber(r.mana)} / ${fmtNumber(s.maxMana)}</p><div class="bar"><i style="width:${Math.max(0, Math.min(100, r.mana / s.maxMana * 100))}%"></i></div></div><div class="panel"><h2>Journal de vie</h2><ul id="summary-event-log">${journal}</ul></div></div>`;
}

function studyMarkup() {
  const groups = Object.entries(
    availableStudies().reduce((out, study) => {
      const key = study.element ? "Études élémentaires" : "Études disponibles";
      (out[key] ||= []).push(study);
      return out;
    }, {})
  );
  return `<div class="panel"><h2>Études</h2><p class="muted">Les études accessibles dépendent de la classe et des connaissances du personnage.</p>${groups.map(([title, studies]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${studies.map(study => renderActionCard(study, `study:${study.id}`, study.element ? `${masteryText(save.run.elementMastery[study.element])} · +${study.gains.knowledge} Savoir` : fmtBonuses(study.gains))).join("")}</div></section>`).join("")}</div>`;
}

function trainingMarkup() {
  const activities = availableTraining();
  const weapons = activities.filter(activity => activity.weapon).map(activity =>
    renderActionCard(
      activity,
      `train:${activity.id}`,
      `${masteryText(save.run.weaponMastery[activity.weapon])} · ${fmtPassiveValues(masteryDomain(activity.weapon).passive)}`
    )
  ).join("");
  const physical = activities.find(activity => activity.id === "physical");
  const concentration = activities.find(activity => activity.id === "concentration");
  return `<div class="panel"><h2>Entraînement</h2><p class="muted">Chaque entraînement d'arme est réservé à sa branche de classe et nécessite de posséder l'arme correspondante. La progression de classe vient des statistiques associées ou des combats.</p><div class="action-grid">${physical ? renderActionCard(physical, "train:physical") : ""}${weapons}${concentration ? renderActionCard(concentration, "train:concentration", `Niveau ${save.run.techniqueMastery.concentration} · héritage : ${fmtPassiveValues(masteryDomain("concentration").passive)}`) : ""}</div></div>`;
}

function explorationMarkup() {
  runState();
  return `<div class="panel"><h2>Exploration</h2><p class="muted">Explorez les zones pour découvrir des ressources. Les combats se lancent exclusivement depuis le menu Combat.</p><div class="zone-grid">${ZONES.map(zone => zoneCard(zone, "explore")).join("")}</div></div>`;
}

function zoneCard(z, mode = "explore") {
  const r = runState();
  const s = totals();
  const req = z.req ? (z.req.stat ? `${statName(z.req.stat)} ${z.req.value}` : `${ELEMENTS[z.req.element]} niveau ${z.req.value}`) : "aucun";
  const locked = z.req && (z.req.stat ? s[z.req.stat] < z.req.value : level(r.elementMastery[z.req.element]?.xp || 0) < z.req.value);
  const discovered = r.discoveredZones.includes(z.id);
  const action = mode === "combat" ? `data-combat-zone="${z.id}"` : `data-explore-zone="${z.id}"`;
  const label = mode === "combat" ? "Combattre" : discovered ? "Explorer" : "Explorer la zone";
  const details = mode === "combat"
    ? `Difficulté ${z.difficulty} · Prérequis : ${req}`
    : `Ressources : ${z.reward.map(id => item(id).name).join(", ")} · Prérequis : ${req}`;
  return `<article class="zone-card ${locked ? "locked" : ""}"><header><strong>${z.name}</strong><span class="tag">${discovered ? "Découverte" : "Inconnue"} · Difficulté ${z.difficulty}</span></header><p>${z.description}<br><span class="muted">Ennemis : ${z.enemy.join(", ")}</span></p><small class="muted">${details}${mode === "combat" ? "" : "<br>Risque de rencontre : aucun"}</small><button class="primary-button" ${action} ${locked ? "disabled" : ""}>${label}</button></article>`;
}

function actionsMarkup() {
  const controls = `<div class="subtabs">${ACTION_SUBTABS.map(([id, name]) => `<button class="tab ${activeActionTab === id ? "active" : ""}" data-action-tab="${id}">${name}</button>`).join("")}</div>`;
  let content = "";
  if (activeActionTab === "study") content = studyMarkup();
  else if (activeActionTab === "training") content = trainingMarkup();
  else if (activeActionTab === "exploration") content = explorationMarkup();
  else if (activeActionTab === "work") {
    content = `<div class="panel"><h2>Travailler</h2><p class="muted">Les revenus et le rendement progressent avec la maîtrise du métier.</p><div class="action-grid">${renderActionCard({ name: `Travail de ${JOBS[save.run.jobId].name}`, description: `Rendement estimé : ${estimatedWork()} or.`, gains: {} }, "work", `${estimatedWork()} or · maîtrise ${masteryText({ xp: save.run.jobXP })}`)}</div></div>`;
  } else if (activeActionTab === "rest") {
    content = `<div class="panel"><h2>Se reposer</h2><p class="muted">Récupère les PV et le mana et peut guérir une maladie.</p><div class="action-grid">${renderActionCard({ name: "Repos réparateur", description: "Récupération avec une chance de guérison.", gains: {} }, "rest", "PV +18 · mana +12 · 1 an")}</div></div>`;
  }
  return `<div class="panel"><h2>Actions</h2><p class="muted">Chaque action principale fait avancer le personnage d'une année. Les cinq sous-onglets regroupent toutes les activités.</p>${controls}</div>${content}`;
}

function classJobMarkup() {
  const r = save.run;
  const cls = CLASSES[r.classId];
  const job = JOBS[r.jobId];
  const classChoices = save.legacy.unlockedClasses
    .filter(id => id !== r.classId && id !== "none" && canChangeClass(id))
    .map(id => `<button class="mini-button" data-select-class="${id}">${CLASSES[id].name}</button>`)
    .join("");
  const jobChoices = save.legacy.unlockedJobs
    .filter(id => id !== r.jobId && id !== "none")
    .map(id => `<button class="mini-button" data-select-job="${id}">${JOBS[id].name}</button>`)
    .join("");
  return `<div class="two-columns"><div class="panel"><h2>Classe et progression</h2><p><b>${cls.name}</b> · ${cls.description}</p><div class="summary-list"><div>Maîtrise actuelle : <b>${masteryText({ xp: r.classXP })}</b></div><div>Bonus actif : <b>${cls.stat ? fmtBonuses({ [cls.stat]: 1 }) : "aucun"}</b></div><div>Techniques propres : <b>${r.classId === "none" ? "aucune" : "progression spécifique à la classe"}</b></div></div><h3>Classes disponibles</h3><div class="tag-list">${classChoices || '<span class="empty">Aucune autre classe ou évolution disponible.</span>'}</div></div><div class="panel"><h2>Métier et maîtrise</h2><p><b>${job.name}</b> · ${job.description}</p><div class="summary-list"><div>Niveau actuel : <b>${masteryText({ xp: r.jobXP })}</b></div><div>XP : <b>${r.jobXP} / ${MASTERY_XP[6]}</b></div><div>Effet travail : <b>${job.work} or de base</b></div></div><h3>Métiers disponibles</h3><div class="tag-list">${jobChoices || '<span class="empty">Aucun autre métier disponible.</span>'}</div></div></div>`;
}

function marketMarkup() {
  const r = save.run;
  return `<div class="panel"><h2>Commerce</h2><p class="muted">Stock actuel · renouvellement à ${r.age % 5 === 0 ? "présent" : `${5 - r.age % 5} an(s)`}. Les quantités sont cumulables.</p><div class="item-grid">${r.shopStock.map(id => marketCard(item(id))).join("")}</div></div>`;
}

function marketCard(i) {
  if (!i) return "";
  const owned = qty(i.id);
  const kindDesc = i.kind === "equipment" ? "Équipement" : i.kind === "consumable" ? i.description : (i.description || "Objet spécial");
  return `<article class="item-card"><header><strong>${i.name}</strong><span class="price">${i.price} or</span></header><small class="muted">${i.rarity} · ${kindDesc}</small><small class="muted">Possédé : ${owned} · Revente : ${i.sell} or</small><button class="mini-button" data-buy="${i.id}" ${save.run.gold < i.price ? "disabled" : ""}>Acheter</button></article>`;
}

function inventoryMarkup() {
  const ids = Object.keys(save.run.inventory);
  return `<div class="panel"><h2>Inventaire</h2><p class="muted">Équipements et objets de valeur peuvent être possédés en plusieurs exemplaires. Les consommables sont utilisés selon leur quantité.</p><div class="item-grid">${ids.length ? ids.map(id => inventoryCard(item(id), qty(id))).join("") : '<p class="empty">Inventaire vide.</p>'}</div></div>`;
}

function inventoryCard(i, count) {
  if (!i) return "";
  const equipped = Object.values(save.run.equipment).includes(i.id);
  const req = Object.entries(i.req || {}).filter(([k, v]) => totals()[k] < v).map(([k, v]) => `${statName(k)} ${v}`);
  const classAction = i.classWeapon && canUseClassItem(i) ? `<button class="mini-button" data-use="${i.id}">Évoluer vers ${CLASSES[i.classWeapon]?.name || "la classe associée"}</button>` : "";
  return `<article class="item-card"><header><strong>${i.name}</strong><span class="tag">x${count}</span></header><small class="muted">${i.rarity} · ${i.kind} · ${i.sell} or à la vente</small>${i.bonus ? `<p>${fmtBonuses(i.bonus)}</p>` : `<p>${i.description || ""}</p>`}${i.kind === "equipment" ? `<small class="muted">Prérequis : ${req.join(", ") || "aucun"}</small><button class="mini-button" data-equip="${i.id}" ${req.length ? "disabled" : ""}>${equipped ? "Déséquiper" : "Équiper"}</button>${classAction}` : i.kind === "consumable" || i.classUnlock ? `<button class="mini-button" data-use="${i.id}">Utiliser</button>` : ""}<button class="secondary-button" data-sell="${i.id}">Vendre (${i.sell} or)</button></article>`;
}

function equipmentMarkup() {
  return `<div class="panel"><h2>Équipement · 9 emplacements</h2><p class="muted">Les prérequis sont exclusivement statistiques. Les bonus sont recalculés immédiatement.</p><div class="item-grid">${Object.entries(SLOTS).map(([slot, name]) => {
    const id = save.run.equipment[slot];
    const i = item(id);
    return `<article class="item-card"><strong>${name}</strong><p>${i ? `${i.name}<br>${fmtBonuses(i.bonus)}` : "Aucun objet équipé"}</p>${i ? `<button class="mini-button" data-equip="${i.id}">Retirer</button>` : ""}</article>`;
  }).join("")}</div></div>`;
}

function combatMarkup() {
  if (combat) return combatMarkupActive();
  return `<div class="panel"><h2>Combat</h2><p class="muted">Choisissez une zone pour lancer immédiatement un combat. Les combats sont indépendants de l'exploration.</p><div class="inline-actions"><label>Mode<select id="combat-mode"><option value="manual">Manuel</option><option value="auto" ${localStorage.getItem("retry-combat-mode") === "auto" ? "selected" : ""}>Automatique</option></select></label></div><div class="zone-grid">${ZONES.map(zone => zoneCard(zone, "combat")).join("")}</div></div>`;
}

function combatMarkupActive() {
  const c = combat;
  const e = c.enemy;
  const equipped = save.run.equippedAttacks.filter(Boolean);
  const combatAttacks = equipped.length ? equipped : ["punch"];
  return `<div class="panel"><div class="combat-head"><div><h2>${e.name}</h2><p class="hp">PV ${fmtNumber(Math.max(0, e.hp))} / ${fmtNumber(e.maxHp)}</p><div class="bar"><i style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></i></div><p>Résistances : ${Object.entries(e.res).map(([k, v]) => `${statName(RES_KEYS[k])} ${fmtNumber(v)}%`).join(" · ")}</p></div><div><h3>${save.run.name}</h3><p class="hp">PV ${fmtNumber(Math.ceil(save.run.hp))} / ${fmtNumber(save.run.maxHp)}</p><p class="mana">Mana ${fmtNumber(Math.ceil(save.run.mana))} / ${fmtNumber(Math.ceil(totals().maxMana))}</p><p>Mode : <b>${c.mode === "auto" ? "Automatique" : "Manuel"}</b> · Tour ${fmtNumber(c.turn)}</p></div></div>${c.mode === "manual" ? `<h3>Choisir une attaque</h3><div class="attack-grid">${combatAttacks.map(id => attackCard(ATTACKS.find(a => a.id === id))).join("")}</div>` : `<div class="notice">L'automatisation choisit une attaque adaptée à vos PV, votre mana et les résistances ennemies.<br><button class="primary-button" data-auto-turn>Résoudre le tour automatique</button></div>`}<div class="battle-log">${c.log.map(x => `<p>${esc(x)}</p>`).join("")}</div></div>`;
}

function attackCard(a) {
  if (!a) return '<article class="attack-card locked"><strong>Emplacement vide</strong><p>Aucune technique équipée.</p></article>';
  return `<article class="attack-card"><strong>${a.name}</strong><small>${a.damage || a.type} · puissance ${a.power} · Précision : ${a.accuracy} · ${a.mana} mana</small><p>${a.desc}</p><button class="mini-button" data-attack="${a.id}" ${save.run.mana < a.mana ? "disabled" : ""}>Utiliser</button></article>`;
}

function statsMarkup() {
  const r = save.run;
  const tot = totals();
  const eq = equippedBonuses();
  const slots = r.equippedAttacks.map((id, index) =>
    `<article class="attack-slot" data-attack-slot="${index}">${id ? `<strong>${ATTACKS.find(a => a.id === id)?.name || id}</strong><button class="mini-button" data-remove-attack-slot="${index}">Retirer</button>` : '<span class="muted">Emplacement vide</span>'}</article>`
  ).join("");
  const learned = r.learned.map(id => {
    const equipped = r.equippedAttacks.includes(id);
    return `<article class="attack-card" draggable="true" data-drag-attack="${id}"><strong>${ATTACKS.find(a => a.id === id)?.name || id}</strong><small>${equipped ? "Déjà équipée" : "Glisser ou équiper automatiquement"}</small><button class="mini-button" data-set-attack="${id}" ${equipped ? "disabled" : ""}>Équiper</button></article>`;
  }).join("");
  const detailedStats = [...STATS.map(([id, name]) => [id, name]), ...Object.entries(STAT_LABELS)];
  const detailed = detailedStats.map(([id, name]) =>
    `<div class="stat"><span>${name}</span><strong>${fmtNumber(tot[id] || 0)} (${fmtNumber(eq[id] || 0)})</strong></div>`
  ).join("");
  return `<div class="two-columns"><div class="panel"><h2>Statistiques de combat</h2><h3>Maîtrises d'armes</h3><table><tbody>${Object.entries(r.weaponMastery).map(([id, d]) => `<tr><td>${WEAPONS[id]}</td><td>${masteryText(d)}</td></tr>`).join("")}</tbody></table></div><div class="panel"><h2>Maîtrises élémentaires</h2><table><tbody>${Object.entries(r.elementMastery).map(([id, d]) => `<tr><td>${ELEMENTS[id]}</td><td>${masteryText(d)}</td></tr>`).join("")}</tbody></table></div><div class="panel"><h2>Statistiques détaillées</h2><div class="stat-grid">${detailed}</div></div><div class="panel"><h2>Emplacements d'attaques</h2><p class="muted">Cliquez sur Équiper pour remplir le premier emplacement libre, ou glissez une attaque pour choisir sa position.</p><div class="attack-slots">${slots}</div><h3>Attaques apprises</h3><div class="attack-grid">${learned}</div></div></div>`;
}

function fmtPassiveValues(values) {
  return Object.entries(values)
    .map(([key, value]) => `${value >= 0 ? "+" : ""}${fmtNumber(value)} ${STAT_LABELS[key] || PASSIVE_LABELS[key] || key}`)
    .join(", ") || "Aucun effet";
}

function masteryRows() {
  return Object.entries(MASTERY_DOMAINS)
    .filter(([id]) => id !== "class")
    .map(([id, domain]) => {
      const inherited = save.legacy.heritageDomains[id];
      if (!inherited || inherited.lastLevel <= 0) return "";
      const effect = fmtPassiveValues(inherited.permanent || {});
      const growth = (CLASSES[id] || JOBS[id])
        ? `<br>Bonus de croissance : +${fmtNumber(inherited.lastLevel * 0.5)} XP par gain associé.`
        : "";
      return `<article class="mastery-card"><header><strong>${domain.label}</strong><span class="tag">${domain.source}</span></header><p>Meilleur rang atteint : <b>${MASTERY_LEVELS[inherited.lastLevel]}</b> · par ${esc(inherited.lastCharacter || "Personnage historique")}</p><small class="muted">Effets : ${effect}${growth}</small></article>`;
    })
    .join("");
}

function characterHistoryMarkup() {
  const characters = save.legacy.characters || [];
  if (!characters.length) return '<p class="empty">Les personnages terminés apparaîtront ici.</p>';
  return `<table><thead><tr><th>Personnage</th><th>Statistiques principales</th><th>Classe / métier</th><th>Fin</th></tr></thead><tbody>${characters.map(c => `<tr><td>${esc(c.name)}</td><td>${STATS.map(([id, name]) => `${name} ${fmtNumber(c.stats?.[id] || 0)}`).join("<br>")}</td><td>Classe : ${CLASSES[c.classId].name} (${c.classLevel})<br>Métier : ${JOBS[c.jobId].name} (${c.jobLevel})</td><td>${c.age} ans</td></tr>`).join("")}</tbody></table>`;
}

function legacyMarkup() {
  return `<div class="panel"><h2>Héritage évolutif</h2><p class="muted">Chaque domaine conserve le meilleur rang atteint au cours des vies précédentes. Les effets affichés correspondent à ce meilleur rang.</p><div class="item-grid">${masteryRows()}</div></div><div class="panel"><h2>Historique</h2><p class="muted">${save.legacy.deaths} mort(s), ${save.legacy.abandoned} vie(s) abandonnée(s), record : ${save.legacy.bestAge} ans.</p>${characterHistoryMarkup()}</div>`;
}

const TAB_VIEWS = {
  summary: summaryMarkup,
  actions: actionsMarkup,
  classjob: classJobMarkup,
  market: marketMarkup,
  inventory: inventoryMarkup,
  equipment: equipmentMarkup,
  combat: combatMarkup,
  stats: statsMarkup,
  legacy: legacyMarkup
};

function renderGame() {
  ensureSaveShape();
  Object.entries(save.legacy.heritageDomains).forEach(([id, domain]) => {
    if (domain.lastLevel > 0) domain.permanent = heritageAcquired(id, domain.lastLevel);
  });
  document.querySelector("#tabs").innerHTML = TABS.map(([id, name]) =>
    `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`
  ).join("");
  document.querySelector("#tab-content").innerHTML = (TAB_VIEWS[activeTab] || actionsMarkup)();
  document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join("");
  document.querySelector(".log-card").classList.toggle("hidden", activeTab === "summary");
}

// ---------------------------------------------------------------------------
// 12. Event Listeners & Bootstrapping
// ---------------------------------------------------------------------------

function handleGameClick(e) {
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    activeTab = tab.dataset.tab;
    return renderGame();
  }
  const actionTab = e.target.closest("[data-action-tab]");
  if (actionTab) {
    activeActionTab = actionTab.dataset.actionTab;
    activeTab = "actions";
    return renderGame();
  }
  const action = e.target.closest("[data-action]");
  if (action) return doAction(action.dataset.action);

  const buyBtn = e.target.closest("[data-buy]");
  if (buyBtn) return buy(buyBtn.dataset.buy);

  const sellBtn = e.target.closest("[data-sell]");
  if (sellBtn) return sell(sellBtn.dataset.sell);

  const useBtn = e.target.closest("[data-use]");
  if (useBtn) return useItem(useBtn.dataset.use);

  const equipBtn = e.target.closest("[data-equip]");
  if (equipBtn) return equip(equipBtn.dataset.equip);

  const exploreZoneBtn = e.target.closest("[data-explore-zone]");
  if (exploreZoneBtn) return exploreZone(exploreZoneBtn.dataset.exploreZone);

  const combatZoneBtn = e.target.closest("[data-combat-zone]");
  if (combatZoneBtn) return startCombat(combatZoneBtn.dataset.combatZone, true);

  const attackBtn = e.target.closest("[data-attack]");
  if (attackBtn) return chooseAttack(attackBtn.dataset.attack);

  const setAttackBtn = e.target.closest("[data-set-attack]");
  if (setAttackBtn) return setAttack(setAttackBtn.dataset.setAttack);

  const removeSlotBtn = e.target.closest("[data-remove-attack-slot]");
  if (removeSlotBtn) return removeAttackFromSlot(Number(removeSlotBtn.dataset.removeAttackSlot));

  const selectClassBtn = e.target.closest("[data-select-class]");
  if (selectClassBtn) return chooseClass(selectClassBtn.dataset.selectClass);

  const selectJobBtn = e.target.closest("[data-select-job]");
  if (selectJobBtn) return chooseJob(selectJobBtn.dataset.selectJob);

  if (e.target.closest("[data-auto-turn]")) return autoTurn();
}

function setupEventListeners() {
  document.querySelector("#create-form")?.addEventListener("submit", startLife);
  document.querySelector("#new-life")?.addEventListener("click", abandonLife);

  const gameScreen = document.querySelector("#game-screen");
  if (!gameScreen) return;

  gameScreen.addEventListener("click", handleGameClick);

  gameScreen.addEventListener("change", e => {
    if (e.target.id === "combat-mode") {
      localStorage.setItem("retry-combat-mode", e.target.value);
      renderGame();
    }
  });

  gameScreen.addEventListener("dragstart", e => {
    const attack = e.target.closest("[data-drag-attack]");
    if (attack) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", attack.dataset.dragAttack);
    }
  });

  gameScreen.addEventListener("dragover", e => {
    if (e.target.closest("[data-attack-slot]")) {
      e.preventDefault();
    }
  });

  gameScreen.addEventListener("drop", e => {
    const slot = e.target.closest("[data-attack-slot]");
    if (slot) {
      equipAttackToSlot(e.dataTransfer.getData("text/plain"), Number(slot.dataset.attackSlot));
    }
  });
}

setupEventListeners();
persist();
renderCreate();
