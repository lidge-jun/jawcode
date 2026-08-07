# 160 — wp12 P: `20.082` triage (RETRACTED implementation, replaced by probes)

wp12 takes `20.082` (OMP: session context, settings and persistence integrity), 31 anchors.

> **Revised after A-audit (Fermat, FAIL).** The draft proposed implementing a fix that **already exists**, on
> a defect that is **not reachable in production**, in a way that would have **broken an explicit contract
> this repo tests for**. All three corrections are kept visible because the third is the serious one.

## Retracted: the "defect" was already fixed, and my fix was wrong

The draft claimed `#emit` fans out without awaiting, so events reorder. Three problems:

1. **The gate already exists.** `agent-session.ts:1872` defines `#subscriberEmitGate`, and `:1894` tickets
   non-`message_update` fan-out — structurally identical to upstream `133af40c0`, including the same
   `message_update` fast path. `133af40c0` is **already satisfied**. I found this myself while probing
   upstream's diff, and the audit confirmed it independently.
2. **My reproduction was a toy, not production.** Interactive startup sets `isInitialized = true` *before*
   subscribing (`interactive-mode.ts:671`), so the `ctx.init()` suspension I relied on does not happen during
   ordinary `message_start`/`message_end` delivery.
3. **The proposed fix would have broken a tested contract.** `session-event-ordering.test.ts` contains a test
   literally named *"does not await a slow subscriber"* — the repo deliberately guarantees the opposite of
   what I planned. Awaiting subscriber promises globally would let a never-settling listener stall every later
   event forever, and would hold all events for the entire duration of a plan-approval interaction (which
   suspends a subscriber on purpose while waiting for the user).

So the correct verdict for `133af40c0` is **already satisfied — no code change**. Writing that fix would have
been a regression dressed as a chase adaptation.

## "UNPROBED" was avoidance wearing better clothes

The draft marked ~28 anchors *unprobed* and closed the card anyway. I framed that as honesty about my track
record. The audit called it what it is: a nicer word for the same avoidance. It then spot-checked seven of
them and found **no** trivially-satisfied case and **four small, live, obviously in-scope gaps**:

| anchor | live gap | evidence |
|---|---|---|
| `c0966d0f6` | provider-facing cwd is still shortened | `system-prompt.ts:597` |
| `aa0884d51` | `todo_write` commits, then event handling can replay older `details.phases` | `todo-write.ts:516` → `agent-session.ts:2343` |
| `ee9c08a5c` | terminal `agent_end` has `msg` but emits no warn with `errorMessage`/`errorStatus`/`errorId` | `agent-session.ts:2406` |
| `e5f65fcd5` | no split-CR/CRLF normalization state | `streaming-output.ts:14` |
| `1e209caee` | every non-session entry resolved recursively without the synchronous blob-ref precheck | `session-manager.ts:937` |
| `b257a6dcb` | startup fallback selection does not transfer chain ownership | `sdk.ts:1444` → `agent-session.ts:986` |
| `bcca907e5` | genuine product decision: JWC gives `/clear` context-preserving semantics distinct from `/new` | `builtin-registry.ts:1948` vs `:1631` |

**`20.082` therefore does NOT close in this cycle.** A bucket-A card with four known small live gaps is not
"partial by design" — it is unfinished. The card stays open and the anchors become named follow-up units.

## Corrected plan for wp12

Implement the four small live gaps the audit surfaced, since they are concrete, bounded and independently
verifiable:

1. `c0966d0f6` — preserve the absolute working directory in the provider-facing prompt.
2. `ee9c08a5c` — log terminal provider turn errors at warn with structured error fields.
3. `e5f65fcd5` — preserve carriage-return progress boundaries across chunk splits.
4. `aa0884d51` — prevent stale todo batch-state replay.

`1e209caee` (blob-ref precheck) is a performance change needing its own measurement, and `b257a6dcb` /
`bcca907e5` need a focused probe and a product decision respectively — all three stay deferred **with the card
open**.

## Owner paths

- `packages/coding-agent/src/system-prompt.ts`
- `packages/coding-agent/src/session/agent-session.ts`
- `packages/coding-agent/src/session/streaming-output.ts`
- `packages/coding-agent/src/tools/todo-write.ts`
- focused tests per fix

## Verification

Per fix, deterministic and behavioral — no sleeps, using `Promise.withResolvers()` where ordering matters, and
each ablation-verified. `session-event-ordering.test.ts` is reused rather than duplicated; no new ordering
owner is created, because the ordering contract already has one.

## Not in scope

TUI visual identity. Auth/credential routing, which needs live accounts rather than guesses. The `/clear`
semantics question, which is the user's product call.
