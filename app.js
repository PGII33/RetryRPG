const STORAGE_KEY = "retry-rpg-save-v2";

const STATS = [
  ["strength", "Force"], ["magic", "Magie"], ["agility", "Agilité"],
  ["constitution", "Constitution"], ["knowledge", "Savoir"], ["luck", "Chance"]
];
const ELEMENTS = { fire: "Feu", ice: "Glace", wind: "Vent", earth: "Terre" };
const WEAPONS = { sword: "Épées", axe: "Haches", hammer: "Masses et marteaux", spear: "Lances", bow: "Arcs et arbalètes", dagger: "Dagues", unarmed: "Mains nues", catalyst: "Catalyseurs" };
const SLOTS = { main: "Arme principale", off: "Arme secondaire", helmet: "Casque", chest: "Plastron", legs: "Jambières", boots: "Bottes", gloves: "Gants", accessory1: "Accessoire 1", accessory2: "Accessoire 2" };
const MASTERY_LEVELS = ["Débutant", "Novice", "Apprenti", "Initié", "Confirmé", "Expert", "Maître"];
const MASTERY_XP = [0, 8, 24, 55, 105, 180, 300];
const MASTERY_DOMAINS = {
  ...Object.fromEntries(Object.entries(WEAPONS).map(([id, name]) => [id, {
    label: name, source: "Armes", passive: id === "hammer" ? { bluntRes: 1.2, damage: 1.5 } : id === "bow" ? { accuracy: 1.5, attackSpeed: 1 } : id === "dagger" ? { accuracy: 1, evasion: 1.2 } : id === "catalyst" ? { magicPower: 1.5, manaRegen: .3 } : id === "unarmed" ? { defense: 1, damage: 1 } : { damage: 1.2, accuracy: .5 }
  }])),
  ...Object.fromEntries(Object.entries(ELEMENTS).map(([id, name]) => [id, {
    label: name, source: "Éléments", passive: { magicPower: 1.5, [`${id}Res`]: 1.5 }
  }])),
  class: { label: "Potentiel de classe", source: "Classes", passive: { lifeExpectancy: 1, defense: 1, magicPower: 1, damage: 1 } },
  farmer: { label: "Fermier", source: "Métiers", passive: { workGold: 1, lifeRegen: .4 } },
  merchant: { label: "Marchand", source: "Métiers", passive: { workGold: 1, sellBonus: 2 } },
  scholar: { label: "Érudit", source: "Métiers", passive: { workGold: 1, studyYield: .8, magicPower: 1 } },
  blacksmith: { label: "Forgeron", source: "Métiers", passive: { workGold: 1, equipmentPower: 1 } },
  concentration: { label: "Concentration du mana", source: "Techniques", passive: { manaRegen: .8, manaEfficiency: 1.5 } }
};
const STAT_LABELS = {
  accuracy: "Précision", evasion: "Esquive", crit: "Coup critique", critDamage: "Dégâts critiques",
  attackSpeed: "Vitesse d'attaque", defense: "Défense physique", lifeRegen: "Régénération de vie",
  maxMana: "Mana maximal", manaRegen: "Régénération de mana", magicPower: "Puissance magique", magicResistance: "Résistance magique",
  slashRes: "Résistance tranchante", pierceRes: "Résistance perforante", bluntRes: "Résistance contondante",
  fireRes: "Résistance au feu", iceRes: "Résistance à la glace", windRes: "Résistance au vent", earthRes: "Résistance à la terre"
};
const PASSIVE_LABELS = { damage: "Dégâts", lifeExpectancy: "ans d'espérance de vie", workGold: "or par travail", sellBonus: "Bonus de vente", studyYield: "Rendement d'étude", equipmentPower: "Efficacité d'équipement", manaEfficiency: "Efficacité de récupération du mana" };
const RES_KEYS = { slash: "slashRes", pierce: "pierceRes", blunt: "bluntRes", fire: "fireRes", ice: "iceRes", wind: "windRes", earth: "earthRes", magic: "magicResistance" };
const CLASSES = {
  none: { name: "Sans classe", description: "Une voie libre, sans bonus de spécialisation.", stat: null, unlock: () => true },
  warrior: { name: "Guerrier", description: "Force, défense physique et maîtrise des armes lourdes.", stat: "strength", unlock: s => s.run.maxStats.strength >= 7 },
  mage: { name: "Mage", description: "Mana, puissance magique et théorie arcanique.", stat: "magic", unlock: s => s.run.studyActions >= 4 },
  fireMage: { name: "Mage de feu", description: "Spécialiste des sorts ardents et des dégâts prolongés.", stat: "magic", hidden: true, unlock: s => s.run.elementMastery.fire.xp >= 8 },
  iceMage: { name: "Mage de glace", description: "Spécialiste du contrôle et du ralentissement.", stat: "magic", hidden: true, unlock: s => s.run.elementMastery.ice.xp >= 8 },
  rogue: { name: "Voleur", description: "Précision, esquive et dagues.", stat: "agility", unlock: s => s.run.weaponMastery.dagger.xp >= 6 },
  ranger: { name: "Rôdeur", description: "Exploration, arcs et survie.", stat: "constitution", unlock: s => s.run.explorations >= 3 },
  alchemist: { name: "Alchimiste", description: "Savoir, soins et consommables.", stat: "knowledge", unlock: s => s.run.itemsFound >= 4 },
  primordial: { name: "Arcaniste primordial", description: "Affinité rare avec les quatre éléments.", stat: "magic", hidden: true, unlock: s => s.legacy.primalHeart === true }
};
const JOBS = {
  none: { name: "Sans métier", description: "Travail simple, revenus faibles.", stat: null, unlock: () => true, work: 12 },
  farmer: { name: "Fermier", description: "Agriculture : revenus stables et constitution.", stat: "constitution", unlock: s => s.run.workActions >= 3, work: 28 },
  merchant: { name: "Marchand", description: "Commerce : meilleurs revenus et prix de vente.", stat: "luck", unlock: s => s.run.goldEarned >= 90, work: 38 },
  scholar: { name: "Érudit", description: "Recherche : savoir, mana et progression élémentaire.", stat: "knowledge", unlock: s => s.run.studyActions >= 3, work: 18 },
  blacksmith: { name: "Forgeron", description: "Forge : matériaux, équipement et maîtrise des marteaux.", stat: "strength", unlock: s => s.run.materials >= 3, work: 32 }
};
const ITEMS = [
  { id: "iron-sword", name: "Épée de fer", kind: "equipment", rarity: "Commun", slot: "main", weapon: "sword", price: 42, sell: 24, bonus: { strength: 1, accuracy: 2 }, req: { strength: 4 } },
  { id: "hunter-bow", name: "Arc du pisteur", kind: "equipment", rarity: "Inhabituel", slot: "main", weapon: "bow", price: 78, sell: 42, bonus: { agility: 2, accuracy: 4 }, req: { agility: 5 } },
  { id: "oak-staff", name: "Bâton d'aubier", kind: "equipment", rarity: "Commun", slot: "main", weapon: "catalyst", price: 55, sell: 30, bonus: { magic: 1, maxMana: 8, magicPower: 2 }, req: { magic: 4 } },
  { id: "war-hammer", name: "Marteau de guerre", kind: "equipment", rarity: "Rare", slot: "main", weapon: "hammer", price: 130, sell: 70, bonus: { strength: 3, bluntRes: 4, defense: 3 }, req: { strength: 7 } },
  { id: "leather-hood", name: "Capuche de cuir", kind: "equipment", rarity: "Commun", slot: "helmet", price: 35, sell: 18, bonus: { agility: 1, evasion: 2 }, req: { agility: 3 } },
  { id: "guardian-mail", name: "Cotte du gardien", kind: "equipment", rarity: "Rare", slot: "chest", price: 120, sell: 65, bonus: { constitution: 2, defense: 7, slashRes: 5 }, req: { strength: 5, constitution: 6 } },
  { id: "traveler-boots", name: "Bottes de voyage", kind: "equipment", rarity: "Inhabituel", slot: "boots", price: 65, sell: 35, bonus: { agility: 1, evasion: 3, windRes: 3 }, req: { agility: 4 } },
  { id: "wisdom-ring", name: "Anneau de sagesse", kind: "equipment", rarity: "Rare", slot: "accessory1", price: 115, sell: 60, bonus: { knowledge: 2, maxMana: 12, magicPower: 3 }, req: { knowledge: 6 } },
  { id: "primal-heart", name: "Cœur primordial", kind: "special", rarity: "Mythique", price: 0, sell: 250, bonus: { magic: 3, fireRes: 8, iceRes: 8, windRes: 8, earthRes: 8 }, req: {} },
  { id: "health-potion", name: "Potion de soin", kind: "consumable", rarity: "Commun", price: 28, sell: 10, effect: { hp: 25 }, description: "Restaure 25 PV.", stock: 3 },
  { id: "mana-potion", name: "Potion de mana", kind: "consumable", rarity: "Inhabituel", price: 46, sell: 17, effect: { mana: 18 }, description: "Restaure 18 mana.", stock: 2 },
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
const ATTACKS = [
  { id: "slash", name: "Frappe tranchante", type: "physical", damage: "slash", power: 9, accuracy: 92, mana: 0, weapon: "sword", desc: "Une attaque fiable." },
  { id: "pierce", name: "Estoc précis", type: "physical", damage: "pierce", power: 8, accuracy: 97, mana: 0, weapon: "spear", desc: "Précision élevée." },
  { id: "smash", name: "Grand coup", type: "physical", damage: "blunt", power: 14, accuracy: 78, mana: 0, weapon: "hammer", desc: "Lent mais puissant." },
  { id: "shot", name: "Tir lointain", type: "physical", damage: "pierce", power: 8, accuracy: 94, mana: 0, weapon: "bow", desc: "Frappe à distance." },
  { id: "fire", name: "Braise", type: "magic", damage: "fire", element: "fire", power: 15, accuracy: 90, mana: 8, desc: "Brûle la cible." },
  { id: "ice", name: "Éclat de glace", type: "magic", damage: "ice", element: "ice", power: 12, accuracy: 94, mana: 7, status: ["slow"], desc: "Ralentit la cible." },
  { id: "wind", name: "Lame de vent", type: "magic", damage: "wind", element: "wind", power: 11, accuracy: 97, mana: 6, desc: "Rapide et précise." },
  { id: "earth", name: "Éclat tellurique", type: "magic", damage: "earth", element: "earth", power: 17, accuracy: 84, mana: 10, desc: "Frappe lourde et lente." },
  { id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 10, desc: "Restaure des PV." },
  { id: "guard", name: "Garde", type: "buff", power: 0, accuracy: 100, mana: 4, desc: "Protection temporaire." }
];
const ZONES = [
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
const STATUS = { burn: "Brûlure", slow: "Ralentissement", stun: "Étourdissement", poison: "Poison", defenseDown: "Défense réduite", guard: "Protection" };

const emptyMastery = keys => Object.fromEntries(keys.map(id => [id, { xp: 0 }]));
function newLegacy() {
  return { deaths: 0, abandoned: 0, totalActions: 0, bestAge: 16, goldEarned: 0, unlockedClasses: ["none"], unlockedJobs: ["none"], talents: [], history: {}, characters: [], discoveries: [], primalHeart: false };
}
function newRun() {
  return { age: 16, actions: 0, gold: 40, hp: 100, maxHp: 100, mana: 30, classId: "none", jobId: "none", stats: Object.fromEntries(STATS.map(([id]) => [id, 3 + Math.floor(Math.random() * 3)])), maxStats: Object.fromEntries(STATS.map(([id]) => [id, 3])), diseases: [], statuses: [], inventory: { "health-potion": 1 }, equipment: {}, weaponMastery: emptyMastery(Object.keys(WEAPONS)), elementMastery: emptyMastery(Object.keys(ELEMENTS)), classXP: 0, jobXP: 0, explorations: 0, studyActions: 0, workActions: 0, itemsFound: 0, materials: 0, shopSeed: 0, shopStock: ["iron-sword", "leather-hood", "health-potion", "old-gem"], learned: ["slash"], equippedAttacks: ["slash", null, null, null], log: [] };
}
let save = loadSave(), activeTab = "summary", combat = null;
function defaultSave() { return { schema: 3, legacy: newLegacy(), run: null }; }
function loadSave() { try { const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)); return raw?.schema === 3 && raw.legacy && raw?.run !== undefined ? raw : defaultSave(); } catch { return defaultSave(); } }
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); const el = document.querySelector("#save-status"); if (el) el.textContent = "Sauvegardé à l'instant"; }
function esc(value) { return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]); }
function statName(id) { return STATS.find(s => s[0] === id)?.[1] || STAT_LABELS[id] || ELEMENTS[id] || WEAPONS[id] || id; }
function fmtBonuses(obj = {}) { return Object.entries(obj).map(([k, v]) => `${v >= 0 ? "+" : ""}${v} ${statName(k)}`).join(", ") || "Aucun bonus"; }
function notify(text) { const el = document.querySelector("#toast"); el.textContent = text; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2600); }
function item(id) { return ITEMS.find(i => i.id === id); }
function qty(id) { return save.run.inventory[id] || 0; }
function addItem(id, amount = 1) { save.run.inventory[id] = qty(id) + amount; }
function removeItem(id, amount = 1) { save.run.inventory[id] = Math.max(0, qty(id) - amount); if (!save.run.inventory[id]) delete save.run.inventory[id]; }
function equippedBonuses() { const out = {}; Object.values(save.run.equipment).forEach(id => Object.entries(item(id)?.bonus || {}).forEach(([k, v]) => out[k] = (out[k] || 0) + v)); return out; }
function totals() {
  const c = save.run, eq = equippedBonuses(), s = { ...c.stats };
  Object.entries(eq).forEach(([k, v]) => s[k] = (s[k] || 0) + v);
  return { ...s, accuracy: 80 + s.agility * 2 + (eq.accuracy || 0), evasion: 3 + s.agility + (eq.evasion || 0), crit: 3 + s.luck * .4 + (eq.crit || 0), critDamage: 150 + s.strength * 2 + (eq.critDamage || 0), attackSpeed: 10 + s.agility + (eq.attackSpeed || 0), defense: s.constitution * 2 + (eq.defense || 0), lifeRegen: Math.floor(s.constitution / 5) + (eq.lifeRegen || 0), maxMana: 25 + s.magic * 4 + s.knowledge * 2 + (eq.maxMana || 0), manaRegen: 2 + Math.floor(s.magic / 5) + (eq.manaRegen || 0), magicPower: s.magic * 2 + s.knowledge + (eq.magicPower || 0), magicResistance: s.magic + s.knowledge / 2 + (eq.magicResistance || 0), slashRes: Math.floor(s.constitution / 2) + (eq.slashRes || 0), pierceRes: Math.floor(s.agility / 2) + (eq.pierceRes || 0), bluntRes: Math.floor(s.strength / 3) + (eq.bluntRes || 0), fireRes: Math.floor(s.magic / 3) + (eq.fireRes || 0), iceRes: Math.floor(s.magic / 3) + (eq.iceRes || 0), windRes: Math.floor(s.agility / 3) + (eq.windRes || 0), earthRes: Math.floor(s.constitution / 3) + (eq.earthRes || 0) };
  const inherited = inheritedBonuses();
  return {
    ...s,
    accuracy: 80 + s.agility * 2 + (eq.accuracy || 0) + (inherited.accuracy || 0),
    evasion: 3 + s.agility + (eq.evasion || 0) + (inherited.evasion || 0),
    crit: 3 + s.luck * .4 + (eq.crit || 0),
    critDamage: 150 + s.strength * 2 + (eq.critDamage || 0),
    attackSpeed: 10 + s.agility + (eq.attackSpeed || 0),
    defense: s.constitution * 2 + (eq.defense || 0) + (inherited.defense || 0),
    lifeRegen: Math.floor(s.constitution / 5) + (eq.lifeRegen || 0) + (inherited.lifeRegen || 0),
    maxMana: 25 + s.magic * 4 + s.knowledge * 2 + (eq.maxMana || 0),
    manaRegen: 2 + Math.floor(s.magic / 5) + (eq.manaRegen || 0) + (c.techniqueMastery?.concentration || 0) * .5 + (inherited.manaRegen || 0),
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

let activeActionTab = "study";
function ensureSaveShape() {
  save.legacy ||= newLegacy();
  save.legacy.masteryBonuses ||= {};
  save.legacy.talents ||= [];
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
  r.learned ||= ["slash"];
  r.equippedAttacks ||= ["slash", null, null, null];
  r.shopStock ||= ["iron-sword", "leather-hood", "health-potion", "old-gem"];
  r.masteryLevels ||= {};
  Object.keys(MASTERY_DOMAINS).forEach(id => { r.masteryLevels[id] = heritageProgress(id, r).level; });
}
ensureSaveShape();
function inheritedBonuses() {
  const out = {};
  Object.entries(save.legacy.heritageDomains || {}).forEach(([id, domain]) => {
    if (WEAPONS[id] || ELEMENTS[id]) return;
    Object.entries(domain.permanent || {}).forEach(([key, value]) => { out[key] = (out[key] || 0) + value; });
  });
  return out;
}
function inheritedDomainBonuses(id) { return save.legacy.heritageDomains?.[id]?.permanent || {}; }
const HERITAGE_RANK_VALUES = {
  sword: [1, 2, 3, 4, 5, 6, 7], axe: [1, 2, 3, 4, 5, 6, 7],
  hammer: [1, 2, 3, 4, 5, 6, 7], spear: [1, 2, 3, 4, 5, 6, 7],
  bow: [1, 2, 3, 4, 5, 6, 7], dagger: [1, 2, 3, 4, 5, 6, 7],
  unarmed: [1, 2, 3, 4, 5, 6, 7], catalyst: [1, 2, 3, 4, 5, 6, 7],
  fire: [1, 2, 3, 4, 5, 6, 7], ice: [1, 2, 3, 4, 5, 6, 7],
  wind: [1, 2, 3, 4, 5, 6, 7], earth: [1, 2, 3, 4, 5, 6, 7],
  class: [1, 2, 3, 4, 5, 6, 7], farmer: [1, 2, 3, 4, 5, 6, 7],
  merchant: [1, 2, 3, 4, 5, 6, 7], scholar: [1, 2, 3, 4, 5, 6, 7],
  blacksmith: [1, 2, 3, 4, 5, 6, 7], concentration: [1, 2, 3, 4, 5, 6, 7]
};
function heritageRankValue(id, rank) {
  const values = HERITAGE_RANK_VALUES[id] || HERITAGE_RANK_VALUES.class;
  return values[Math.max(0, Math.min(MASTERY_LEVELS.length - 1, rank))];
}
function heritageProgress(id, run) {
  if (!run) return { xp: 0, level: 0 };
  if (WEAPONS[id]) return { xp: run.weaponMastery?.[id]?.xp || 0, level: level(run.weaponMastery?.[id]?.xp || 0) };
  if (ELEMENTS[id]) return { xp: run.elementMastery?.[id]?.xp || 0, level: level(run.elementMastery?.[id]?.xp || 0) };
  if (id === "class") return { xp: run.classXP || 0, level: level(run.classXP || 0) };
  if (id === "concentration") return { xp: (run.techniqueMastery?.concentration || 0) * 8, level: level((run.techniqueMastery?.concentration || 0) * 8) };
  return { xp: run.jobId === id ? run.jobXP || 0 : 0, level: level(run.jobId === id ? run.jobXP || 0 : 0) };
}
function heritageAcquired(id, rank) {
  const multiplier = heritageRankValue(id, rank);
  return Object.fromEntries(Object.entries(masteryDomain(id).passive).map(([key, value]) => [key, +(value * multiplier).toFixed(2)]));
}
function addValues(left = {}, right = {}) {
  const result = { ...left };
  Object.entries(right).forEach(([key, value]) => { result[key] = +((result[key] || 0) + value).toFixed(2); });
  return result;
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
    legacy.heritageDomains[id] ||= { currentLevel: 0, lastLevel: 0, lastXp: 0, lastAcquired: {}, permanent: {} };
    const domain = legacy.heritageDomains[id];
    domain.currentLevel = Number.isFinite(domain.currentLevel) ? domain.currentLevel : 0;
    domain.lastLevel = Number.isFinite(domain.lastLevel) ? domain.lastLevel : 0;
    domain.lastXp = Number.isFinite(domain.lastXp) ? domain.lastXp : 0;
    domain.lastAcquired ||= {};
    domain.permanent ||= {};
  });
}
function recordLegacyMasteriesDeterministically(run) {
  normalizeHeritage();
  Object.keys(MASTERY_DOMAINS).forEach(id => {
    const progress = heritageProgress(id, run);
    const acquired = heritageAcquired(id, progress.level);
    const domain = save.legacy.heritageDomains[id];
    domain.currentLevel = 0;
    domain.lastLevel = progress.level;
    domain.lastXp = progress.xp;
    domain.lastAcquired = acquired;
    domain.permanent = addValues(domain.permanent, acquired);
  });
  save.legacy.masteryBonuses = Object.fromEntries(Object.entries(save.legacy.heritageDomains).map(([id, domain]) => [id, { level: domain.lastLevel, bestXp: domain.lastXp, values: { ...domain.permanent } }]));
}
function masteryDomain(id) { return MASTERY_DOMAINS[id] || { label: id, source: "Autres", passive: {} }; }
function masteryValue(id, xp) {
  const rank = level(xp);
  return Object.fromEntries(Object.entries(masteryDomain(id).passive).map(([key, value]) => [key, +(value * rank).toFixed(2)]));
}
function gainMastery(group, id, amount) {
  const mastery = save.run[group][id] ||= { xp: 0 };
  mastery.xp += amount;
  save.run.masteryLevels ||= {};
  save.run.masteryLevels[id] = level(mastery.xp);
}
function fmtPassiveValues(values) {
  return Object.entries(values).map(([key, value]) => `${value >= 0 ? "+" : ""}${value} ${STAT_LABELS[key] || PASSIVE_LABELS[key] || key}`).join(", ") || "Aucun effet";
}
function recordLegacyMasteries(r) {
  const domains = [...Object.entries(r.weaponMastery || {}), ...Object.entries(r.elementMastery || {}), ["class", { xp: r.classXP || 0 }], ...Object.entries({ farmer: r.jobId === "farmer" ? { xp: r.jobXP || 0 } : { xp: 0 }, merchant: r.jobId === "merchant" ? { xp: r.jobXP || 0 } : { xp: 0 }, scholar: r.jobId === "scholar" ? { xp: r.jobXP || 0 } : { xp: 0 }, blacksmith: r.jobId === "blacksmith" ? { xp: r.jobXP || 0 } : { xp: 0 } }), ["concentration", { xp: (r.techniqueMastery?.concentration || 0) * 8 }]];
  domains.forEach(([id, mastery]) => {
    if (!masteryDomain(id) || level(mastery.xp) < 1) return;
    const values = masteryValue(id, mastery.xp);
    const existing = save.legacy.masteryBonuses[id];
    if (!existing || level(existing.bestXp) < level(mastery.xp)) save.legacy.masteryBonuses[id] = { bestXp: mastery.xp, level: level(mastery.xp), values };
  });
}
function masteryRows() {
  const current = save.run ? [...Object.entries(save.run.weaponMastery), ...Object.entries(save.run.elementMastery), ["class", { xp: save.run.classXP }], [save.run.jobId, { xp: save.run.jobXP }], ["concentration", { xp: (save.run.techniqueMastery?.concentration || 0) * 8 }]] : [];
  return Object.entries(MASTERY_DOMAINS).map(([id, domain]) => {
    const active = current.find(([key]) => key === id)?.[1]?.xp || 0;
    const inherited = save.legacy.masteryBonuses[id];
    return `<article class="mastery-card"><header><strong>${domain.label}</strong><span class="tag">${domain.source}</span></header><p>${id === "concentration" ? "Régénération et efficacité de récupération du mana." : `Bonus permanent : ${fmtPassiveValues(domain.passive)} par rang.`}</p><small class="muted">Progression actuelle : ${MASTERY_LEVELS[level(active)]} (${active} XP) · Hérité : ${inherited ? `${MASTERY_LEVELS[inherited.level]} · ${fmtPassiveValues(inherited.values)}` : "aucun"}</small></article>`;
  }).join("");
}
function deterministicMasteryRows() {
  return Object.entries(MASTERY_DOMAINS).map(([id, domain]) => {
    const active = heritageProgress(id, save.run);
    const inherited = save.legacy.heritageDomains[id];
    const total = inherited.permanent || {};
    if (!Object.values(total).some(value => value > 0) && active.level === 0) return "";
    const effect = id === "class"
      ? `+${total.lifeExpectancy || 0} ans d'espérance de vie`
      : id === "farmer" || id === "merchant" || id === "blacksmith"
        ? `+${total.workGold || 0} or par travail dans ce métier`
        : fmtPassiveValues(total);
    return `<article class="mastery-card"><header><strong>${domain.label}</strong><span class="tag">${domain.source}</span></header><p>Rang actuel : ${MASTERY_LEVELS[active.level]} (${active.xp} XP)</p><p>Rang atteint lors de la dernière vie : <b>${MASTERY_LEVELS[inherited.lastLevel]}</b></p><p>Bonus acquis lors de la dernière génération : <b>${fmtPassiveValues(inherited.lastAcquired)}</b></p><p>Bonus permanent total : <b>${fmtPassiveValues(total)}</b></p><small class="muted">Effet concret : ${effect}</small></article>`;
  }).join("");
}
masteryRows = deterministicMasteryRows;
function actionButton(activity, id, extra) {
  return `<article class="action-card"><h3>${activity.name}</h3><p>${activity.description}</p><small class="muted">${extra || fmtBonuses(activity.gains)} · 1 an</small><button class="primary-button" data-action="${id}">Effectuer</button></article>`;
}
function actionsMarkup() {
  const subTabs = [["study", "Études"], ["training", "Entraînement"], ["exploration", "Exploration"], ["work", "Travailler"], ["rest", "Se reposer"]];
  const controls = `<div class="subtabs">${subTabs.map(([id, name]) => `<button class="tab ${activeActionTab === id ? "active" : ""}" data-action-tab="${id}">${name}</button>`).join("")}</div>`;
  let content = "";
  if (activeActionTab === "study") content = studyMarkup();
  if (activeActionTab === "training") content = trainingMarkup();
  if (activeActionTab === "exploration") content = explorationMarkup();
  if (activeActionTab === "work") content = `<div class="panel"><h2>Travailler</h2><p class="muted">Les revenus et le rendement progressent avec la maîtrise du métier.</p><div class="action-grid">${actionButton({ name: `Travail de ${JOBS[save.run.jobId].name}`, description: `Rendement estimé : ${estimatedWork()} or.`, gains: {} }, "work", `${estimatedWork()} or · maîtrise ${masteryText({ xp: save.run.jobXP })}`)}</div></div>`;
  if (activeActionTab === "rest") content = `<div class="panel"><h2>Se reposer</h2><p class="muted">Récupère les PV et le mana et peut guérir une maladie.</p><div class="action-grid">${actionButton({ name: "Repos réparateur", description: "Récupération avec une chance de guérison.", gains: {} }, "rest", "PV +18 · mana +12 · 1 an")}</div></div>`;
  return `<div class="panel"><h2>Actions</h2><p class="muted">Chaque action principale fait avancer le personnage d'une année. Les cinq sous-onglets regroupent toutes les activités.</p>${controls}</div>${content}`;
}
function renderGame() {
  ensureSaveShape();
  const tabs = [["summary", "Résumé"], ["actions", "Actions"], ["classjob", "Classes / métiers"], ["market", "Commerce"], ["inventory", "Inventaire"], ["equipment", "Équipement"], ["combat", "Combat"], ["stats", "Stats combat"], ["legacy", "Héritage"]];
  const views = { summary: summaryMarkup, actions: actionsMarkup, classjob: classJobMarkup, market: marketMarkup, inventory: inventoryMarkup, equipment: equipmentMarkup, combat: combatMarkup, stats: statsMarkup, legacy: legacyMarkup };
  document.querySelector("#tabs").innerHTML = tabs.map(([id, name]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`).join("");
  document.querySelector("#tab-content").innerHTML = views[activeTab] ? views[activeTab]() : actionsMarkup();
  document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join("");
}
function renderCreate() {
  ensureSaveShape();
  document.querySelector("#create-screen").classList.toggle("hidden", Boolean(save.run));
  document.querySelector("#game-screen").classList.toggle("hidden", !save.run);
  if (save.run) return renderGame();
  document.querySelector("#class-options").innerHTML = optionMarkup(CLASSES, save.legacy.unlockedClasses, "class");
  document.querySelector("#job-options").innerHTML = optionMarkup(JOBS, save.legacy.unlockedJobs, "job");
  const tags = [...save.legacy.unlockedClasses.filter(id => id !== "none").map(id => CLASSES[id].name), ...save.legacy.unlockedJobs.filter(id => id !== "none").map(id => JOBS[id].name), ...Object.keys(save.legacy.masteryBonuses)];
  document.querySelector("#legacy-preview").innerHTML = tags.length ? `<div class="tag-list">${tags.map(t => `<span class="tag">${esc(CLASSES[t]?.name || JOBS[t]?.name || masteryDomain(t).label || t)}</span>`).join("")}</div>` : "<p>Aucun héritage encore. La première vie commence sans spécialisation.</p>";
}
function summaryMarkup() {
  const r = save.run, s = totals();
  return `<div class="dashboard"><div class="panel"><p class="eyebrow">Run actuelle</p><h2>${esc(r.name)} <span class="muted">· ${r.age} ans</span></h2><div class="stat-grid">${STATS.map(([id, name]) => `<div class="stat"><span>${name}</span><strong>${s[id].toFixed(1)}</strong></div>`).join("")}</div><p class="hp">PV ${Math.round(r.hp)} / ${r.maxHp}</p><p class="mana">Mana ${Math.round(r.mana)} / ${Math.round(s.maxMana)}</p></div><div class="panel"><h2>Passifs hérités</h2><div class="item-grid">${masteryRows()}</div></div></div>`;
}
function studyMarkup() {
  return `<div class="panel"><h2>Études</h2><div class="action-grid">${actionButton({ name: "Études générales", description: "Développer le Savoir et la Magie.", gains: { knowledge: .25, magic: .2 } }, "study:general")}${actionButton({ name: "Étude du mana", description: "Comprendre les flux et préparer les techniques magiques.", gains: { magic: .35, knowledge: .15 } }, "study:mana")}${Object.entries(ELEMENTS).map(([id, name]) => actionButton({ name: `Étude élémentaire : ${name}`, description: `Renforcer l'affinité ${name}.`, gains: { knowledge: .1 } }, `study:element-${id}`, `${masteryText(save.run.elementMastery[id])} · +0,1 Savoir`)).join("")}</div></div>`;
}
function trainingMarkup() {
  const weapons = Object.entries(WEAPONS).map(([id, name]) => actionButton({ name: `Maîtrise : ${name}`, description: `Développer l'efficacité avec cette catégorie.`, gains: { agility: .1 } }, `train:weapon-${id}`, `${masteryText(save.run.weaponMastery[id])} · bonus hérité cumulatif`)).join("");
  return `<div class="panel"><h2>Entraînement</h2><div class="action-grid">${actionButton({ name: "Développement physique", description: "Renforcer Force, Agilité et Constitution.", gains: { strength: .22, agility: .16, constitution: .22 } }, "train:physical")}${actionButton({ name: "Techniques de base", description: "Pratiquer le combat à mains nues.", gains: { strength: .1 } }, "train:weapon-unarmed", `${masteryText(save.run.weaponMastery.unarmed)}`)}${weapons}${save.run.classId !== "none" ? actionButton({ name: "Technique de classe", description: "Faire progresser la maîtrise de classe.", gains: {} }, "train:class", masteryText({ xp: save.run.classXP })) : ""}${actionButton({ name: "Concentration du mana", description: "Améliorer la récupération et l'efficacité du mana.", gains: { magic: .2 } }, "train:concentration", `Niveau ${save.run.techniqueMastery.concentration} · régénération +${(save.run.techniqueMastery.concentration * .5).toFixed(1)}`)}</div></div>`;
}
function explorationMarkup() {
  return `<div class="panel"><h2>Exploration</h2><div class="action-grid">${actionButton({ name: "Explorer les environs", description: "Chercher des ressources et des objets.", gains: { agility: .2, luck: .15 } }, "explore", "Butin possible · 1 an")}</div><div class="zone-grid">${ZONES.map(z => `<article class="zone-card"><header><strong>${z.name}</strong><span class="tag">Difficulté ${z.difficulty}</span></header><p>${z.description}</p><small class="muted">Récompenses : ${z.reward.map(id => item(id)?.name || id).join(", ")}</small></article>`).join("")}</div></div>`;
}
function equipmentMarkup() {
  const s = totals();
  return `<div class="panel"><h2>Équipement</h2><div class="item-grid">${Object.entries(SLOTS).map(([slot, label]) => `<article class="item-card"><header><strong>${label}</strong></header><p>${save.run.equipment[slot] ? item(save.run.equipment[slot]).name : "Emplacement vide"}</p><small class="muted">${save.run.equipment[slot] ? fmtBonuses(item(save.run.equipment[slot]).bonus) : "Choisissez un objet dans l'inventaire."}</small></article>`).join("")}</div><h3>Objets équipables</h3>${inventoryMarkup(true)}</div>`;
}
function inventoryMarkup(embedded = false) {
  const equipment = Object.entries(save.run.inventory).map(([id, amount]) => { const i = item(id); return i?.kind === "equipment" ? `<article class="item-card"><header><strong>${i.name}</strong><span class="tag">${i.rarity}</span></header><p>${i.description || fmtBonuses(i.bonus)}<br>${Object.entries(i.req || {}).map(([k,v]) => `${statName(k)} ${v}`).join(", ") || "Aucun prérequis"}</p><button class="mini-button" data-equip="${id}">Équiper</button></article>` : ""; }).join("");
  const other = Object.entries(save.run.inventory).map(([id, amount]) => { const i = item(id); return i?.kind !== "equipment" ? `<article class="item-card"><header><strong>${i.name}</strong><span class="tag">x${amount}</span></header><p>${i.description || fmtBonuses(i.bonus)}</p>${i.kind === "consumable" ? `<button class="mini-button" data-use="${id}">Utiliser</button>` : ""}</article>` : ""; }).join("");
  return `<div class="${embedded ? "" : "panel"}">${embedded ? "" : "<h2>Inventaire</h2>"}<div class="item-grid">${equipment || "<p class=\"empty\">Aucun équipement dans l'inventaire.</p>"}${other}</div></div>`;
}
function marketMarkup() { const stock = [...new Set([...(save.run.shopStock || []), ...ITEMS.filter(i => i.kind === "equipment").slice(0, 4).map(i => i.id)])]; return `<div class="panel"><h2>Commerce</h2><div class="item-grid">${stock.map(id => { const i = item(id); return `<article class="item-card"><header><strong>${i.name}</strong><span class="price">${i.price} or</span></header><p>${i.description || fmtBonuses(i.bonus)}</p><button class="mini-button" data-buy="${id}" ${save.run.gold < i.price ? "disabled" : ""}>Acheter</button></article>`; }).join("")}</div></div>`; }
function statsMarkup() { const s = totals(); return `<div class="panel"><h2>Statistiques de combat</h2><div class="stat-grid">${["accuracy","evasion","crit","attackSpeed","defense","lifeRegen","maxMana","manaRegen","magicPower","magicResistance","fireRes","iceRes","windRes","earthRes"].map(k => `<div class="stat"><span>${STAT_LABELS[k] || k}</span><strong>${Number(s[k]).toFixed(1)}</strong></div>`).join("")}</div></div>`; }
function legacyMarkup() { return `<div class="panel"><h2>Héritage évolutif</h2><p class="muted">Les meilleurs rangs de chaque vie alimentent un bonus permanent. Les maîtrises actives de la génération actuelle restent indépendantes et repartent à zéro.</p><div class="item-grid">${masteryRows()}</div></div>`; }
function classJobMarkup() { const r = save.run; return `<div class="two-columns"><div class="panel"><h2>Classe</h2><p><b>${CLASSES[r.classId].name}</b> · ${CLASSES[r.classId].description}</p><p>Maîtrise : ${masteryText({ xp: r.classXP })}</p></div><div class="panel"><h2>Métier</h2><p><b>${JOBS[r.jobId].name}</b> · ${JOBS[r.jobId].description}</p><p>Maîtrise : ${masteryText({ xp: r.jobXP })}</p></div></div>`; }
function combatMarkup() { return `<div class="panel"><h2>Combat</h2><p class="muted">Les rencontres sont déclenchées depuis Exploration. Les bonus hérités sont appliqués aux statistiques de combat.</p></div>`; }
function doAction(id) {
  const r = save.run;
  if (id.startsWith("study:")) {
    const type = id.slice(6);
    if (type.startsWith("element-")) gainMastery("elementMastery", type.slice(8), 3);
    r.studyActions++;
    return completeAction("Étude accomplie.", type === "general" ? { knowledge: .25, magic: .2 } : { knowledge: .15, magic: .2 });
  }
  if (id.startsWith("train:")) {
    const type = id.slice(6);
    if (type.startsWith("weapon-")) gainMastery("weaponMastery", type.slice(7), 2);
    if (type === "class") r.classXP += .7;
    if (type === "concentration") r.techniqueMastery.concentration++;
    return completeAction("Entraînement accompli.", { strength: .1, agility: .1 });
  }
  if (id === "explore") { r.explorations++; const found = Math.random() < .7 ? ["ore", "old-gem", "health-potion"][Math.floor(Math.random() * 3)] : null; if (found) { addItem(found); r.itemsFound++; } return completeAction(found ? `Exploration : ${item(found).name} trouvé.` : "Exploration : rien trouvé.", { agility: .2, luck: .15 }); }
  if (id === "work") { const job = JOBS[r.jobId], earnings = estimatedWork(); r.gold += earnings; save.legacy.goldEarned += earnings; r.workActions++; r.jobXP += 2; if (job.stat) gainStat(job.stat, .2); return completeAction(`Travail de ${job.name} : +${earnings} or.`); }
  if (id === "rest") return rest();
}
function equip(id) { const i = item(id), s = totals(); if (!i || !i.req || Object.entries(i.req).some(([k,v]) => s[k] < v)) return notify("Prérequis statistiques non atteint."); save.run.equipment[i.slot] = id; persist(); renderGame(); }
function buy(id) { const i = item(id); if (!i || save.run.gold < i.price) return notify("Or insuffisant."); save.run.gold -= i.price; addItem(id); persist(); renderGame(); }
function useItem(id) { const i = item(id); if (!i || !qty(id)) return; if (i.effect?.hp) save.run.hp = Math.min(save.run.maxHp, save.run.hp + i.effect.hp); if (i.effect?.mana) save.run.mana = Math.min(totals().maxMana, save.run.mana + i.effect.mana); removeItem(id); persist(); renderGame(); }
function startLife(e) { e.preventDefault(); const data = new FormData(e.target), r = newRun(); r.name = String(data.get("name")).trim(); r.classId = data.get("class"); r.jobId = data.get("job"); r.talents = []; Object.values(save.legacy.heritageDomains || {}).forEach(domain => Object.entries(domain.permanent || {}).forEach(([key, value]) => { if (STATS.some(([id]) => id === key)) r.stats[key] += value; })); if (CLASSES[r.classId].stat) r.stats[CLASSES[r.classId].stat]++; if (JOBS[r.jobId].stat) r.stats[JOBS[r.jobId].stat]++; r.maxStats = { ...r.stats }; save.run = r; log("Naissance : les passifs hérités influencent cette génération."); persist(); renderCreate(); }
function die(reason) { const r = save.run; log(reason); save.legacy.deaths++; recordLegacyMasteries(r); save.legacy.bestAge = Math.max(save.legacy.bestAge, r.age); recordLegacyMasteries(r); Object.keys(r.maxStats || {}).forEach(k => save.legacy.history[k] = Math.max(save.legacy.history[k] || 0, r.maxStats[k])); save.legacy.characters.unshift({ name: r.name, age: r.age, classId: r.classId, jobId: r.jobId, reason }); save.legacy.characters = save.legacy.characters.slice(0, 20); save.run = null; persist(); renderCreate(); }
function abandonLife() { if (!save.run || !confirm("Mettre fin à cette run sans compter une mort ?")) return; save.legacy.abandoned++; save.run = null; persist(); renderCreate(); }
renderCreate();
function level(xp) { return Math.max(0, Math.min(MASTERY_LEVELS.length - 1, MASTERY_XP.reduce((n, threshold) => xp >= threshold ? n + 1 : n, 0) - 1)); }
function masteryText(data) { return `${MASTERY_LEVELS[level(data.xp)]} (${data.xp} XP)`; }
function log(text) { save.run.log.unshift(`${save.run.age} ans : ${text}`); save.run.log = save.run.log.slice(0, 60); }
function unlockChecks() {
  const before = [...save.legacy.unlockedClasses, ...save.legacy.unlockedJobs];
  Object.entries(CLASSES).forEach(([id, c]) => { if (!save.legacy.unlockedClasses.includes(id) && c.unlock({ run: save.run, legacy: save.legacy })) { save.legacy.unlockedClasses.push(id); log(`Connaissance acquise : classe ${c.name} débloquée.`); notify(`${c.name} débloqué !`); } });
  Object.entries(JOBS).forEach(([id, j]) => { if (!save.legacy.unlockedJobs.includes(id) && j.unlock({ run: save.run, legacy: save.legacy })) { save.legacy.unlockedJobs.push(id); log(`Métier débloqué : ${j.name}.`); notify(`${j.name} débloqué !`); } });
  if (save.legacy.primalHeart && !save.legacy.unlockedClasses.includes("primordial")) save.legacy.unlockedClasses.push("primordial");
  return before.length !== save.legacy.unlockedClasses.length + save.legacy.unlockedJobs.length;
}
function optionMarkup(data, available, group, current = "none") { return Object.entries(data).filter(([, v]) => !v.hidden || available.includes(Object.keys(data).find(id => data[id] === v))).map(([id, v]) => { const ok = available.includes(id); return `<label class="option ${ok ? "" : "locked"}"><input type="radio" name="${group}" value="${id}" ${id === current ? "checked" : ""} ${ok ? "" : "disabled"}><span><strong>${v.name}${ok ? "" : " 🔒"}</strong><small>${ok ? v.description : "Condition non remplie pendant cette run."}</small></span></label>`; }).join(""); }
function renderCreate() {
  document.querySelector("#create-screen").classList.toggle("hidden", Boolean(save.run)); document.querySelector("#game-screen").classList.toggle("hidden", !save.run);
  if (save.run) return renderGame();
  document.querySelector("#class-options").innerHTML = optionMarkup(CLASSES, save.legacy.unlockedClasses, "class");
  document.querySelector("#job-options").innerHTML = optionMarkup(JOBS, save.legacy.unlockedJobs, "job");
  const tags = [...save.legacy.unlockedClasses.filter(id => id !== "none").map(id => CLASSES[id].name), ...save.legacy.unlockedJobs.filter(id => id !== "none").map(id => JOBS[id].name), ...save.legacy.talents.map(t => t.name)];
  document.querySelector("#legacy-preview").innerHTML = tags.length ? `<div class="tag-list">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : "<p>Aucun héritage encore. La première vie commence sans spécialisation.</p>";
}
function startLife(e) {
  e.preventDefault(); const data = new FormData(e.target), r = newRun(); r.classId = data.get("class"); r.jobId = data.get("job"); r.name = String(data.get("name")).trim();
  r.maxStats = { ...r.stats };
  save.legacy.talents.forEach(t => { r.stats[t.stat] += t.amount; }); r.talents = [...save.legacy.talents];
  Object.values(save.legacy.masteryBonuses || {}).forEach(domain => Object.entries(domain.values || {}).forEach(([key, value]) => { if (STATS.some(([id]) => id === key)) r.stats[key] += value; }));
  const cls = CLASSES[r.classId], job = JOBS[r.jobId]; if (cls.stat) r.stats[cls.stat]++; if (job.stat) r.stats[job.stat]++;
  save.run = r; log("Naissance. Les héritages accélèrent l'apprentissage de cette génération."); persist(); renderCreate();
}
function advanceYear() {
  const r = save.run; r.age++; r.actions++; save.legacy.totalActions++; r.hp = Math.min(r.maxHp, r.hp + totals().lifeRegen); r.mana = Math.min(totals().maxMana, r.mana + totals().manaRegen);
  if (r.age % 5 === 0) refreshShop(); if (Math.random() < Math.max(.03, .14 - totals().constitution * .006)) contractDisease(); progressDisease(); if (r.age >= lifeExpectancy() - 3 && Math.random() < .08 + (r.age - (lifeExpectancy() - 3)) * .1) die("Le vieillissement probabiliste vous emporte.");
  r.maxStats = { ...r.maxStats }; Object.keys(r.stats).forEach(k => r.maxStats[k] = Math.max(r.maxStats[k], r.stats[k])); unlockChecks(); persist();
}
function gainStat(key, amount = .1) { save.run.stats[key] = Math.min(20, save.run.stats[key] + amount); }
function completeAction(text, gains = {}) { advanceYear(); if (!save.run) return; Object.entries(gains).forEach(([k, v]) => gainStat(k, v)); if (save.run.classId !== "none") save.run.classXP += .5; unlockChecks(); log(text); persist(); renderGame(); }
function contractDisease() { if (save.run.diseases.length) return; const names = [["Rhume", "Légère", 1], ["Fièvre des marais", "Modérée", 2], ["Peste grise", "Grave", 3]]; const d = names[Math.floor(Math.random() * names.length)]; save.run.diseases.push({ name: d[0], severity: d[1], progression: d[2] }); log(`Maladie contractée : ${d[0]} (${d[1]}).`); }
function progressDisease() { save.run.diseases.forEach(d => { if (Math.random() < .35) { d.progression++; if (d.progression >= 4 && d.severity !== "Critique") { d.severity = d.severity === "Légère" ? "Modérée" : d.severity === "Modérée" ? "Grave" : "Critique"; d.progression = 0; log(`${d.name} s'aggrave : gravité ${d.severity}.`); } if (d.severity === "Critique" && Math.random() < .28) die(`La maladie ${d.name} devient mortelle.`); } }); }
function rest() { advanceYear(); if (!save.run) return; const r = save.run; r.hp = Math.min(r.maxHp, r.hp + 18); r.mana = Math.min(totals().maxMana, r.mana + 12); if (r.diseases.length && Math.random() < .45) { const healed = r.diseases.shift(); log(`Repos efficace : ${healed.name} est guérie.`); } else log("Repos : récupération partielle."); persist(); renderGame(); }
function actionMarkup() { return `<div class="panel"><h2>Actions principales</h2><p class="muted">Une action principale avance toujours d'une année. Les gains sont volontairement lents pour donner du poids aux choix.</p><div class="action-grid">${[["train","Entraînement physique","Force et Constitution.",{ strength:.25, constitution:.2 }],["study","Étude générale","Savoir et Magie sans affinité élémentaire.",{ knowledge:.25, magic:.2 }],["explore","Exploration générale","Objets, matériaux et découvertes incertaines.",{ agility:.2, luck:.15 }],["work","Travailler",`Gain estimé : ${estimatedWork()} or.`,{}],["rest","Se reposer","Récupération et chance de guérison.",{}]].map(([id,name,desc,g]) => `<article class="action-card"><h3>${name}</h3><p>${desc}</p><small class="muted">${fmtBonuses(g)} · 1 an</small><button class="primary-button" data-action="${id}">Effectuer</button></article>`).join("")}</div><h3>Études élémentaires ciblées</h3><div class="action-grid">${Object.entries(ELEMENTS).map(([id,name]) => `<article class="action-card"><h3>Sensibilité au ${name.toLowerCase()}</h3><p>Travaille uniquement l'affinité ${name} et débloque ses techniques.</p><small class="muted">${masteryText(save.run.elementMastery[id])}</small><button class="secondary-button" data-element-study="${id}">Étudier ${name}</button></article>`).join("")}</div></div>`; }
function estimatedWork() { const r = save.run, job = JOBS[r.jobId]; return Math.round(job.work * (1 + level(r.jobXP) * .12) + (r.jobId === "merchant" ? Math.floor(r.gold * .03) : 0) + (inheritedDomainBonuses(r.jobId).workGold || 0)); }
function doAction(id) {
  const r = save.run;
  if (id === "train") return completeAction("Entraînement discipliné (+progression lente).", { strength:.25, constitution:.2 });
  if (id === "study") { r.studyActions++; return completeAction("Étude générale (+Savoir, +Magie).", { knowledge:.25, magic:.2 }); }
  if (id === "explore") { r.explorations++; const result = explore(); completeAction(result, { agility:.2, luck:.15 }); return; }
  if (id === "work") { const job = JOBS[r.jobId]; const earnings = Math.round(job.work * (1 + level(r.jobXP) * .12) + (r.jobId === "merchant" ? Math.floor(r.gold * .03) : 0)); advanceYear(); if (!save.run) return; r.gold += earnings; save.legacy.goldEarned += earnings; r.workActions++; r.jobXP += 2; if (job.stat) gainStat(job.stat, .2); unlockChecks(); log(`Travail de ${job.name} : +${earnings} or, maîtrise ${masteryText({ xp: r.jobXP })}.`); persist(); return renderGame(); }
  if (id === "rest") return rest();
}
function explore() { const roll = Math.random(); let id = roll < .08 ? "ember" : roll < .2 ? "old-gem" : roll < .4 ? "ore" : roll < .55 ? "health-potion" : null; if (id) { addItem(id); save.run.itemsFound++; if (item(id).kind === "material") save.run.materials++; return `Découverte (${item(id).rarity}) : ${item(id).name} x1.`; } return "La zone explorée ne révèle rien d'utile."; }
function refreshShop() { const candidates = ITEMS.filter(i => i.price && i.kind !== "special"); const shuffled = candidates.sort(() => Math.random() - .5); save.run.shopStock = shuffled.slice(0, 6).map(i => i.id); log("Le commerce se renouvelle pour les cinq prochaines années."); }
function classJobMarkup() { const r = save.run, cls = CLASSES[r.classId], job = JOBS[r.jobId]; return `<div class="two-columns"><div class="panel"><h2>Classe et progression</h2><p><b>${cls.name}</b> · ${cls.description}</p><div class="summary-list"><div>Maîtrise actuelle : <b>${masteryText({ xp: r.classXP })}</b></div><div>Bonus actif : <b>${cls.stat ? `+${fmtBonuses({ [cls.stat]: 1 })}` : "aucun"}</b></div><div>Techniques propres : <b>${r.classId === "none" ? "aucune" : "progression spécifique à la classe"}</b></div></div><h3>Évolutions découvertes</h3><div class="tag-list">${save.legacy.unlockedClasses.filter(id => CLASSES[id].hidden).map(id => `<span class="tag">${CLASSES[id].name}</span>`).join("") || "<span class=\"empty\">Les spécialisations cachées apparaissent après leur découverte.</span>"}</div>${r.classId === "none" ? `<h3>Déblocages disponibles cette run</h3><div class="tag-list">${save.legacy.unlockedClasses.filter(id => id !== "none").map(id => `<button class="mini-button" data-select-class="${id}">${CLASSES[id].name}</button>`).join("") || "<span class=\"empty\">Continuez vos actions pour en débloquer.</span>"}</div>` : ""}</div><div class="panel"><h2>Métier et maîtrise</h2><p><b>${job.name}</b> · ${job.description}</p><div class="summary-list"><div>Niveau actuel : <b>${masteryText({ xp: r.jobXP })}</b></div><div>XP : <b>${r.jobXP} / ${MASTERY_XP[6]}</b></div><div>Effet travail : <b>${job.work} or de base</b></div></div>${r.jobId === "none" ? `<h3>Métiers accessibles</h3><div class="tag-list">${save.legacy.unlockedJobs.filter(id => id !== "none").map(id => `<button class="mini-button" data-select-job="${id}">${JOBS[id].name}</button>`).join("") || "<span class=\"empty\">Continuez vos actions pour en débloquer.</span>"}</div>` : ""}</div></div>`; }
function summaryMarkup() { const r = save.run, s = totals(); return `<div class="dashboard"><div class="panel"><p class="eyebrow">Run actuelle</p><h2>${esc(r.name)} <span class="muted">— ${CLASSES[r.classId].name} (${masteryText({ xp: r.classXP })}) — ${JOBS[r.jobId].name} (${masteryText({ xp: r.jobXP })})</span></h2><div class="summary-list"><div>Âge : <b>${r.age} ans</b> · Espérance estimée : <b>${lifeExpectancy()} ans</b></div><div>Actions : <b>${r.actions}</b> · Richesse : <b class="price">${r.gold} or</b></div></div><div class="stat-grid">${STATS.map(([id,name]) => `<div class="stat"><span>${name}</span><strong>${s[id].toFixed(1)}</strong><div class="meter"><i style="width:${Math.min(100,s[id]*5)}%"></i></div></div>`).join("")}</div><h3>Secondaires et résistances</h3><div class="tag-list">${Object.entries(STAT_LABELS).map(([id,name]) => `<span class="tag">${name} : ${Number(s[id]).toFixed(1)}</span>`).join("")}</div></div><div class="panel"><h3>Vitalité</h3><div class="summary-list"><div class="hp">PV ${Math.ceil(r.hp)} / ${r.maxHp}</div><div class="bar"><i style="width:${r.hp/r.maxHp*100}%"></i></div><div class="mana">Mana ${Math.ceil(r.mana)} / ${Math.ceil(s.maxMana)}</div><div class="bar"><i style="width:${r.mana/s.maxMana*100}%"></i></div></div><h3>Maladies et statuts</h3>${r.diseases.length ? r.diseases.map(d => `<p class="danger">${d.name} · ${d.severity} · progression ${d.progression}/4</p>`).join("") : "<p class=\"good\">Aucune maladie.</p>"}${r.statuses.length ? `<p>${r.statuses.map(x => STATUS[x] || x).join(", ")}</p>` : ""}<h3>Équipement</h3>${equipmentList()}</div></div>`; }
function lifeExpectancy() { return Math.round(30 + Math.max(0, totals().constitution - 5) * .7 + save.legacy.talents.filter(t => t.stat === "constitution").length * 1.5); }
function equipmentList() { return Object.entries(SLOTS).map(([slot,name]) => `<div class="summary-list"><div>${name} : <b>${item(save.run.equipment[slot])?.name || "Aucun"}</b></div></div>`).join(""); }
function marketMarkup() { const r = save.run; return `<div class="panel"><h2>Commerce</h2><p class="muted">Stock actuel · renouvellement à ${r.age % 5 === 0 ? "présent" : `${5 - r.age % 5} an(s)`}. Les quantités sont cumulables.</p><div class="item-grid">${r.shopStock.map(id => marketCard(item(id))).join("")}</div></div>`; }
function marketCard(i) { const owned = qty(i.id); return `<article class="item-card"><header><strong>${i.name}</strong><span class="price">${i.price} or</span></header><small class="muted">${i.rarity} · ${i.kind === "equipment" ? "Équipement" : i.kind === "consumable" ? i.description : i.description || "Objet spécial"}</small><small class="muted">Possédé : ${owned} · Revente : ${i.sell} or</small><button class="mini-button" data-buy="${i.id}" ${save.run.gold < i.price ? "disabled" : ""}>Acheter</button></article>`; }
function inventoryMarkup() { const ids = Object.keys(save.run.inventory); return `<div class="panel"><h2>Inventaire</h2><p class="muted">Équipements et objets de valeur peuvent être possédés en plusieurs exemplaires. Les consommables sont utilisés selon leur quantité.</p><div class="item-grid">${ids.length ? ids.map(id => inventoryCard(item(id), qty(id))).join("") : "<p class=\"empty\">Inventaire vide.</p>"}</div></div>`; }
function inventoryCard(i, count) { if (!i) return ""; const equipped = Object.values(save.run.equipment).includes(i.id); const req = Object.entries(i.req || {}).filter(([k,v]) => totals()[k] < v).map(([k,v]) => `${statName(k)} ${v}`); return `<article class="item-card"><header><strong>${i.name}</strong><span class="tag">x${count}</span></header><small class="muted">${i.rarity} · ${i.kind} · ${i.sell} or à la vente</small>${i.bonus ? `<p>${fmtBonuses(i.bonus)}</p>` : `<p>${i.description || ""}</p>`}${i.kind === "equipment" ? `<small class="muted">Prérequis : ${req.join(", ") || "aucun"}</small><button class="mini-button" data-equip="${i.id}" ${req.length ? "disabled" : ""}>${equipped ? "Déséquiper" : "Équiper"}</button>` : i.kind === "consumable" ? `<button class="mini-button" data-use="${i.id}">Utiliser</button>` : ""}<button class="secondary-button" data-sell="${i.id}">Vendre (${i.sell} or)</button></article>`; }
function equipmentMarkup() { return `<div class="panel"><h2>Équipement · 9 emplacements</h2><p class="muted">Les prérequis sont exclusivement statistiques. Les bonus sont recalculés immédiatement.</p><div class="item-grid">${Object.entries(SLOTS).map(([slot,name]) => { const id = save.run.equipment[slot], i = item(id); return `<article class="item-card"><strong>${name}</strong><p>${i ? `${i.name}<br>${fmtBonuses(i.bonus)}` : "Aucun objet équipé"}</p>${i ? `<button class="mini-button" data-equip="${i.id}">Retirer</button>` : ""}</article>`; }).join("")}</div></div>`; }
function statsMarkup() { const r = save.run; return `<div class="two-columns"><div class="panel"><h2>Statistiques de combat</h2><h3>Maîtrises d'armes</h3><table><tbody>${Object.entries(r.weaponMastery).map(([id,d]) => `<tr><td>${WEAPONS[id]}</td><td>${masteryText(d)}</td></tr>`).join("")}</tbody></table></div><div class="panel"><h2>Maîtrises élémentaires</h2><table><tbody>${Object.entries(r.elementMastery).map(([id,d]) => `<tr><td>${ELEMENTS[id]}</td><td>${masteryText(d)}</td></tr>`).join("")}</tbody></table><h3>Attaques apprises</h3><p class="muted">Quatre attaques sont équipées. Cliquez sur une attaque apprise pour remplacer la dernière case équipée.</p><div class="tag-list">${r.learned.map(id => `<button class="mini-button" data-set-attack="${id}" ${r.equippedAttacks.includes(id) ? "disabled" : ""}>${ATTACKS.find(a => a.id === id)?.name || id}</button>`).join("")}</div><h3>Talents conditionnels</h3><div class="tag-list">${["Riposte", "Berserker", "Prédateur", "Instinct élémentaire", "Dernier souffle"].map(t => `<span class="tag">${t}</span>`).join("")}</div></div></div>`; }
function combatMarkup() { if (combat) return combatMarkupActive(); return `<div class="panel"><h2>Zones de combat</h2><p class="muted">Choisissez Manuel pour décider à chaque tour, ou Automatique pour laisser l'IA gérer attaques, mana et faiblesses.</p><div class="inline-actions"><label>Mode<select id="combat-mode"><option value="manual">Manuel</option><option value="auto" ${localStorage.getItem("retry-combat-mode") === "auto" ? "selected" : ""}>Automatique</option></select></label></div><div class="zone-grid">${ZONES.map(zoneCard).join("")}</div></div>`; }
function zoneCard(z) { const req = z.req ? z.req.stat ? `${statName(z.req.stat)} ${z.req.value}` : `${ELEMENTS[z.req.element]} niveau ${z.req.value}` : "aucun"; const s = totals(); const locked = z.req && (z.req.stat ? s[z.req.stat] < z.req.value : level(save.run.elementMastery[z.req.element]) < z.req.value); return `<article class="zone-card ${locked ? "locked" : ""}"><header><strong>${z.name}</strong><span class="tag">Difficulté ${z.difficulty}</span></header><p>${z.description}<br><span class="muted">Ennemis : ${z.enemy.join(", ")}${z.boss ? " · BOSS" : ""}</span></p><small class="muted">Prérequis : ${req} · Butin : ${z.reward.map(id => item(id).name).join(", ")}</small><button class="primary-button" data-zone="${z.id}" ${locked ? "disabled" : ""}>Entrer</button></article>`; }
function combatMarkupActive() { const c = combat, e = c.enemy; return `<div class="panel"><div class="combat-head"><div><h2>${e.name}</h2><p class="hp">PV ${Math.max(0,e.hp)} / ${e.maxHp}</p><div class="bar"><i style="width:${Math.max(0,e.hp/e.maxHp*100)}%"></i></div><p>Résistances : ${Object.entries(e.res).map(([k,v]) => `${statName(RES_KEYS[k])} ${v}%`).join(" · ")}</p></div><div><h3>${save.run.name}</h3><p class="hp">PV ${Math.ceil(save.run.hp)} / ${save.run.maxHp}</p><p class="mana">Mana ${Math.ceil(save.run.mana)} / ${Math.ceil(totals().maxMana)}</p><p>Mode : <b>${c.mode === "auto" ? "Automatique" : "Manuel"}</b> · Tour ${c.turn}</p></div></div>${c.mode === "manual" ? `<h3>Choisir une attaque</h3><div class="attack-grid">${save.run.equippedAttacks.map(id => attackCard(ATTACKS.find(a => a.id === id))).join("")}</div>` : `<div class="notice">L'automatisation choisit une attaque adaptée à vos PV, votre mana et les résistances ennemies.<br><button class="primary-button" data-auto-turn>Résoudre le tour automatique</button></div>`}<div class="battle-log">${c.log.map(x => `<p>${esc(x)}</p>`).join("")}</div></div>`; }
function attackCard(a) { if (!a) return `<article class="attack-card locked"><strong>Emplacement vide</strong><p>Aucune technique équipée.</p></article>`; return `<article class="attack-card"><strong>${a.name}</strong><small>${a.damage || a.type} · puissance ${a.power} · Précision : ${a.accuracy} · ${a.mana} mana</small><p>${a.desc}</p><button class="mini-button" data-attack="${a.id}" ${save.run.mana < a.mana ? "disabled" : ""}>Utiliser</button></article>`; }
function legacyMarkup() { const l = save.legacy; return `<div class="two-columns"><div class="panel"><h2>Héritage</h2><div class="summary-list"><div>Runs terminées : <b>${l.deaths}</b></div><div>Runs abandonnées : <b>${l.abandoned}</b></div><div>Âge record : <b>${l.bestAge} ans</b></div><div>Or gagné : <b>${l.goldEarned}</b></div></div><h3>Classes débloquées</h3><div class="tag-list">${l.unlockedClasses.map(id => `<span class="tag">${CLASSES[id].name}</span>`).join("")}</div><h3>Métiers débloqués</h3><div class="tag-list">${l.unlockedJobs.map(id => `<span class="tag">${JOBS[id].name}</span>`).join("")}</div></div><div class="panel"><h2>Connaissances transmises</h2><p class="muted">Chaque bonus accélère l'apprentissage sans donner automatiquement le niveau.</p>${l.talents.length ? `<table><thead><tr><th>Domaine</th><th>Bonus</th><th>Source</th></tr></thead><tbody>${l.talents.map(t => `<tr><td>${t.name}</td><td>+${t.amount} ${statName(t.stat)} à la création</td><td>${t.source || "Lignée"}</td></tr>`).join("")}</tbody></table>` : "<p class=\"empty\">Aucun talent transmis : atteignez un niveau remarquable avant de mourir.</p>"}</div><div class="panel"><h2>Historique des personnages</h2>${l.characters.length ? `<table><thead><tr><th>Personnage</th><th>Classe / métier</th><th>Fin</th><th>Maîtrises actuelles</th></tr></thead><tbody>${l.characters.map(c => `<tr><td>${esc(c.name)}</td><td>${CLASSES[c.classId].name} / ${JOBS[c.jobId].name}</td><td>${c.age} ans</td><td>Classe ${c.classLevel}<br>Métier ${c.jobLevel}</td></tr>`).join("")}</tbody></table>` : "<p class=\"empty\">Les personnages terminés apparaîtront ici.</p>"}</div></div>`; }
function renderGame() { const tabs = [["summary","Résumé"],["actions","Actions"],["classjob","Classes / métiers"],["market","Commerce"],["inventory","Inventaire"],["equipment","Équipement"],["combat","Combat"],["stats","Stats combat"],["legacy","Héritage"]]; document.querySelector("#tabs").innerHTML = tabs.map(([id,n]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${n}</button>`).join(""); const views = { summary: summaryMarkup, actions: actionMarkup, classjob: classJobMarkup, market: marketMarkup, inventory: inventoryMarkup, equipment: equipmentMarkup, combat: combatMarkup, stats: statsMarkup, legacy: legacyMarkup }; document.querySelector("#tab-content").innerHTML = views[activeTab](); document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join(""); }
function buy(id) { const i = item(id); if (!i || save.run.gold < i.price) return; save.run.gold -= i.price; addItem(id); log(`Achat : ${i.name} x1.`); persist(); renderGame(); }
function sell(id) { const i = item(id); if (!i || !qty(id)) return; removeItem(id); save.run.gold += i.sell * (save.run.jobId === "merchant" ? 1.1 : 1); log(`Vente : ${i.name} x1.`); persist(); renderGame(); }
function useItem(id) { const i = item(id); if (!i || !qty(id)) return; const r = save.run; removeItem(id); if (i.effect.hp) r.hp = Math.min(r.maxHp, r.hp + i.effect.hp); if (i.effect.mana) r.mana = Math.min(totals().maxMana, r.mana + i.effect.mana); if (i.effect.stat) gainStat(i.effect.stat, i.effect.amount); if (i.id === "health-potion" && r.diseases.length && Math.random() < .2) r.diseases.shift(); log(`Utilisation : ${i.name}.`); persist(); renderGame(); }
function equip(id) { const i = item(id); if (!i || i.kind !== "equipment") return; const req = Object.entries(i.req || {}).some(([k,v]) => totals()[k] < v); if (req) return notify("Prérequis statistiques non atteint."); const old = save.run.equipment[i.slot]; if (old === id) delete save.run.equipment[i.slot]; else save.run.equipment[i.slot] = id; log(`${old === id ? "Retrait" : "Équipement"} : ${i.name}.`); persist(); renderGame(); }
function chooseClass(id) { if (save.run.classId !== "none" || !save.legacy.unlockedClasses.includes(id)) return; save.run.classId = id; save.run.classXP += 1; log(`Classe choisie pendant la run : ${CLASSES[id].name}.`); persist(); renderGame(); }
function chooseJob(id) { if (save.run.jobId !== "none" || !save.legacy.unlockedJobs.includes(id)) return; save.run.jobId = id; save.run.jobXP += 1; log(`Métier choisi pendant la run : ${JOBS[id].name}.`); persist(); renderGame(); }
function setAttack(id) { if (!save.run.learned.includes(id) || save.run.equippedAttacks.includes(id)) return; save.run.equippedAttacks[3] = id; log(`Attaque équipée : ${ATTACKS.find(a => a.id === id)?.name}.`); persist(); renderGame(); }
function gainMastery(kind, id, amount = 1) { save.run[kind][id].xp += amount; const d = save.run[kind][id]; const unlocks = kind === "elementMastery" ? { fire: ["fire"], ice: ["ice"], wind: ["wind"], earth: ["earth"] } : { sword: ["pierce"], spear: ["shot"], hammer: ["smash"], bow: ["shot"], catalyst: ["wind"], dagger: ["pierce"] }; const technique = unlocks[id]?.[0]; if (technique && d.xp >= 8 && !save.run.learned.includes(technique)) { save.run.learned.push(technique); log(`Technique débloquée : ${ATTACKS.find(a => a.id === technique)?.name}.`); } if (MASTERY_XP.includes(d.xp)) log(`${kind === "weaponMastery" ? WEAPONS[id] : ELEMENTS[id]} atteint ${masteryText(d)}.`); }
function gainElement(id, amount) { gainMastery("elementMastery", id, amount); }
function studyElement(id) { advanceYear(); if (!save.run) return; gainMastery("elementMastery", id, 3); unlockChecks(); log(`Étude ciblée du ${ELEMENTS[id]} : affinité travaillée activement.`); persist(); renderGame(); }
function enemyFor(zone) { const hp = 42 + zone.difficulty * 18; return { name: zone.enemy[Math.floor(Math.random() * zone.enemy.length)], hp, maxHp: hp, defense: 4 + zone.difficulty * 2, speed: 8 + zone.difficulty, res: { slash: zone.difficulty * 2, pierce: zone.difficulty, blunt: Math.max(0, zone.difficulty - 2), fire: zone.difficulty % 3 === 0 ? 28 : 5, ice: zone.difficulty % 4 === 0 ? 25 : 5, wind: 5, earth: zone.difficulty % 2 ? 18 : 4, magic: zone.difficulty * 2 }, statuses: [] }; }
function startCombat(zoneId) { const z = ZONES.find(x => x.id === zoneId); combat = { zone: z, enemy: enemyFor(z), mode: document.querySelector("#combat-mode")?.value || "manual", turn: 1, log: [`Entrée dans ${z.name}.`], finished: false }; localStorage.setItem("retry-combat-mode", combat.mode); renderGame(); if (combat.mode === "auto") setTimeout(autoTurn, 80); }
function chooseAttack(id) { if (!combat || combat.finished) return; const a = ATTACKS.find(x => x.id === id); resolveRound(a); }
function autoTurn() { if (!combat || combat.finished) return; const e = combat.enemy; const usable = save.run.equippedAttacks.filter(Boolean).map(id => ATTACKS.find(a => a.id === id)).filter(a => a && save.run.mana >= a.mana); let a = usable.find(x => x.type === "heal" && save.run.hp < save.run.maxHp * .42) || usable.filter(x => x.type !== "heal").sort((x,y) => ((y.power || 0) - (e.res[y.damage] || 0)) - ((x.power || 0) - (e.res[x.damage] || 0)))[0] || usable[0]; resolveRound(a || ATTACKS[0]); }
function resolveRound(a) { if (!a || !combat) return; const r = save.run, e = combat.enemy, inherited = inheritedBonuses(), weaponLegacy = inheritedDomainBonuses(a.weapon), elementLegacy = inheritedDomainBonuses(a.element); let line = `Tour ${combat.turn} : ${a.name}.`; const cost = Math.max(0, Math.ceil(a.mana * (1 - (inherited.manaEfficiency || 0) / 100))); if (r.mana < cost) return notify("Mana insuffisant."); r.mana -= cost; if (a.type === "heal") { const heal = 16 + totals().magicPower * .4; r.hp = Math.min(r.maxHp, r.hp + heal); line += ` Soin de ${Math.round(heal)} PV.`; } else if (a.type === "buff") { r.statuses.push("guard"); line += " Protection active."; } else { if (Math.random() * 100 > a.accuracy + (totals().accuracy - 80) + (weaponLegacy.accuracy || 0)) line += " L'attaque échoue."; else { let damage = a.power + (a.type === "magic" ? totals().magicPower + (elementLegacy.magicPower || 0) : totals().strength * .7) + (weaponLegacy.damage || 0) + (inherited.damage || 0); if (r.hp < r.maxHp * .3) { damage *= 1.15; line += " Berserker augmente les dégâts."; } if (e.hp < e.maxHp * .25) { damage *= 1.12; line += " Prédateur profite de la faiblesse."; } const resist = e.res[a.damage] || 0; damage *= Math.max(.2, 1 - resist / 100); const critical = Math.random() * 100 < totals().crit; if (critical) damage *= totals().critDamage / 100; damage = Math.max(1, Math.round(damage)); e.hp -= damage; line += ` ${damage} dégâts${critical ? " critiques" : ""} (${resist}% résistance appliquée).`; if (a.weapon) gainMastery("weaponMastery", a.weapon, 1); if (a.status?.length) { e.statuses.push(...a.status); line += ` ${a.status.map(x => STATUS[x]).join(", ")}.`; } } } combat.log.unshift(line); if (e.hp <= 0) return finishCombat(true); const enemyDamage = Math.max(1, Math.round(5 + combat.zone.difficulty * 2 - totals().defense * .18)); r.hp -= r.statuses.includes("guard") ? Math.round(enemyDamage * .55) : enemyDamage; combat.log.unshift(`${e.name} inflige ${enemyDamage} dégâts.`); if (r.hp <= 0 && Math.random() < .12) { r.hp = 1; combat.log.unshift("Dernier souffle : vous survivez à l'attaque mortelle."); } if (r.hp <= 0) return finishCombat(false); combat.turn++; persist(); renderGame(); if (combat.mode === "auto") setTimeout(autoTurn, 100); }
function finishCombat(win) { const r = save.run, z = combat.zone; combat.finished = true; if (win) { combat.log.unshift("Victoire ! Le butin remplace la récompense monétaire."); const reward = z.reward[Math.floor(Math.random() * z.reward.length)]; addItem(reward); r.itemsFound++; if (reward === "primal-heart") { save.legacy.primalHeart = true; if (!save.legacy.unlockedClasses.includes("primordial")) save.legacy.unlockedClasses.push("primordial"); combat.log.unshift("Le Cœur primordial débloque définitivement l'Arcaniste primordial."); } combat.log.unshift(`Butin : ${item(reward).name} x1.`); } else { combat.log.unshift("Défaite : le combat est mortel."); } log(win ? `Victoire dans ${z.name}.` : `Mort au combat dans ${z.name}.`); if (!win) return die("Vos blessures de combat sont mortelles."); advanceYear(); combat = null; persist(); renderGame(); }
function die(reason) { const r = save.run; log(reason); save.legacy.deaths++; recordLegacyMasteries(r); save.legacy.bestAge = Math.max(save.legacy.bestAge, r.age); Object.entries(r.maxStats).forEach(([k,v]) => save.legacy.history[k] = Math.max(save.legacy.history[k] || 0, v)); const talents = [{ name: `Vocation de ${CLASSES[r.classId].name}`, stat: CLASSES[r.classId].stat }, { name: `Connaissances de ${JOBS[r.jobId].name}`, stat: JOBS[r.jobId].stat }].filter(t => t.stat); talents.forEach(t => { if (!save.legacy.talents.some(x => x.name === t.name)) save.legacy.talents.push({ ...t, amount: Math.min(.9, .25 + level(r.classId === "none" ? r.jobXP : r.classXP) * .1), source: r.name }); }); save.legacy.characters.unshift({ name: r.name, classId: r.classId, jobId: r.jobId, age: r.age, classLevel: masteryText({ xp: r.classXP }), jobLevel: masteryText({ xp: r.jobXP }), achievements: [...r.learned], discoveries: r.itemsFound, reason }); save.legacy.characters = save.legacy.characters.slice(0, 20); save.run = null; combat = null; persist(); renderCreate(); notify("La run est terminée. Une nouvelle génération peut naître."); }
function abandonLife() { if (!save.run || !confirm("Mettre fin à cette run sans compter une mort ?")) return; save.legacy.abandoned++; save.run = null; combat = null; persist(); renderCreate(); }
document.querySelector("#create-form").addEventListener("submit", startLife);
document.querySelector("#new-life").addEventListener("click", abandonLife);
document.querySelector("#game-screen").addEventListener("click", e => { const t = e.target.closest("[data-tab]"), a = e.target.closest("[data-action]"), es = e.target.closest("[data-element-study]"), b = e.target.closest("[data-buy]"), s = e.target.closest("[data-sell]"), u = e.target.closest("[data-use]"), eq = e.target.closest("[data-equip]"), z = e.target.closest("[data-zone]"), at = e.target.closest("[data-attack]"), sa = e.target.closest("[data-set-attack]"), cc = e.target.closest("[data-select-class]"), cj = e.target.closest("[data-select-job]"); if (t) { activeTab = t.dataset.tab; renderGame(); } if (a) doAction(a.dataset.action); if (es) studyElement(es.dataset.elementStudy); if (b) buy(b.dataset.buy); if (s) sell(s.dataset.sell); if (u) useItem(u.dataset.use); if (eq) equip(eq.dataset.equip); if (z) startCombat(z.dataset.zone); if (at) chooseAttack(at.dataset.attack); if (sa) setAttack(sa.dataset.setAttack); if (cc) chooseClass(cc.dataset.selectClass); if (cj) chooseJob(cj.dataset.selectJob); if (e.target.closest("[data-auto-turn]")) autoTurn(); });
document.querySelector("#game-screen").addEventListener("change", e => { if (e.target.id === "combat-mode") { localStorage.setItem("retry-combat-mode", e.target.value); renderGame(); } });
renderCreate();

/* The activity catalogue keeps the three action areas extensible without
   coupling their definitions to the tab renderer. */
const STUDIES = [
  { id: "general", name: "Études générales", description: "Lire, observer et structurer les connaissances.", gains: { knowledge: .25, magic: .2 }, available: () => true },
  { id: "mana", name: "Étude sur le mana", description: "Comprendre les flux de mana et préparer les techniques arcaniques.", gains: { magic: .35, knowledge: .15 }, available: r => ["mage", "fireMage", "iceMage", "primordial"].includes(r.classId) },
  ...Object.entries(ELEMENTS).map(([id, name]) => ({ id: `element-${id}`, name: `Étude élémentaire : ${name}`, description: `Développer uniquement l'affinité ${name} et ses évolutions.`, element: id, gains: { knowledge: .1 }, available: r => ["mage", "fireMage", "iceMage", "primordial"].includes(r.classId) }))
];
const TRAINING = [
  { id: "physical", category: "Développement physique", name: "Développement physique", description: "Renforcer Force, Agilité et Constitution.", gains: { strength: .22, agility: .16, constitution: .22 } },
  { id: "basics", category: "Techniques de base", name: "Techniques de base", description: "Améliorer la précision et la maîtrise des mains nues.", weapon: "unarmed", gains: { agility: .12 } },
  ...Object.entries(WEAPONS).filter(([id]) => id !== "unarmed" && id !== "catalyst").map(([id, name]) => ({ id: `weapon-${id}`, category: "Techniques de combat", name: `S'entraîner : ${name}`, description: `Améliorer la maîtrise des ${name.toLowerCase()} et débloquer des techniques.`, weapon: id, gains: { strength: .1, agility: .1 } })),
  { id: "class", category: "Techniques de classe", name: "Technique de classe", description: "Répéter les fondamentaux de la classe actuelle.", classOnly: true, gains: { classXP: .7 } },
  { id: "concentration", category: "Techniques magiques", name: "Concentration de mana", description: "Développer une technique qui améliore durablement la régénération de mana.", magicOnly: true, gains: { magic: .2, concentration: 1 } }
];
function runState() {
  const r = save.run;
  r.discoveredZones ||= [];
  r.techniqueMastery ||= { concentration: 0 };
  r.weaponMastery ||= emptyMastery(Object.keys(WEAPONS));
  r.elementMastery ||= emptyMastery(Object.keys(ELEMENTS));
  return r;
}
function newRun() {
  const r = { age: 16, actions: 0, gold: 40, hp: 100, maxHp: 100, mana: 30, classId: "none", jobId: "none", stats: Object.fromEntries(STATS.map(([id]) => [id, 3 + Math.floor(Math.random() * 3)])), maxStats: Object.fromEntries(STATS.map(([id]) => [id, 3])), diseases: [], statuses: [], inventory: { "health-potion": 1 }, equipment: {}, weaponMastery: emptyMastery(Object.keys(WEAPONS)), elementMastery: emptyMastery(Object.keys(ELEMENTS)), techniqueMastery: { concentration: 0 }, discoveredZones: [], classXP: 0, jobXP: 0, explorations: 0, studyActions: 0, workActions: 0, itemsFound: 0, materials: 0, shopSeed: 0, shopStock: ["iron-sword", "leather-hood", "health-potion", "old-gem"], learned: ["slash"], equippedAttacks: ["slash", null, null, null], log: [] };
  return r;
}
function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw?.legacy || raw.run === undefined) return defaultSave();
    if (raw.schema !== 3) raw.schema = 3;
    if (raw.run) {
      raw.run.discoveredZones ||= [];
      raw.run.techniqueMastery ||= { concentration: 0 };
      raw.run.weaponMastery ||= emptyMastery(Object.keys(WEAPONS));
      raw.run.elementMastery ||= emptyMastery(Object.keys(ELEMENTS));
    }
    return raw;
  } catch (error) {
    console.warn("Impossible de charger la sauvegarde locale.", error);
    return defaultSave();
  }
}
function availableStudies() { return STUDIES.filter(study => study.available(save.run)); }
function availableTraining() {
  return TRAINING.filter(activity => !activity.classOnly || save.run.classId !== "none")
    .filter(activity => !activity.magicOnly || ["mage", "fireMage", "iceMage", "primordial"].includes(save.run.classId));
}
function activityCard(activity, action, extra = "") {
  return `<article class="action-card"><h3>${activity.name}</h3><p>${activity.description}</p><small class="muted">${extra || fmtBonuses(activity.gains)}${extra?.endsWith("1 an") ? "" : " · 1 an"}</small><button class="primary-button" data-action="${action}">Effectuer</button></article>`;
}
function actionMarkup() {
  const studyGroups = Object.entries(availableStudies().reduce((groups, study) => { const key = study.element ? "Études élémentaires" : "Études disponibles"; (groups[key] ||= []).push(study); return groups; }, {}));
  const studies = studyGroups.map(([title, entries]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${entries.map(study => activityCard(study, `study:${study.id}`, study.element ? `${masteryText(save.run.elementMastery[study.element])} · +${study.gains.knowledge} Savoir` : fmtBonuses(study.gains))).join("")}</div></section>`).join("");
  const training = Object.entries(availableTraining().reduce((groups, activity) => { (groups[activity.category] ||= []).push(activity); return groups; }, {})).map(([title, entries]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${entries.map(activity => activityCard(activity, `train:${activity.id}`, activity.weapon ? `${masteryText(save.run.weaponMastery[activity.weapon])} · ${fmtBonuses(activity.gains)}` : activity.id === "concentration" ? `Niveau ${save.run.techniqueMastery.concentration} · régénération +${save.run.techniqueMastery.concentration * .5}` : fmtBonuses(activity.gains))).join("")}</div></section>`).join("");
  return `<div class="panel"><h2>Études</h2><p class="muted">Les activités affichées dépendent des connaissances et de la classe actuelle. Une étude élémentaire ne progresse que l'élément choisi.</p>${studies}</div><div class="panel"><h2>Entraînement</h2><p class="muted">Chaque activité fait progresser uniquement ses domaines et avance l'âge d'une année.</p>${training}</div><div class="panel"><h2>Autres activités</h2><div class="action-grid">${activityCard({ name: "Travailler", description: `Gagner environ ${estimatedWork()} or.`, gains: {} }, "work", `${estimatedWork()} or · 1 an`)}${activityCard({ name: "Se reposer", description: "Récupérer des PV et du mana, avec une chance de guérison.", gains: {} }, "rest", "Récupération · 1 an")}</div></div>`;
}
function explorationMarkup() {
  const r = runState(), s = totals();
  return `<div class="panel"><h2>Exploration</h2><p class="muted">Une zone inconnue peut être tentée avant sa découverte. La première entrée la rend disponible pour toute la run. Le risque d'une rencontre dépend de la difficulté et de l'Agilité (${s.agility.toFixed(1)}).</p><div class="zone-grid">${ZONES.map(zoneCard).join("")}</div></div>`;
}
function zoneCard(z) {
  const r = runState(), s = totals(), req = z.req ? z.req.stat ? `${statName(z.req.stat)} ${z.req.value}` : `${ELEMENTS[z.req.element]} niveau ${z.req.value}` : "aucun";
  const locked = z.req && (z.req.stat ? s[z.req.stat] < z.req.value : level(r.elementMastery[z.req.element]) < z.req.value);
  const discovered = r.discoveredZones.includes(z.id);
  const encounter = Math.round(Math.max(.05, Math.min(.65, .18 + z.difficulty * .045 - s.agility * .012)) * 100);
  return `<article class="zone-card ${locked ? "locked" : ""}"><header><strong>${z.name}</strong><span class="tag">${discovered ? "Découverte" : "Inconnue"} · Difficulté ${z.difficulty}</span></header><p>${z.description}<br><span class="muted">Ennemis : ${z.enemy.join(", ")}</span></p><small class="muted">Ressources / récompenses : ${z.reward.map(id => item(id).name).join(", ")}<br>Risque : ${encounter}% de rencontre · Prérequis : ${req}</small><button class="primary-button" data-zone="${z.id}" ${locked ? "disabled" : ""}>${discovered ? "Explorer" : "Tenter la découverte"}</button></article>`;
}
function renderGame() {
  const tabs = [["summary", "Résumé"], ["study", "Études"], ["training", "Entraînement"], ["exploration", "Exploration"], ["classjob", "Classes / métiers"], ["market", "Commerce"], ["inventory", "Inventaire"], ["equipment", "Équipement"], ["combat", "Combat"], ["stats", "Stats combat"], ["legacy", "Héritage"]];
  const views = { summary: summaryMarkup, study: studyMarkup, training: trainingMarkup, exploration: explorationMarkup, classjob: classJobMarkup, market: marketMarkup, inventory: inventoryMarkup, equipment: equipmentMarkup, combat: combatMarkup, stats: statsMarkup, legacy: legacyMarkup };
  document.querySelector("#tabs").innerHTML = tabs.map(([id, name]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`).join("");
  document.querySelector("#tab-content").innerHTML = views[activeTab]();
  document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join("");
}
function studyMarkup() {
  const groups = Object.entries(availableStudies().reduce((out, study) => { const key = study.element ? "Études élémentaires" : "Études disponibles"; (out[key] ||= []).push(study); return out; }, {}));
  return `<div class="panel"><h2>Études</h2><p class="muted">Les études accessibles dépendent de la classe et des connaissances du personnage.</p>${groups.map(([title, studies]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${studies.map(study => activityCard(study, `study:${study.id}`, study.element ? `${masteryText(save.run.elementMastery[study.element])} · +${study.gains.knowledge} Savoir` : fmtBonuses(study.gains))).join("")}</div></section>`).join("")}</div>`;
}
function trainingMarkup() {
  const groups = Object.entries(availableTraining().reduce((out, activity) => { (out[activity.category] ||= []).push(activity); return out; }, {}));
  return `<div class="panel"><h2>Entraînement</h2><p class="muted">Chaque catégorie affiche les gains et la progression attendue. Les techniques de classe et magiques apparaissent après leur déblocage.</p>${groups.map(([title, activities]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${activities.map(activity => activityCard(activity, `train:${activity.id}`, activity.weapon ? `${masteryText(save.run.weaponMastery[activity.weapon])} · ${fmtBonuses(activity.gains)}` : activity.id === "concentration" ? `Niveau ${save.run.techniqueMastery.concentration} · régénération +${save.run.techniqueMastery.concentration * .5}` : fmtBonuses(activity.gains))).join("")}</div></section>`).join("")}</div><div class="panel"><h2>Autres activités</h2><div class="action-grid">${activityCard({ name: "Travailler", description: `Gagner environ ${estimatedWork()} or.`, gains: {} }, "work", `${estimatedWork()} or · 1 an`)}${activityCard({ name: "Se reposer", description: "Récupérer des PV et du mana.", gains: {} }, "rest", "Récupération · 1 an")}</div></div>`;
}
function doAction(id) {
  const r = runState();
  if (id.startsWith("study:")) {
    const study = STUDIES.find(x => x.id === id.slice(6));
    if (!study || !study.available(r)) return notify("Cette étude n'est pas encore accessible.");
    r.studyActions++;
    if (study.element) gainMastery("elementMastery", study.element, 3);
    return completeAction(`${study.name} : ${fmtBonuses(study.gains)}.`, study.gains);
  }
  if (id.startsWith("train:")) {
    const activity = TRAINING.find(x => x.id === id.slice(6));
    if (!activity || !availableTraining().includes(activity)) return notify("Cet entraînement n'est pas accessible.");
    if (activity.weapon) gainMastery("weaponMastery", activity.weapon, 2);
    if (activity.classOnly) r.classXP += activity.gains.classXP;
    if (activity.id === "concentration") r.techniqueMastery.concentration++;
    return completeAction(`${activity.name} : ${fmtBonuses(activity.gains)}.`, Object.fromEntries(Object.entries(activity.gains).filter(([key]) => key !== "classXP")));
  }
  if (id === "work") {
    const job = JOBS[r.jobId], earnings = Math.round(job.work * (1 + level(r.jobXP) * .12) + (r.jobId === "merchant" ? Math.floor(r.gold * .03) : 0));
    advanceYear(); if (!save.run) return; r.gold += earnings; save.legacy.goldEarned += earnings; r.workActions++; r.jobXP += 2; if (job.stat) gainStat(job.stat, .2); log(`Travail de ${job.name} : +${earnings} or.`); persist(); return renderGame();
  }
  if (id === "rest") return rest();
}
function startCombat(zoneId) {
  const z = ZONES.find(x => x.id === zoneId); if (!z) return;
  const r = runState(), s = totals();
  if (!r.discoveredZones.includes(z.id)) { r.discoveredZones.push(z.id); save.legacy.discoveries = [...new Set([...(save.legacy.discoveries || []), z.id])]; }
  const chance = Math.max(.05, Math.min(.65, .18 + z.difficulty * .045 - s.agility * .012));
  r.explorations++;
  if (Math.random() >= chance) {
    const reward = Math.random() < .5 ? z.reward[0] : null;
    if (reward) { addItem(reward); r.itemsFound++; if (item(reward).kind === "material") r.materials++; }
    const result = reward ? `Exploration de ${z.name} sans combat : ${item(reward).name} x1 trouvé.` : `Exploration de ${z.name} sans combat : aucune ressource trouvée.`;
    return completeAction(result, { agility: .2, luck: .15 });
  }
  combat = { zone: z, enemy: enemyFor(z), mode: document.querySelector("#combat-mode")?.value || "manual", turn: 1, log: [`Entrée dans ${z.name}. Une rencontre survient (${Math.round(chance * 100)}%).`], finished: false };
  localStorage.setItem("retry-combat-mode", combat.mode); renderGame(); if (combat.mode === "auto") setTimeout(autoTurn, 80);
}
function finishCombat(win) {
  const r = save.run, z = combat.zone, e = combat.enemy; combat.finished = true;
  if (!win) { combat.log.unshift(`Défaite dans ${z.name} contre ${e.name}.`); log(`Défaite dans ${z.name} contre ${e.name}.`); return die("Vos blessures de combat sont mortelles."); }
  const reward = z.reward[Math.floor(Math.random() * z.reward.length)], gained = [];
  addItem(reward); r.itemsFound++; if (item(reward).kind === "material") r.materials++; gained.push(`${item(reward).name} x1`);
  r.classXP += r.classId === "none" ? 0 : .5;
  combat.log.unshift(`Victoire dans ${z.name} contre ${e.name}.`);
  combat.log.unshift(`Récompenses réellement obtenues : ${gained.join(", ")}${r.classId !== "none" ? " · +0,5 XP de classe" : ""}.`);
  log(`Combat remporté dans ${z.name} contre ${e.name} : ${gained.join(", ")}${r.classId !== "none" ? " ; +0,5 XP de classe" : ""}.`);
  advanceYear(); if (!save.run) return; combat = null; persist(); renderGame();
}
function totals() {
  const c = save.run, eq = equippedBonuses(), s = { ...c.stats };
  Object.entries(eq).forEach(([k, v]) => s[k] = (s[k] || 0) + v);
  const inherited = inheritedBonuses();
  return { ...s, accuracy: 80 + s.agility * 2 + (eq.accuracy || 0) + (inherited.accuracy || 0), evasion: 3 + s.agility + (eq.evasion || 0) + (inherited.evasion || 0), crit: 3 + s.luck * .4 + (eq.crit || 0), critDamage: 150 + s.strength * 2 + (eq.critDamage || 0), attackSpeed: 10 + s.agility + (eq.attackSpeed || 0), defense: s.constitution * 2 + (eq.defense || 0) + (inherited.defense || 0), lifeRegen: Math.floor(s.constitution / 5) + (eq.lifeRegen || 0) + (inherited.lifeRegen || 0), maxMana: 25 + s.magic * 4 + s.knowledge * 2 + (eq.maxMana || 0), manaRegen: 2 + Math.floor(s.magic / 5) + (eq.manaRegen || 0) + (c.techniqueMastery?.concentration || 0) * .5 + (inherited.manaRegen || 0), magicPower: s.magic * 2 + s.knowledge + (eq.magicPower || 0) + (inherited.magicPower || 0), magicResistance: s.magic + s.knowledge / 2 + (eq.magicResistance || 0), slashRes: Math.floor(s.constitution / 2) + (eq.slashRes || 0), pierceRes: Math.floor(s.agility / 2) + (eq.pierceRes || 0), bluntRes: Math.floor(s.strength / 3) + (eq.bluntRes || 0) + (inherited.bluntRes || 0), fireRes: Math.floor(s.magic / 3) + (eq.fireRes || 0) + (inherited.fireRes || 0), iceRes: Math.floor(s.magic / 3) + (eq.iceRes || 0) + (inherited.iceRes || 0), windRes: Math.floor(s.agility / 3) + (eq.windRes || 0) + (inherited.windRes || 0), earthRes: Math.floor(s.constitution / 3) + (eq.earthRes || 0) + (inherited.earthRes || 0), damage: inherited.damage || 0 };
}

function finalDoAction(id) {
  const r = save.run;
  if (id.startsWith("study:")) {
    const type = id.slice(6);
    if (type.startsWith("element-")) gainMastery("elementMastery", type.slice(8), 3);
    r.studyActions++;
    return completeAction("Étude accomplie.", type === "general" ? { knowledge: .25, magic: .2 } : { knowledge: .15, magic: .2 });
  }
  if (id.startsWith("train:")) {
    const type = id.slice(6);
    if (type.startsWith("weapon-")) gainMastery("weaponMastery", type.slice(7), 2);
    if (type === "class") r.classXP += .7;
    if (type === "concentration") r.techniqueMastery.concentration++;
    return completeAction("Entraînement accompli.", { strength: .1, agility: .1 });
  }
  if (id === "explore") { r.explorations++; const found = Math.random() < .7 ? ["ore", "old-gem", "health-potion"][Math.floor(Math.random() * 3)] : null; if (found) { addItem(found); r.itemsFound++; } return completeAction(found ? `Exploration : ${item(found).name} trouvé.` : "Exploration : rien trouvé.", { agility: .2, luck: .15 }); }
  if (id === "work") { const job = JOBS[r.jobId], earnings = estimatedWork(); r.gold += earnings; save.legacy.goldEarned += earnings; r.workActions++; r.jobXP += 2; if (job.stat) gainStat(job.stat, .2); return completeAction(`Travail de ${job.name} : +${earnings} or.`); }
  if (id === "rest") return rest();
}
function lifeExpectancy() {
  return 30 + (inheritedBonuses().lifeExpectancy || 0);
}
function finalRenderGame() {
  ensureSaveShape();
  const tabs = [["summary", "Résumé"], ["actions", "Actions"], ["classjob", "Classes / métiers"], ["market", "Commerce"], ["inventory", "Inventaire"], ["equipment", "Équipement"], ["combat", "Combat"], ["stats", "Stats combat"], ["legacy", "Héritage"]];
  const views = { summary: summaryMarkup, actions: actionsMarkup, classjob: classJobMarkup, market: marketMarkup, inventory: inventoryMarkup, equipment: equipmentMarkup, combat: combatMarkup, stats: statsMarkup, legacy: legacyMarkup };
  document.querySelector("#tabs").innerHTML = tabs.map(([id, name]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`).join("");
  document.querySelector("#tab-content").innerHTML = (views[activeTab] || actionsMarkup)();
  document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join("");
}
function finalTrainingMarkup() {
  const weapons = Object.entries(WEAPONS).map(([id, name]) => actionButton({ name: `Maîtrise : ${name}`, description: `Développer les dégâts, la précision ou l'efficacité des ${name.toLowerCase()}.`, gains: {} }, `train:weapon-${id}`, `${masteryText(save.run.weaponMastery[id])} · héritage : ${fmtPassiveValues(masteryDomain(id).passive)}`)).join("");
  return `<div class="panel"><h2>Entraînement</h2><p class="muted">Les huit catégories d'armes, la classe et la Concentration du mana progressent indépendamment.</p><div class="action-grid">${actionButton({ name: "Développement physique", description: "Renforcer Force, Agilité et Constitution.", gains: { strength: .22, agility: .16, constitution: .22 } }, "train:physical")}${weapons}${save.run.classId !== "none" ? actionButton({ name: "Technique de classe", description: "Développer la spécialisation de la classe.", gains: {} }, "train:class", masteryText({ xp: save.run.classXP })) : ""}${actionButton({ name: "Concentration du mana", description: "Augmenter la régénération et l'efficacité de récupération du mana.", gains: {} }, "train:concentration", `Niveau ${save.run.techniqueMastery.concentration} · héritage : ${fmtPassiveValues(masteryDomain("concentration").passive)}`)}</div></div>`;
}
trainingMarkup = finalTrainingMarkup;
function finalLegacyMarkup() {
  return `<div class="panel"><h2>Héritage évolutif</h2><p class="muted">Chaque domaine conserve le meilleur rang atteint au cours des vies précédentes. Les valeurs sont cumulatives et n'effacent jamais les acquis.</p><div class="item-grid">${masteryRows()}</div></div><div class="panel"><h2>Historique</h2><p class="muted">${save.legacy.deaths} mort(s), ${save.legacy.abandoned} vie(s) abandonnée(s), record : ${save.legacy.bestAge} ans.</p></div>`;
}
legacyMarkup = finalLegacyMarkup;
function finalSummaryMarkup() {
  const r = save.run, s = totals();
  return `<div class="dashboard"><div class="panel"><p class="eyebrow">Run actuelle</p><h2>${esc(r.name)} <span class="muted">· ${r.age} ans</span></h2><p class="muted">Espérance de vie de base : 30 ans · Potentiel hérité : +${inheritedBonuses().lifeExpectancy || 0} ans · Total : ${lifeExpectancy()} ans</p><div class="stat-grid">${STATS.map(([id, name]) => `<div class="stat"><span>${name}</span><strong>${s[id].toFixed(1)}</strong></div>`).join("")}</div><p class="hp">PV ${Math.round(r.hp)} / ${r.maxHp}</p><p class="mana">Mana ${Math.round(r.mana)} / ${Math.round(s.maxMana)}</p></div><div class="panel"><h2>Passifs hérités</h2><div class="item-grid">${masteryRows()}</div></div></div>`;
}
summaryMarkup = finalSummaryMarkup;
recordLegacyMasteries = recordLegacyMasteriesDeterministically;
renderGame = finalRenderGame;
doAction = finalDoAction;
persist();
document.querySelector("#game-screen").addEventListener("click", e => {
  const actionTab = e.target.closest("[data-action-tab]");
  if (actionTab) { activeActionTab = actionTab.dataset.actionTab; activeTab = "actions"; renderGame(); }
});
if (save.run) renderGame();
