import {
  CLASSES, JOBS, STATS, WEAPONS, ELEMENTS, ITEMS, ATTACKS, RANDOM_NAMES, ZONES, MASTERY_DOMAINS
} from "./game-data.js";
import { notify, statName, fmtBonuses, item } from "./game-helpers.js?v=3";
import {
  save, persist, runState, qty, addItem, removeItem, setSaveRun, setCombat, newRun, combat
} from "./state.js";
import {
  totals, lifeExpectancy, level, masteryText, growthXp, historicalLevel, recordLegacyMasteries, estimatedWork
} from "./formulas.js";
import {
  classLineage, canChangeClass, canUseClassItem, elementalStudyGain, availableStudies, availableTraining, STUDIES, TRAINING,
  merchantTradeItems
} from "./activities.js";
import { learnAttack, ensureClassAttack, grantStartingEquipment, startingEquipmentForClass } from "./progression.js";
import { renderGame, renderCreate } from "./ui.js";

export const BASE_JOB_XP = 0.5;

export function log(text) {
  save.run.log.unshift(`${save.run.age} ans : ${text}`);
  save.run.log = save.run.log.slice(0, 60);
}

export function unlockChecks() {
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

export function contractDisease() {
  if (save.run.diseases.length) return;
  const names = [["Rhume", "Légère", 1], ["Fièvre des marais", "Modérée", 2], ["Peste grise", "Grave", 3]];
  const d = names[Math.floor(Math.random() * names.length)];
  save.run.diseases.push({ name: d[0], severity: d[1], progression: d[2] });
  log(`Maladie contractée : ${d[0]} (${d[1]}).`);
}

export function progressDisease() {
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

export function advanceYear() {
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

export function gainStat(key, amount = 0.1) {
  save.run.stats[key] += amount;
}

export function gainClassXp(base, domainId = null) {
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

export function gainJobXp(base) {
  if (!save.run || save.run.jobId === "none" || base <= 0) return 0;
  const gained = growthXp(base, save.run.jobId);
  const beforeLevel = level(save.run.jobXP);
  save.run.jobXP += gained;
  if (level(save.run.jobXP) > beforeLevel) {
    log(`Niveau de métier atteint : ${masteryText({ xp: save.run.jobXP })}.`);
  }
  return gained;
}

export function gainMastery(kind, id, amount = 1) {
  save.run[kind] ||= {};
  let d = save.run[kind][id];
  if (typeof d === "number") {
    save.run[kind][id] = { xp: d * 5 };
    d = save.run[kind][id];
  } else if (!d) {
    save.run[kind][id] = { xp: 0 };
    d = save.run[kind][id];
  }
  const beforeLevel = level(d.xp);
  const histLevel = historicalLevel(id);
  const masteryBonus = +(Math.max(beforeLevel, histLevel) * 0.5).toFixed(2);
  const totalAmount = +(amount + masteryBonus).toFixed(2);
  d.xp = +(d.xp + totalAmount).toFixed(2);

  const unlocks = kind === "elementMastery"
    ? { fire: ["fire"], ice: ["ice"], wind: ["wind"], earth: ["earth"] }
    : { sword: ["slash"], spear: ["pierce"], hammer: ["smash"], bow: ["shot"], catalyst: ["wind"] };
  const technique = unlocks[id]?.[0];
  if (technique && d.xp >= 8 && !save.run.learned.includes(technique)) {
    learnAttack(save.run, technique);
    log(`Technique débloquée : ${ATTACKS.find(a => a.id === technique)?.name}.`);
  }
  const label = kind === "weaponMastery" ? WEAPONS[id] : kind === "elementMastery" ? ELEMENTS[id] : MASTERY_DOMAINS[id]?.label || id;
  if (level(d.xp) > beforeLevel) {
    log(`Niveau de compétence atteint : ${label} · ${masteryText(d)}.`);
  }
  return totalAmount;
}

export function completeAction(text, gains = {}, shouldAdvance = true) {
  if (shouldAdvance) advanceYear();
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

export function rest() {
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

export function doAction(id) {
  if (combat) return notify("Impossible d'effectuer une action pendant un combat.");
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
    let masteryGain = 0;
    if (type.startsWith("weapon-")) {
      masteryGain = gainMastery("weaponMastery", type.slice(7), 2);
    } else if (type === "concentration") {
      masteryGain = gainMastery("techniqueMastery", "concentration", 2);
    }
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
    const jobXp = gainJobXp(BASE_JOB_XP);
    r.gold += earnings;
    save.legacy.goldEarned += earnings;
    r.workActions++;
    return completeAction(
      `Travail de ${job.name} : +${earnings} or${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      job.stat ? { [job.stat]: 0.2 } : {}
    );
  }
  if (id === "work:bread") {
    if (r.jobId !== "farmer") return notify("Cette activité est réservée aux fermiers.");
    addItem("bread");
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    return completeAction(
      `Travail de Fermier : Pain produit et ajouté à l'inventaire${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { constitution: 0.2 }
    );
  }
  if (id === "work:merchant:items") {
    if (r.jobId !== "merchant") return notify("Cette activité est réservée aux marchands.");
    const items = merchantTradeItems();
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    if (items.length) {
      items.forEach(it => {
        addItem(it.id);
        r.itemsFound++;
        if (it.kind === "material") r.materials++;
        if (it.kind === "ingredient") r.ingredients = (r.ingredients || 0) + 1;
      });
      const names = items.map(it => it.name).join(", ");
      const totalVal = items.reduce((sum, it) => sum + it.price, 0);
      return completeAction(
        `Commerce de Marchand : ${names} obtenu(s) (valeur d'achat : ${totalVal} po)${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
        { luck: 0.2 }
      );
    } else {
      return completeAction(
        `Commerce de Marchand : aucune marchandise abordable trouvée${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
        { luck: 0.2 }
      );
    }
  }
  if (id.startsWith("work:gambler:")) {
    if (r.jobId !== "gambler") return notify("Cette activité est réservée aux parieurs.");
    if (r.gold <= 0) return notify("Vous n'avez pas d'or à miser.");
    const betType = id.slice(13);
    let betRatio = 0.25;
    let multiplier = 1.6;
    let baseChance = 0.58;
    let label = "Pari prudent";

    if (betType === "bold") {
      betRatio = 0.5;
      multiplier = 2.5;
      baseChance = 0.38;
      label = "Pari audacieux";
    } else if (betType === "allin") {
      betRatio = 1.0;
      multiplier = 4.0;
      baseChance = 0.18;
      label = "Tout ou rien";
    }

    const bet = betRatio === 1.0 ? r.gold : Math.max(1, Math.floor(r.gold * betRatio));
    if (bet <= 0 || r.gold < bet) return notify("Vous n'avez pas assez d'or pour miser.");

    const luck = totals().luck || 0;
    const maxCap = betType === "allin" ? 0.80 : betType === "bold" ? 0.90 : 0.95;
    const chance = Math.min(maxCap, Math.max(0.05, baseChance + luck * 0.02));
    const won = Math.random() < chance;

    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);

    if (won) {
      const netGain = Math.round(bet * (multiplier - 1));
      r.gold += netGain;
      save.legacy.goldEarned += netGain;
      return completeAction(
        `${label} réussi ! Gain : +${netGain} or (${Math.round(bet * multiplier)} po au total)${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
        { luck: 0.2 }
      );
    } else {
      r.gold -= bet;
      return completeAction(
        `${label} perdu... Vous perdez ${bet} or${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
        { luck: 0.2 }
      );
    }
  }
  if (id === "work:scholar:read") {
    if (r.jobId !== "scholar") return notify("Cette activité est réservée aux érudits.");
    if ((r.gold || 0) < 20) return notify("Vous n'avez pas assez d'or (20 po nécessaires).");
    r.gold -= 20;
    r.mana = Math.min(totals().maxMana, r.mana + 15);
    const mg = gainMastery("techniqueMastery", "manaExpansion", 2);
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    return completeAction(
      `Lecture arcanique : -20 or · +${mg} XP en Expansion de mana${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { knowledge: 0.25, magic: 0.2 }
    );
  }
  if (id === "work:blacksmith:upgrade:gold") {
    if (r.jobId !== "blacksmith") return notify("Cette activité est réservée aux forgerons.");
    if ((r.gold || 0) < 30) return notify("Vous n'avez pas assez d'or (30 po nécessaires).");
    r.gold -= 30;
    r.equipmentRefinement = (r.equipmentRefinement || 0) + 1;
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    return completeAction(
      `Forge (or) : Équipement renforcé au rang +${r.equipmentRefinement} (-30 or)${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { strength: 0.25 }
    );
  }
  if (id === "work:blacksmith:upgrade:materials") {
    if (r.jobId !== "blacksmith") return notify("Cette activité est réservée aux forgerons.");
    let usedMat = null;
    if (qty("ore") > 0) { removeItem("ore"); usedMat = "Minerai de fer"; }
    else if (qty("ember") > 0) { removeItem("ember"); usedMat = "Braise élémentaire"; }
    else if ((r.materials || 0) > 0) { r.materials--; usedMat = "Matériau brut"; }
    else return notify("Aucun matériau disponible dans l'inventaire.");

    r.equipmentRefinement = (r.equipmentRefinement || 0) + 1;
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    return completeAction(
      `Forge (matériaux) : Équipement renforcé au rang +${r.equipmentRefinement} (-1 ${usedMat})${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { strength: 0.25 }
    );
  }
  if (id === "work:alchemist:cure:gold") {
    if (r.jobId !== "alchemist") return notify("Cette activité est réservée aux alchimistes.");
    if (!r.diseases.length) return notify("Vous ne souffrez d'aucune maladie à soigner.");
    if ((r.gold || 0) < 25) return notify("Vous n'avez pas assez d'or (25 po nécessaires).");
    r.gold -= 25;
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    advanceYear();
    const cured = r.diseases.shift() || { name: "Maladie" };
    return completeAction(
      `Remède alchimique (or) : ${cured.name} guérie à coup sûr (-25 or)${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { knowledge: 0.2 },
      false
    );
  }
  if (id === "work:alchemist:gather") {
    if (r.jobId !== "alchemist") return notify("Cette activité est réservée aux alchimistes.");
    const pool = ITEMS.filter(i => i.kind === "ingredient");
    if (!pool.length) return notify("Aucun ingrédient défini dans le catalogue.");
    const foundCount = estimatedAlchemistHarvest();
    const counts = {};
    for (let k = 0; k < foundCount; k++) {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      addItem(picked.id);
      counts[picked.name] = (counts[picked.name] || 0) + 1;
    }
    r.itemsFound += foundCount;
    r.ingredients = (r.ingredients || 0) + foundCount;
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    const summary = Object.entries(counts).map(([name, n]) => `${name} x${n}`).join(", ");
    return completeAction(
      `Recherche d'ingrédients : ${summary} récolté(s)${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { knowledge: 0.2, luck: 0.1 }
    );
  }
if (id === "work:alchemist:cure:ingredients") {
    if (r.jobId !== "alchemist") return notify("Cette activité est réservée aux alchimistes.");
    if (!r.diseases.length) return notify("Vous ne souffrez d'aucune maladie à soigner.");
    const used = consumeAlchemistIngredients(1);
    if (!used.length) {
      return notify("Aucun ingrédient disponible pour préparer le remède (1 requis).");
    }
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    const cured = r.diseases.shift() || { name: "Maladie" };
    return completeAction(
      `Remède alchimique (ingrédients) : ${cured.name} guérie instantanément (-1 ${used[0]})${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { knowledge: 0.2 },
      false
    );
  }
  if (id === "work:alchemist:potion:hp") {
    if (r.jobId !== "alchemist") return notify("Cette activité est réservée aux alchimistes.");
    const used = consumeAlchemistIngredients(2);
    if (!used.length) {
      return notify("Ingrédients insuffisants (2 ingrédients requis).");
    }
    addItem("greater-health-potion");
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    return completeAction(
      `Alchimie : Potion de soin avancée préparée instantanément (-2 ingrédients · +60 PV)${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { knowledge: 0.2 },
      false
    );
  }
  if (id === "work:alchemist:potion:mana") {
    if (r.jobId !== "alchemist") return notify("Cette activité est réservée aux alchimistes.");
    const used = consumeAlchemistIngredients(3);
    if (!used.length) {
      return notify("Ingrédients insuffisants (3 ingrédients requis).");
    }
    addItem("greater-mana-potion");
    r.workActions++;
    const jobXp = gainJobXp(BASE_JOB_XP);
    return completeAction(
      `Alchimie : Potion de mana avancée préparée instantanément (-3 ingrédients · +40 mana)${jobXp ? ` · +${jobXp} XP de métier` : ""}.`,
      { knowledge: 0.2 },
      false
    );
  }
}

export function exploreZone(zoneId) {
  if (combat) return notify("Impossible d'explorer pendant un combat.");
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
    if (item(reward).kind === "ingredient") r.ingredients = (r.ingredients || 0) + 1;
  }
  completeAction(
    reward ? `Exploration de ${z.name} : ${item(reward).name} trouvé.` : `Exploration de ${z.name} : aucune ressource trouvée.`,
    { agility: 0.2, luck: 0.15 }
  );
}

export function buy(id) {
  if (combat) return;
  const i = item(id);
  if (!i || save.run.gold < i.price) return;
  save.run.gold -= i.price;
  addItem(id);
  log(`Achat : ${i.name} x1.`);
  persist();
  renderGame();
}

export function sell(id) {
  if (combat) return;
  const i = item(id);
  if (!i || !qty(id)) return;
  removeItem(id);
  save.run.gold += i.sell * (save.run.jobId === "merchant" ? 1.1 : 1);
  log(`Vente : ${i.name} x1.`);
  persist();
  renderGame();
}

export function useItem(id) {
  if (combat) return notify("Impossible d'utiliser des objets pendant un combat.");
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
    renderGame();
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

export function equip(id) {
  if (combat) return;
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

export function shopItemCount() {
  return 4 + (save.run.discoveredZones?.length || 0);
}

export function refreshShop(notifyPlayer = true) {
  const candidates = ITEMS.filter(i => i.price && i.kind !== "special" && !i.craft_only);
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  save.run.shopStock = shuffled.slice(0, shopItemCount()).map(i => i.id);
  if (notifyPlayer) log("Le commerce se renouvelle pour les cinq prochaines années.");
}

export function setAttack(id) {
  if (!save.run.learned.includes(id) || save.run.equippedAttacks.includes(id)) return;
  const slot = save.run.equippedAttacks.findIndex(value => !value);
  if (slot < 0) return notify("Tous les emplacements sont occupés.");
  equipAttackToSlot(id, slot);
}

export function equipAttackToSlot(id, slot) {
  if (!save.run.learned.includes(id) || slot < 0 || slot >= save.run.equippedAttacks.length) return;
  const previous = save.run.equippedAttacks.findIndex(value => value === id);
  if (previous >= 0) save.run.equippedAttacks[previous] = null;
  save.run.equippedAttacks[slot] = id;
  log(`Attaque équipée : ${ATTACKS.find(a => a.id === id)?.name} dans l'emplacement ${slot + 1}.`);
  persist();
  renderGame();
}

export function removeAttackFromSlot(slot) {
  if (slot < 0 || slot >= save.run.equippedAttacks.length) return;
  const id = save.run.equippedAttacks[slot];
  if (!id) return;
  save.run.equippedAttacks[slot] = null;
  log(`Attaque retirée : ${ATTACKS.find(a => a.id === id)?.name}.`);
  persist();
  renderGame();
}

export function chooseClass(id, fromItem = false) {
  const target = CLASSES[id];
  const isEvolution = Boolean(target?.hidden && save.run.classId !== "none");
  if (!target || save.run.classId === id || (!fromItem && !canChangeClass(id))) return;
  save.run.classId = id;
  save.run.classXP = 0;
  save.run.classXPById[id] ||= 0;
  save.run.classHistory ||= [];
  if (id !== "none" && !save.run.classHistory.includes(id)) {
    save.run.classHistory.push(id);
  }
  ensureClassAttack(save.run);
  log(`${isEvolution ? "Évolution" : "Classe"} choisie pendant la run : ${target.name}.`);

  if (isEvolution) {
    const starterId = startingEquipmentForClass(id);
    const alreadyHasIt = starterId && (qty(starterId) > 0 || Object.values(save.run.equipment || {}).includes(starterId));
    if (starterId && !alreadyHasIt) {
      const starterItem = grantStartingEquipment(save.run);
      if (starterItem) {
        log(`Équipement d'évolution obtenu : ${starterItem.name}.`);
      }
    }
  }

  persist();
  renderGame();
}

export function chooseJob(id) {
  if (save.run.jobId !== "none" || !save.legacy.unlockedJobs.includes(id)) return;
  save.run.jobId = id;
  save.run.jobXP = 0;
  log(`Métier choisi pendant la run : ${JOBS[id].name}.`);
  persist();
  renderGame();
}

export function die(reason) {
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
  setSaveRun(null);
  setCombat(null);
  persist();
  renderCreate();
  notify("La run est terminée. Une nouvelle génération peut naître.");
}

export function abandonLife() {
  if (combat) return notify("Impossible d'abandonner pendant un combat.");
  if (!save.run || !confirm("Tuer le personnage actuel et commencer une nouvelle vie ?")) return;
  die("Personnage tué volontairement pour commencer une nouvelle vie.");
}

export function startLife(e) {
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
  r.classHistory = r.classId && r.classId !== "none" ? [r.classId] : [];
  ensureClassAttack(r);
  const starterItem = grantStartingEquipment(r);
  setSaveRun(r);
  log("Naissance. Les héritages accélèrent l'apprentissage de cette génération.");
  if (starterItem) {
    log(`Équipement de départ obtenu : ${starterItem.name}.`);
  }
  unlockChecks();
  persist();
  renderCreate();
}


export function alchemistIngredientIds() {
  return ITEMS.filter(i => i.kind === "ingredient" && qty(i.id) > 0).map(i => i.id);
}

export function countAlchemistIngredients() {
  return ITEMS
    .filter(i => i.kind === "ingredient")
    .reduce((sum, i) => sum + qty(i.id), 0);
}

export function consumeAlchemistIngredients(count) {
  if (countAlchemistIngredients() < count) return [];
  let remaining = count;
  const consumed = [];

  for (const it of ITEMS.filter(i => i.kind === "ingredient")) {
    while (remaining > 0 && qty(it.id) > 0) {
      removeItem(it.id);
      consumed.push(it.name);
      remaining--;
    }
  }
  return consumed;
}

export function estimatedAlchemistHarvest() {
  const s = totals();
  return Math.max(1, 1 + Math.floor(((s.luck || 0) + (s.knowledge || 0)) / 4));
}