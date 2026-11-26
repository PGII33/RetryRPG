import {
  CLASSES, JOBS, STATS, STAT_LABELS, PASSIVE_LABELS, WEAPONS, ELEMENTS, MASTERY_DOMAINS
} from "./game-data.js";
import { fmtNumber, statName } from "./game-helpers.js?v=3";
import { save, equippedBonuses } from "./state.js";
import {
  level, heritageProgress, heritageAcquired
} from "./progression.js";

export function historicalLevel(id) {
  return save.legacy.heritageDomains?.[id]?.lastLevel || level(save.legacy.masteryBonuses?.[id]?.bestXp || 0);
}

export function historicalClassJobLevels() {
  const classTotal = Object.keys(CLASSES)
    .filter(id => id !== "none")
    .reduce((sum, id) => sum + historicalLevel(id), 0);
  const jobTotal = Object.keys(JOBS)
    .filter(id => id !== "none")
    .reduce((sum, id) => sum + historicalLevel(id), 0);
  return classTotal + jobTotal;
}

export function lifeExpectancy() {
  return 30 + historicalClassJobLevels() * 0.5;
}

export function growthXp(base, domainId) {
  return +(base + historicalLevel(domainId) * 0.5).toFixed(2);
}

export function recordLegacyMasteries(run) {
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

export function inheritedBonuses() {
  const out = {};
  Object.entries(save.legacy.heritageDomains || {}).forEach(([id, domain]) => {
    if (WEAPONS[id] || ELEMENTS[id] || id === "class") return;
    Object.entries(domain.permanent || {}).forEach(([key, value]) => {
      out[key] = (out[key] || 0) + value;
    });
  });
  return out;
}

export function inheritedDomainBonuses(id) {
  return save.legacy.heritageDomains?.[id]?.permanent || {};
}

export function totals() {
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
    maxMana: 25 + s.magic * 4 + s.knowledge * 2 + (eq.maxMana || 0) + (inherited.maxMana || 0) + (level(r.techniqueMastery?.manaExpansion?.xp || 0) * 10),
    manaRegen: 2 + Math.floor(s.magic / 5) + (eq.manaRegen || 0) + (level(typeof r.techniqueMastery?.concentration === "object" ? (r.techniqueMastery.concentration.xp || 0) : (r.techniqueMastery?.concentration || 0) * 5) * 0.5) + (inherited.manaRegen || 0),
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

export function estimatedWork() {
  const r = save.run;
  if (!r) return 0;
  const job = JOBS[r.jobId];
  if (!job) return 0;
  return Math.round(
    job.work * (1 + level(r.jobXP) * 0.12) +
    (r.jobId === "merchant" ? Math.floor(r.gold * 0.03) : 0) +
    (inheritedDomainBonuses(r.jobId).workGold || 0)
  );
}

export function fmtPassiveValues(values) {
  return Object.entries(values)
    .map(([key, value]) => `${value >= 0 ? "+" : ""}${fmtNumber(value)} ${PASSIVE_LABELS[key] || statName(key)}`)
    .join(", ") || "Aucun effet";
}

export { level, masteryText, masteryDomain, heritageAcquired } from "./progression.js";
