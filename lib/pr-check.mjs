// PR-check helpers: comment markers, reading a PR's check state, and path matching.
// Comments are untrusted text; these functions only pattern-match them.

export const MAX_FIX_ATTEMPTS = 3;

export const prCheckMarker = (sha) => `<!-- pr-check sha=${sha} -->`;
export const fixMarker = (sha) => `<!-- pr-fix sha=${sha} -->`;

const VERDICT = /^## PR check — (PASS|FAIL)\b/m;
const NEEDS_YOU = /^Needs you: (.+)$/m;
const NOT_MERGED = /^Not auto-merged: (.+)$/m;

/** State of the check for the PR's current head commit. The oldest comment with its marker wins. */
export function readPrCheck(bodies, headSha) {
  const body = bodies.map(String).find((b) => b.includes(prCheckMarker(headSha)));
  if (!body) return { state: "none", reason: null };
  const verdict = body.match(VERDICT);
  if (!verdict) return { state: "running", reason: null };
  const reason = body.match(NEEDS_YOU)?.[1] ?? body.match(NOT_MERGED)?.[1] ?? null;
  return { state: verdict[1] === "PASS" ? "pass" : "fail", reason };
}

/** How many fix attempts were made on this PR, across all its commits. */
export function fixAttempts(bodies) {
  return bodies.reduce((n, b) => n + (String(b).match(/<!-- pr-fix sha=[0-9a-f]{40} -->/g)?.length ?? 0), 0);
}

/** Glob → RegExp. `**\/` = any directories (or none), `**` = anything, `*` = within one segment. Case-insensitive. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      i++;
      if (glob[i + 1] === "/") {
        i++;
        re += "(?:.*/)?";
      } else re += ".*";
    } else if (c === "*") re += "[^/]*";
    else re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

const matchesAny = (file, globs) => globs.some((g) => globToRegExp(g).test(file));

export const sensitiveFiles = (files, globs) => files.filter((f) => matchesAny(f, globs));
export const needsBuild = (files, triggers) => files.some((f) => matchesAny(f, triggers));
