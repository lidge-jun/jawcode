# 97 Phase 9 check — TUI, performance, research, and docs edge slices

## Planned checks

| Check | Expected result |
|---|---|
| `git diff --check` on intended Phase 9 docs/cards | PASS |
| TUI/input/render focused tests | PASS |
| research/perf/docs focused tests | PASS |
| git status separation | Only intended Phase 9 files staged; unrelated `devlog/.gitignore` and `devlog/_tmp/` unstaged |

## Local check results

| Check | Result |
|---|---|
| `git diff --check` on intended Phase 9 docs/cards | PASS |
| TUI/input/render focused tests | PASS — `90 pass / 0 fail` |
| research/perf/docs focused tests | PASS — `69 pass / 0 fail` |
| Docs build verification employee | DONE |

## Focused test evidence

TUI/input/render command:

```sh
bun test packages/coding-agent/test/input-controller-escape.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/hook-selector-inline-input.test.ts packages/coding-agent/test/hook-selector-overflow.test.ts packages/coding-agent/test/tui-tree-list-collapsed-lines.test.ts packages/coding-agent/test/jobs-observer.test.ts packages/coding-agent/test/event-controller-abort-render.test.ts
```

Result:

```text
90 pass
0 fail
Ran 90 tests across 7 files.
```

Research/perf/docs command:

```sh
bun test packages/coding-agent/test/autoresearch-discovery.test.ts packages/coding-agent/test/autoresearch-state.test.ts packages/coding-agent/test/autoresearch-tools.test.ts packages/coding-agent/test/perf-corpus.test.ts packages/coding-agent/test/bench/context-optimization-effectiveness.test.ts packages/coding-agent/test/notifications-docs.test.ts packages/coding-agent/test/docs-utility-surface-cleanup.test.ts
```

Result:

```text
69 pass
0 fail
Ran 69 tests across 7 files.
```

## Employee verification

Docs read-only build verification returned DONE:

- Files `90-97` exist with expected plan/split/audit/build/check content.
- `02_phase_map.md` includes Phase 9 required split artifacts `91-94`.
- Chase cards `10.041`, `10.046`, `10.049`, and `10.052` contain Phase 9 evidence sections and remain active.
- Diff scope is docs-only; no `packages/**`, product `docs/**`, `scripts/**`, generated benchmark artifacts, tests, or upstream clones were modified.
- `devlog/.gitignore` and `devlog/_tmp/` remain separate and unstaged.

## Known constraints

This is a docs-only phase. Source/typecheck is not required unless source files change. Focused tests are smoke evidence for the owner surfaces used by future slices, not proof that all future implementation slices are complete.
