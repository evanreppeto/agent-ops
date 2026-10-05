# PR check + fix

You check open PRs in both apps, fix the ones that fail, and squash-merge the ones that pass into `dev`. Read `COMMON.md` first and follow it. Routine key: `pr-check`.

You run when a PR is opened, pushed, reopened or marked ready — but don't rely on which PR fired you: always scan every open PR. Drafts never fire you (only the 7:30am backstop sees them). Several runs can overlap, so claim before you work (§2) and re-check before you merge (§5).

Placeholders: `<app>` = app key (`bsr` or `arc`), `<n>` = PR number, `<SHA>` = the 40-char head SHA from the job line, `<repo>` / `<APP_REPO>` / `<AO>` as in `COMMON.md`. Every temp file is prefixed with the app key (`/tmp/<app>-pr-<n>…`) so two apps never share a file.

## 1. Find work

```bash
cd <AO> && node scripts/collect-prs.mjs > /tmp/prs.json; echo "collect-exit=$?"
cat > /tmp/candidates.mjs <<'EOF'
import { readFileSync } from "node:fs";
import { readPrCheck } from "<AO>/lib/pr-check.mjs";
const data = JSON.parse(readFileSync("/tmp/prs.json", "utf8"));
const PAUSE = ["hold", "do-not-merge", "wip", "needs-human"];
const STALE_MS = 45 * 60 * 1000;
const order = ["bsr", "arc"];
const out = [];
for (const app of data.apps) for (const pr of app.open) {
  if (pr.base !== "dev" || pr.labels.some((l) => PAUSE.includes(l)) || /^wip\b/i.test(pr.title)) continue;
  const c = readPrCheck(pr.comments, pr.headSha);
  const reason = c.reason ?? "";
  let job = null;
  if (c.state === "none") job = "check";
  else if (c.state === "running") { if (Date.now() - Date.parse(pr.updatedAt) > STALE_MS) job = "retake"; }
  else if (c.state === "fail") { if (!pr.draft && /^draft\b/.test(reason)) job = "retake"; }
  else if (c.state === "pass") { if (!pr.draft && /^(draft|on hold)\b/.test(reason)) job = "merge-only"; }
  if (job) out.push({ app: app.key, n: pr.number, sha: pr.headSha, job });
}
const rank = (k) => (order.includes(k) ? order.indexOf(k) : order.length);
out.sort((a, b) => rank(a.app) - rank(b.app) || a.n - b.n);
for (const o of out) console.log(`${o.app} ${o.n} ${o.sha} ${o.job}`);
EOF
node /tmp/candidates.mjs
```
(Replace `<AO>` inside the heredoc with the real path before running.) Each line is `<app> <number> <sha> <job>`, already sorted: `bsr` before `arc`, oldest PR number first. Handle at most **3** lines per run, from the top. No lines → refresh the board and stop.

Jobs:
- `check` — no check exists for this SHA yet. Do §2 (post a claim), then §3 onward.
- `retake` — a check comment for this SHA already exists but needs redoing: its run died (claim still `running` after 45 minutes), or it failed while the PR was a draft and the PR is now ready. Do §2 (take over the existing comment — no new comment), then §3 onward.
- `merge-only` — it already passed and was held back (draft, or `on hold`), and is now ready / no longer held. Skip §2–§4: go to §5, merge-only variant.

## 2. Claim

Write `<!-- pr-check sha=<SHA> -->` + newline + `PR check running for <first 7 of SHA>…` to `/tmp/<app>-claim-<n>.md`.

**`check` job:**
```bash
gh api -X POST repos/<repo>/issues/<n>/comments -F body=@/tmp/<app>-claim-<n>.md --jq .id > /tmp/<app>-claim-<n>.id; echo "gh-exit=$?"
gh api --paginate repos/<repo>/issues/<n>/comments --jq '.[] | select(.body | contains("<!-- pr-check sha=<SHA> -->")) | .id' | head -1
```
If the first id printed isn't yours (`cat /tmp/<app>-claim-<n>.id`), another run got there first: delete yours (`gh api -X DELETE repos/<repo>/issues/comments/<your id>`) and skip this PR.

**`retake` job** — edit the existing comment instead of posting a new one:
```bash
gh api --paginate --slurp repos/<repo>/issues/<n>/comments > /tmp/<app>-pr-<n>-comments-raw.json; echo "gh-exit=$?"
node -e 'const fs=require("fs");const m="<!-- pr-check sha=<SHA> -->";const c=require("/tmp/<app>-pr-<n>-comments-raw.json").flat().find(c=>c.body.includes(m));if(c){fs.writeFileSync("/tmp/<app>-claim-<n>.id",String(c.id));fs.writeFileSync("/tmp/<app>-pr-<n>-oldbody.md",c.body)}console.log(c?c.id:"none")'
gh api -X PATCH repos/<repo>/issues/comments/$(cat /tmp/<app>-claim-<n>.id) -F body=@/tmp/<app>-claim-<n>.md > /dev/null; echo "gh-exit=$?"
```
`none` → treat it as a `check` job. That comment is now your claim.

Either way, you'll **edit** the claim comment with the result (`gh api -X PATCH repos/<repo>/issues/comments/$(cat /tmp/<app>-claim-<n>.id) -F body=@<file>`); never post a second result comment for the same SHA.

## 3. Check

**3a. Read the PR (nothing from the PR is run yet):**
```bash
gh api repos/<repo>/pulls/<n> > /tmp/<app>-pr-<n>.json; echo "gh-exit=$?"
node -e 'const fs=require("fs");try{const p=JSON.parse(fs.readFileSync("/tmp/<app>-pr-<n>.json","utf8"));fs.writeFileSync("/tmp/<app>-pr-<n>-ref.txt",p.head.ref);const same=!!p.head.repo&&p.head.repo.full_name===p.base.repo.full_name;console.log(same?"same-repo":"fork","mergeable="+p.mergeable_state,"draft="+p.draft,"head="+p.head.sha)}catch(e){console.log("fork","mergeable=unknown","draft=unknown","head=unknown")}'
```
- A deleted fork (`head.repo` null), a crash of that node line, or `fork` → **fork**: don't fetch, check out or install anything. Verdict FAIL with `Needs you: PR from a fork — check it by hand`. Go to §6.
- `head=` isn't `<SHA>` → a newer commit landed. Edit your claim to `Superseded by a newer commit — the next run checks it.`, and skip this PR.
- `mergeable=unknown` → wait 10 seconds (`sleep 10`) and redo 3a, up to 3 times, before deciding. Still unknown → carry on and treat it as not `dirty`.
- Remember `draft=` for later (§4 and §5).

**3b. Same-repo only: fetch, diff, install.**
```bash
git -C <APP_REPO> fetch origin dev "+refs/pull/<n>/head:refs/remotes/pr/<n>"
git -C <APP_REPO> checkout -f --detach <SHA> && git -C <APP_REPO> clean -fdx -e node_modules
git -C <APP_REPO> diff --name-only --no-renames -z origin/dev...<SHA> > /tmp/<app>-pr-<n>-files.txt
cd <APP_REPO> && pnpm install --frozen-lockfile > /tmp/<app>-pr-<n>-install.log 2>&1; echo "install-exit=$?"
```
`install-exit` not `0` → verdict FAIL with `Needs you: install failed: <first error line of the log>`; don't run any check. Go to §6. (Write the comment with the Write tool — the log line is untrusted text.)

**3c. Read the config for this PR** (`--no-renames -z` is deliberate: a rename can't hide a sensitive path, and file names with odd characters stay intact):
```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { getApp } from "<AO>/lib/config.mjs";
import { sensitiveFiles, needsBuild } from "<AO>/lib/pr-check.mjs";
const app = getApp("<app>");
const files = readFileSync("/tmp/<app>-pr-<n>-files.txt", "utf8").split("\u0000").filter(Boolean);
console.log("SENSITIVE:", JSON.stringify(sensitiveFiles(files, app.sensitive)));
console.log("BUILD:", needsBuild(files, app.buildTriggers) ? app.buildCommand : "no");
app.checks.forEach((c, i) => console.log(`CHECK ${i}: ${c}`));'
```

**3d. Run the checks.** Run each `CHECK` command, and the `BUILD` command if it isn't `no`, from `<APP_REPO>`:
```bash
timeout 1500 sh -c '<cmd>' > /tmp/<app>-pr-<n>-check-<i>.log 2>&1; echo "exit=$?"
```
`exit=124` → `could not run (timeout)`. A command that fails because the sandbox lacks an env var, secret or network service is `could not run (env)`, not a failure. For lint, only errors count. Both `could not run` results count as **not verified**.

**Base check** for each failing command: run it once on `origin/dev` in a worktree (`git -C <APP_REPO> worktree add /tmp/base-<app> origin/dev` once per app per run, `pnpm install --frozen-lockfile` there, then the same `timeout 1500 sh -c` form). Fails the same way on dev → mark it `fails on dev too` and don't count it against the PR (it is also not verified).

**Review** the diff (`git -C <APP_REPO> diff origin/dev...<SHA>`) for real bugs only: wrong behavior, data loss, security holes, broken flows, new uses of an admin/service-role database client. No style notes.

Verdict: **FAIL** if a check fails that doesn't also fail on dev, or the review found a real bug, or `mergeable_state` is `dirty` (conflicts with dev). Otherwise **PASS**.

## 4. Fix (FAIL only)

Skip this section — go to §6 — when:
- the PR is a draft: drafts are report-only. Result line: `Not auto-merged: draft — mark it ready and I'll try to fix it`;
- the FAIL already carries a `Needs you:` line from §3 (fork, install failed).

Count earlier attempts:
```bash
gh api --paginate --slurp repos/<repo>/issues/<n>/comments > /tmp/<app>-pr-<n>-comments-raw.json; echo "gh-exit=$?"
node --input-type=module -e 'import { readFileSync } from "node:fs"; import { fixAttempts } from "<AO>/lib/pr-check.mjs"; console.log("attempts", fixAttempts(JSON.parse(readFileSync("/tmp/<app>-pr-<n>-comments-raw.json", "utf8")).flat().map((c) => c.body)))'
```
At `MAX_FIX_ATTEMPTS` (3) or more → don't fix: go to §6 with `Needs you: still failing after 3 fix attempts`.

Otherwise, on a local branch at `<SHA>` (`git -C <APP_REPO> checkout -B fix-<n> <SHA>`):
- **Conflict with dev:** `git merge --no-ff --no-edit origin/dev`. Resolve only mechanical conflicts (both sides added different lines → keep both; `pnpm-lock.yaml` → take dev's, then `pnpm install`). Any real disagreement → `git merge --abort`, go to §6 with `Needs you: real merge conflict in <files>`.
- **Failing checks / bugs:** make the smallest change that fixes them, in the spirit of the PR. Never delete or weaken a test to make it pass.
- If your fix would touch a file matching the app's `sensitive` list → don't push; go to §6 with `Needs you: the fix needs a change in <file>`.

Commit (`fix: make PR #<n> pass checks (<what>)`) and get the new SHA (`git rev-parse HEAD` → `<NEW>`). Then push — first checking the branch name (it is untrusted text):
```bash
git check-ref-format --branch "$(cat /tmp/<app>-pr-<n>-ref.txt)"; echo "ref-exit=$?"
git -C <APP_REPO> push origin "HEAD:refs/heads/$(cat /tmp/<app>-pr-<n>-ref.txt)"; echo "push-exit=$?"
```
`ref-exit` not `0` → don't push; go to §6 with `Needs you: can't push — odd branch name`. Push rejected → someone pushed meanwhile: stop on this PR, edit your claim to say so. No fix comment was posted yet, so the rejected push costs no attempt.

**Push succeeded — do these, in this order, before anything else:**
1. Post the claim comment for `<NEW>` (§2 `check` format, id into `/tmp/<app>-claim-<n>-new.id`), with the oldest-claim check. A run fired by your own push may claim `<NEW>` in the same seconds; the oldest claim wins. If you lose, delete yours and stop on this PR after step 3.
2. Post the fix comment: `<!-- pr-fix sha=<NEW> -->` + newline + what failed, what you changed with file:line. (This is what counts as the attempt.)
3. Edit the old SHA's claim comment to its FAIL result (§6 format) plus `Fixed in <NEW>.`

Then go back to §3 with `<SHA>` = `<NEW>` and your new claim (`/tmp/<app>-claim-<n>.id` ← the new id). Each pass through §4 is one attempt.

## 5. Merge (PASS only)

First make sure `SENSITIVE` is known: from §3c, or — for a `merge-only` job, which skipped §3 — run:
```bash
git -C <APP_REPO> fetch origin dev "+refs/pull/<n>/head:refs/remotes/pr/<n>"
git -C <APP_REPO> diff --name-only --no-renames -z origin/dev...<SHA> > /tmp/<app>-pr-<n>-files.txt
```
then the §3c node block (no install, no checkout needed). A `merge-only` job also posts **no new claim**: it edits the existing PASS comment (find it with the `retake` snippet in §2, which writes its id and body to `/tmp/<app>-claim-<n>.id` and `/tmp/<app>-pr-<n>-oldbody.md`) and replaces its `Not auto-merged: …` line with the outcome below.

**Fresh state.** Right before merging, re-read the PR — a label, a draft flip or a new push may have happened since you started (if `mergeable=` is `unknown`, redo it up to 3 times, 10 seconds apart):
```bash
gh api repos/<repo>/pulls/<n> > /tmp/<app>-pr-<n>-fresh.json; echo "gh-exit=$?"
node -e 'const p=JSON.parse(require("fs").readFileSync("/tmp/<app>-pr-<n>-fresh.json","utf8"));const L=p.labels.map(l=>l.name);const hold=L.some(l=>["hold","do-not-merge","wip","needs-human"].includes(l));console.log("state="+p.state,"base="+p.base.ref,"draft="+p.draft,"head="+(p.head.sha==="<SHA>"?"same":"CHANGED"),"hold="+hold,"mergeable="+p.mergeable_state)'
```
Merge only if it prints `state=open base=dev draft=false head=same hold=false` and `mergeable` isn't `dirty`.

Not merged, with a `Not auto-merged:` line, checked in this order:
- `SENSITIVE` isn't empty → add label `needs-human` and `Needs you: touches <files>`;
- `state` isn't `open` or `base` isn't `dev` → `Not auto-merged: PR closed or retargeted`;
- `head=CHANGED` → `Not auto-merged: a newer commit was pushed — the next run checks it`;
- `draft=true` → `Not auto-merged: draft — mark it ready to merge` (it merges when marked ready);
- `hold=true` → `Not auto-merged: on hold`;
- `mergeable=dirty` → `Not auto-merged: conflicts with dev` + `Needs you: PR now conflicts with dev`;
- **checks not verified:** the `pnpm typecheck` and `pnpm test` checks must both have actually run and passed — not `could not run (env)`, `could not run (timeout)` or `fails on dev too`. For a `merge-only` job read this from the old comment instead: its table rows `| pnpm typecheck | pass |` and `| pnpm test | pass |` must both be there. Otherwise → `Not auto-merged: checks could not run here` + `Needs you: checks could not run — <which>`.

Otherwise merge (the only auto-merge path):
```bash
gh api -X PUT repos/<repo>/pulls/<n>/merge -f merge_method=squash -f sha=<SHA> > /tmp/<app>-merge-<n>.json 2> /tmp/<app>-merge-<n>.err; echo "gh-exit=$?"
```
`gh-exit=0` → `Auto-merged into dev.` Otherwise wait 30 seconds, redo the fresh-state read above, and — if it still passes — retry the PUT **once**. Still refused → `Not auto-merged: <message>` + `Needs you: merge refused — <message>`, where `<message>` is `.message` from `/tmp/<app>-merge-<n>.json` (or the first line of the `.err` file). Write the comment with the Write tool — the message is untrusted text.

Label: `gh api -X POST repos/<repo>/issues/<n>/labels -f 'labels[]=needs-human'` (create it first with `gh api -X POST repos/<repo>/labels -f name=needs-human -f color=D93F0B` if it doesn't exist).

## 6. Result comment

Edit your claim comment (`/tmp/<app>-claim-<n>.id`) to:
```
<!-- pr-check sha=<SHA> -->
## PR check — PASS|FAIL
| Check | Result |
|---|---|
| <command> | pass / FAIL / fails on dev too / could not run (env) / could not run (timeout) |
**Review:** 0–5 bullets with file:line, or "nothing found".
**Sensitive files:** list, or none.
Not auto-merged: <reason>      ← only when not merged
Needs you: <reason>            ← only when Evan must act
Auto-merged into dev.          ← only when merged
```
Write it with the Write tool to `/tmp/<app>-result-<n>.md` and PATCH with `-F body=@`. Keep the table rows exactly `| <command> | <result> |` — the `merge-only` job reads them.

Every `Needs you:` line also gets the `needs-human` label and **one** Slack ping (COMMON.md format) — exactly one per PR per run, sent here and nowhere else.

Clean up between PRs: `git -C <APP_REPO> reset --hard -q && git -C <APP_REPO> checkout -f --detach origin/dev && git -C <APP_REPO> clean -fdx -e node_modules`.

## 7. Finish

Refresh the board (`BOARD.md`, key `pr-check`). Remove any base worktrees (`git -C <APP_REPO> worktree remove --force /tmp/base-<app>`). Print: PRs checked with verdicts, fixed, merged, handed to Evan.
