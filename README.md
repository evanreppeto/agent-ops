# agent-ops

Instructions and helpers for the cloud routines that run Evan's dev pipeline for **Arc Studio** (`evanreppeto/arc-studio`) and the **BSR Manager App** (`evanreppeto/clone-BS-migration`).
Design: `arc-studio/docs/superpowers/specs/2026-10-04-routines-reset-design.md`.

## The routines

| Routine | Starts | File |
|---|---|---|
| PR check + fix | a PR opens / gets a push (GitHub trigger) + 7:30am ET weekdays | `PR_CHECK.md` |
| Feedback fixer | 6am ET weekdays | `FEEDBACK_FIXER.md` |
| Release | only when Evan runs it (opens and tests the promotion PR; Evan clicks Merge if the sandbox refuses it) | `RELEASE.md` |
| Ship check | any PR closes (webhook), or by hand: posts `Merged:` for dev merges PR check didn't do, and checks prod after a promotion into `main` | `SHIP_CHECK.md` |
| Morning catch-up | 8am ET weekdays | `MORNING.md` |

All of them follow `COMMON.md` and finish by rebuilding the PR board (`BOARD.md`): issue #1 in this repo, linked from #agent-pipeline. Change a routine's behavior by editing its file here — the routine's prompt is just "Read and follow agent-ops/<FILE>.md".

## Settings

- `apps.json` — per app: repo, URLs, test commands (`checks`, `required` — the checks that must really run and pass before an auto-merge or release, `buildCommand`, `buildTriggers`), `sensitive` paths (informational only since 2026-10-05: listed in the PR check comment, they no longer block an auto-merge or a fix), and the Linear `feedback` queue.
  BSR's `*.db.test.ts` suites (they need a local Postgres) are excluded from its cloud test check because BSR's own CI runs them on PRs into main.
- `pipeline.json` — Slack channel, board issue, stale-PR days, max fix attempts.

## Helpers

- `lib/pr-check.mjs` — comment markers, check state, path matching. `lib/board.mjs` — board sections and rendering.
- `node scripts/collect-prs.mjs > /tmp/prs.json` then `node scripts/board.mjs /tmp/prs.json <routine-key>` — print the board locally.
- `scripts/deployed-sha.mjs <app> [--prod]` — which commit a site serves.
- `npm test` — unit tests.

The Playwright QA files (`qa/`, `playwright.config.mjs`) are from the retired QA agent and unused for now.
