import { test, expect } from "../fixtures.mjs";

test("logged in and app shell renders @setup-check", async ({ page, shot, consoleErrors }) => {
  await page.goto("/v3");
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
  await shot("home");
  expect(consoleErrors, "browser console errors").toEqual([]);
});
