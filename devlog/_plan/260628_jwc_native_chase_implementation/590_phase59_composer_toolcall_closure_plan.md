# 590 Phase 59 plan — 10.051 agent composer toolcall integrity closure

> Work-phase 59. Goal P1 cluster (last P1 card). Closes **10.051**.
> Source: GJC `a791d72a` composer/toolcall cluster (read-only evidence). JWC owners only.

## Current state of 10.051 (verified 2026-06-28)
- **10.051-A** tool-choice queue lost-yield/requeue — CLOSED (phase 15,
  `test/tool-choice-queue.test.ts`, 16 pass; no production change needed).
- **10.051-B** host-tool correlation — CLOSED (phase 19,
  `test/bridge/agent-wire-host-tool-bridge.test.ts`: caller `toolCallId` preserved across
  result/update/cancel, id-mismatch ignored, late frames rejected, `rejectAllPending`).
- **10.051-B** digest / bounded-observation — owner `src/modes/shared/agent-wire/event-observation.ts`
  (single semantic mapping → bounded owner observations). End-to-end covered by
  `test/agent-wire/event-observation.test.ts` + `.redteam.test.ts` (secret redaction, ≤200-char
  length bounds, every registered event type → non-null bounded observation, malformed → null/no-throw).
  **Gap:** the exported integrity primitives `boundedStatus` (closed-vocabulary tool status) and
  `boundedToken` (identifier-shape, ≤64 chars) have **zero direct unit tests**.
- **20.009-A** append-only context overlap — **deferred to sibling card `20.009`**
  (`struct_har/chase/20.009_omp_chase_append_only_context_integrity.md`, still open). Append-only context
  integrity is 20.009's own done-gate; 10.051's done-gate is composer/toolcall integrity. Not folded in.

## Gap to close (B primitive coverage)
Add a focused unit test for the exported `boundedStatus` + `boundedToken` primitives — the integrity
filter that the bounded-observation slice rests on.

## JWC owner files (this phase)
- `src/modes/shared/agent-wire/event-observation.ts` (`boundedStatus`/`boundedToken` — test target, no change)
- NEW `packages/coding-agent/test/agent-wire/event-observation-bounded-primitives.test.ts`

## Import / adapt / reject / split decisions
| sub-feature | decision |
|---|---|
| tool-choice queue (A) | **closed** (phase 15) |
| host-tool correlation (B) | **closed** (phase 19) |
| digest/bounded-observation (B) | **adapt + test** — end-to-end covered; add primitive unit guard |
| append-only context overlap (20.009-A) | **defer** to sibling card 20.009 (separate done-gate) |

## Build (B) — Boss writes
`test/agent-wire/event-observation-bounded-primitives.test.ts`:
- `boundedStatus`: accepts known codes case-insensitively + trimmed (`"OK"→"ok"`, `" Running "→"running"`);
  rejects unknown free text, empty, and non-strings → `undefined`.
- `boundedToken`: accepts identifier-shaped tokens incl. a 64-char boundary; rejects 65-char, leading
  digit, hyphen/space/special chars, empty, and non-strings → `undefined`.
No production source change.

## Check (C)
- `bun test test/agent-wire/event-observation-bounded-primitives.test.ts
  test/agent-wire/event-observation.test.ts test/agent-wire/event-observation.redteam.test.ts
  test/tool-choice-queue.test.ts test/bridge/agent-wire-host-tool-bridge.test.ts`
- `bun run check:types` (exit 0); `git diff --check`.

## Done (D) → close 10.051
Move card → `_fin/10/`; fix MOC/008 links + inbound (follow-index/MOC/gap-inventory) + the 20.009
cross-link relative path; `_fin/INDEX` += row, bump 40→41. Record final-close with sub-slice decisions
+ explicit 20.009-A deferral.

## Verification tier
LIGHT (test-only, 1 new file, no production change) + independent plan audit (goal gate; must challenge
the 20.009-A deferral).
