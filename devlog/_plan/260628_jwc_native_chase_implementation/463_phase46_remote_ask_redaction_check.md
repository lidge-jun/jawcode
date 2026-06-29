# 463 Phase 46 check — remote ask redaction view

> All gates green. Card 10.032 advanced (gate 4 + gate 6 lead-in modeled); stays OPEN.

## Tests
- `notifications-redaction.test.ts` → **7 pass / 0 fail / 12 expect()**: stream verbatim when off;
  placeholder when on; empty→"" when on; question+options verbatim under redaction (gate 4); lead-in
  redacted under redaction with question/options intact; lead-in verbatim when off; empty lead-in
  omitted + empty options dropped.
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **151 pass / 0 fail / 455 expect()** across 27 files.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` → clean; `git diff --check` → exit 0.

## Card 10.032 status — OPEN (advanced)
Done across phases 44+45+46: gate 5 (no double-numbering), full button path + ack (gate 1 + button half
of gate 7), gate 4 (ask content not redacted) + gate 6 lead-in modeling. Still open: live wiring of
stream/ask through the view + callback into the daemon loop, verbosity/redact in-thread commands,
free-text activity/double-check acks, full lead-in ordering integration. Card remains OPEN.
