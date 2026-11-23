import {
  WEAPONS, CLASSES, ATTACKS, STATUS, ZONES, ITEMS
} from "./game-data.js";
import { notify, item, esc, fmtNumber, statName } from "./game-helpers.js?v=3";
import { save, combat, setCombat, persist, runState, addItem } from "./state.js";
import { totals, inheritedBonuses, inheritedDomainBonuses } from "./formulas.js";
import { classLineage } from "./activities.js";
import { gainClassXp, gainMastery, advanceYear, die, log, refreshShop, completeAction } from "./actions.js";
import { renderGame } from "./ui.js";

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
  const usable = save.run.equippedAttacks
    .filter(Boolean)
    .map(id => ATTACKS.find(a => a.id === id))
    .filter(a => a && save.run.mana >= a.mana);
  const a = usable.find(x => x.type === "heal" && save.run.hp < save.run.maxHp * 0.42)
    || usable.filter(x => x.type !== "heal").sort((x, y) => ((y.power || 0) - (e.res[y.damage] || 0)) - ((x.power || 0) - (e.res[x.damage] || 0)))[0]
    || usable[0];
  resolveRound(a || ATTACKS[0]);
}

export function resolveRound(a) {
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

export function finishCombat(win) {
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
  setCombat(null);
  persist();
  renderGame();
}
