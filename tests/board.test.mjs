import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, buildBoard, renderBoard, ROUTINES } from "../lib/board.mjs";
import { waitingFromCommits } from "../lib/waiting.mjs";
import { prCheckMarker, fixMarker } from "../lib/pr-check.mjs";

const SHA = "c".repeat(40);
const NOW = Date.parse("2026-10-05T16:00:00Z"); // noon ET
const OPTS = { now: NOW, staleDays: 2, maxFixAttempts: 3, timezone: "America/New_York", by: "pr-check" };
const hoursAgo = (h) => new Date(NOW - h * 3600e3).toISOString();
const pr = (over = {}) => ({
  number: 7, title: "Fix calendar", url: "https://github.com/o/r/pull/7", draft: false, base: "dev",
  headSha: SHA, createdAt: hoursAgo(3), updatedAt: hoursAgo(1), labels: [], comments: [], ...over,
});
const pass = `${prCheckMarker(SHA)}\n## PR check — PASS`;
const fail = `${prCheckMarker(SHA)}\n## PR check — FAIL`;

test("routine keys", () => assert.deepEqual(ROUTINES, ["pr-check", "feedback-fixer", "release", "ship-check", "morning"]));

test("classify: no check yet → checking", () => {
  assert.deepEqual(classify(pr(), OPTS), { section: "checking", reason: "waiting for first check", ageDays: 0 });
});

test("classify: claim only → checking", () => {
  assert.equal(classify(pr({ comments: [`${prCheckMarker(SHA)}\nPR check running…`] }), OPTS).reason, "check running");
});

test("classify: fail with attempts left → failing", () => {
  const c = classify(pr({ comments: [fail, fixMarker("d".repeat(40))] }), OPTS);
  assert.deepEqual([c.section, c.reason], ["failing", "fix attempt 1/3"]);
});

test("classify: fail after 3 attempts → needs_you", () => {
  const fixes = ["d", "e", "f"].map((x) => fixMarker(x.repeat(40)));
  assert.deepEqual(classify(pr({ comments: [fail, ...fixes] }), OPTS).section, "needs_you");
});

test("classify: pass not merged → passed with reason", () => {
  const c = classify(pr({ draft: true, comments: [`${pass}\nNot auto-merged: draft — mark it ready to merge`] }), OPTS);
  assert.deepEqual([c.section, c.reason], ["passed", "draft — mark it ready to merge"]);
});

test("classify: needs-human label → needs_you with the comment's reason", () => {
  const c = classify(pr({ labels: ["needs-human"], comments: [`${pass}\nStuck: touches supabase/migrations/x.sql`] }), OPTS);
  assert.deepEqual([c.section, c.reason], ["needs_you", "touches supabase/migrations/x.sql"]);
});

test("classify: hold label and WIP title → needs_you", () => {
  assert.equal(classify(pr({ labels: ["hold"] }), OPTS).reason, "on hold — remove the label; it resumes on the next push or at 7:30am");
  assert.equal(classify(pr({ title: "WIP: thing" }), OPTS).section, "needs_you");
  assert.equal(classify(pr({ title: "[WIP] x" }), OPTS).section, "needs_you");
  assert.equal(classify(pr({ title: "Wiper blades" }), OPTS).section, "checking");
});

test("classify: base main → needs_you", () => {
  assert.equal(classify(pr({ base: "main" }), OPTS).reason, "targets main — only Release merges into main");
});

test("classify: older than staleDays → stale, but needs_you stays needs_you", () => {
  assert.deepEqual(classify(pr({ createdAt: hoursAgo(72) }), OPTS).section, "stale");
  assert.equal(classify(pr({ createdAt: hoursAgo(72) }), OPTS).ageDays, 3);
  assert.equal(classify(pr({ createdAt: hoursAgo(72), labels: ["hold"] }), OPTS).section, "needs_you");
});

const data = {
  generatedAt: hoursAgo(0),
  apps: [
    { key: "arc", short: "Arc", open: [pr({ title: "Tidy [chat]\nchips" })], merged: [
      { number: 5, title: "Old", url: "u5", base: "dev", mergedAt: hoursAgo(30) },
      { number: 6, title: "New", url: "u6", base: "dev", mergedAt: hoursAgo(2) },
    ] },
    { key: "bsr", short: "BSR", open: [], merged: [] },
  ],
};

test("buildBoard: cleans titles and keeps only last-24h merges", () => {
  const b = buildBoard(data, OPTS);
  assert.equal(b.rows.checking[0].title, "Tidy chat chips");
  assert.deepEqual(b.merged.map((m) => m.number), [6]);
});

test("renderBoard", () => {
  const md = renderBoard(buildBoard(data, OPTS), OPTS);
  assert.match(md, /^# PR board/);
  assert.match(md, /## Stuck \/ needs a look \(0\)\n- none/);
  assert.match(md, /## Checking \(1\)\n- Arc \[#7 Tidy chat chips\]\(https:\/\/github.com\/o\/r\/pull\/7\) — waiting for first check · 0d/);
  assert.match(md, /## Stuck > 2 days \(0\)/);
  assert.match(md, /## Merged in the last 24h \(1\)\n- Arc \[#6 New\]\(u6\) → dev/);
  assert.match(md, /_Last updated Mon 12:00 PM ET by pr-check_$/);
});

const waitData = (over) => ({
  generatedAt: hoursAgo(0),
  apps: [{ key: "arc", short: "Arc", open: [], merged: [], ...over }, { key: "bsr", short: "BSR", open: [], merged: [] }],
});
const w = (n) => ({ number: n, title: `Change [${n}]`, url: `https://github.com/o/r/pull/${n}` });

test("renderBoard: waiting section lists PRs per app, empty app says nothing waiting", () => {
  const md = renderBoard(buildBoard(waitData({ waiting: [w(3), w(2)] }), OPTS), OPTS);
  assert.match(md, /## Passed, waiting to merge \(0\)\n- none\n\n## Waiting to ship \(2\)\n- Arc: 2 PRs on dev, not in main\n  - \[#3 Change 3\]\(https:\/\/github.com\/o\/r\/pull\/3\)\n  - \[#2 Change 2\]\(https:\/\/github.com\/o\/r\/pull\/2\)\n- BSR: nothing waiting\n\n## Stuck > 2 days/);
});

test("renderBoard: waiting list caps at 15 with '… and k more'", () => {
  const prs = Array.from({ length: 18 }, (_, i) => w(100 - i));
  const md = renderBoard(buildBoard(waitData({ waiting: prs }), OPTS), OPTS);
  assert.match(md, /## Waiting to ship \(18\)\n- Arc: 18 PRs on dev, not in main\n/);
  assert.equal(md.split("\n").filter((l) => l.startsWith("  - [#")).length, 15);
  assert.match(md, /  - … and 3 more\n/);
});

test("renderBoard: promotionPr adds the Ready to ship line; one PR is singular", () => {
  const md = renderBoard(buildBoard(waitData({ waiting: [w(9)], promotionPr: { number: 40, url: "https://github.com/o/r/pull/40" } }), OPTS), OPTS);
  assert.match(md, /- Arc: 1 PR on dev, not in main — Ready to ship: \[#40\]\(https:\/\/github.com\/o\/r\/pull\/40\) — click Merge \(Create a merge commit\)\n/);
});

test("renderBoard: truncated scan is flagged", () => {
  const md = renderBoard(buildBoard(waitData({ waiting: [w(1)], waitingTruncated: true }), OPTS), OPTS);
  assert.match(md, /  - … older commits not scanned/);
});

test("renderBoard: old data without waiting still renders (0 waiting)", () => {
  const md = renderBoard(buildBoard(data, OPTS), OPTS);
  assert.match(md, /## Waiting to ship \(0\)\n- Arc: nothing waiting\n- BSR: nothing waiting\n/);
  assert.doesNotThrow(() => renderBoard({ rows: buildBoard(data, OPTS).rows, merged: [] }, OPTS));
});

test("waitingFromCommits: squash + merge subjects, dedupe, skips main→dev syncs, newest first", () => {
  const commits = [
    "Add chat chips (#12)\n\nbody",
    "Merge pull request #11 from o/claude/x\n\nFix the thing",
    "Merge pull request #10 from o/sync-main\n\nSync main into dev",
    "Merge branch 'main' into dev",
    "Tweak (#12)",
    "wip commit with no PR",
    "Merge pull request #13 from o/y",
  ];
  assert.deepEqual(waitingFromCommits(commits, "o/r"), [
    { number: 12, title: "Add chat chips", url: "https://github.com/o/r/pull/12" },
    { number: 11, title: "Fix the thing", url: "https://github.com/o/r/pull/11" },
    { number: 13, title: "PR #13", url: "https://github.com/o/r/pull/13" },
  ]);
});
