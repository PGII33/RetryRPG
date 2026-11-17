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
  await expect(page.locator("#class-options input")).toHaveCount(6);
  await expect(page.locator("#job-options input")).toHaveCount(5);
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

test("only displays inherited domains above beginner with their best character and effect", async ({ page }) => {
  await page.locator("#name-input").fill("Nora");
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.legacy.heritageDomains.sword.lastLevel = 0;
    save.legacy.heritageDomains.class.lastLevel = 1;
    save.legacy.heritageDomains.class.lastCharacter = "Mira";
    save.legacy.heritageDomains.class.permanent = { lifeExpectancy: 1 };
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Héritage" }).click();

  await expect(page.locator("#tab-content")).toContainText("Meilleur rang atteint : Novice · par Mira");
  await expect(page.locator("#tab-content")).toContainText("Effet concret : +1 ans d'espérance de vie");
  await expect(page.locator("#tab-content")).not.toContainText("Épées");
});

test("class and job levels add growth experience and half a year each to life expectancy", async ({ page }) => {
  await page.locator("#name-input").fill("Iris");
  await page.getByRole("button", { name: "Commencer à 16 ans" }).click();
  await page.evaluate(() => {
    const key = "retry-rpg-save-v2";
    const save = JSON.parse(localStorage.getItem(key));
    save.run.classId = "mage";
    save.run.jobId = "farmer";
    save.run.classXP = 8;
    save.run.jobXP = 8;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Travailler" }).click();
  await page.locator('[data-action="work"]').click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("retry-rpg-save-v2")).run);

  expect(after.jobXP).toBe(10.5);
  expect(after.classXP).toBe(9);
  await expect(page.locator("#tab-content")).toContainText("Bonus de niveaux : +1.0 ans");
  expect(after.jobXP).toBeGreaterThan(before.jobXP);
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
