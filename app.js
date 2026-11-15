const STORAGE_KEY = "retry-rpg-save-v1";

const STATS = [
  ["strength", "Force"], ["magic", "Magie"], ["agility", "Agilité"],
  ["constitution", "Constitution"], ["knowledge", "Savoir"], ["luck", "Chance"]
];
const CLASSES = {
  none: { name: "Sans classe", description: "Aucun bonus caché. Une voie libre.", stat: null, bonus: 0, unlock: () => true },
  warrior: { name: "Guerrier", description: "Robuste et efficace au corps à corps.", stat: "strength", bonus: 2, unlock: s => s.totalDeaths >= 1 },
  mage: { name: "Mage", description: "Manipule la magie et développe le savoir.", stat: "magic", bonus: 2, unlock: s => s.maxStats.magic >= 8 },
  rogue: { name: "Voleur", description: "Rapide, opportuniste et chanceux.", stat: "agility", bonus: 2, unlock: s => s.maxStats.agility >= 7 },
  ranger: { name: "Rôdeur", description: "Survit dans la nature et frappe à distance.", stat: "constitution", bonus: 2, unlock: s => s.maxAge >= 25 },
  alchemist: { name: "Alchimiste", description: "Transforme le savoir en potions et richesses.", stat: "knowledge", bonus: 2, unlock: s => s.totalGoldEarned >= 250 }
};
const JOBS = {
  none: { name: "Sans métier", description: "Pas de progression professionnelle.", stat: null, bonus: 0, unlock: () => true },
  farmer: { name: "Fermier", description: "Travail régulier : constitution et richesse.", stat: "constitution", bonus: 1, unlock: s => s.totalActions >= 5 },
  merchant: { name: "Marchand", description: "Meilleur commerce et progression en chance.", stat: "luck", bonus: 1, unlock: s => s.totalGoldEarned >= 100 },
  scholar: { name: "Érudit", description: "Étudie les mystères : magie et savoir.", stat: "knowledge", bonus: 1, unlock: s => s.maxStats.knowledge >= 7 }
};
const ITEMS = [
  { id: "iron-sword", name: "Épée de fer", type: "Arme", price: 45, slot: "weapon", bonus: { strength: 2 }, req: { strength: 4 } },
  { id: "oak-staff", name: "Bâton de chêne", type: "Arme", price: 50, slot: "weapon", bonus: { magic: 2 }, req: { magic: 4 } },
  { id: "leather-hood", name: "Capuche de cuir", type: "Armure", price: 35, slot: "armor", bonus: { agility: 1, luck: 1 }, req: { agility: 3 } },
  { id: "guardian-mail", name: "Cotte du gardien", type: "Armure", price: 75, slot: "armor", bonus: { constitution: 3 }, req: { strength: 5, constitution: 5 } },
  { id: "wisdom-ring", name: "Anneau de sagesse", type: "Accessoire", price: 80, slot: "accessory", bonus: { knowledge: 2, magic: 1 }, req: { knowledge: 6 } },
  { id: "health-potion", name: "Potion de vitalité", type: "Consommable", price: 20, consumable: true, effect: { constitution: 2 } },
  { id: "elixir-luck", name: "Élixir de chance", type: "Consommable", price: 35, consumable: true, effect: { luck: 2 } }
];
const ACTIONS = [
  { id: "train", name: "S'entraîner", description: "+Force, +Constitution. Risque faible.", gains: { strength: 1, constitution: 1 }, gold: 2 },
  { id: "study", name: "Étudier", description: "+Savoir, +Magie. Coûte du temps.", gains: { knowledge: 1, magic: 1 }, gold: 0 },
  { id: "explore", name: "Explorer", description: "+Agilité, +Chance. Peut rapporter gros.", gains: { agility: 1, luck: 1 }, gold: 8 },
  { id: "work", name: "Travailler", description: "Gagne de l'or et progresse selon le métier.", gains: {}, gold: 25 },
  { id: "rest", name: "Se reposer", description: "Récupère de la vitalité sans gagner d'or.", gains: { constitution: 1 }, gold: 0 }
];

const blankLegacy = () => ({
  totalDeaths: 0, totalActions: 0, maxAge: 16, totalGoldEarned: 0,
  maxStats: Object.fromEntries(STATS.map(([key]) => [key, 1])),
  unlockedClasses: ["none"], unlockedJobs: ["none"], legacyTalents: []
});
let save = loadSave();
let activeTab = "summary";

function defaultSave() { return { legacy: blankLegacy(), character: null }; }
function loadSave() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultSave(); }
  catch { return defaultSave(); }
}
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  document.querySelector("#save-status").textContent = "Sauvegardé à l'instant";
}
function statName(key) { return STATS.find(([id]) => id === key)?.[1] || key; }
function characterStats(c = save.character) {
  const result = { ...c.stats };
  Object.values(c.equipment || {}).forEach(itemId => {
    const item = ITEMS.find(i => i.id === itemId);
    if (item) Object.entries(item.bonus || {}).forEach(([key, value]) => result[key] += value);
  });
  return result;
}
function formatBonuses(bonuses) {
  return Object.entries(bonuses).map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${statName(key)}`).join(", ");
}
function addLog(text) {
  save.character.log.unshift(text);
  save.character.log = save.character.log.slice(0, 40);
}
function toast(text) {
  const el = document.querySelector("#toast");
  el.textContent = text; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
function availableClasses() { return Object.keys(CLASSES).filter(id => save.legacy.unlockedClasses.includes(id)); }
function availableJobs() { return Object.keys(JOBS).filter(id => save.legacy.unlockedJobs.includes(id)); }
function optionMarkup(collection, available, group) {
  return Object.entries(collection).map(([id, option]) => {
    const unlocked = available.includes(id);
    return `<label class="option ${unlocked ? "" : "locked"}"><input type="radio" name="${group}" value="${id}" ${id === "none" ? "checked" : ""} ${unlocked ? "" : "disabled"}><span><strong>${option.name}${unlocked ? "" : " 🔒"}</strong><small>${unlocked ? option.description : "Débloqué par les accomplissements d'une vie."}</small></span></label>`;
  }).join("");
}
function renderCreate() {
  document.querySelector("#create-screen").classList.toggle("hidden", Boolean(save.character));
  document.querySelector("#game-screen").classList.toggle("hidden", !save.character);
  if (save.character) return renderGame();
  document.querySelector("#class-options").innerHTML = optionMarkup(CLASSES, availableClasses(), "class");
  document.querySelector("#job-options").innerHTML = optionMarkup(JOBS, availableJobs(), "job");
  const tags = [...save.legacy.unlockedClasses.filter(x => x !== "none").map(x => CLASSES[x].name), ...save.legacy.unlockedJobs.filter(x => x !== "none").map(x => JOBS[x].name)];
  document.querySelector("#legacy-preview").innerHTML = tags.length ? `<div class="unlock-summary">${tags.map(x => `<span class="tag">${x}</span>`).join("")}</div>` : `<p>Aucun déblocage encore. Votre première vie commence sans spécialisation.</p>`;
}
function startLife(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const classId = form.get("class"), jobId = form.get("job");
  const stats = Object.fromEntries(STATS.map(([key]) => [key, 2 + Math.floor(Math.random() * 4)]));
  const inherited = [...save.legacy.legacyTalents];
  inherited.forEach(talent => { stats[talent.stat] += talent.amount; });
  const talents = [...inherited];
  const classData = CLASSES[classId], jobData = JOBS[jobId];
  if (classData.stat) talents.push({ name: `Instinct de ${classData.name}`, stat: classData.stat, amount: 1 });
  if (jobData.stat) talents.push({ name: `Habitudes de ${jobData.name}`, stat: jobData.stat, amount: 1 });
  if (classData.stat) stats[classData.stat] += classData.bonus;
  if (jobData.stat) stats[jobData.stat] += jobData.bonus;
  save.character = { name: String(form.get("name")).trim(), age: 16, actions: 0, gold: 35, classId, jobId, stats, talents, inventory: ["health-potion"], equipment: {}, log: ["La nouvelle vie commence à 16 ans."] };
  addLog(`Classe : ${classData.name}. Métier : ${jobData.name}.`);
  persist(); renderCreate();
}
function actionMarkup() {
  return `<div class="panel"><h2>Actions de vie</h2><p class="muted">Chaque action fait avancer le temps. Toutes les 5 actions, vous vieillissez d'un an et un événement peut survenir.</p><div class="action-grid">${ACTIONS.map(action => `<article class="action-card"><h3>${action.name}</h3><p>${action.description}</p><small class="muted">${formatBonuses(action.gains) || "Aucun gain de statistique"} · ${action.gold ? `+${action.gold} or` : "pas d'or garanti"}</small><button class="primary-button" data-action="${action.id}">Effectuer</button></article>`).join("")}</div></div>`;
}
function doAction(id) {
  const c = save.character, action = ACTIONS.find(a => a.id === id);
  const job = JOBS[c.jobId];
  Object.entries(action.gains).forEach(([key, value]) => c.stats[key] = Math.min(20, c.stats[key] + value));
  if (id === "work" && job.stat) c.stats[job.stat] = Math.min(20, c.stats[job.stat] + job.bonus);
  const earned = action.gold + (id === "explore" && Math.random() < .25 ? 35 : 0);
  c.gold += earned; c.actions++; save.legacy.totalActions++; save.legacy.totalGoldEarned += earned;
  addLog(`${action.name} : ${earned ? `+${earned} or, ` : ""}${formatBonuses(action.gains) || "progression professionnelle"}.`);
  if (c.actions % 5 === 0) advanceYear();
  updateProgress();
}
function advanceYear() {
  const c = save.character; c.age++;
  addLog(`Anniversaire : ${c.age} ans.`);
  const illnessChance = Math.max(.03, .14 - characterStats(c).constitution * .006);
  if (Math.random() < illnessChance) {
    const damage = 1 + Math.floor(Math.random() * 3);
    c.stats.constitution = Math.max(1, c.stats.constitution - damage);
    addLog(`Une maladie vous affaiblit (-${damage} Constitution).`);
    if (Math.random() < .08 && c.age > 35) return die("Une maladie foudroyante vous emporte.");
  }
  if (c.age >= 70 && Math.random() < .08 + (c.age - 70) * .012) return die("Le poids des années finit par l'emporter.");
}
function die(reason) {
  const c = save.character; addLog(reason);
  save.legacy.totalDeaths++; save.legacy.maxAge = Math.max(save.legacy.maxAge, c.age);
  Object.entries(c.stats).forEach(([key, value]) => save.legacy.maxStats[key] = Math.max(save.legacy.maxStats[key], value));
  const talent = c.talents.find(t => t.amount >= 1 && !save.legacy.legacyTalents.some(old => old.name === t.name));
  if (talent) save.legacy.legacyTalents.push({ ...talent, name: `Héritage : ${talent.name}` });
  Object.entries(CLASSES).forEach(([id, data]) => { if (!save.legacy.unlockedClasses.includes(id) && data.unlock(save.legacy)) save.legacy.unlockedClasses.push(id); });
  Object.entries(JOBS).forEach(([id, data]) => { if (!save.legacy.unlockedJobs.includes(id) && data.unlock(save.legacy)) save.legacy.unlockedJobs.push(id); });
  save.character = null; persist(); renderCreate();
  toast("Votre personnage est mort. Un nouvel héritier peut naître.");
}
function summaryMarkup() {
  const c = save.character, stats = characterStats(c), className = CLASSES[c.classId].name, jobName = JOBS[c.jobId].name;
  return `<div class="dashboard"><div class="panel"><p class="eyebrow">Vie actuelle</p><h2>${c.name}</h2><div class="summary-list"><div>Âge : <b>${c.age} ans</b> · Actions : <b>${c.actions}</b></div><div>Classe : <b>${className}</b> · Métier : <b>${jobName}</b></div><div>Richesse : <b class="price">${c.gold} or</b></div></div><div class="stat-grid">${STATS.map(([key, name]) => `<div class="stat"><span>${name}</span><strong>${stats[key]}</strong><div class="meter"><i style="width:${Math.min(100, stats[key] * 5)}%"></i></div></div>`).join("")}</div></div><div class="panel"><h3>Équipement</h3>${equipmentMarkup()}<h3>Talents, succès et passifs</h3>${c.talents.length ? `<div class="unlock-summary">${c.talents.map(t => `<span class="tag">${t.name} · +${t.amount} ${statName(t.stat)}</span>`).join("")}</div>` : `<p class="empty">Aucun talent hérité pour le moment.</p>`}</div></div>`;
}
function equipmentMarkup() {
  const c = save.character;
  return Object.entries({ weapon: "Arme", armor: "Armure", accessory: "Accessoire" }).map(([slot, label]) => {
    const item = ITEMS.find(i => i.id === c.equipment[slot]);
    return `<div class="summary-list"><div>${label} : <b>${item?.name || "Aucun"}</b></div></div>`;
  }).join("");
}
function marketMarkup() {
  const c = save.character, stats = characterStats(c);
  return `<div class="panel"><h2>Commerce</h2><p class="muted">Achetez des équipements permanents pour cette vie ou consommez des potions.</p><div class="item-grid">${ITEMS.map(item => {
    const owned = c.inventory.includes(item.id), missing = Object.entries(item.req || {}).filter(([key, value]) => stats[key] < value).map(([key, value]) => `${statName(key)} ${value}`);
    const button = item.consumable
      ? `<button class="mini-button" data-use="${item.id}" ${owned ? "" : "disabled"}>${owned ? "Utiliser" : "Non possédé"}</button>`
      : `<button class="mini-button" data-buy="${item.id}" ${owned || c.gold < item.price || missing.length ? "disabled" : ""}>${owned ? "Possédé" : "Acheter"}</button>`;
    return `<article class="item-card ${missing.length ? "locked" : ""}"><header><strong>${item.name}</strong><span class="price">${item.price} or</span></header><small class="muted">${item.type} · ${item.consumable ? formatBonuses(item.effect) : formatBonuses(item.bonus)}</small>${missing.length ? `<small class="muted">Prérequis : ${missing.join(", ")}</small>` : ""}${button}</article>`;
  }).join("")}</div></div>`;
}
function equipmentTabMarkup() {
  const c = save.character, stats = characterStats(c);
  const owned = c.inventory.filter(id => ITEMS.find(i => i.id === id && !i.consumable));
  return `<div class="panel"><h2>Équipement</h2><p class="muted">Les prérequis sont uniquement statistiques. Les classes et métiers n'interviennent jamais.</p><div class="item-grid">${owned.length ? owned.map(id => { const item = ITEMS.find(i => i.id === id), equipped = Object.values(c.equipment).includes(id), missing = Object.entries(item.req || {}).some(([key, value]) => stats[key] < value); return `<article class="item-card"><header><strong>${item.name}</strong><span class="tag">${item.type}</span></header><p>${formatBonuses(item.bonus)}</p><button class="mini-button" data-equip="${item.id}" ${missing ? "disabled" : ""}>${equipped ? "Déséquiper" : "Équiper"}</button></article>`; }).join("") : `<p class="empty">Achetez votre premier équipement au marché.</p>`}</div></div>`;
}
function combatMarkup() {
  return `<div class="panel"><h2>Combat automatique</h2><p class="muted">Un combat est une action risquée. Le résultat est calculé avec vos statistiques, votre équipement, vos talents et une part d'aléatoire.</p><div class="action-card"><h3>Expédition dangereuse</h3><p>Une victoire rapporte beaucoup d'or et renforce la statistique la plus sollicitée. Une défaite peut être fatale.</p><button class="primary-button" data-combat>Lancer le combat</button></div></div>`;
}
function legacyMarkup() {
  return `<div class="panel"><h2>Héritage permanent</h2><p class="muted">Les déblocages et les talents hérités survivent à la mort de chaque personnage.</p><div class="two-columns"><div><h3>Classes débloquées</h3><div class="unlock-summary">${save.legacy.unlockedClasses.map(id => `<span class="tag">${CLASSES[id].name}</span>`).join("")}</div><h3>Métiers débloqués</h3><div class="unlock-summary">${save.legacy.unlockedJobs.map(id => `<span class="tag">${JOBS[id].name}</span>`).join("")}</div></div><div><h3>Statistiques de la lignée</h3><div class="summary-list"><div>Morts : <b>${save.legacy.totalDeaths}</b></div><div>Âge record : <b>${save.legacy.maxAge} ans</b></div><div>Actions cumulées : <b>${save.legacy.totalActions}</b></div><div>Or gagné : <b>${save.legacy.totalGoldEarned}</b></div></div>${save.legacy.legacyTalents.length ? `<h3>Passifs transmis</h3><div class="unlock-summary">${save.legacy.legacyTalents.map(t => `<span class="tag">${t.name} · +${t.amount} ${statName(t.stat)}</span>`).join("")}</div>` : ""}</div></div></div>`;
}
function renderGame() {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === activeTab));
  const content = { summary: summaryMarkup, actions: actionMarkup, market: marketMarkup, equipment: equipmentTabMarkup, combat: combatMarkup, legacy: legacyMarkup }[activeTab]();
  document.querySelector("#tab-content").innerHTML = content;
  document.querySelector("#event-log").innerHTML = save.character.log.map(line => `<li>${line}</li>`).join("");
}
function updateProgress() {
  const c = save.character;
  Object.entries(c.stats).forEach(([key, value]) => save.legacy.maxStats[key] = Math.max(save.legacy.maxStats[key], value));
  persist(); renderGame();
}
function buy(id) {
  const c = save.character, item = ITEMS.find(i => i.id === id);
  if (!item || c.gold < item.price || c.inventory.includes(id)) return;
  if (Object.entries(item.req || {}).some(([key, value]) => characterStats(c)[key] < value)) return toast("Statistiques insuffisantes.");
  c.gold -= item.price; c.inventory.push(id); addLog(`Achat : ${item.name}.`); updateProgress();
}
function useItem(id) {
  const c = save.character, item = ITEMS.find(i => i.id === id);
  if (!item?.consumable) return;
  const index = c.inventory.indexOf(id);
  if (index < 0) return;
  Object.entries(item.effect).forEach(([key, value]) => c.stats[key] = Math.min(20, c.stats[key] + value));
  c.inventory.splice(index, 1);
  addLog(`Consommé : ${item.name} (${formatBonuses(item.effect)}).`);
  updateProgress();
}
function equip(id) {
  const c = save.character, item = ITEMS.find(i => i.id === id);
  if (!item) return;
  if (Object.values(c.equipment).includes(id)) delete c.equipment[item.slot];
  else { if (Object.entries(item.req || {}).some(([key, value]) => characterStats(c)[key] < value)) return toast("Prérequis statistiques non atteint."); c.equipment[item.slot] = id; }
  addLog(`${Object.values(c.equipment).includes(id) ? "Équipement" : "Retrait"} : ${item.name}.`); updateProgress();
}
function useCombat() {
  const c = save.character, stats = characterStats(c), power = stats.strength + stats.agility + stats.magic + stats.constitution + stats.luck;
  const enemy = 20 + Math.floor(Math.random() * 35), roll = power + Math.floor(Math.random() * 20);
  c.actions++; save.legacy.totalActions++;
  if (roll >= enemy) { const gold = 45 + Math.floor(Math.random() * 45); c.gold += gold; c.stats[stats.magic >= stats.strength ? "magic" : "strength"]++; addLog(`Victoire automatique (${roll} contre ${enemy}) : +${gold} or.`); }
  else { addLog(`Défaite automatique (${roll} contre ${enemy}).`); if (Math.random() < .18) return die("Vos blessures de combat sont mortelles."); c.stats.constitution = Math.max(1, c.stats.constitution - 1); }
  if (c.actions % 5 === 0) advanceYear(); updateProgress();
}
document.querySelector("#create-form").addEventListener("submit", startLife);
document.querySelector("#new-life").addEventListener("click", () => { if (save.character && confirm("Abandonner cette vie ? Elle ne comptera pas comme une mort.")) { save.character = null; persist(); renderCreate(); } });
document.querySelector("#game-screen").addEventListener("click", event => {
  const tab = event.target.closest("[data-tab]"), action = event.target.closest("[data-action]"), buyButton = event.target.closest("[data-buy]"), useButton = event.target.closest("[data-use]"), equipButton = event.target.closest("[data-equip]");
  if (tab) { activeTab = tab.dataset.tab; renderGame(); }
  if (action) doAction(action.dataset.action);
  if (buyButton) buy(buyButton.dataset.buy);
  if (useButton) useItem(useButton.dataset.use);
  if (equipButton) equip(equipButton.dataset.equip);
  if (event.target.closest("[data-combat]")) useCombat();
});
renderCreate();
