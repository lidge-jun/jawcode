# 310 — JWC parity verification matrix

> PABCD slice. Repos: cli-jaw + jawcode. Classification: C3.
> Depends on: 270 (registry/selector), 280 (default runtime), 290 (Code REST/ACP), 300 (Code frontend), 305 (existing Jaw mode runtime attach).
> Current doc role: cross-repo parity gate for replacing/embedding JWC in cli-jaw while preserving all user-facing surfaces.

## Problem

JWC can only become the default/embedded engine in cli-jaw when every product surface has evidence. This matrix connects jawcode contracts to cli-jaw APIs and frontend acceptance.

## Evidence sources

jawcode evidence:

- `docs/sdk.md`
- `docs/session-operations-export-share-fork-resume.md`
- `docs/session-switching-and-recent-listing.md`
- `docs/compaction.md`
- `docs/rpc.md`
- `docs/models.md`
- `docs/auth-broker-gateway.md`
- `packages/coding-agent/src/session/agent-session.ts`
- `packages/coding-agent/src/session/session-manager.ts`
- `packages/coding-agent/src/modes/acp/`
- `packages/jwc/scripts/*`

cli-jaw evidence:

- `GET /api/cli-registry` from `src/routes/settings.ts`
- `src/cli/registry.ts`, `src/cli/registry-live.ts`
- `src/core/main-session.ts`
- `POST /api/message` from `src/routes/command.ts`
- `GET /api/events` from `src/routes/events.ts`
- `GET /api/manager/events/stream` from `src/manager/server.ts`
- `src/routes/code.ts`
- `src/code-mode/acp-host.ts`
- existing Manager iframe/preview files: `public/manager/src/InstancePreview.tsx`, `public/manager/src/Workbench.tsx`
- existing/future Jaw mode runtime selector path: `TBD — cli-jaw checkout required`

## A. Core session lifecycle

| Feature | jawcode/JWC evidence | cli-jaw/API evidence to collect | Frontend/mockup evidence | Status |
|---|---|---|---|---|
| Registry selector | `packages/jwc/package.json`, `packages/jwc/src/sdk.ts` | `/api/cli-registry`, `src/cli/registry.ts`, `src/cli/registry-live.ts` | Settings selector shows `JWC` primary | planned |
| Default runtime | `packages/jwc/scripts/*` package smokes | `resolveMainCli`, `POST /api/message`, `GET /api/events`, DB `session.active_cli` | default session shows JWC/runtime label | planned |
| Code cwd session | ACP session concepts | `POST /api/code/sessions` with cwd, AcpHost `session/new` | Code opens from cwd; first prompt creates session | planned |
| Resume/cancel/close | session manager / ACP docs | `POST /api/code/sessions/:id/cancel`, `DELETE /api/code/sessions/:id` | Cancel/close affordances do not become primary layout | planned |
| Provider/model session identity | JWC model/session config docs | session runtime config persistence `TBD — cli-jaw checkout required` | provider/model change after start proposes new Code session | planned |

## B. Streaming and events

| Feature | jawcode/JWC evidence | cli-jaw/API evidence to collect | Frontend/mockup evidence | Status |
|---|---|---|---|---|
| ACP updates | `packages/coding-agent/src/modes/acp/` | AcpHost incoming `session/update` → publish `jwc` topic `code_${kind}` | transcript renders from top | planned |
| Text/tool/status rendering | ACP event mapper/tests | `GET /api/events` data-only SSE | central transcript/event blocks | planned |
| Turn done/error | ACP session lifecycle | AcpHost publishes `code_turn_done`, `code_session_error`, `code_child_exit` | visible status/error row | planned |
| Manager events | n/a | `GET /api/manager/events/stream` | sidebar/metadata refresh only, not Code transcript source | planned |

## C. Provider and model

| Feature | jawcode/JWC evidence | cli-jaw/API evidence to collect | Frontend/mockup evidence | Status |
|---|---|---|---|---|
| Authenticated-only picker | `docs/models.md`, `docs/auth-broker-gateway.md`, `structure/30_providers.md` | concrete auth/model endpoint or bridge, or `TBD — cli-jaw checkout required` | unauth provider/models hidden from normal picker | planned |
| Auth Center `/login` | auth broker/gateway docs | login/auth bridge `TBD — cli-jaw checkout required` | `/login` modal discovers missing providers and refreshes inventory after success | planned |
| AI-E provider split | cli-jaw `agent-meta.ts` provider/model maps | `ai-e` provider/model inventory and auth state `TBD — cli-jaw checkout required` | provider/model dropdowns remain separate controls | planned |
| Effort next-turn mutability | JWC config docs | session runtime config update `TBD — cli-jaw checkout required` | effort change logs status event and applies next turn | planned |

## D. Tool and permission support

| Feature | jawcode/JWC evidence | cli-jaw/API evidence to collect | Frontend/mockup evidence | Status |
|---|---|---|---|---|
| File/tool events | `docs/tools/`, ACP event mapper | AcpHost `code_${kind}` event relay | transcript/tool blocks | planned |
| Permission transport | ACP permission request support | `GET /api/code/permissions`, `POST /api/code/permissions/:id` are transport evidence | no forced approval UI in this slice | deferred UI |
| Permission baseline | current Jaw Code behavior | bypass/policy status channel `TBD — cli-jaw checkout required` | status only unless future phase reopens approval UX | planned |
| MCP/computer use | MCP/CU docs/tests | cli-jaw runtime environment evidence `TBD — cli-jaw checkout required` | not primary Code UI blocker | pending |

## E. Integration surfaces

| Feature | jawcode/JWC evidence | cli-jaw/API evidence to collect | Frontend/mockup evidence | Status |
|---|---|---|---|---|
| Native Code mode UI | `301`, `300`, ACP/RPC/SDK docs | `src/routes/code.ts`, proposed Manager Code components | cwd-first composer-first UI | planned |
| Existing Jaw mode JWC runtime | `305`, `packages/jwc/src/sdk.ts`, `docs/sdk.md` | existing Jaw selector/native attach path `TBD — cli-jaw checkout required` | existing Jaw UI keeps layout; runtime label `JWC` | planned |
| Jaw/Code state boundary | `301`, `305` | shared auth/model/cwd bridge `TBD — cli-jaw checkout required` | no transcript/session mixing | planned |
| Chrome/logo polish | user screenshots in 301 context | Manager shell CSS/layout | no traffic-light/title overlap | planned |
| cli-jaw parity harness | jawcode evidence only: `packages/jwc/scripts/*` | cli-jaw harness `TBD — cli-jaw checkout required` | do not claim runnable from jawcode | planned |

## Exit criteria

- [ ] Every row has either concrete cli-jaw evidence or `TBD — cli-jaw checkout required`.
- [ ] No row claims cli-jaw-only scripts are runnable from jawcode.
- [ ] 270 selector path is verified through `/api/cli-registry` and Manager selector.
- [ ] 280 default path is verified through runtime resolution, message POST, SSE, and persistence.
- [ ] 290 Code path is verified through REST → AcpHost → ACP JSON-RPC → SSE.
- [ ] 300 UI path is verified against cwd-first composer-first frontend acceptance.
- [ ] 305 Jaw runtime attach is verified without redesigning the iframe shell.
- [ ] Auth/model inventory hidden-only behavior is verified or blocked explicitly.

## Not in scope

- Implementing cli-jaw runtime changes in this matrix.
- Running cli-jaw parity harness commands from jawcode.
- Treating blocking approval cards/queues as required UI for this slice.
