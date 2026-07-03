# 20_plan — P-stage draft: `20.038` hashline/tool/plugin/task safety

Status: draft-for-critic
Cycle: PABCD phase 20 of `devlog/_plan/260703_chase_hardening_goal_passthrough/00_moc.md`
Source chase card: `struct_har/chase/20.038_omp_chase_hashline_tool_plugin_task_safety.md`
Work class: C3, cross-surface safety hardening (`edit`, `tools`, `extensibility`, `task`)

## Loop-spec header

- Loop archetype: verifier defines done. This phase imports only deterministic safety behaviors with local regression tests.
- Trigger: OMP chase card `20.038` groups hashline/edit recovery, tool argument/path coercion, custom tool/plugin exit guards, task/worktree isolation, and subprocess lifecycle hardening.
- Goal: adopt the hardening pieces JWC can prove locally without changing public workflow semantics or adding new provider/plugin/task concepts.
- Non-goals: no new workflow skill; no new task role; no broad plugin marketplace rewrite; no plugin marketplace cache-ordering change; no extension-agent discovery change; no SSH/DAP/subprocess process-manager rewrite in this phase; no adoption of OMP package names; no live network/process leak test that depends on external daemons.
- Verifier: focused Bun tests covering path/header rejection, tool argument coercion, extension handler timeout/shutdown safety, task worktree path containment, plus existing adjacent tests; then `git diff --check`, `bun run check:tools`, and `bun run check:ts`.
- Stop condition: every adopted slice has a behavior/regression test, B verifier returns DONE, C gates pass.
- Memory artifact: this plan, A/B/C/D receipts beside it, and implementation commit hashes.
- Expected terminal states: done (all selected hardening slices implemented/tested and explicitly deferred slices recorded), noop (JWC already satisfies a selected slice with direct test evidence), blocked (a selected slice needs external daemon/live process infrastructure to verify), needs-human (a selected slice changes public semantics), budget-exhausted (partial selected slices with explicit remaining gap).
- Escalation condition: if a selected slice requires changing task role dispatch semantics, plugin API shape, or edit grammar accepted syntax beyond rejecting malformed/unsafe inputs, return to P/A before coding.

## Current-state evidence

- `struct_har/chase/20.038_omp_chase_hashline_tool_plugin_task_safety.md` classifies the upstream OMP cluster as reference/split and explicitly requires regression tests for every adopted split.
- `packages/coding-agent/src/edit/apply-patch/parser.ts` slices header paths directly from `*** Add File:`, `*** Delete File:`, `*** Update File:`, and `*** Move to:` lines. It rejects malformed headers but does not centralize path-header validation in the parser.
- `packages/coding-agent/src/edit/modes/patch.ts` resolves paths at execution time, but parser-level malformed paths can still travel through preview/render paths before execution.
- `packages/coding-agent/src/edit/streaming.ts:85-90` independently slices hashline header paths, and `streaming.ts:397-399` consumes those paths for hashline natural-order previews before execution.
- `packages/coding-agent/src/extensibility/custom-tools/wrapper.ts:27-34` is the exact custom-tool argument boundary: `CustomToolAdapter.execute()` receives model/tool params and forwards them to third-party/custom tool code.
- `packages/coding-agent/src/extensibility/extensions/runner.ts:499-536` already wraps handlers with a timeout and error emission; this phase should harden shutdown/timeout observability and test the current behavior rather than inventing a new extension lifecycle.
- `packages/coding-agent/src/task/worktree.ts` owns task worktree paths; this phase can add containment tests around worktree path construction/cleanup without changing the task public API.

## Implementation plan

### Cluster A — apply-patch/hashline path-header validation

MODIFY `packages/coding-agent/src/edit/path-validation.ts` (NEW):

- Add `validateEditHeaderPath(raw: string, context: string): string`.
- Reject:
  - empty or whitespace-only paths;
  - paths containing NUL;
  - absolute POSIX paths;
  - `.`/`..` path segments;
  - Windows drive/UNC paths (`C:\\...`, `\\server\\share`) even on non-Windows.
- Keep normal relative paths with spaces valid.
- Return the trimmed valid path.

MODIFY `packages/coding-agent/src/edit/apply-patch/parser.ts`:

- Use `validateEditHeaderPath()` for `ADD_FILE_MARKER`, `DELETE_FILE_MARKER`, `UPDATE_FILE_MARKER`, and `MOVE_TO_MARKER` handling.
- Wrap validation failures in `ParseError` with the existing line number so malformed headers fail before preview/execution and include the invalid header kind/path context.

MODIFY `packages/coding-agent/src/edit/streaming.ts`:

- Use `validateEditHeaderPath()` in `parseHashlineHeaderPath()`.
- In streaming preview builders, treat invalid hashline/apply-patch header paths as no-preview for that malformed path rather than throwing during streaming render. The final parser/execution path still returns the user-facing parse error.
- Add a comment that streaming preview is best-effort and execution owns final validation.

NEW tests:

- `packages/coding-agent/test/edit-path-validation.test.ts`
- Cover valid relative path with spaces.
- Cover rejection for empty path, NUL path, absolute POSIX path, Windows drive path, UNC path, and parent traversal path.
- Cover apply-patch parser rejection for one malformed header.
- Cover hashline streaming preview ignoring a malformed header path without throwing, while valid hashline header preview still renders.

Acceptance:

- Malformed apply-patch headers fail before preview/execution.
- Malformed hashline streaming header paths do not create unsafe preview entries and do not crash streaming preview.
- Existing valid apply-patch/hashline preview behavior remains unchanged.

### Cluster B — tool argument record/unknown-field guard

MODIFY `packages/coding-agent/src/tools/jtd-utils.ts`:

- Add small, explicit helpers for tool argument validation:

```ts
export function requireRecordToolArgs(value: unknown, toolName: string): Record<string, unknown>;
export function rejectUnknownToolArgs(args: Record<string, unknown>, allowed: ReadonlySet<string>, toolName: string): void;
export function allowedToolArgKeysFromWireSchema(schema: Record<string, unknown>): ReadonlySet<string> | null;
```

- `requireRecordToolArgs()` rejects arrays, null, and primitives with a compact message.
- `rejectUnknownToolArgs()` produces deterministic sorted unknown-field names.
- `allowedToolArgKeysFromWireSchema()` reads canonical JSON Schema object `properties` after schema conversion and returns `null` when the schema is not a closed object shape this phase can safely validate.

MODIFY `packages/coding-agent/src/extensibility/custom-tools/wrapper.ts`:

- In `CustomToolAdapter.execute()`, call `requireRecordToolArgs(params, this.name)` before forwarding to `this.tool.execute()`.
- For strict custom tools, derive allowed keys from the canonical provider wire schema: call `toolWireSchema(this.tool)` from `@jawcode-dev/ai/utils/schema`, pass the result to `allowedToolArgKeysFromWireSchema()`, and call `rejectUnknownToolArgs()` only when the helper returns a key set. This covers Zod, zod-backed TypeBox, and raw JSON Schema through the existing schema owner instead of reading raw `parameters.properties` directly.
- Do **not** coerce values or mutate `params`; this phase only rejects non-record and unknown-field custom-tool arguments at the third-party/custom-tool boundary.
- Preserve existing forwarding order, `toolCallId`, `onUpdate`, `context`, and `signal` behavior.

NEW tests:

- `packages/coding-agent/test/tool-argument-coercion.test.ts`
- Helper tests: non-record rejection, array rejection, sorted unknown keys, and accepted known keys.
- Integration tests through `CustomToolAdapter.execute()`:
  - accepts a record with declared keys and forwards it unchanged;
  - rejects primitive/array params before custom tool execution;
  - rejects unknown keys for `strict: true` Zod object, zod-backed TypeBox object, and raw JSON Schema object custom tools;
  - does not reject unknown keys for non-strict custom tools.

Acceptance:

- The helper is covered independently.
- `CustomToolAdapter.execute()` is the production integration point, with accepted/rejected argument shapes tested.

### Cluster C — extension handler timeout/shutdown safety receipt

MODIFY `packages/coding-agent/src/extensibility/extensions/runner.ts` only if inspection in B shows missing behavior; otherwise NOOP with tests documenting current guarantees.

Planned hardening target:

- Ensure `#runHandlerWithTimeout()` never lets a timed-out handler's later rejection become an unhandled rejection.
- If current `Promise.race([Promise.resolve(handler(...)), Bun.sleep(...)])` is already safe in Bun because `Promise.race` attaches rejection handlers, record as noop with regression tests.
- Preserve the current shutdown contract unless B finds direct contrary evidence: each `ctx.shutdown()` / `runner.shutdown()` call forwards exactly one request to the underlying shutdown handler. Do not make shutdown idempotent in this phase; idempotence would be a behavior change for extension authors.

NEW/MODIFY tests:

- `packages/coding-agent/test/extensions-runner.test.ts`
- Add/adjust tests for timed-out handler result/error emission and no unhandled rejection after late throw.
- Add a shutdown contract test proving two explicit shutdown calls forward two requests, so future idempotence changes cannot happen accidentally.

Acceptance:

- Timeout behavior is regression-protected.
- Shutdown forwarding behavior is regression-protected as forwards-every-request.

### Cluster D — task worktree containment and cleanup guards

MODIFY `packages/coding-agent/src/task/worktree.ts` only after B inspection identifies an unguarded path edge.

Planned hardening target:

- Ensure worktree path derivation stays under the configured task/worktree root and rejects traversal-like task ids or generated directory names.
- Ensure cleanup no-ops safely when the computed path is outside the task root rather than deleting arbitrary paths.

NEW/MODIFY tests:

- `packages/coding-agent/test/task-worktree-safety.test.ts` or nearest existing task worktree test.
- Cover ordinary task id path creation, traversal-like id rejection, and cleanup guard for outside-root path.

Acceptance:

- Worktree path safety is tested through public worktree helpers, not private implementation exports added only for tests.

### Cluster E — explicit deferrals from the broad OMP card

This phase explicitly defers the following `20.038` source clusters:

- plugin marketplace cache ordering / plugin loader cache invalidation;
- extension-agent discovery safety;
- SSH/DAP/subprocess process lifecycle leak hardening.

These are not selected Phase 20 implementation slices. They require their own P/A cycles if pursued later. B-stage must record these deferrals in the build/check/done receipts and must not claim this phase closes them.


## Verification plan

Focused tests:

```bash
bun test packages/coding-agent/test/edit-path-validation.test.ts packages/coding-agent/test/tool-argument-coercion.test.ts packages/coding-agent/test/extensions-runner.test.ts packages/coding-agent/test/task-worktree-safety.test.ts
```

Fallback if B reuses existing test files instead of creating all new files: run the exact affected existing files and record why a named new file was not created.

Gates:

```bash
git diff --check
bun run check:tools
bun run check:ts
```

C-stage will run affected focused tests plus `bun run check`.

## Acceptance criteria

- Parser-level apply-patch path headers reject malformed/unsafe paths before preview/execution, and hashline streaming preview drops malformed path headers without unsafe preview entries, while valid relative paths with spaces remain accepted.
- Tool argument record/unknown-field validation has a shared helper, independent tests, and `CustomToolAdapter.execute()` integration tests for strict/non-strict custom tools across Zod, zod-backed TypeBox, and raw JSON Schema object schemas.
- Extension handler timeout/shutdown behavior is either hardened or explicitly proven as current behavior with regression tests; no unhandled late rejection can be introduced by a timeout path.
- Task worktree paths are proven to stay under their root and cleanup cannot target outside-root paths.
- Plugin marketplace cache ordering, extension-agent discovery safety, and SSH/DAP/subprocess lifecycle hardening are explicitly deferred and recorded as not closed by this phase.
- All adopted slices have regression tests; no broad lint-only closure.
