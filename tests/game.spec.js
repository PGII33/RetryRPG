import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("loads the creation screen without runtime errors", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.reload();

  await expect(page.locator("#create-screen")).toBeVisible();
  await expect(page.locator("#class-options input")).toHaveCount(5);
  await expect(page.locator("#job-options input")).toHaveCount(7);
  expect(pageErrors).toEqual([]);
});

test("creates a life and persists the selected character", async ({ page }) => {
  await page.locator("#name-input").fill("Mira");
  await page.locator('input[name="class"][value="none"]').check();
  await page.locator('input[name="job"][value="none"]').check();
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();

  await expect(page.locator("#game-screen")).toBeVisible();
  await expect(page.locator("#tab-content")).toContainText("Mira");

  const savedRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(savedRun).toMatchObject({ name: "Mira", age: 16, classId: "none", jobId: "none" });
});

test("turns Terminer sa vie into a voluntary death", async ({ page }) => {
  await page.locator("#name-input").fill("Mira");
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Terminer sa vie" }).click();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")));
  expect(saved.run).toBeNull();
  expect(saved.legacy.deaths).toBe(1);
  expect(saved.legacy.abandoned).toBe(0);
  expect(saved.legacy.characters[0]).toMatchObject({ name: "Mira", reason: "Personnage tué volontairement pour commencer une nouvelle vie." });
});

test("rounds displayed floating-point values to two decimals", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.stats.magic = 3.125;
    save.run.jobXP = 2.345;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();

  await expect(page.locator("#tab-content")).toContainText("3.13");
  await expect(page.locator("#tab-content")).toContainText("2.35 XP");
  await expect(page.locator("#tab-content")).not.toContainText("3.125");
});

test("uses a random name when the name is empty and shows the complete summary", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();

  const savedRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(savedRun.name).toMatch(/^[A-Za-zÀ-ÿ-]+$/);
  await expect(page.locator("#tab-content")).toContainText("Classe : Sans classe");
  await expect(page.locator("#tab-content")).toContainText("Métier : Sans métier");
  await expect(page.locator("#tab-content")).toContainText("PV");
  await expect(page.locator("#tab-content")).toContainText("Mana");
  await expect(page.locator("#event-log")).toContainText("Naissance");
});

test("shows equipment stat contributions separately in the summary", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.stats.luck = 3;
    save.run.equipment.accessory1 = "luck-charm";
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();

  await expect(page.locator("#tab-content")).toContainText("Chance 5 (2)");
});

test("only displays inherited domains above beginner with their best character and effect", async ({ page }) => {
  await page.locator("#name-input").fill("Nora");
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.legacy.heritageDomains.sword.lastLevel = 0;
    save.legacy.heritageDomains.mage.lastLevel = 1;
    save.legacy.heritageDomains.mage.lastCharacter = "Mira";
    save.legacy.heritageDomains.mage.permanent = { lifeExpectancy: 1 };
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Héritage" }).click();

  await expect(page.locator("#tab-content")).toContainText("Mage");
  await expect(page.locator("#tab-content")).toContainText("Meilleur rang atteint : Apprenti · par Mira");
  await expect(page.locator("#tab-content")).toContainText("Effets : +0.5 ans d'espérance de vie");
  await expect(page.locator("#tab-content")).not.toContainText("Épées");
});

test("uses previous best levels for growth experience and life expectancy", async ({ page }) => {
  await page.locator("#name-input").fill("Iris");
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "mage";
    save.run.jobId = "farmer";
    save.run.classXP = 0;
    save.run.jobXP = 0;
    save.legacy.heritageDomains.warrior.lastLevel = 1;
    save.legacy.heritageDomains.mage.lastLevel = 2;
    save.legacy.heritageDomains.farmer.lastLevel = 1;
    save.legacy.heritageDomains.merchant.lastLevel = 3;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Travailler" }).click();
  await page.locator('[data-action="work"]').click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);

  expect(after.jobXP).toBe(1);
  expect(after.classXP).toBe(0);
  await page.locator('[data-tab="summary"]').click();
  await expect(page.locator("#tab-content")).toContainText("Espérance de vie : 33.5 ans");
  await expect(page.locator("#tab-content")).not.toContainText("Potentiel de classe");
});

test("uses the historical class level when gaining class experience", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "mage";
    save.run.classXP = 0;
    save.run.learned = ["punch", "mana-sphere"];
    save.run.equippedAttacks = ["punch", "mana-sphere", null, null];
    save.legacy.heritageDomains.mage.lastLevel = 2;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator('[data-combat-zone]').first().click();
  await page.locator('[data-attack="mana-sphere"]').click();

  const savedRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(savedRun.classXP).toBe(1.25);
});

test("evolves a mage into an unlocked fire mage", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "mage";
    save.run.elementMastery.fire.xp = 8;
    save.legacy.unlockedClasses.push("fireMage");
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Classes / métiers" }).click();
  await page.locator('[data-select-class="fireMage"]').click();

  const savedRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(savedRun.classId).toBe("fireMage");
  expect(savedRun.learned).toContain("fire-sphere");
  expect(savedRun.equippedAttacks).toContain("fire-sphere");
});

test("keeps wind and earth mages as mage evolutions", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "mage";
    save.legacy.unlockedClasses.push("mage", "windMage", "earthMage");
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Classes / métiers" }).click();
  await page.locator('[data-select-class="windMage"]').click();
  await page.getByRole("button", { name: "Classes / métiers" }).click();

  await expect(page.locator('[data-select-class="earthMage"]')).toHaveCount(0);
});

test("allows a class evolution item to bypass normal class prerequisites", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "knight";
    save.run.inventory["primordial-core"] = 1;
    save.legacy.unlockedClasses.push("knight");
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Inventaire" }).click();
  await page.getByRole("button", { name: "Évoluer vers Arcaniste primordial" }).click();

  const savedRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(savedRun.classId).toBe("primordial");
});

test("initializes mana at maximum and allows stats above twenty", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(initial.mana).toBe(25 + initial.stats.magic * 4 + initial.stats.knowledge * 2);

  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.stats.strength = 20;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Entraînement" }).click();
  await page.locator('[data-action="train:physical"]').click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(after.stats.strength).toBeGreaterThan(20);
});

test("shows the life journal in summary instead of inherited passives", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await expect(page.locator("#tab-content")).not.toContainText("Passifs hérités");
  await expect(page.locator("#tab-content")).toContainText("Journal de vie");
  await expect(page.locator("#summary-event-log")).toContainText("Naissance");
});

test("can remove the only equipped punch and still use punch in combat", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.equippedAttacks = ["punch", null, null, null];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Stats combat" }).click();
  await page.locator('[data-remove-attack-slot="0"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run.equippedAttacks.every(value => value === null))).toBe(true);

  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator('[data-combat-zone]').first().click();
  await expect(page.locator('[data-attack="punch"]')).toBeVisible();
});

test("supports four attack slots with drag and drop removal", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.learned = ["punch", "mana-sphere", "fire"];
    save.run.equippedAttacks = ["punch", null, null, null];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Stats combat" }).click();
  await page.evaluate(() => {
    const move = (attack, slot) => {
      const transfer = new DataTransfer();
      const source = document.querySelector(`[data-drag-attack="${attack}"]`);
      const target = document.querySelector(`[data-attack-slot="${slot}"]`);
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
    };
    move("mana-sphere", 1);
    move("fire", 2);
  });
  const equipped = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run.equippedAttacks);

  expect(equipped).toEqual(["punch", "mana-sphere", "fire", null]);
  await page.locator('[data-remove-attack-slot="1"]').click();
  await expect(page.locator('[data-attack-slot="1"]')).toContainText("Emplacement vide");
});

test("an action advances the age and writes to the life log", async ({ page }) => {
  await page.locator("#name-input").fill("Nora");
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.locator('[data-action="study:general"]').click();

  await expect(page.locator("#event-log")).toContainText("Étude accomplie");
  const savedRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(savedRun.age).toBe(17);
});

test("restores an existing life after a reload", async ({ page }) => {
  await page.locator("#name-input").fill("Iris");
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.reload();

  await expect(page.locator("#game-screen")).toBeVisible();
  await expect(page.locator("#tab-content")).toContainText("Iris");
  await expect(page.locator("#event-log")).toContainText("Naissance");
});

test("launches combat from the Combat menu instead of exploration", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();

  await expect(page.locator('[data-combat-zone]')).toHaveCount(20);
  await page.locator('[data-combat-zone]').first().click();
  await expect(page.locator("#tab-content")).toContainText("Choisir une attaque");
  await expect(page.locator("#tab-content")).toContainText("Coup de poing");
});

test("limits weapon training to warrior classes with a matching owned weapon", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "mage";
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Entraînement" }).click();
  await expect(page.locator("#tab-content")).not.toContainText("S'entraîner : Épées");
  await expect(page.locator("#tab-content")).not.toContainText("Technique de classe");

  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "warrior";
    save.run.inventory["iron-sword"] = 1;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Entraînement" }).click();
  await expect(page.locator("#tab-content")).toContainText("S'entraîner : Épées");
});

test("shows elemental studies only to a mage and starts combat stats with Coup de poing", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "warrior";
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Études" }).click();
  await expect(page.locator("#tab-content")).not.toContainText("Étude élémentaire : Feu");

  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "mage";
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Études" }).click();
  await expect(page.locator("#tab-content")).toContainText("Étude élémentaire : Feu");
  await page.getByRole("button", { name: "Stats combat" }).click();
  await expect(page.locator("#tab-content")).toContainText("Coup de poing");
  await expect(page.locator("#tab-content")).toContainText("Attaques apprises");
  await expect(page.locator("#tab-content")).toContainText("Statistiques détaillées");
  await expect(page.locator("#tab-content")).not.toContainText("Talents conditionnels");
});

test("lets specialized mages study every element with a linked affinity bonus", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "fireMage";
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Études" }).click();
  await expect(page.locator("#tab-content")).toContainText("Étude élémentaire : Feu");
  await expect(page.locator("#tab-content")).toContainText("Étude élémentaire : Terre");

  await page.getByRole("button", { name: /Étude élémentaire : Feu/ }).click();
  const savedRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(savedRun.elementMastery.fire.xp).toBe(5);
});

test("shows unlocked jobs as selectable options during a run", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.legacy.unlockedJobs.push("farmer");
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Classes / métiers" }).click();
  await expect(page.locator('[data-select-job="farmer"]')).toHaveCount(1);
  await page.locator('[data-select-job="farmer"]').click();

  const savedRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(savedRun.jobId).toBe("farmer");
});

test("includes primary stats and class/job levels in character history", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.legacy.characters = [{
      name: "Mira",
      stats: { strength: 7, magic: 4, agility: 5, constitution: 6, knowledge: 3, luck: 2 },
      classId: "warrior",
      jobId: "farmer",
      age: 24,
      classLevel: "Apprenti (8 XP)",
      jobLevel: "Initié (24 XP)"
    }];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Héritage" }).click();
  await expect(page.locator("#tab-content")).toContainText("Mira");
  await expect(page.locator("#tab-content")).toContainText("Force 7");
  await expect(page.locator("#tab-content")).toContainText("Classe : Guerrier (Apprenti (8 XP))");
  await expect(page.locator("#tab-content")).toContainText("Métier : Fermier (Initié (24 XP))");
});

test("unlock luckyman after 20 explorations", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.stats.strength = 500;
    save.run.stats.luck = 3;
    save.legacy.heritageDomains.warrior.lastLevel = 20;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();

  // Neutralise l'aléatoire (maladies et vieillissement) pour rendre le test 100 % déterministe
  await page.evaluate(() => {
    Math.random = () => 0.99;
  });

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")));
  expect(saved.run.explorations).toBe(0);

  await page.getByRole("button", { name: "Combat", exact: true }).click();
  for (let i = 0; i < 20; i++) {
    await page.locator('[data-explore-zone]').first().click();
  }

  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")));
  expect(saved.run.explorations).toBe(20);
  expect(saved.legacy.unlockedClasses).toContain("luckyman");

  await page.getByRole("button", { name: "Classes / métiers" }).click();
  await expect(page.locator('[data-select-class="luckyman"]')).toBeVisible();
});

test("enemy status application assigns status without duplicates and respects chance", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.learned = ["punch", "ice"];
    save.run.equippedAttacks = ["punch", "ice", null, null];
    save.run.mana = 100;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.evaluate(() => {
    Math.random = () => 0.5;
  });
  await page.locator("[data-combat-zone]").first().click();

  await page.locator('[data-attack="ice"]').click();
  await expect(page.locator(".enemy-statuses")).toContainText("Ralentissement");
  await expect(page.locator(".battle-log")).toContainText("Effet appliqué : Ralentissement (2 tours)");

  const afterFirst = await page.evaluate(async () => {
    const state = await import("/src/state.js");
    return state.combat.enemy.statuses.map(s => ({ ...s }));
  });
  expect(afterFirst).toEqual([{ id: "slow", duration: 1 }]);

  // Reapplying slow refreshes duration instead of stacking duplicate entries
  await page.locator('[data-attack="ice"]').click();
  await expect(page.locator(".battle-log")).toContainText("Effet prolongé : Ralentissement (2 tours)");

  const chanceCheck = await page.evaluate(async () => {
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");
    const e = state.combat.enemy;
    const beforeLen = e.statuses.length;

    Math.random = () => 0.9;
    combatMod.applyEnemyStatuses(e, [{ id: "burn", chance: 0.25 }]);
    const afterMiss = e.statuses.map(s => ({ ...s }));

    Math.random = () => 0.1;
    combatMod.applyEnemyStatuses(e, ["burn", "burn"]);
    const afterHit = e.statuses.map(s => ({ ...s }));

    return { beforeLen, afterMiss, afterHit };
  });
  expect(chanceCheck.afterMiss.length).toBe(chanceCheck.beforeLen);
  expect(chanceCheck.afterHit.filter(s => s.id === "burn")).toHaveLength(1);
});

test("enemy damage-over-time statuses burn and poison deal expected HP damage", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator("[data-combat-zone]").first().click();

  const result = await page.evaluate(async () => {
    Math.random = () => 0.5;
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");
    const r = state.save.run;
    r.hp = 500;
    r.maxHp = 500;
    r.mana = 100;

    const e = state.combat.enemy;
    e.maxHp = 60;
    e.hp = 60;

    combatMod.applyEnemyStatuses(e, ["burn"]);
    combatMod.resolveRound({ id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 0 });
    // Heal deals 0 direct dmg -> burn deals round(60 * 0.08) = 5 -> hp 55
    const hpAfterBurn = e.hp;
    const burnLog = state.combat.log.find(l => l.includes("Brûlure)"));

    e.statuses = [];
    e.hp = 60;
    combatMod.applyEnemyStatuses(e, ["poison"]);
    combatMod.resolveRound({ id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 0 });
    // Heal deals 0 direct dmg -> poison deals round(60 * 0.06) = 4 -> hp 56
    const hpAfterPoison = e.hp;
    const poisonLog = state.combat.log.find(l => l.includes("Poison)"));

    return { hpAfterBurn, burnLog, hpAfterPoison, poisonLog };
  });

  expect(result.hpAfterBurn).toBe(55);
  expect(result.burnLog).toContain("subit 5 dégâts (Brûlure)");
  expect(result.hpAfterPoison).toBe(56);
  expect(result.poisonLog).toContain("subit 4 dégâts (Poison)");
});

test("enemy status duration decreases each round and removes the status on expiration", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator("[data-combat-zone]").first().click();

  const rounds = await page.evaluate(async () => {
    Math.random = () => 0.5;
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");
    const r = state.save.run;
    r.hp = 500;
    r.maxHp = 500;
    r.mana = 100;

    const e = state.combat.enemy;
    e.maxHp = 60;
    e.hp = 60;
    combatMod.applyEnemyStatuses(e, ["burn"]); // default duration 3

    const snapshots = [];
    const healAction = { id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 0 };
    for (let i = 0; i < 3; i++) {
      combatMod.resolveRound(healAction);
      snapshots.push({
        hp: e.hp,
        statuses: e.statuses.map(s => ({ ...s })),
        topLogs: state.combat.log.slice(0, 4)
      });
    }
    return snapshots;
  });

  expect(rounds[0].hp).toBe(55);
  expect(rounds[0].statuses).toEqual([{ id: "burn", duration: 2 }]);
  expect(rounds[1].hp).toBe(50);
  expect(rounds[1].statuses).toEqual([{ id: "burn", duration: 1 }]);
  expect(rounds[2].hp).toBe(45);
  expect(rounds[2].statuses).toEqual([]);
  expect(rounds[2].topLogs.some(l => l.includes("Effet expiré") && l.includes("Brûlure"))).toBe(true);
});

test("stun prevents enemy action for its duration then allows enemy to act again", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator("[data-combat-zone]").first().click();

  const res = await page.evaluate(async () => {
    Math.random = () => 0.5;
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");
    const r = state.save.run;
    r.hp = 100;
    r.maxHp = 100;
    r.mana = 100;

    const e = state.combat.enemy;
    e.maxHp = 100;
    e.hp = 100;

    // Round 1: apply stun (duration 1)
    combatMod.resolveRound({ id: "stun-hit", name: "Coup étourdissant", type: "physical", damage: "blunt", power: 1, accuracy: 100, mana: 0, status: ["stun"] });
    const hpAfterStunRound = r.hp;
    const stunStatusesAfterR1 = e.statuses.map(s => ({ ...s }));
    const stunLog = state.combat.log.find(l => l.includes("étourdi"));

    // Round 2: stun expired, enemy attacks normally
    combatMod.resolveRound({ id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 0 });
    const hpAfterNormalRound = r.hp;
    const attackLog = state.combat.log[0];

    return { hpAfterStunRound, stunStatusesAfterR1, stunLog, hpAfterNormalRound, attackLog };
  });

  expect(res.hpAfterStunRound).toBe(100);
  expect(res.stunStatusesAfterR1).toEqual([]);
  expect(res.stunLog).toContain("est étourdi et ne peut pas agir ce tour");
  expect(res.hpAfterNormalRound).toBeLessThan(100);
  expect(res.attackLog).toContain("inflige");
});

test("expired statuses no longer deal damage, slow enemy attacks, or boost player damage", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator("[data-combat-zone]").first().click();

  const res = await page.evaluate(async () => {
    Math.random = () => 0.5;
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");
    const r = state.save.run;
    r.stats.strength = 10;
    r.stats.constitution = 3;
    r.hp = 500;
    r.maxHp = 500;

    const e = state.combat.enemy;
    e.maxHp = 200;
    e.hp = 200;
    e.res.blunt = 0;

    const punch = { id: "punch", name: "Coup de poing", type: "physical", damage: "blunt", power: 5, accuracy: 100, mana: 0 };
    const heal = { id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 0 };

    // Apply burn (duration 1), slow (duration 1), and defenseDown (duration 1)
    combatMod.applyEnemyStatuses(e, [
      { id: "burn", duration: 1 },
      { id: "slow", duration: 1 }
    ]);
    // defenseDown applied via attack: should NOT expire before boosting 1 player attack
    combatMod.resolveRound({ ...punch, status: [{ id: "defenseDown", duration: 1 }] });
    const burnExpiredAfterR1 = !e.statuses.some(s => s.id === "burn");
    const slowExpiredAfterR1 = !e.statuses.some(s => s.id === "slow");
    const defDownActiveAfterR1 = e.statuses.find(s => s.id === "defenseDown");
    const slowedEnemyDmg = 500 - r.hp;

    // Round 2: defenseDown boosts punch; burn & slow are expired so no burn dmg and full enemy dmg
    const enemyHpBeforeR2 = e.hp;
    r.hp = 500;
    combatMod.resolveRound(punch);
    const boostedPlayerDmg = enemyHpBeforeR2 - e.hp; // no burn dmg occurred
    const normalEnemyDmg = 500 - r.hp;
    const defDownExpiredAfterR2 = !e.statuses.some(s => s.id === "defenseDown");

    // Round 3: defenseDown is expired, punch deals normal unboosted damage
    const enemyHpBeforeR3 = e.hp;
    combatMod.resolveRound(punch);
    const normalPlayerDmg = enemyHpBeforeR3 - e.hp;

    // Also verify no burn damage on Round 4 with heal
    const enemyHpBeforeR4 = e.hp;
    combatMod.resolveRound(heal);
    const enemyHpAfterHealR4 = e.hp;

    return {
      burnExpiredAfterR1,
      slowExpiredAfterR1,
      defDownActiveAfterR1,
      slowedEnemyDmg,
      normalEnemyDmg,
      boostedPlayerDmg,
      normalPlayerDmg,
      defDownExpiredAfterR2,
      enemyHpBeforeR4,
      enemyHpAfterHealR4
    };
  });

  expect(res.burnExpiredAfterR1).toBe(true);
  expect(res.slowExpiredAfterR1).toBe(true);
  expect(res.defDownActiveAfterR1).toEqual({ id: "defenseDown", duration: 1 });
  expect(res.slowedEnemyDmg).toBeLessThan(res.normalEnemyDmg);
  expect(res.boostedPlayerDmg).toBeGreaterThan(res.normalPlayerDmg);
  expect(res.defDownExpiredAfterR2).toBe(true);
  expect(res.enemyHpAfterHealR4).toBe(res.enemyHpBeforeR4);
});

test("enemy death from status damage terminates combat once without enemy acting", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator("[data-combat-zone]").first().click();

  const res = await page.evaluate(async () => {
    Math.random = () => 0.5;
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");
    const r = state.save.run;
    r.hp = 80;
    r.maxHp = 100;
    const startAge = r.age;
    const startItemsFound = r.itemsFound;

    const combatRef = state.combat;
    const e = combatRef.enemy;
    e.maxHp = 60;
    e.hp = 4; // burn deals 5 dmg -> lethal
    combatMod.applyEnemyStatuses(e, ["burn"]);

    combatMod.resolveRound({ id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 0 });
    // Attempt a duplicate finishCombat call to ensure victory/rewards cannot fire twice
    combatMod.finishCombat(true);

    return {
      combatAfter: state.combat,
      combatFinished: combatRef.finished,
      enemyHp: e.hp,
      enemyStatusesAfter: e.statuses,
      playerHp: r.hp,
      ageDelta: r.age - startAge,
      itemsFoundDelta: r.itemsFound - startItemsFound,
      combatLog: combatRef.log,
      runLog: r.log
    };
  });

  expect(res.combatAfter).toBeNull();
  expect(res.combatFinished).toBe(true);
  expect(res.enemyHp).toBe(0);
  expect(res.enemyStatusesAfter).toEqual([]);
  // Player healed +16 (80 -> 96) and did NOT take enemy damage (would have been < 96)
  expect(res.playerHp).toBeGreaterThanOrEqual(96);
  expect(res.ageDelta).toBe(1);
  expect(res.itemsFoundDelta).toBe(1);
  expect(res.combatLog.some(l => l.includes("succombe à ses effets de statut"))).toBe(true);
  expect(res.combatLog.filter(l => l.includes("Victoire dans"))).toHaveLength(1);
  expect(res.combatLog.some(l => l.includes("inflige"))).toBe(false);
});

test("multiple enemy statuses process together without interfering", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator("[data-combat-zone]").first().click();

  const res = await page.evaluate(async () => {
    Math.random = () => 0.5;
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");
    const r = state.save.run;
    r.hp = 200;
    r.maxHp = 200;

    const e = state.combat.enemy;
    e.maxHp = 60;
    e.hp = 60;
    combatMod.applyEnemyStatuses(e, ["burn", "poison", "stun"]);

    const heal = { id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 0 };
    combatMod.resolveRound(heal);
    const afterR1 = {
      enemyHp: e.hp,
      playerHp: r.hp,
      statuses: e.statuses.map(s => ({ ...s }))
    };

    combatMod.resolveRound(heal);
    const afterR2 = {
      enemyHp: e.hp,
      playerHp: r.hp,
      statuses: e.statuses.map(s => ({ ...s }))
    };

    return { afterR1, afterR2 };
  });

  // Round 1: burn (5) + poison (4) = 9 dmg -> 51 HP; stun prevents enemy attack -> player HP 200; stun expires
  expect(res.afterR1.enemyHp).toBe(51);
  expect(res.afterR1.playerHp).toBe(200);
  expect(res.afterR1.statuses).toEqual([
    { id: "burn", duration: 2 },
    { id: "poison", duration: 3 }
  ]);

  // Round 2: burn (5) + poison (4) = 9 dmg -> 42 HP; enemy attacks now that stun expired
  expect(res.afterR2.enemyHp).toBe(42);
  expect(res.afterR2.playerHp).toBeLessThan(200);
  expect(res.afterR2.statuses).toEqual([
    { id: "burn", duration: 1 },
    { id: "poison", duration: 2 }
  ]);
});

test("normal combat without enemy statuses and player guard behave without regression", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.learned = ["punch", "guard"];
    save.run.equippedAttacks = ["punch", "guard", null, null];
    save.run.stats.strength = 8;
    save.run.stats.constitution = 3;
    save.run.hp = 100;
    save.run.maxHp = 100;
    save.run.mana = 30;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.evaluate(() => {
    Math.random = () => 0.5;
  });
  await page.locator("[data-combat-zone]").first().click();

  await expect(page.locator(".enemy-statuses")).toContainText("Statuts : Aucun");

  // Round 1: punch without guard
  await page.locator('[data-attack="punch"]').click();
  const afterPunch = await page.evaluate(async () => {
    const state = await import("/src/state.js");
    return {
      enemyHp: state.combat.enemy.hp,
      enemyMaxHp: state.combat.enemy.maxHp,
      enemyStatuses: state.combat.enemy.statuses,
      playerHp: state.save.run.hp
    };
  });
  expect(afterPunch.enemyStatuses).toEqual([]);
  expect(afterPunch.enemyHp).toBeLessThan(afterPunch.enemyMaxHp);
  const unguardedDamage = 100 - afterPunch.playerHp;
  expect(unguardedDamage).toBeGreaterThan(0);

  // Round 2: player guard reduces incoming enemy damage
  await page.locator('[data-attack="guard"]').click();
  const afterGuard = await page.evaluate(async () => {
    const state = await import("/src/state.js");
    return {
      playerStatuses: state.save.run.statuses,
      playerHp: state.save.run.hp
    };
  });
  expect(afterGuard.playerStatuses).toEqual([{ id: "guard", duration: 1 }]);
  const guardedDamage = afterPunch.playerHp - afterGuard.playerHp;
  expect(guardedDamage).toBeLessThan(unguardedDamage);
});

test("centralized enemy status configuration exposes expected defaults and supports configurable damage, duration, and multipliers", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator("[data-combat-zone]").first().click();

  const res = await page.evaluate(async () => {
    Math.random = () => 0.5;
    const cfg = await import("/src/status-config.js");
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");

    const defaultsSnapshot = {
      BURN_DURATION: cfg.BURN_DURATION,
      BURN_DMG_PERCENT: cfg.BURN_DMG_PERCENT,
      BURN_MIN_DMG: cfg.BURN_MIN_DMG,
      BURN_DMG: cfg.BURN_DMG,
      POISON_DURATION: cfg.POISON_DURATION,
      POISON_DMG_PERCENT: cfg.POISON_DMG_PERCENT,
      POISON_MIN_DMG: cfg.POISON_MIN_DMG,
      POISON_DMG: cfg.POISON_DMG,
      STUN_DURATION: cfg.STUN_DURATION,
      SLOW_DURATION: cfg.SLOW_DURATION,
      SLOW_DAMAGE_MULTIPLIER: cfg.SLOW_DAMAGE_MULTIPLIER,
      DEFENSE_DOWN_DURATION: cfg.DEFENSE_DOWN_DURATION,
      DEFENSE_DOWN_DAMAGE_MULTIPLIER: cfg.DEFENSE_DOWN_DAMAGE_MULTIPLIER
    };

    const r = state.save.run;
    r.stats.strength = 10;
    r.stats.constitution = 3;
    r.hp = 500;
    r.maxHp = 500;

    const e = state.combat.enemy;
    e.maxHp = 100;
    e.hp = 100;
    e.res.blunt = 0;

    const heal = { id: "heal", name: "Soin", type: "heal", power: 0, accuracy: 100, mana: 0 };
    const punch = { id: "punch", name: "Coup de poing", type: "physical", damage: "blunt", power: 5, accuracy: 100, mana: 0 };

    const origBurn = { ...cfg.ENEMY_STATUS_EFFECTS.burn };
    const origPoison = { ...cfg.ENEMY_STATUS_EFFECTS.poison };
    const origStun = { ...cfg.ENEMY_STATUS_EFFECTS.stun };
    const origSlow = { ...cfg.ENEMY_STATUS_EFFECTS.slow };
    const origDefDown = { ...cfg.ENEMY_STATUS_EFFECTS.defenseDown };

    try {
      // 1. Default Poison on maxHp=100 => round(100 * 0.06) = 6
      const defaultPoisonDmg = combatMod.calculateStatusDotDamage(e, cfg.ENEMY_STATUS_EFFECTS.poison);

      // 2. Configurable static Poison damage
      cfg.ENEMY_STATUS_EFFECTS.poison.damage = 14;
      e.statuses = [];
      e.hp = 100;
      combatMod.applyEnemyStatuses(e, ["poison"]);
      combatMod.resolveRound(heal);
      const hpAfterStaticPoison = e.hp;

      // 3. Configurable percentage & minimum Poison damage
      cfg.ENEMY_STATUS_EFFECTS.poison.damage = null;
      cfg.ENEMY_STATUS_EFFECTS.poison.damagePercent = 0.01;
      cfg.ENEMY_STATUS_EFFECTS.poison.minDamage = 9;
      e.statuses = [];
      e.hp = 100;
      combatMod.applyEnemyStatuses(e, ["poison"]);
      combatMod.resolveRound(heal);
      const hpAfterMinPoison = e.hp;

      // 4. Configurable Stun duration (2 rounds instead of default 1)
      cfg.ENEMY_STATUS_EFFECTS.stun.duration = 2;
      e.statuses = [];
      r.hp = 500;
      combatMod.applyEnemyStatuses(e, ["stun"]);
      combatMod.resolveRound(heal);
      const hpAfterStunR1 = r.hp;
      const stunRemAfterR1 = e.statuses.find(s => s.id === "stun")?.duration;
      combatMod.resolveRound(heal);
      const hpAfterStunR2 = r.hp;
      const stunRemAfterR2 = e.statuses.find(s => s.id === "stun");

      // 5. Configurable Slow multiplier (0.5 instead of 0.75)
      e.statuses = [];
      r.hp = 500;
      combatMod.resolveRound(heal);
      const baselineEnemyDmg = 500 - r.hp;

      cfg.ENEMY_STATUS_EFFECTS.slow.damageMultiplier = 0.5;
      r.hp = 500;
      combatMod.applyEnemyStatuses(e, ["slow"]);
      combatMod.resolveRound(heal);
      const halvedSlowEnemyDmg = 500 - r.hp;

      // 6. Configurable DefenseDown multiplier (2.0 instead of 1.25)
      e.statuses = [];
      e.hp = 100;
      combatMod.resolveRound(punch);
      const baselinePunchDmg = 100 - e.hp;

      cfg.ENEMY_STATUS_EFFECTS.defenseDown.damageMultiplier = 2.0;
      e.hp = 100;
      e.statuses = [{ id: "defenseDown", duration: 1 }];
      combatMod.resolveRound(punch);
      const doubledPunchDmg = 100 - e.hp;

      return {
        defaultsSnapshot,
        defaultPoisonDmg,
        hpAfterStaticPoison,
        hpAfterMinPoison,
        hpAfterStunR1,
        stunRemAfterR1,
        hpAfterStunR2,
        stunRemAfterR2,
        baselineEnemyDmg,
        halvedSlowEnemyDmg,
        baselinePunchDmg,
        doubledPunchDmg
      };
    } finally {
      Object.assign(cfg.ENEMY_STATUS_EFFECTS.burn, origBurn);
      Object.assign(cfg.ENEMY_STATUS_EFFECTS.poison, origPoison);
      Object.assign(cfg.ENEMY_STATUS_EFFECTS.stun, origStun);
      Object.assign(cfg.ENEMY_STATUS_EFFECTS.slow, origSlow);
      Object.assign(cfg.ENEMY_STATUS_EFFECTS.defenseDown, origDefDown);
    }
  });

  expect(res.defaultsSnapshot).toEqual({
    BURN_DURATION: 3,
    BURN_DMG_PERCENT: 0.08,
    BURN_MIN_DMG: 3,
    BURN_DMG: null,
    POISON_DURATION: 4,
    POISON_DMG_PERCENT: 0.06,
    POISON_MIN_DMG: 2,
    POISON_DMG: null,
    STUN_DURATION: 1,
    SLOW_DURATION: 2,
    SLOW_DAMAGE_MULTIPLIER: 0.75,
    DEFENSE_DOWN_DURATION: 2,
    DEFENSE_DOWN_DAMAGE_MULTIPLIER: 1.25
  });
  expect(res.defaultPoisonDmg).toBe(6);
  expect(res.hpAfterStaticPoison).toBe(86);
  expect(res.hpAfterMinPoison).toBe(91);
  expect(res.hpAfterStunR1).toBe(500);
  expect(res.stunRemAfterR1).toBe(1);
  expect(res.hpAfterStunR2).toBe(500);
  expect(res.stunRemAfterR2).toBeUndefined();
  expect(res.halvedSlowEnemyDmg).toBe(Math.max(1, Math.round(res.baselineEnemyDmg * 0.5)));
  expect(res.doubledPunchDmg).toBe(res.baselinePunchDmg * 2);
});

test("guard has finite duration, refreshes predictably without stacking, expires cleanly, and clears on combat end", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.learned = ["punch", "guard"];
    save.run.equippedAttacks = ["punch", "guard", null, null];
    save.run.stats.strength = 4;
    save.run.stats.constitution = 3;
    save.run.hp = 200;
    save.run.maxHp = 200;
    save.run.mana = 50;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.evaluate(() => {
    Math.random = () => 0.5;
  });
  await page.locator("[data-combat-zone]").first().click();

  // Turn 1: cast Garde -> reduces Turn 1 enemy damage, duration stays 1 (not reduced on application turn)
  await page.locator('[data-attack="guard"]').click();
  await expect(page.locator(".player-statuses")).toContainText("Protection (1 t.)");

  const r1 = await page.evaluate(async () => {
    const state = await import("/src/state.js");
    state.combat.enemy.hp = 200;
    state.combat.enemy.maxHp = 200;
    return {
      hp: state.save.run.hp,
      statuses: state.save.run.statuses.map(s => ({ ...s }))
    };
  });
  expect(r1.statuses).toEqual([{ id: "guard", duration: 1 }]);
  const dmgTurn1 = 200 - r1.hp;

  // Reapply Garde while active -> refreshes to duration 1 without duplicating entry
  await page.locator('[data-attack="guard"]').click();
  const afterRefresh = await page.evaluate(async () => {
    const state = await import("/src/state.js");
    return state.save.run.statuses.map(s => ({ ...s }));
  });
  expect(afterRefresh).toEqual([{ id: "guard", duration: 1 }]);

  // Let guard expire on the next turn (Turn 3: 1->0 expired)
  await page.locator('[data-attack="punch"]').click();
  await expect(page.locator(".player-statuses")).toContainText("Statuts : Aucun");
  await expect(page.locator(".battle-log")).toContainText("Effet expiré");

  const hpBeforeUnguarded = await page.evaluate(async () => (await import("/src/state.js")).save.run.hp);
  await page.locator('[data-attack="punch"]').click();
  const hpAfterUnguarded = await page.evaluate(async () => (await import("/src/state.js")).save.run.hp);
  const unguardedDmg = hpBeforeUnguarded - hpAfterUnguarded;
  expect(unguardedDmg).toBeGreaterThan(dmgTurn1);


  // Recast guard and finish combat -> player statuses cleared on combat victory
  await page.locator('[data-attack="guard"]').click();
  await page.evaluate(async () => {
    const state = await import("/src/state.js");
    state.combat.enemy.hp = 1;
  });
  await page.locator('[data-attack="punch"]').click();
  const afterCombat = await page.evaluate(async () => (await import("/src/state.js")).save.run.statuses);
  expect(afterCombat).toEqual([]);
});

test("weapon attacks require an equipped compatible weapon, block inventory-only usage, and consume neither mana nor turn", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "knight";
    save.run.classHistory = ["warrior", "knight"];
    save.run.stats.strength = 8;
    save.run.mana = 25;
    // Own sword in inventory ONLY (not equipped)
    save.run.inventory["iron-sword"] = 1;
    save.run.equipment = {};
    save.run.learned = ["punch", "slash", "knight-slash"];
    save.run.equippedAttacks = ["punch", "slash", "knight-slash", null];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.evaluate(() => {
    Math.random = () => 0.5;
  });
  await page.locator("[data-combat-zone]").first().click();

  // UI disables sword attacks and displays weapon requirement
  await expect(page.locator('[data-attack-card="knight-slash"]')).toContainText("Arme requise : Épées");
  await expect(page.locator('[data-attack="knight-slash"]')).toBeDisabled();
  await expect(page.locator('[data-attack="slash"]')).toBeDisabled();
  await expect(page.locator('[data-attack="punch"]')).toBeEnabled();

  // Logic check: attempting to invoke knight-slash directly does not consume mana, turn, or enemy HP
  const blockedCheck = await page.evaluate(async () => {
    const state = await import("/src/state.js");
    const combatMod = await import("/src/combat.js");
    const beforeMana = state.save.run.mana;
    const beforeTurn = state.combat.turn;
    const beforeEnemyHp = state.combat.enemy.hp;
    const beforePlayerHp = state.save.run.hp;

    combatMod.chooseAttack("knight-slash");

    return {
      manaUnchanged: state.save.run.mana === beforeMana,
      turnUnchanged: state.combat.turn === beforeTurn,
      enemyHpUnchanged: state.combat.enemy.hp === beforeEnemyHp,
      playerHpUnchanged: state.save.run.hp === beforePlayerHp,
      toastText: document.querySelector("#toast").textContent
    };
  });

  expect(blockedCheck.manaUnchanged).toBe(true);
  expect(blockedCheck.turnUnchanged).toBe(true);
  expect(blockedCheck.enemyHpUnchanged).toBe(true);
  expect(blockedCheck.playerHpUnchanged).toBe(true);
  expect(blockedCheck.toastText).toContain("Arme requise : Épées");

  // Equip the sword and verify knight-slash now works and consumes mana + turn
  await page.evaluate(async () => {
    const state = await import("/src/state.js");
    const ui = await import("/src/ui.js");
    state.save.run.equipment.main = "iron-sword";
    ui.renderGame();
  });
  await expect(page.locator('[data-attack="knight-slash"]')).toBeEnabled();
  await page.locator('[data-attack="knight-slash"]').click();

  const afterSwordAttack = await page.evaluate(async () => {
    const state = await import("/src/state.js");
    return {
      mana: state.save.run.mana,
      turn: state.combat.turn,
      enemyHp: state.combat.enemy.hp,
      enemyMaxHp: state.combat.enemy.maxHp
    };
  });
  expect(afterSwordAttack.mana).toBe(22); // knight-slash costs 3 mana
  expect(afterSwordAttack.turn).toBe(2);
  expect(afterSwordAttack.enemyHp).toBeLessThan(afterSwordAttack.enemyMaxHp);
});

test("each created class receives and auto-equips its starting equipment without duplicating on reload", async ({ page }) => {
  const cases = [
    { classId: "lancer", itemId: "wooden-spear", slot: "main" },
    { classId: "reaver", itemId: "wood-axe", slot: "main" },
    { classId: "hammerer", itemId: "mallet-hammer", slot: "main" },
    { classId: "archer", itemId: "short-bow", slot: "main" },
    { classId: "rogue", itemId: "iron-dagger", slot: "main" },
    { classId: "fireMage", itemId: "ember-wand", slot: "main" },
  ];

  for (const c of cases) {
    await page.evaluate(classId => {
      const key = "retry-rpg-save-v2";
      const save = JSON.parse(localStorage.getItem(key)) || { schema: 3, legacy: { deaths: 0, abandoned: 0, totalActions: 0, bestAge: 16, goldEarned: 0, unlockedClasses: ["none"], unlockedJobs: ["none"], talents: [], classStatBonuses: {}, history: {}, characters: [], discoveries: [] }, run: null };
      save.run = null;
      if (!save.legacy.unlockedClasses.includes(classId)) save.legacy.unlockedClasses.push(classId);
      localStorage.setItem(key, JSON.stringify(save));
    }, c.classId);
    await page.reload();

    await page.locator(`input[name="class"][value="${c.classId}"]`).check();
    await page.getByRole("button", { name: "Commencer à 16 ans" }).click();

    const createdRun = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
    expect(createdRun.inventory[c.itemId]).toBe(1);
    expect(createdRun.equipment[c.slot]).toBe(c.itemId);

    // Reloading must NOT duplicate starting gear
    await page.reload();
    const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
    expect(afterReload.inventory[c.itemId]).toBe(1);
    expect(afterReload.equipment[c.slot]).toBe(c.itemId);
  }
});

test("class evolution preserves parent attacks while direct advanced class creation does not inherit parent attacks", async ({ page }) => {
  // Part A: Direct creation as Fire Mage does NOT grant Mage's mana-sphere
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.legacy.unlockedClasses.push("mage", "fireMage");
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.locator('input[name="class"][value="fireMage"]').check();
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();

  const directFireMage = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(directFireMage.classId).toBe("fireMage");
  expect(directFireMage.classHistory).toEqual(["fireMage"]);
  expect(directFireMage.learned).toContain("punch");
  expect(directFireMage.learned).toContain("fire-sphere");
  expect(directFireMage.learned).not.toContain("mana-sphere");
  expect(directFireMage.equipment.main).toBe("ember-wand");

  // Combat UI shows mana-sphere as locked by class
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page.locator("[data-combat-zone]").first().click();
  await expect(page.locator('[data-locked-attack="mana-sphere"]')).toContainText("Classe requise : Mage");

  // Part B: Starting as Mage and evolving to Fire Mage retains mana-sphere AND unlocks fire-sphere without duplicates
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run = null;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.locator('input[name="class"][value="mage"]').check();
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.getByRole("button", { name: "Classes / métiers" }).click();
  await page.locator('[data-select-class="fireMage"]').click();

  const evolvedFireMage = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(evolvedFireMage.classId).toBe("fireMage");
  expect(evolvedFireMage.classHistory).toEqual(["mage", "fireMage"]);
  expect(evolvedFireMage.learned).toContain("punch");
  expect(evolvedFireMage.learned).toContain("mana-sphere");
  expect(evolvedFireMage.learned).toContain("fire-sphere");
  expect(new Set(evolvedFireMage.learned).size).toBe(evolvedFireMage.learned.length);

  // Reload preserves history, equipment, and unlocked attacks
  await page.reload();
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(afterReload.classHistory).toEqual(["mage", "fireMage"]);
  expect(afterReload.learned).toEqual(evolvedFireMage.learned);
  expect(afterReload.equipment.main).toBe("ember-wand");
});

test("legacy saves without classHistory remain compatible and preserve existing gear and attacks", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    delete save.run.classHistory;
    save.run.classId = "knight";
    save.run.classXPById = { warrior: 10, knight: 4 };
    save.run.learned = ["punch", "warrior-strike", "knight-slash"];
    save.run.equippedAttacks = ["punch", "warrior-strike", "knight-slash", null];
    save.run.equipment = { main: "warrior-blade" };
    save.run.inventory = { "warrior-blade": 1, "health-potion": 1 };
    save.run.statuses = ["guard"];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();

  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  expect(migrated.classHistory).toEqual(expect.arrayContaining(["warrior", "knight"]));
  expect(migrated.equipment.main).toBe("warrior-blade");
  expect(migrated.learned).toEqual(["punch", "warrior-strike", "knight-slash"]);
  expect(migrated.inventory["warrior-blade"]).toBe(1);
});




