# 153 Phase 15 check — tool-choice queue integrity

## Local checks

Focused test:

```text
bun test packages/coding-agent/test/tool-choice-queue.test.ts
16 pass
0 fail
43 expect() calls
```

Typecheck:

```text
cd packages/coding-agent && bun run check:types
$ tsgo -p tsconfig.json --noEmit
exit 0
```

Biome:

```text
bunx biome check packages/coding-agent/test/tool-choice-queue.test.ts packages/coding-agent/src/session/tool-choice-queue.ts
Checked 2 files. No fixes applied.
```

Diff check:

```text
git diff --check -- packages/coding-agent/test/tool-choice-queue.test.ts struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md devlog/_plan/260628_jwc_native_chase_implementation/150_phase15_tool_choice_queue_plan.md devlog/_plan/260628_jwc_native_chase_implementation/151_phase15_tool_choice_queue_audit.md devlog/_plan/260628_jwc_native_chase_implementation/152_phase15_tool_choice_queue_build.md devlog/_plan/260628_jwc_native_chase_implementation/153_phase15_tool_choice_queue_check.md
exit 0
```

## Employee verification

Backend verification verdict: NEEDS_FIX on check-artifact/staging hygiene only.

Passing checks:

- Scope matches `10.051-A` only.
- New tests are meaningful and non-vacuous.
- No production code change was made.
- No agent-wire, append-only session, or OMP parity scope creep.
- `10.051` has partial Phase 15 evidence and remains active.
- Backend re-ran focused test, typecheck, biome, and diff-check; all passed.

Git hygiene note:

- `devlog/.gitignore` has a pre-existing out-of-scope modification and must not be staged for Phase 15.
- `devlog/_tmp/` remains untracked and out of scope.

## Commit

Pending C-phase commit.
