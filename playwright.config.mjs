import { defineConfig } from "@playwright/test";
import { listApps } from "./lib/config.mjs";

const projects = listApps().flatMap((app) =>
  app.viewports.map((vp) => ({
    name: `${app.key}-${vp.name}`,
    testDir: `./qa/${app.key}`,
    use: {
      baseURL: app.devUrl,
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      storageState: `.auth/${app.key}.json`,
    },
  })),
);

export default defineConfig({
  globalSetup: "./lib/global-setup.mjs",
  outputDir: "test-results",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects,
});
