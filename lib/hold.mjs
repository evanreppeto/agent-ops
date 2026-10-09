// Work Evan has asked to keep off `main` (apps.json `<app>.hold`). Pure: no I/O.
import { globToRegExp } from "./pr-check.mjs";

/** `hold` may be one { label, titleMatch, paths } or a list of them. */
export const holdList = (hold) => (Array.isArray(hold) ? hold : hold ? [hold] : []);

/**
 * Returns the label of the first hold that matches (truthy), or false.
 * A change matches when its PR title matches `titleMatch` (case-insensitive regex) or it touches any
 * `paths` glob. `files` is optional: the board only knows titles, Release knows both.
 */
export function isHeld(hold, { title = "", files = [] } = {}) {
  for (const h of holdList(hold)) {
    if (h.titleMatch && new RegExp(h.titleMatch, "i").test(String(title))) return h.label;
    const globs = (h.paths ?? []).map(globToRegExp);
    if (files.some((f) => globs.some((re) => re.test(f)))) return h.label;
  }
  return false;
}
