# 302 — P plan: API-level documentation pass for cli-jaw × JWC porting phases

> Stage: PABCD P-stage plan draft.
> Status: revised after Critic round 1 and A-stage audit round 1 (`302.6_a_docs_pass_synthesis_round1.md`).
> Goal scope: documentation-only PABCD over the 270–310 cli-jaw/JWC porting band.
> Source interview: `301_manager_ui_code_jaw_design_interview.md`.
> Mutation boundary: devlog/planphase documentation only. No jawcode or cli-jaw product-source mutation in this goal.

## Goal

Refine the whole 270–310 phase band at **API-unit precision** so future implementation can proceed phase-by-phase through IPABCD/PABCD without rediscovering the integration surface.

This is not just a UI wording update. The deliverable is a connected cross-repo documentation layer that maps:

```text
jawcode/JWC contract APIs
→ cli-jaw backend APIs/runtime host points
→ cli-jaw Manager frontend screens/state/mockups
→ verification/parity evidence rows
```

The docs must preserve the user's corrected design decisions:

1. **JWC Code mode** is a native cli-jaw Manager UI surface independent from cli-jaw instances. It selects/uses a cwd, waits for the first prompt, then spawns/attaches `jwc` in that cwd.
2. **JWC inside Jaw mode** uses the already-existing cli-jaw Jaw mode/iframe. It adds `JWC` to the existing runtime/engine selector and attaches through a custom native path comparable in product role to `claude-e`; do not redesign the Jaw iframe shell.
3. **Provider/model exposure** hides unauthenticated providers/models from normal pickers. `/login` Auth Center is the discovery/login surface.
4. **Code composer** has left `Ask permissions / + / mic` and right `provider / model / effort / context spinner`; provider/model become session identity after start, effort changes next turn.
5. **Permission UI** remains baseline bypass/policy status only for this slice; detailed approval queue/cards are explicitly deferred.
6. **Phase discipline**: this folder intentionally records the procedure for porting jawcode/JWC into cli-jaw. cli-jaw paths and jawcode evidence paths must be documented together even when cli-jaw paths are absent from this repo.

## Non-goals

- Do not implement cli-jaw UI/backend or jawcode runtime changes in this goal.
- Do not modify product source files.
- Do not redesign existing Jaw mode iframe shell.
- Do not make unauthenticated provider/model rows visible-but-disabled in the normal picker.
- Do not force JWC through a generic JSON-RPC-only runtime path if the documented design calls for native attach.
- Do not add detailed permission approval UI mechanics unless a later phase explicitly reopens that scope.

## A-stage round 1 mandatory deltas

These deltas supersede any earlier wording that could be read additively. B-stage must implement them mechanically.

### 270 replacement requirements

- `270_jwc_ui_cli_selector.md` must not remain a PRIMARY_CLIS-only implementation note.
- Replace/demote the existing “add jwc to PRIMARY_CLIS / CLI_META / remove experimental flag” framing so the owning contract is:
  1. jawcode package evidence;
  2. cli-jaw registry API;
  3. Manager primary selector frontend.
- Negative acceptance: `270` must not imply that editing `PRIMARY_CLIS` alone satisfies the phase.

### 280 exact path requirements

- Resolve exact cli-jaw message POST route, SSE/event stream route, and persistence field/table from a cli-jaw checkout.
- If unavailable, use the canonical blocker string exactly: `TBD — cli-jaw checkout required`.
- Do not leave unqualified placeholders such as “message API” or “SSE path” without either an exact path or that blocker string.

### 290 stale ACP/permission cleanup requirements

- Delete/replace stale claims that jawcode ACP dispatcher is missing.
- Delete/replace the old conditional branch that treated ACP mode as potentially absent.
- Delete/replace the old nonexistent jawcode ACP-server-file instruction.
- Downgrade/remove permission relay E2E as a required slice goal; permission behavior for this docs pass is bypass/policy status only.
- Negative acceptance: `290` must not require permission approval queue/card E2E in this slice.

### 300 replacement requirements

- Delete/replace session-list-first layout as the primary Code mode design.
- Delete/replace detailed permission-card UI as a required Code mode surface.
- Delete/replace multi-session-first/concurrent-session acceptance as core UX.
- Delete/replace verification text that requires answering permission requests in the browser.
- Positive acceptance:
  - opening Code mode does not spawn JWC;
  - first prompt creates a cwd-keyed JWC Code session;
  - transcript renders from the top and the composer remains the primary input.

### 310 merge requirements

- Do not leave cli-jaw parity harness scripts reading as runnable from jawcode.
- Mark cli-jaw parity harness references with `TBD — cli-jaw checkout required` unless verified in cli-jaw.
- Merge new rows into existing A–E sections or add a linked section F that explicitly cross-references A–E.

### Auth inventory ownership

- `300` must own the frontend/Auth Center behavior.
- `310` Section C (Provider/model) must own the parity row.
- The concrete cli-jaw endpoint/bridge must be resolved from cli-jaw checkout or marked `TBD — cli-jaw checkout required`.

### 000/200 ordering requirements

- B-stage must update `000` and `200` before detailed slice edits so future agents see 301/302/305 before entering 270–310.
- `200` must list 301/302/305 between 300 and 310 and include docs-pass receipt names:
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

### C-stage stale-string checks

C-stage must fail if updated docs still contain stale required guidance for:

- old nonexistent jawcode ACP-server-file instruction;
- old conditional wording that treats ACP mode as absent;
- detailed permission-card UI as a required Code mode surface;
- session-list-first wording as the primary Code mode layout;
- cli-jaw parity harness scripts as jawcode-runnable commands.

## Source documents to update

| File | Role in this PABCD | Required update theme |
|---|---|---|
| `000_moc_distribution_strategy.md` | index/MOC | add 301/302/305 and explain them as documentation/API crystallization artifacts inside the 300-band |
| `200_execution_order.md` | phase execution order | add 301/302/305 and describe phase-by-phase IPABCD placement |
| `270_jwc_ui_cli_selector.md` | selector/API phase | replace PRIMARY_CLIS-only framing with Manager selector + `/api/cli-registry` API contract |
| `280_default_cli_switch_e2e.md` | default runtime/API phase | refine as `resolveMainCli` + exact message/SSE/persistence API contract tied to jawcode package smoke evidence |
| `290_code_mode_acp_e2e.md` | code backend/API phase | remove stale ACP-missing and permission-relay requirements; define `REST → AcpHost → ACP JSON-RPC stdio → JWC session/update` contract |
| `300_code_mode_ui.md` | frontend/mockup phase | replace contradictory session-list/permission-card assumptions with cwd-first composer-first Code mode contract from 301 |
| `301_manager_ui_code_jaw_design_interview.md` | design source | mark interview complete and point to 302 PABCD doc pass |
| `305_jaw_mode_jwc_runtime_attach.md` (NEW) | Jaw runtime attach phase | document existing Jaw mode `JWC` runtime selector/native attach API + frontend acceptance without redesigning iframe shell |
| `310_parity_verification_matrix.md` | parity gate | merge API/frontend parity rows into existing A–E sections or a clearly linked section F |
| `320_post270_current_state_triage.md` | current-state map | add 301/302/305 and state that 270–310 require API + frontend mockup pairing |

## B-stage prerequisite: cli-jaw checkout evidence

Before applying the documentation patch in B-stage, the agent must verify whether a cli-jaw checkout is available in the expected workspace. This is still a documentation-only goal, but exact API names in 270/280/290/305 require cli-jaw evidence.

B-stage rule:

```text
1. Locate/read cli-jaw checkout paths for referenced cli-jaw APIs.
2. If available, fill exact API route/path names in docs.
3. If unavailable, do not invent paths. Mark the doc row as `TBD — cli-jaw checkout required` and record it as a blocker/follow-up.
```

Exact-path resolution targets:

- 270: `/api/cli-registry`, `src/cli/registry.ts`, `src/cli/registry-live.ts`, Manager selector metadata path.
- 280: message POST endpoint, SSE/event stream endpoint, DB persistence field/table evidence, `resolveMainCli`, and exact rollback/default override; use `TBD — cli-jaw checkout required` if the override is not verified.
- 290: all Code REST routes, AcpHost methods/events, ACP stdio frame names.
- 305: existing Jaw mode runtime/engine selector path, native runtime attach hook path, existing iframe/surface path.
- Auth inventory: concrete cli-jaw endpoint/bridge that exposes authenticated JWC provider/model inventory to Manager, or explicit blocker if absent.

## API connection map to document

### Phase 270 — Manager selector / registry API

Document the API unit as:

```text
jawcode package evidence
  - `packages/jwc/package.json` (`jawcode`, bin `jwc`, export `./sdk`)
  - `packages/jwc/src/sdk.ts`
→ cli-jaw registry backend
  - `src/cli/registry.ts`
  - `src/cli/registry-live.ts`
  - `/api/cli-registry`
→ Manager frontend selector
  - `public/manager/src/settings/pages/components/agent/agent-meta.ts`
  - Settings > Agent CLI dropdown
```

Required 270 doc changes:

- Replace/demote “add jwc to `PRIMARY_CLIS`” from the whole phase goal into one possible frontend implementation detail.
- Reframe the phase as “make JWC visible through the registry API and primary selector.”
- Add expected API response shape notes:
  - registry entry key: `jwc`;
  - package/runtime label: `JWC` / `Jawcode` as appropriate;
  - default model/effort fields should be sourced from cli-jaw registry, not hardcoded in UI only;
  - UI metadata icon/description is frontend decoration, not runtime truth.
- Add frontend acceptance mockup notes:
  - Settings/Agent selector shows `JWC` in primary choices;
  - no overflow-only discovery for JWC;
  - selector still coexists with `claude-e` and other runtimes.
- Negative acceptance: the doc must not imply that `PRIMARY_CLIS` alone satisfies 270.

### Phase 280 — default runtime / message API / persistence API

Document the API unit as:

```text
jawcode package/smoke evidence
  - `packages/jwc/scripts/smoke-node-sdk.mjs`
  - `packages/jwc/scripts/smoke-node-streaming.mjs`
  - `packages/jwc/scripts/smoke-packed-sdk.mjs`
→ cli-jaw runtime resolution
  - `resolveMainCli`
  - exact rollback/default override, or `TBD — cli-jaw checkout required` until verified
  - `src/core/main-session.ts`
→ cli-jaw user prompt API
  - exact message POST endpoint resolved from cli-jaw checkout, or `TBD — cli-jaw checkout required`
  - exact SSE/event stream endpoint resolved from cli-jaw checkout, or `TBD — cli-jaw checkout required`
→ persistence evidence
  - exact DB/session/message persistence field resolved from cli-jaw checkout, or `TBD — cli-jaw checkout required`
```

Required 280 doc changes:

- Keep default switch plan but add the backend API path chain.
- Make rollback explicit: a verified env/settings override can revert default without removing JWC selector support; until verified, record the override as `TBD — cli-jaw checkout required` rather than naming an invented variable.
- Add exact-path acceptance:
  - message POST route is named or explicitly marked `TBD — cli-jaw checkout required`;
  - SSE/event stream route is named or explicitly marked `TBD — cli-jaw checkout required`;
  - persistence evidence path/field is named or explicitly marked `TBD — cli-jaw checkout required`.
- Add smoke acceptance fields:
  - request includes explicit/default `cli: 'jwc'`;
  - response stream reaches done event;
  - persisted session/message row records `jwc`;
  - existing explicit `active_cli` sessions remain respected.
- Clarify that provider credentials may be real or test-provider based; the smoke should prefer deterministic/mock-provider where possible.

### Phase 290 — Code backend REST ↔ ACP JSON-RPC ↔ JWC session API

Document the API unit as:

```text
Manager Code REST/API surface in cli-jaw
  - `src/routes/code.ts`
  - exact Code session/prompt/cancel/status routes from cli-jaw checkout
→ cli-jaw ACP host
  - `src/code-mode/acp-host.ts`
  - child process spawn/stdio framing
→ JWC ACP stdio JSON-RPC
  - `initialize`
  - `authenticate`
  - `session/new`
  - `session/prompt`
  - `session/update` notifications
→ jawcode implementation evidence
  - `packages/coding-agent/src/cli/args.ts`
  - `packages/coding-agent/src/commands/acp.ts`
  - `packages/coding-agent/src/main.ts`
  - `packages/coding-agent/src/modes/acp/`
  - ACP tests listed in `320`
```

Required 290 doc changes:

- Delete/replace the stale conditional ACP-absence branch because current `320` says jawcode ACP dispatcher concern is resolved.
- Delete/replace the old nonexistent jawcode ACP-server-file instruction.
- Convert 290 into a cross-repo boundary verification plan:
  - cli-jaw REST session creation must cause AcpHost to spawn/attach `jwc`;
  - ACP initialize/authenticate/session lifecycle must complete;
  - prompt must stream `session/update` into cli-jaw event/SSE state;
  - failures must map to Manager-visible status/error events.
- Add API trace table with columns: step, request/event, owner repo, expected evidence, exact path status.
- Remove/downgrade permission relay E2E from required scope. Permission for this docs pass is bypass/policy status only.
- Negative acceptance: the doc must not require permission approval queue/card E2E in this slice.

### Phase 300 — Manager frontend UI / mockup / state API

Document the frontend unit as:

```text
Manager Code route/shell
→ cwd/project state
→ empty composer
→ first prompt starts JWC session
→ transcript/tool/status event rendering
→ composer footer controls
→ Auth Center modal
→ lightweight side/progressive panels
```

Required 300 doc changes are **replace-oriented**, not additive-only.

Remove/replace current contradictory assumptions:

- Replace old left-panel/session-list-first primary layout wording with cwd-first/composer-first layout.
- Replace old detailed permission-card requirements with bypass/policy status baseline and deferred approval mechanics.
- Replace “Multiple concurrent sessions supported up to maxConcurrentSessions: 4” as core acceptance with “session list/recent sessions may exist, but Code mode primary state is cwd + active JWC session, not cli-jaw instance card or heavy session-list-first UI.”
- Replace verification text that requires answering permission requests in the browser.

Add corrected contract:

- Code mode is independent from cli-jaw instances.
- Code mode is cwd/JWC-session scoped.
- Opening Code mode does not spawn JWC.
- First prompt creates cwd-keyed JWC Code session.
- Main canvas is spacious, transcript renders from top, composer is the primary input.
- Shell chrome must fix `CLI-JAW DASH` alignment next to macOS traffic lights.
- Left navigation remains app/session shell but Code state is not selected cli-jaw instance state.
- Workspace chips: `Local`, repo name, branch, worktree.
- Composer footer left: `Ask permissions`, `+`, `mic`.
- Composer footer right: provider/model/effort/context spinner.
- Progressive panels: folders/diff/tools/auth as needed, not forced heavy columns.
- Normal picker contains authenticated/available provider/model only.
- Unauthenticated provider/model discovery happens in `/login` Auth Center.
- Successful auth refreshes inventory without full reload.
- Before session: provider/model/effort mutable.
- After session: provider/model changes propose new Code session; effort changes apply next turn and log a status event.

Positive acceptance criteria:

- [ ] Opening Code mode does not spawn JWC.
- [ ] First prompt creates a cwd-keyed JWC Code session.
- [ ] Transcript renders from the top and composer remains the primary input.

Negative acceptance criteria:

- [ ] 300 no longer presents left session list as the primary Code mode layout.
- [ ] 300 no longer requires permission approval cards/queue in this slice.
- [ ] 300 no longer implies Code mode is tied to a selected cli-jaw instance.

### Phase 301 — interview source crystallization

Required 301 doc changes:

- Mark status as complete.
- Replace “Open questions / Round 10” with crystallization decision:
  - user requested `/goal plan` and full PABCD documentation pass;
  - 301 is now the design source for 300/305/310/320 updates;
  - remaining details move to phase-specific IPABCD, not more interview rounds.

### Phase 305 — existing Jaw mode JWC runtime attach (NEW)

Create a new docs-pass phase file because Jaw runtime attach is distinct from Code mode UI and was missing a documentation owner.

Proposed path: `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/305_jaw_mode_jwc_runtime_attach.md`

Content outline:

```markdown
# 305 — Existing Jaw mode JWC native runtime attach

> Documentation/API contract. Repo for implementation: cli-jaw. Evidence repo: jawcode.

## Goal
Add `JWC` to the existing cli-jaw Jaw mode runtime/engine selector and attach it through the custom native JWC path without redesigning the existing Jaw iframe/surface.

## API/runtime contract
- Existing Jaw mode selector path: TBD — cli-jaw checkout required
- Existing Jaw iframe/surface path: TBD — cli-jaw checkout required
- Native attach hook path: TBD — cli-jaw checkout required
- Jawcode evidence: `packages/jwc/src/sdk.ts`, `docs/sdk.md`, `docs/models.md`, `docs/auth-broker-gateway.md`

## Frontend acceptance sketch
- Runtime label is `JWC`.
- `JWC` appears beside existing runtime/engine choices such as `claude-e`.
- Selecting `JWC` does not replace Jaw mode UI with Code mode composer/footer.
- Jaw and Code transcripts/sessions remain separate.
- Auth/model inventory can be shared where useful, but control placement follows existing Jaw mode UI.

## Not in scope
- Redesigning Jaw iframe shell.
- Forcing JWC through generic JSON-RPC when native attach is required.
```

### Phase 310 — parity verification matrix across APIs

Merge rows into existing matrix sections rather than duplicating contradictions:

- Section A Core session lifecycle:
  - default runtime persistence;
  - Code cwd session scoping;
  - provider/model session identity.
- Section B Streaming/events:
  - ACP `session/update` → cli-jaw SSE/Manager render path.
- Section C Provider/model:
  - authenticated-only normal picker;
  - `/login` Auth Center discovery;
  - auth inventory route/bridge resolved or `TBD — cli-jaw checkout required`;
  - effort next-turn mutability.
- Section D Tool support:
  - permission baseline status only; detailed approval queue deferred.
- Section E Integration surfaces:
  - existing Jaw mode `JWC` runtime attach;
  - Manager Code route frontend mockup;
  - chrome/logo polish;
  - cli-jaw parity harness marked `TBD — cli-jaw checkout required` unless verified.

If a new Section F is added for Manager frontend UX, it must cross-link to A–E rows and state it is a frontend acceptance layer over those API dimensions.

Required rows:

| Dimension | jawcode/JWC evidence | cli-jaw/API evidence to collect | frontend/mockup evidence |
|---|---|---|---|
| Registry selector | `packages/jwc/package.json`, `packages/jwc/src/sdk.ts` | `/api/cli-registry`, registry live output | Settings selector shows JWC primary |
| Default runtime | JWC package smoke scripts | `resolveMainCli`, message API, SSE, DB persist | default session shows JWC/runtime label |
| Code REST/ACP | ACP implementation/tests | `src/routes/code.ts`, `AcpHost`, ACP stdio trace | Code route can create session/send prompt/render stream |
| Code cwd scoping | JWC session concepts | cwd + JWC session id state | empty composer with cwd chips, first prompt starts session |
| Auth/model inventory | `docs/models.md`, `docs/auth-broker-gateway.md` | concrete auth/model endpoint or bridge, or `TBD — cli-jaw checkout required` | unauth entries hidden; `/login` Auth Center reveals after success |
| Model mutation | JWC session/model config docs | session runtime config persistence | provider/model new-session CTA; effort next-turn mutable |
| Existing Jaw mode runtime | JWC native attach design | existing Jaw runtime/engine selector includes `JWC` | Jaw UI keeps existing layout, no Code composer graft |
| Permission baseline | current Jaw Code behavior | bypass/policy status channel | no forced approval queue/cards in this slice |
| Chrome/logo polish | user screenshot evidence | Manager shell chrome CSS/layout | no traffic-light/title overlap |
| Parity harness | `packages/jwc/scripts/*` only for jawcode evidence | cli-jaw harness `TBD — cli-jaw checkout required` | not claimed runnable from jawcode |

### Phase 320 — current-state triage / execution control

Required 320 doc changes:

- Add `301`, `302`, and `305` to the conclusion table.
- Add a 305 path-map subsection with stubs:
  - existing Jaw mode runtime/engine selector path: `TBD — cli-jaw checkout required`;
  - existing Jaw iframe/surface path: `TBD — cli-jaw checkout required`;
  - native JWC attach hook path: `TBD — cli-jaw checkout required`.
- State that 270–310 is no longer just a sequence of implementation snippets; it must be executed with API-level cross-repo mapping and frontend mockup acceptance.
- Recommended follow-up becomes:
  1. Finish this documentation-only PABCD.
  2. For each future implementation phase, run IPABCD/PABCD with phase-local artifacts.
  3. Open cli-jaw checkout alongside jawcode before touching implementation or resolving exact cli-jaw API paths.

## Planned file-level diff summary

### MODIFY `000_moc_distribution_strategy.md`

Add lexicographic rows:

```diff
 | 300 | `300_code_mode_ui.md` | 260615: cli-jaw Manager UI integration step; use jawcode ACP/RPC/SDK surfaces as contract |
+| 301 | `301_manager_ui_code_jaw_design_interview.md` | 260615: Manager UI interview source for native JWC Code mode and existing Jaw mode JWC native runtime attach |
+| 302 | `302_p_documentation_plan.md` | PABCD P-stage plan for API-level documentation crystallization across 270-310 |
+| 305 | `305_jaw_mode_jwc_runtime_attach.md` | Existing Jaw mode `JWC` runtime selector/native attach contract |
 | 310 | `310_parity_verification_matrix.md` | 260615: cross-repo parity gate; refresh rows with current jawcode and cli-jaw evidence |
```

Update active folder hygiene: 301/302/305 are 300-band crystallization/API docs artifacts, not standalone product phases.

### MODIFY `200_execution_order.md`

Add 301/302/305 after 300 and before 310. Explain phase-by-phase IPABCD placement using sortable point files:

```text
302_p_documentation_plan.md
302.1_p_critic_round1.md
302.2_p_synthesis_round1.md
302.3_p_critic_round2.md
302.4_a_docs_pass_planner_round1.md
302.5_a_docs_pass_architect_round1.md
302.6_a_docs_pass_synthesis_round1.md
302.7_a_docs_pass_planner_delta.md
302.8_a_docs_pass_architect_delta.md
302.9_b_docs_pass_patch.md
302.9.1_b_docs_pass_verifier_done.md
302.9.2_b_docs_pass_done.md
302.10_c_docs_pass_check.md
302.11_d_docs_pass_summary.md
```

### MODIFY `270_jwc_ui_cli_selector.md`

Replace PRIMARY_CLIS-only framing with registry API + primary selector contract. Add `## API contract`, `## Frontend acceptance sketch`, and negative acceptance that `PRIMARY_CLIS` alone is not enough.

### MODIFY `280_default_cli_switch_e2e.md`

Add `## API contract` for default runtime resolution → exact message API → exact SSE → DB persist. Require exact path resolution or `TBD — cli-jaw checkout required`.

### MODIFY `290_code_mode_acp_e2e.md`

Replace stale research/conditional implementation section with current-state API trace table. Remove stale ACP-missing branch, nonexistent `acp-server.ts`, and required permission relay E2E.

### MODIFY `300_code_mode_ui.md`

Replace contradictory sections and add `## 301 crystallized frontend contract` plus `## Frontend mockup acceptance` sections. Remove session-list-first, permission-card, and multi-session-first requirements from core scope.

### MODIFY `301_manager_ui_code_jaw_design_interview.md`

Mark complete and replace final open question with crystallization decision.

### NEW `305_jaw_mode_jwc_runtime_attach.md`

Create dedicated Jaw runtime attach doc with the outline above.

### MODIFY `310_parity_verification_matrix.md`

Merge API/frontend parity rows into existing A–E sections or add a linked F section that does not duplicate/conflict. Mark cli-jaw harness as `TBD — cli-jaw checkout required` unless verified.

### MODIFY `320_post270_current_state_triage.md`

Add 301/302/305 to conclusion/follow-up, add 305 path-map stubs, and state the API-level mapping requirement.

## PABCD execution sequence for this documentation-only goal

### P — plan/current stage

1. Write/refresh this plan file.
2. Run one Critic review focused on plan quality only.
3. If Critic is OKAY, write final pending approval through planphase.
4. If Critic is negative but over-blocking, write synthesis/waiver before finalization. If Critic is correct, patch and rerun.

### A — docs-pass audit stage

After user approves the pending P plan:

- Run `jwc orchestrate a`.
- Expected audit questions:
  - Does the plan cover every 270–310 phase at API-unit precision?
  - Does it connect jawcode contracts, cli-jaw APIs, and Manager frontend mockups?
  - Does it preserve user corrections from 301?
  - Does it avoid product-source mutation?
  - Does it require cli-jaw checkout evidence before exact cli-jaw API paths are asserted?

Expected receipt names:

- `302.4_a_docs_pass_planner_round1.md`
- `302.5_a_docs_pass_architect_round1.md`
- `302.6_a_docs_pass_synthesis_round1.md`

### B — docs-pass build stage

Only after A passes:

- First update `000` and `200` so the phase index/order points to 301/302/305.
- Then resolve cli-jaw checkout evidence if available.
- Apply markdown-only edits to `270`, `280`, `290`, `300`, `301`, `305`, `310`, `320`.
- Use exact cli-jaw paths/routes where verified; otherwise mark `TBD — cli-jaw checkout required` instead of inventing.
- Do not edit product source.

Expected receipts:

- `302.9_b_docs_pass_patch.md`
- `302.9.1_b_docs_pass_verifier_done.md`
- `302.9.2_b_docs_pass_done.md`

### C — docs-pass check stage

- Read updated docs and verify each required section/row exists.
- Verify old contradictory 270/290/300/310 claims are removed/replaced.
- Verify exact cli-jaw API placeholders are either resolved or explicitly marked `TBD — cli-jaw checkout required`.
- Run stale-string checks for old nonexistent jawcode ACP-server-file instructions, old conditional ACP-absence wording, detailed permission-card UI as a required Code mode surface, session-list-first primary layout wording, and cli-jaw parity harness commands presented as jawcode-runnable.
- Run `bun scripts/check-visible-definitions.ts` only if public workflow/definition wording is touched; otherwise record N/A in the C receipt.
- No broad build/test unless a reviewer finds source-impacting wording or generated docs are introduced.

Expected receipt:

- `302.10_c_docs_pass_check.md`

### D — docs-pass done stage

- Write summary receipt.
- Record goal milestone with `jwc goal update --shared` and evidence path(s).
- Run `jwc orchestrate d` only after C passes.

Expected receipt:

- `302.11_d_docs_pass_summary.md`

## Acceptance criteria

- [ ] Every 270–310 phase doc has an API-unit contract or explicitly points to the doc that owns it.
- [ ] `000` indexes 301/302/305 in lexicographic order.
- [ ] `200` lists 301/302/305 between 300 and 310 and names the docs-pass receipt sequence.
- [ ] 270 maps jawcode package evidence to cli-jaw registry API and Manager selector frontend.
- [ ] 270 does not present `PRIMARY_CLIS` editing as sufficient by itself.
- [ ] 280 maps default runtime selection to exact message/SSE/persistence APIs or marks unresolved exact paths as `TBD — cli-jaw checkout required`.
- [ ] 290 maps cli-jaw Code REST to AcpHost to JWC ACP JSON-RPC/session updates.
- [ ] 290 removes stale ACP-missing branch, nonexistent `acp-server.ts`, and required permission relay E2E.
- [ ] 300 contains the corrected Code mode frontend mockup contract from 301.
- [ ] 300 removes/replaces left-session-list, permission-card, and multi-session-first contradictions.
- [ ] 300 positively states no-spawn-on-open and first-prompt cwd-keyed JWC session creation.
- [ ] 301 is marked complete and no longer asks for Round 10.
- [ ] 305 owns existing Jaw mode `JWC` runtime selector/native attach documentation.
- [ ] 310 contains API/frontend parity rows integrated with existing A–E matrix sections or a non-conflicting linked section F.
- [ ] 310 does not present cli-jaw parity harness scripts as runnable from jawcode.
- [ ] 320 states that future implementation requires cli-jaw checkout plus jawcode evidence together.
- [ ] Auth/model inventory route/bridge is either concretely documented in 300/310 or marked `TBD — cli-jaw checkout required`.
- [ ] All documentation artifacts obey lexicographic phase ordering and place PABCD receipts inside the relevant phase sequence rather than top-level append-only bands.
- [ ] No product source files are modified by this goal.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Plan remains too UI-only | Require API-unit sections for 270, 280, 290, 305, 310, plus frontend mockup acceptance in 300. |
| Docs imply Code mode is tied to cli-jaw instances | Repeat cwd/JWC-session scoping in 300/310/320. |
| Docs imply Jaw iframe needs redesign | Create 305 to state existing Jaw mode/iframe remains; only `JWC` native runtime attach is in scope. |
| Docs show unauth providers/models disabled | State hidden-only normal picker rule and Auth Center discovery rule. |
| Exact cli-jaw paths are unknown in this repo | B-stage must check cli-jaw checkout or mark `TBD — cli-jaw checkout required`; no invented paths. |
| PABCD artifacts become append-only clutter | Use phase-local point files such as `302.4_a_docs_pass_*`, `302.9_b_docs_pass_patch.md`, `302.10_c_docs_pass_check.md`, and `302.11_d_docs_pass_summary.md`. |
| Plan overreaches into product source | Limit B-stage to markdown docs listed above. |
