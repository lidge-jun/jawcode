# 273 Phase 27 check — 10.038-D RPC fast-lane evidence

## Local verification

```text
$ bun test packages/coding-agent/test/rpc-fastlane.test.ts packages/coding-agent/test/rpc-get-state-payload.test.ts
9 pass
0 fail
63 expect() calls
Ran 9 tests across 2 files.
```

```text
$ cd packages/coding-agent && bun run check:types
$ tsgo -p tsconfig.json --noEmit
exit 0
```

```text
$ git diff --check -- packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts packages/coding-agent/test/rpc-fastlane.test.ts struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md devlog/_plan/260628_jwc_native_chase_implementation/270_phase27_rpc_fastlane_evidence_plan.md devlog/_plan/260628_jwc_native_chase_implementation/271_phase27_rpc_fastlane_evidence_audit.md devlog/_plan/260628_jwc_native_chase_implementation/272_phase27_rpc_fastlane_evidence_build.md devlog/_plan/260628_jwc_native_chase_implementation/273_phase27_rpc_fastlane_evidence_check.md
exit 0
```

## Environment-scoped caveat

The broader command

```text
$ bun test packages/coding-agent/test/rpc-fastlane.test.ts packages/coding-agent/test/rpc-listen-socket-guard.test.ts packages/coding-agent/test/rpc-get-state-payload.test.ts
```

ran the new fast-lane tests and the in-process socket guard successfully, but the existing subprocess socket-guard case failed before reaching RPC behavior because local Bun is `1.3.11` and the repo runtime guard requires `>=1.3.14`:

```text
error: Bun runtime must be >= 1.3.14 (found v1.3.11). Please upgrade: bun upgrade
```

## Backend verification

Pending read-only verifier result.
