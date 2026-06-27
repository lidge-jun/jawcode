# 77 Phase 7 check — security, provider, and network guards

## Verification status

Build-phase checks completed.

## Commands recorded

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/02_phase_map.md devlog/_plan/260628_jwc_native_chase_implementation/70_phase7_security_provider_network_plan.md devlog/_plan/260628_jwc_native_chase_implementation/71_phase7_provider_auth_catalog_split.md devlog/_plan/260628_jwc_native_chase_implementation/72_phase7_rpc_control_plane_split.md devlog/_plan/260628_jwc_native_chase_implementation/73_phase7_search_url_boundary_split.md devlog/_plan/260628_jwc_native_chase_implementation/74_phase7_security_privacy_split.md devlog/_plan/260628_jwc_native_chase_implementation/75_phase7_security_provider_network_audit.md devlog/_plan/260628_jwc_native_chase_implementation/76_phase7_security_provider_network_build.md devlog/_plan/260628_jwc_native_chase_implementation/77_phase7_security_provider_network_check.md struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md struct_har/chase/10.043_gjc_chase_web_search_insane_security.md struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md
```

Result: pass, exit `0`.

```sh
bun test packages/ai/test/auth-storage-broker-no-sentinel.test.ts packages/ai/test/auth-storage-config-override.test.ts
```

Result:

```text
8 pass
0 fail
21 expect() calls
Ran 8 tests across 2 files.
```

```sh
bun test packages/coding-agent/test/tools/web-search-codex.test.ts packages/coding-agent/test/tools/web-search-searxng.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/secrets-obfuscator.test.ts packages/coding-agent/test/agent-wire/event-envelope.redteam.test.ts
```

Result:

```text
58 pass
0 fail
480 expect() calls
Ran 58 tests across 5 files.
```

```sh
bun test packages/coding-agent/test/rpc-listen-socket-guard.test.ts packages/coding-agent/test/rpc-stdio-redteam.test.ts
```

Result on local Bun `1.3.11`:

```text
1 pass
5 fail
Ran 6 tests across 2 files.
```

Failure reason is the documented environment prerequisite, not Phase 7 docs behavior:

```text
error: Bun runtime must be >= 1.3.14 (found v1.3.11). Please upgrade: bun upgrade
```

## Environment note

The RPC subprocess smoke tests require the repo-supported Bun runtime (`>= 1.3.14`). Current local Bun may be older; if so, record that result as environment evidence and do not count it as Phase 7 docs-only failure unless it reproduces under supported Bun.

## Outcome

- Docs diff check passed.
- Provider/auth and URL/search/redaction tests passed.
- RPC subprocess tests failed only due to older local Bun runtime (`1.3.11` vs required `>= 1.3.14`).
- Phase 7 remains docs-only; package typecheck is not required because no source/test code changed.
