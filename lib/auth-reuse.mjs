import { readFileSync, statSync } from "node:fs";

export const AUTH_MAX_AGE_MS = 30 * 60_000;

/** True if `file` holds a non-empty Playwright storage state written less than `maxAgeMs` ago. */
export function isReusableAuth(file, { maxAgeMs = AUTH_MAX_AGE_MS, now = Date.now() } = {}) {
  try {
    if (now - statSync(file).mtimeMs >= maxAgeMs) return false;
    const state = JSON.parse(readFileSync(file, "utf8"));
    return (state.cookies?.length ?? 0) > 0 || (state.origins?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
