# 141 Phase 14 audit — security auth and redaction regressions

## First Backend audit

Verdict: NEEDS_FIX.

Blocking issue:

- `10.036-A` requires project dotenv exclusion evidence, but the first plan mentioned project dotenv only as a non-goal and did not plan a negative test.

Passing areas:

- Planned files are correct owner surfaces.
- Runtime/config/env precedence, broker sentinel, contribution prep redaction, and agent-wire observation tests are meaningful.
- Plan avoids double-owning `10.047-B`, `10.047-C`, `10.038`, and `10.043`.
- No upstream port, catalog replacement, provider addition, or dotenv credential loading is implied.

## Fixes applied

1. Added `packages/ai/test/auth-storage-project-dotenv.test.ts` as the explicit project-dotenv exclusion test owner.
2. Added implementation step requiring project `.env` API keys not to win provider credential resolution or populate auth storage.
3. Added focused test command for the project-dotenv exclusion test.

## Re-audit

Backend re-audit verdict: PASS.

The previous blocking issue is resolved:

- `140_phase14_security_auth_redaction_plan.md` now names `packages/ai/test/auth-storage-project-dotenv.test.ts` as a project dotenv exclusion negative test.
- The implementation step and verification command explicitly require project `.env` API keys not to win provider credential resolution and not to populate auth storage.
- The plan still forbids adding project dotenv provider-credential loading.
- No new overlap with `10.047-B`, `10.047-C`, `10.038`, or `10.043`.

Non-blocking hygiene from re-audit:

- The new `auth-storage-project-dotenv.test.ts` path was moved from the modified-files table to the new-files table before B phase.
