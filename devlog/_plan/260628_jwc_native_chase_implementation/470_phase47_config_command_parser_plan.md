# 470 Phase 47 plan — in-thread verbosity/redact command parser (card 10.032)

> Card 10.032 requires in-thread config commands `/verbose`, `/lean`, `/verbosity`, `/redact`. This
> phase adds a pure parser mirroring the existing `lifecycle-command-parser.ts` pattern
> (commandName helper rejecting `@mentions`, strict arg validation, ok/reason result). Card stays OPEN.

## Slice (pure, side-effect-free)
NEW `packages/coding-agent/src/notifications/config-command-parser.ts`:
- reuse `NotificationVerbosity` (`"lean" | "verbose"`) from `config.ts`.
- `NotificationConfigCommandIntent`:
  - `{ kind: "set_verbosity"; verbosity }` — `/verbose`, `/lean`, `/verbosity <lean|verbose>`.
  - `{ kind: "show_verbosity" }` — `/verbosity` (no arg).
  - `{ kind: "set_redact"; redact }` — `/redact <on|off|yes|no|true|false>` (case-insensitive).
  - `{ kind: "show_redact" }` — `/redact` (no arg).
- `NotificationConfigCommandRejectionReason`:
  `empty_command | unknown_command | unexpected_arguments | invalid_verbosity | invalid_redact_value`.
- `parseNotificationConfigCommand(input) → { ok:true; intent } | { ok:false; reason }`.
  - mirror `commandName`: must start with `/`, length>1, no `@`.
  - `/verbose`, `/lean` take no args (else `unexpected_arguments`).
  - `/verbosity` 0 args → show; 1 arg in {lean,verbose} → set; >1 args → unexpected; bad arg →
    `invalid_verbosity`.
  - `/redact` 0 args → show; 1 arg truthy/falsey token → set; >1 → unexpected; bad → `invalid_redact_value`.

Barrel export from `index.ts`. The parser is intent-only; applying intents to `Settings`
(`notifications.verbosity` / `notifications.redact`) is the caller's job (later wiring slice).

## Tests — `notifications-config-command-parser.test.ts`
1. `/verbose` → set_verbosity verbose; `/lean` → set_verbosity lean.
2. `/verbosity` → show_verbosity; `/verbosity verbose` → set; `/VERBOSITY LEAN` (case) → set lean.
3. `/verbosity bogus` → invalid_verbosity; `/verbose x` → unexpected_arguments.
4. `/redact` → show_redact; `/redact on|yes|true|1` → set true; `/redact off|no|false|0` → set false.
5. `/redact maybe` → invalid_redact_value; `/redact a b` → unexpected_arguments.
6. empty / non-slash / `@mention` / unknown command rejections.

## Verification
`bun test test/notifications-config-command-parser.test.ts` + full regression + check:types + biome +
`git diff --check`.

## Scope guard (still open on 10.032)
Live routing of inbound thread text → this parser → Settings mutation + ack, daemon-loop wiring,
free-text activity/double-check acks, assistant lead-in ordering integration. Card stays OPEN.
