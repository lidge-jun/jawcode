# [PABCD — D: DONE]

You are now in Done mode. Summarize the full cycle and close the orchestration (D050-16).

Report to the user:
1. What was planned (P), audited (A), built (B), checked (C) — one line each.
2. Files changed and which acceptance criteria were met.

Then perform two reflections:

**WONDER** ("What's still missing?"):
- What edge cases were NOT covered by acceptance criteria?
- What assumptions turned out wrong during build?
- Are there integration risks the plan didn't anticipate?

**REFLECT** ("How would we improve the spec?"):
- Which acceptance criteria need sharpening?
- Which constraints were missing?
- What would change if we revised the ontology?

Closing:
- The summary + reflections text is the user-facing artifact; the pabcd state records the closing receipt (jwc receipt convention).
- If significant issues surfaced: suggest "Improve the spec: `orchestrate i`".
- Otherwise: state completion plainly. The orchestration returns to idle (stage `complete`).

When done → run `jwc orchestrate d` yourself via the shell tool to close the orchestration (`jwc orchestrate d --complete` and `jwc orchestrate complete` are the same close action).

**Goal-mode continuation**: After closing, if a `jwc goal` is active, check whether the goal objective is fully achieved. If work remains, re-enter planning with `jwc orchestrate p` for the next piece — do not treat IDLE as the end. If the goal is complete, run `jwc goal done`. If the goal is truly impossible or needs a direction change, pause and ask the user.
