# 20 — omp_chase_MOC (omp 따라잡기)

> 상태: 🟡 운영 중 (2026-06-16)
> **정본 디렉터리**: `struct_har/chase/20_*` · `20.NNN_*`
> **의미**: `devlog/_upstream_omp` 대비 jwc **약함(G2)** — 참조·설계 (`20.NNN`). **1:1 이식 ❌**

## 번호

| **20** | 본 MOC |
| **20.NNN** | `20.001_…` 파일명 |

규약: [005_devlog_numbering.md](./005_devlog_numbering.md)

## 링크

| | |
|---|---|
| G2 | [002_gap_inventory.md](./002_gap_inventory.md) |
| 참조 | [004_reference_from_omp.md](./004_reference_from_omp.md) |
| omp | [../omp_origin/](../omp_origin/) |
| 따라갈 순 | [007_follow_index.md](./007_follow_index.md) |

## Reviewed through

| omp | jwc |
|---|---|
| `dc14689fc` (16.0.2) | `d60b7822` (worktree) |

> GJC head is intentionally not repeated here; see [10_gjc_chase_MOC.md](./10_gjc_chase_MOC.md).

## Recent reference-only deltas

| 영역 | OMP source facts | jwc 처리 |
|---|---|---|
| task-agent discovery | `.omp/agents` roots and Claude plugin roots; first-wins exact-name dedup; execution-time rediscovery; `read-summarize: false`; plan-mode tool narrowing (`devlog/_upstream_omp/docs/task-agent-discovery.md:38,59,68-77,114,126-130,180-186`) | 030/099 참조; jwc role-agent 4종 표면 유지 |
| task tool lifecycle | batch default-on, required shared `context`, no per-call `schema`, async jobs, `agent://`/`history://`, yield-required finish, idle/parked revival, semaphore/recursion gates, IRC follow-up (`docs/tools/task.md:29-46,52-58,69-71,76-97,132-140,157-163`) | subagent UX/contract gap으로만 분해 |
| session ops | export `subSessions`, custom share failure no-fallback, encrypted share, fork parentSession metadata, cross-project resume re-root/fork, rollback switch caveats (`docs/session-operations-export-share-fork-resume.md:21-28,45,115-130,181-190,236-249,257-277,313-327`) | operator semantics 후보 |
| memory | disabled-by-default local pipeline, Memory Guidance injection, `memory://`, extraction/consolidation, redaction, model-role fallback (`docs/memory.md:3-5,16-24,28-30,44-56,76-89,95-98`) | 99.01 후보 |
| compaction pruning | superseded read pruning, useless-result elision, protected tools, 40k protect/20k min savings, suffix/idle prompt-cache-aware flush (`packages/agent/src/compaction/pruning.ts:19-39,48-70,108-138,146-165,171-215,243-274,284-331`) | 083/session 후보 |
| steering delivery | yield-boundary `lateSteering` re-poll; settle-time stranded queue drain; steer image-normalization idle mirror (`packages/agent/src/agent-loop.ts:818-826`, `agent-session.ts:1147-1158,5273-5280`, `42ffc83`) | **[20.005](./20.005_omp_chase_steering_delivery.md)** — jwc 부분 보유, gjc 미수용 |
| TUI 입력 micro | Esc draft clear + selector `resetDisplay` (`e914bf0`); double-esc history **revert** (`d055f64`); ast-edit status 공백 축약 (`3d646d8`) | **[20.006](./20.006_omp_chase_tui_input_micro_fixes.md)** — collab/brew 커밋은 lineage 부재로 비채택 |
| OMP 15.12→15.13 | session split, auto-learn, STT/TTS, compaction UI | [20.008](./20.008_omp_chase_pull_15_13_delta.md) |
| OMP 15.13→16.0.2 | profiles, advisor, dialect/tool schema, task coordination, plugins, terminal resilience, review PR URLs, unexpected-stop retry | [20.009](./20.009_omp_chase_profiles_aliases.md)–[20.017](./20.017_omp_chase_unexpected_stop_detection.md) |
| steering/job polling | interruptible tool polling for queued steering + streaming `/tan` queueing | update [20.005](./20.005_omp_chase_steering_delivery.md) |
| TUI terminal resilience | keypad CSI-u, xterm scroll suppression, multiplexer detection, resize guards | [20.015](./20.015_omp_chase_terminal_resilience.md) + update [20.006](./20.006_omp_chase_tui_input_micro_fixes.md) |

## 활성 (`20.NNN`)

| NNN | 문서 | 스코프 | jaw | 상태 |
|---|---|---|---|---|
| 001 | [20.001_omp_chase_cycle.md](./20.001_omp_chase_cycle.md) | fetch·regen | struct_har | 🟡 |
| 002 | [20.002_omp_chase_worker_catalog.md](./20.002_omp_chase_worker_catalog.md) | worker | 100 | ⬜ |
| 003 | [20.003_omp_chase_memory_skills.md](./20.003_omp_chase_memory_skills.md) | memory·skills | 99.01 | ⬜ |
| 004 | [20.004_omp_chase_lsp_dap.md](./20.004_omp_chase_lsp_dap.md) | LSP/DAP | 081 | ⬜ |
| 005 | [20.005_omp_chase_steering_delivery.md](./20.005_omp_chase_steering_delivery.md) | steer/followUp 전달 | session | ⬜ |
| 006 | [20.006_omp_chase_tui_input_micro_fixes.md](./20.006_omp_chase_tui_input_micro_fixes.md) | Esc·ast status | 082·99.20 | ⬜ |
| 007 | [20.007_omp_chase_session_modularization.md](./20.007_omp_chase_session_modularization.md) | session modules | 083 | ⬜ |
| 008 | [20.008_omp_chase_pull_15_13_delta.md](./20.008_omp_chase_pull_15_13_delta.md) | 15.13 index | 횡단 | 🟡 |
| 009 | [20.009_omp_chase_profiles_aliases.md](./20.009_omp_chase_profiles_aliases.md) | profiles/auth isolation | P2 | ⬜ |
| 010 | [20.010_omp_chase_advisor_review_lane.md](./20.010_omp_chase_advisor_review_lane.md) | advisor/WATCHDOG | P2 | ⬜ |
| 011 | [20.011_omp_chase_tool_dialect.md](./20.011_omp_chase_tool_dialect.md) | tool dialects | **P1** | ⬜ |
| 012 | [20.012_omp_chase_ai_tool_schema_streaming.md](./20.012_omp_chase_ai_tool_schema_streaming.md) | AI schema/stream | **P1** | ⬜ |
| 013 | [20.013_omp_chase_task_coordination.md](./20.013_omp_chase_task_coordination.md) | task coordination | P2 | ⬜ |
| 014 | [20.014_omp_chase_extensions_plugins.md](./20.014_omp_chase_extensions_plugins.md) | extensions/plugins | P3 | ⬜ |
| 015 | [20.015_omp_chase_terminal_resilience.md](./20.015_omp_chase_terminal_resilience.md) | terminal resilience | P2 | ⬜ |
| 016 | [20.016_omp_chase_review_pr_url.md](./20.016_omp_chase_review_pr_url.md) | review PR URLs | P3 | ⬜ |
| 017 | [20.017_omp_chase_unexpected_stop_detection.md](./20.017_omp_chase_unexpected_stop_detection.md) | unexpected-stop retry | P2 | ⬜ |
| 018+ | _(미할당)_ | | | ⬜ |

## 완료

→ [_fin/20/](./_fin/20/README.md)

## gjc

[10_gjc_chase_MOC.md](./10_gjc_chase_MOC.md)