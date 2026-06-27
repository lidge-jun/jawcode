# 117 Phase 12 check — media policy docs/tests

## Local checks

Focused docs tests:

```text
bun test packages/coding-agent/test/notifications-docs.test.ts
4 pass
0 fail
29 expect() calls
```

Typecheck:

```text
cd packages/coding-agent && bun run check:types
$ tsgo -p tsconfig.json --noEmit
exit 0
```

Diff check:

```text
git diff --check -- docs/telegram-onboarding.md packages/coding-agent/test/notifications-docs.test.ts struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md devlog/_plan/260628_jwc_native_chase_implementation/114_phase12_media_policy_docs_plan.md devlog/_plan/260628_jwc_native_chase_implementation/115_phase12_media_policy_docs_audit.md devlog/_plan/260628_jwc_native_chase_implementation/116_phase12_media_policy_docs_build.md devlog/_plan/260628_jwc_native_chase_implementation/117_phase12_media_policy_docs_check.md
exit 0
```

## Employee verification

- Backend: DONE. Verified no runtime source changes, docs test style/pass, typecheck pass, security gate wording, and diff check.
- Docs: DONE. Verified media/file unsupported wording, test/doc alignment, `10.034-B`-only chase evidence, active card status, and concrete devlog artifacts.

## Commit

Staged files:

```text
devlog/_plan/260628_jwc_native_chase_implementation/114_phase12_media_policy_docs_plan.md
devlog/_plan/260628_jwc_native_chase_implementation/115_phase12_media_policy_docs_audit.md
devlog/_plan/260628_jwc_native_chase_implementation/116_phase12_media_policy_docs_build.md
devlog/_plan/260628_jwc_native_chase_implementation/117_phase12_media_policy_docs_check.md
docs/telegram-onboarding.md
packages/coding-agent/test/notifications-docs.test.ts
struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md
```

Commit:

```text
f1948eb docs(notifications): guard telegram media policy
```
