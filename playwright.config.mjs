import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { listApps } from "./lib/config.mjs";
import { REPO_ROOT, RESULTS_DIR, authFile } from "./lib/paths.mjs";

const projects = listApps().flatMap((app) =>
  app.viewports.map((vp) => ({
    name: `${app.key}-${vp.name}`,
    testDir: join(REPO_ROOT, "qa", app.key),
    use: {
      baseURL: app.devUrl,
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      storageState: authFile(app.key),
    },
  })),
);

export default defineConfig({
  globalSetup: join(REPO_ROOT, "lib", "global-setup.mjs"),
  outputDir: RESULTS_DIR,
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: join(RESULTS_DIR, "results.json") }]],
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects,
});
