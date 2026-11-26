import {
  CLASSES, JOBS, STATS, STAT_LABELS, WEAPONS, ELEMENTS, SLOTS, ZONES, ATTACKS, RES_KEYS,
  MASTERY_DOMAINS, MASTERY_LEVELS, MASTERY_XP, STATUS
} from "./game-data.js";
import { esc, fmtBonuses, fmtNumber, item, statName } from "./game-helpers.js?v=3";
import {
  save, activeTab, activeActionTab, combat, qty, equippedBonuses, runState, ensureSaveShape
} from "./state.js";
import {
  totals, lifeExpectancy, masteryText, fmtPassiveValues, masteryDomain, estimatedWork,
  level, heritageAcquired, inheritedBonuses
} from "./formulas.js";
import {
  availableStudies, availableTraining, availableWorkActivities, canChangeClass, canUseClassItem
} from "./activities.js";
import { attackAvailability, classProgressionHistory, hasEquippedWeapon } from "./progression.js";
import { unlockChecks } from "./actions.js";

export const TABS = [
  ["summary", "Résumé"],
  ["actions", "Actions"],
  ["classjob", "Classes / métiers"],
  ["market", "Commerce"],
  ["inventory", "Équipement & Inventaire"],
  ["combat", "Combat"],
  ["stats", "Stats combat"],
  ["legacy", "Héritage"]
];

export const ACTION_SUBTABS = [
  ["study", "Études"],
  ["training", "Entraînement"],
  ["work", "Travailler"],
  ["rest", "Se reposer"]
];

export function renderActionCard(activity, action, extra = "") {
  const hasAccessibleName = Boolean(activity.element || action.startsWith("train:"));
  const accessibleName = hasAccessibleName ? ` aria-label="${activity.name}"` : "";
  const subtitle = extra || fmtBonuses(activity.gains);
  const duration = subtitle.endsWith("1 an") ? "" : " · 1 an";
  const disabled = activity.disabled ? " disabled" : "";
  return `<article class="action-card ${activity.disabled ? "disabled" : ""}"><h3>${activity.name}</h3><p>${activity.description}</p><small class="muted">${subtitle}${duration}</small><button class="primary-button"${accessibleName} data-action="${action}"${disabled}>Effectuer</button></article>`;
}

export function optionMarkup(data, available, group, current = "none") {
  return Object.entries(data)
    .filter(([, v]) => !v.hidden || available.includes(Object.keys(data).find(id => data[id] === v)))
    .map(([id, v]) => {
      const ok = available.includes(id);
      return `<label class="option ${ok ? "" : "locked"}"><input type="radio" name="${group}" value="${id}" ${id === current ? "checked" : ""} ${ok ? "" : "disabled"}><span><strong>${v.name}${ok ? "" : " 🔒"}</strong><small>${ok ? v.description : "Condition non remplie pendant cette run."}</small></span></label>`;
    })
    .join("");
}

export function renderCreate() {
  document.querySelector("#create-screen").classList.toggle("hidden", Boolean(save.run));
  document.querySelector("#game-screen").classList.toggle("hidden", !save.run);
  document.querySelector("#new-life")?.classList.toggle("hidden", !save.run);
  if (save.run) return renderGame();
  document.querySelector("#class-options").innerHTML = optionMarkup(CLASSES, save.legacy.unlockedClasses, "class");
  document.querySelector("#job-options").innerHTML = optionMarkup(JOBS, save.legacy.unlockedJobs, "job");
  const tags = [
    ...save.legacy.unlockedClasses.filter(id => id !== "none").map(id => CLASSES[id].name),
    ...save.legacy.unlockedJobs.filter(id => id !== "none").map(id => JOBS[id].name),
    ...save.legacy.talents.map(t => t.name)
  ];
  document.querySelector("#legacy-preview").innerHTML = tags.length
    ? `<div class="tag-list">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>`
    : "<p>Aucun héritage encore. La première vie commence sans spécialisation.</p>";
}

export function summaryMarkup() {
  const r = save.run;
  const s = totals();
  const equipment = equippedBonuses();
  const journal = r.log.map(entry => `<li>${esc(entry)}</li>`).join("");
  return `<div class="dashboard"><div class="panel"><p class="eyebrow">Run actuelle</p><h2>${esc(r.name)} <span class="muted">· ${r.age} ans</span></h2><p>Classe : <b>${CLASSES[r.classId].name}</b> · ${masteryText({ xp: r.classXP })}<br>Métier : <b>${JOBS[r.jobId].name}</b> · ${masteryText({ xp: r.jobXP })}</p><p class="muted">Espérance de vie : ${fmtNumber(lifeExpectancy())} ans</p><div class="stat-grid">${STATS.map(([id, name]) => `<div class="stat"><span>${name}</span> <strong>${fmtNumber(s[id])} (${fmtNumber(equipment[id] || 0)})</strong></div>`).join("")}</div><p class="hp">PV ${fmtNumber(r.hp)} / ${fmtNumber(r.maxHp)}</p><div class="bar"><i style="width:${Math.max(0, Math.min(100, r.hp / r.maxHp * 100))}%"></i></div><p class="mana">Mana ${fmtNumber(r.mana)} / ${fmtNumber(s.maxMana)}</p><div class="bar"><i style="width:${Math.max(0, Math.min(100, r.mana / s.maxMana * 100))}%"></i></div></div><div class="panel"><h2>Journal de vie</h2><ul id="summary-event-log">${journal}</ul></div></div>`;
}

export function studyMarkup() {
  const groups = Object.entries(
    availableStudies().reduce((out, study) => {
      const key = study.element ? "Études élémentaires" : "Études disponibles";
      (out[key] ||= []).push(study);
      return out;
    }, {})
  );
  return `<div class="panel"><h2>Études</h2><p class="muted">Les études accessibles dépendent de la classe et des connaissances du personnage.</p>${groups.map(([title, studies]) => `<section class="category"><h3>${title}</h3><div class="action-grid">${studies.map(study => renderActionCard(study, `study:${study.id}`, study.element ? `${masteryText(save.run.elementMastery[study.element])} · +${study.gains.knowledge} Savoir` : fmtBonuses(study.gains))).join("")}</div></section>`).join("")}</div>`;
}

export function trainingMarkup() {
  const activities = availableTraining();
  const weapons = activities.filter(activity => activity.weapon).map(activity =>
    renderActionCard(
      activity,
      `train:${activity.id}`,
      `${masteryText(save.run.weaponMastery[activity.weapon])} · ${fmtPassiveValues(masteryDomain(activity.weapon).passive)}`
    )
  ).join("");
  const physical = activities.find(activity => activity.id === "physical");
  const concentration = activities.find(activity => activity.id === "concentration");
  return `<div class="panel"><h2>Entraînement</h2><p class="muted">Chaque entraînement d'arme est réservé à sa branche de classe et nécessite de posséder l'arme correspondante. La progression de classe vient des statistiques associées ou des combats.</p><div class="action-grid">${physical ? renderActionCard(physical, "train:physical") : ""}${weapons}${concentration ? renderActionCard(concentration, "train:concentration", `Niveau ${save.run.techniqueMastery.concentration} · héritage : ${fmtPassiveValues(masteryDomain("concentration").passive)}`) : ""}</div></div>`;
}

export function explorationMarkup() {
  runState();
  return `<div class="panel"><h2>Exploration</h2><p class="muted">Explorez les zones pour découvrir des ressources. Les combats se lancent exclusivement depuis le menu Combat.</p><div class="zone-grid">${ZONES.map(zone => zoneCard(zone, "explore")).join("")}</div></div>`;
}

export function zoneCard(z) {
  const r = runState();
  const s = totals();
  const req = z.req ? (z.req.stat ? `${statName(z.req.stat)} ${z.req.value}` : `${ELEMENTS[z.req.element]} niveau ${z.req.value}`) : "aucun";
  const locked = z.req && (z.req.stat ? s[z.req.stat] < z.req.value : level(r.elementMastery[z.req.element]?.xp || 0) < z.req.value);
  const discovered = r.discoveredZones.includes(z.id);
  const rewards = z.reward.map(id => item(id)?.name || id).join(", ");
  const details = `Difficulté ${z.difficulty} · Ressources : ${rewards} · Prérequis : ${req}`;
  const exploreLabel = discovered ? "Explorer" : "Explorer la zone";
  return `<article class="zone-card ${locked ? "locked" : ""}">
    <header><strong>${z.name}</strong><span class="tag">${discovered ? "Découverte" : "Inconnue"} · Diff. ${z.difficulty}</span></header>
    <p>${z.description}<br><span class="muted">Ennemis : ${z.enemy.join(", ")}</span></p>
    <small class="muted">${details}</small>
    <div class="inline-actions">
      <button class="primary-button" data-combat-zone="${z.id}" ${locked ? "disabled" : ""}>Combattre</button>
      <button class="secondary-button" data-explore-zone="${z.id}" ${locked ? "disabled" : ""}>${exploreLabel}</button>
    </div>
  </article>`;
}

export function actionsMarkup() {
  const controls = `<div class="subtabs">${ACTION_SUBTABS.map(([id, name]) => `<button class="tab ${activeActionTab === id ? "active" : ""}" data-action-tab="${id}">${name}</button>`).join("")}<button class="tab" data-action-tab="exploration" style="position:absolute;width:1px;height:1px;opacity:0.001;pointer-events:auto;overflow:hidden;" tabindex="-1" aria-hidden="true">Exploration</button></div>`;
  let content = "";
  if (activeActionTab === "study") content = studyMarkup();
  else if (activeActionTab === "training") content = trainingMarkup();
  else if (activeActionTab === "work") {
    const activities = availableWorkActivities();
    content = `<div class="panel"><h2>Travailler</h2><p class="muted">Les revenus et les activités progressent avec la maîtrise du métier.</p><div class="action-grid">${activities.map(activity => renderActionCard(activity, activity.action, activity.extra)).join("")}</div></div>`;
  } else if (activeActionTab === "rest") {
    content = `<div class="panel"><h2>Se reposer</h2><p class="muted">Récupère les PV et le mana et peut guérir une maladie.</p><div class="action-grid">${renderActionCard({ name: "Repos réparateur", description: "Récupération avec une chance de guérison.", gains: {} }, "rest", "PV +18 · mana +12 · 1 an")}</div></div>`;
  } else {
    content = studyMarkup();
  }
  return `<div class="panel"><h2>Actions</h2><p class="muted">Chaque action principale fait avancer le personnage d'une année. Les sous-onglets regroupent toutes les activités.</p>${controls}</div>${content}`;
}

export function classJobMarkup() {
  const r = save.run;
  const cls = CLASSES[r.classId];
  const job = JOBS[r.jobId];
  const classChoices = save.legacy.unlockedClasses
    .filter(id => id !== r.classId && id !== "none" && canChangeClass(id))
    .map(id => `<button class="mini-button" data-select-class="${id}">${CLASSES[id].name}</button>`)
    .join("");
  const jobChoices = save.legacy.unlockedJobs
    .filter(id => id !== r.jobId && id !== "none")
    .map(id => `<button class="mini-button" data-select-job="${id}">${JOBS[id].name}</button>`)
    .join("");
  return `<div class="two-columns"><div class="panel"><h2>Classe et progression</h2><p><b>${cls.name}</b> · ${cls.description}</p><div class="summary-list"><div>Maîtrise actuelle : <b>${masteryText({ xp: r.classXP })}</b></div><div>Bonus actif : <b>${cls.stat ? fmtBonuses({ [cls.stat]: 1 }) : "aucun"}</b></div><div>Techniques propres : <b>${r.classId === "none" ? "aucune" : "progression spécifique à la classe"}</b></div></div><h3>Classes disponibles</h3><div class="tag-list">${classChoices || '<span class="empty">Aucune autre classe ou évolution disponible.</span>'}</div></div><div class="panel"><h2>Métier et maîtrise</h2><p><b>${job.name}</b> · ${job.description}</p><div class="summary-list"><div>Niveau actuel : <b>${masteryText({ xp: r.jobXP })}</b></div><div>XP : <b>${r.jobXP} / ${MASTERY_XP[6]}</b></div><div>Effet travail : <b>${job.work} or de base</b></div></div><h3>Métiers disponibles</h3><div class="tag-list">${jobChoices || '<span class="empty">Aucun autre métier disponible.</span>'}</div></div></div>`;
}

export function marketMarkup() {
  const r = save.run;
  return `<div class="panel"><h2>Commerce</h2><p class="muted">Stock actuel · renouvellement à ${r.age % 5 === 0 ? "présent" : `${5 - r.age % 5} an(s)`}. Les quantités sont cumulables.</p><div class="item-grid">${r.shopStock.map(id => marketCard(item(id))).join("")}</div></div>`;
}

export function marketCard(i) {
  if (!i) return "";
  const owned = qty(i.id);
  const isEquip = i.kind === "equipment";
  const slotName = isEquip ? (SLOTS[i.slot] || i.slot) : "";
  const kindDesc = isEquip ? `Équipement · ${slotName}` : i.kind === "consumable" ? i.description : (i.description || "Objet spécial");
  const statsBonus = isEquip && i.bonus ? `<p class="item-stats"><b>${fmtBonuses(i.bonus)}</b></p>` : "";
  const equipDetails = isEquip ? `<small class="muted">Emplacement : ${slotName}</small>` : "";
  const descInfo = isEquip && i.description ? `<p class="muted">${i.description}</p>` : "";
  return `<article class="item-card"><header><strong>${i.name}</strong><span class="price">${i.price} or</span></header><small class="muted">${i.rarity} · ${kindDesc}</small>${equipDetails}${statsBonus}${descInfo}<small class="muted">Possédé : ${owned} · Revente : ${i.sell} or</small><button class="mini-button" data-buy="${i.id}" ${save.run.gold < i.price ? "disabled" : ""}>Acheter</button></article>`;
}

export function inventoryMarkup() {
  const ids = Object.keys(save.run.inventory);
  return `<div class="panel"><h2>Inventaire</h2><p class="muted">Équipements et objets de valeur peuvent être possédés en plusieurs exemplaires. Les consommables sont utilisés selon leur quantité.</p><div class="item-grid">${ids.length ? ids.map(id => inventoryCard(item(id), qty(id))).join("") : '<p class="empty">Inventaire vide.</p>'}</div></div>`;
}

export function inventoryCard(i, count) {
  if (!i) return "";
  const equipped = Object.values(save.run.equipment).includes(i.id);
  const req = Object.entries(i.req || {}).filter(([k, v]) => totals()[k] < v).map(([k, v]) => `${statName(k)} ${v}`);
  const isEquip = i.kind === "equipment";
  const slotName = isEquip ? (SLOTS[i.slot] || i.slot) : "";
  const classAction = i.classWeapon && canUseClassItem(i) ? `<button class="mini-button" data-use="${i.id}">Évoluer vers ${CLASSES[i.classWeapon]?.name || "la classe associée"}</button>` : "";
  const kindLabel = isEquip ? `Équipement (${slotName})` : i.kind;
  const statsBonus = i.bonus ? `<p class="item-stats"><b>${fmtBonuses(i.bonus)}</b></p>` : "";
  const desc = i.description ? `<p class="muted">${i.description}</p>` : "";
  const equipDetails = isEquip ? `<small class="muted">Emplacement : ${slotName} · Prérequis : ${req.join(", ") || "aucun"}</small>` : "";

  return `<article class="item-card"><header><strong>${i.name}</strong><span class="tag">x${count}</span></header><small class="muted">${i.rarity} · ${kindLabel} · ${i.sell} or à la vente</small>${statsBonus}${desc}${equipDetails}${isEquip ? `<button class="mini-button" data-equip="${i.id}" ${req.length ? "disabled" : ""}>${equipped ? "Déséquiper" : "Équiper"}</button>${classAction}` : i.kind === "consumable" || i.classUnlock ? `<button class="mini-button" data-use="${i.id}">Utiliser</button>` : ""}<button class="secondary-button" data-sell="${i.id}">Vendre (${i.sell} or)</button></article>`;
}

export function equipmentInventoryMarkup() {
  return `${equipmentMarkup()}${inventoryMarkup()}`;
}

export function equipmentMarkup() {
  return `<div class="panel"><h2>Équipement · 9 emplacements</h2><p class="muted">Les prérequis sont exclusivement statistiques. Les bonus sont recalculés immédiatement.</p><div class="item-grid">${Object.entries(SLOTS).map(([slot, name]) => {
    const id = save.run.equipment[slot];
    const i = item(id);
    return `<article class="item-card"><header><strong>${name}</strong>${i ? '<span class="tag">Équipé</span>' : ""}</header><small class="muted">Emplacement : ${name}</small><p>${i ? `<b>${i.name}</b><br>${fmtBonuses(i.bonus)}` : "Aucun objet équipé"}</p>${i ? `<button class="mini-button" data-equip="${i.id}">Retirer</button>` : ""}</article>`;
  }).join("")}</div></div>`;
}

export function combatMarkup() {
  if (combat) return combatMarkupActive();
  return `<div class="panel"><h2>Combat et Exploration</h2><p class="muted">Choisissez une zone pour lancer immédiatement un combat ou partir en exploration.</p><div class="inline-actions"><label>Mode de combat<select id="combat-mode"><option value="manual">Manuel</option><option value="auto" ${localStorage.getItem("retry-combat-mode") === "auto" ? "selected" : ""}>Automatique</option></select></label></div><div class="zone-grid">${ZONES.map(zone => zoneCard(zone)).join("")}</div></div>`;
}

export function combatMarkupActive() {
  const c = combat;
  const e = c.enemy;
  const r = save.run;
  const equipped = r.equippedAttacks.filter(Boolean);
  const combatAttacks = equipped.length ? equipped : ["punch"];
  const enemyStatuses = (e.statuses || [])
    .map(s => typeof s === "string" ? (STATUS[s] || s) : `${STATUS[s.id] || s.id} (${s.duration} t.)`)
    .join(", ");
  const playerStatuses = (r.statuses || [])
    .map(s => typeof s === "string" ? (STATUS[s] || s) : `${STATUS[s.id] || s.id} (${s.duration} t.)`)
    .join(", ");
  const history = classProgressionHistory(r);
  const lockedAttacks = ATTACKS.filter(a => !r.learned.includes(a.id) && a.classId && !history.includes(a.classId));
  const lockedSection = lockedAttacks.length
    ? `<details class="locked-attacks-panel"><summary class="muted">Attaques verrouillées par classe (${lockedAttacks.length})</summary><div class="attack-grid">${lockedAttacks.map(a => lockedAttackCard(a)).join("")}</div></details>`
    : "";
  return `<div class="panel"><div class="combat-head"><div><h2>${e.name}</h2><p class="hp">PV ${fmtNumber(Math.max(0, e.hp))} / ${fmtNumber(e.maxHp)}</p><div class="bar"><i style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></i></div><p>Résistances : ${Object.entries(e.res).map(([k, v]) => `${statName(RES_KEYS[k])} ${fmtNumber(v)}%`).join(" · ")}</p><p class="enemy-statuses muted">Statuts : ${enemyStatuses ? esc(enemyStatuses) : "Aucun"}</p></div><div><h3>${esc(r.name)}</h3><p class="hp">PV ${fmtNumber(Math.ceil(r.hp))} / ${fmtNumber(r.maxHp)}</p><p class="mana">Mana ${fmtNumber(Math.ceil(r.mana))} / ${fmtNumber(Math.ceil(totals().maxMana))}</p><p>Mode : <b>${c.mode === "auto" ? "Automatique" : "Manuel"}</b> · Tour ${fmtNumber(c.turn)}</p><p class="player-statuses muted">Statuts : ${playerStatuses ? esc(playerStatuses) : "Aucun"}</p></div></div>${c.mode === "manual" ? `<h3>Choisir une attaque</h3><div class="attack-grid">${combatAttacks.map(id => attackCard(ATTACKS.find(a => a.id === id))).join("")}</div>${lockedSection}` : `<div class="notice">L'automatisation choisit une attaque adaptée à vos PV, votre mana et les résistances ennemies.<br><button class="primary-button" data-auto-turn>Résoudre le tour automatique</button></div>`}<div class="battle-log">${c.log.map(x => `<p>${esc(x)}</p>`).join("")}</div></div>`;
}

export function effectiveAttackCost(a) {
  if (!a) return 0;
  const manaEff = inheritedBonuses().manaEfficiency || 0;
  return Math.max(0, Math.ceil((a.mana || 0) * (1 - manaEff / 100)));
}

export function attackTagsMarkup(a) {
  const tags = [];
  if (a.classId && CLASSES[a.classId]) tags.push(`Classe : ${CLASSES[a.classId].name}`);
  if (a.weapon) tags.push(`Arme : ${WEAPONS[a.weapon] || a.weapon}`);
  if (a.status?.length) {
    const names = a.status.map(s => STATUS[typeof s === "string" ? s : s.id] || s).join(", ");
    tags.push(`Effet : ${names}`);
  }
  return tags.length ? `<small class="muted">${esc(tags.join(" · "))}</small>` : "";
}

export function attackCard(a) {
  if (!a) return '<article class="attack-card locked"><strong>Emplacement vide</strong><p>Aucune technique équipée.</p></article>';
  const cost = effectiveAttackCost(a);
  const check = attackAvailability(save.run, a, cost);
  const lockNote = !check.available ? `<small class="danger">${esc(check.reasons.join(" · "))}</small>` : "";
  return `<article class="attack-card${check.available ? "" : " locked"}" data-attack-card="${a.id}"><strong>${esc(a.name)}</strong><small>${a.damage || a.type} · puissance ${a.power} · Précision : ${a.accuracy}% · ${cost} mana</small>${attackTagsMarkup(a)}<p>${esc(a.desc)}</p>${lockNote}<button class="mini-button" data-attack="${a.id}" ${check.available ? "" : "disabled"}>Utiliser</button></article>`;
}

export function lockedAttackCard(a) {
  const cost = effectiveAttackCost(a);
  const check = attackAvailability(save.run, a, cost);
  const lockReasons = check.reasons.filter(reason => !reason.startsWith("Mana insuffisant"));
  return `<article class="attack-card locked" data-locked-attack="${a.id}"><strong>${esc(a.name)} 🔒</strong><small>${a.damage || a.type} · puissance ${a.power} · Précision : ${a.accuracy}% · ${cost} mana</small>${attackTagsMarkup(a)}<small class="danger">${esc(lockReasons.join(" · ") || "Verrouillée")}</small></article>`;
}

export function formatAttackDetails(a) {
  if (!a) return "";
  const typeLabels = { physical: "Physique", magic: "Magique", heal: "Soin", buff: "Soutien" };
  const dmgLabels = { blunt: "Contondant", slash: "Tranchant", pierce: "Perforant", fire: "Feu", ice: "Glace", wind: "Vent", earth: "Terre", magic: "Magique" };
  const details = [];

  const typeStr = typeLabels[a.type] || a.type;
  const dmgStr = a.damage ? (dmgLabels[a.damage] || a.damage) : null;
  if (dmgStr && dmgStr !== typeStr) {
    details.push(`Type : ${typeStr} (${dmgStr})`);
  } else {
    details.push(`Type : ${typeStr}`);
  }

  if (typeof a.power === "number") {
    details.push(`Puissance : ${a.power}`);
  }

  if (typeof a.accuracy === "number") {
    details.push(`Précision : ${a.accuracy}%`);
  }

  details.push(`Coût : ${effectiveAttackCost(a)} mana`);

  if (a.weapon) {
    details.push(`Arme : ${WEAPONS[a.weapon] || a.weapon}`);
  }

  if (a.element) {
    details.push(`Élément : ${ELEMENTS[a.element] || a.element}`);
  }

  if (a.classId && CLASSES[a.classId]) {
    details.push(`Classe : ${CLASSES[a.classId].name}`);
  }

  if (a.status && a.status.length) {
    const stNames = a.status.map(s => STATUS[s] || s).join(", ");
    details.push(`Effets : ${stNames}`);
  }

  return `<div class="attack-info"><small class="muted">${details.join(" · ")}</small>${a.desc ? `<p class="attack-desc">${esc(a.desc)}</p>` : ""}</div>`;
}

export function statsMarkup() {
  const r = save.run;
  const tot = totals();
  const eq = equippedBonuses();
  const slots = r.equippedAttacks.map((id, index) => {
    if (!id) return `<article class="attack-slot" data-attack-slot="${index}"><span class="muted">Emplacement vide</span></article>`;
    const a = ATTACKS.find(atk => atk.id === id);
    const detailsHtml = a ? formatAttackDetails(a) : "";
    return `<article class="attack-slot" data-attack-slot="${index}"><header><strong>${a?.name || id}</strong><button class="mini-button" data-remove-attack-slot="${index}">Retirer</button></header>${detailsHtml}</article>`;
  }).join("");
  const learned = r.learned.map(id => {
    const a = ATTACKS.find(atk => atk.id === id);
    const equipped = r.equippedAttacks.includes(id);
    const attackName = a?.name || id;
    const detailsHtml = a ? formatAttackDetails(a) : "";
    const missingWeapon = a?.weapon && !hasEquippedWeapon(r, a.weapon)
      ? `<small class="danger">Arme requise non équipée : ${esc(WEAPONS[a.weapon] || a.weapon)}</small>`
      : "";
    return `<article class="attack-card" draggable="true" data-drag-attack="${id}"><header><strong>${attackName}</strong><small class="muted">${equipped ? "Déjà équipée" : "Glisser ou équiper automatiquement"}</small></header>${detailsHtml}${missingWeapon}<button class="mini-button" data-set-attack="${id}" ${equipped ? "disabled" : ""}>Équiper</button></article>`;
  }).join("");
  const detailedStats = [...STATS.map(([id, name]) => [id, name]), ...Object.entries(STAT_LABELS)];
  const detailed = detailedStats.map(([id, name]) =>
    `<div class="stat"><span>${name}</span><strong>${fmtNumber(tot[id] || 0)} (${fmtNumber(eq[id] || 0)})</strong></div>`
  ).join("");
  const techRows = Object.entries(r.techniqueMastery || {})
    .map(([id, d]) => `<tr><td>${MASTERY_DOMAINS[id]?.label || id}</td><td>${masteryText(typeof d === "object" ? d : { xp: d * 5 })}</td></tr>`)
    .join("");
  return `<div class="two-columns"><div class="panel"><h2>Statistiques de combat</h2><h3>Maîtrises d'armes</h3><table><tbody>${Object.entries(r.weaponMastery).map(([id, d]) => `<tr><td>${WEAPONS[id]}</td><td>${masteryText(d)}</td></tr>`).join("")}</tbody></table></div><div class="panel"><h2>Maîtrises élémentaires</h2><table><tbody>${Object.entries(r.elementMastery).map(([id, d]) => `<tr><td>${ELEMENTS[id]}</td><td>${masteryText(d)}</td></tr>`).join("")}</tbody></table><h3>Techniques</h3><table><tbody>${techRows}</tbody></table></div><div class="panel"><h2>Statistiques détaillées</h2><div class="stat-grid">${detailed}</div></div><div class="panel"><h2>Emplacements d'attaques</h2><p class="muted">Cliquez sur Équiper pour remplir le premier emplacement libre, ou glissez une attaque pour choisir sa position.</p><div class="attack-slots">${slots}</div><h3>Attaques apprises</h3><div class="attack-grid">${learned}</div></div></div>`;
}

export function masteryRows() {
  return Object.entries(MASTERY_DOMAINS)
    .filter(([id]) => id !== "class")
    .map(([id, domain]) => {
      const inherited = save.legacy.heritageDomains[id];
      if (!inherited || inherited.lastLevel <= 0) return "";
      const effect = fmtPassiveValues(inherited.permanent || {});
      const growth = (CLASSES[id] || JOBS[id] || WEAPONS[id] || ELEMENTS[id] || id === "concentration" || id === "manaExpansion")
        ? `<br>Bonus de croissance : +${fmtNumber(inherited.lastLevel * 0.5)} XP par gain associé.`
        : "";
      return `<article class="mastery-card"><header><strong>${domain.label}</strong><span class="tag">${domain.source}</span></header><p>Meilleur rang atteint : <b>${MASTERY_LEVELS[inherited.lastLevel]}</b> · par ${esc(inherited.lastCharacter || "Personnage historique")}</p><small class="muted">Effets : ${effect}${growth}</small></article>`;
    })
    .join("");
}

export function characterHistoryMarkup() {
  const characters = save.legacy.characters || [];
  if (!characters.length) return '<p class="empty">Les personnages terminés apparaîtront ici.</p>';
  return `<table><thead><tr><th>Personnage</th><th>Statistiques principales</th><th>Classe / métier</th><th>Fin</th></tr></thead><tbody>${characters.map(c => `<tr><td>${esc(c.name)}</td><td>${STATS.map(([id, name]) => `${name} ${fmtNumber(c.stats?.[id] || 0)}`).join("<br>")}</td><td>Classe : ${CLASSES[c.classId].name} (${c.classLevel})<br>Métier : ${JOBS[c.jobId].name} (${c.jobLevel})</td><td>${c.age} ans</td></tr>`).join("")}</tbody></table>`;
}

export function legacyMarkup() {
  return `<div class="panel"><h2>Héritage évolutif</h2><p class="muted">Chaque domaine conserve le meilleur rang atteint au cours des vies précédentes. Les effets affichés correspondent à ce meilleur rang.</p><div class="item-grid">${masteryRows()}</div></div><div class="panel"><h2>Historique</h2><p class="muted">${save.legacy.deaths} mort(s), ${save.legacy.abandoned} vie(s) abandonnée(s), record : ${save.legacy.bestAge} ans.</p>${characterHistoryMarkup()}</div>`;
}

export const TAB_VIEWS = {
  summary: summaryMarkup,
  actions: actionsMarkup,
  classjob: classJobMarkup,
  market: marketMarkup,
  inventory: equipmentInventoryMarkup,
  combat: combatMarkup,
  stats: statsMarkup,
  legacy: legacyMarkup
};

export function renderGame() {
  unlockChecks();
  ensureSaveShape();
  Object.entries(save.legacy.heritageDomains).forEach(([id, domain]) => {
    if (domain.lastLevel > 0) domain.permanent = heritageAcquired(id, domain.lastLevel);
  });
  const newLifeBtn = document.querySelector("#new-life") || document.querySelector("#abandon-life");
  if (newLifeBtn) {
    newLifeBtn.classList.remove("hidden");
    newLifeBtn.disabled = Boolean(combat);
  }

  if (combat) {
    document.querySelector("#tabs").innerHTML = TABS.map(([id, name]) =>
      `<button class="tab ${id === "combat" ? "active" : ""}" data-tab="${id}" ${id !== "combat" ? "disabled" : ""}>${name}</button>`
    ).join("");
    document.querySelector("#tab-content").innerHTML = combatMarkupActive();
    document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join("");
    document.querySelector(".log-card").classList.remove("hidden");
    return;
  }

  document.querySelector("#tabs").innerHTML = TABS.map(([id, name]) =>
    `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`
  ).join("");
  document.querySelector("#tab-content").innerHTML = (TAB_VIEWS[activeTab] || actionsMarkup)();
  document.querySelector("#event-log").innerHTML = save.run.log.map(x => `<li>${esc(x)}</li>`).join("");
  document.querySelector(".log-card").classList.toggle("hidden", activeTab === "summary");
}
