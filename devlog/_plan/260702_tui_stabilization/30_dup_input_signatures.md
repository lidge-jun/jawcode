# 30 — WP2: local-submission signature protocol hardening (260703)

## Loop continuity

WP1 D (20_realign_v3_committed_bottom.md) fixed the realign-side duplication (queued chip
pixels parked into the committed block). The remaining protocol defects live in the
local-submission dedup bookkeeping and fire exactly when the user submits the SAME text
repeatedly (the e2e log: "나한테 야한말 해봐" ×5).

## RCA (class C2)

The dedup protocol uses three structures that all collapse or cross-consume under
identical texts:

1. `optimisticUserMessageSignature` is a SINGLE scalar (`interactive-mode.ts:328`,
   set at `:855`). A second optimistic submission overwrites it; after the first user
   `message_start` consumes it (`event-controller.ts:324`), the second optimistic
   component's event sees `wasOptimistic === false` and `addMessageToChat` re-adds it —
   duplicate user box. With different texts the FIRST message's event mismatches the
   overwritten scalar and duplicates instead.
2. `locallySubmittedUserSignatures` is a `Set<string>` (`interactive-mode.ts:329`):
   N identical submissions collapse to one entry (`recordLocalSubmission`, `:811`).
3. `event-controller.ts:319` consumes BOTH credits per event
   (`Set.delete(sig) || wasOptimistic` — delete always runs), so an optimistic event
   also eats a queued identical message's credit; the queued delivery then fails
   `wasLocallySubmitted` and `editor.setText("")` wipes the draft the user is typing
   (#783 regression, identical-text variant).

## Fix

Multiset + FIFO, minimal-diff (raw ctx fields keep their access style):

- **`types.ts:130-131`** — `optimisticUserSignatures: string[]` (FIFO, duplicates
  allowed) replaces the scalar; `locallySubmittedUserSignatures: Map<string, number>`
  (refcount) replaces the Set.
- **`interactive-mode.ts`**
  - `:328-329` field types as above.
  - `recordLocalSubmission` (`:806-818`): increment refcount; the dispose closure
    decrements once (delete at 0).
  - `startPendingSubmission` (`:855`): push the signature onto the FIFO.
  - `cancelPendingSubmission` (`:882`), `finishPendingSubmission` (`:924`),
    `showError` (`:2176`): remove ONE occurrence of the pending submission's signature
    (recomputed from `submission.text` + image count) instead of nulling the scalar;
    customType submissions never pushed one, so nothing to remove.
- **`event-controller.ts:309-337`**
  - `wasOptimistic` = remove-first-occurrence from the FIFO (consumes exactly one).
  - `wasLocallySubmitted` = decrement-refcount(sig) `|| wasOptimistic` — an optimistic
    event still consumes its own refcount credit (it registered both), but a queued
    identical submission keeps its independent credit, so its delivery no longer wipes
    the draft.
  - Drop the `:322-324` scalar clear (subsumed by FIFO removal).
- **`input-controller.ts:765`** — `.clear()` exists on Map; no change needed
  (verified). The FIFO is deliberately NOT cleared there: `restoreQueuedMessagesToEditor`
  aborts queued messages only, matching today's scalar behavior; a pending optimistic
  delivery still dedups via the FIFO (audit-confirmed).
- **`interactive-mode.ts:865`** (audit finding) — the customType branch's scalar clear is
  deleted outright: customType submissions never push a FIFO entry.
- **`ui-helpers.ts:790` and `:881`** (audit finding) — `#deliverQueuedMessage` via
  `withLocalSubmission` and the resume-first-prompt path call
  `recordLocalSubmission`/dispose; both work unchanged under refcount semantics (each
  call increments once, its dispose decrements once), listed here for completeness.

## Tests

Primary file `test/modes/controllers/event-controller-message-start.test.ts`: adapt the
ctx factory (`:34-35`, `:77-78`) to the new shapes, keep the five existing user-role
cases green (same semantics), and add:

- two identical optimistic signatures → both deliveries skip the chat add (no duplicate
  user box), second delivery preserves the editor draft;
- optimistic + queued identical text → queued delivery adds to chat exactly once AND
  preserves the draft (today: wiped);
- refcount: two `recordLocalSubmission` calls with the same text need two consumptions;
  dispose decrements exactly once (double-dispose safe).

Audit round-1 found six more test files (seven total incl. the primary) that construct the scalar/Set shapes — update
mechanically (same semantics): input-controller-keybindings.test.ts (:152-171, :786-834),
issue-825-repro.test.ts (:87-110, :161-219), input-controller-escape.test.ts (:137-138),
input-controller-skill-queue.test.ts (:118-119, :515), issue-927-repro.test.ts (:65-71),
interactive-mode-status.test.ts (:116-125).

## Verification

`bun test test/modes/controllers/event-controller-message-start.test.ts` +
`bun run check` in packages/coding-agent; grep confirms no other consumer of the two
fields exists outside the four files above (checked: main.ts touches only
`markPendingSubmissionStarted`).

## D — cycle summary (260703 WP2)

- **P**: RCA — scalar optimistic signature overwrite, Set collapse for identical texts,
  double credit consumption per delivery.
- **A**: Codex gpt-5.5 xhigh micro-audit — semantics confirmed over 5 scenarios; 3
  completeness gaps (ui-helpers callers, customType scalar clear, test-file scope)
  folded into the plan.
- **B**: FIFO (`optimisticUserSignatures: string[]`) + refcount
  (`locallySubmittedUserSignatures: Map<string, number>`) with single-credit consumption
  in event-controller; `#takePendingOptimisticSignature` on cancel/error/finish paths;
  multiset helpers exported from ui-helpers. B-verify NEEDS_FIX → test fakes now
  decrement refcounts instead of deleting; re-verified core protocol leak-free.
- **C**: 7 affected test files 74/78 (4 pre-existing at clean HEAD, tracked as suite
  debt), biome + tsgo clean.

Files: packages/coding-agent/src/modes/{types.ts, interactive-mode.ts,
controllers/event-controller.ts, utils/ui-helpers.ts} + 7 test files + this devlog.

Next-direction: WP3 — ctrl+o fold targeting (currentTurnStartIndex reset on mid-turn
steering deliveries + missing isLiveToggleEligible filter in toggle targets).
