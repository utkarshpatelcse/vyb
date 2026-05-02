import { expect, test } from "@playwright/test";

test("public landing page loads", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/Vyb/i);
  await expect(page.getByRole("link", { name: /start for free/i })).toBeVisible();
});
