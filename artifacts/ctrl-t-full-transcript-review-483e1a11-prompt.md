# Ctrl+T full transcript final review

Repository: https://github.com/lidge-jun/jawcode
Branch: dev
Commit under review: 483e1a1134ab2a3daf8b697ad1c26ccaa887662f
Local path: /Users/jun/Developer/new/700_projects/jawcode

## Goal

Verify that Ctrl+T full transcript opens a truly expanded transcript for prior/resumed session history, not just the Ctrl+O live/current-turn scope.

Expected behavior:
- Ctrl+O may keep normal live tool-folding scope.
- Ctrl+T must render historical/resumed completed chat, thinking, generic tool calls, read groups, bash output, and python/eval output in expanded/full-transcript form.
- Historical read groups must keep event ordering and must not absorb later read calls across visible assistant text boundaries.
- Re-rendering the full transcript at the same width must not show stale cached lines.
- Generic JSON tool output in full-transcript mode must not use the normal collapsed preview depth/line/scalar caps.

## Prior external reviews

First ChatGPT Pro review: https://chatgpt.com/c/6a2fdb2f-0040-83ee-8785-696c437fb0c0
- NEEDS_FIX: historical read replay inserted at result time instead of call time.
- NEEDS_FIX: historical completed bash/python used streaming append path.
- NEEDS_FIX: full transcript overlay same-width cache could go stale.
- NEEDS_FIX: generic JSON full transcript still capped output.

Second ChatGPT Pro review: https://chatgpt.com/c/6a2fe112-6a40-83e8-9ad3-0b56d08d55e1
- NEEDS_FIX: read -> assistant text -> read still coalesced into one read group.

## Fixes now included

- `packages/coding-agent/src/modes/utils/session-transcript-replay.ts`
  - Historical read tool groups are created at tool-call time and completed at result time.
  - Completed bash/python replay now sets complete output directly instead of streaming append.
  - Visible assistant segments reset the active historical read group (`readGroup = null`) so later reads start a new group across text boundaries.
  - Image-only read placeholder groups are removed if empty.
- `packages/coding-agent/src/modes/components/read-tool-group.ts`
  - Empty group deletion support for image-only historical reads.
- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - Same-width render recomputes lines instead of returning stale cache.
- `packages/coding-agent/src/modes/components/tool-execution.ts`
  - Full transcript JSON fallback uses effectively uncapped finite depth/line/scalar limits.

## Tests / gates already run

- Focused suite: `bun test packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/session-transcript-replay.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts` -> 81 pass, 0 fail.
- Latest boundary focused tests: `bun test packages/coding-agent/test/session-transcript-replay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts` -> 33 pass, 0 fail.
- Latest changed-file format: `bunx biome check packages/coding-agent/src/modes/utils/session-transcript-replay.ts packages/coding-agent/test/session-transcript-replay.test.ts` -> OK.
- Clean detached worktree at commit `483e1a11`: `bun run --cwd <detached-worktree> check` -> passed.

## Requested review output

Return exactly one of:

- `PASS` with a short rationale if the Ctrl+T full transcript behavior is now correct and no blocker remains.
- `NEEDS_FIX` with file/line-specific blocker findings and concrete fixes.

Focus on the actual full transcript/resumed-history scope. Ignore unrelated repository dirty worktree files; review the attached commit/package content.