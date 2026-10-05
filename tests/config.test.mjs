import { test } from "node:test";
import assert from "node:assert/strict";
import { listApps, getApp, appForRepo, getPipeline } from "../lib/config.mjs";

test("listApps returns both apps with their key", () => {
  const keys = listApps().map((a) => a.key).sort();
  assert.deepEqual(keys, ["arc", "bsr"]);
});

test("getApp returns config with dev url and viewports", () => {
  const bsr = getApp("bsr");
  assert.equal(bsr.devUrl, "https://dev.bigshouldersmanager.com");
  assert.equal(bsr.viewports.length, 2);
});

test("getApp throws on unknown key", () => {
  assert.throws(() => getApp("nope"), /Unknown app "nope"/);
});

test("appForRepo matches case-insensitively and returns null when unknown", () => {
  assert.equal(appForRepo("EvanReppeto/Arc-Studio").key, "arc");
  assert.equal(appForRepo("someone/else"), null);
});

test("every app has smoke routes and a console baseline list", () => {
  for (const app of listApps()) {
    assert.ok(Array.isArray(app.smokeRoutes) && app.smokeRoutes.length >= 4, `${app.key} smokeRoutes`);
    assert.ok(app.smokeRoutes.every((r) => r.startsWith("/")), `${app.key} routes are paths`);
    assert.ok(Array.isArray(app.consoleBaseline), `${app.key} consoleBaseline`);
  }
});

test("bsr console baseline matches the realtime websocket error on dev and on prod", async () => {
  const { withoutBaseline } = await import("../lib/console-baseline.mjs");
  const base = getApp("bsr").consoleBaseline;
  const dev = "WebSocket connection to 'wss://jbarlcajqpbzbhvbxaci.supabase.co/realtime/v1/websocket?apikey=x' failed";
  const prod = "WebSocket connection to 'wss://tesgvrcgcyadownahujh.supabase.co/realtime/v1/websocket?apikey=x' failed";
  assert.deepEqual(withoutBaseline([dev, prod, "TypeError: boom"], base), ["TypeError: boom"]);
});

test("every app has the PR-check settings", () => {
  for (const app of listApps()) {
    assert.match(app.short, /^[A-Za-z]+$/, `${app.key} short`);
    assert.ok(app.checks.length >= 3 && app.checks.every((c) => c.startsWith("pnpm ")), `${app.key} checks`);
    assert.match(app.buildCommand, /pnpm build$/, `${app.key} buildCommand`);
    assert.ok(app.buildTriggers.includes("**/route.ts"), `${app.key} buildTriggers`);
    assert.ok(app.sensitive.includes("supabase/migrations/**"), `${app.key} sensitive has migrations`);
    assert.ok(app.sensitive.includes(".github/workflows/**"), `${app.key} sensitive has workflows`);
  }
});

test("every app's required checks are among its checks", () => {
  for (const app of listApps()) {
    assert.ok(Array.isArray(app.required) && app.required.length >= 2, `${app.key} required`);
    for (const r of app.required) assert.ok(app.checks.includes(r), `${app.key} required "${r}" is not in checks`);
  }
});

test("bsr's test check skips the DB suites", () => {
  assert.ok(getApp("bsr").required.some((c) => c.includes('--exclude "**/*.db.test.ts"')));
});

test("bsr has a feedback queue, arc does not yet", () => {
  assert.deepEqual(getApp("bsr").feedback, { team: "BSR", labelId: "de5bbac3-396c-4a26-bb4e-91d9ba0d60a7" });
  assert.equal(getApp("arc").feedback, undefined);
});

test("pipeline settings", () => {
  const p = getPipeline();
  assert.equal(p.slackChannel, "C0C6A1G03JS");
  assert.deepEqual(p.boardIssue, { repo: "evanreppeto/agent-ops", number: 1 });
  assert.equal(p.staleDays, 2);
  assert.equal(p.maxFixAttempts, 3);
  assert.equal(p.timezone, "America/New_York");
});
