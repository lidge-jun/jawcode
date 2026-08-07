# 111 — wp7 A synthesis: audit FAIL folded

Helmholtz (independent, read-only, gpt-5.6-sol) returned **FAIL** on `110` with 6 MAJOR and 2 MINOR findings.
All are folded into `110`. None were argued down, because each was independently reproducible against the
tree.

## Verification of the findings before accepting them

A FAIL verdict is not self-justifying, so the load-bearing claims were re-checked directly:

| finding | independent check | holds? |
|---|---|---|
| `group:` is upstream-only metadata | `rg 'group:' settings-schema.ts` → **0 hits**; `UiBase` at `:108` has only tab/label/description/condition | **yes** |
| tools run concurrently, so one ask-end must not clear attention | `agent-loop.ts` collects `sharedTasks` and awaits `Promise.allSettled(tasks)` | **yes** |
| no error-notification surface exists | `rg '"error\.notify"\|sendErrorNotification'` → **0 hits**; only `completion.notify` at `:1208` | **yes** |
| disposal-in-`stop()` would be too late | `shutdown()` calls `popTerminalTitle()` at `:2143` **then** `this.stop()` at `:2144` | **yes** |

The fourth is the sharpest: the draft's own stated invariant ("dispose before pop") was violated by the
draft's own placement. Ordering had to be pinned to `shutdown()` explicitly, with an idempotent second call in
`stop()`.

## Disposition

| # | finding | disposition |
|---|---|---|
| MAJOR 1 | "notifications already satisfied" is false | **accepted, retracted in `110`.** Card splits: title half implemented, notification half becomes a tracked residual and `20.102` closes ADAPT-partial rather than clean |
| MAJOR 2 | single-id attention races under concurrent asks | **accepted.** `#titleAttentionToolCallIds` set; restore `working` only when empty |
| MAJOR 3 | plan approval is a blocking surface too | **accepted.** JWC-native `resolve`/`plan_approval` path joins the same set; upstream `tools.approvalMode` recorded as non-applicable, not silently dropped |
| MAJOR 4 | teardown misses `stop()` and crash paths | **accepted.** Disposal before `popTerminalTitle()` in `shutdown()`, plus idempotent disposal in `stop()` |
| MAJOR 5 | override can cross a session change | **accepted.** `newSession` (`:394`) and `switchSession` (`:474`) resync an authoritative title |
| MAJOR 6 | pure tests prove only string shape | **accepted.** Runtime tests with forced TTY, `stdout.write` spy, fake timers, plus a concurrent-ask ownership test |
| MINOR 1 | wrong settings metadata shape | **accepted.** Flat `ui: { tab, label, description }` |
| MINOR 2 | repo contract reminders | **accepted.** `NodeJS.Timeout` not `ReturnType<>`, `#private` fields, no `console.*`, no dynamic import, `## [Unreleased]` changelog entry |

## What the audit changed about the outcome

The draft would have closed `20.102` clean while implementing roughly half of it. The corrected plan closes it
**partial with a named residual**. That is a worse-looking result and a truer one — and it is the difference
between a card that says "done" and a card a future reader can trust.
