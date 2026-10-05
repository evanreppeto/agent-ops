# PR check + fix

You check open PRs in both apps, fix the ones that fail, and squash-merge the ones that pass into `dev`. Read `COMMON.md` first and follow it. Routine key: `pr-check`.

You run when a PR is opened, pushed, reopened or marked ready — but don't rely on which PR fired you: always scan every open PR.

## 1. Find work

```bash
cd <AO> && node scripts/collect-prs.mjs > /tmp/prs.json; echo "collect-exit=$?"
cat > /tmp/candidates.mjs <<'EOF'
import { readFileSync } from "node:fs";
import { readPrCheck } from "<AO>/lib/pr-check.mjs";
const data = JSON.parse(readFileSync("/tmp/prs.json", "utf8"));
const PAUSE = ["hold", "do-not-merge", "wip", "needs-human"];
for (const app of data.apps) for (const pr of app.open) {
  if (pr.base !== "dev" || pr.labels.some((l) => PAUSE.includes(l)) || /^wip\b/i.test(pr.title)) continue;
  const c = readPrCheck(pr.comments, pr.headSha);
  if (c.state === "none") console.log(`${app.key} ${pr.number} ${pr.headSha} check`);
  else if (c.state === "pass" && !pr.draft && /^draft\b/.test(c.reason ?? "")) console.log(`${app.key} ${pr.number} ${pr.headSha} merge-only`);
}
EOF
node /tmp/candidates.mjs
```
(Replace `<AO>` inside the heredoc with the real path before running.) Each line is `<app> <number> <sha> <job>`. Handle at most **3** lines per run, oldest PR number first. No lines → refresh the board and stop.

`merge-only` = it already passed while it was a draft and has since been marked ready: skip to §5 (merge) for it.

## 2. Claim

Write `<!-- pr-check sha=<SHA> -->` + newline + `PR check running for <first 7 of SHA>…` to `/tmp/claim-<n>.md`, then:
```bash
gh api -X POST repos/<repo>/issues/<n>/comments -F body=@/tmp/claim-<n>.md --jq .id > /tmp/claim-<n>.id; echo "gh-exit=$?"
gh api --paginate repos/<repo>/issues/<n>/comments --jq '.[] | select(.body | contains("<!-- pr-check sha=<SHA> -->")) | .id' | head -1
```
If the first id printed isn't yours, another run got there first: delete yours (`gh api -X DELETE repos/<repo>/issues/comments/<your id>`) and skip this PR. You'll **edit** your claim comment with the result (`gh api -X PATCH repos/<repo>/issues/comments/<id> -F body=@<file>`); never post a second result comment for the same SHA.

## 3. Check

```bash
gh api repos/<repo>/pulls/<n> > /tmp/pr-<n>.json; echo "gh-exit=$?"
node -e 'const p=require("/tmp/pr-<n>.json"); require("fs").writeFileSync("/tmp/pr-<n>-ref.txt", p.head.ref); console.log(p.head.repo.full_name===p.base.repo.full_name ? "same-repo" : "fork", p.mergeable_state)'
git -C <APP_REPO> fetch origin dev "+refs/pull/<n>/head:refs/remotes/pr/<n>"
git -C <APP_REPO> checkout --detach <SHA> && git -C <APP_REPO> clean -fdx -e node_modules
git -C <APP_REPO> diff --name-only origin/dev...<SHA> > /tmp/pr-<n>-files.txt
cd <APP_REPO> && pnpm install --frozen-lockfile > /tmp/pr-<n>-install.log 2>&1; echo "install-exit=$?"
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { getApp } from "<AO>/lib/config.mjs";
import { sensitiveFiles, needsBuild } from "<AO>/lib/pr-check.mjs";
const app = getApp("<app>");
const files = readFileSync("/tmp/pr-<n>-files.txt", "utf8").split("\n").filter(Boolean);
console.log("SENSITIVE:", JSON.stringify(sensitiveFiles(files, app.sensitive)));
console.log("BUILD:", needsBuild(files, app.buildTriggers) ? app.buildCommand : "no");
app.checks.forEach((c, i) => console.log(`CHECK ${i}: ${c}`));'
```
A `fork` PR → don't run anything; finish with verdict FAIL and `Needs you: PR from a fork — check it by hand`.

Run each `CHECK` command, and the `BUILD` command if it isn't `no`, from `<APP_REPO>`: `<cmd> > /tmp/pr-<n>-check-<i>.log 2>&1; echo "exit=$?"`. For lint, only errors count. A command that fails because the sandbox lacks an env var, secret or network service is `could not run (env)`, not a failure.

**Base check** for each failing command: run it once on `origin/dev` in a worktree (`git -C <APP_REPO> worktree add /tmp/base-<app> origin/dev` once per app per run, `pnpm install --frozen-lockfile` there). Fails the same way on dev → mark it `fails on dev too` and don't count it against the PR.

**Review** the diff (`git -C <APP_REPO> diff origin/dev...<SHA>`) for real bugs only: wrong behavior, data loss, security holes, broken flows, new uses of an admin/service-role database client. No style notes.

Verdict: **FAIL** if a check fails that doesn't also fail on dev, or the review found a real bug, or `mergeable_state` is `dirty` (conflicts with dev). Otherwise **PASS**.

## 4. Fix (FAIL only)

Count earlier attempts: `node -e` with `fixAttempts` from `<AO>/lib/pr-check.mjs` over the PR's comment bodies (save them with `gh api --paginate repos/<repo>/issues/<n>/comments --jq '[.[].body]' > /tmp/pr-<n>-comments.json`). At `MAX_FIX_ATTEMPTS` (3) or more → don't fix: go to §6 with `Needs you: still failing after 3 fix attempts`.

Otherwise, on a local branch at `<SHA>` (`git -C <APP_REPO> checkout -B fix-<n> <SHA>`):
- **Conflict with dev:** `git merge --no-ff origin/dev`. Resolve only mechanical conflicts (both sides added different lines → keep both; `pnpm-lock.yaml` → take dev's, then `pnpm install`). Any real disagreement → `git merge --abort`, go to §6 with `Needs you: real merge conflict in <files>`.
- **Failing checks / bugs:** make the smallest change that fixes them, in the spirit of the PR. Never delete or weaken a test to make it pass.
- If your fix would touch a file matching the app's `sensitive` list → don't push; go to §6 with `Needs you: the fix needs a change in <file>`.

Commit (`fix: make PR #<n> pass checks (<what>)`) and get the new SHA (`git rev-parse HEAD` → `<NEW>`). Before pushing, post the fix comment (`<!-- pr-fix sha=<NEW> -->` + newline + what failed, what you changed with file:line) and a claim comment for `<NEW>` (§2 format) so a run fired by your own push skips it. Then:
```bash
git -C <APP_REPO> push origin "HEAD:refs/heads/$(cat /tmp/pr-<n>-ref.txt)"; echo "push-exit=$?"
```
Push rejected → stop on this PR, edit your claim to say someone pushed meanwhile.

Edit the old SHA's claim comment to its FAIL result (§6 format) plus `Fixed in <NEW>.`, then go back to §3 with `<SHA>` = `<NEW>` and your new claim. Each pass through §4 is one attempt.

## 5. Merge (PASS only)

Not merged, with a `Not auto-merged:` line, when:
- `SENSITIVE` isn't empty → add label `needs-human`, add `Needs you: touches <files>` and send the Slack ping (`Needs you: <app> PR #<n> <title> — touches <area> <url>`);
- the PR is a draft → `Not auto-merged: draft — mark it ready to merge` (it merges when marked ready);
- the PR has gained a `hold`, `do-not-merge` or `wip` label → `Not auto-merged: on hold`.

Otherwise:
```bash
gh api -X PUT repos/<repo>/pulls/<n>/merge -f merge_method=squash -f sha=<SHA> > /tmp/merge-<n>.json; echo "gh-exit=$?"
```
`gh-exit=0` → add `Auto-merged into dev.` Otherwise → `Not auto-merged: <message from /tmp/merge-<n>.json>`.

Label: `gh api -X POST repos/<repo>/issues/<n>/labels -f 'labels[]=needs-human'` (create it first with `gh api -X POST repos/<repo>/labels -f name=needs-human -f color=D93F0B` if it doesn't exist).

## 6. Result comment

Edit your claim comment to:
```
<!-- pr-check sha=<SHA> -->
## PR check — PASS|FAIL
| Check | Result |
|---|---|
| <command> | pass / FAIL / fails on dev too / could not run (env) |
**Review:** 0–5 bullets with file:line, or "nothing found".
**Sensitive files:** list, or none.
Not auto-merged: <reason>      ← only when not merged
Needs you: <reason>            ← only when Evan must act
Auto-merged into dev.          ← only when merged
```
Every `Needs you:` line also gets the `needs-human` label and one Slack ping (COMMON.md format).

Clean up between PRs: `git -C <APP_REPO> checkout --detach origin/dev && git -C <APP_REPO> clean -fdx -e node_modules`.

## 7. Finish

Refresh the board (`BOARD.md`, key `pr-check`). Print: PRs checked with verdicts, fixed, merged, handed to Evan.
