# Refresh the PR board

The board is GitHub issue `evanreppeto/agent-ops#1` (from `boardIssue` in `<AO>/pipeline.json`). Every run rewrites its whole body — never edit part of it; rebuilding everything is what keeps overlapping runs from corrupting it.

```bash
cd <AO> && node scripts/collect-prs.mjs > /tmp/prs.json; echo "collect-exit=$?"
node scripts/board.mjs /tmp/prs.json <routine-key> > /tmp/board.md; echo "board-exit=$?"
```

Run the PATCH below **only if** both `collect-exit` and `board-exit` printed `0` and `test -s /tmp/board.md` succeeds:

```bash
gh api -X PATCH repos/evanreppeto/agent-ops/issues/1 -F body=@/tmp/board.md > /dev/null; echo "gh-exit=$?"
```

`<routine-key>` is `pr-check`, `feedback-fixer`, `release` or `morning`.

If either check fails or `gh-exit` is not `0`, don't PATCH (or stop after the failed PATCH), and post once to Slack: `⚠️ Board update failed in <routine-key>: <first stderr line of the failed command>`. Retry the whole refresh at most once before posting. In DRY_RUN, run the first block, print `/tmp/board.md`, and skip the PATCH and the Slack post.
