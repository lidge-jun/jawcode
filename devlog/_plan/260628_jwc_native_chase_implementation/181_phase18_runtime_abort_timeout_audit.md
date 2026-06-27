# 181 Phase 18 audit — runtime abort timeout audit

## Backend audit 1

Verdict: NEEDS_FIX.

Findings:

- Existing bash and Python abort/timeout/hung-cleanup coverage is strong, and the planned no-code audit is acceptable for those surfaces.
- A concrete missing edge remains: `executeJs(..., { signal })` supports caller abort but `packages/coding-agent/test/core/js-executor.test.ts` only covers timeout cancellation.
- Plan language over-closed `10.037` by saying only `10.037-C` remains; `idle-timeout-watchdog` wiring evidence should stay as a future residual unless explicitly proven.

Plan fixes applied:

- Add one focused JS eval caller-abort test beside the existing JS eval timeout test.
- Expand verification to include `packages/coding-agent/test/core/js-executor.test.ts` and `python-executor.lifecycle.test.ts`.
- Change chase evidence language to partial `10.037-A` satisfaction, leaving `10.037-C` DAP/LSP and future idle-timeout-watchdog wiring evidence active.

## Backend audit 2

Verdict: PASS.

Re-audit confirmed:

- JS eval caller-abort test plan fits `packages/coding-agent/test/core/js-executor.test.ts` and existing `executeJs(..., { signal })` API.
- `10.037` evidence language is partial and leaves DAP/LSP plus idle-timeout-watchdog residuals active.
- Verification includes `js-executor.test.ts` and `python-executor.lifecycle.test.ts`.
