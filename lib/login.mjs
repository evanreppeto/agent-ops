import { chromium } from "@playwright/test";

/** Log into an app's dev site and save the browser session to outPath. */
export async function login(app, { email, password }, outPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(new URL(app.login.path, app.devUrl).toString());
    await page.locator(app.login.emailSelector).fill(email);
    await page.locator(app.login.passwordSelector).fill(password);
    await page.locator(app.login.submitSelector).click();
    await page.waitForURL((url) => !url.pathname.startsWith(app.login.path), { timeout: 30_000 });
    await page.context().storageState({ path: outPath });
  } finally {
    await browser.close();
  }
}
