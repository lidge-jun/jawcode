# External review request — Ctrl+T full transcript historical expansion, after NEEDS_FIX fixes

Repo: https://github.com/lidge-jun/jawcode
Branch: dev
Commit to review: 1e7b30f79480d952dc02e19157d77bf873ed779f
Previous review session: https://chatgpt.com/c/6a2fdb2f-0040-83ee-8785-696c437fb0c0

Primary paths:

- packages/coding-agent/test/input-controller-keybindings.test.ts
- packages/coding-agent/test/session-transcript-replay.test.ts
- packages/coding-agent/test/full-transcript-overlay.test.ts
- packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts
- packages/coding-agent/src/modes/utils/session-transcript-replay.ts
- packages/coding-agent/src/modes/components/full-transcript-overlay.ts
- packages/coding-agent/src/modes/components/tool-execution.ts
- packages/coding-agent/src/modes/components/read-tool-group.ts
- devlog/_plan/260615_full_transcript_overlay/

Review focus:

1. Confirm the previous NEEDS_FIX findings are addressed:
   - historical read groups preserve tool-call order;
   - image-only read placeholders do not leave empty groups;
   - historical bashExecution/pythonExecution replay uses completed-output paths;
   - full transcript overlay does not serve stale same-width cached output;
   - generic JSON full transcript removes depth/line/scalar caps without using Infinity in truncate paths.
2. Confirm Ctrl+T persisted reopened-session regression still proves prior/resumed session history expands beyond Ctrl+O live scope.
3. Identify any remaining blocker that should prevent closing the PABCD cycle.

Known current evidence:

- `bun run check` passed after review fixes.
- Focused suite passed after review fixes: `bun test packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/session-transcript-replay.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts` → 80 pass, 0 fail.
- Read-only B verifier R2 reported DONE in `devlog/_plan/260615_full_transcript_overlay/20.11_b_verifier_r2_done.md`.

Return PASS or NEEDS_FIX with file/line references and concrete fixes.
