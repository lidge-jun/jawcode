# 471 Phase 47 build+check — in-thread verbosity/redact command parser

> Self-audited C2 pure parser mirroring `lifecycle-command-parser.ts`. Card 10.032 advanced, OPEN.

## Build
### NEW `packages/coding-agent/src/notifications/config-command-parser.ts` (~80 lines, pure)
- `parseNotificationConfigCommand(input) → {ok:true;intent} | {ok:false;reason}`.
- Intents: `set_verbosity` (`/verbose`,`/lean`,`/verbosity <lean|verbose>`), `show_verbosity`
  (`/verbosity`), `set_redact` (`/redact <on|off|yes|no|true|false|1|0|enable|disable>`),
  `show_redact` (`/redact`).
- Reasons: `empty_command | unknown_command | unexpected_arguments | invalid_verbosity |
  invalid_redact_value`. `commandName` guard rejects non-slash / `@mention`.
- Intent-only; Settings mutation deferred to caller.

### MODIFY `index.ts` — export config-command-parser.

## Check
- `notifications-config-command-parser.test.ts` → **6 pass / 0 fail / 24 expect()**: verbose/lean;
  verbosity show/set/case; bad verbosity + extra args; redact show + all truthy/falsey tokens; bad
  redact + extra args; empty/non-slash/@mention/unknown rejections.
- Full regression → **157 pass / 0 fail / 479 expect()** across 28 files; check:types 0; biome clean;
  diff-check 0.

## Card 10.032 status — OPEN
Verbosity/redact command PARSING done; live routing (inbound thread text → parser → Settings + ack),
daemon-loop wiring, free-text acks, lead-in ordering integration remain. Card OPEN.
