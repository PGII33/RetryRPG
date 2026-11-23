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

  expect(after.jobXP).toBe(2.5);
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

  await expect(page.locator('[data-combat-zone]')).toHaveCount(10);
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

test("does not unlock ranger from combats but unlocks it after three explorations", async ({ page }) => {
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.stats.strength = 500;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();

  await page.getByRole("button", { name: "Combat", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-combat-zone]').first().click();
    await page.locator('[data-attack="punch"]').click();
  }

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")));
  expect(saved.run.explorations).toBe(0);
  expect(saved.legacy.unlockedClasses).not.toContain("ranger");

  // Perform 3 explorations from Actions -> Exploration
  await page.getByRole("button", { name: "Actions" }).click();
  await page.locator('[data-action-tab="exploration"]').click();
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-explore-zone]').first().click();
  }

  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")));
  expect(saved.run.explorations).toBe(3);
  expect(saved.legacy.unlockedClasses).toContain("ranger");

  await page.getByRole("button", { name: "Classes / métiers" }).click();
  await expect(page.locator('[data-select-class="ranger"]')).toBeVisible();
});

