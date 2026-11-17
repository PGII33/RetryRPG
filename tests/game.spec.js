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
