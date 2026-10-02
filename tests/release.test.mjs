import { test } from "node:test";
import assert from "node:assert/strict";
import { ticketIds, releaseTitle, buildReleaseBody, releaseMarker, postReleaseMarker, hasMarker } from "../lib/release.mjs";

test("ticketIds finds unique BSR ids in order", () => {
  assert.deepEqual(ticketIds("BSR-12: fix", "also bsr-7 and BSR-12", "branch claude/bsr-99-x"), ["BSR-12", "BSR-7", "BSR-99"]);
});

test("release titles never contain ticket ids", () => {
  assert.equal(releaseTitle("bsr", "2026-10-08"), "Release 2026-10-08");
  assert.equal(releaseTitle("arc", "2026-10-08"), "Promote dev to main: 2026-10-08");
  assert.deepEqual(ticketIds(releaseTitle("bsr", "2026-10-08")), []);
});

test("release body lists PRs, tickets, migrations, needs-Evan items, merge rule and marker", () => {
  const md = buildReleaseBody({
    appName: "BSR Manager App", date: "2026-10-08", devSha: "a".repeat(40),
    prs: [{ number: 1224, title: "Live walkthrough: ask which job", tickets: ["BSR-1227"] }],
    tickets: [{ id: "BSR-1227", title: "Live Walkthrough", url: "https://linear.app/x/BSR-1227" }],
    migrations: ["supabase/migrations/20261005_add_col.sql"],
    needsEvan: ["Push the migration to production before merging"],
    smoke: { passed: 18, failed: 0, specs: 2 },
  });
  assert.match(md, /#1224 Live walkthrough: ask which job \(BSR-1227\)/);
  assert.match(md, /\[BSR-1227 Live Walkthrough\]\(https:\/\/linear\.app\/x\/BSR-1227\)/);
  assert.match(md, /supabase\/migrations\/20261005_add_col\.sql/);
  assert.match(md, /- \[ \] Push the migration to production before merging/);
  assert.match(md, /Create a merge commit/);
  assert.match(md, /18 passed, 0 failed/);
  assert.ok(md.trimEnd().endsWith(releaseMarker("a".repeat(40))));
});

test("markers and hasMarker", () => {
  assert.equal(releaseMarker("abc"), "<!-- release-agent dev=abc -->");
  assert.equal(postReleaseMarker("def"), "<!-- post-release main=def -->");
  assert.equal(hasMarker(["x", "y <!-- post-release main=def --> z"], postReleaseMarker("def")), true);
  assert.equal(hasMarker(["x"], postReleaseMarker("def")), false);
});
