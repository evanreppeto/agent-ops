import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, buildSlackLine } from "../lib/report.mjs";

const base = {
  ticketId: "BSR-123",
  appName: "BSR Manager App",
  mergeSha: "abc1234def",
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

test("pass report has verdict header, plan, steps with images, and marker", () => {
  const md = buildReport({ ...base, verdict: "pass" });
  assert.match(md, /^## ✅ QA passed — BSR-123/);
  assert.match(md, /1\. Open schedule/);
  assert.match(md, /!\[Schedule loads\]\(https:\/\/uploads\.linear\.app\/a\.png\)/);
  assert.match(md, /Only Crew A shown/);
  assert.match(md, /Console errors:\*\* none/);
  assert.match(md, /<!-- qa-agent sha=abc1234def verdict=pass -->$/);
});

test("fail report lists console errors", () => {
  const md = buildReport({ ...base, verdict: "fail", consoleErrors: ["TypeError: x is undefined"] });
  assert.match(md, /^## ❌ QA failed — BSR-123/);
  assert.match(md, /- `TypeError: x is undefined`/);
});

test("blocked report includes the reason", () => {
  const md = buildReport({ ...base, verdict: "blocked", steps: [], blockedReason: "Backend-only change" });
  assert.match(md, /^## ⚠️ QA couldn't test — BSR-123/);
  assert.match(md, /Backend-only change/);
});

test("slack line is one line with emoji, id, title and link", () => {
  const line = buildSlackLine({ ticketId: "BSR-123", title: "Crew filter", verdict: "fail", ticketUrl: "https://linear.app/x/BSR-123", summary: "Filter does nothing" });
  assert.equal(line, "❌ *BSR-123* Crew filter — QA failed: Filter does nothing <https://linear.app/x/BSR-123|Open ticket>");
});
