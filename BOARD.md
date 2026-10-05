# Refresh the PR board

The board is GitHub issue `evanreppeto/agent-ops#1` (from `boardIssue` in `<AO>/pipeline.json`). Every run rewrites its whole body — never edit part of it; rebuilding everything is what keeps overlapping runs from corrupting it.

```bash
cd <AO> && node scripts/collect-prs.mjs > /tmp/prs.json; echo "collect-exit=$?"
node scripts/board.mjs /tmp/prs.json <routine-key> > /tmp/board.md; echo "board-exit=$?"
gh api -X PATCH repos/evanreppeto/agent-ops/issues/1 -F body=@/tmp/board.md > /dev/null; echo "gh-exit=$?"
```
`<routine-key>` is `pr-check`, `feedback-fixer`, `release` or `morning`.

Any non-zero exit → post once to Slack: `⚠️ Board update failed in <routine-key>: <first line of the error>`. Don't retry more than once. In DRY_RUN, run the first two commands, print `/tmp/board.md`, and skip the PATCH.
