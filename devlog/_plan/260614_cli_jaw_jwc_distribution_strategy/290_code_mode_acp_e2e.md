# 290 — Code mode ACP end-to-end activation

> PABCD slice. Repos: cli-jaw + jawcode. Classification: C3.
> Depends on: 270 (JWC visible), 280 (default/runtime path understood).
> Current state: jawcode-side ACP dispatcher is resolved; this slice verifies the cross-repo cli-jaw integration boundary.

## Problem

cli-jaw has a Code mode REST surface and AcpHost scaffold. jawcode has ACP mode implementation and tests. This phase proves the real process/API boundary:

```text
Manager/REST
→ cli-jaw Code routes
→ AcpHost
→ `jwc --mode acp` JSON-RPC stdio
→ JWC session lifecycle
→ `session/update` events
→ cli-jaw SSE/Manager rendering
```

## Verified cli-jaw API paths

| Layer | Path | Evidence |
|---|---|---|
| Workspace metadata | `GET /api/code/git-info?cwd=...` | `src/routes/code.ts:19-34` |
| List sessions | `GET /api/code/sessions` | `src/routes/code.ts:36-38` |
| Create session | `POST /api/code/sessions` with absolute `cwd` | `src/routes/code.ts:40-52` |
| Prompt | `POST /api/code/sessions/:id/prompt` with `text` | `src/routes/code.ts:54-66` |
| Cancel | `POST /api/code/sessions/:id/cancel` | `src/routes/code.ts:68-73` |
| Close | `DELETE /api/code/sessions/:id` | `src/routes/code.ts:75-80` |
| Permission status transport | `GET /api/code/permissions`, `POST /api/code/permissions/:id` | `src/routes/code.ts:82-93`; transport evidence only, not required approval-card UI in 300 |
| Event stream | `GET /api/events` | `src/routes/events.ts:29-90` |

## Verified cli-jaw AcpHost paths

| Step | Method/event | Evidence |
|---|---|---|
| Spawn command | default `jwc --mode acp`, override `JWC_ACP_CMD` | `src/code-mode/acp-host.ts:31-40` |
| Initialize/auth | JSON-RPC `initialize`, `authenticate` | `src/code-mode/acp-host.ts:75-80` |
| Create session | JSON-RPC `session/new` with `cwd` | `src/code-mode/acp-host.ts:170-182` |
| Prompt | JSON-RPC `session/prompt` | `src/code-mode/acp-host.ts:185-204` |
| Update relay | incoming `session/update` → publish `jwc` topic `code_${kind}` | `src/code-mode/acp-host.ts:135-150` |
| Cancel | JSON-RPC `session/cancel` | `src/code-mode/acp-host.ts:206-215` |
| Close | JSON-RPC `session/close` | `src/code-mode/acp-host.ts:217-224` |
| Child exit | publish `code_child_exit` | `src/code-mode/acp-host.ts:83-93` |

## Unified API trace

| Step | Request/event | Owner repo | Expected evidence | Exact path status |
|---|---|---|---|---|
| Workspace metadata | `GET /api/code/git-info?cwd=...` | cli-jaw | cwd/git metadata route | Verified: `src/routes/code.ts:19-34` |
| Code session create | `POST /api/code/sessions` | cli-jaw | absolute cwd creates a session | Verified: `src/routes/code.ts:40-52` |
| ACP child attach | spawn `jwc --mode acp` or `JWC_ACP_CMD` | cli-jaw ↔ jawcode | stdio child process starts JWC ACP mode | Verified: `src/code-mode/acp-host.ts:31-40`; jawcode ACP mode evidence below |
| ACP handshake | `initialize`, `authenticate` | cli-jaw ↔ jawcode | ACP JSON-RPC handshake succeeds | Verified: `src/code-mode/acp-host.ts:75-80`; jawcode `modes/acp/` |
| Prompt dispatch | `POST /api/code/sessions/:id/prompt` → `session/prompt` | cli-jaw ↔ jawcode | HTTP 202 then ACP prompt request | Verified: `src/routes/code.ts:54-66`, `src/code-mode/acp-host.ts:185-204` |
| Stream/update | `session/update` → `GET /api/events` topic `jwc`/`code_*` | cli-jaw ↔ Manager | transcript/status events stream to Manager | Verified: `src/code-mode/acp-host.ts:135-150`, `src/routes/events.ts:29-90` |
| Cancel/close | REST cancel/delete → `session/cancel`/`session/close` | cli-jaw ↔ jawcode | lifecycle controls map across boundary | Verified: `src/routes/code.ts:68-80`, `src/code-mode/acp-host.ts:206-224` |
| Permission status | permission routes/status only | cli-jaw | transport exists but approval-card UI is deferred | Verified transport: `src/routes/code.ts:82-93`; UI deferred to 300 |

## jawcode evidence

- `packages/coding-agent/src/cli/args.ts` accepts ACP mode.
- `packages/coding-agent/src/commands/acp.ts` routes ACP command behavior.
- `packages/coding-agent/src/main.ts` dispatches ACP mode to `runAcpMode(createAcpSession)`.
- `packages/coding-agent/src/modes/acp/` owns ACP implementation.
- Existing ACP tests include stdout hygiene, initialize conformance, agent lifecycle, client bridge, event mapper, lazy startup, MCP isolation, and builtins coverage (see `320`).

## Required verification contract

1. `POST /api/code/sessions` with an absolute cwd creates a JWC ACP session.
2. AcpHost spawns or attaches `jwc --mode acp` (or `JWC_ACP_CMD` override in dev).
3. ACP handshake completes: `initialize` then `authenticate`.
4. `POST /api/code/sessions/:id/prompt` accepts a prompt with HTTP 202 and streams completion through `session/update` / `GET /api/events`.
5. Child exit and session errors map to Manager-visible status/error events.
6. Permission approval queue/card UI is **not** required in this phase. Permission status routes may remain documented as transport capability, but 300 uses bypass/policy status baseline unless reopened.

## Negative acceptance

- This document must treat jawcode ACP dispatcher as resolved.
- This document must not prescribe a new jawcode ACP server file.
- This document must not require permission approval queue/card E2E for the current UI slice.

## Verification sketch

```bash
# cli-jaw checkout
# 1. Start Manager/server with JWC_ACP_CMD if using a local jawcode checkout.
# 2. POST /api/code/sessions { cwd: "/absolute/project" }
# 3. POST /api/code/sessions/:id/prompt { text: "respond JWC_CODE_OK" }
# 4. Observe GET /api/events for jwc/code_* events and code_turn_done.
```

## Not in scope

- Native Manager Code UI layout (slice 300).
- Existing Jaw mode runtime attach (slice 305).
- Detailed permission approval queue/cards.
