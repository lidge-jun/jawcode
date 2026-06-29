# Phase 1 — codex encrypted_content invalid-drop/well-form guard

> Card: 10.055 (cluster 2 of 5, GJC split). Source: GJC `4e0c22db` (#1208).
> Tier: THOROUGH (transport/data-integrity surface). No 1:1 copy — JWC-shaped adaptation.

## Problem

JWC `packages/ai/src/providers/openai-codex/request-transformer.ts` builds the
Codex Responses request body. Input items replayed from prior turns can carry an
`encrypted_content` field (reasoning replay). If that value is a malformed
(lone-surrogate) string or a non-string, the upstream Codex backend can reject
the request or persist corrupt replay state. GJC #1208 guards this by:
- well-forming string `encrypted_content` (`.toWellFormed()`),
- dropping `encrypted_content` entirely when it is not a string.

JWC currently has no such guard. GJC applied it inside `normalizeInputTextPartFields`;
JWC has no equivalent function and instead normalizes input in `filterInput` +
the inline map in `transformRequestBody`. So this is adapt, not copy.

## JWC change (diff-level)

MODIFY `packages/ai/src/providers/openai-codex/request-transformer.ts`:

1. Extend `InputItem` interface: add `encrypted_content?: unknown;`.
2. Add a small pure helper:
   ```ts
   function normalizeEncryptedContent(item: InputItem): InputItem {
       if (!("encrypted_content" in (item as Record<string, unknown>))) return item;
       const rec = { ...(item as Record<string, unknown>) };
       if (typeof rec.encrypted_content === "string") {
           rec.encrypted_content = (rec.encrypted_content as string).toWellFormed();
       } else {
           delete rec.encrypted_content;
       }
       return rec as InputItem;
   }
   ```
3. Apply it inside the existing `body.input.map(...)` pass in `transformRequestBody`
   (after the function_call_output handling), so every replayed item is guarded
   without adding a second iteration. Keep JWC behavior (function_call_output
   fallback message) intact.

## Test (NEW)

`packages/ai/test/openai-codex-encrypted-content.test.ts` (or extend existing
`openai-codex*.test.ts` if present):
- string `encrypted_content` with a lone surrogate -> well-formed output retains the field.
- non-string `encrypted_content` (number/object/null) -> field deleted.
- item without `encrypted_content` -> unchanged.
- guard does not disturb function_call / function_call_output handling.

## Verification

- `bunx tsc -p packages/ai` (or workspace check:ts) clean on the touched file.
- `bun test packages/ai/test/openai-codex*` green.
- `git diff --check`.
- Independent reviewer (THOROUGH): confirm the guard cannot drop *valid* encrypted
  replay and that JWC function-call handling is unchanged.

## Decision (10.055 sub-feature: drop invalid encrypted_content)

- Classification: import (adapted to JWC transformer shape).
- Naming impact: none (internal ai provider surface).
- Test impact: new focused test.
- Rollout: no migration; defensive transport guard.
- Residual risk: closed once reviewer confirms no valid-content loss.
