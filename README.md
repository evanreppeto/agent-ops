# agent-ops

Shared brains for the dev-pipeline agents (spec: `clone-BS-migration/docs/superpowers/specs/2026-10-02-agent-dev-pipeline-design.md`).

- `QA_AGENT.md` — what the hourly QA routine does.
- `apps.json` — dev/prod URLs, viewports, login selectors, safety rules per app.
- `qa/<app>/<TICKET>.spec.mjs` — one regression test per ticket that passed QA.
- `npm test` — unit tests. `npm run qa:check` — prove logins work.

## One-time setup (Evan)

1. **Linear** (Settings → Teams → Big Shoulders Restoration → Workflow):
   - Add statuses **In QA** and **Ready to Release** (type: Started), in that order after In Review.
   - Under GitHub integration → "On PR merge": for target branch `dev`, set status **In QA** (so merges to dev don't jump to Done).
   - Label **qa-failed** (red) — Claude can create this one.
2. **Slack**: create channel `#agent-pipeline`. If you use a different name, set `SLACK_CHANNEL` in the cloud environment.
3. **QA logins** — one command creates both and saves them to `.env`:
   - BSR dev outbound: first confirm the dev deployment's Vercel env has no live Resend, Quo, or QuickBooks keys (remove them or use sandbox keys) — ordinary saves on dev can email/text real people.
   - Arc dev shares the **production** database, and prod background jobs (scheduled dispatch every minute, automations every 5 minutes) act on it. The test workspace (`arc.testWorkspace` = "Test Workspace") must have no connected email/SMS/social/webhook/CRM senders and no active automations.
   - Copy four values from Vercel (Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for BSR (**dev/Preview** values) and for Arc. Put them in `agent-ops/.setup.env` (git-ignored) as `BSR_DEV_SUPABASE_URL=`, `BSR_DEV_SERVICE_ROLE_KEY=`, `ARC_SUPABASE_URL=`, `ARC_SERVICE_ROLE_KEY=`, then run `node scripts/create-qa-users.mjs`. The script deletes `.setup.env` after a successful run.
   - It creates `evan.reppeto5928+bsrqa@gmail.com` (approved admin on BSR dev) and `evan.reppeto5928+arcqa@gmail.com` (admin of Test Workspace only, no two-step), gives each a random password, and writes them to `.env`. It refuses BSR's production database and any database that isn't Arc's. Re-running it resets the passwords.
4. **Cloud environment** (claude.ai/code → environments → new "agent-ops"):
   - Network: Custom — allow `dev.bigshouldersmanager.com`, `dev.arc-studio.ai`, `uploads.linear.app`, `storage.googleapis.com`, plus defaults. Also allow:
     - each app's Supabase host (BSR's browser login calls Supabase directly): the host part of `NEXT_PUBLIC_SUPABASE_URL` in each app's Vercel **dev/preview** env (e.g. `<project-ref>.supabase.co`);
     - any third-party hosts the pages load (fonts, Sentry, analytics).
     Then run the setup check in the cloud and read its output and `test-results/*/console-errors.json`: every `net::ERR_` console error names a blocked host. Add hosts until it's clean.
   - Setup script: `bash agent-ops/scripts/cloud-setup.sh`
   - Environment variables: copy the four `*_QA_*` lines from `.env` (`open -e .env`) into the environment settings yourself.
5. **Local check** (uses the `.env` from step 3):

```bash
set -a && source .env && set +a && npm run qa:check
```

Expected: 3 tests pass and screenshots appear under `test-results/`.

## First live run (Evan)

The QA agent skips tickets it already tested by finding a footer line like `_qa-agent sha=<40-char sha> verdict=pass_` in the ticket's comments. After the first real (non-DRY_RUN) QA comment is posted, read that comment back through Linear (API/MCP, not just the UI) and confirm the footer line is still there with the full sha. If Linear rewrote or dropped it, stop the routine — every ticket would be re-tested every hour.
