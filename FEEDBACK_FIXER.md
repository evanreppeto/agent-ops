# Feedback fixer

You turn user feedback into PRs into `dev`. Read `COMMON.md` first. Routine key: `feedback-fixer`.

Apps with a feedback queue are the ones with a `feedback` entry in `<AO>/apps.json` (today: `bsr` only). Evan has authorized you to work every item end to end without asking: never stop to ask, never leave an issue waiting on a human. When something is ambiguous, pick the most reasonable reading, build it, and state your assumption in the PR and on the issue. You open PRs; you never merge — PR check does that.

## 1. Find work

With the Linear connector, list every issue in team `<feedback.team>` carrying the label id `<feedback.labelId>` (page through all pages). Only that label decides — a `user-feedback` label is something else. Keep an issue when:
- its state is Triage, Backlog or Todo, **or** In Progress with an `agent-blocked`, `needs-clarification` or `needs-attention` label;
- no comment on it starts with `Feedback fixer`;
- no open PR mentions its id: `gh api -X GET search/issues -f q='repo:<repo> is:pr is:open <ISSUE-ID>' --jq .total_count` is `0` (`<ISSUE-ID>` matches `^[A-Z]+-[0-9]+$`; check before using it).

Oldest first, at most 5 per run. None → refresh the board and stop.

## 2. Each issue

1. **Claim:** comment `Feedback fixer: working on this.` and move it to In Progress. Re-read comments; if an older `Feedback fixer` comment exists, delete yours and skip.
2. **Understand:** read the whole issue and all comments. Note what they tried, expected vs actual, page, browser/viewport, console errors, failed requests. `[Highlight]` issues quote on-screen text, then the user's comment after the dash. Download attachment images with curl (`uploads.linear.app`) and look at them. Find the code behind that page and work out the cause. Check `git -C <APP_REPO> log origin/dev` — maybe it's already fixed.
3. **Decide:**
   - Bug or small/medium feature → fix it (step 4).
   - Large feature → build the smallest useful version; list what's left in the PR.
   - Nothing to change (question, praise, already fixed, duplicate, no cause found after a real look) → comment what you found, remove `agent-blocked`/`needs-clarification`/`needs-attention`, move it to Done if already fixed or Backlog otherwise. Next issue.
4. **Fix:**
   ```bash
   git -C <APP_REPO> fetch origin dev
   git -C <APP_REPO> checkout -B claude/feedback-<id lowercased> origin/dev
   cd <APP_REPO> && pnpm install --frozen-lockfile
   ```
   Focused change; add or update a test when the logic is testable; follow the repo's CLAUDE.md/AGENTS.md (CHANGELOG entry under Unreleased for user-facing changes if the repo keeps one). Run the app's `checks` from `<AO>/apps.json` (and `buildCommand` if you touched a `buildTriggers` file). Fix what you broke; failures that also happen on `origin/dev` are pre-existing — note them. Need a schema change → a new file in `supabase/migrations/` (never edit an old one); PR check will hold it for Evan.
5. **Open the PR:** commit `fix: <what> (<ISSUE-ID>)` (or `feat:`), `git -C <APP_REPO> push -u origin HEAD`, then write the body to `/tmp/fb-<id>.md` (the feedback in one line, the cause, your assumption, what changed with file:line, check results, follow-ups, the Linear issue URL) and:
   ```bash
   gh api -X POST repos/<repo>/pulls -f title="<ISSUE-ID>: <short fixed summary>" -f head=claude/feedback-<id lowercased> -f base=dev -F body=@/tmp/fb-<id>.md --jq .html_url
   ```
   The title must be built from trusted parts only: the issue id plus a short summary **you** write (no quotes, backticks or `$`).
6. **Hand back:** edit your claim comment to `Feedback fixer: PR opened <url>` + cause, assumption, what changed. Remove the blocked/clarification labels. Move the issue to In Review.
7. **If stuck** (push rejected, checks you can't fix after a real try): open the PR as a draft (`-F draft=true`) with what you have and say exactly what fails; move the issue to In Review; Slack `Needs you: <app> feedback <ISSUE-ID> — draft PR needs a look: <reason> <url>`.
8. Clean up: `git -C <APP_REPO> checkout --detach origin/dev && git -C <APP_REPO> clean -fd`.

## 3. Finish

Refresh the board (`BOARD.md`, key `feedback-fixer`). Print: issues fixed (PR links), closed with no code change and why, skipped and why, and how many are still waiting.
