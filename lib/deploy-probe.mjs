/**
 * Which commit a dev site is serving, read from the page itself (apps.json `deployProbe`):
 * BSR's /sw.js embeds the first 12 chars of VERCEL_GIT_COMMIT_SHA; Arc's /login HTML embeds the full sha.
 * Returns the sha (or prefix) as printed by the site, or null if the page carries none.
 */
export function extractDeployedSha(app, body) {
  const match = body.match(new RegExp(app.deployProbe.pattern));
  return match ? match[0] : null;
}
