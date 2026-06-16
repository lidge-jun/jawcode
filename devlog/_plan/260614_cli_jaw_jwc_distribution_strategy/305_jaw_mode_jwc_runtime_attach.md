# 305 — Existing Jaw mode JWC native runtime attach

> Documentation/API contract. Repo for implementation: cli-jaw. Evidence repo: jawcode.
> Depends on: 270 registry visibility, 301 design interview.
> Current status: planning contract; exact cli-jaw selector/attach paths must be verified during implementation.

## Goal

Add `JWC` to the existing cli-jaw Jaw mode runtime/engine selector and attach it through the custom native JWC path without redesigning the existing Jaw iframe/surface.

This is distinct from `300_code_mode_ui.md`:

- **300 Code mode** is a new/native Manager Code UI surface.
- **305 Jaw mode** uses the already-existing Jaw mode/iframe and adds JWC as a runtime option.

## Correct mental model

```text
Existing cli-jaw Jaw mode / iframe surface
→ runtime/engine selector includes `JWC`
→ selecting `JWC` uses custom native attach path
→ generic runtimes may continue using JSON-RPC style integration
→ JWC path may be special/native and must not be forced through generic JSON-RPC if native attach is the intended contract
```

## API/runtime contract

| Surface | cli-jaw path/status | jawcode evidence |
|---|---|---|
| Existing Jaw mode runtime/engine selector | `TBD — cli-jaw checkout required` | `packages/jwc/src/sdk.ts`, `docs/sdk.md` |
| Existing Jaw iframe/surface | `public/manager/src/InstancePreview.tsx`, `public/manager/src/Workbench.tsx`, related preview bridge files are current iframe/preview evidence; exact Jaw mode runtime selector path remains `TBD — cli-jaw checkout required` | `docs/bridge.md`, `docs/rpc.md` |
| Native JWC attach hook | `TBD — cli-jaw checkout required` | `packages/jwc/src/sdk.ts`, `packages/coding-agent/src/sdk.ts` |
| Auth/model inventory | `GET /api/cli-registry`, `GET /api/quota`, settings/perCli model rows; exact JWC-auth inventory bridge for this mode remains `TBD — cli-jaw checkout required` | `docs/models.md`, `docs/auth-broker-gateway.md`, `structure/30_providers.md` |

## Frontend acceptance sketch

- Runtime label is `JWC`.
- `JWC` appears beside existing runtime/engine choices such as `claude-e`.
- Selecting `JWC` does not replace Jaw mode UI with Code mode composer/footer.
- Existing Jaw mode iframe/loading/fallback remains owned by cli-jaw's current Jaw mode surface.
- Jaw and Code transcripts/sessions remain separate.
- Auth/model inventory can be shared where useful, but control placement follows existing Jaw mode UI.
- Jaw mode authenticated provider/model choices appear only inside the existing Jaw runtime/model selector controls, not in the Code composer footer.
- Missing providers/models are discovered through `/login` Auth Center or the existing Jaw-equivalent auth entry; successful login refreshes the shared inventory.
- Code transcript/session/composer state must not mix into the Jaw iframe/session state.
- If `JWC` is unavailable due to auth/runtime setup, the existing Jaw mode should show a runtime-specific unavailable/login/status path rather than silently falling back to another runtime.
- Cross-reference `300_code_mode_ui.md` for Code-only footer rules; this document owns Jaw-mode placement only.

## State sharing decision

Share only lightweight common state where useful:

- cwd/project identity;
- authenticated provider/model inventory;
- global/cwd-specific model defaults.

Do not share:

- transcript/session timelines;
- Code mode active JWC session ids;
- Code composer state;
- Jaw iframe internal route state.

## Not in scope

- Redesigning Jaw iframe shell.
- Replacing Jaw mode UI with Code mode UI.
- Forcing JWC through generic JSON-RPC when native attach is required.
- Implementing the native attach path in this documentation-only PABCD.

## Verification sketch for future implementation

- Existing Jaw mode runtime selector displays `JWC`.
- Selecting `JWC` uses the native attach path and reports readiness/failure distinctly.
- Switching between Jaw mode and Code mode does not mix transcript/session state.
- Auth/model inventory behavior matches `300`/`310`: normal picker hides unauthenticated provider/models; `/login`/auth bridge reveals after success.
