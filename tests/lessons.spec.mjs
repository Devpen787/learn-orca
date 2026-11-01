import { test, expect } from "@playwright/test";

test("five lessons, model commands and recorded-evidence fallback", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?qa-motion=reduce&qa-recording-missing=1");
  await expect(page).toHaveTitle("Learn ORCA — interactive hand lessons");
  await expect(page.locator("#loading")).toBeHidden({ timeout: 30000 });
  await expect(page.locator("#viewer canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Lesson 2: Move a joint", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Finger", exact: true })
    .selectOption("middle");
  await page.getByRole("slider", { name: "Knuckle target" }).fill("42");
  await page.locator("#run").click();
  await expect(page.locator("#feedback")).toContainText("middle_mcp → 42°");
  await expect(page.locator("#code")).toContainText("middle_mcp");

  await page
    .getByRole("button", { name: "Lesson 3: Shape a finger", exact: true })
    .click();
  await page.getByRole("slider", { name: "Knuckle target" }).fill("45");
  await page.getByRole("slider", { name: "Middle joint target" }).fill("15");
  await page.locator("#run").click();
  await expect(page.locator("#code")).toContainText("45");
  await expect(page.locator("#code")).toContainText("15");

  await page
    .getByRole("button", { name: "Lesson 4: Run a sequence", exact: true })
    .click();
  await expect(page.locator("#information-body")).toContainText("sequence");
  await page.locator("#run").click();
  await expect(page.locator("#run-state")).toHaveText("PLAYING");
  await page.locator("#run").click();
  await expect(page.locator("#run-state")).toHaveText("PAUSED");
  await page.locator("#stop").click();

  await page
    .getByRole("button", { name: "Lesson 5: Discover touch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Watch the physical hand ↗", exact: true })
    .click();
  await expect(page.locator("#recording-status")).toContainText(
    "Recording unavailable",
    { timeout: 15000 },
  );
  await expect(page.locator("#recording a")).toHaveAttribute(
    "href",
    "https://www.orcahand.com/models/touch",
  );
  await page
    .getByRole("button", { name: "Return to model ×", exact: true })
    .click();
  await expect(page.locator("#recording")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Lesson 1: Meet the hand", exact: true })
    .click();
  await page.getByRole("button", { name: "KNUCKLE", exact: true }).click();
  await expect(page.locator("#part-inspector")).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
