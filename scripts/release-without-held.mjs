#!/usr/bin/env node
// Builds a release candidate = main + every dev change except held work (apps.json `<app>.hold`).
// Usage: node scripts/release-without-held.mjs <app> <repo-dir> <MAIN_SHA> <DEV_SHA> <new-worktree-path>
// Walks dev's first-parent commits on main..dev oldest first (one per PR, plus syncs) and cherry-picks
// each one onto a detached worktree at MAIN_SHA with `-x`, so the board can tell what shipped.
// Skipped: main→dev syncs and empty commits; held PRs (title or paths, lib/hold.mjs); a change that
// no longer applies once held work is left out ("depends on held work"); a change already on main
// (main's "(cherry picked from commit …)" lines name it, or it applies empty). A conflict only in
// CHANGELOG.md is not a dependency: every PR adds a line next to the held PRs' lines, so keep main's
// file and add this change's new lines under "## Unreleased". Prints JSON; `candidate` is the commit
// to test and promote.
import { execFileSync } from "node:child_process";
import { getApp } from "../lib/config.mjs";
import { isHeld } from "../lib/hold.mjs";
import { shippedFromMain } from "../lib/waiting.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const [appKey, repoDir, mainSha, devSha, wt] = process.argv.slice(2);
const HEX = /^[0-9a-f]{40}$/;
if (!appKey || !repoDir || !HEX.test(mainSha ?? "") || !HEX.test(devSha ?? "") || !wt) {
  console.error("usage: release-without-held.mjs <app> <repo-dir> <MAIN_SHA> <DEV_SHA> <new-worktree-path>");
  process.exit(2);
}
const hold = getApp(appKey).hold;
const AS_EVAN = new URL("./git-as-evan.sh", import.meta.url).pathname;
const git = (args, opts = {}) => execFileSync("git", ["-C", repoDir, ...args], { encoding: "utf8", maxBuffer: 256 << 20, ...opts });
const pick = (args) => execFileSync("sh", [AS_EVAN, "-C", wt, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const SYNC = /sync main into dev|merge branch 'main'|merge branch "main"|merge remote-tracking branch 'origin\/main'/i;

const units = git(["log", "--first-parent", "--reverse", "--format=%H %P", `${mainSha}..${devSha}`])
  .trim().split("\n").filter(Boolean).map((l) => { const [sha, ...parents] = l.split(" "); return { sha, parents }; });

git(["worktree", "add", "--detach", wt, mainSha], { stdio: "ignore" });
const shippedMain = shippedFromMain([git(["log", "--format=%B%x00", "-n", "500", mainSha])].flatMap((t) => t.split("\0")));
const shipped = shippedMain.shas;

function conflicted() {
  return git(["-C", wt, "diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean);
}
// Keep main's CHANGELOG.md and put this change's added lines right under "## Unreleased".
function resolveChangelog(u) {
  pick(["checkout", "--ours", "--", "CHANGELOG.md"]);
  const added = git(["diff", "--no-color", "-U0", u.parents[0], u.sha, "--", "CHANGELOG.md"])
    .split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
  const file = `${wt}/CHANGELOG.md`;
  const lines = readFileSync(file, "utf8").split("\n");
  const at = lines.findIndex((l) => /^##\s+\[?unreleased\]?\s*$/i.test(l));
  if (at >= 0 && added.length) {
    const body = added.filter((l, i) => l.trim() || i > 0);
    lines.splice(at + 1, 0, "", ...body);
    writeFileSync(file, lines.join("\n").replace(/\n{3,}/g, "\n\n"));
  }
  pick(["add", "CHANGELOG.md"]);
  execFileSync("sh", [AS_EVAN, "-C", wt, "-c", "core.editor=true", "cherry-pick", "--continue"], { stdio: "ignore" });
}

const out = { candidate: mainSha, picked: [], held: [], dependsOnHeld: [], alreadyOnMain: [], skipped: [] };
for (const u of units) {
  const message = git(["log", "-1", "--format=%B", u.sha]);
  const lines = message.split("\n").map((l) => l.trim()).filter((l, i) => i === 0 || l);
  const subject = lines[0] ?? "";
  const merge = subject.match(/^Merge pull request #(\d+) from /i);
  const squash = subject.match(/^(.*?)\s*\(#(\d+)\)$/);
  const number = merge ? Number(merge[1]) : squash ? Number(squash[2]) : null;
  const title = merge ? lines[1] || subject : squash ? squash[1] : subject;
  const row = { sha: u.sha, number, title };
  const files = git(["diff", "--name-only", "--no-renames", u.parents[0], u.sha]).split("\n").filter(Boolean);
  if (SYNC.test(subject) || SYNC.test(lines[1] ?? "") || files.length === 0) { out.skipped.push(row); continue; }
  const heldBy = isHeld(hold, { title, files });
  if (heldBy) { out.held.push({ ...row, label: heldBy }); continue; }
  if (shipped.has(u.sha) || (u.parents.length > 1 && shipped.has(u.parents[1])) || (number && shippedMain.numbers.has(number)) || shippedMain.subjects.has(String(title).toLowerCase())) {
    out.alreadyOnMain.push(row);
    continue;
  }
  const before = git(["-C", wt, "rev-parse", "HEAD"]).trim();
  try {
    pick(["cherry-pick", "-x", "--keep-redundant-commits", ...(u.parents.length > 1 ? ["-m", "1"] : []), u.sha]);
  } catch {
    const files = conflicted();
    let resolved = false;
    if (files.length === 1 && files[0] === "CHANGELOG.md") {
      try { resolveChangelog(u); resolved = true; } catch { /* fall through */ }
    }
    if (!resolved) {
      // Doesn't apply without the held work. Undo just this pick (throwaway worktree) and leave it out.
      try { pick(["cherry-pick", "--abort"]); } catch { /* nothing in progress */ }
      out.dependsOnHeld.push({ ...row, conflicts: files });
      continue;
    }
  }
  const after = git(["-C", wt, "rev-parse", "HEAD"]).trim();
  const changed = git(["-C", wt, "diff", "--name-only", before, after]).trim();
  if (!changed) { pick(["reset", "--soft", before]); out.alreadyOnMain.push(row); continue; }
  out.picked.push(row);
}
out.candidate = git(["-C", wt, "rev-parse", "HEAD"]).trim();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
