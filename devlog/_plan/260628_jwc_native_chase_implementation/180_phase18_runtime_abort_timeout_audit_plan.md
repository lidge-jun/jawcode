# 180 Phase 18 plan — runtime abort timeout audit

## Work-phase

Phase 18 audits and hardens the `10.037-A` runtime abort/timeout cleanup slice.

## Finding before plan

Current JWC already has unusually broad bash and Python lifecycle regression coverage:

- `packages/coding-agent/test/bash-executor.test.ts` covers abort, timeout, hung native abort cleanup, hung native timeout cleanup, persistent-session reset after abort, background job timeout/abort killing, spawned process timeout/abort killing, shell-session disposal, and runtime gauges.
- `packages/coding-agent/test/core/python-executor-owner-cleanup.test.ts` covers owner-scoped cleanup, stuck retained executions, queued execution disposal races, retrying unconfirmed shutdown, and global cleanup.
- `packages/coding-agent/test/core/python-executor-per-call.test.ts` covers startup deadline and abort.
- `packages/coding-agent/test/core/python-executor*.test.ts` cover timeout annotations and kernel cancellation semantics.

This phase therefore starts as a coverage audit. A-phase found one concrete missing edge: JS eval caller-abort is supported by `executeJs(..., { signal })` but lacks a focused test next to the existing JS eval timeout test. Phase 18 will add that single test and then record partial `10.037-A` evidence. `10.037` remains active for `10.037-C` DAP/LSP split and any future idle-timeout-watchdog wiring evidence.

## Planned changes

### MODIFY `packages/coding-agent/test/core/js-executor.test.ts`

Add one focused test beside `cancels execution when the timeout expires`:

```ts
it("cancels execution when the caller aborts", async () => {
  const controller = new AbortController();
  const promise = executeJs("await new Promise(() => {})", {
    sessionId,
    session,
    sessionFile,
    signal: controller.signal,
  });
  await Bun.sleep(0);
  controller.abort(Object.assign(new Error("caller aborted"), { name: "AbortError" }));
  const result = await promise;
  expect(result.cancelled).toBe(true);
  expect(result.exitCode).toBeUndefined();
  expect(result.output).not.toContain("Command timed out");
});
```

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/181_phase18_runtime_abort_timeout_audit.md`

Record employee audit of existing abort/timeout coverage and any found gap.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/182_phase18_runtime_abort_timeout_build.md`

Record JS eval abort implementation evidence plus existing bash/Python coverage.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/183_phase18_runtime_abort_timeout_check.md`

Record final verification and commit evidence.

### MODIFY `struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md`

Append Phase 18 evidence:

- `10.037-A` is partially satisfied by existing bash/Python abort-timeout coverage plus the new JS eval caller-abort test.
- Keep residual candidates explicit: `10.037-C` DAP/LSP and future idle-timeout-watchdog wiring evidence remain active.

## Verification plan

Run:

```bash
bun test packages/coding-agent/test/bash-executor.test.ts packages/coding-agent/test/core/js-executor.test.ts packages/coding-agent/test/core/python-executor.test.ts packages/coding-agent/test/core/python-executor-timeout.test.ts packages/coding-agent/test/core/python-executor-per-call.test.ts packages/coding-agent/test/core/python-executor-owner-cleanup.test.ts packages/coding-agent/test/core/python-executor.lifecycle.test.ts
cd packages/coding-agent && bun run check:types
git diff --check -- packages/coding-agent/test/core/js-executor.test.ts struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md devlog/_plan/260628_jwc_native_chase_implementation/180_phase18_runtime_abort_timeout_audit_plan.md devlog/_plan/260628_jwc_native_chase_implementation/181_phase18_runtime_abort_timeout_audit.md devlog/_plan/260628_jwc_native_chase_implementation/182_phase18_runtime_abort_timeout_build.md devlog/_plan/260628_jwc_native_chase_implementation/183_phase18_runtime_abort_timeout_check.md
```

## Boundaries

- Source code changes are limited to the JS eval caller-abort test identified by the audit.
- No env scrub changes; Phase 17 covers `10.037-B`.
- No DAP/LSP changes; those remain `10.037-C`.
- Do not stage pre-existing `devlog/.gitignore` or `devlog/_tmp/`.
