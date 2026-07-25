# 20 — card synthesis

Date: 2026-07-03

## GJC `79b42377..db7938e1`

34 commits were split into four active cards:

| Card | Classification | Cluster | Rationale |
|---|---|---|---|
| `10.070_gjc_chase_workflow_intent_state_artifacts.md` | adapt | workflow intent, gate schema, state envelope, ralplan artifacts | Native JWC `orchestrate`/`planphase` likely needs semantic adaptation rather than legacy skill-copy. |
| `10.071_gjc_chase_search_utils_edit_safety.md` | import/adapt candidate | web_search performance, glob/format utilities, BOM edit safety | Mostly generic fixes; still requires JWC-focused tests because search/network behavior affects user-visible evidence. |
| `10.072_gjc_chase_model_selector_tmux_cmux_ux.md` | adapt | model selector, command palette, skill card wrapping, tmux/cmux/coordinator UX | Useful but TUI-sensitive; JWC visual/scroll/tool-folding contracts must be preserved. |
| `10.073_gjc_chase_rpc_session_notifications_lifecycle.md` | adapt | session close postmortem, Telegram recent formatting, Python RPC protocol | Needs `gjc_rpc`→`jwc_rpc` translation and notification fail-closed review. |

No-card GJC bucket: version bump, changelog/docs/logo/project-link maintenance, release gate stabilization that does not by itself create a JWC runtime gap.

## OMP `0ea6ea630..d0c1890a6`

216 commits were split into five reference cards:

| Card | Classification | Cluster | Rationale |
|---|---|---|---|
| `20.036_omp_chase_ai_catalog_auth_usage.md` | reference/split | Baseten/catalog, Claude usage, signing replay, auth storage/proxy | OMP provider changes are not direct imports; JWC model generation and auth boundaries need separate review. |
| `20.037_omp_chase_session_async_plan_integrity.md` | reference/adapt candidate | async jobs, atomic session rewrite, plan convergence, goal recovery, task discovery | High-value but overlaps JWC `.jwc` session/goal/orchestrate semantics. |
| `20.038_omp_chase_hashline_tool_plugin_task_safety.md` | reference/split | hashline/edit provenance, tool arg coercion, plugin/custom-tool guards, task/worktree isolation | Integrity cluster; too broad for one implementation card. |
| `20.039_omp_chase_tui_terminal_render_resilience.md` | reference/adapt candidate with TUI gate | TUI CPU, terminal repaint, live spinners, move overlay, autocomplete | Must respect JWC curated TUI and `structure/31_scroll.md`. |
| `20.040_omp_chase_robomp_iso_sandbox_release.md` | reference/split | robomp sandbox/worktree, ISO copy, update/usage CLI, release/build hardening | Python/release surfaces need separate JWC rules (`python/robojwc/AGENTS.md`, release publishing SoT). |

No-card OMP bucket: version bumps, broad changelog entries, style-only commits, VOUCHED updates, and tests that only support the grouped source behaviors above.

## Index updates performed

- `struct_har/chase/10_gjc_chase_MOC.md`
- `struct_har/chase/20_omp_chase_MOC.md`
- `struct_har/chase/002_gap_inventory.md`
- `struct_har/chase/007_follow_index.md`
- `struct_har/chase/README.md`
- `struct_har/README.md`
- `struct_har/INDEX.md`

## Remaining work

The new cards are intentionally active/reference entries, not implementation closure. Each card names owner candidates and verification expectations for future import/adapt/reject work.
