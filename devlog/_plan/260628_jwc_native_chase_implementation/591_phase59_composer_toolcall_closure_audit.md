# 591 Phase 59 audit — 10.051 composer/toolcall integrity closure (independent)

> Independent read-only sub-agent audit of plan `590`. Verdict: **closeable:true**.

## Confirmed (file:line)
- A closed: `test/tool-choice-queue.test.ts:27` lost-yield requeue replays before later directives.
- B correlation closed: `test/bridge/agent-wire-host-tool-bridge.test.ts:48` caller `toolCallId` preserved
  while host request id stays separate.
- bounded primitives: `event-observation.ts:47-54` export `boundedStatus` (TOOL_STATUS_CODES closed set)
  + `boundedToken` (`^[A-Za-z][A-Za-z0-9_]{0,63}$`); grep `boundedStatus|boundedToken` in `test/` → 0
  matches (gap real). End-to-end: `event-observation.redteam.test.ts:39,51,57` (redaction, ≤200, malformed→null).

## 20.009-A deferral — LEGITIMATE
Phase-6 split doc `63_phase6_toolcall_context_split.md` scopes 20.009-A as "append-only context
source-anchor and overlap evidence ONLY unless 10.051 selects an implementation slice." 10.051 selected
A + B, not append-only. The "implementation owner remains this 10.051 card" wording prevents 20.009 from
driving code independently — it does not require 10.051 to implement append-only before closing.
JWC append-only context is already guarded (`appendOnlyPrefixSnapshot` in the openai-responses-replay
suite). 20.009 (Decision A: track-only) remains the home for that evidence.

## Source themes
Frontmatter/tool-IO/context-bounds/Codex-normalization are upstream commit *summaries*, not 10.051
done-gate items; frontmatter parsing already exists broadly in `src/`. No unaddressed code gap.

## Verdict
All 7 done-gate items satisfied. Test-only closure legitimate; 20.009-A deferral acceptable.
