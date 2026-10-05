# Morning catch-up

One Slack message before Evan starts work. Read `COMMON.md` first (you can skip `npm test` if `npm ci` fails only on Playwright). Routine key: `morning`.

1. Refresh the board (`BOARD.md`, key `morning`) and read `/tmp/board.md` — it's your source for PR status.
2. Per app: `gh api repos/<repo>/compare/main...dev --jq .ahead_by` → commits waiting to ship. Also the date of the newest commit on main: `gh api "repos/<repo>/commits?sha=main&per_page=1" --jq '.[0].commit.committer.date'`.
3. Feedback queue: for each app with `feedback` in `apps.json`, count Linear issues with that label in Triage/Backlog/Todo.
4. Pick **one** suggestion, first match wins:
   1. the oldest "Needs you" item;
   2. the oldest "Stuck" PR;
   3. an app with commits waiting on dev and nothing shipped for 3+ days → "ship <app> (<N> commits waiting)";
   4. the oldest Feedback issue;
   5. "Nothing urgent — pick from the roadmap."
5. Post to `C0C6A1G03JS` (not in DRY_RUN):

```
☀️ Morning — <weekday, Mon D>
• Needs you: <count> <list "Arc #12 — reason" items, max 5, or "nothing">
• Failing / being fixed: <count>
• Stuck > 2 days: <count>
• Merged in the last 24h: <count>
• Waiting to ship: Arc <N> commits · BSR <N> commits
• Feedback queue: <N>
Next: <suggestion>
Board: https://github.com/evanreppeto/agent-ops/issues/1
```

6. Print the same message as the summary.
