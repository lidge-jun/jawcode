# 182 Phase 18 build — runtime abort timeout audit

## Build summary

Phase 18 implements the one concrete gap found during the runtime abort/timeout audit: JS eval already accepts a caller `AbortSignal`, but the regression suite only covered timeout cancellation.

## Implementation evidence

Modified:

- `packages/coding-agent/test/core/js-executor.test.ts`

Added test:

- `executeJs` now has a focused regression test for caller-driven abort while an eval cell is pending forever.
- The test asserts `cancelled === true`, no `exitCode`, and no timeout-specific output. This distinguishes caller abort from timeout expiry.

No runtime implementation change was required in this phase. Existing behavior already supports `executeJs(..., { signal })`; this phase locks it with regression coverage.

## Existing coverage retained

The Phase 18 audit keeps the already-present bash/Python runtime lifecycle coverage as evidence for the broader `10.037-A` surface:

- `packages/coding-agent/test/bash-executor.test.ts`
- `packages/coding-agent/test/core/python-executor.test.ts`
- `packages/coding-agent/test/core/python-executor-timeout.test.ts`
- `packages/coding-agent/test/core/python-executor-per-call.test.ts`
- `packages/coding-agent/test/core/python-executor-owner-cleanup.test.ts`
- `packages/coding-agent/test/core/python-executor.lifecycle.test.ts`

## Residuals

`10.037` remains active. This phase only partially satisfies `10.037-A`; `10.037-C` DAP/LSP cleanup and future idle-timeout-watchdog wiring evidence remain open.
