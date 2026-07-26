# 080 — wp3 cycle 6: residual correctness (final implementation cycle)

## Scoping pass (P, 2026-07-26, HEAD `2018c9f`)

Triage of the remaining 11 A-bucket cards by sol surveyor (Dewey). The headline finding: after five
implementation cycles **most remaining anchors are already covered, out-of-surface, or need a product
decision** — only three genuine gaps remain worth implementing.

| card | anchors | est. open | classification | disposition |
|---|---:|---:|---|---|
| 20.083 tool/fs/shell/git safety | 38 | 1 | **import** | Packet A — `ea5c816e6` unknown URI-like write target |
| 20.122 TUI/tool lifecycle | 14 | 3–5 | one high-value import | Packet B — `31098f924` + `22a2ea169` spilled-output FD lifecycle. **`fe4dec9b9`/`44586a932` touch `packages/tui/src/tui.ts` viewport/scroll — FORBIDDEN by AGENTS.md, excluded** |
| 20.107 compaction/retry/history | 18 | 1–3 | one import, rest no-surface | Packet C — Hindsight full-session retention cache (`c7fb052db`, `671169cf4`, `41e958a73`, `73b3a2ad5`). Snapcompact frame rescue has no JWC surface |
| 20.082 session/settings/persistence | 31 | 3–5 | mostly already-fixed | skip — cycles 1–5 rewrote settings/session/provider/auth/compaction; reactivate only on a fresh repro |
| 20.087 native diff/search/memory/perf | 40 | 2–4 | no-surface / needs-redesign | skip — mnemopi/snapcompact boundaries differ; new native kernels need benchmark + fallback design |
| 20.088 release/build/platform/CI | 46 | 2–4 | already covered | skip — OIDC canon, release scripts, native loader, model cache already changed; musl/Windows needs platform probes |
| 20.089 stats/logging/collab | 20 | 2–3 | already covered | skip — stats landed in cycle 5; collab-web/IRC absent |
| 10.110 SDK/ACP/bridge lifecycle | 41 | 2–5 | covered + needs-redesign | skip — no bulk chase without a concrete failing probe |
| 10.112 notifications/Telegram/daemon | 59 | 2–4 | heavily covered | skip — prior chase implemented daemon/ownership/control/inbound; upstream `--timeout` CLI has no JWC counterpart |
| 20.102 error notify + run-state title | 10 | 5–8 | **needs-decision** | escalate — JWC deliberately excludes errors from completion notifications (`event-controller.ts:1163`); error toasts and run-state titles are a UX/config policy choice |
| 10.117 CI/release/docs evidence | 83 | 0 product | evidence-fill | not an implementation card — handle in wp4 evidence reconciliation |

## Packets (disjoint files)

> **A-audit amendments (081 synthesis) — verdict was FAIL.** The auditor probed the SKIP decisions and found
> four of them hid real, open, user-facing bugs. Scope grows from 3 packets to 7:
> (1) `20.082/133af40c0` reactivated — `#emit()` fans out to async listeners without serializing
> (`agent-session.ts:1745`) while `EventController` subscribes an async listener (`event-controller.ts:260`),
> so observed event order can diverge from session order.
> (2) `20.089` reactivated — print mode calls unbounded `dispose()` on success (`print-mode.ts:148`) and skips
> disposal entirely on hard error (`:110`); the stats server calls `Bun.serve()` with no occupied-port recovery
> (`stats/src/server.ts:271`).
> (3) `10.117` is NOT evidence-only — `b14b1975` (pruning drops actionable error digests for errored
> edit/write/other results, `pruning.ts:67`) and the duration half of `84a2209d` (`formatDuration(59_999)` →
> `60.0s`, `utils/src/format.ts:10`) are real product bugs.
> (4) `20.102` splits — new error toasts / run-state title stay a user decision, but the false-completion bug is
> autonomous: `agent_end` ignores its settled message payload (`event-controller.ts:852`) and suppression reads
> mutable session state (`:1163`), so a pruned errored assistant can emit a false "Complete".
> (5) Packet B gains a FIFTH sink owner (python `eval/py/executor.ts:484`, whose `finally` at `:586` only
> unregisters the bridge) and drops `22a2ea169` (a Hangul-Jamo terminal-capability refactor, unrelated to FDs).
> (6) Packet A needs an explicit local-path escape contract.
> (7) Packet C needs full-prefix, atomic cache validation.
> Skips CONFIRMED honest by the auditor: `20.087` (no mnemopi surface; PTY drain covered), `20.088`
> (git availability layer covers it; installer-specific anchor not portable), `10.110`, `10.112`.

### Packet A — malformed URI-like write targets (`20.083/ea5c816e6`)

Files: `packages/coding-agent/src/tools/write.ts`, `packages/coding-agent/test/write-xdev-dispatch.test.ts`.

The router handles registered URIs, then lets an UNKNOWN URI-like string fall through as a filesystem path
(`write.ts:675`), so a typo like `xdt://foo` silently creates a local file.

**Local-path escape contract (required):** use a START-ANCHORED URI-like matcher; exempt
`path.win32.isAbsolute()`; keep `./foo://bar` and `./xd/web_search` writable as the intentional-local escape.
Tests must cover ordinary colon names (`report:final.txt`), embedded `://` (`dir/a://b`), Windows drive paths,
and registered internal schemes — a blanket rejection would break legal POSIX filenames.

### Packet B — spilled-output descriptor lifecycle (`20.122/31098f924` only)

Files: `packages/coding-agent/src/session/streaming-output.ts`, `packages/coding-agent/src/exec/bash-executor.ts`,
`packages/coding-agent/src/eval/executor-base.ts`, `packages/coding-agent/src/eval/js/executor.ts`,
`packages/coding-agent/src/eval/py/executor.ts`, `packages/coding-agent/src/tools/bash-interactive.ts`,
plus a new focused test.

The sink is closed only when spill CREATION fails (`streaming-output.ts:900`); there is no idempotent disposal
contract covering the abort/error paths, so descriptors leak. `dump()` ends the file sink directly (`:972`)
while creation is fire-and-forget (`:889`), so a late creation or a thrown path leaks.

**Required contract:** disposal marks finalized ATOMICALLY before awaiting creation, ignores post-finalization
pushes, awaits in-flight creation, flushes once, and makes both `dump()` and `dispose()` idempotent. Ownership
is per executor invocation, so `finally` disposal is correct — including the python executor, whose `finally`
currently only unregisters the bridge.

### Packet C — Hindsight full-session retention cache (`20.107`)

Files: `packages/coding-agent/src/hindsight/state.ts`, plus a new focused test.

Full-session retain re-serializes the entire message array every time (`state.ts:277`). Cache the transcript
prefix, but detect rewind/branch/prefix-rewrite via fingerprint and rebuild — a stale transcript is worse than
the cost it saves.

**Required validation:** a boundary-message fingerprint CANNOT detect an in-place edit of an older message.
Hash every transcript-relevant field across the ENTIRE cached prefix (at minimum ordered `role + content`, with
tool-result rewrites represented in normalized content), and compare a collision-resistant digest together with
length/count. Commit cache state as ONE immutable record only after a successful retain; failed or empty
retains leave it untouched; concurrent retains need generation/serialization so an older completion cannot
overwrite a newer cursor.

### Packet D — session event ordering (`20.082/133af40c0`)

Files: `packages/coding-agent/src/session/agent-session.ts` (the `#emit()` fan-out only) + focused test.
Serialize subscriber fan-out per session so a slow async listener cannot reorder events relative to session
order; test delayed listener handling across consecutive events and exactly-once delivery.

### Packet E — print-mode disposal + stats server port recovery (`20.089/b1c0a0193`, `4010bef98`, `477112e81`)

Files: `packages/coding-agent/src/modes/print-mode.ts`, `packages/stats/src/server.ts` + focused tests.
Bound memory consolidation on normal completion and dispose BEFORE a hard-error exit; add occupied-port
recovery and dashboard identity validation to the stats server.

### Packet F — pruning error digests + duration formatting (`10.117/b14b1975`, duration half of `84a2209d`)

Files: `packages/agent/src/compaction/pruning.ts`, `packages/utils/src/format.ts` + focused tests.
Preserve sanitized actionable error evidence for ALL errored tool results (today only bash/search keep digests);
fix the `formatDuration` boundary so `59_999` no longer renders `60.0s` next to a `1m` branch.

### Packet G — false-completion suppression (`20.102/90527a5ae`, autonomous half only)

Files: `packages/coding-agent/src/modes/controllers/event-controller.ts` + focused test.
Derive the terminal outcome from `agent_end.messages` instead of re-reading mutable session state, so a pruned
errored assistant cannot produce a false "Complete" notification. New error toasts and run-state titles remain
a user decision and are NOT implemented.

## Hard exclusions

- `packages/tui/src/tui.ts` viewport/fill/gap/scroll model and `packages/coding-agent/src/modes/components/welcome.ts` — user-curated visual identity per AGENTS.md. Any anchor touching them is dropped, not deferred quietly.

## Accept criteria

- C1 (A): `xdt://foo`, `xd:/foo`, `xd//foo` produce a clear diagnostic and create NO local file; registered `conflict://`/internal URIs still route; `./foo://bar`, `report:final.txt`, `dir/a://b` and Windows drive paths still write.
- C2 (B): a bash run past the spill threshold that errors or aborts closes the sink exactly once; an abort during sink creation leaves no descriptor to revive; repeated tail-replay/dump failures do not accumulate FDs; normal `dump()` output and artifact metadata are unchanged.
- C3 (C): an append-only turn reuses the cached prefix; a rewind/branch shrink or prefix rewrite is detected by fingerprint mismatch and triggers a full rebuild; a forced retain bypasses the cache; an empty transcript or a failed retain never advances the cache cursor.
- C5 (D): with two async subscribers of different speeds, observed event order matches session order and each event is delivered exactly once.
- C6 (E): print mode disposes before a hard-error exit and bounds consolidation on success; the stats server recovers from an occupied port and rejects a mismatched dashboard identity.
- C7 (F): an errored edit/write/other tool result keeps a sanitized actionable digest through pruning; `formatDuration(59_999)` and the `1m` boundary agree.
- C8 (G): an `agent_end` whose settled messages end in an error emits NO completion notification even when session state still holds an older successful message.
- C4: `bun run check:ts` exit 0; focused suites green; no NEW failures in `packages/coding-agent/test` vs baseline; `git diff --check` clean.

## Residual / escalation

- `20.102` error notifications + run-state title — **user decision**: whether errors should raise notifications and whether the terminal title should carry run state.
- Cards 20.082 / 20.087 / 20.088 / 20.089 / 10.110 / 10.112 — remaining anchors need a concrete failing repro or a redesign; recorded per card at wp4.
- `20.122` scroll/viewport anchors — permanently excluded (user-curated surface).
