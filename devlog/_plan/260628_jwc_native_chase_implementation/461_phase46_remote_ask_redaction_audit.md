# 461 Phase 46 audit — remote ask redaction (independent, read-only)

> Audits plan `460`. Verdict: **PASS**. Card 10.032 stays OPEN.

## Confirmed (cited)
- No duplication: `grep redact src/notifications/*.ts` → only config-flag refs (`config.ts:10,76,87,98`);
  no applied redaction logic exists in the notifications domain.
- Gate 4 wording confirmed in `10.032` card: "Redaction does not redact ask question/options" +
  behavior note "Questions/options must remain readable remotely."
- Plan invariant (question/options verbatim regardless of redact; lead-in/stream redacted) faithfully
  implements gate 4 and contradicts no other gate; gate 6 lead-in correctly modeled as redactable.
- `[redacted]` is a single constant (`REDACTED_PLACEHOLDER`), changeable in one place; placeholder text
  is irrelevant to the gate-4 invariant.
- `settings-schema.ts:395` `notifications.redact` boolean default true → `RedactionPolicy{redact}` is a
  faithful minimal abstraction.
- Scope guard lists live wiring / verbosity commands / free-text acks open → card NOT closed.
