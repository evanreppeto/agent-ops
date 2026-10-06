/**
 * Pure parts of the production page check (scripts/prod-check.mjs).
 * The check is plain HTTP on purpose: a headless browser's sub-resources go through the cloud
 * sandbox's proxy, which randomly 502s CSS/fonts, so a browser check fails at random on a healthy site.
 */

const ERROR_TEXT = /something went wrong|application error|internal server error/i;

/** The distinct paths to fetch for an app: its login page and its deploy-probe page. */
export function prodCheckPaths(app) {
  return [...new Set([app.login.path, app.deployProbe.path])];
}

/**
 * Pass/fail for one response. `status` 0 means curl got no HTTP answer.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function judgeResponse({ status, body }) {
  if (!Number.isInteger(status) || status === 0 || status >= 400) {
    return { ok: false, reason: `HTTP ${status || 0}` };
  }
  if (ERROR_TEXT.test(body ?? "")) return { ok: false, reason: "error text on page" };
  return { ok: true };
}
