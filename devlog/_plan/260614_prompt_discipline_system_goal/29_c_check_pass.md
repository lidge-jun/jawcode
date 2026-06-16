# 29 C Check Pass — Stale Jaw-Interview Cleanup

Date: 2026-06-15
Stage: PABCD C

## Mechanical gates

```sh
bun run check
# PASS

bun test packages/coding-agent/test/jaw-interview-mutation-guard.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts
# 91 pass, 0 fail, 488 expect() calls
```

Focused Biome checks also passed on touched source/test files during B verification.

## Adversarial review

Final reviewer: `38-AdversarialReviewCR4`

Verdict: PASS

Findings summary:

1. Real shared + real session active-state edge passes: shared/root mode stays active and root active-state is restored while session state/snapshot retire.
2. Isolated real session retire passes: stale root aggregate session entry is removed when only a session entry exists.
3. Unrelated shared/root preservation is covered by the shared+session regression and source condition `rootJawInterview.session_id === input.sessionId`.
4. HTML guard behavior passes: product/non-mockup HTML and `.jwc/**/*.html` block; mockup/wireframe/prototype HTML outside `.jwc` remains allowed.
5. P/reset cleanup remains plan-aligned: P retires only `handoff`; reset retires `handoff`/`interviewing` only after unlink success; dry-run skips cleanup.
6. No remaining doc/code mismatch found.

## Acceptance criteria status

- `handoff` no longer blocks product/source mutation: covered by guard test.
- active `interviewing` still blocks product/source mutation: existing guard tests remain green.
- static mockup HTML exception is constrained: mockup/wireframe/prototype outside `.jwc` allowed; product HTML and `.jwc` HTML blocked.
- P entry retires same-scope handoff: covered by direct/session/runtime-created tests.
- P entry preserves active `interviewing`: covered by direct P test.
- reset retires same-scope handoff/interviewing after unlink and not dry-run: covered by reset tests.
- session/shared scope isolation and active-state restoration: covered by runtime-created shared+session regressions.

Residual risk: none known after final adversarial review.
