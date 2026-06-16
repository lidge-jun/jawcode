# 320 — Post-270 current-state triage

> Date: 260615. Scope: re-check and refine `270_jwc_ui_cli_selector.md` through `310_parity_verification_matrix.md` after jawcode development advanced.
> Method: local path search/read plus PABCD documentation pass over API-level surfaces.
> Correction: this folder intentionally records the cross-repo procedure for porting jawcode/JWC into cli-jaw, so cli-jaw paths being absent from this repo means "check in cli-jaw together with jawcode evidence," not "drop the slice."

## Conclusion

Execute the 270-310 band as a cross-repo cli-jaw porting queue. It mixes cli-jaw Manager/server implementation paths with jawcode contract/evidence paths that must be checked together.

| Slice | Current classification | Decision |
|---|---|---|
| `270_jwc_ui_cli_selector.md` | cli-jaw Manager selector + registry API step | Check cli-jaw selector/registry paths together with current jawcode package evidence. `PRIMARY_CLIS` alone is not the phase contract. |
| `280_default_cli_switch_e2e.md` | cli-jaw default-switch + message/SSE/persistence API step | Pair cli-jaw default runtime work with current `packages/jwc` smoke evidence and exact message/SSE/persistence paths. |
| `290_code_mode_acp_e2e.md` | jawcode ACP dispatcher resolved; cli-jaw REST/ACP proof remains | Verify `REST → AcpHost → jwc child → initialize/authenticate → session/new → session/prompt → session/update` in cli-jaw. |
| `300_code_mode_ui.md` | cli-jaw native Manager Code UI integration step | Implement/verify cwd-first composer-first Code mode using jawcode ACP/RPC/SDK surfaces as contract. |
| `301_manager_ui_code_jaw_design_interview.md` | Manager UI design source | Treat as completed design source: native JWC Code mode + existing Jaw mode JWC native runtime attach + hidden unauth model picker. |
| `302_p_documentation_plan.md` | PABCD docs-pass plan/receipts | Documents the API-level 270-310 crystallization and receipt sequence. |
| `305_jaw_mode_jwc_runtime_attach.md` | existing Jaw mode runtime attach | Existing Jaw mode/iframe remains; add `JWC` runtime/engine option with native attach. |
| `310_parity_verification_matrix.md` | cross-repo parity gate | Refresh rows with current jawcode evidence and cli-jaw evidence before default switch. |

## Path map

### 270 — Manager CLI selector

cli-jaw paths:

- `public/manager/src/settings/pages/components/agent/agent-meta.ts`
- `src/cli/registry.ts`
- `src/cli/registry-live.ts`
- `src/routes/settings.ts` → `GET /api/cli-registry`

Current jawcode package entry points to pair with the cli-jaw selector work:

- `packages/jwc/package.json` — package name `jawcode`, bin `jwc`, export `./sdk`.
- `packages/jwc/src/cli-entry.ts` — standalone package CLI entry.
- `packages/jwc/src/sdk.ts` — package SDK export surface.

### 280 — default CLI switch + e2e smoke

cli-jaw paths:

- `src/core/main-session.ts` — `resolveMainCli`, session row build/write.
- `src/routes/command.ts` — `POST /api/message`.
- `src/routes/events.ts` — `GET /api/events` worker/runtime SSE.
- `src/manager/server.ts` — `GET /api/manager/events/stream` Manager event SSE.
- `src/core/db.ts` — session persistence fields including `active_cli`.
- Default/rollback override — desired staged override; exact env/settings name is `TBD — cli-jaw checkout required` until verified in cli-jaw.

Current jawcode smoke/package evidence:

- `packages/jwc/package.json`
- `packages/jwc/scripts/smoke-node-sdk.mjs`
- `packages/jwc/scripts/smoke-node-streaming.mjs`
- `packages/jwc/scripts/smoke-packed-sdk.mjs`
- `packages/coding-agent/src/sdk.ts`
- `packages/jwc/src/sdk.ts`

### 290 — Code REST ↔ ACP activation

Current jawcode ACP implementation paths:

- `packages/coding-agent/src/cli/args.ts` — mode includes `acp`.
- `packages/coding-agent/src/commands/acp.ts` — `jwc acp` / ACP terminal-auth routing.
- `packages/coding-agent/src/main.ts` — `mode === "acp"` builds `createAcpSessionFactory(...)` and calls `runAcpMode(createAcpSession)`.
- `packages/coding-agent/src/modes/acp/acp-mode.ts` — ACP SDK `AgentSideConnection` over stdio.
- `packages/coding-agent/src/modes/acp/acp-agent.ts` — ACP session lifecycle implementation.
- `packages/coding-agent/src/modes/acp/acp-event-mapper.ts` — event mapping.

cli-jaw integration paths:

- `src/routes/code.ts` — `GET /api/code/git-info`, `GET/POST /api/code/sessions`, `POST /api/code/sessions/:id/prompt`, cancel/close, permission transport.
- `src/code-mode/acp-host.ts` — spawns `jwc --mode acp`, handshakes `initialize`/`authenticate`, calls `session/new`, `session/prompt`, relays `session/update`.
- `src/routes/events.ts` — `GET /api/events` for `jwc` topic updates.

Current jawcode coverage:

- `packages/coding-agent/test/acp-stdout-hygiene.test.ts`
- `packages/coding-agent/test/acp-initialize-conformance.test.ts`
- `packages/coding-agent/test/acp-agent.test.ts`
- `packages/coding-agent/test/acp-client-bridge.test.ts`
- `packages/coding-agent/test/acp-event-mapper.test.ts`
- `packages/coding-agent/test/acp-lazy-startup.test.ts`
- `packages/coding-agent/test/acp-mcp-isolation.test.ts`
- `packages/coding-agent/test/acp-builtins.test.ts`

### 300 — Manager code-mode UI

cli-jaw paths:

- `public/manager/`
- `public/manager/src/SidebarRailRouter.tsx`
- proposed `public/manager/src/code/CodeWorkspace.tsx`
- proposed `public/manager/src/code/CodeSessionPanel.tsx`
- `src/routes/code.ts`

Current jawcode user/integration surfaces:

- TUI: `packages/coding-agent/src/modes/interactive-mode.ts` and `packages/coding-agent/src/modes/components/`.
- ACP: `packages/coding-agent/src/modes/acp/`.
- RPC: `docs/rpc.md`.
- Bridge: `docs/bridge.md`.
- SDK: `docs/sdk.md`, `packages/coding-agent/src/sdk.ts`, `packages/jwc/src/sdk.ts`.

Corrected UI contract:

- Code mode is cwd/JWC-session scoped, not selected cli-jaw-instance scoped.
- Opening Code mode does not spawn JWC.
- First prompt creates a cwd-keyed JWC session.
- Main UI is composer-first and transcript-from-top, not session-list-first.
- Permission approval queue/cards are deferred; baseline is bypass/policy status.

### 301 — Manager UI design source

- `301_manager_ui_code_jaw_design_interview.md` is complete.
- It is the source for 300 Code UI, 305 Jaw runtime attach, and 310 parity rows.

### 302 — docs-pass PABCD receipts

Receipt sequence:

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
- `302.9.1_b_docs_pass_verifier_done.md`
- `302.9.2_b_docs_pass_done.md`
- `302.10_c_docs_pass_check.md`
- `302.11_d_docs_pass_summary.md`

B-stage documentation patch is DONE per `302.9.2_b_docs_pass_done.md`; C/D receipts remain the current loop tail until written.

### 305 — existing Jaw mode JWC native runtime attach

cli-jaw path map:

- existing Jaw runtime/engine selector path: `TBD — cli-jaw checkout required`.
- existing Jaw iframe/surface evidence: `public/manager/src/InstancePreview.tsx`, `public/manager/src/Workbench.tsx`, preview bridge files.
- native JWC attach hook path: `TBD — cli-jaw checkout required`.
- auth/model inventory bridge for Jaw mode: `GET /api/cli-registry`, `GET /api/quota`, settings/perCli model rows; exact JWC-specific bridge remains `TBD — cli-jaw checkout required`.

Decision:

- Existing Jaw mode/iframe is not redesigned.
- Runtime label is `JWC`.
- Selecting `JWC` should use native attach, not generic JSON-RPC-only integration if native attach is required.
- Jaw and Code transcripts/sessions must not be mixed.

### 310 — parity verification matrix

Rows already answerable from current jawcode paths:

- Session create/resume/list/fork: `docs/sdk.md`, `docs/session-switching-and-recent-listing.md`, `packages/coding-agent/src/session/session-manager.ts`.
- Prompt, steer/follow-up, abort: `docs/sdk.md`, `docs/rpc.md`, `packages/coding-agent/src/session/agent-session.ts`.
- Compact/export/share: `docs/compaction.md`, `docs/session-operations-export-share-fork-resume.md`, `packages/coding-agent/src/session/agent-session.ts`.
- Provider/model selection: `docs/models.md`, `structure/30_providers.md`, `packages/coding-agent/test/sdk-model-selection.test.ts`.
- Tool support: `docs/tools/`, `packages/coding-agent/src/tools/`, ACP filesystem tests such as `packages/coding-agent/test/read-acp-fs.test.ts` and `packages/coding-agent/test/write-acp-fs.test.ts`.
- MCP behavior: `packages/coding-agent/test/sdk-mcp-discovery.test.ts`, `packages/coding-agent/test/acp-mcp-isolation.test.ts`.
- ACP protocol: `packages/coding-agent/src/modes/acp/`, ACP tests listed above.
- Package smoke: `packages/jwc/scripts/`.

cli-jaw-side rows that require evidence from a cli-jaw checkout:

- cli-jaw default CLI switch.
- cli-jaw Manager UI.
- cli-jaw DB persistence.
- Telegram/Discord channel dispatch.
- cli-jaw orchestration/heartbeat/employee dispatch.
- Existing Jaw mode JWC runtime selector/native attach.
- Proposed `scripts/jwc-parity-smoke.mjs` and `smoke:jwc:parity` are not current jawcode scripts; keep them `TBD — cli-jaw checkout required` until verified in cli-jaw.

## Recommended follow-up

1. Finish this documentation-only PABCD loop.
2. For future implementation, open cli-jaw checkout alongside jawcode before touching implementation or resolving exact cli-jaw API paths.
3. Execute each phase through IPABCD/PABCD with phase-local artifacts, not append-only top-level P/A/B/C/D bands.
4. Before flipping cli-jaw defaults, refresh the 310 parity matrix with both current jawcode evidence and cli-jaw evidence.
