# 116 Phase 12 build — media policy docs/tests

## Files changed

| File | Change |
|---|---|
| `docs/telegram-onboarding.md` | Added `Media and files` section with unsupported status and future security gates. |
| `packages/coding-agent/test/notifications-docs.test.ts` | Added regression test preventing media/file support overclaims. |
| `struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md` | Added Phase 12 evidence and kept card active. |
| `devlog/_plan/260628_jwc_native_chase_implementation/114_phase12_media_policy_docs_plan.md` | Plan. |
| `devlog/_plan/260628_jwc_native_chase_implementation/115_phase12_media_policy_docs_audit.md` | Audit record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/116_phase12_media_policy_docs_build.md` | This build record. |

## Regression coverage

`notifications-docs.test.ts` now requires `docs/telegram-onboarding.md` to say:

- media/file transfer is not implemented yet;
- workspace path-confinement is only a future helper;
- an active authorized Telegram sink is required before runtime support;
- MIME and size policy must be enforced;
- logs must not include raw file contents.

It also rejects direct support claims for:

- `telegram_send`;
- `sendPhoto`;
- `sendDocument`;
- inbound Telegram media injection.

## Runtime impact

None. No production source file was changed in this slice.
