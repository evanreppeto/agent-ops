#!/usr/bin/env node
// Renders the PR board markdown from collect-prs.mjs output.
// Usage: node scripts/board.mjs /tmp/prs.json <pr-check|feedback-fixer|release|morning>
import { readFileSync } from "node:fs";
import { getPipeline } from "../lib/config.mjs";
import { buildBoard, renderBoard, ROUTINES } from "../lib/board.mjs";

const [file, by] = process.argv.slice(2);
if (!file || !ROUTINES.includes(by)) {
  console.error(`usage: board.mjs <prs.json> <${ROUTINES.join("|")}>`);
  process.exit(2);
}
const p = getPipeline();
const opts = { now: Date.now(), staleDays: p.staleDays, maxFixAttempts: p.maxFixAttempts, timezone: p.timezone, by };
process.stdout.write(`${renderBoard(buildBoard(JSON.parse(readFileSync(file, "utf8")), opts), opts)}\n`);
