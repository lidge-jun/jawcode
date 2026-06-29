# 313 Phase 31 check — 10.036-B Fable tool-choice catalog drift guard

## Test

```bash
bun test packages/ai/test/fable-tool-choice-catalog.test.ts
```

```text
2 pass
0 fail
5 expect() calls
Ran 2 tests across 1 file. [59.00ms]
```

## Type check (constraint #8: no tsc)

```bash
cd packages/ai && bun run check:types   # tsgo -p tsconfig.json --noEmit → exit 0
```

## Diff check

```bash
git diff --check -- <staged set>   # exit 0 (recorded at commit; .gitignore/_tmp left unstaged)
```

## Status

`10.036-B` closed: the Fable forced-tool_choice invariant (GJC #482) is now pinned by a JWC-native
test. Card `10.036` stays active pending a `10.036-C` (credential import/onboarding) assessment.
Ready for independent read-only verification.
