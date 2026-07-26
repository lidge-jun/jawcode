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
