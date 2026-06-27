# 193 Phase 19 check — agent-wire host tool correlation

## Local verification

Command:

```bash
bun test packages/coding-agent/test/bridge/agent-wire-host-tool-bridge.test.ts packages/coding-agent/test/bridge/agent-wire-responses.test.ts packages/coding-agent/test/bridge/bridge-conformance.test.ts packages/coding-agent/test/bridge/bridge-client-bridge.test.ts
```

Result:

```text
21 pass
0 fail
165 expect() calls
Ran 21 tests across 4 files. [187.00ms]
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
bunx biome check packages/coding-agent/test/bridge/agent-wire-host-tool-bridge.test.ts
```

Result:

```text
Checked 1 file in 37ms. No fixes applied.
```

Command:

```bash
git diff --check -- packages/coding-agent/test/bridge/agent-wire-host-tool-bridge.test.ts struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md devlog/_plan/260628_jwc_native_chase_implementation/190_phase19_agent_wire_host_tool_correlation_plan.md devlog/_plan/260628_jwc_native_chase_implementation/191_phase19_agent_wire_host_tool_correlation_audit.md devlog/_plan/260628_jwc_native_chase_implementation/192_phase19_agent_wire_host_tool_correlation_build.md devlog/_plan/260628_jwc_native_chase_implementation/193_phase19_agent_wire_host_tool_correlation_check.md
```

Result: exit code 0.

## Check conclusion

Phase 19 is test-only hardening. It does not change the public protocol version or production host-tool bridge code. `10.051` remains active for digest/bounded-observation coverage and `20.009-A` append-only overlap evidence.
