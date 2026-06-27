# 30 Phase 3 — OMP v16.1.13 to v16.1.20 delta split

## Scope

Create detailed, reference-only OMP chase cards for `cc0c67be` (`v16.1.13`) → `0fc6d136` (`v16.1.20`). This plan follows the canonical card map already declared in `00_goal_plan.md` and `01_source_audit_matrix.md`.

## Canonical new cards

- `struct_har/chase/20.009_omp_chase_append_only_context_integrity.md`: append-only context/log integrity, context rewrites, provider payload digests, stable prefix, malformed tool calls.
- `struct_har/chase/20.010_omp_chase_ai_oauth_reasoning_replay.md`: AI OAuth/account selection, reasoning replay, catalog/model/provider changes, Fugu/Sakana, quota rotation.
- `struct_har/chase/20.011_omp_chase_tui_image_drafts_terminal_edges.md`: TUI image drafts, terminal/kitty/warp edges, session picker UI, transcript tail, paste image.
- `struct_har/chase/20.012_omp_chase_bash_snapshot_env_security.md`: bash/shell snapshot, env/secret hardening, background wrappers, pi-shell/crate-adjacent shell behavior.
- `struct_har/chase/20.013_omp_chase_plugin_virtual_registry_bundle.md`: plugin virtual registry, marketplace plugin roots, MCP tool bridge, bundle/collab-web plugin render surfaces.
- `struct_har/chase/20.014_omp_chase_goal_compaction_provider_concurrency.md`: goal compaction, snapcompact, provider concurrency limiter, ollama-cloud backoff/semaphore, task spawn slot release.
- `struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md`: release/CI/test leak hardening, terminal-bench/TUI bench, changelog normalization, platform/package docs.

## Orphan/defer policy

| area | owner / disposition |
|---|---|
| hashline + isolated eval multilang | mention as deferred/orphan summary in `20.015` unless later split into `20.016`; not part of 20.009 canonical slot. |
| mnemopi memory beam/extraction | cross-reference existing `_fin/20/20.003`; defer new implementation card unless later memory goal requests it. |
| collab-web tool render | mention under `20.013` as plugin/render adjacency. |
| crates/pi-shell and brush-core | mention under `20.012` when shell/env/security related; otherwise defer as OMP internals. |

## Cross-lane dedup / primary owner table

| OMP card | overlapping GJC card | reconcile note required |
|---|---|---|
| `20.010` | `10.036` | OMP is reference-only for OAuth/reasoning replay; GJC provider chase remains primary for GJC upstream parity. |
| `20.011` | `10.041` | OMP TUI image/terminal edges are UX reference; JWC TUI visual invariants still apply. |
| `20.013` | `10.044` | OMP plugin registry/bundle facts must cross-link GJC plugin extensibility card. |
| `20.014` | `10.040` | OMP compaction/provider concurrency is reference-only; GJC compaction chase remains upstream parity card. |
| `20.012` / `20.015` | `10.047` / `10.048` | security/release facts are reference-only and must not imply direct import. |

## Planned index updates

- MODIFY `struct_har/chase/20_omp_chase_MOC.md`: replace `009+` placeholder with 20.009-20.015 rows.
- MODIFY `struct_har/chase/007_follow_index.md`: add OMP latest delta section after G2 table.
- MODIFY `struct_har/chase/002_gap_inventory.md`: add OMP 16.1.13→16.1.20 summary table.

## Card template requirements

Each new card must include:

- Reviewed source: OMP `cc0c67be` → `0fc6d136` and JWC worktree date.
- Source facts table with commit anchors and path anchors.
- JWC reconcile notes using reference-only language plus required GJC cross-link where applicable.
- Suggested split.
- Done gate.
- Verification section.
- Decision slots with classification `split` or `track-only`, not direct import.

## Verification

- Seven new files exist and are non-empty under `struct_har/chase/`.
- `20_omp_chase_MOC.md`, `007_follow_index.md`, and `002_gap_inventory.md` link all seven new cards.
- `rg 'cc0c67be|0fc6d136'` over the seven new cards returns matches in every card.
- `git -C devlog/_omp_chase/oh-my-pi diff --dirstat=files,0 cc0c67be..0fc6d136` evidence is captured in the Phase 3 synthesis/card set.
- Each new card has headings: `Source Facts`, `JWC Reconcile Notes`, `Suggested Split`, `Done Gate`, `Verification`, `Decision Slots`.
- Reference-only wording gate: cards must not contain `direct import`, `cherry-pick`, or `1:1 이식` as an adoption instruction.
- `git diff --check` passes over new cards and touched indexes.
