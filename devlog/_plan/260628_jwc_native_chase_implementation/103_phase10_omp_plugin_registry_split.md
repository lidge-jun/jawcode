# 103 Phase 10 split — 20.013 OMP plugin virtual registry bundle

## Source card

`struct_har/chase/20.013_omp_chase_plugin_virtual_registry_bundle.md`

## JWC posture

Reference-only split. OMP plugin virtual registry behavior must be translated through JWC `jwc-plugins`, marketplace, runtime MCP, and GJC `10.044` boundaries. No OMP virtual `pi-*` namespace should leak into JWC product docs.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| JWC plugin schema/loader | `packages/coding-agent/src/extensibility/jwc-plugins/**`; plugin schema/loader tests |
| marketplace registry | `packages/coding-agent/src/extensibility/plugins/marketplace/**`; marketplace tests |
| plugin install/project roots | `packages/coding-agent/src/extensibility/plugins/**`; plugin command tests |
| MCP/runtime bridge | `packages/coding-agent/src/runtime-mcp/**`; MCP tests |

## Split decisions

| Slice | Decision | Rationale | Required future evidence |
|---|---|---|---|
| `20.013-A` marketplace/project-scope roots | adapt only if JWC marketplace gap exists | overlaps existing marketplace owners and GJC `10.044` | marketplace/project-scope tests |
| `20.013-B` runtime package validation | adapt through JWC plugin schema | avoid OMP virtual registry shape | jwc-plugin schema/loader tests |
| `20.013-C` virtual `pi-*` subpaths | reject for JWC-facing surface | naming/namespace mismatch | explicit docs note if needed |
| `20.013-D` MCP optional args omission | split under runtime MCP contract | small protocol compatibility risk | runtime MCP tests |

## Reject/defer

- Do not add OMP `pi-*` virtual registry names to JWC.
- Do not copy OMP collab-web plugin tool views.
- Do not change plugin install behavior without security and marketplace tests.

## Done-gate status

No `20.013` done-gate is closed by this split. The card remains reference-only and active.
