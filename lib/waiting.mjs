// Turns the commits on `main...dev` into the PRs waiting to be promoted. Pure: no I/O.
import { isHeld } from "./hold.mjs";

const SYNC = /sync main into dev|merge branch 'main'|merge branch "main"|merge remote-tracking branch 'origin\/main'/i;
const PICKED = /\(cherry picked from commit ([0-9a-f]{40})\)/g;
const PICKED_PR = /\bcherry-pick(?:ed)? of #(\d+)/gi;
const REVERT = /\brevert(?:s|ed|ing)?\b/i;

/**
 * What already reached main outside a normal promotion (a partial promotion or a hotfix).
 * mainMessages = recent full commit messages on main. Three signals:
 * - `git cherry-pick -x` leaves "(cherry picked from commit <sha>)" → that dev commit shipped;
 * - a hotfix body saying "Cherry-pick of #<n>" → PR <n> shipped;
 * - a main commit whose subject is exactly a dev PR's title → that PR shipped (hand-copied hotfix).
 */
export function shippedFromMain(mainMessages) {
  const shas = new Set();
  const numbers = new Set();
  const subjects = new Set();
  for (const m of mainMessages) {
    const text = String(m);
    for (const [, sha] of text.matchAll(PICKED)) shas.add(sha);
    for (const [, n] of text.matchAll(PICKED_PR)) numbers.add(Number(n));
    const subject = text.split("\n")[0].trim();
    if (subject) subjects.add(subject.toLowerCase());
  }
  return { shas, numbers, subjects };
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
  const shippedNumbers = opts.shipped?.numbers ?? new Set();
  const shippedSubjects = opts.shipped?.subjects ?? new Set();
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
    if (shippedNumbers.has(number) || shippedSubjects.has(title.toLowerCase())) continue;
    const item = { number, title, url: `https://github.com/${repo}/pull/${number}` };
    const heldBy = isHeld(opts.hold, { title });
    if (heldBy) Object.assign(item, { held: true, heldLabel: heldBy });
    out.push(item);
  }
  // A PR that reverts others ("Take X off dev (revert #12 and #13)") cancels them out: while all of
  // them are still waiting, none of them changes what main would get, so drop the whole set.
  const waitingNumbers = new Set(out.map((w) => w.number));
  const cancelled = new Set();
  for (const w of out) {
    if (!REVERT.test(w.title)) continue;
    const targets = [...w.title.matchAll(/#(\d+)/g)].map(([, n]) => Number(n));
    if (targets.length && targets.every((n) => waitingNumbers.has(n))) [w.number, ...targets].forEach((n) => cancelled.add(n));
  }
  return out.filter((w) => !cancelled.has(w.number));
}
