# 02 Phase map — repeated PABCD loops

Each row is a work-phase. Each work-phase must run a complete PABCD cycle and commit atomically.

## Phase 0 — planning scaffold

| Item | Value |
|---|---|
| Cards | all 27 immediate + 5 split-audit + 4 held |
| Output | this devlog folder |
| Code changes | none |
| Verification | docs audit, `git diff --check` |

## Phase 1 — notification foundation

| Item | Value |
|---|---|
| Cards | 10.028, 10.029 |
| Goal | JWC-native notification protocol/config/discovery foundation without ask/reply wiring, daemon inbound routing, or remote Telegram control. |
| Required plan artifact | `10_phase1_notification_foundation_plan.md` with exact owner files, TS/Rust boundary decision, settings schema touchpoints, and deferred 10.028 done-gate sub-slices. |
| Likely files | Exact files to be discovered in the Phase 1 plan; initial candidates are coding-agent config/command/test surfaces, not a broad `src/**` claim. |
| Review | Backend + Docs + security-focused review for token masking, discovery-file permissions, and connect-time token rejection |
| Gate | focused config/CLI tests, token masking/permission tests, `bun check` or package check as needed |

## Phase 2 — Telegram transport shell

| Item | Value |
|---|---|
| Cards | 10.030 |
| Goal | Managed transport shell with token/process guards and fail-closed inbound handling only. Inbound updates may be logged, dropped, or ack-only until 10.032 authorization lands. |
| Required plan artifact | `20_phase2_telegram_transport_plan.md` with daemon lifecycle, compiled entrypoint impact, token masking, and fail-closed inbound tests. |
| Risk | C4 security due to long-lived process and external channel. |
| Review | Backend + security-focused review |
| Gate | fail-closed tests, daemon lifecycle tests, no token leakage |

## Phase 3 — Telegram remote answer safety

| Item | Value |
|---|---|
| Cards | 10.032, 10.035 |
| Goal | Authorized remote ask answers and docs/adapters surface after transport guards exist. Threaded rendering, session lifecycle, and file transfer remain deferred. |
| Required plan artifact | `30_phase3_telegram_answers_plan.md` with authorization model, ask/reply race semantics, and docs examples using `jwc`/`.jwc`. |
| Risk | C4 security due to remote input. |
| Review | Backend + Docs + dedicated read-only security audit by an employee that did not implement the slice |
| Gate | authorization tests, stale/race answer tests, no token leakage, docs examples using `jwc`/`.jwc` |

## Phase 4 — Telegram threaded/lifecycle split

| Item | Value |
|---|---|
| Cards | 10.031, 10.033, 10.034 |
| Goal | Split threaded rendering, session lifecycle, and media/file transfer into safe adapt/reject/defer sub-slices. Code is allowed only after split artifacts exist. |
| Required split artifacts | `40_phase4_telegram_threading_split.md`, `41_phase4_telegram_lifecycle_split.md`, `42_phase4_telegram_media_split.md` |
| Risk | C4 security due to session control and file egress/ingress. |
| Review | Backend + Docs + security review; architecture review required for 10.033 |
| Gate | no code until split decisions are explicit; then authorization, path confinement, and lifecycle negative tests |

## Phase 5 — early release/test leak hardening

| Item | Value |
|---|---|
| Cards | 20.015 |
| Goal | Record OMP release/test leak overlap evidence and existing JWC guards early as a risk reducer; keep `20.015` reference-only and `10.048` as the release implementation owner unless a later audited code slice is chosen. |
| Required plan artifact | `50_phase5_release_test_leak_plan.md` with explicit `10.048` overlap cross-check before any `20.015` code |
| Review | Backend + Docs |
| Gate | docs audit, recorded `10.048` overlap outcome, and focused smoke of existing JWC guard scripts where appropriate. |

## Phase 6 — runtime and context integrity

| Item | Value |
|---|---|
| Cards | 10.037, 10.040, 10.051, 20.009 |
| Goal | Process lifecycle, compaction memory, composer/toolcall, append-only transcript guards. |
| Required plan artifact | `60_phase6_runtime_context_plan.md` |
| Required split artifacts | `61_phase6_runtime_process_split.md`, `62_phase6_compaction_memory_split.md`, `63_phase6_toolcall_context_split.md` |
| Review | Backend + architecture review |
| Gate | focused runtime/session tests, tool-choice queue tests, compaction tests, and append-only context regression evidence |

## Phase 7 — security, provider, and network guards

| Item | Value |
|---|---|
| Cards | 10.036, 10.038, 10.043, 10.047 |
| Goal | Auth/model catalog guardrails, RPC control-plane hardening, read-URL/search safety, privacy rules. |
| Required plan artifact | `70_phase7_security_provider_network_plan.md`; must include `_fin` overlap inventory before 10.038 coding. |
| Required split artifacts | `71_phase7_provider_auth_catalog_split.md`, `72_phase7_rpc_control_plane_split.md`, `73_phase7_search_url_boundary_split.md`, `74_phase7_security_privacy_split.md` |
| Risk | C4 security and public contract changes. |
| Review | Backend + security review |
| Gate | auth/config tests, RPC negative tests, network allow/deny tests, and redaction/env scrub regression evidence |

## Phase 8 — workflow, team, and packaging hardening

| Item | Value |
|---|---|
| Cards | 10.039, 10.042, 10.044, 10.045, 10.048, 10.050 |
| Goal | Evidence rollups, workflow state, plugin boundaries, desktop-control contracts, release/test gates, team/worktree hardening. |
| Required plan artifact | `80_phase8_workflow_team_packaging_plan.md` |
| Required split artifacts | `81_phase8_harness_rollup_split.md`, `82_phase8_goal_interview_state_split.md`, `83_phase8_plugin_extensibility_split.md`, `84_phase8_computer_use_native_split.md`, `85_phase8_release_packaging_split.md`, `86_phase8_team_worktree_split.md` |
| Review | Backend + Docs; Frontend only if TUI files are touched; security review required for 10.045 |
| Gate | workflow tests, plugin tests, release/check scripts |

## Phase 9 — TUI/perf/research/docs edge slices

| Item | Value |
|---|---|
| Cards | 10.041, 10.046, 10.049, 10.052 |
| Goal | Narrow TUI/input improvements, research routing, benchmark corpus, external integration docs. |
| Required plan artifact | `90_phase9_tui_perf_research_docs_plan.md` |
| Required split artifacts | `91_phase9_tui_input_render_split.md`, `92_phase9_research_mode_split.md`, `93_phase9_perf_corpus_split.md`, `94_phase9_external_docs_split.md` |
| Risk | Preserve curated TUI behavior. |
| Review | Frontend for TUI; Docs for docs-heavy slices |
| Gate | focused TUI tests or snapshot-equivalent checks, docs link checks |

## Phase 10 — OMP split-audit conditionals

| Item | Value |
|---|---|
| Cards | 20.010, 20.011, 20.012, 20.013, 20.014 |
| Goal | Split each OMP reference card into adapt/reject/defer sub-slices before code. |
| Required split artifacts | `100_phase10_omp_ai_oauth_split.md`, `101_phase10_omp_tui_image_split.md`, `102_phase10_omp_bash_env_split.md`, `103_phase10_omp_plugin_registry_split.md`, `104_phase10_omp_goal_provider_split.md` |
| Output | updated chase cards and implementation-ready follow-up slices |
| Review | Backend + Docs; security review for 20.010 and 20.012 |
| Gate | no code until split decisions are explicit |

The `20.012` split is scheduled in this phase instead of early implementation because command snapshot/env semantics are security-sensitive. If a later loop prioritizes it earlier, it must move only the split artifact first, not the code.
