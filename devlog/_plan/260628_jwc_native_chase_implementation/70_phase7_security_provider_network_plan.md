# 70 Phase 7 plan — security, provider, and network guards

## Scope

Split and harden evidence for cards `10.036`, `10.038`, `10.043`, and `10.047`.

This phase is docs-first because all four cards touch C4 security surfaces: provider credentials, RPC sockets/control-plane, public URL reads/search, and privacy redaction. JWC already has substantial native owners and tests; this phase records safe implementation boundaries before any code change.

## Source anchors

| Card | Source | Local head |
|---|---|---|
| `10.036` | GJC provider auth/model catalog cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.038` | GJC RPC control-plane v2 cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.043` | GJC web search/public URL hardening cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.047` | GJC security/privacy guardrails cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |

## Existing JWC evidence

| Surface | Evidence |
|---|---|
| provider auth/catalog | `packages/ai/src/auth-storage.ts`; `packages/ai/src/model-manager.ts`; `packages/ai/src/provider-models/**`; `packages/coding-agent/src/config/model-registry.ts`; auth/model tests |
| model onboarding/profile UX | `packages/coding-agent/src/setup/provider-onboarding.ts`; `packages/coding-agent/src/config/model-profiles.ts`; model selector/profile tests |
| RPC control plane | `packages/coding-agent/src/modes/rpc/**`; `python/jwc-rpc/**`; `packages/coding-agent/test/rpc*.test.ts`; `packages/coding-agent/test/harness-control-plane/**` |
| URL/read/search boundary | `packages/coding-agent/src/web/search/**`; `packages/coding-agent/src/tools/read.ts`; `docs/tools/web_search.md`; web-search/read tests |
| secrets/privacy | `packages/coding-agent/src/secrets/**`; `packages/coding-agent/src/session/contribution-prep.ts`; `packages/coding-agent/src/exec/non-interactive-env.ts`; `packages/coding-agent/src/commands/auth-gateway.ts`; `packages/coding-agent/src/modes/bridge/**`; `docs/secrets.md`; `docs/environment-variables.md` |

## `_fin` overlap inventory

Phase 7 must not reopen work that is already closed under `_fin`.

| Active card | `_fin` overlap | Phase 7 posture |
|---|---|---|
| `10.036` | `struct_har/chase/_fin/10/10.002_gjc_chase_ai_auth.md` closed the core AI-auth safety review and notes optional provider completeness only. | Keep `10.036` active for provider/catalog feature hardening; do not relitigate closed auth safety unless a concrete new owner gap appears. |
| `10.038` | `struct_har/chase/_fin/10/10.008_gjc_chase_rpc_lifecycle.md`, `struct_har/chase/_fin/10/10.018_gjc_chase_rpc_registry_uds.md`, and `struct_har/chase/_fin/10/10.026_gjc_chase_rpc_issues_audit.md` close stdio/UDS/listen baseline work. | Before any `10.038` code, recheck these files and implement only gaps beyond closed RPC lifecycle/registry evidence. |
| `10.043` | No direct `_fin` web-search URL card found in this phase's scan. | Keep active; require focused URL/search tests before code. |
| `10.047` | `struct_har/chase/_fin/10/10.002_gjc_chase_ai_auth.md` covers auth safety; Phase 5 recorded release leak overlap separately. | Treat as cross-cutting guardrail only; avoid double-owning provider/RPC/search behavior selected by sibling cards. |

## New artifacts

| File | Purpose |
|---|---|
| `70_phase7_security_provider_network_plan.md` | This plan. |
| `71_phase7_provider_auth_catalog_split.md` | Split `10.036` into provider auth/catalog candidates. |
| `72_phase7_rpc_control_plane_split.md` | Split `10.038` into RPC control-plane candidates. |
| `73_phase7_search_url_boundary_split.md` | Split `10.043` into web search/public URL candidates. |
| `74_phase7_security_privacy_split.md` | Split `10.047` into security/privacy guard candidates. |
| `75_phase7_security_provider_network_audit.md` | Record employee audit and fixes. |
| `76_phase7_security_provider_network_build.md` | Record docs-only build output. |
| `77_phase7_security_provider_network_check.md` | Record verification and commit evidence. |

## Chase docs to update

| File | Planned change |
|---|---|
| `struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md` | Add Phase 7 split evidence, keep active. |
| `struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md` | Add Phase 7 split evidence, keep active. |
| `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md` | Add Phase 7 split evidence, keep active. |
| `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md` | Add Phase 7 split evidence, keep active. |

## Candidate slices after this phase

Each future slice requires its own PABCD cycle and security review.

| Candidate | Owner card | Scope |
|---|---|---|
| `10.036-A` | `10.036` | Provider credential resolution negative tests: project dotenv exclusion, runtime env precedence, broker sentinel non-leak. |
| `10.036-B` | `10.036` | Model catalog/profile drift tests for JWC-supported providers only. |
| `10.036-C` | `10.036` | Credential import/onboarding docs/tests if current JWC import UX has a concrete gap. |
| `10.038-A` | `10.038` | RPC unknown-command/id preservation and fail-closed metrics tests. |
| `10.038-B` | `10.038` | RPC UDS/listen work only beyond `10.018` closed baseline; likely duplicate-refusal cleanup or explicit no-op evidence. |
| `10.038-C` | `10.038` | Python client registry/listen parity tests if JS/Python contract drift is found. |
| `10.043-A` | `10.043` | Public/private URL deny tests for `read` and internal URL routing. |
| `10.043-B` | `10.043` | Search provider auth/baseUrl guard tests, especially direct provider-id mappings. |
| `10.043-C` | `10.043` | Citation/read hardening tests without adopting upstream snapshot parity. |
| `10.047-A` | `10.047` | Secret/log redaction regression tests for contribution prep, agent-wire envelopes, and logs. |
| `10.047-B` | `10.047` | Security-policy owner for non-interactive env scrub expansion only for concrete missing variables; coordinate with Phase 6 `10.037-B` runtime-cleanup slice before code. |
| `10.047-C` | `10.047` | Browser-origin/auth-gateway no-auth guard if a JWC owner gap is confirmed. |

## Explicit non-changes

- Do not patch GJC source under `devlog/_gjc_chase`.
- Do not modify credential resolution, RPC sockets, URL fetch behavior, or redaction logic in this docs-first phase.
- Do not add new network providers, OAuth flows, or model catalog entries in this phase.
- Do not close any of the four cards.
- Do not document upstream `gjc`/`.gjc` commands as JWC product instructions.

## Verification plan

Docs and smoke checks:

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/70_phase7_security_provider_network_plan.md devlog/_plan/260628_jwc_native_chase_implementation/71_phase7_provider_auth_catalog_split.md devlog/_plan/260628_jwc_native_chase_implementation/72_phase7_rpc_control_plane_split.md devlog/_plan/260628_jwc_native_chase_implementation/73_phase7_search_url_boundary_split.md devlog/_plan/260628_jwc_native_chase_implementation/74_phase7_security_privacy_split.md struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md struct_har/chase/10.043_gjc_chase_web_search_insane_security.md struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md
```

Focused existing security tests:

The RPC subprocess smoke tests require the repo-supported Bun runtime (`>= 1.3.14`). On older Bun, keep the failure as environment evidence and do not treat it as a Phase 7 plan failure unless the same tests fail under a supported runtime.

```sh
bun test packages/ai/test/auth-storage-broker-no-sentinel.test.ts packages/ai/test/auth-storage-config-override.test.ts packages/coding-agent/test/rpc-listen-socket-guard.test.ts packages/coding-agent/test/rpc-stdio-redteam.test.ts
```

```sh
bun test packages/coding-agent/test/tools/web-search-codex.test.ts packages/coding-agent/test/tools/web-search-searxng.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/secrets-obfuscator.test.ts packages/coding-agent/test/agent-wire/event-envelope.redteam.test.ts
```

Package typecheck is optional for docs-only, but run `cd packages/coding-agent && bun run check:types` if any source/test code changes.
