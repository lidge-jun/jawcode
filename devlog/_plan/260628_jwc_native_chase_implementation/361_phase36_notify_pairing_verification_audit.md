# 361 Phase 36 audit — notify pairing verification (independent, read-only)

> Audits plan `360`. Verdict: **PASS, zero blocking issues** (1 doc correction).

## Confirmed against live code
- `src/commands/notify.ts` uses `@jawcode-dev/utils/cli` with an `ACTIONS` array + `NotifyAction`
  union — add `"verify"` to both; existing `--token`/`--chat-id` flags suffice. `run()` builds
  `NotifyCommandArgs` and calls `runNotifyCommand`.
- `NotifyCommandArgs` is `{action, token?, chatId?, redact?, verbosity?, flags}`; adding optional
  `fetchImpl?: typeof fetch` is non-breaking.
- No existing Telegram URL builder anywhere in `src/**` → create one inline.
- `getChat` fields: `result.type` always present; `result.is_forum` only on supergroups (absent for
  private → `"unknown"` is sound).
- `check:schemas` untouched (no new settings key).

## Corrections applied
- `docs/telegram-onboarding.md` already exists (phase 12) and is validated by `notifications-docs.test.ts`
  → MODIFY (append pairing section), keep existing assertions valid.
- Token-leak watchpoint: a caught `fetch` error message can echo the URL (token). The pairing module
  sanitizes any included text by replacing the token with `***`; the token is never logged or printed.

PASS → build.
