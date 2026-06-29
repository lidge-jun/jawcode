# 46 Phase 4 implementation plan — threaded surface local helpers

## Scope

Implement the first JWC-native local helper slice for `10.031` after the Phase 4 split:

- `10.031-A`: pure topic registry model.
- `10.031-B`: pure threaded render formatter for identity and ask frames.
- `10.031-C`: fail-closed inbound classifier that returns inert route/drop decisions only.

This phase does not create Telegram topics, send Telegram messages, receive live network updates, inject user messages, delete/rename topics, or implement media/file ingress.

## Source anchors

| Card | Source fact | JWC posture |
|---|---|---|
| `10.031` | GJC has topic registry, threaded renderer, and inbound router around Telegram forum topics. | Adapt pure local contracts only with JWC naming and fail-closed decisions. |
| `10.030` | JWC transport shell exists but remains fail-closed. | Do not connect classifier output to daemon runtime. |
| `10.032` | Remote answer authorization exists. | Do not bypass authorization; classifier only identifies an inert session candidate. |
| `10.034` | Media/file transfer remains split/deferred. | Attachment-bearing updates must drop until media policy exists. |

Mandatory naming contract: `struct_har/chase/008_gjc_jwc_naming_contract.md`.

## Risk class

C4 security-adjacent because topic/chat classification can become remote control routing once connected to Telegram. This phase keeps the surface pure and inert.

Required reviewers:

- Backend/security: chat/topic/update fail-closed behavior, no raw chat/token persistence, no injection side effects.
- Docs: chase/devlog evidence and no overclaim of live Telegram behavior.

## Exact file changes

### NEW

| File | Purpose |
|---|---|
| `packages/coding-agent/src/notifications/threaded-surface.ts` | Pure topic registry model, identity/ask renderer, and inbound update classifier. |
| `packages/coding-agent/test/notifications-threaded-surface.test.ts` | Focused tests for dedupe/replacement, secret non-persistence, rendering, wrong chat/topic/duplicate/empty/attachment drops, and inert route decisions. |
| `devlog/_plan/260628_jwc_native_chase_implementation/46_phase4_threaded_surface_local_plan.md` | This plan. |
| `devlog/_plan/260628_jwc_native_chase_implementation/47_phase4_threaded_surface_local_audit.md` | A-phase audit record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/48_phase4_threaded_surface_local_build.md` | B-phase build record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/49_phase4_threaded_surface_local_check.md` | C-phase verification record. |

### MODIFY

| File | Planned change |
|---|---|
| `packages/coding-agent/src/notifications/index.ts` | Export `threaded-surface.ts`. |
| `struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md` | Add Phase 4 local-helper implementation evidence; keep done-gates open because no live Telegram topic lifecycle exists. |

## Planned API

```ts
export interface ThreadTopicRecord {
	sessionId: string;
	messageThreadId: number;
	chatIdFingerprint: string;
	title: string;
	updatedAt: number;
	stale?: boolean;
}

export interface ThreadIdentityHeaderInput {
	repo?: string;
	branch?: string;
	machine?: string;
	sessionId: string;
	title?: string;
}

export class ThreadTopicRegistry {
	upsert(record: ThreadTopicRecord): ThreadTopicRecord;
	findByThread(chatIdFingerprint: string, messageThreadId: number): ThreadTopicRecord | null;
	markStale(sessionId: string, updatedAt: number): ThreadTopicRecord | null;
	list(): ThreadTopicRecord[];
}

export interface ThreadInboundUpdate {
	updateId?: unknown;
	chatId?: unknown;
	messageThreadId?: unknown;
	text?: unknown;
	caption?: unknown;
	hasAttachment?: boolean;
}

export type ThreadInboundDropReason =
	| "wrong_chat"
	| "no_topic"
	| "unknown_topic"
	| "duplicate_update"
	| "missing_update_id"
	| "empty_text"
	| "attachment_not_supported"
	| "stale_topic";

export type ThreadInboundDecision =
	| { mode: "route"; sessionId: string; text: string; updateId: number }
	| { mode: "drop"; reason: ThreadInboundDropReason };

export interface ThreadInboundClassifierContext {
	expectedChatIdFingerprint: string;
	isDuplicateUpdate: (updateId: number) => boolean;
	recordUpdateId?: (updateId: number) => void;
}

export function renderThreadIdentityHeader(input: ThreadIdentityHeaderInput): string;
export function renderThreadActionNeeded(input: NotificationActionNeededFrame): string;
export function classifyThreadInboundUpdate(
	update: ThreadInboundUpdate,
	registry: ThreadTopicRegistry,
	ctx: ThreadInboundClassifierContext,
): ThreadInboundDecision;
```

Implementation rules:

1. Topic records store only `chatIdFingerprint`, never raw chat id or token.
2. `upsert()` dedupes by `sessionId`; replacement of a stale/existing session updates `messageThreadId`, `chatIdFingerprint`, `title`, `updatedAt`, and clears `stale`.
3. `findByThread()` returns the matching record by fingerprint/thread id, including stale records; classifier owns `stale_topic` drop semantics.
4. `markStale()` returns null if the session is missing; otherwise it sets `stale: true` and updates `updatedAt`.
5. `list()` is test/debug only and must never include raw chat ids or tokens.
6. Renderer must use `jwc`/`.jwc` labels, bounded text, and no raw token/chat values.
7. Action rendering must not double-prefix options that are already numbered.
8. Inbound classifier returns only inert decisions:
   - `{ mode: "route", sessionId, text, updateId }` for known chat/topic, non-duplicate update, non-empty text, no attachments.
   - `{ mode: "drop", reason }` for wrong chat, missing topic, unknown topic, duplicate update, empty text, or attachment-bearing updates.
9. Chat comparison fingerprints inbound `chatId` with existing `fingerprintSecret()` from `transport-state.ts` and compares to `ctx.expectedChatIdFingerprint`; raw chat ids are never persisted in records or decisions.
10. `messageThreadId` accepts number or numeric string at the boundary; missing/non-numeric values drop with `no_topic`.
11. Duplicate update ids are owned by the caller-provided `ThreadInboundClassifierContext`: `isDuplicateUpdate(updateId)` detects duplicates and optional `recordUpdateId(updateId)` records a routeable update after all other gates pass.
12. Classifier must never call session injection, remote answer resolution, Telegram APIs, filesystem writes, or registry mutation except optional caller-owned duplicate tracking via `recordUpdateId`.

## Renderer contract

1. Output is plain text in this phase; no Telegram HTML helper or parse-mode dependency.
2. Default title is `JWC session`.
3. Identity lines use JWC labels only: `jwc`, `.jwc`, `repo`, `branch`, `machine`, `session`.
4. Bound title to 120 visible characters and repo/branch/machine/session fields to 80 visible characters before render.
5. For action options, strip leading `/^\s*\d+[.)]\s+/` from each option before adding canonical `1. ...` numbering.
6. `JSON.stringify(render...(...))` must not contain connect tokens, raw chat ids, or bot tokens supplied in any input field.

## Classifier security gates

| Gate | Rule |
|---|---|
| Raw chat/token persistence | Records and decisions store/compare fingerprints only. |
| Wrong chat | Drop `wrong_chat`. |
| Missing thread | Drop `no_topic`. |
| Unknown thread | Drop `unknown_topic`. |
| Duplicate `updateId` | Drop `duplicate_update`. |
| Missing `updateId` | Drop `missing_update_id`. |
| Empty/whitespace text | Drop `empty_text`. |
| Any attachment | Drop `attachment_not_supported`. |
| Stale topic | Drop `stale_topic`. |
| Side effects | Classifier/registry/renderer have no FS, network, injection, or session mutation side effects. |

## Attachment matrix

| Case | Expected decision |
|---|---|
| Attachment-only in known topic | `{ mode: "drop", reason: "attachment_not_supported" }` |
| Text or caption plus attachment in known topic | `{ mode: "drop", reason: "attachment_not_supported" }`; do not route caption until `10.034`. |
| Attachment from wrong chat/topic | Drop with `wrong_chat`, `no_topic`, or `unknown_topic` using the same bounded ordering as text updates. |

## Explicit non-changes

- No Bot API calls, no `createForumTopic`, no `deleteForumTopic`, no message send/edit/delete.
- No daemon integration and no flat fallback delivery.
- No in-topic free-text injection.
- No attachment/media routing; attachment-bearing updates drop until `10.034`.
- No raw chat id/token persistence.
- Do not close `10.031`.

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/notifications-threaded-surface.test.ts packages/coding-agent/test/notifications-session-registry.test.ts packages/coding-agent/test/notifications-transport-shell.test.ts
```

Required `notifications-threaded-surface.test.ts` cases:

- `10.031-A`: upsert dedupes by `sessionId`; stale replacement clears stale and updates topic metadata; `list()`/JSON does not contain raw chat id or token substrings.
- `10.031-B`: identity uses JWC default title; bounded truncation; pre-numbered options render without `1. 1. Deploy`; output leak scan.
- `10.031-C`: wrong chat; no topic; unknown topic; duplicate update; missing update id; empty text; attachment-only; caption plus attachment; attachment on wrong chat; stale topic; route shape is inert and contains no `threadId`, attachment, `messageId`, or raw chat id.
- Import smoke: `import { classifyThreadInboundUpdate, ThreadTopicRegistry } from "../src/notifications";`.

Type/static checks:

```sh
cd packages/coding-agent && bun run check:types
git diff --check -- packages/coding-agent/src/notifications/threaded-surface.ts packages/coding-agent/src/notifications/index.ts packages/coding-agent/test/notifications-threaded-surface.test.ts struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md devlog/_plan/260628_jwc_native_chase_implementation/46_phase4_threaded_surface_local_plan.md devlog/_plan/260628_jwc_native_chase_implementation/47_phase4_threaded_surface_local_audit.md devlog/_plan/260628_jwc_native_chase_implementation/48_phase4_threaded_surface_local_build.md devlog/_plan/260628_jwc_native_chase_implementation/49_phase4_threaded_surface_local_check.md
```

Expected commit:

```text
feat(notifications): add threaded surface helpers
```
