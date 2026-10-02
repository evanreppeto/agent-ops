import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, buildSlackLine } from "../lib/report.mjs";

const SHA = "abc1234def0123456789abcdef0123456789abcd";

const base = {
  ticketId: "BSR-123",
  appName: "BSR Manager App",
  mergeSha: SHA,
  prUrl: "https://github.com/evanreppeto/clone-BS-migration/pull/1",
  devUrl: "https://dev.bigshouldersmanager.com",
  summary: "Schedule page shows the new crew filter.",
  plan: ["Open schedule", "Filter by crew"],
  steps: [
    { title: "Schedule loads", imageUrl: "https://uploads.linear.app/a.png" },
    { title: "Filter applied", note: "Only Crew A shown" },
  ],
  consoleErrors: [],
};

test("pass report has verdict header, plan, steps with images, and marker last", () => {
  const md = buildReport({ ...base, verdict: "pass" });
  assert.match(md, /^## ✅ QA passed — BSR-123/);
  assert.match(md, /Commit:\*\* `abc1234`/);
  assert.match(md, /1\. Open schedule/);
  assert.match(md, /!\[Schedule loads\]\(https:\/\/uploads\.linear\.app\/a\.png\)/);
  assert.match(md, /Only Crew A shown/);
  assert.match(md, /Console errors:\*\* none/);
  assert.ok(md.endsWith(`\n_qa-agent sha=${SHA} verdict=pass_`), md);
});

test("fail report lists console errors", () => {
  const md = buildReport({ ...base, verdict: "fail", consoleErrors: ["TypeError: x is undefined"] });
  assert.match(md, /^## ❌ QA failed — BSR-123/);
  assert.match(md, /- `TypeError: x is undefined`/);
});

test("console errors: backticks become single quotes and newlines become spaces", () => {
  const md = buildReport({ ...base, verdict: "fail", consoleErrors: ["Bad `value`\n    at foo (a.js:1)\r\nnext"] });
  assert.ok(md.includes("- `Bad 'value'     at foo (a.js:1) next`"), md);
});

test("blocked report includes the reason", () => {
  const md = buildReport({ ...base, verdict: "blocked", steps: [], blockedReason: "Backend-only change" });
  assert.match(md, /^## ⚠️ QA couldn't test — BSR-123/);
  assert.match(md, /Backend-only change/);
});

test("plan, steps and consoleErrors default to empty when omitted (early-blocked ticket)", () => {
  const { plan, steps, consoleErrors, ...rest } = base;
  const md = buildReport({ ...rest, verdict: "blocked", blockedReason: "Backend-only change" });
  assert.doesNotMatch(md, /What I tested/);
  assert.doesNotMatch(md, /### Steps/);
  assert.match(md, /Console errors:\*\* none/);
  assert.ok(md.endsWith(`_qa-agent sha=${SHA} verdict=blocked_`));
});

test("specSource is included in a fenced js block before the marker", () => {
  const src = 'import { test } from "../fixtures.mjs";\ntest("x", async () => {});\n';
  const md = buildReport({ ...base, verdict: "pass", specSource: src });
  assert.match(md, /### Test source/);
  assert.ok(md.includes("```js\n" + src.trimEnd() + "\n```"), md);
  assert.ok(md.indexOf("### Test source") < md.indexOf("_qa-agent sha="));
  assert.ok(md.endsWith(`_qa-agent sha=${SHA} verdict=pass_`));
});

test("specSource containing backtick fences gets a longer fence", () => {
  const src = "const s = `a`;\n// ```\n// ````\n";
  const md = buildReport({ ...base, verdict: "fail", specSource: src });
  assert.ok(md.includes("`````js\n" + src.trimEnd() + "\n`````"), md);
});

test("no specSource means no test source section", () => {
  assert.doesNotMatch(buildReport({ ...base, verdict: "pass" }), /Test source/);
});

test("slack line is one line with emoji, id, title and link", () => {
  const line = buildSlackLine({ ticketId: "BSR-123", title: "Crew filter", verdict: "fail", ticketUrl: "https://linear.app/x/BSR-123", summary: "Filter does nothing" });
  assert.equal(line, "❌ *BSR-123* Crew filter — QA failed: Filter does nothing <https://linear.app/x/BSR-123|Open ticket>");
});

test("slack line escapes &, < and > in title and summary", () => {
  const line = buildSlackLine({ ticketId: "BSR-9", title: "A & B <!channel>", verdict: "pass", ticketUrl: "https://linear.app/x/BSR-9", summary: "<https://evil.example|click> & done" });
  assert.equal(line, "✅ *BSR-9* A &amp; B &lt;!channel&gt; — QA passed: &lt;https://evil.example|click&gt; &amp; done <https://linear.app/x/BSR-9|Open ticket>");
});
