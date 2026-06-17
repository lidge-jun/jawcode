# 40 C check — verification

## Commands

```bash
bun test packages/coding-agent/test/agent-session-queued-prompts.test.ts
```

Result: PASS — 4 pass, 0 fail, 17 expect calls.

```bash
bun test packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts \
  packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts \
  packages/coding-agent/test/jwc-runtime/skill-command-ref.test.ts \
  packages/coding-agent/test/jaw-interview-skill-policy.test.ts \
  packages/coding-agent/test/default-jwc-definitions.test.ts \
  packages/coding-agent/test/interactive-mode-status.test.ts \
  packages/coding-agent/test/status-line-pabcd-segment.test.ts
```

Result: PASS — 123 pass, 0 fail, 728 expect calls.

```bash
bun scripts/verify-g002-gates.ts
```

Result: PASS — G002 gate verification passed.

```bash
bun run check:ts
```

Result: PASS — workspace checks and `tsgo --noEmit` completed successfully. Biome emitted only the existing deprecated `recommended` config info.

## Scrutiny

- The yield-boundary re-poll uses the existing `pendingMessages` path, so it does not create a second delivery mechanism.
- The stranded followUp drain is normal-settle only; `#resetInFlight()` abort/reset behavior is untouched.
- The continue gate reuses `#canAutoContinueForFollowUp()` and `agent.hasQueuedMessages()` both before scheduling and at execution time.
- The extension-event regression test exercises the real pre-wire-emit `agent_end` hook, which is the race boundary the fix targets.

## Verdict

PASS. Ready for D phase after commits.
