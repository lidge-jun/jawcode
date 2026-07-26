# 081 — wp3 cycle 6 A-stage synthesis

Auditor: Laplace (019f9d21-0d34-7630-9e81-9feba5f9dced), verdict **FAIL (7 blockers)**.
Main judgment: all folded into 080; scope grows 3 → 7 packets. Re-audit requested before B.

The audit's value was in attacking the SKIP decisions — four of them hid open, user-facing bugs.

| # | severity | disposition |
|---|---|---|
| 1 `20.082/133af40c0` wrongly skipped | High | accepted → **Packet D**: `#emit()` fans out to async listeners without serialization while EventController subscribes async, so event order can diverge |
| 2 `20.089` has two real gaps | High | accepted → **Packet E**: print mode skips disposal on hard error and is unbounded on success; stats server has no occupied-port recovery |
| 3 `10.117` not evidence-only | High | accepted → **Packet F**: pruning drops actionable error digests for errored edit/write/other results; `formatDuration(59_999)` → `60.0s` boundary bug |
| 4 `20.102` partly autonomous | High | accepted → **Packet G**: false-completion suppression from `agent_end.messages` is a real bug fix; error toasts / run-state title stay a user decision |
| 5 Packet B misses a sink owner, cites a wrong anchor | High | folded — python executor added as the fifth owner; `22a2ea169` (Hangul-Jamo terminal capability) removed; atomic idempotent disposal contract specified |
| 6 Packet A blanket rejection would break legal filenames | Medium | folded — start-anchored matcher, `path.win32.isAbsolute()` exemption, `./scheme://` escape, and concrete filename test matrix |
| 7 Packet C fingerprint underspecified | Medium | folded — full-prefix collision-resistant digest + length/count, single immutable commit after successful retain, generation guard for concurrent retains |

Skips CONFIRMED honest: `20.087` (no mnemopi surface, PTY drain covered), `20.088` (git availability layer; installer-specific anchor not portable), `10.110`, `10.112`.
TUI exclusions verified complete: only `20.122/fe4dec9b9` and `44586a932` touch the protected `packages/tui/src/tui.ts`; no scoped anchor references `welcome.ts`.

## Round 2 (same reviewer, post-synthesis) — GO-WITH-FIXES (4)

| # | severity | disposition |
|---|---|---|
| 1 Packet D targeted the wrong seam | High | folded — `#emit()` already invokes listeners synchronously in order; the real reorder is between concurrent `#emitSessionEvent()` calls each awaiting an asymmetric `#emitExtensionEvent()`. Packet D now specifies a FIFO gate inside `#emitSessionEvent()` (ticket taken before extension delivery, released in `finally` incl. failure and deferred `agent_end`, `message_update` immediacy preserved, subscribers never globally awaited) and the test becomes asymmetric-extension-handler ordering |
| 2 classification table contradicted the amendments | Medium | folded — table rows for 20.082 / 20.089 / 20.102 / 10.117 now name Packets D–G; residual qualified as "except the explicitly reactivated packets" |
| 3 Packet E hard-error disposal unbounded | Medium | folded — the same finite consolidation budget is required on both success and hard-error disposal; C6 asserts it |
| 4 Packet C concurrency untested | Medium | folded — C3 adds an in-place edit of an older message and an out-of-order retain (N+1 completing before N must not overwrite the newer record) |

Write-set audit confirmed clean: A `tools/write.ts`; B `streaming-output.ts` + five executors; C `hindsight/state.ts`; D `agent-session.ts`; E `print-mode.ts` + stats server; F pruning + format; G `event-controller.ts`. D and G are runtime-adjacent but do not collide. Per the reviewer's note, every packet now names UNIQUE test files so parallel workers cannot pick the same one.
