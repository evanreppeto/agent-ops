import { test, expect } from "../fixtures.mjs";
import { getApp } from "../../lib/config.mjs";

const app = getApp("arc");

for (const route of app.smokeRoutes) {
  test(`${route} loads @smoke`, async ({ page, shot, newConsoleErrors }) => {
    const res = await page.goto(route);
    expect(res?.status() ?? 0, "HTTP status").toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/something went wrong|application error/i)).toHaveCount(0);
    await shot(route === "/" ? "home" : route.slice(1).replaceAll("/", "-"));
    expect(newConsoleErrors(), "new console errors").toEqual([]);
  });
}
