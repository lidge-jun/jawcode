# 430 — wp39: an anchor with no place to land

Source: OMP `c55196eb3`, from the follow-up list on the still-open card `20.082`.

| phase | evidence |
|---|---|
| P | traced the anchor to a file that does not chain |
| A | **pass**, after checking the transport question |
| B | `98a4cce` (coverage only — no source change) |
| C | full `packages/ai` suite green; both guards ablated |

## Two reasons the port does not apply

Upstream widens a guard in `openai-responses.ts` so `invalid_prompt` / "Request blocked" resets the stateful
chain baseline instead of throwing.

1. **Wrong file.** JWC's `openai-responses.ts` has no `previous_response` chaining at all — no
   zero-data-retention branch, no stale-previous-response detection. Stateful chaining lives in
   `openai-codex-responses.ts`.
2. **Wrong shape.** That provider does not need an error-code allowlist, because it resets
   **unconditionally**: `handleCodexStreamFailure` calls `resetCodexWebSocketAppendState` on every failure,
   which clears `lastResponseId` — the field `buildCodexWebSocketRequest` chains from. Whatever the server
   rejected the request for, the next one already sends full context.

Porting the match would have added an allowlist to a path that is safe precisely because it has none.

## Auditing the verdict, not filing it

"Already satisfied" has been wrong twice this session — wp22 and wp36 both had a live defect one layer over
a plausible N/A. So the claim got two checks:

- **Is the reset universal?** `handleCodexStreamFailure` guards on `websocketState`, which *reads* as
  websocket-only. But that state is built from `sessionKey && providerSessionState`, not from the transport
  decision — so an SSE turn carries it and takes the same reset. Pinned by test.
- **Is `lastResponseId` really the chain field?** Yes: the delta request is conditional on it, and the reset
  clears exactly that.

## Why coverage instead of nothing

`git diff --stat` on the provider is empty; this phase changes no source. The invariant it pins is
*invisible at the call site* — a reset whose purpose is "do not poison the next request" reads like
defensive cleanup and is exactly the kind of thing that gets tidied away. Each guard now fails under its own
ablation, so the reason it exists is checkable rather than remembered.
