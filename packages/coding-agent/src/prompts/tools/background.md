Manage background work rows created by existing launch tools.

Launch stays with the existing tool:
- Use `task` for detached subagents.
- Use `bash` async/background behavior for long-running shell work.
- Use `monitor` for streaming monitor jobs.

Use this tool to inspect and manage those rows:
- `op: "list"` — enumerate current background rows before claiming background state.
- `op: "detail"` — inspect kind, status, attention, timing, previews, and verified output refs when available.
- `op: "follow"` — read retained output and preserve `nextOffset` when repeatedly following a row.
- `op: "cancel"` — cancel only when the user asks or when work is clearly obsolete or unsafe.
- `op: "settings"` — read background-related settings/keybindings only; this tool never mutates settings.

Long-running work should be background-launched when it can proceed independently while the user or agent continues other work. Keep work foreground when it needs interactive input, immediate output, or a user decision.

The TUI footer/panel rows (`bg … · ctrl+j`) and this tool's rows are two views over the same canonical background work. Do not claim a footer/background state from memory; call `list`, `detail`, or `follow` when accuracy matters.

Keep progress commentary concise and factual: report observed state, current focus, concrete output, or real blockers. Avoid empty roadmap text.
