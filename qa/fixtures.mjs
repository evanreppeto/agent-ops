import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test as base, expect } from "@playwright/test";
import { withoutBaseline } from "../lib/console-baseline.mjs";
import { isIgnoredConsoleError } from "../lib/console-ignore.mjs";
import { getApp } from "../lib/config.mjs";

export const test = base.extend({
  // Every console error / page error seen during the test. Also saved as
  // test-results/<test-folder>/console-errors.json (and attached to the report).
  consoleErrors: async ({ page }, use, testInfo) => {
    const errors = [];
    // Project names are "<appKey>-<viewport>"; known dev noise for that app (apps.json) is dropped.
    const app = getApp(testInfo.project.name.split("-")[0]);
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      if (isIgnoredConsoleError(app, msg.text(), msg.location().url)) return;
      errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));
    await use(errors);
    const body = JSON.stringify(errors, null, 2);
    const file = testInfo.outputPath("console-errors.json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
    await testInfo.attach("console-errors.json", { body, contentType: "application/json" });
  },
  // newConsoleErrors(baseline) → console errors so far, minus any that contain a baseline string
  // (the app's preflight setup-check errors). Use instead of editing the assertion by hand.
  newConsoleErrors: async ({ consoleErrors }, use) => {
    await use((baseline = []) => withoutBaseline(consoleErrors, baseline));
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
