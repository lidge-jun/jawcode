# 460 Phase 46 plan — remote ask redaction view (card 10.032, gate 4 + gate 6 lead-in)

> Today `notifications.redact` is only a config flag (`config.ts:10`, `settings-schema.ts:395`,
> surfaced in `notify-cli.ts`); there is NO applied redaction logic. Card 10.032 gate 4 requires that
> when redaction is on, **the ask question and options remain readable** while surrounding
> stream/context text is redacted. This phase encodes that invariant as a pure view builder and also
> models the assistant lead-in (gate 6). Card 10.032 stays OPEN.

## Slice (pure, side-effect-free)
NEW `packages/coding-agent/src/notifications/notification-redaction.ts`:
- `interface RedactionPolicy { redact: boolean }`
- `REDACTED_PLACEHOLDER = "[redacted]"`
- `redactStreamText(text, policy) → string` — assistant/tool stream + context text: returns the text
  verbatim when `redact` is false; when `redact` is true returns `REDACTED_PLACEHOLDER` for non-empty
  text and `""` for empty/whitespace (don't emit a placeholder for nothing).
- `interface RemoteAskView { leadIn?: string; question: string; options: string[] }`
- `buildRemoteAskView({ question, options, leadIn?, policy }) → RemoteAskView`
  - **question + options are ALWAYS verbatim** regardless of `policy.redact` (gate 4 invariant) —
    they are the actionable prompt and must be answerable remotely.
  - `leadIn` (assistant pre-ask text, gate 6) is passed through when `redact` is false, redacted to the
    placeholder when `redact` is true, and omitted entirely when empty/whitespace.
  - options array is shallow-copied; empty-string options are dropped (defensive).

Barrel export from `index.ts`.

## Why this shape
Gate 4's risk is leaking secrets in streamed content while still letting the user act on the ask. The
view builder makes the "question/options bypass redaction, everything else obeys it" rule explicit and
unit-testable, independent of transport. Live wiring (feeding daemon stream + ask payload through this
view) is a later integration slice.

## Tests — `notifications-redaction.test.ts`
1. `redactStreamText` returns text unchanged when `redact:false`.
2. `redactStreamText` returns placeholder for non-empty text when `redact:true`.
3. `redactStreamText` returns "" for empty/whitespace when `redact:true`.
4. `buildRemoteAskView` keeps question + options verbatim when `redact:true` (gate 4).
5. `buildRemoteAskView` redacts the lead-in when `redact:true` but leaves question/options intact.
6. `buildRemoteAskView` passes lead-in through verbatim when `redact:false`.
7. `buildRemoteAskView` omits an empty/whitespace lead-in and drops empty options.

## Verification
`bun test test/notifications-redaction.test.ts` + full notifications regression + `bun run check:types`
+ biome + `git diff --check`.

## Scope guard (still open on 10.032)
Live wiring of stream/ask payload through this view, callback ↔ daemon-loop integration, verbosity
(`/verbose`,`/lean`,`/verbosity`) + `/redact` in-thread commands, free-text activity/double-check acks.
Card stays OPEN.
