# 470 — wp43: two anchor groups that looked N/A, one of which was not

Source: OMP warp session-identity anchors (`88cbd85b1`, `a2d881b68`) and devin context-overflow anchors
(`cc3b2011b`, `4999f3881`), both carried as **unprobed** on the still-open card `20.082`.

| phase | evidence |
|---|---|
| P | both groups probed; one closed on inspection, one found defective |
| A | **pass**, wire-value hazard identified before any edit |
| B | `893ea8f` |
| C | gates green at baseline; two independent ablations |

## Neither provider exists here

There is no devin module anywhere in `packages/ai/src` or `packages/coding-agent/src`, and the only `warp`
match in the tree is an unrelated model name (`morph-warp-grep-v2`) in `models.json`. So neither anchor is
portable as written.

That is where the earlier method mattered: a missing upstream path is not a verdict. wp22 and wp36 both looked
N/A and had live defects one layer over. So each group got probed for its *capability*, and the two came back
differently.

## devin half: already satisfied by construction

The capability is context-overflow recovery, and it is well developed here. `isContextOverflow`
(`packages/ai/src/utils/overflow.ts:103`) carries 26 provider-specific patterns plus a no-body `400/413` case
and a usage-based silent-overflow path that is deliberately gated on `usage.estimated`, so a provider that
only estimates token counts cannot trip recovery on a turn it actually accepted. The recovery path
(`agent-session.ts:7311`) gates on same-model and not-from-before-compaction, tries context promotion to a
larger model first, and only then falls back to compaction.

Recorded as closed on inspection. No port.

## warp half: live, and defective in the cursor provider

Session identity *is* live here, and the cursor provider had the shape the anchors fix. Two module-global maps
(`cursor.ts:142-143`) cached per-conversation state, keyed on the wire `conversationId` — which falls back to
the host session id. That id survives a model switch and is identical across accounts.

| provider | same session id, two models | same session id, two accounts |
|---|---|---|
| cursor (before) | **collides** | **collides** |
| kiro | distinct | distinct |

`kiro` already hashes `profileArn:provider:modelId:sessionId` for exactly this reason, so the fix had a
precedent in-tree rather than being invented.

The collision is harmful, not merely untidy, because the cached state is model-specific:
`buildCursorSystemPromptJsons` prepends an extra edit-discipline prompt for composer harness models, and
`ConversationStateStructure` also carries todos, file states, summary archives and subagent states.

## The hazard the audit caught

`conversationId` is not only a cache key. It is also sent on the wire as `AgentRunRequest.conversationId`.
Rewriting it into a qualified hash — the obvious one-line fix — would have changed a **server-owned
identifier** and broken conversation continuity on Cursor.

So the fix introduces a separate local `cacheKey` and leaves the wire value byte-identical. A test pins that
the request still assigns `state.conversationId`, because that is the property a future refactor is most
likely to "simplify" away.

A second site turned up in the same pass: the server-echoed checkpoint handler also wrote back under the raw
id. Fixing only the read path would have reopened the collision from the write side.

## The unbounded half

Neither map had a `delete` or `clear` anywhere, so both grew for the lifetime of the process. There is a
comment claiming the blob stores do not grow unboundedly — it is true but narrower than it reads: it argues
that identical history hashes to the same blob ids *within one conversation*. It says nothing about
accumulation *across* conversations.

Both caches are now LRU-bounded, with reads refreshing recency. That detail is load-bearing and has its own
test: without it, background traffic evicts the conversation currently being streamed, which is the worst
possible choice.

## Ablations

Two, run separately. Reducing the key to the bare `conversationId` turns exactly the two qualification tests
red while the same-key reuse control stays green. Deleting the eviction loop turns exactly the three eviction
tests red.

The first ablation attempt was **invalid and was caught**: a `perl` one-liner interpolated `${conversationId}`
as an empty shell variable, producing a constant key rather than the intended one. The test failures looked
plausible — three red — but the substitution count was zero, so it got inspected instead of believed, and
redone with an exact literal replacement. A passing-looking ablation and a plausible-looking failing one are
both worth checking.

Test: `packages/ai/test/cursor-conversation-cache-identity.test.ts`.
