import {
  CLASSES, JOBS, ELEMENTS, WEAPONS, ITEMS
} from "./game-data.js";
import { save, qty } from "./state.js";
import { totals, estimatedWork } from "./formulas.js";
import { masteryText } from "./progression.js";
import { countAlchemistIngredients, estimatedAlchemistHarvest, GAMBLER_BETS, gamblerBetAmount} from "./actions.js";

export const CLASS_WEAPON_TRAINING = {
  warrior: ["sword", "axe", "hammer", "spear"],
  ranger: ["bow", "dagger"],
  mage: ["catalyst"]
};

export function isClassOrSubclassOf(classId, parentClassId) {
  let currentId = classId;
  while (currentId) {
    if (currentId === parentClassId) return true;
    const currentClass = CLASSES[currentId];
    if (!currentClass) return false;
    currentId = currentClass.parent;
  }
  return false;
}

export const STUDIES = [
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

export const TRAINING = [
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

export function classLineage(id) {
  const lineage = [];
  let current = id;
  while (current && current !== "none" && CLASSES[current]) {
    lineage.unshift(current);
    current = CLASSES[current].parent;
  }
  return lineage;
}

export function classEvolutionBase(id) {
  return CLASSES[id]?.parent || null;
}

export function canChangeClass(id) {
  const target = CLASSES[id];
  const base = classEvolutionBase(id);
  return Boolean(
    target &&
    save.legacy.unlockedClasses.includes(id) &&
    (save.run.classId === "none" || (target.hidden && (!base || base === save.run.classId)))
  );
}

export function canUseClassItem(i) {
  const target = CLASSES[i?.classWeapon];
  if (!target || save.run.classId === i.classWeapon) return false;
  if (!target.hidden) return save.run.classId === "none" && save.legacy.unlockedClasses.includes(i.classWeapon);
  return true;
}

export function hasWeaponInInventory(weapon) {
  return ITEMS.some(i => i.kind === "equipment" && i.weapon === weapon && qty(i.id) > 0);
}

export function elementalStudyGain(classId, element) {
  return 3 + (CLASSES[classId]?.element === element ? 2 : 0);
}

export function availableStudies() {
  return STUDIES.filter(study => study.available(save.run));
}

export function availableTraining() {
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

export function gamblerChanceAdjective(chance) {
  if (chance < 0.15) return "Infime";
  if (chance < 0.30) return "Faible";
  if (chance < 0.45) return "Moyenne";
  if (chance < 0.60) return "Favorable";
  if (chance < 0.75) return "Bonne";
  if (chance < 0.90) return "Très bonne";
  return "Excellente";
}

export function merchantTradeItems() {
  const r = save.run;
  if (!r) return [];
  const luck = totals().luck || 0;
  let budget = Math.floor(estimatedWork() + luck);
  const eligibleItems = ITEMS.filter(i => i.price > 0 && i.kind !== "special" && !i.craft_only);
  const gained = [];

  while (budget > 0) {
    const affordable = eligibleItems.filter(i => i.price <= budget);
    if (!affordable.length) break;

    const maxPrice = Math.max(...affordable.map(i => i.price));
    const topCandidates = affordable.filter(i => i.price >= maxPrice * 0.65);
    const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    gained.push(chosen);
    budget -= chosen.price;
  }

  return gained;
}

export function availableWorkActivities() {
  const r = save.run;
  if (!r) return [];
  const jobId = r.jobId || "none";
  const job = JOBS[jobId];
  if (!job) return [];

  const list = [];
  const workGold = estimatedWork();
  const masteryInfo = masteryText({ xp: r.jobXP });

  // Option commune : Gagner de l'or
  const goldTitle = jobId === "farmer" ? "Gagner de l'or" : jobId === "gambler" ? "Petites combines" : `Travail de ${job.name}`;
  const goldDesc = jobId === "farmer"
    ? "Travailler la terre pour récolter et vendre les produits agricoles."
    : jobId === "gambler"
    ? "Petits travaux et jeux de rue sans risque pour un gain modeste garanti."
    : `Rendement estimé : ${workGold} or.`;

  list.push({
    name: goldTitle,
    description: goldDesc,
    action: "work",
    extra: `${workGold} or · maîtrise ${masteryInfo}`
  });

  // Fermier : Produire du pain
  if (jobId === "farmer") {
    list.push({
      name: "Produire du pain",
      description: "Cuire du pain. Régénère la vie et peut se vendre.",
      action: "work:bread",
      extra: "Pain x1 · se vend 10 po · régénère 20 PV"
    });
  }

  // Marchand : Obtenir des marchandises
  if (jobId === "merchant") {
    const luck = totals().luck || 0;
    const maxVal = Math.floor(workGold + luck);
    list.push({
      name: "Négocier des marchandises",
      description: `Obtenir un ou plusieurs objets aléatoires d'une valeur d'achat maximale de ${maxVal} po (travail + chance), en privilégiant les objets de valeur.`,
      action: "work:merchant:items",
      extra: `Valeur d'achat max : ${maxVal} po`
    });
  }

if (jobId === "gambler") {
    const luck = totals().luck || 0;
    const gold = r.gold || 0;

    Object.entries(GAMBLER_BETS).forEach(([key, cfg]) => {
      const bet = gamblerBetAmount(gold, cfg);
      const canAfford = gold >= bet && bet > 0;
      const chance = Math.min(cfg.maxCap, Math.max(0.05, cfg.baseChance + luck * 0.02));
      const adj = gamblerChanceAdjective(chance);

      list.push({
        name: cfg.label,
        description: `${cfg.description} (Gain ×${cfg.multiplier}, XP ×${cfg.multiplier} en cas de victoire)`,
        action: `work:gambler:${key}`,
        extra: canAfford
          ? `Mise : ${bet} po (min. ${cfg.minBet}) · Chance : ${adj}`
          : `Mise requise : ${bet} po · Or insuffisant`,
        disabled: !canAfford
      });
    });
  }

  // Érudit : Lire pour améliorer ses stats et augmenter le mana maximum
  if (jobId === "scholar") {
    const gold = r.gold || 0;
    const manaExpXp = r.techniqueMastery?.manaExpansion?.xp || 0;
    list.push({
      name: "Lecture d'archives arcaniques",
      description: "Étudier des manuscrits rares. Améliore le Savoir, restaure le mana et développe la technique d'Expansion de mana (augmente le mana maximum).",
      action: "work:scholar:read",
      extra: gold >= 20 ? `Coût : 20 or · Savoir +0.25 · Mana +0.2 · ${masteryText({ xp: manaExpXp })}` : "Coût : 20 or · Or insuffisant",
      disabled: gold < 20
    });
  }

  // Forgeron : Améliorer son équipement (or ou matériaux)
  if (jobId === "blacksmith") {
    const gold = r.gold || 0;
    const hasMat = qty("ore") > 0 || qty("ember") > 0 || (r.materials || 0) > 0;
    const ref = r.equipmentRefinement || 0;

    list.push({
      name: "Renforcer l'équipement (or)",
      description: "Forger des renforts durables pour son équipement (+20% aux bonus d'équipement, +2 défense et +2 dégâts par rang).",
      action: "work:blacksmith:upgrade:gold",
      extra: gold >= 30 ? `Coût : 30 or · Rang actuel : +${ref}` : "Coût : 30 or · Or insuffisant",
      disabled: gold < 30
    });

    list.push({
      name: "Renforcer l'équipement (matériaux)",
      description: "Utiliser 1 minerai ou braise pour améliorer sa forge sans dépenser d'or.",
      action: "work:blacksmith:upgrade:materials",
      extra: hasMat ? `Coût : 1 matériau · Rang actuel : +${ref}` : "Coût : 1 matériau · Aucun matériau",
      disabled: !hasMat
    });
  }

  // Alchimiste : Recherche d'ingrédients, guérison et création de potions
  if (jobId === "alchemist") {
    const gold = r.gold || 0;
    const hasDisease = Boolean(r.diseases?.length);
    const totalIngredients = countAlchemistIngredients();
    const harvestCount = estimatedAlchemistHarvest();

    list.push({
      name: "Rechercher des ingrédients",
      description: "Explorer les environs pour récolter des ingrédients alchimiques selon votre Chance et votre Savoir.",
      action: "work:alchemist:gather",
      extra: `Récolte estimée : +${harvestCount} ingrédient(s) · Stock : ${totalIngredients}`
    });

    list.push({
      name: "Remède contre la maladie (or)",
      description: "Préparer un remède alchimique qui soigne à coup sûr une maladie en 1 an.",
      action: "work:alchemist:cure:gold",
      extra: hasDisease ? (gold >= 25 ? "Coût : 25 or · Guérison garantie" : "Coût : 25 or · Or insuffisant") : "Aucune maladie active",
      disabled: !hasDisease || gold < 25
    });

    list.push({
      name: "Remède contre la maladie (ingrédients)",
      description: "Utiliser 1 ingrédient pour soigner instantanément une maladie sans passer d'année.",
      action: "work:alchemist:cure:ingredients",
      instant: true,
      extra: hasDisease
        ? (totalIngredients >= 1 ? `Coût : 1 ingrédient (Stock : ${totalIngredients}) · Instantané` : "Coût : 1 ingrédient · Ingrédient manquant")
        : "Aucune maladie active",
      disabled: !hasDisease || totalIngredients < 1
    });

    list.push({
      name: "Préparer un élixir de soin avancé",
      description: "Préparer instantanément une Potion de soin avancée (+60 PV) à partir de 2 ingrédients.",
      action: "work:alchemist:potion:hp",
      instant: true,
      extra: `Coût : 2 ingrédients (Stock : ${totalIngredients}) · Instantané`,
      disabled: totalIngredients < 2
    });

    list.push({
      name: "Préparer un élixir de mana avancé",
      description: "Préparer instantanément une Potion de mana avancée (+40 mana) à partir de 3 ingrédients.",
      action: "work:alchemist:potion:mana",
      instant: true,
      extra: `Coût : 3 ingrédients (Stock : ${totalIngredients}) · Instantané`,
      disabled: totalIngredients < 3
    });
  }

  return list;
}
