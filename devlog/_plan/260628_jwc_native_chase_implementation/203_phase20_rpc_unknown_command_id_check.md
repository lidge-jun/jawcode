# 203 Phase 20 check — RPC unknown command id preservation

## Local verification

Command:

```bash
bun test packages/coding-agent/test/rpc-get-state-payload.test.ts
```

Result:

```text
4 pass
0 fail
```

Command attempted:

```bash
bun test packages/coding-agent/test/rpc-get-state-payload.test.ts packages/coding-agent/test/rpc-stdio-redteam.test.ts packages/coding-agent/test/rpc-unattended-stdio.test.ts
```

Result:

```text
packages/coding-agent/test/rpc-get-state-payload.test.ts: 4 pass
rpc-stdio-redteam / rpc-unattended-stdio: child CLI preflight failed with Bun runtime must be >= 1.3.14 (found v1.3.11)
```

Command:

```bash
cd packages/coding-agent && bun run check:types
```

Result:

```text
$ tsgo -p tsconfig.json --noEmit
```

Exit code: 0.

Command:

```bash
bunx biome check packages/coding-agent/test/rpc-get-state-payload.test.ts packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts
```

Result:

```text
Checked 2 files in 9ms. No fixes applied.
```

Command:

```bash
git diff --check -- packages/coding-agent/test/rpc-get-state-payload.test.ts packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md devlog/_plan/260628_jwc_native_chase_implementation/200_phase20_rpc_unknown_command_id_plan.md devlog/_plan/260628_jwc_native_chase_implementation/201_phase20_rpc_unknown_command_id_audit.md devlog/_plan/260628_jwc_native_chase_implementation/202_phase20_rpc_unknown_command_id_build.md devlog/_plan/260628_jwc_native_chase_implementation/203_phase20_rpc_unknown_command_id_check.md
```

Result: exit code 0.

## Check conclusion

Phase 20 is a minimal control-plane contract fix. The changed branch is covered by the in-process dispatcher test; broader subprocess RPC smoke tests remain blocked in this environment until Bun is upgraded to at least 1.3.14.
