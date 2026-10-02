import { test } from "node:test";
import assert from "node:assert/strict";
import { ticketIds, carriedTicketIds, mentionedTicketIds, releaseTitle, buildReleaseBody, releaseMarker, postReleaseMarker, hasMarker, releaseTicketsLine, parseReleaseTickets, hasReleaseTickets, parseReleaseDevSha } from "../lib/release.mjs";

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

test("release body carries a machine-readable release-tickets line with exactly the release's tickets", () => {
  const md = buildReleaseBody({
    appName: "BSR Manager App", date: "2026-10-08", devSha: "b".repeat(40),
    prs: [{ number: 1, title: "x (mentions BSR-999)", tickets: ["BSR-5"] }],
    tickets: [{ id: "BSR-5", title: "Five", url: "https://linear.app/x/BSR-5" }, { id: "BSR-6", title: "Six", url: "https://linear.app/x/BSR-6" }],
    migrations: [], needsEvan: ["BSR-777 is Done without a QA pass — confirm"], smoke: { passed: 1, failed: 0, specs: 0 },
  });
  assert.match(md, /^<!-- release-tickets BSR-5 BSR-6 -->$/m);
  assert.deepEqual(parseReleaseTickets(md), ["BSR-5", "BSR-6"]);
  assert.ok(md.trimEnd().endsWith(releaseMarker("b".repeat(40))));
});

test("release body with no tickets still has an (empty) release-tickets line", () => {
  const md = buildReleaseBody({
    appName: "Arc Studio", date: "2026-10-08", devSha: "c".repeat(40), prs: [], tickets: [],
    migrations: [], needsEvan: [], smoke: { passed: 6, failed: 0, specs: 0 },
  });
  assert.match(md, /^<!-- release-tickets -->$/m);
  assert.equal(hasReleaseTickets(md), true);
  assert.deepEqual(parseReleaseTickets(md), []);
});

test("release-tickets line drops anything that is not a BSR id", () => {
  assert.equal(releaseTicketsLine(["BSR-1", "bsr-2", "BSR-3 -->", "x", "BSR-4"]), "<!-- release-tickets BSR-1 BSR-4 -->");
});

test("parseReleaseTickets: absent line → [] and hasReleaseTickets false", () => {
  assert.deepEqual(parseReleaseTickets("Fixes BSR-1 and BSR-2\n<!-- release-agent dev=abc -->"), []);
  assert.equal(hasReleaseTickets("Fixes BSR-1"), false);
  assert.deepEqual(parseReleaseTickets(undefined), []);
});

test("parseReleaseTickets ignores ids elsewhere in the text", () => {
  const text = "### Tickets\n- [BSR-9 Nine](u)\nHeld: BSR-10 qa-failed\n<!-- release-tickets BSR-11 -->\nBSR-12";
  assert.deepEqual(parseReleaseTickets(text), ["BSR-11"]);
});

test("parseReleaseTickets is CRLF-safe and uses the last valid line", () => {
  const text = "a\r\n<!-- release-tickets BSR-1 -->\r\nb\r\n<!-- release-tickets BSR-2 BSR-3 -->\r\n";
  assert.deepEqual(parseReleaseTickets(text), ["BSR-2", "BSR-3"]);
  assert.equal(hasReleaseTickets(text), true);
});

test("parseReleaseTickets rejects malformed lines (no partial or inline matches)", () => {
  assert.deepEqual(parseReleaseTickets("<!-- release-tickets BSR-1 rm -rf -->"), []);
  assert.deepEqual(parseReleaseTickets("text <!-- release-tickets BSR-1 --> inline"), []);
  assert.equal(hasReleaseTickets("text <!-- release-tickets BSR-1 --> inline"), false);
});

test("parseReleaseDevSha returns the last full release-agent sha, or null", () => {
  const a = "a".repeat(40), b = "b".repeat(40);
  assert.equal(parseReleaseDevSha(`x\r\n${releaseMarker(a)}\r\ny ${releaseMarker(b)}`), b);
  assert.equal(parseReleaseDevSha("<!-- release-agent dev=abc -->"), null);
  assert.equal(parseReleaseDevSha("nothing"), null);
  assert.equal(parseReleaseDevSha(undefined), null);
});

test("carriedTicketIds: ids in the PR title count", () => {
  assert.deepEqual(carriedTicketIds({ title: "BSR-12: fix calendar (bsr-7)", branch: "x", body: "" }), ["BSR-12", "BSR-7"]);
});

test("carriedTicketIds: ids in the head branch count", () => {
  assert.deepEqual(carriedTicketIds({ title: "Fix calendar", branch: "claude/bsr-12-x", body: null }), ["BSR-12"]);
});

test("carriedTicketIds: body ids right after a closing magic word count", () => {
  assert.deepEqual(carriedTicketIds({ title: "t", branch: "b", body: "Fixes BSR-7" }), ["BSR-7"]);
  assert.deepEqual(carriedTicketIds({ title: "t", branch: "b", body: "Some text.\n\nfixes: BSR-7." }), ["BSR-7"]);
  assert.deepEqual(carriedTicketIds({ title: "t", branch: "b", body: "**Closes** [BSR-8](https://linear.app/bsr/issue/BSR-8/slug)" }), ["BSR-8"]);
  for (const w of ["close", "closes", "closed", "fix", "fixed", "resolve", "resolves", "resolved", "complete", "completes", "completed", "implement", "implements", "implemented"]) {
    assert.deepEqual(carriedTicketIds({ title: "", branch: "", body: `${w} BSR-5` }), ["BSR-5"], w);
  }
});

test("carriedTicketIds: a list after one magic word carries every id in it", () => {
  assert.deepEqual(carriedTicketIds({ title: "", branch: "", body: "Fixes BSR-1, BSR-2 and BSR-3; also see BSR-4" }), ["BSR-1", "BSR-2", "BSR-3"]);
  assert.deepEqual(carriedTicketIds({ title: "", branch: "", body: "Resolves https://linear.app/bsr/issue/BSR-10/title, BSR-11" }), ["BSR-10", "BSR-11"]);
  assert.deepEqual(carriedTicketIds({ title: "", branch: "", body: "Fixes BSR-1/BSR-2 and closing BSR-6" }), ["BSR-1", "BSR-6"]);
});

test("carriedTicketIds: only the id right after the magic word counts", () => {
  assert.deepEqual(carriedTicketIds({ title: "", branch: "", body: "Closes #1234 BSR-9" }), []);
  assert.deepEqual(carriedTicketIds({ title: "", branch: "", body: "This fixes the bug from BSR-9" }), []);
});

test("carriedTicketIds: non-closing magic words and plain mentions do not carry", () => {
  for (const body of ["related to BSR-3", "Related to: BSR-3", "ref BSR-3", "Refs BSR-3", "references BSR-3", "Part of BSR-3", "contributes to BSR-3", "See BSR-3 for context", "BSR-3"]) {
    assert.deepEqual(carriedTicketIds({ title: "Fix x", branch: "claude/fix-x", body }), [], body);
  }
  assert.deepEqual(carriedTicketIds({ title: "", branch: "", body: "Fixes BSR-1, related to BSR-2" }), ["BSR-1"]);
});

test("carriedTicketIds: no false magic words inside other words", () => {
  assert.deepEqual(carriedTicketIds({ title: "", branch: "", body: "prefix BSR-1; unresolved BSR-2; disclosed BSR-3" }), []);
});

test("carriedTicketIds: CRLF body, unique ids in first-seen order, normalised case", () => {
  const body = "Summary\r\n\r\nFixes bsr-7\r\nCloses:\r\nBSR-12\r\nrelated to BSR-99\r\n";
  assert.deepEqual(carriedTicketIds({ title: "bsr-12 thing", branch: "claude/BSR-12-thing", body }), ["BSR-12", "BSR-7"]);
});

test("carriedTicketIds tolerates missing fields", () => {
  assert.deepEqual(carriedTicketIds({}), []);
  assert.deepEqual(carriedTicketIds(), []);
});

test("mentionedTicketIds: ids anywhere that are not carried", () => {
  const pr = { title: "BSR-1 fix", branch: "claude/bsr-2-x", body: "Fixes BSR-3\r\nrelated to BSR-4, see bsr-5. Also BSR-1." };
  assert.deepEqual(mentionedTicketIds(pr), ["BSR-4", "BSR-5"]);
  assert.deepEqual(mentionedTicketIds({}), []);
});

test("release body lists mentioned-only ids on one line, without the dash, outside release-tickets", () => {
  const md = buildReleaseBody({
    appName: "BSR Manager App", date: "2026-10-08", devSha: "d".repeat(40),
    prs: [{ number: 1, title: "x", tickets: ["BSR-5"] }],
    tickets: [{ id: "BSR-5", title: "Five", url: "https://linear.app/x/BSR-5" }],
    mentioned: ["BSR-1282", "BSR-5", "nope", "BSR-1300"],
    migrations: [], needsEvan: [], smoke: { passed: 1, failed: 0, specs: 0 },
  });
  assert.match(md, /^Also mentioned \(not part of this release\): BSR 1282, BSR 1300$/m);
  assert.doesNotMatch(md, /BSR-1282|BSR-1300/);
  assert.deepEqual(parseReleaseTickets(md), ["BSR-5"]);
});

test("release body has no mentioned line when nothing is only mentioned", () => {
  const md = buildReleaseBody({
    appName: "Arc Studio", date: "2026-10-08", devSha: "e".repeat(40), prs: [], tickets: [],
    migrations: [], needsEvan: [], smoke: { passed: 6, failed: 0, specs: 0 },
  });
  assert.doesNotMatch(md, /Also mentioned/);
});
