export const STATS = [
  ["strength", "Force"], ["magic", "Magie"], ["agility", "Agilité"],
  ["constitution", "Constitution"], ["knowledge", "Savoir"], ["luck", "Chance"]
];
export const RANDOM_NAMES = ["Ari", "Arthur", "Jade", "Oscar", "Ambre", "Emma", "Alice", "Bob", "Charlie", "Mira", "Nora", "Iris", "Léo", "Sacha", "Noé", "Alix", "Micky", "Vincent", "Ethan", "Lucien", "Aloyse", "Anna", "Léa", "Thiméo", "Sandy", "Alyson", "Clément", "Nicolas", "Ruben", "Déborah", "Antoine", "Gabriel", "Louise", "Thomas", "Paul", "Marie", "Sophie", "Julien", "Camille", "Lucas", "Chloe", "Maxime", "Manon]", "Raphaël", "Aura"];
export const ELEMENTS = { fire: "Feu", ice: "Glace", wind: "Vent", earth: "Terre" };
export const WEAPONS = { sword: "Épées", axe: "Haches", hammer: "Masses et marteaux", spear: "Lances", bow: "Arcs et arbalètes", dagger: "Dagues", unarmed: "Mains nues", catalyst: "Catalyseurs" };
export const SLOTS = { main: "Arme principale", off: "Arme secondaire", helmet: "Casque", chest: "Plastron", legs: "Jambières", boots: "Bottes", gloves: "Gants", accessory1: "Accessoire 1", accessory2: "Accessoire 2" };
export const MASTERY_LEVELS = ["Débutant", "Apprenti", "Initié", "Adepte", "Confirmé", "Expert", "Maître", "Légende"];
export const MASTERY_XP = [0, 5, 15, 40, 70, 105, 150, 500];
export const MASTERY_DOMAINS = {
  ...Object.fromEntries(Object.entries(WEAPONS).map(([id, name]) => [id, {
    label: name, source: "Armes", passive: id === "hammer" ? { bluntRes: 1.2, damage: 1.5 } : id === "bow" ? { accuracy: 1.5, attackSpeed: 1 } : id === "dagger" ? { accuracy: 1, evasion: 1.2 } : id === "catalyst" ? { magicPower: 1.5, manaRegen: .3 } : id === "unarmed" ? { defense: 1, damage: 1 } : { damage: 1.2, accuracy: .5 }
  }])),
  ...Object.fromEntries(Object.entries(ELEMENTS).map(([id, name]) => [id, {
    label: name, source: "Éléments", passive: { magicPower: 1.5, [`${id}Res`]: 1.5 }
  }])),
  farmer: { label: "Fermier", source: "Métiers", passive: { workGold: 1, lifeRegen: .4 } },
  merchant: { label: "Marchand", source: "Métiers", passive: { workGold: 1, sellBonus: 2 } },
  scholar: { label: "Érudit", source: "Métiers", passive: { workGold: 1, studyYield: .8, magicPower: 1 } },
  blacksmith: { label: "Forgeron", source: "Métiers", passive: { workGold: 1, equipmentPower: 1 } },
  alchemist: { label: "Alchimiste", source: "Métiers", passive: { workGold: 1, lifeRegen: 1, magicPower: .5 } },
  gambler : { label: "Parieur", source: "Métiers", passive: { workGold: 1, luck: 1.5 } },
  concentration: { label: "Concentration du mana", source: "Techniques", passive: { manaRegen: .8, manaEfficiency: 1.5 } },
  manaExpansion: { label: "Expansion de mana", source: "Techniques", passive: { maxMana: 10 } }
};
export const STAT_LABELS = {
  accuracy: "Précision", evasion: "Esquive", crit: "Coup critique", critDamage: "Dégâts critiques",
  attackSpeed: "Vitesse d'attaque", defense: "Défense physique", lifeRegen: "Régénération de vie",
  maxMana: "Mana maximal", manaRegen: "Régénération de mana", magicPower: "Puissance magique", magicResistance: "Résistance magique",
  slashRes: "Résistance tranchante", pierceRes: "Résistance perforante", bluntRes: "Résistance contondante",
  fireRes: "Résistance au feu", iceRes: "Résistance à la glace", windRes: "Résistance au vent", earthRes: "Résistance à la terre"
};
export const PASSIVE_LABELS = { damage: "Dégâts", lifeExpectancy: "ans d'espérance de vie", workGold: "or par travail", sellBonus: "Bonus de vente", studyYield: "Rendement d'étude", equipmentPower: "Efficacité d'équipement", manaEfficiency: "Efficacité de récupération du mana" };
export const RES_KEYS = { slash: "slashRes", pierce: "pierceRes", blunt: "bluntRes", fire: "fireRes", ice: "iceRes", wind: "windRes", earth: "earthRes", magic: "magicResistance" };
export const CLASSES = {
  none: { name: "Sans classe", description: "Une voie libre, sans bonus de spécialisation.", stat: null, unlock: () => true },
  warrior: { name: "Guerrier", description: "Force, défense physique et maîtrise des armes.", stat: "strength", unlock: s => s.run.maxStats.strength >= 6 },
  knight: { name: "Chevalier", description: "Évolution du Guerrier spécialisée dans les épées.", stat: "strength", parent: "warrior", hidden: true, weapon: "sword", unlock: s => s.run.classId === "warrior" && s.run.weaponMastery.sword.xp >= 8 },
  lancer: { name: "Lancier", description: "Évolution du Guerrier spécialisée dans les lances.", stat: "strength", parent: "warrior", hidden: true, weapon: "spear", unlock: s => s.run.classId === "warrior" && s.run.weaponMastery.spear.xp >= 8 },  
  hammerer : { name: "Marteleur", description: "Évolution du Guerrier spécialisée dans les marteaux.", stat: "strength", parent: "warrior", hidden: true, weapon: "hammer", unlock: s => s.run.classId === "warrior" && s.run.weaponMastery.hammer.xp >= 8 },
  reaver : { name: "Hacheur", description: "Évolution du Guerrier spécialisée dans les haches.", stat: "strength", parent: "warrior", hidden: true, weapon: "axe", unlock: s => s.run.classId === "warrior" && s.run.weaponMastery.axe.xp >= 8 },
  mage: { name: "Mage", description: "Mana, puissance magique et théorie arcanique.", stat: "magic", unlock: s => s.run.studyActions >= 4 },
  fireMage: { name: "Mage de feu", description: "Spécialiste des sorts ardents et des dégâts prolongés.", stat: "magic", element: "fire", parent: "mage", hidden: true, unlock: s => s.run.elementMastery.fire.xp >= 8 },
  iceMage: { name: "Mage de glace", description: "Spécialiste du contrôle et du ralentissement.", stat: "magic", element: "ice", parent: "mage", hidden: true, unlock: s => s.run.elementMastery.ice.xp >= 8 },
  windMage: { name: "Mage de vent", description: "Spécialiste des sorts rapides et de l'esquive.", stat: "magic", element: "wind", parent: "mage", hidden: true, unlock: s => s.run.elementMastery.wind.xp >= 8 },
  earthMage: { name: "Mage de terre", description: "Spécialiste des sorts lourds et de la résistance.", stat: "magic", element: "earth", parent: "mage", hidden: true, unlock: s => s.run.elementMastery.earth.xp >= 8 },
  evoker: { name: "Évocateur", description: "Spécialiste des catalyseurs, de la canalisation du mana et de l'amplification des sorts.", stat: "magic", parent: "mage", hidden: true, unlock: s => s.run.weaponMastery.catalyst.xp >= 8},
  primordial: { name: "Arcaniste primordial", description: "Affinité rare avec les quatre éléments.", stat: "magic", parent: "mage", hidden: true, unlock: s => s.legacy.primalHeart === true },
  ranger: { name: "Rôdeur", description: "Exploration, arcs et survie.", stat: "agility", unlock: s => s.run.explorations >= 3 },
  archer: { name: "Archer", description: "Évolution du Rôdeur spécialisée dans les arcs.", stat: "agility", parent: "ranger", hidden: true, weapon: "bow", unlock: s => s.run.classId === "ranger" && s.run.weaponMastery.bow.xp >= 8 },
  rogue: { name: "Voleur", description: "Évolution du Rôdeur spécialisée dans la précision et les dagues.", stat: "agility", parent: "ranger", hidden: true, weapon: "dagger", unlock: s => s.run.classId === "ranger" && s.run.weaponMastery.dagger.xp >= 6 },
  luckyman: { name: "Fortuneur", description: "Chance élevée pour des tirages avantageux.", stat: "luck", unlock: s => s.run.stats.luck >= 6 }
};
export const JOBS = {
  none: { name: "Sans métier", description: "Travail simple, revenus faibles.", stat: null, unlock: () => true, work: 12 },
  farmer: { name: "Fermier", description: "Agriculture : revenus stables et constitution.", stat: "constitution", unlock: s => s.run.workActions >= 3, work: 28 },
  merchant: { name: "Marchand", description: "Commerce : meilleurs revenus et prix de vente.", stat: "luck", unlock: s => s.legacy.goldEarned >= 90, work: 38 },
  gambler: { name: "Parieur", description: "Chance : tirages, jeux et opportunités.", stat: "luck", unlock: s => s.run.stats.luck >= 6, work: 10 },
  scholar: { name: "Érudit", description: "Recherche : savoir, mana et progression élémentaire.", stat: "knowledge", unlock: s => s.run.studyActions >= 3, work: 18 },
  blacksmith: { name: "Forgeron", description: "Forge : matériaux, équipement et maîtrise des marteaux.", stat: "strength", unlock: s => s.run.materials >= 3, work: 32 },
  alchemist: { name: "Alchimiste", description: "Savoir, soins et consommables.", stat: "knowledge", unlock: s => s.run.itemsFound >= 4, work: 22 }
};
Object.entries(CLASSES).filter(([id]) => id !== "none").forEach(([id, data]) => {
  MASTERY_DOMAINS[id] = { label: data.name, source: "Classes", passive: { lifeExpectancy: .5 } };
});
Object.keys(JOBS).filter(id => id !== "none").forEach(id => {
  MASTERY_DOMAINS[id].passive.lifeExpectancy = .5;
});
export const ITEMS = [
  { id: "iron-sword", name: "Épée de fer", kind: "equipment", rarity: "Commun", slot: "main", weapon: "sword", price: 42, sell: 24, bonus: { strength: 1, accuracy: 2 }, req: { strength: 4 } },
  { id: "hunter-bow", name: "Arc du pisteur", kind: "equipment", rarity: "Inhabituel", slot: "main", weapon: "bow", price: 78, sell: 42, bonus: { agility: 2, accuracy: 4 }, req: { agility: 5 } },
  { id: "oak-staff", name: "Bâton d'aubier", kind: "equipment", rarity: "Commun", slot: "main", weapon: "catalyst", price: 55, sell: 30, bonus: { magic: 1, maxMana: 8, magicPower: 2 }, req: { magic: 4 } },
  { id: "war-hammer", name: "Marteau de guerre", kind: "equipment", rarity: "Rare", slot: "main", weapon: "hammer", price: 130, sell: 70, bonus: { strength: 3, bluntRes: 4, defense: 3 }, req: { strength: 7 } },
  { id: "leather-hood", name: "Capuche de cuir", kind: "equipment", rarity: "Commun", slot: "helmet", price: 35, sell: 18, bonus: { agility: 1, evasion: 2 }, req: { agility: 3 } },
  { id: "guardian-mail", name: "Cotte du gardien", kind: "equipment", rarity: "Rare", slot: "chest", price: 120, sell: 65, bonus: { constitution: 2, defense: 7, slashRes: 5 }, req: { strength: 5, constitution: 6 } },
  { id: "traveler-boots", name: "Bottes de voyage", kind: "equipment", rarity: "Inhabituel", slot: "boots", price: 65, sell: 35, bonus: { agility: 1, evasion: 3, windRes: 3 }, req: { agility: 4 } },
  { id: "wisdom-ring", name: "Anneau de sagesse", kind: "equipment", rarity: "Rare", slot: "accessory1", price: 115, sell: 60, bonus: { knowledge: 2, maxMana: 12, magicPower: 3 }, req: { knowledge: 6 } },
  { id: "primal-heart", name: "Cœur primordial", kind: "special", rarity: "Mythique", price: 0, sell: 250, classUnlock: "primordial", classWeapon: "primordial", bonus: { magic: 3, fireRes: 8, iceRes: 8, windRes: 8, earthRes: 8 }, req: {} },
  { id: "health-potion", name: "Potion de soin", kind: "consumable", rarity: "Commun", price: 28, sell: 10, effect: { hp: 25 }, description: "Restaure 25 PV.", stock: 3 },
  { id: "greater-health-potion", name: "Potion de soin avancée", kind: "consumable", rarity: "Inhabituel", price: 50, sell: 25, effect: { hp: 60 }, description: "Restaure 60 PV." },
  { id: "bread", name: "Pain", kind: "consumable", rarity: "Commun", price: 16, sell: 10, effect: { hp: 20 }, description: "Restaure 20 PV.", stock: 2 },
  { id: "mana-potion", name: "Potion de mana", kind: "consumable", rarity: "Inhabituel", price: 46, sell: 17, effect: { mana: 18 }, description: "Restaure 18 mana.", stock: 2 },
  { id: "greater-mana-potion", name: "Potion de mana avancée", kind: "consumable", rarity: "Rare", price: 75, sell: 35, effect: { mana: 40 }, description: "Restaure 40 mana." },
  { id: "tonic-constitution", name: "Tonique de constitution", kind: "consumable", rarity: "Rare", price: 145, sell: 55, effect: { stat: "constitution", amount: 1 }, description: "Augmente durablement la Constitution.", stock: 1 },
  { id: "old-gem", name: "Gemme ancienne", kind: "valuable", rarity: "Rare", price: 70, sell: 42, description: "Objet de valeur trouvé en exploration." },
  { id: "ore", name: "Minerai de fer", kind: "material", rarity: "Commun", price: 16, sell: 9, description: "Matériau utile au forgeron." },
  { id: "ember", name: "Braise élémentaire", kind: "material", rarity: "Rare", price: 48, sell: 25, description: "Matériau chargé de magie." }
];
ITEMS.push(
  { id: "warrior-blade", name: "Lame du rempart", kind: "equipment", rarity: "Rare", slot: "main", weapon: "sword", classWeapon: "warrior", price: 150, sell: 82, bonus: { strength: 2, defense: 4, accuracy: 2 }, req: { strength: 5 }, description: "Une épée équilibrée pour le Guerrier." },
  { id: "mage-focus", name: "Focaliseur astral", kind: "equipment", rarity: "Rare", slot: "main", weapon: "catalyst", classWeapon: "mage", price: 165, sell: 90, bonus: { magic: 2, maxMana: 18, magicPower: 5 }, req: { magic: 6 }, description: "Un catalyseur conçu pour le Mage." },
  { id: "flame-scepter", name: "Sceptre incandescent", kind: "equipment", rarity: "Rare", slot: "main", weapon: "catalyst", classWeapon: "fireMage", price: 180, sell: 98, bonus: { magic: 2, magicPower: 6, fireRes: 4 }, req: { magic: 7 }, description: "Le foyer du Mage de feu." },
  { id: "frost-orb", name: "Orbe cryogène", kind: "equipment", rarity: "Rare", slot: "main", weapon: "catalyst", classWeapon: "iceMage", price: 180, sell: 98, bonus: { magic: 2, magicPower: 5, iceRes: 5 }, req: { magic: 7 }, description: "Un orbe pour le Mage de glace." },
  { id: "rogue-daggers", name: "Dagues jumelles", kind: "equipment", rarity: "Rare", slot: "main", weapon: "dagger", classWeapon: "rogue", price: 145, sell: 78, bonus: { agility: 2, accuracy: 5, crit: 3 }, req: { agility: 6 }, description: "Les lames rapides du Voleur." },
  { id: "ranger-longbow", name: "Arc des lisières", kind: "equipment", rarity: "Rare", slot: "main", weapon: "bow", classWeapon: "ranger", price: 155, sell: 84, bonus: { agility: 2, attackSpeed: 3, accuracy: 5 }, req: { agility: 6 }, description: "Un arc pour le Rôdeur." },
  { id: "alchemist-vial", name: "Baguette de distillation", kind: "equipment", rarity: "Rare", slot: "main", weapon: "catalyst", classWeapon: "alchemist", price: 150, sell: 82, bonus: { knowledge: 2, magicPower: 3, lifeRegen: 2 }, req: { knowledge: 6 }, description: "Le catalyseur de l'Alchimiste." },
  { id: "primordial-core", name: "Lance des origines", kind: "equipment", rarity: "Mythique", slot: "main", weapon: "spear", classWeapon: "primordial", price: 260, sell: 140, bonus: { magic: 3, strength: 2, magicPower: 7, fireRes: 3, iceRes: 3, windRes: 3, earthRes: 3 }, req: { magic: 8 }, description: "Une arme adaptée à l'Arcaniste primordial." },
  { id: "iron-helm", name: "Heaume de garde", kind: "equipment", rarity: "Commun", slot: "helmet", price: 48, sell: 25, bonus: { constitution: 1, defense: 3 }, req: { constitution: 4 }, description: "Protège efficacement la tête." },
  { id: "scholar-hood", name: "Capuche de l'érudit", kind: "equipment", rarity: "Inhabituel", slot: "helmet", price: 70, sell: 38, bonus: { knowledge: 2, magicResistance: 2 }, req: { knowledge: 4 }, description: "Un couvre-chef chargé de notes." },
  { id: "scale-cuirass", name: "Cuirasse d'écailles", kind: "equipment", rarity: "Inhabituel", slot: "chest", price: 92, sell: 50, bonus: { strength: 1, constitution: 2, defense: 5 }, req: { strength: 5 }, description: "Une armure solide et mobile." },
  { id: "arcane-robe", name: "Robe des courants", kind: "equipment", rarity: "Rare", slot: "chest", price: 125, sell: 68, bonus: { magic: 2, maxMana: 10, magicResistance: 4 }, req: { magic: 6 }, description: "Une robe amplifiant les flux." },
  { id: "iron-greaves", name: "Grèves ferrées", kind: "equipment", rarity: "Commun", slot: "legs", price: 52, sell: 28, bonus: { constitution: 1, defense: 3, bluntRes: 2 }, req: { constitution: 4 }, description: "Des jambières robustes." },
  { id: "swift-greaves", name: "Jambières de course", kind: "equipment", rarity: "Inhabituel", slot: "legs", price: 78, sell: 42, bonus: { agility: 2, evasion: 3 }, req: { agility: 5 }, description: "Allègent les déplacements." },
  { id: "grip-gauntlets", name: "Gantelets d'impact", kind: "equipment", rarity: "Inhabituel", slot: "gloves", price: 74, sell: 40, bonus: { strength: 2, damage: 2 }, req: { strength: 5 }, description: "Renforcent les frappes." },
  { id: "weaver-gloves", name: "Gants de tisseur", kind: "equipment", rarity: "Rare", slot: "gloves", price: 105, sell: 57, bonus: { magic: 1, accuracy: 3, manaRegen: 1 }, req: { magic: 5 }, description: "Facilitent la manipulation du mana." },
  { id: "iron-buckler", name: "Rondache de fer", kind: "equipment", rarity: "Commun", slot: "off", price: 58, sell: 31, bonus: { defense: 5, slashRes: 3 }, req: { strength: 4 }, description: "Un bouclier secondaire fiable." },
  { id: "focus-tome", name: "Tome de focalisation", kind: "equipment", rarity: "Rare", slot: "off", price: 118, sell: 64, bonus: { knowledge: 2, maxMana: 14, magicPower: 2 }, req: { knowledge: 6 }, description: "Un grimoire utilisable en main secondaire." },
  { id: "luck-charm", name: "Talisman de fortune", kind: "equipment", rarity: "Inhabituel", slot: "accessory1", price: 82, sell: 44, bonus: { luck: 2, crit: 2 }, req: { luck: 5 }, description: "Attire les occasions favorables." },
  { id: "ember-pendant", name: "Pendentif de braise", kind: "equipment", rarity: "Rare", slot: "accessory2", price: 132, sell: 72, bonus: { fireRes: 8, magicPower: 2 }, req: { magic: 5 }, description: "Résiste aux flammes et les attise." },
  { id: "wind-feather", name: "Plume des vents", kind: "equipment", rarity: "Inhabituel", slot: "accessory2", price: 88, sell: 48, bonus: { evasion: 3, windRes: 5, attackSpeed: 1 }, req: { agility: 5 }, description: "Un charme léger qui favorise l'esquive." },
  { id: "wanderer-boots", name: "Bottes de piste", kind: "equipment", rarity: "Commun", slot: "boots", price: 44, sell: 24, bonus: { agility: 1, evasion: 2 }, req: { agility: 3 }, description: "Des bottes fiables pour voyager." },
  { id: "mana-sandals", name: "Sandales de flux", kind: "equipment", rarity: "Rare", slot: "boots", price: 96, sell: 52, bonus: { magic: 1, manaRegen: 2, windRes: 3 }, req: { magic: 5 }, description: "Accélèrent la circulation du mana." }
);
export const ATTACKS = [
  { id: "punch", name: "Coup de poing", type: "physical", damage: "blunt", power: 5, accuracy: 95, mana: 0, desc: "L'attaque de base accessible à tous." },
  { id: "slash", name: "Frappe tranchante", type: "physical", damage: "slash", power: 9, accuracy: 92, mana: 0, weapon: "sword", desc: "Une attaque fiable." },
  { id: "pierce", name: "Estoc précis", type: "physical", damage: "pierce", power: 8, accuracy: 97, mana: 0, weapon: "spear", desc: "Précision élevée." },
  { id: "smash", name: "Grand coup", type: "physical", damage: "blunt", power: 14, accuracy: 78, mana: 0, weapon: "hammer", desc: "Lent mais puissant." },
  { id: "shot", name: "Tir lointain", type: "physical", damage: "pierce", power: 8, accuracy: 94, mana: 0, weapon: "bow", desc: "Frappe à distance." },
  { id: "fire", name: "Braise", type: "magic", damage: "fire", element: "fire", power: 15, accuracy: 90, mana: 8, desc: "Brûle la cible." },
  { id: "ice", name: "Éclat de glace", type: "magic", damage: "ice", element: "ice", power: 12, accuracy: 94, mana: 7, status: ["slow"], desc: "Ralentit la cible." },
  { id: "wind", name: "Lame de vent", type: "magic", damage: "wind", element: "wind", power: 11, accuracy: 97, mana: 6, desc: "Rapide et précise." },
  { id: "earth", name: "Éclat tellurique", type: "magic", damage: "earth", element: "earth", power: 17, accuracy: 84, mana: 10, desc: "Frappe lourde et lente." },
  { id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 10, desc: "Restaure des PV." },
  { id: "guard", name: "Garde", type: "buff", power: 0, accuracy: 100, mana: 4, desc: "Protection temporaire." },
  { id: "mana-sphere", name: "Sphère de mana", type: "magic", damage: "magic", power: 16, accuracy: 94, mana: 7, classId: "mage", desc: "Une sphère arcanique qui renforce la maîtrise du Mage." },
  { id: "warrior-strike", name: "Frappe du guerrier", type: "physical", damage: "blunt", power: 12, accuracy: 90, mana: 0, classId: "warrior", desc: "Une frappe fondée sur la force du Guerrier." },
  { id: "knight-slash", name: "Coup d'épée", type: "physical", damage: "slash", power: 15, accuracy: 94, mana: 0, weapon: "sword", classId: "knight", desc: "Le coup emblématique du Chevalier." },
  { id: "lancer-thrust", name: "Pointe de lance", type: "physical", damage: "pierce", power: 15, accuracy: 96, mana: 0, weapon: "spear", classId: "lancer", desc: "Une attaque précise du Lancier." },
  { id: "archer-shot", name: "Tir de précision", type: "physical", damage: "pierce", power: 15, accuracy: 98, mana: 0, weapon: "bow", classId: "archer", desc: "Un tir maîtrisé de l'Archer." },
  { id: "rogue-strike", name: "Frappe sournoise", type: "physical", damage: "pierce", power: 13, accuracy: 96, mana: 0, weapon: "dagger", classId: "rogue", desc: "Une attaque rapide du Voleur." },
  { id: "ranger-shot", name: "Flèche de piste", type: "physical", damage: "pierce", power: 13, accuracy: 96, mana: 0, weapon: "bow", classId: "ranger", desc: "Un tir précis du Rôdeur." },
  { id: "fire-sphere", name: "Sphère ardente", type: "magic", damage: "fire", element: "fire", power: 19, accuracy: 90, mana: 9, classId: "fireMage", desc: "Une sphère de flammes du Mage de feu." },
  { id: "ice-spear", name: "Lance de glace", type: "magic", damage: "ice", element: "ice", power: 18, accuracy: 93, mana: 9, classId: "iceMage", desc: "Un projectile glacé du Mage de glace." },
  { id: "wind-cyclone", name: "Cyclone tranchant", type: "magic", damage: "wind", element: "wind", power: 18, accuracy: 96, mana: 8, classId: "windMage", desc: "Un courant violent du Mage de vent." },
  { id: "earth-shard", name: "Éclat tellurique", type: "magic", damage: "earth", element: "earth", power: 20, accuracy: 86, mana: 10, classId: "earthMage", desc: "Une masse de terre condensée." },
  { id: "origin-ray", name: "Rayon des origines", type: "magic", damage: "magic", power: 24, accuracy: 88, mana: 12, classId: "primordial", desc: "La puissance des quatre éléments réunis." },
  { id: "lucky-punch", name: "Lucky Punch", type: "physical", damage: "blunt", power: 5, accuracy: 85, mana: 0, classId: "luckyman", desc: "Un coup imprévisible dont la puissance dépend de la chance (TODO: dépendre de la chance)."},
  { id: "hammerer-smash", name: "Impact dévastateur", type: "physical", damage: "blunt", power: 21, accuracy: 84, mana: 0, weapon: "hammer", classId: "hammerer", desc: "Un coup de marteau écrasant qui libère toute la puissance du Marteleur." },
  { id: "reaver-cleave", name: "Entaille sauvage", type: "physical", damage: "slash", power: 19, accuracy: 91, mana: 0, weapon: "axe", classId: "reaver", desc: "Un puissant coup de hache capable de fendre les défenses adverses." },
  { id: "evoker-overload", name: "Surcharge arcanique", type: "magic", damage: "magic", power: 20, accuracy: 93, mana: 11, weapon: "catalyst", classId: "evoker", desc: "Le catalyseur concentre le mana pour libérer une décharge arcanique dévastatrice." }
];
export const ZONES = [
  { id: "forest", name: "Forêt ancienne", difficulty: 1, description: "Loups et gobelins entre les racines.", enemy: ["Loup ancien", "Gobelin rôdeur"], reward: ["ore", "health-potion"] },
  { id: "ruins", name: "Ruines oubliées", difficulty: 2, description: "Des sentinelles gardent les pierres.", enemy: ["Sentinelle rouillée", "Chauve-souris"], reward: ["old-gem", "ore"], req: { stat: "knowledge", value: 5 } },
  { id: "crypt", name: "Crypte maudite", difficulty: 3, description: "Les morts y refusent le repos.", enemy: ["Squelette maudit", "Prêtre spectral"], reward: ["mana-potion", "old-gem"], req: { stat: "constitution", value: 6 } },
  { id: "mines", name: "Mines profondes", difficulty: 4, description: "La roche tremble sous les marteaux.", enemy: ["Golem de fer", "Reine des kobolds"], reward: ["ore", "war-hammer"], req: { stat: "strength", value: 7 } },
  { id: "swamp", name: "Marais toxique", difficulty: 5, description: "Chaque brume peut être un poison.", enemy: ["Slime toxique", "Hydre des marais"], reward: ["tonic-constitution", "ember"], req: { stat: "constitution", value: 8 } },
  { id: "sanctuary", name: "Sanctuaire gelé", difficulty: 6, description: "La glace conserve une magie ancienne.", enemy: ["Élémentaire de glace", "Gardienne hivernale"], reward: ["mana-potion", "wisdom-ring"], req: { element: "ice", value: 1 } },
  { id: "volcano", name: "Volcan ardent", difficulty: 7, description: "La lave nourrit des monstres furieux.", enemy: ["Salamandre", "Seigneur de braise"], reward: ["ember", "primal-heart"], req: { element: "fire", value: 2 } },
  { id: "tower", name: "Tour des arcanes", difficulty: 8, description: "Les sorts y prennent vie.", enemy: ["Construct arcanique", "Archimage errant"], reward: ["wisdom-ring", "ember"], req: { stat: "magic", value: 10 } },
  { id: "abyss", name: "Abîme des titans", difficulty: 9, description: "Les colosses ne tolèrent aucune faiblesse.", enemy: ["Titan brisé", "Œil abyssal"], reward: ["guardian-mail", "old-gem"], req: { stat: "constitution", value: 12 } },
  { id: "origins", name: "Donjon des origines", difficulty: 10, description: "Le Gardien primordial attend au commencement.", enemy: ["Gardien primordial"], reward: ["primal-heart"], boss: true, req: { stat: "magic", value: 13 } }
];
export const STATUS = { burn: "Brûlure", slow: "Ralentissement", stun: "Étourdissement", poison: "Poison", defenseDown: "Défense réduite", guard: "Protection" };

export const emptyMastery = keys => Object.fromEntries(keys.map(id => [id, { xp: 0 }]));

