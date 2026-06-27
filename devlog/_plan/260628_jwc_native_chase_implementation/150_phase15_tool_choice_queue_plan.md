# 150 Phase 15 plan — tool-choice queue integrity

## Goal

Implement the `10.051-A` slice by strengthening JWC-native tool-choice queue regression tests.

The production queue already supports lost-yield requeue, `onInvoked` preservation, targeted removal, and clear semantics. This phase should add edge coverage first and only change production code if a red test proves a real gap.

## Source evidence

| Source | Evidence |
|---|---|
| `63_phase6_toolcall_context_split.md` | `10.051-A` allows focused `tool-choice-queue.test.ts` additions. |
| `10.051_gjc_chase_agent_composer_toolcall_integrity.md` | Tool-choice queue is the JWC owner for lost-yield/requeue integrity. |
| `packages/coding-agent/src/session/tool-choice-queue.ts` | Current queue implementation. |
| `packages/coding-agent/test/tool-choice-queue.test.ts` | Existing focused regression suite. |
| GJC upstream | `git -C devlog/_gjc_chase/gajae-code log --oneline --reverse 498d86bb..HEAD -- packages/agent packages/coding-agent/src/modes/shared/agent-wire packages/ai/test` reviewed through `a791d72a`. |

## Planned files

### New files

None.

### Modified files

| Path | Planned change |
|---|---|
| `packages/coding-agent/test/tool-choice-queue.test.ts` | Add focused edge tests for requeue ordering, clear/remove suppression, and last-served label behavior. |
| `packages/coding-agent/src/session/tool-choice-queue.ts` | Modify only if a new red test exposes a concrete queue behavior gap. |
| `struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md` | Add Phase 15 partial `10.051-A` evidence and keep the card active. |
| `devlog/_plan/260628_jwc_native_chase_implementation/151_phase15_tool_choice_queue_audit.md` | Audit results and fixes. |
| `devlog/_plan/260628_jwc_native_chase_implementation/152_phase15_tool_choice_queue_build.md` | Build/test evidence and residual risk. |
| `devlog/_plan/260628_jwc_native_chase_implementation/153_phase15_tool_choice_queue_check.md` | Fresh focused checks and commit evidence. |

## Test cases

Add tests that prove:

1. A requeued lost yield is replayed before later queued directives.
2. A requeued lost yield does not replay the remaining original sequence twice.
3. `clear()` rejects in-flight requeue attempts but leaves no queued replay.
4. `removeByLabel()` rejects a matching in-flight directive but does not remove the generated requeue unless its label also matches.
5. `consumeLastServedLabel()` records resolved original labels and requeued labels accurately.

## Non-goals

- No agent-wire event contract changes.
- No append-only session model changes.
- No OMP snapshot parity tests.
- No direct mutation of session entries.
- No full closure of `10.051`; this closes only the `10.051-A` tested subset if checks pass.

## Verification

Required checks:

```text
bun test packages/coding-agent/test/tool-choice-queue.test.ts
cd packages/coding-agent && bun run check:types
bunx biome check packages/coding-agent/test/tool-choice-queue.test.ts packages/coding-agent/src/session/tool-choice-queue.ts
git diff --check -- <changed files>
```

## Reviewer requirements

Backend audit in A phase and Backend verification in B phase are required because this queue drives forced tool execution and pending action behavior.
