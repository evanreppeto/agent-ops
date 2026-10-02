import { test, expect } from "../fixtures.mjs";

test("logged in and dashboard renders @setup-check", async ({ page, shot, consoleErrors }) => {
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await page.waitForLoadState("networkidle");
  await shot("dashboard");
  expect(consoleErrors, "browser console errors").toEqual([]);
});
