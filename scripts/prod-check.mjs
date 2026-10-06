#!/usr/bin/env node
// Plain-HTTP production page check. Prints PROD-CHECK OK, or PROD-CHECK FAILED plus one line per failure.
// Usage: node scripts/prod-check.mjs <bsr|arc>   (exit 0 = OK, 1 = failed)
// Uses curl rather than fetch so it goes through the cloud sandbox's HTTPS proxy. Each URL is tried
// up to 3 times, 10 s apart, because that proxy sometimes returns a stray 502.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getApp } from "../lib/config.mjs";
import { judgeResponse, prodCheckPaths } from "../lib/prod-check.mjs";

const ATTEMPTS = 3;
const WAIT_MS = 10_000;

function fetchOnce(url, outFile) {
  try {
    const out = execFileSync("curl", ["-sS", "-L", "--max-time", "30", "-o", outFile, "-w", "%{http_code}", url], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: Number.parseInt(out.trim(), 10) || 0, body: readFileSync(outFile, "utf8") };
  } catch {
    return { status: 0, body: "" };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = getApp(process.argv[2]);
const dir = mkdtempSync(join(tmpdir(), "prod-check-"));
const failures = [];
try {
  for (const path of prodCheckPaths(app)) {
    const url = new URL(path, app.prodUrl).toString();
    let verdict;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      verdict = judgeResponse(fetchOnce(url, join(dir, "body")));
      if (verdict.ok) break;
      if (attempt < ATTEMPTS) await sleep(WAIT_MS);
    }
    if (!verdict.ok) failures.push(`${path}: ${verdict.reason}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failures.length) {
  console.log("PROD-CHECK FAILED");
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
console.log("PROD-CHECK OK");
