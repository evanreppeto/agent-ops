#!/usr/bin/env node
// Prints the commit (or 12-char prefix) an app's dev or prod site is serving. Exit 1 if it can't tell.
// Usage: node scripts/deployed-sha.mjs <bsr|arc> [--prod]
// Uses curl rather than fetch so it goes through the cloud sandbox's HTTPS proxy.
import { execFileSync } from "node:child_process";
import { getApp } from "../lib/config.mjs";
import { extractDeployedSha } from "../lib/deploy-probe.mjs";

const app = getApp(process.argv[2]);
const isProd = process.argv[3] === "--prod";
const baseUrl = isProd ? app.prodUrl : app.devUrl;
const url = new URL(app.deployProbe.path, baseUrl).toString();
const body = execFileSync("curl", ["-fsSL", "--max-time", "30", url], { encoding: "utf8" });
const sha = extractDeployedSha(app, body);
if (!sha) {
  console.error(`No commit sha found at ${url}`);
  process.exit(1);
}
console.log(sha);
