# 082 — wp3 cycle 6 closeout: residual correctness (final implementation cycle)

Outcome: **DONE** (7 packets landed; 4 of them existed only because the A-audit rejected wrong SKIP decisions).

| phase | evidence |
|---|---|
| P | `080_wp3_c6_residual_correctness.md` — Dewey triage of 11 remaining A-bucket cards: 3 genuine gaps, 7 skips, 1 escalated |
| A | Laplace **FAIL** (7 blockers) → four SKIPs hid open user-facing bugs; scope 3→7 packets. Round 2 GO-WITH-FIXES (4): Packet D reseated from `#emit()` to a FIFO gate in `#emitSessionEvent()`, table reconciled, hard-error disposal bounded, concurrent-retain case added (`081`) |
| B | 4 workers / 7 packets: Einstein (A+F), Huygens (B, with an approved fifth-owner correction — the plan's `eval/executor-base.ts` was a phantom path, the real owner is `tools/eval.ts`), Goodall (C+D), Kepler (E+G); integration `907043f` |
| C | Bernoulli **FAIL** → 3 blockers (1 Critical) → `f58b0e3`; **FAIL again** → 2 more → `a6a5fe0`; final **PASS** |

## The C-review chain

| round | finding | fix |
|---|---|---|
| 1 | **Critical**: stats port recovery killed any listener whose executable name matched a `bun`/`node`/`jwc` allowlist — an ordinary dev server on that port would be terminated. Plus a forgeable `x-jwc-stats-dashboard` header as "identity", and an incomplete false-completion fix | allowlist deleted; reclaim now needs a 0600 instance record matching PID + process start identity + exact command line PLUS a fresh 256-bit challenge answered by nonce-keyed HMAC-SHA256, failing closed otherwise; completion made authoritative on the settled payload (`f58b0e3`) |
| 2 | `findLast(assistant)` skipped the real tail, so `[successfulAssistant, user]` / `[…, toolResult]` still notified; and the new ownership requirement made the stats dashboard unable to START on Windows | inspect the EXACT terminal message; Windows starts with `identityVerified:false` and simply never reclaims (`a6a5fe0`) |
| 3 | — | PASS: unverified records cannot enter reclaim (requires `=== true`), all tail shapes fail closed |

## Delivered

- **A** unknown URI-like write targets rejected with a start-anchored matcher; Windows absolutes, `./scheme://` escapes, `report:final.txt` and `dir/a://b` still write.
- **B** idempotent sink disposal (atomic finalize before awaiting creation, post-finalization pushes ignored, `end()` exactly once, `dump()`/`dispose()` order-independent) at all five real owners.
- **C** full-prefix SHA-256 hindsight retention cache with length framing, single immutable commit after a successful retain, generation guard against out-of-order completion.
- **D** FIFO gate in `#emitSessionEvent()` so an event without extension handlers cannot overtake an earlier one that has them; subscribers still never globally awaited.
- **E** 1500ms disposal budget on success AND hard-error paths; stats port recovery with cryptographic ownership proof.
- **F** sanitized actionable digests for ALL errored tool results; `formatDuration` boundary fixed.
- **G** completion derived from the settled `agent_end` payload, fail-closed on every non-success tail, background path included.

## Residual

- **Packet D liveness**: an extension handler that never resolves stalls the FIFO — no timeout was added this cycle. Both the implementer and the reviewer agree it is a real tracked residual.
- `20.102` error toasts + run-state title — user decision.
- `10.117/a8aacd3d7` screenshot bounding — no-surface/adapt-needed (JWC `computer_use` diverges).
- `20.122` scroll/viewport anchors — permanently excluded (user-curated surface).
- Cards 20.082 / 20.087 / 20.088 / 20.089 / 10.110 / 10.112 — remaining anchors need a concrete repro or redesign.
