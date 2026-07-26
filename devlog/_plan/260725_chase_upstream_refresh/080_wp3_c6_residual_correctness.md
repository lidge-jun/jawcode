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

### Packet A — malformed URI-like write targets (`20.083/ea5c816e6`)

Files: `packages/coding-agent/src/tools/write.ts`, `packages/coding-agent/test/write-xdev-dispatch.test.ts`.

The router handles registered URIs, then lets an UNKNOWN URI-like string fall through as a filesystem path
(`write.ts:675`), so a typo like `xdt://foo` silently creates a local file.

### Packet B — spilled-output descriptor lifecycle (`20.122/31098f924`, `22a2ea169`)

Files: `packages/coding-agent/src/session/streaming-output.ts`, `packages/coding-agent/src/exec/bash-executor.ts`,
`packages/coding-agent/src/eval/executor-base.ts`, `packages/coding-agent/src/eval/js/executor.ts`,
`packages/coding-agent/src/tools/bash-interactive.ts`, plus a new focused test.

The sink is closed only when spill CREATION fails (`streaming-output.ts:900`); there is no idempotent disposal
contract covering the abort/error paths, so descriptors leak.

### Packet C — Hindsight full-session retention cache (`20.107`)

Files: `packages/coding-agent/src/hindsight/state.ts`, plus a new focused test.

Full-session retain re-serializes the entire message array every time (`state.ts:277`). Cache the transcript
prefix, but detect rewind/branch/prefix-rewrite via fingerprint and rebuild — a stale transcript is worse than
the cost it saves.

## Hard exclusions

- `packages/tui/src/tui.ts` viewport/fill/gap/scroll model and `packages/coding-agent/src/modes/components/welcome.ts` — user-curated visual identity per AGENTS.md. Any anchor touching them is dropped, not deferred quietly.

## Accept criteria

- C1 (A): `xdt://foo`, `xd:/foo`, `xd//foo` produce a clear diagnostic and create NO local file; registered `conflict://`/internal URIs still route to their handlers; a genuine local filename still writes.
- C2 (B): a bash run past the spill threshold that errors or aborts closes the sink exactly once; an abort during sink creation leaves no descriptor to revive; repeated tail-replay/dump failures do not accumulate FDs; normal `dump()` output and artifact metadata are unchanged.
- C3 (C): an append-only turn reuses the cached prefix; a rewind/branch shrink or prefix rewrite is detected by fingerprint mismatch and triggers a full rebuild; a forced retain bypasses the cache; an empty transcript or a failed retain never advances the cache cursor.
- C4: `bun run check:ts` exit 0; focused suites green; no NEW failures in `packages/coding-agent/test` vs baseline; `git diff --check` clean.

## Residual / escalation

- `20.102` error notifications + run-state title — **user decision**: whether errors should raise notifications and whether the terminal title should carry run state.
- Cards 20.082 / 20.087 / 20.088 / 20.089 / 10.110 / 10.112 — remaining anchors need a concrete failing repro or a redesign; recorded per card at wp4.
- `20.122` scroll/viewport anchors — permanently excluded (user-curated surface).
