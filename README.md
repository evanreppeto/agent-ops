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
3. **QA logins**:
   - BSR dev: a user with admin role on the dev database.
   - Arc dev: a user who is a member of the **test workspace only**, with two-step **off**. Use an email you don't mind receiving "new sign-in" alerts on.
   - In `apps.json`, set `arc.testWorkspace` to the test workspace's exact name as shown in Arc's workspace switcher. Until it's set, the QA agent marks every Arc ticket blocked.
4. **Cloud environment** (claude.ai/code → environments → new "agent-ops"):
   - Network: Custom — allow `dev.bigshouldersmanager.com`, `dev.arc-studio.ai`, `uploads.linear.app`, `storage.googleapis.com`, plus defaults.
   - Setup script: `bash agent-ops/scripts/cloud-setup.sh`
   - Secrets: `BSR_QA_EMAIL`, `BSR_QA_PASSWORD`, `ARC_QA_EMAIL`, `ARC_QA_PASSWORD` — enter them yourself in the environment settings.
5. **Local check**: put the same four vars in `agent-ops/.env`, then run:

```bash
set -a && source .env && set +a && npm run qa:check
```

Expected: 3 tests pass and screenshots appear under `test-results/`.
