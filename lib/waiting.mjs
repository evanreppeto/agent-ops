// Turns the commits on `main...dev` into the PRs waiting to be promoted. Pure: no I/O.
import { isHeld } from "./hold.mjs";

const SYNC = /sync main into dev|merge branch 'main'|merge branch "main"|merge remote-tracking branch 'origin\/main'/i;
const PICKED = /\(cherry picked from commit ([0-9a-f]{40})\)/g;

/**
 * What a partial promotion already put on main: the dev commits it cherry-picked (`git cherry-pick -x`
 * leaves "(cherry picked from commit <sha>)"). mainMessages = recent full commit messages on main.
 */
export function shippedFromMain(mainMessages) {
  const shas = new Set();
  for (const m of mainMessages) for (const [, sha] of String(m).matchAll(PICKED)) shas.add(sha);
  return { shas };
}

/**
 * commits: newest first; each a full commit message string, or { message, sha, parents }.
 * opts.shipped = shippedFromMain(...) result: a PR whose commit (or, for a PR merge commit, the
 * branch tip it merged) was cherry-picked onto main has shipped and is not waiting.
 * opts.hold = the app's `hold`: matching PRs are still listed, marked `held`.
 * Returns [{ number, title, url, held? }] newest first, deduped by PR number.
 */
export function waitingFromCommits(commits, repo, opts = {}) {
  const shippedShas = opts.shipped?.shas ?? new Set();
  const seen = new Set();
  const out = [];
  for (const c of commits) {
    const message = typeof c === "string" ? c : c.message;
    const [subject = "", second = ""] = String(message).split("\n").map((l) => l.trim()).filter((l, i) => i === 0 || l);
    if (SYNC.test(subject) || SYNC.test(second)) continue;
    let number;
    let title;
    const merge = subject.match(/^Merge pull request #(\d+) from /i);
    const squash = subject.match(/^(.*?)\s*\(#(\d+)\)$/);
    if (merge) {
      number = Number(merge[1]);
      title = second || `PR #${number}`;
    } else if (squash) {
      number = Number(squash[2]);
      title = squash[1] || `PR #${number}`;
    } else continue;
    if (seen.has(number)) continue;
    seen.add(number);
    if (typeof c !== "string" && (shippedShas.has(c.sha) || (merge && shippedShas.has(c.parents?.[1])))) continue;
    const item = { number, title, url: `https://github.com/${repo}/pull/${number}` };
    if (isHeld(opts.hold, { title })) item.held = true;
    out.push(item);
  }
  return out;
}
