import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FIX_ATTEMPTS, prCheckMarker, fixMarker, readPrCheck, fixAttempts,
  globToRegExp, sensitiveFiles, needsBuild,
} from "../lib/pr-check.mjs";

const A = "a".repeat(40);
const B = "b".repeat(40);

test("markers", () => {
  assert.equal(prCheckMarker(A), `<!-- pr-check sha=${A} -->`);
  assert.equal(fixMarker(A), `<!-- pr-fix sha=${A} -->`);
  assert.equal(MAX_FIX_ATTEMPTS, 3);
});

test("readPrCheck: no comment for this sha", () => {
  assert.deepEqual(readPrCheck([`${prCheckMarker(B)}\n## PR check — PASS`], A), { state: "none", reason: null });
});

test("readPrCheck: claim only = running", () => {
  assert.deepEqual(readPrCheck([`${prCheckMarker(A)}\nPR check running for aaaaaaa…`], A), { state: "running", reason: null });
});

test("readPrCheck: pass with not-merged reason", () => {
  const body = `${prCheckMarker(A)}\n## PR check — PASS\n| x | y |\nNot auto-merged: draft — mark it ready to merge`;
  assert.deepEqual(readPrCheck([body], A), { state: "pass", reason: "draft — mark it ready to merge" });
});

test("readPrCheck: Stuck line wins over Not auto-merged", () => {
  const body = `${prCheckMarker(A)}\n## PR check — PASS\nNot auto-merged: touches auth\nStuck: touches src/lib/auth/session.ts`;
  assert.equal(readPrCheck([body], A).reason, "touches src/lib/auth/session.ts");
});

test("readPrCheck: comments written with the old wording still give their reason", () => {
  const body = `${prCheckMarker(A)}\n## PR check — FAIL\n${"Needs" + " you"}: still failing after 3 fix attempts`; // the old wording, built so a grep for it finds nothing
  assert.equal(readPrCheck([body], A).reason, "still failing after 3 fix attempts");
});

test("readPrCheck: fail", () => {
  assert.equal(readPrCheck([`${prCheckMarker(A)}\n## PR check — FAIL\n`], A).state, "fail");
});

test("readPrCheck: oldest comment for the sha wins", () => {
  const older = `${prCheckMarker(A)}\n## PR check — FAIL`;
  const newer = `${prCheckMarker(A)}\nPR check running…`;
  assert.equal(readPrCheck([older, newer], A).state, "fail");
});

test("fixAttempts counts pr-fix markers across comments", () => {
  assert.equal(fixAttempts([`${fixMarker(A)} tried`, "hello", `${fixMarker(B)}`]), 2);
  assert.equal(fixAttempts([]), 0);
});

test("globToRegExp", () => {
  const route = globToRegExp("**/route.ts");
  assert.ok(route.test("route.ts"));
  assert.ok(route.test("src/app/api/x/route.ts"));
  assert.ok(!route.test("src/app/api/x/route.tsx"));
  const auth = globToRegExp("src/lib/auth/**");
  assert.ok(auth.test("src/lib/auth/session.ts"));
  assert.ok(auth.test("src/lib/auth/a/b.ts"));
  assert.ok(!auth.test("src/lib/authz.ts"));
  assert.ok(globToRegExp("next.config.*").test("next.config.ts"));
  assert.ok(!globToRegExp("next.config.*").test("a/next.config.ts"));
  assert.ok(globToRegExp("**/*billing*").test("src/app/(app)/settings/billing-actions.ts"));
  assert.ok(globToRegExp("**/*billing*/**").test("src/lib/billing/stripe.ts"));
  assert.ok(globToRegExp("**/*quickbooks*").test("app/actions/QuickBooks.ts"));
  assert.ok(globToRegExp("lib/payroll-period*").test("lib/payroll-period-utils.ts"));
});

test("sensitiveFiles and needsBuild", () => {
  const files = ["src/lib/auth/session.ts", "src/app/v3/page.tsx", "supabase/migrations/2026_x.sql"];
  assert.deepEqual(sensitiveFiles(files, ["src/lib/auth/**", "supabase/migrations/**"]), ["src/lib/auth/session.ts", "supabase/migrations/2026_x.sql"]);
  assert.deepEqual(sensitiveFiles(["README.md"], ["src/lib/auth/**"]), []);
  assert.equal(needsBuild(["src/app/api/v1/x/route.ts"], ["**/route.ts"]), true);
  assert.equal(needsBuild(["src/app/v3/page.tsx"], ["**/route.ts", "package.json"]), false);
});
