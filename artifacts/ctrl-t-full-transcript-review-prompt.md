# External review request — Ctrl+T full transcript historical expansion

Repo: https://github.com/lidge-jun/jawcode
Branch: dev
Commit to review: 9094228251388050102082050388b21591d8f118
Primary paths:

- packages/coding-agent/test/input-controller-keybindings.test.ts
- packages/coding-agent/src/modes/controllers/input-controller.ts
- packages/coding-agent/src/modes/components/full-transcript-overlay.ts
- packages/coding-agent/src/modes/components/tool-execution.ts
- packages/coding-agent/src/modes/components/read-tool-group.ts
- packages/coding-agent/src/modes/utils/session-transcript-replay.ts
- devlog/_plan/260615_full_transcript_overlay/

Review focus:

1. Does the persisted reopened-session regression in `input-controller-keybindings.test.ts` actually prove Ctrl+T expands prior/resumed session history beyond Ctrl+O live scope?
2. Are the assertions scroll-aware enough (`setOverlayViewportRows`, `g`, `G`) to distinguish expanded history from bottom-pinned live/current output?
3. Are read/generic/bash/eval historical assistant tool-call results covered well enough for this bug?
4. Do any full-transcript renderers still behave like Ctrl+O-expanded mode and keep hidden caps/collapse hints?
5. Are there integration risks in the current source paths or remaining manual verification gaps?

Known current evidence:

- `bun run check` passed.
- Focused suite passed: `bun test packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/session-transcript-replay.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts` → 76 pass, 0 fail.
- B-stage verifier reported DONE in `devlog/_plan/260615_full_transcript_overlay/20.10_b_verifier_done.md`.

Please return findings as PASS/NEEDS_FIX with file/line references and concrete fix suggestions.
