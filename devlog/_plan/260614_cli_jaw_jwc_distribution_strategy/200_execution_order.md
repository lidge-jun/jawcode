# 200 — execution order

## Recommended order

1. **Doc closeout**
   - point root docs at this consolidated plan;
   - keep `_legacy/` as historical source.
2. **120 embedding contract**
   - freeze `jawcode/sdk`;
   - build/import smoke for non-TUI runtime.
3. **130 standalone package**
   - package `jawcode`, bin `jwc`;
   - managed Bun provisioning;
   - postinstall guard;
   - tarball/install smoke.
4. **140 local release readiness**
   - package publish readiness for `jawcode`;
   - local tarball/install smoke;
   - release artifact path and dry-run notes.
5. **150 active public visible cleanup**
   - docs/bin/artifacts/MCP names;
   - macOS-only Computer Use/CUA MCP defaults;
   - active public `gajae`/`gjc` zero in Jawcode;
   - regenerated cli-jaw embedded Jawcode runtime with active public `gajae`/`gjc` zero;
   - compatibility aliases where required, hidden from preferred public docs/errors.
6. **160 cli-jaw integration**
   - consume package dependency `jawcode`;
   - resident runtime service;
   - no-global-`jwc` smoke;
   - fallback and staged default switch;
   - design fresh GitHub Actions/release CI without upstream/self-hosted runner labels.

## Why this order

Embedding first proves cli-jaw can own the product goal. Packaging second proves standalone JWC is real. Local release readiness comes before remote CI, so deleted GitHub Actions workflows do not block the package/import/runtime work needed for 120–150.

## First implementation PR stack

1. jawcode: `jawcode/sdk` embedding facade smoke.
2. jawcode: `jawcode` package dry run with `jwc` bin and managed Bun.
3. jawcode: postinstall safe-mode.
4. cli-jaw: consume package dependency behind explicit setting.
5. cli-jaw: no-global-`jwc` smoke.
6. jawcode: macOS-only Computer Use/CUA default restore and package validation.
7. both: visible JWC/Jawcode artifact transition and active public `gajae`/`gjc` zero guard.
8. jawcode: design and approve a fresh GitHub Actions/release CI policy before restoring workflow files.

## Completed phases (as of 260614)

| Range | Status | Evidence |
|-------|--------|----------|
| 000-099 | ✅ DONE | JWC standalone stabilization, 99 band |
| 100-150 | ✅ DONE | SDK/package/cleanup/identity |
| 160-172 | ✅ DONE | 12 marathon slices, all verified |
| 180-184 | ✅ DONE | npm published, CI redesigned |
| 190-260 | ✅ DONE | Risks, order, audit, publish, cleanup, coordinator rename |

## Post-270 current-state triage (260615)

The 270-310 band is a cross-repo porting queue for embedding jawcode/JWC into cli-jaw. It is kept in this jawcode devlog intentionally, but each slice must be read with two path sets:

1. current jawcode contract/evidence paths in this repo;
2. cli-jaw implementation/API/frontend paths in a cli-jaw checkout.

7. **270 Manager UI CLI selector**
   - target: cli-jaw Manager selector and registry API;
   - cli-jaw paths checked: `src/routes/settings.ts` exposes `GET /api/cli-registry`, `src/cli/registry.ts`, `src/cli/registry-live.ts`, `public/manager/src/settings/pages/components/agent/agent-meta.ts`;
   - jawcode evidence to pair: `packages/jwc/package.json`, `packages/jwc/src/sdk.ts`.
8. **280 Default CLI switch + e2e smoke**
   - target: cli-jaw default runtime selection and main message/SSE/persistence API;
   - cli-jaw paths checked: `src/core/main-session.ts` (`resolveMainCli`, session persistence fields), `src/routes/command.ts` (`POST /api/message`), `src/routes/events.ts` (`GET /api/events`), `src/manager/server.ts` (`GET /api/manager/events/stream`), `src/core/db.ts` (`session.active_cli`);
   - current jawcode evidence: `packages/jwc/package.json`, `packages/jwc/src/sdk.ts`, `packages/jwc/scripts/smoke-node-sdk.mjs`, `packages/jwc/scripts/smoke-node-streaming.mjs`, `packages/jwc/scripts/smoke-packed-sdk.mjs`.
9. **290 Code mode ACP end-to-end**
   - jawcode side: ACP dispatcher resolved;
   - cli-jaw paths checked: `src/routes/code.ts`, `src/code-mode/acp-host.ts`;
   - jawcode paths: `packages/coding-agent/src/cli/args.ts`, `packages/coding-agent/src/commands/acp.ts`, `packages/coding-agent/src/main.ts`, `packages/coding-agent/src/modes/acp/acp-mode.ts`;
   - jawcode coverage: `packages/coding-agent/test/acp-stdout-hygiene.test.ts` plus ACP tests listed in `320`;
   - cli-jaw proof to collect: `REST → AcpHost → jwc child → initialize/authenticate → session/new → session/prompt → session/update`.
10. **300 Code mode Manager UI**
   - target: cli-jaw Manager native Code mode frontend;
   - corrected UX: cwd-first/composer-first, not instance-scoped and not session-list-first;
   - cli-jaw paths to check: `public/manager/`, `public/manager/src/SidebarRailRouter.tsx`, proposed `public/manager/src/code/CodeWorkspace.tsx`, proposed `public/manager/src/code/CodeSessionPanel.tsx`, `src/routes/code.ts`;
   - jawcode contract surfaces: ACP `packages/coding-agent/src/modes/acp/`, RPC `docs/rpc.md`, bridge `docs/bridge.md`, SDK `docs/sdk.md`, TUI parity reference `packages/coding-agent/src/modes/interactive-mode.ts`.
10a. **301 Manager UI design crystallization**
   - source: `301_manager_ui_code_jaw_design_interview.md`;
   - key decisions: Code mode is cwd/JWC-session scoped; opening Code mode does not spawn JWC; first prompt starts the session; unauth provider/model rows are hidden until `/login` Auth Center; existing Jaw mode receives `JWC` as native runtime.
10b. **302 PABCD documentation handoff**
   - source: `302_p_documentation_plan.md`;
   - target: run this documentation update through PABCD once, then execute future implementation phase-by-phase through IPABCD/PABCD;
   - receipt sequence for this docs pass:
     - `302_p_documentation_plan.md`
     - `302.1_p_critic_round1.md`
     - `302.2_p_synthesis_round1.md`
     - `302.3_p_critic_round2.md`
     - `302.4_a_docs_pass_planner_round1.md`
     - `302.5_a_docs_pass_architect_round1.md`
     - `302.6_a_docs_pass_synthesis_round1.md`
     - `302.7_a_docs_pass_planner_delta.md`
     - `302.8_a_docs_pass_architect_delta.md`
     - `302.9_b_docs_pass_patch.md`
     - `302.10_c_docs_pass_check.md`
     - `302.11_d_docs_pass_summary.md`
10c. **305 Existing Jaw mode JWC native runtime attach**
   - target: existing cli-jaw Jaw mode/iframe stays; add `JWC` runtime/engine option with native attach;
   - cli-jaw paths: selector/iframe/native attach paths must be checked in cli-jaw checkout or marked `TBD — cli-jaw checkout required`;
   - jawcode evidence: `packages/jwc/src/sdk.ts`, `docs/sdk.md`, `docs/models.md`, `docs/auth-broker-gateway.md`.
11. **310 Parity verification matrix**
   - target: cross-repo parity gate before cli-jaw default switch;
   - jawcode evidence lives in `docs/sdk.md`, `docs/session-operations-export-share-fork-resume.md`, `docs/session-switching-and-recent-listing.md`, `docs/compaction.md`, `docs/rpc.md`, `packages/coding-agent/src/session/agent-session.ts`, `packages/coding-agent/src/session/session-manager.ts`, `packages/coding-agent/src/modes/acp/`, and `packages/jwc/scripts/`;
   - cli-jaw evidence to collect: Manager UI, default CLI, DB persistence, channel dispatch, orchestration, heartbeat, employee dispatch, and existing Jaw mode JWC runtime attach.

## Active folder hygiene

The active range for this strategy is `000` through `320`. Completed ranges (000-260) are kept as historical evidence. The 270-310 range remains the active cross-repo cli-jaw porting queue.

PABCD artifacts must be placed inside the relevant phase sequence using sortable point files, not append-only top-level P/A/B/C/D bands. For this docs pass, use the `302.x_*` receipt sequence listed above.
