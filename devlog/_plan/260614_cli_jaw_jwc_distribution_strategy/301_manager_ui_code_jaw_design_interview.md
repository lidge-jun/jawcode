# 301 — Manager UI design interview: JWC Code mode + Jaw mode

> Status: interview complete; feeds `302_p_documentation_plan.md` and subsequent phase-by-phase IPABCD/PABCD execution.
> Parent slices: `300_code_mode_ui.md`, `305_jaw_mode_jwc_runtime_attach.md`, and `310_parity_verification_matrix.md`.
> Cross-repo rule: cli-jaw Manager implementation paths must be checked in a cli-jaw checkout; jawcode paths below are the contract/evidence side.

## Goal

Design the cli-jaw Manager UI surfaces for two embedded JWC experiences before implementation:

1. **JWC Code mode** — native cli-jaw Manager UI implementation for interactive coding sessions backed by JWC ACP/SDK contracts.
2. **JWC inside existing Jaw mode** — Jaw mode/iframe already exists in cli-jaw; this slice specifies how JWC attaches as a custom native runtime in that existing surface.

The output is now crystallized into phase docs through `302_p_documentation_plan.md`.

## Current jawcode contract paths

- ACP runtime: `packages/coding-agent/src/modes/acp/`
- ACP entry/dispatch: `packages/coding-agent/src/cli/args.ts`, `packages/coding-agent/src/commands/acp.ts`, `packages/coding-agent/src/main.ts`
- SDK embedding: `docs/sdk.md`, `packages/coding-agent/src/sdk.ts`, `packages/jwc/src/sdk.ts`
- Model/auth docs: `docs/models.md`, `docs/auth-broker-gateway.md`, `structure/30_providers.md`
- Session operations: `docs/session-operations-export-share-fork-resume.md`, `docs/session-switching-and-recent-listing.md`, `docs/compaction.md`
- RPC/bridge references: `docs/rpc.md`, `docs/bridge.md`

## cli-jaw paths to confirm in cli-jaw checkout

- Manager shell/navigation: `public/manager/`, `public/manager/src/SidebarRailRouter.tsx`
- Settings/agent selector: `public/manager/src/settings/pages/components/agent/agent-meta.ts`
- CLI registry/server: `src/cli/registry.ts`, `src/cli/registry-live.ts`, `/api/cli-registry`
- Code mode backend: `src/code-mode/acp-host.ts`, `src/routes/code.ts`
- Proposed code UI: `public/manager/src/code/CodeWorkspace.tsx`, `public/manager/src/code/CodeSessionPanel.tsx`
- Existing Jaw mode/iframe/runtime integration paths: confirm in cli-jaw checkout before implementation; do not redesign the iframe shell.

## Confirmed topology

1. **Code mode native Manager integration** — Code mode is implemented as native cli-jaw Manager UI.
2. **Existing Jaw mode runtime integration** — Jaw mode/iframe already exists; JWC attaches as a custom native runtime, similar in product role to `claude-e`, not as a newly designed iframe shell.
3. **Mode navigation and entry** — Manager exposes both modes clearly, but their implementation strategies differ.
4. **Model/provider selector** — composer footer provider/model/effort/context controls, populated only from authenticated/available providers.
5. **Auth-dependent surfaces** — unauthenticated providers/models are hidden from selector until `/login` popup or JWC login makes them available.
6. **Popup/modal system** — `/login`, auth setup, model details, permission/policy status, destructive/long-running confirmations, errors.

## JWC Code mode flow chart

```text
User opens Manager Code mode
→ Manager reads Code-mode cwd state
  ├─ if last cwd exists: prefill cwd chips/state
  └─ if no cwd exists: show empty composer with required cwd picker
→ show native Code canvas
  ├─ transcript area renders from top
  ├─ composer is the only primary input
  ├─ footer left: Ask permissions / + / mic
  └─ footer right: provider / model / effort / context spinner
→ user may change cwd/provider/model/effort before first send
→ user sends first message
→ Manager creates cwd-keyed JWC Code session
→ Manager spawns/attaches `jwc` in selected cwd
→ JWC streams transcript/tool/status updates into native Code canvas
→ after session start
  ├─ provider/model are session identity; changing them proposes a new Code session
  ├─ effort may change for the next turn and logs a small status event
  └─ context spinner reflects collection/counting/loading/streaming state
```

## Existing Jaw mode + JWC runtime flow chart

```text
User opens existing cli-jaw Jaw mode
→ existing Jaw iframe/surface loads as it does today
→ user chooses runtime/engine from existing Jaw runtime selector
→ selector includes `JWC`
→ selecting `JWC` uses custom native attach path
  ├─ JWC is not forced through generic JSON-RPC runtime shape
  ├─ generic runtimes may continue using JSON-RPC style integration
  └─ JWC shares auth/model inventory where useful
→ Jaw mode UI remains Jaw-mode-native
  ├─ do not replace it with Code mode composer/footer
  ├─ do not mix Jaw transcript/session with Code transcript/session
  └─ use existing Jaw fallback/loading behavior
```

## Confirmed UI decisions

- Code mode is independent from selected cli-jaw instances.
- Code mode starts from cwd state and an empty composer.
- Opening Code mode does not spawn JWC.
- First prompt creates a cwd-keyed JWC Code session.
- Composer status row:

```text
[ Describe a task or ask a question                                      ]

Ask permissions   +   mic                          codex / gpt-5.5 / xhigh / ◔ context
└ left actions are separate controls                └ right controls are separate dropdown/status items
```

- Provider/model dropdowns show only providers/models that are authenticated and available to JWC.
- Missing auth discovery belongs in `/login` Auth Center, not disabled picker rows.
- Provider/model are freely selectable before session start and session-fixed after start.
- Effort can change from the next turn and logs a small status event.
- Provider/model/effort defaults persist as cwd-specific recent selection plus global fallback.
- Permission popup/queue details are deferred; baseline is bypass/policy status indication.
- `CLI-JAW DASH` must align next to macOS traffic-light controls without overlap.

## Confirmed `/login` popup design

Use an **Auth Center modal** for `/login`.

```text
Composer `/login` or footer `login required`
→ open centered Auth Center modal
→ list provider accounts/auth methods not currently available in normal picker
→ user chooses provider/auth method
→ Manager starts corresponding JWC login/auth flow
→ show progress inside modal
→ on success: refresh authenticated provider/model inventory and reveal newly available entries
→ on failure/cancel: keep normal picker unchanged and show retry/cancel state
```

## Interview transcript summary

| Round | Topic | Decision |
|---|---|---|
| 0 | Topology | Design all surfaces: native Code mode, existing Jaw mode runtime attach, selector/auth/popup surfaces. |
| 1 | Navigation | Code mode is independent from cli-jaw instances; GUI chooses cwd/project and spawns JWC there. Also fix traffic-light/logo alignment. |
| 2 | Spawn flow | Use last cwd; show empty composer; first message creates Code session and spawns `jwc`. |
| 3 | Composer row | Left `Ask permissions / + / mic`; right provider/model/effort/context spinner. |
| 4 | Auth/model exposure | Auth-less provider/model entries are hidden from normal picker until `/login` or JWC login succeeds. |
| 5 | `/login` | Use Auth Center modal. |
| 6 | Model controls | Provider/model fixed after session start; effort mutable next turn; cwd-specific recent + global fallback. |
| 7 | Permission UX | Detailed approval UI skipped; baseline bypass/policy status only. |
| 8 | Jaw mode | Existing Jaw mode already implemented; JWC enters as custom native runtime, not new iframe shell. |
| 9 | Runtime identity | Label runtime `JWC`; add to existing Jaw runtime/engine selector; share auth/model inventory where useful. |

## Crystallization decision

The user requested `/goal plan` and a full documentation PABCD pass. Treat this interview as complete for the current documentation slice. Remaining implementation-specific details should be handled in the relevant future phase, not by extending this interview indefinitely.

## Downstream owners

- Code frontend contract: `300_code_mode_ui.md`
- Existing Jaw mode runtime attach: `305_jaw_mode_jwc_runtime_attach.md`
- API/parity verification: `310_parity_verification_matrix.md`
- Current-state cross-repo map: `320_post270_current_state_triage.md`
