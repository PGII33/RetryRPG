import {
  CLASSES, ELEMENTS, WEAPONS, ITEMS
} from "./game-data.js";
import { save, qty } from "./state.js";

export const CLASS_WEAPON_TRAINING = {
  warrior: ["sword", "axe", "hammer"],
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
