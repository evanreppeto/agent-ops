import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  consoleErrors: async ({ page }, use, testInfo) => {
    const errors = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("pageerror", (err) => errors.push(String(err)));
    await use(errors);
    await testInfo.attach("console-errors.json", { body: JSON.stringify(errors, null, 2), contentType: "application/json" });
  },
  shot: async ({ page }, use, testInfo) => {
    let n = 0;
    await use(async (name) => {
      n += 1;
      const file = testInfo.outputPath(`${String(n).padStart(2, "0")}-${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      return file;
    });
  },
});

export { expect };
