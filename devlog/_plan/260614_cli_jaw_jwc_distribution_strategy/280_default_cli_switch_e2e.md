# 280 — Default CLI switch + end-to-end smoke

> PABCD slice. Repo for implementation: cli-jaw. Classification: C3 (public contract change).
> Depends on: 270 (JWC visible in registry/selector).
> Current doc role: default-runtime API contract connecting jawcode package evidence to cli-jaw message/SSE/persistence APIs.

## Problem

`resolveMainCli()` still falls back to `claude` when no explicit setting/session runtime exists. After 270, users can select JWC, but new/default sessions still prefer Claude unless the default resolution path changes.

## API contract

```text
jawcode package/smoke evidence
  - `packages/jwc/package.json`
  - `packages/jwc/src/sdk.ts`
  - `packages/jwc/scripts/smoke-node-sdk.mjs`
  - `packages/jwc/scripts/smoke-node-streaming.mjs`
  - `packages/jwc/scripts/smoke-packed-sdk.mjs`
→ cli-jaw runtime resolution
  - `src/core/main-session.ts` → `resolveMainCli()`
  - staged rollback/default override: `TBD — cli-jaw checkout required` until cli-jaw implements/verifies the exact env/settings name
→ cli-jaw user prompt API
  - `src/routes/command.ts:69-107` → `POST /api/message` → `submitMessage(...)`
  - `src/routes/events.ts:29-90` → `GET /api/events` multiplexed SSE
  - `src/manager/server.ts:591+` → `GET /api/manager/events/stream` manager event SSE
→ persistence evidence
  - `src/core/db.ts` session table fields include `active_cli`, `session_id`, `model`, `permissions`, `working_dir`, `effort`
  - `src/core/main-session.ts:81-83` writes session row through `updateSession`
```

Verified cli-jaw evidence from checkout:

- `src/core/main-session.ts:36-45`: `resolveMainCli(requestedCli, settings, session)` falls back to `'claude'`.
- `src/core/main-session.ts:6-22`: `MainSessionRecord`/`MainSessionRow` carry runtime, model, permission, cwd, and effort fields.
- `src/routes/command.ts:69-107`: web/REST prompt submission endpoint is `POST /api/message` with body `prompt`.
- `src/routes/events.ts:29-90`: worker/runtime event stream is `GET /api/events`.
- `src/manager/server.ts:591+`: Manager-level event stream is `GET /api/manager/events/stream`.
- `src/core/db.ts:32-36` and `238-240`: session persistence stores `active_cli` and related fields.

## Required change contract

1. Default runtime selection must be staged, explicit, and rollbackable.
2. Proposed default fallback becomes `jwc` only after 270/290/300/310 gates are satisfied.
3. Rollback path should be an env/settings override or settings field verified in cli-jaw; until implemented, record it as `TBD — cli-jaw checkout required`. Do not remove user/session explicit runtime preferences.
4. Smoke must validate the full path:
   - request uses explicit/default `cli: 'jwc'`;
   - prompt enters `POST /api/message` / `submitMessage` path;
   - events arrive through SSE;
   - DB/session persistence records `active_cli='jwc'` or equivalent selected runtime field;
   - existing sessions with explicit `active_cli` continue to be respected.

## Verification sketch

```text
cli-jaw checkout smoke harness: `TBD — cli-jaw checkout required` until a cli-jaw package.json script is verified.

Jawcode pre-evidence remains limited to the package smoke scripts:
- `packages/jwc/scripts/smoke-node-sdk.mjs`
- `packages/jwc/scripts/smoke-node-streaming.mjs`
- `packages/jwc/scripts/smoke-packed-sdk.mjs`
```

Smoke acceptance fields:

- Message POST route: `POST /api/message`.
- SSE route: `GET /api/events`; Manager UI stream: `GET /api/manager/events/stream`.
- Persistence: `session.active_cli`, `session.model`, `session.effort`, `session.working_dir`.
- Rollback: exact cli-jaw env/settings override documented by implementation; current placeholder is `TBD — cli-jaw checkout required`.

## Risk

- Real provider calls may require credentials. Prefer deterministic/mock-provider smoke where possible.
- Existing sessions with explicit `active_cli` must continue using their selected runtime.

## Not in scope

- Code mode REST/ACP boundary (slice 290).
- Code mode UI (slice 300).
- Existing Jaw mode runtime attach (slice 305).
- Parity matrix (slice 310).
