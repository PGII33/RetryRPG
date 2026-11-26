import {
  MASTERY_LEVELS, MASTERY_XP, MASTERY_DOMAINS, WEAPONS, ELEMENTS, CLASSES, ATTACKS, CLASS_STARTING_EQUIPMENT
} from "./game-data.js";
import { fmtNumber, item } from "./game-helpers.js?v=3";

export const DEFAULT_RANK_CURVE = [1, 2, 3, 4, 5, 6, 7];

export const HERITAGE_RANK_VALUES = {
  class: DEFAULT_RANK_CURVE
};

export const CLASS_EVOLUTION_STATS = {
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

export function masteryDomain(id) {
  return MASTERY_DOMAINS[id] || { label: id, source: "Autres", passive: {} };
}

export function level(xp) {
  return Math.max(
    0,
    Math.min(
      MASTERY_LEVELS.length - 1,
      MASTERY_XP.reduce((n, threshold) => (xp >= threshold ? n + 1 : n), 0) - 1
    )
  );
}

export function masteryText(data) {
  return `${MASTERY_LEVELS[level(data.xp)]} (${fmtNumber(data.xp)} XP)`;
}

export function heritageRankValue(id, rank) {
  if (rank <= 0) return 0;
  const values = HERITAGE_RANK_VALUES[id] || DEFAULT_RANK_CURVE;
  return values[Math.max(0, Math.min(values.length - 1, rank - 1))];
}

export function heritageProgress(id, run) {
  if (!run) return { xp: 0, level: 0 };
  if (WEAPONS[id]) return { xp: run.weaponMastery?.[id]?.xp || 0, level: level(run.weaponMastery?.[id]?.xp || 0) };
  if (ELEMENTS[id]) return { xp: run.elementMastery?.[id]?.xp || 0, level: level(run.elementMastery?.[id]?.xp || 0) };
  if (CLASSES[id] && id !== "none") {
    const xp = run.classXPById?.[id] ?? (run.classId === id ? run.classXP || 0 : 0);
    return { xp, level: level(xp) };
  }
  if (id === "class") return { xp: 0, level: 0 };
  if (id === "concentration") {
    const conc = run.techniqueMastery?.concentration;
    const xp = typeof conc === "object" ? (conc?.xp || 0) : (conc || 0) * 5;
    return { xp, level: level(xp) };
  }
  if (id === "manaExpansion") {
    const xp = run.techniqueMastery?.manaExpansion?.xp || 0;
    return { xp, level: level(xp) };
  }
  const jobXp = run.jobId === id ? run.jobXP || 0 : 0;
  return { xp: jobXp, level: level(jobXp) };
}

export function classHeritageValues(id, rank) {
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

export function heritageAcquired(id, rank) {
  if (CLASSES[id] && id !== "none") return classHeritageValues(id, rank);
  const multiplier = heritageRankValue(id, rank);
  return Object.fromEntries(
    Object.entries(masteryDomain(id).passive).map(([key, value]) => [key, +(value * multiplier).toFixed(2)])
  );
}

export function learnAttack(run, id) {
  if (run.learned.includes(id)) return;
  run.learned.push(id);
  const slot = run.equippedAttacks.findIndex(value => !value);
  if (slot >= 0) run.equippedAttacks[slot] = id;
}

export function classProgressionHistory(run) {
  if (!run) return [];
  const history = Array.isArray(run.classHistory) ? [...run.classHistory] : [];
  if (run.classId && run.classId !== "none" && !history.includes(run.classId)) {
    history.push(run.classId);
  }
  return history;
}

export function ensureClassAttack(run) {
  const history = classProgressionHistory(run);
  ATTACKS.filter(a => a.classId && history.includes(a.classId))
    .forEach(attack => learnAttack(run, attack.id));
}

export function hasEquippedWeapon(run, weaponType) {
  if (!weaponType || weaponType === "unarmed") return true;
  return Object.values(run?.equipment || {}).some(itemId => item(itemId)?.weapon === weaponType);
}

/**
 * Evaluates class progression, weapon equipment, and mana prerequisites for an attack.
 */
export function attackAvailability(run, attack, effectiveManaCost = null) {
  if (!run || !attack) {
    return {
      available: false,
      reasons: ["Attaque indisponible."],
      missingClass: null,
      missingWeapon: null,
      insufficientMana: false,
      manaCost: 0
    };
  }
  const reasons = [];
  let missingClass = null;
  let missingWeapon = null;
  let insufficientMana = false;
  const manaCost = effectiveManaCost ?? (attack.mana || 0);

  if (attack.classId && !classProgressionHistory(run).includes(attack.classId)) {
    missingClass = CLASSES[attack.classId]?.name || attack.classId;
    reasons.push(`Classe requise : ${missingClass}`);
  }
  if (attack.weapon && !hasEquippedWeapon(run, attack.weapon)) {
    missingWeapon = WEAPONS[attack.weapon] || attack.weapon;
    reasons.push(`Arme requise : ${missingWeapon}`);
  }
  if ((run.mana || 0) < manaCost) {
    insufficientMana = true;
    reasons.push(`Mana insuffisant (${manaCost} requis)`);
  }

  return {
    available: reasons.length === 0,
    reasons,
    missingClass,
    missingWeapon,
    insufficientMana,
    manaCost
  };
}

export function startingEquipmentForClass(classId) {
  return CLASS_STARTING_EQUIPMENT[classId] || CLASS_STARTING_EQUIPMENT.none || null;
}

export function grantStartingEquipment(run) {
  if (!run) return null;
  const itemId = startingEquipmentForClass(run.classId);
  const equipmentItem = item(itemId);
  if (!equipmentItem) return null;

  run.inventory ||= {};
  run.equipment ||= {};
  run.inventory[itemId] = (run.inventory[itemId] || 0) + 1;

  if (equipmentItem.kind === "equipment" && equipmentItem.slot && !run.equipment[equipmentItem.slot]) {
    const meetsReq = Object.entries(equipmentItem.req || {}).every(([k, v]) => (run.stats?.[k] || 0) >= v);
    if (meetsReq) {
      run.equipment[equipmentItem.slot] = itemId;
    }
  }
  return equipmentItem;
}
