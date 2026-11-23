import {
  persist, setActiveTab, setActiveActionTab, ensureSaveShape
} from "./src/state.js";
import { renderCreate, renderGame } from "./src/ui.js";
import {
  doAction, buy, sell, useItem, equip, exploreZone, setAttack,
  removeAttackFromSlot, equipAttackToSlot, chooseClass, chooseJob,
  startLife, abandonLife
} from "./src/actions.js";
import { startCombat, chooseAttack, autoTurn } from "./src/combat.js";

function handleGameClick(e) {
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    setActiveTab(tab.dataset.tab);
    return renderGame();
  }
  const actionTab = e.target.closest("[data-action-tab]");
  if (actionTab) {
    setActiveActionTab(actionTab.dataset.actionTab);
    setActiveTab("actions");
    return renderGame();
  }
  const action = e.target.closest("[data-action]");
  if (action) return doAction(action.dataset.action);

  const buyBtn = e.target.closest("[data-buy]");
  if (buyBtn) return buy(buyBtn.dataset.buy);

  const sellBtn = e.target.closest("[data-sell]");
  if (sellBtn) return sell(sellBtn.dataset.sell);

  const useBtn = e.target.closest("[data-use]");
  if (useBtn) return useItem(useBtn.dataset.use);

  const equipBtn = e.target.closest("[data-equip]");
  if (equipBtn) return equip(equipBtn.dataset.equip);

  const exploreZoneBtn = e.target.closest("[data-explore-zone]");
  if (exploreZoneBtn) return exploreZone(exploreZoneBtn.dataset.exploreZone);

  const combatZoneBtn = e.target.closest("[data-combat-zone]");
  if (combatZoneBtn) return startCombat(combatZoneBtn.dataset.combatZone, true);

  const attackBtn = e.target.closest("[data-attack]");
  if (attackBtn) return chooseAttack(attackBtn.dataset.attack);

  const setAttackBtn = e.target.closest("[data-set-attack]");
  if (setAttackBtn) return setAttack(setAttackBtn.dataset.setAttack);

  const removeSlotBtn = e.target.closest("[data-remove-attack-slot]");
  if (removeSlotBtn) return removeAttackFromSlot(Number(removeSlotBtn.dataset.removeAttackSlot));

  const selectClassBtn = e.target.closest("[data-select-class]");
  if (selectClassBtn) return chooseClass(selectClassBtn.dataset.selectClass);

  const selectJobBtn = e.target.closest("[data-select-job]");
  if (selectJobBtn) return chooseJob(selectJobBtn.dataset.selectJob);

  if (e.target.closest("[data-auto-turn]")) return autoTurn();
}

function setupEventListeners() {
  document.querySelector("#create-form")?.addEventListener("submit", startLife);
  document.querySelector("#new-life")?.addEventListener("click", abandonLife);

  const gameScreen = document.querySelector("#game-screen");
  if (!gameScreen) return;

  gameScreen.addEventListener("click", handleGameClick);

  gameScreen.addEventListener("change", e => {
    if (e.target.id === "combat-mode") {
      localStorage.setItem("retry-combat-mode", e.target.value);
      renderGame();
    }
  });

  gameScreen.addEventListener("dragstart", e => {
    const attack = e.target.closest("[data-drag-attack]");
    if (attack) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", attack.dataset.dragAttack);
    }
  });

  gameScreen.addEventListener("dragover", e => {
    if (e.target.closest("[data-attack-slot]")) {
      e.preventDefault();
    }
  });

  gameScreen.addEventListener("drop", e => {
    const slot = e.target.closest("[data-attack-slot]");
    if (slot) {
      equipAttackToSlot(e.dataTransfer.getData("text/plain"), Number(slot.dataset.attackSlot));
    }
  });
}

ensureSaveShape();
setupEventListeners();
persist();
renderCreate();
