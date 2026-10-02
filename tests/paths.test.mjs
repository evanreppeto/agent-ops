import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

test("auth and results dirs resolve from the repo root regardless of cwd", () => {
  const out = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", `import * as p from ${JSON.stringify(join(ROOT, "lib/paths.mjs"))}; console.log(JSON.stringify({ a: p.AUTH_DIR, r: p.RESULTS_DIR, f: p.authFile("bsr") }))`],
    { cwd: tmpdir(), encoding: "utf8" },
  );
  const { a, r, f } = JSON.parse(out);
  assert.ok(isAbsolute(a) && isAbsolute(r));
  assert.equal(a, join(ROOT, ".auth"));
  assert.equal(r, join(ROOT, "test-results"));
  assert.equal(f, join(ROOT, ".auth", "bsr.json"));
});
