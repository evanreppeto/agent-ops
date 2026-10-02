import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute paths anchored at the agent-ops repo root, so they don't depend on the cwd. */
export const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const AUTH_DIR = join(REPO_ROOT, ".auth");
export const RESULTS_DIR = join(REPO_ROOT, "test-results");

export function authFile(appKey) {
  return join(AUTH_DIR, `${appKey}.json`);
}
