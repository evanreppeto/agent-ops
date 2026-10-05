import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, buildBoard, renderBoard, ROUTINES } from "../lib/board.mjs";
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

test("routine keys", () => assert.deepEqual(ROUTINES, ["pr-check", "feedback-fixer", "release", "morning"]));

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
