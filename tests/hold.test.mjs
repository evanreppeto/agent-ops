import { test } from "node:test";
import assert from "node:assert/strict";
import { isHeld } from "../lib/hold.mjs";
import { waitingFromCommits, shippedFromMain } from "../lib/waiting.mjs";
import { getApp } from "../lib/config.mjs";

const HOLD = { label: "My Agent", titleMatch: "\\bmy agent\\b|personal[- ]agent", paths: ["lib/agent-pilot/**", "components/agent-pilot/**"] };

test("isHeld: by title, by path, and nothing without a hold", () => {
  assert.equal(isHeld(HOLD, { title: "My Agent: owner-only production mode [preview]" }), true);
  assert.equal(isHeld(HOLD, { title: "Give approved dev accounts private personal-agent trials" }), true);
  assert.equal(isHeld(HOLD, { title: "Refactor shell", files: ["app/layout.tsx", "lib/agent-pilot/access.ts"] }), true);
  assert.equal(isHeld(HOLD, { title: "Fit Live Walkthrough capture screen to phones", files: ["components/ai-assistant/atlas-workspace.tsx"] }), false);
  assert.equal(isHeld(undefined, { title: "My Agent: anything" }), false);
});

test("BSR hold holds My Agent and not the walkthrough work (2026-10-07)", () => {
  const hold = getApp("bsr").hold;
  assert.equal(isHeld(hold, { title: "My Agent: new design, plus the agent front door on the dev pilot (BSR-1382)" }), true);
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
    { number: 1270, title: "My Agent: owner-only production mode [preview]", url: "https://github.com/o/r/pull/1270", held: true },
  ]);
});
