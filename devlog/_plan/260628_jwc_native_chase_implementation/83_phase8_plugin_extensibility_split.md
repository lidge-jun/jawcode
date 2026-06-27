# 83 Phase 8 split — 10.044 plugin extensibility bundle

## Source card

`struct_har/chase/10.044_gjc_chase_plugin_extensibility_bundle.md`

## JWC posture

Split plugin work into schema, loader, marketplace, custom-command, MCP, and bundle surfaces. JWC already has `jwc-plugins` owners; upstream `plugins/gajae-code/**` is citation evidence only and must not become a copied product bundle.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| plugin schema and validation | `packages/coding-agent/src/extensibility/jwc-plugins/schema.ts`; `validation.ts`; plugin schema tests |
| plugin loading and activation | `packages/coding-agent/src/extensibility/jwc-plugins/loader.ts`; `activation.ts`; `injection.ts`; plugin loader tests |
| marketplace and install | `packages/coding-agent/src/extensibility/plugins/marketplace/**`; marketplace tests |
| custom commands and tools | `packages/coding-agent/src/extensibility/custom-commands/**`; `packages/coding-agent/src/extensibility/custom-tools/**`; custom-command tests |
| runtime MCP boundary | `packages/coding-agent/src/runtime-mcp/**`; MCP discovery/cleanup tests |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.044-A` | Generated plugin-bundle quarantine and manifest-name validation with `jwc`/`@jawcode-dev/*` names. | `jwc-plugin-schema.test.ts`, `jwc-plugin-loader.test.ts`, marketplace registry tests. |
| `10.044-B` | Delegatable plugin surface only as a JWC-native contract, not GJC session payload copy. | plugin activation/dispatch tests and docs examples using JWC names. |
| `10.044-C` | Custom command/MCP bridge tests for allowed roots, command args, and forbidden surface rejection. | `jwc-plugin-tools.test.ts`, `extensibility/custom-commands/ci-green.test.ts`, MCP discovery tests. |

## Reject/defer

- Shipping upstream `plugins/gajae-code/**` as JWC product content.
- Keeping `gajae-plugin.json` naming in new JWC-facing docs or generated examples unless the existing schema intentionally preserves a compatibility fixture.
- Adding plugin network or process privileges without a dedicated security review.

## Done-gate status

No `10.044` done-gate is closed by this split. The card remains active.
