import {
  WEAPONS, CLASSES, ATTACKS, STATUS, ZONES, ITEMS
} from "./game-data.js";
import { ENEMY_STATUS_EFFECTS, PLAYER_STATUS_EFFECTS } from "./status-config.js";
import { notify, item, esc, fmtNumber, statName } from "./game-helpers.js?v=3";
import { save, combat, setCombat, persist, runState, addItem } from "./state.js";
import { totals, inheritedBonuses, inheritedDomainBonuses } from "./formulas.js";
import { classLineage } from "./activities.js";
import { attackAvailability, classProgressionHistory, attackMasteryStats } from "./progression.js";
import { gainClassXp, gainMastery, advanceYear, die, log, refreshShop, completeAction } from "./actions.js";
import { renderGame } from "./ui.js";

export { ENEMY_STATUS_EFFECTS, PLAYER_STATUS_EFFECTS };

/**
 * Calculates damage-over-time for a status using static damage if configured,
 * otherwise percentage of enemy maxHp clamped to configured minimum damage.
 */
export function calculateStatusDotDamage(enemy, config) {
  if (!enemy || !config) return 0;
  if (Number.isFinite(config.damage)) {
    return Math.max(0, Math.round(config.damage));
  }
  if (Number.isFinite(config.damagePercent)) {
    const minDamage = Number.isFinite(config.minDamage) ? config.minDamage : 0;
    return Math.max(minDamage, Math.round(enemy.maxHp * config.damagePercent));
  }
  return 0;
}

/**
 * Normalizes player combat status entries into `{ id, duration, appliedThisTurn? }` objects.
 */
export function normalizePlayerStatuses(run) {
  if (!run) return [];
  if (!Array.isArray(run.statuses)) {
    run.statuses = [];
    return run.statuses;
  }
  const normalized = [];
  const seen = new Set();
  for (const entry of run.statuses) {
    const id = typeof entry === "string" ? entry : entry?.id;
    const config = PLAYER_STATUS_EFFECTS[id];
    if (!id || !config || seen.has(id)) continue;
    const duration = typeof entry === "object" && Number.isFinite(entry.duration)
      ? Math.max(0, Math.floor(entry.duration))
      : config.duration;
    if (duration <= 0) continue;
    seen.add(id);
    normalized.push({
      id,
      duration,
      ...(typeof entry === "object" && entry.appliedThisTurn ? { appliedThisTurn: true } : {})
    });
  }
  run.statuses = normalized;
  return normalized;
}

export function hasPlayerStatus(run, statusId) {
  return normalizePlayerStatuses(run).some(entry => entry.id === statusId && entry.duration > 0);
}

/**
 * Applies or refreshes status effects on the player without stacking duplicates.
 */
export function applyPlayerStatuses(run, statusIds) {
  if (!run || !statusIds?.length) return [];
  const statuses = normalizePlayerStatuses(run);
  const messages = [];

  for (const id of statusIds) {
    const config = PLAYER_STATUS_EFFECTS[id];
    if (!config) continue;
    const duration = config.duration;
    const label = STATUS[id] || id;
    const existing = statuses.find(entry => entry.id === id);

    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      if (config.appliedOnPlayerPhase) existing.appliedThisTurn = true;
      messages.push(`${label} prolongée (${existing.duration} tours)`);
    } else {
      const next = { id, duration };
      if (config.appliedOnPlayerPhase) next.appliedThisTurn = true;
      statuses.push(next);
      messages.push(`${label} active (${duration} tours)`);
    }
  }
  return messages;
}

/**
 * Decrements player combat status durations at the end of a round and removes expired effects.
 */
export function tickPlayerStatuses(run) {
  const statuses = normalizePlayerStatuses(run);
  const remaining = [];

  for (const entry of statuses) {
    if (entry.appliedThisTurn) {
      delete entry.appliedThisTurn;
      remaining.push(entry);
      continue;
    }
    entry.duration -= 1;
    if (entry.duration <= 0) {
      combat?.log.unshift(`Effet expiré sur ${run.name} : ${STATUS[entry.id] || entry.id}.`);
    } else {
      remaining.push(entry);
    }
  }

  run.statuses = remaining;
}

/**
 * Normalizes enemy status entries into `{ id, duration, appliedThisTurn? }` objects.
 */
export function normalizeEnemyStatuses(enemy) {
  if (!enemy) return [];
  if (!Array.isArray(enemy.statuses)) {
    enemy.statuses = [];
    return enemy.statuses;
  }
  const normalized = [];
  const seen = new Set();
  for (const entry of enemy.statuses) {
    const id = typeof entry === "string" ? entry : entry?.id;
    const config = ENEMY_STATUS_EFFECTS[id];
    if (!id || !config || seen.has(id)) continue;
    const duration = typeof entry === "object" && Number.isFinite(entry.duration)
      ? Math.max(0, Math.floor(entry.duration))
      : config.duration;
    if (duration <= 0) continue;
    seen.add(id);
    normalized.push({
      id,
      duration,
      ...(typeof entry === "object" && entry.appliedThisTurn ? { appliedThisTurn: true } : {})
    });
  }
  enemy.statuses = normalized;
  return normalized;
}

export function hasEnemyStatus(enemy, statusId) {
  return normalizeEnemyStatuses(enemy).some(entry => entry.id === statusId && entry.duration > 0);
}

/**
 * Applies or refreshes status effects on an enemy, avoiding duplicate entries.
 */
export function applyEnemyStatuses(enemy, statusSpecs, defaultChance = 1) {
  if (!enemy || !statusSpecs?.length) return [];
  const statuses = normalizeEnemyStatuses(enemy);
  const appliedIds = new Set();
  const messages = [];

  for (const spec of statusSpecs) {
    const id = typeof spec === "string" ? spec : spec?.id;
    const config = ENEMY_STATUS_EFFECTS[id];
    if (!id || !config || appliedIds.has(id)) continue;
    appliedIds.add(id);

    const chance = typeof spec === "object" && Number.isFinite(spec.chance) ? spec.chance : defaultChance;
    if (chance < 1 && Math.random() >= chance) continue;

    const duration = typeof spec === "object" && Number.isFinite(spec.duration)
      ? Math.max(1, Math.floor(spec.duration))
      : config.duration;
    const existing = statuses.find(entry => entry.id === id);
    const label = STATUS[id] || id;
    const turnUnit = duration > 1 ? "tours" : "tour";

    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      if (config.appliedOnPlayerPhase) existing.appliedThisTurn = true;
      messages.push(`Effet prolongé : ${label} (${existing.duration} ${existing.duration > 1 ? "tours" : "tour"})`);
    } else {
      const next = { id, duration };
      if (config.appliedOnPlayerPhase) next.appliedThisTurn = true;
      statuses.push(next);
      messages.push(`Effet appliqué : ${label} (${duration} ${turnUnit})`);
    }
  }
  return messages;
}

/**
 * Processes start-of-enemy-turn status effects (DoT damage and action prevention).
 */
export function processEnemyTurnStatuses(enemy) {
  const statuses = normalizeEnemyStatuses(enemy);
  let stunned = false;

  for (const entry of statuses) {
    const config = ENEMY_STATUS_EFFECTS[entry.id];
    if (!config) continue;

    if (config.damage != null || config.damagePercent != null) {
      const dmg = calculateStatusDotDamage(enemy, config);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      combat.log.unshift(`${enemy.name} subit ${dmg} dégâts (${STATUS[entry.id] || entry.id}).`);
      if (enemy.hp <= 0) {
        combat.log.unshift(`${enemy.name} succombe à ses effets de statut.`);
        return { diedFromStatus: true, stunned };
      }
    }

    if (config.preventsAction) {
      stunned = true;
    }
  }

  return { diedFromStatus: false, stunned };
}

/**
 * Decrements enemy status durations at the end of a round and removes expired effects.
 */
export function tickEnemyStatuses(enemy) {
  const statuses = normalizeEnemyStatuses(enemy);
  const remaining = [];

  for (const entry of statuses) {
    if (entry.appliedThisTurn) {
      delete entry.appliedThisTurn;
      remaining.push(entry);
      continue;
    }
    entry.duration -= 1;
    if (entry.duration <= 0) {
      combat.log.unshift(`Effet expiré sur ${enemy.name} : ${STATUS[entry.id] || entry.id}.`);
    } else {
      remaining.push(entry);
    }
  }

  enemy.statuses = remaining;
}

export function enemyFor(zone) {
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

export function startCombat(zoneId, force = false) {
  if (combat) return;
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
      if (item(reward).kind === "ingredient") r.ingredients = (r.ingredients || 0) + 1;
    }
    const result = reward
      ? `Exploration de ${z.name} sans combat : ${item(reward).name} x1 trouvé.`
      : `Exploration de ${z.name} sans combat : aucune ressource trouvée.`;
    return completeAction(result, { agility: 0.2, luck: 0.15 });
  }
  const combatObj = {
    zone: z,
    enemy: enemyFor(z),
    mode: document.querySelector("#combat-mode")?.value || "manual",
    turn: 1,
    log: [`Entrée dans ${z.name}. Une rencontre survient (${Math.round(chance * 100)}%).`],
    finished: false
  };
  setCombat(combatObj);
  localStorage.setItem("retry-combat-mode", combatObj.mode);
  renderGame();
  if (combatObj.mode === "auto") setTimeout(autoTurn, 80);
}

export function chooseAttack(id) {
  if (!combat || combat.finished) return;
  const a = ATTACKS.find(x => x.id === id);
  resolveRound(a);
}

export function autoTurn() {
  if (!combat || combat.finished) return;
  const e = combat.enemy;
  const manaEfficiency = inheritedBonuses().manaEfficiency || 0;
  const usable = save.run.equippedAttacks
    .filter(Boolean)
    .map(id => ATTACKS.find(a => a.id === id))
    .filter(a => {
    if (!a) return false;
      const stats = attackMasteryStats(save.run, a);
      const cost = Math.max(0, Math.ceil(stats.mana * (1 - manaEfficiency / 100)));
      return attackAvailability(save.run, a, cost).available;
    });
    const a = usable.find(x => x.type === "heal" && save.run.hp < save.run.maxHp * 0.42)
      || usable.filter(x => x.type !== "heal").sort((x, y) => {
      const px = attackMasteryStats(save.run, x).power;
      const py = attackMasteryStats(save.run, y).power;
      return (py - (e.res[y.damage] || 0)) - (px - (e.res[x.damage] || 0));
    })[0]
    || usable[0];
  resolveRound(a || ATTACKS[0]);
}

export function resolveRound(a) {
  if (!a || !combat || combat.finished) return;
  const r = save.run;
  const e = combat.enemy;
  normalizeEnemyStatuses(e);
  normalizePlayerStatuses(r);
  const inherited = inheritedBonuses();
  const weaponLegacy = inheritedDomainBonuses(a.weapon);
  const elementLegacy = inheritedDomainBonuses(a.element);
  const tot = totals();
const stats = attackMasteryStats(r, a);
  const levelTag = (a.weapon || a.element) ? ` (${stats.levelLabel})` : "";
  let line = `Tour ${combat.turn} : ${a.name}${levelTag}.`;
  const cost = Math.max(0, Math.ceil(stats.mana * (1 - (inherited.manaEfficiency || 0) / 100)));
  const check = attackAvailability(r, a, cost);
  if (!check.available) return notify(check.reasons[0] || "Attaque indisponible.");
  r.mana -= cost;
  if (a.classId && (classLineage(r.classId).includes(a.classId) || classProgressionHistory(r).includes(a.classId))) {
    const classXp = gainClassXp(0.25, classLineage(r.classId).includes(a.classId) ? null : a.classId);
    line += ` +${classXp} XP de classe.`;
    log(`Attaque de ${CLASSES[a.classId].name} : +${classXp} XP de classe.`);
  }
  if (a.type === "heal") {
    const heal = 16 + tot.magicPower * 0.4;
    r.hp = Math.min(r.maxHp, r.hp + heal);
    line += ` Soin de ${Math.round(heal)} PV.`;
  } else if (a.type === "buff") {
    const guardMsgs = applyPlayerStatuses(r, ["guard"]);
    line += ` ${guardMsgs.length ? guardMsgs.join(", ") : "Protection active"}.`;
  } else {
  if (Math.random() * 100 > stats.accuracy + (tot.accuracy - 80) + (weaponLegacy.accuracy || 0)) {
      line += " L'attaque échoue.";
    } else {
      let damage = stats.power +
        (a.type === "magic" ? tot.magicPower + (elementLegacy.magicPower || 0) : tot.strength * 0.7) +
        (a.luckScaling ? tot.luck * a.luckScaling : 0) +
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
      if (hasEnemyStatus(e, "defenseDown")) {
        damage *= ENEMY_STATUS_EFFECTS.defenseDown.damageMultiplier;
        line += " Défense réduite augmente les dégâts.";
      }
      const resist = e.res[a.damage] || 0;
      damage *= Math.max(0.2, 1 - resist / 100);
      const critChance = tot.crit + (a.luckCritBonus ? tot.luck * 0.5 + a.luckCritBonus : 0);
      const critical = Math.random() * 100 < critChance;
      if (critical) damage *= tot.critDamage / 100;
      damage = Math.max(1, Math.round(damage));
      e.hp = Math.max(0, e.hp - damage);
      line += ` ${damage} dégâts${critical ? " critiques" : ""} (${resist}% résistance appliquée).`;
      if (a.weapon) {
        const masteryGain = gainMastery("weaponMastery", a.weapon, 1);
        log(`Attaque avec ${WEAPONS[a.weapon]} : +${masteryGain} XP de compétence.`);
      }
      if (e.hp > 0 && a.status?.length) {
        const statusMessages = applyEnemyStatuses(e, a.status, a.statusChance ?? 1);
        if (statusMessages.length) {
          line += ` ${statusMessages.join(", ")}.`;
        }
      }
    }
  }
  combat.log.unshift(line);
  if (e.hp <= 0) return finishCombat(true);

  const statusTurn = processEnemyTurnStatuses(e);
  if (statusTurn.diedFromStatus) return finishCombat(true);

  if (statusTurn.stunned) {
    combat.log.unshift(`${e.name} est étourdi et ne peut pas agir ce tour.`);
  } else {
    const isSlowed = hasEnemyStatus(e, "slow");
    let enemyDamage = Math.max(1, Math.round(5 + combat.zone.difficulty * 2 - tot.defense * 0.18));
    if (isSlowed) {
      enemyDamage = Math.max(1, Math.round(enemyDamage * ENEMY_STATUS_EFFECTS.slow.damageMultiplier));
    }
    const isGuarded = hasPlayerStatus(r, "guard");
    const damageTaken = isGuarded
      ? Math.max(1, Math.round(enemyDamage * PLAYER_STATUS_EFFECTS.guard.damageMultiplier))
      : enemyDamage;
    r.hp -= damageTaken;
    combat.log.unshift(`${e.name} inflige ${damageTaken} dégâts${isSlowed ? " (ralenti)" : ""}${isGuarded ? " (Garde)" : ""}.`);
    if (r.hp <= 0 && Math.random() < 0.12) {
      r.hp = 1;
      combat.log.unshift("Dernier souffle : vous survivez à l'attaque mortelle.");
    }
    if (r.hp <= 0) return finishCombat(false);
  }

  tickEnemyStatuses(e);
  tickPlayerStatuses(r);
  combat.turn++;
  persist();
  renderGame();
  if (combat.mode === "auto") setTimeout(autoTurn, 100);
}

export function finishCombat(win) {
  if (!combat || combat.finished) return;
  const r = save.run;
  const z = combat.zone;
  const e = combat.enemy;
  combat.finished = true;
  e.statuses = [];
  if (r) r.statuses = [];
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
  if (item(reward).kind === "ingredient") r.ingredients = (r.ingredients || 0) + 1;
  gained.push(`${item(reward).name} x1`);
  const classXp = gainClassXp(2);
  combat.log.unshift(`Victoire dans ${z.name} contre ${e.name}.`);
  combat.log.unshift(`Récompenses réellement obtenues : ${gained.join(", ")}${classXp ? ` · +${classXp} XP de classe` : ""}.`);
  log(`Combat remporté dans ${z.name} contre ${e.name} : ${gained.join(", ")}${classXp ? ` ; +${classXp} XP de classe` : ""}.`);
  advanceYear();
  if (!save.run) return;
  setCombat(null);
  persist();
  renderGame();
}
