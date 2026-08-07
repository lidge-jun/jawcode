# 162 — wp12 closeout: four live session gaps, and a plan that had to be thrown away

Outcome: **PARTIAL — 4 of 31 anchors landed.** Card `20.082` stays **open**; the remaining anchors are named
follow-ups rather than closed work.

| phase | evidence |
|---|---|
| P | `160` — subscriber-ordering plan (**retracted**, see below) |
| A | **FAIL** → corrected scope folded into `161` |
| B | `351f35b`, `083ceb2`, `6df6cc1`, `9d591e6`, `77566a2` |
| C | **FAIL** (3 blocking + 1 medium) → all four closed in `77566a2`, `5dd6c28` |

## The plan I opened with was wrong, and the audit killed it

I planned to add a subscriber fan-out gate for `133af40c0`. Three independent reasons it was wrong:

1. `#subscriberEmitGate` **already exists** at `agent-session.ts:1872`, ticketed at `:1894`, and it already
   matches upstream including the `message_update` fast path.
2. My reproduction was a toy script rather than a production path — `isInitialized` is set before subscribing.
3. It would have **broken a tested contract**. `session-event-ordering.test.ts` has a test literally named
   *"does not await a slow subscriber"*. The fix would have made the product worse, and the disproof was
   sitting in the same directory as the file I was about to edit.

That is the failure mode worth recording: I proposed a confident regression, and only the audit stopped it.

## What actually shipped

| anchor | fix | commit |
|---|---|---|
| `c0966d0f6` | absolute provider cwd — dropped `shortenPath` from the system prompt | `351f35b` |
| `ee9c08a5c` | provider turn errors surfaced at warn on `agent_end` | `351f35b`, `77566a2` |
| `e5f65fcd5` | carriage-return progress boundaries in `OutputSink` | `083ceb2`, `77566a2` |
| `aa0884d51` | stale todo replay guard, ordered by revision | `6df6cc1`, `9d591e6` |

## The C round found three blocking defects in my own work

**1. The todo guard compared list sizes.** `rm` and `drop` shrink the list on purpose, so a size heuristic
silently discards real removals. Replaced with a monotonic `revision` on `TodoWriteToolDetails`, tracked
session-side as `#lastTodoRevision`. Size is not an ordering.

**2. Carriage-return handling was wrong at both ends.** A trailing CR at end of stream lost its boundary, and
the normalizer corrupted sixel payloads — inside a sixel, CR is *data*, not a progress boundary. The
normalizer now runs inside the sixel-aware callback so the tokenizer sees the payload first, and
`#flushPendingCarriageReturn()` runs at the top of `dump()`.

**3. Raw provider `errorMessage` went into the log verbatim.** That string echoes the failing request in
practice: `Authorization` headers, signed URL params, account emails. The log is plaintext and gets pasted
into bug reports. `redactProviderErrorMessage` strips credential- and identity-shaped spans and bounds the
length, while leaving provider, model, status and kind readable — redaction that destroys the diagnostic
value would defeat the point of the log line.

**4 (medium). Neither regression suite touched the real event path.** Both imported their helper directly.
Ablation proved the hole is real: deleting the `agent_end` call site left all 12 provider-log tests green,
and restoring the size-based todo heuristic left all 3 todo tests green. Two new tests drive a real
`AgentSession` over a mock provider stream and go red under exactly those ablations. The todo test wires the
tool to a **different** session facade, which is the arrangement the result bridge exists to serve.

## Verification

- `check:ts`, `check:schemas`, `verify-g002-gates`, `rebrand-inventory --strict`, `check-visible-definitions`,
  `ci:test:smoke` — all pass.
- Scoped suite: 208 pass / 0 fail across 34 files, including `session-event-ordering`.
- Chase gates hold at baseline: 136 offenders, 39 lifecycle violations — this phase contributes zero.
- `agent-session*` set: 243 pass / 12 fail. The failure set is **byte-identical** to `5ca3e2c` with my source
  files reverted, so all 12 are pre-existing. `agent-session-auto-compaction-queue.test.ts` hangs on its own
  at the baseline commit too; it is excluded from the run and named here rather than claimed as passing.

## Left open

`20.082` keeps ~27 anchors. Closing it by labelling them "UNPROBED" would have been avoidance, so the card
stays open. Notable unprobed groups: devin context-overflow recovery (`cc3b2011b`, `4999f3881`), `/new`
atomicity (`4d685bf76`, `447eb51f2`), warp session identity (`88cbd85b1`, `a2d881b68`), and auth stickiness
(`817a08122`, `c6cff316b`, `c55196eb3`).
