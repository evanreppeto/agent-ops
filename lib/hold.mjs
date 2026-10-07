// Work Evan has asked to keep off `main` (apps.json `<app>.hold`). Pure: no I/O.
import { globToRegExp } from "./pr-check.mjs";

/**
 * hold: { label, titleMatch, paths } or undefined.
 * A change is held when its PR title matches `titleMatch` (case-insensitive regex) or it touches any
 * `paths` glob. `files` is optional: the board only knows titles, Release knows both.
 */
export function isHeld(hold, { title = "", files = [] } = {}) {
  if (!hold) return false;
  if (hold.titleMatch && new RegExp(hold.titleMatch, "i").test(String(title))) return true;
  const globs = (hold.paths ?? []).map(globToRegExp);
  return files.some((f) => globs.some((re) => re.test(f)));
}
