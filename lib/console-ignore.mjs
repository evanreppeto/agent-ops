/**
 * Known dev-site noise to drop from console errors, configured per app in apps.json
 * (`ignoreMissingResources`: URL substrings). Only "Failed to load resource" errors whose
 * resource URL matches are dropped — e.g. BSR dev's seed data points at profile pictures
 * that don't exist. Any other error from the same URL is still reported.
 */
export function isIgnoredConsoleError(app, text, url = "") {
  const patterns = app.ignoreMissingResources ?? [];
  if (!String(text).startsWith("Failed to load resource")) return false;
  return patterns.some((p) => String(url).includes(p));
}
