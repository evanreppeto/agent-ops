import { test } from "node:test";
import assert from "node:assert/strict";
import { isHeld } from "../lib/hold.mjs";
import { waitingFromCommits, shippedFromMain } from "../lib/waiting.mjs";
import { getApp } from "../lib/config.mjs";

const HOLD = { label: "My Agent", titleMatch: "\\bmy agent\\b|personal[- ]agent", paths: ["lib/agent-pilot/**", "components/agent-pilot/**"] };

test("isHeld: by title, by path, and nothing without a hold", () => {
  assert.equal(isHeld(HOLD, { title: "My Agent: owner-only production mode [preview]" }), "My Agent");
  assert.equal(isHeld(HOLD, { title: "Give approved dev accounts private personal-agent trials" }), "My Agent");
  assert.equal(isHeld(HOLD, { title: "Refactor shell", files: ["app/layout.tsx", "lib/agent-pilot/access.ts"] }), "My Agent");
  assert.equal(isHeld(HOLD, { title: "Fit Live Walkthrough capture screen to phones", files: ["components/ai-assistant/atlas-workspace.tsx"] }), false);
  assert.equal(isHeld(undefined, { title: "My Agent: anything" }), false);
});

test("BSR hold holds My Agent and not the walkthrough work (2026-10-07)", () => {
  const hold = getApp("bsr").hold;
  assert.equal(isHeld(hold, { title: "My Agent: new design, plus the agent front door on the dev pilot (BSR-1382)" }), "My Agent");
  assert.equal(isHeld(hold, { title: "Fix Atlas Live rejecting dev seed jobs [preview]", files: ["lib/atlas/row-ids.ts"] }), false);
  assert.equal(isHeld(hold, { title: "Atlas on walkthroughs: quiet-stretch reminders", files: ["lib/atlas/walkthrough-agent.ts"] }), false);
});

test("waitingFromCommits: drops PRs already cherry-picked to main, marks held ones", () => {
  const A = "a".repeat(40), B = "b".repeat(40), TIP = "c".repeat(40), D = "d".repeat(40);
  const commits = [
    { sha: A, parents: [D, TIP], message: "Merge pull request #1276 from o/claude/walk\n\nFit capture screen" },
    { sha: B, parents: [D], message: "My Agent: owner-only production mode [preview] (#1270)" },
    { sha: D, parents: [A], message: "Fix Atlas Live rejecting dev seed jobs [preview] (#1271)" },
  ];
  const shipped = shippedFromMain([`Fit capture screen\n\n(cherry picked from commit ${TIP})`, `Fix Atlas (#1271)\n\n(cherry picked from commit ${D})`]);
  assert.deepEqual(waitingFromCommits(commits, "o/r", { shipped, hold: HOLD }), [
    { number: 1270, title: "My Agent: owner-only production mode [preview]", url: "https://github.com/o/r/pull/1270", held: true, heldLabel: "My Agent" },
  ]);
});

test("waitingFromCommits: hotfix cherry-picks to main count as shipped", () => {
  const commits = [
    { sha: "1".repeat(40), parents: ["0".repeat(40)], message: "Cover the time sync fix migration: uuid replica + release coverage entry (#1315)" },
    { sha: "2".repeat(40), parents: ["0".repeat(40)], message: "Fix QuickBooks time sync failing with \"uuid = text\" (#1311)" },
    { sha: "3".repeat(40), parents: ["0".repeat(40)], message: "Schedule: shorter To place (#1314)" },
  ];
  const shipped = shippedFromMain([
    "Hotfix to main: fix QuickBooks time sync\n\nCherry-pick of #1311 (already merged to dev) onto main.",
    "Cover the time sync fix migration: uuid replica + release coverage entry\n\nbody",
  ]);
  assert.deepEqual(waitingFromCommits(commits, "o/r", { shipped }).map((w) => w.number), [1314]);
});

test("waitingFromCommits: a revert PR cancels the PRs it reverts", () => {
  const commits = [
    "Calendar drag (#1284)",
    "Take My Agent off dev (revert #1266 and #1270) (#1275)",
    "My Agent: owner-only production mode (#1270)",
    "My Agent: new design (#1266)",
  ];
  assert.deepEqual(waitingFromCommits(commits, "o/r", { hold: HOLD }).map((w) => w.number), [1284]);
  // Only part of the set waiting (one already shipped) → keep the revert visible.
  assert.deepEqual(waitingFromCommits(commits.slice(0, 3), "o/r").map((w) => w.number), [1284, 1275, 1270]);
});

test("BSR also holds scheduling/calendar work (2026-10-09), not walkthrough or job-page work", () => {
  const hold = getApp("bsr").hold;
  assert.equal(isHeld(hold, { title: "Drag to move and resize visits on the schedule calendar" }), "Scheduling");
  assert.equal(isHeld(hold, { title: "Team: My hours (tap a day, Repeat every week) and Who's working" }), "Scheduling");
  assert.equal(isHeld(hold, { title: "Scheduling epic (BSR-1389): Assignments tab" }), "Scheduling");
  assert.equal(isHeld(hold, { title: "Refactor", files: ["components/schedule/workflow-preview/x.tsx"] }), "Scheduling");
  assert.equal(isHeld(hold, { title: "My Agent: new design" }), "My Agent");
  assert.equal(isHeld(hold, { title: "Live Walkthrough: Retake on auto photos", files: ["components/ai-assistant/atlas-workspace.tsx"] }), false);
  assert.equal(isHeld(hold, { title: "Bring the job workspace up on phones", files: ["components/projects/job-workspace.tsx"] }), false);
});
