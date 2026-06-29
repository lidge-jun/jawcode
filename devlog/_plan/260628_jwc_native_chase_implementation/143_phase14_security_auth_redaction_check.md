# 143 Phase 14 check — security auth and redaction regressions

## Local checks

AI auth-storage focused tests:

```text
bun test packages/ai/test/auth-storage-config-override.test.ts packages/ai/test/auth-storage-broker-no-sentinel.test.ts packages/ai/test/auth-storage-project-dotenv.test.ts
12 pass
0 fail
33 expect() calls
```

Coding-agent redaction focused tests:

```text
bun test packages/coding-agent/test/contribution-prep.test.ts packages/coding-agent/test/agent-wire/event-observation.redteam.test.ts
11 pass
0 fail
514 expect() calls
```

Biome focused check:

```text
bunx biome check packages/ai/test/auth-storage-config-override.test.ts packages/ai/test/auth-storage-broker-no-sentinel.test.ts packages/ai/test/auth-storage-project-dotenv.test.ts packages/coding-agent/test/contribution-prep.test.ts packages/coding-agent/test/agent-wire/event-observation.redteam.test.ts packages/coding-agent/src/session/contribution-prep.ts
Checked 6 files in 6ms. No fixes applied.
```

Typechecks:

```text
cd packages/ai && bun run check:types
$ tsgo -p tsconfig.json --noEmit
exit 0

cd packages/coding-agent && bun run check:types
$ tsgo -p tsconfig.json --noEmit
exit 0
```

## Employee verification

Backend verification verdict: NEEDS_FIX on git hygiene only.

Passing checks:

- Phase 14 implementation matches `10.036-A` and `10.047-A` only.
- No project dotenv credential loading was added.
- Production code change is limited to `packages/coding-agent/src/session/contribution-prep.ts`.
- No overlap with env scrub, auth-gateway/browser-origin, RPC, or URL/search files.
- Chase cards `10.036` and `10.047` record partial evidence and remain active.
- Backend re-ran focused tests, biome, package typechecks, and scoped `git diff --check`; all passed.

Git hygiene note:

- `devlog/.gitignore` has a pre-existing out-of-scope modification and must not be staged for Phase 14.
- `devlog/_tmp/` remains untracked and out of scope.

## Commit

Pending C-phase commit.
