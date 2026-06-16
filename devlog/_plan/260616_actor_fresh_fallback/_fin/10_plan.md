# Plan: Actor Resume-Fail Fresh Spawn Fallback (R3 — post A-synthesis)

## File 1: MODIFY `packages/coding-agent/src/jwc-runtime/actor-registry.ts`

### Change 1A: Exclude `failed` from `isWorkflowActorSelectable`

**Before** (line 204-206):
```ts
export function isWorkflowActorSelectable(actor: WorkflowActorRecord, key: WorkflowActorKey): boolean {
	return actor.status !== "retired" && actor.status !== "running" && actorMatchesKey(actor, key);
}
```

**After**:
```ts
export function isWorkflowActorSelectable(actor: WorkflowActorRecord, key: WorkflowActorKey): boolean {
	return actor.status !== "retired" && actor.status !== "running" && actor.status !== "failed" && actorMatchesKey(actor, key);
}
```

---

## File 2: MODIFY `packages/coding-agent/src/task/index.ts`

### Change 2A: Extract `runSubprocessBaseArgs`

Before `if (!isIsolated)` (line 1608), extract shared parameters:

```ts
const runSubprocessBaseArgs = {
    cwd: this.session.cwd,
    agent: effectiveAgent,
    task: renderSubagentUserPrompt(task.assignment, simpleMode),
    assignment: task.assignment.trim(),
    context: sharedContext,
    description: task.description,
    index,
    id: task.id,
    subagentId: task.id,
    taskDepth,
    modelOverride: effectiveModelOverride,
    parentActiveModelPattern,
    parentSessionId: this.session.getSessionId?.() ?? undefined,
    thinkingLevel: thinkingLevelOverride,
    outputSchema: effectiveOutputSchema,
    persistArtifacts: !!artifactsDir,
    artifactsDir: effectiveArtifactsDir,
    contextFile: contextFilePath,
    enableLsp: subagentLspEnabled,
    signal,
    eventBus: this.session.eventBus,
    onProgress: (progress: AgentProgress) => {
        progressMap.set(index, { ...structuredClone(progress) });
        AsyncJobManager.instance()?.recordSubagentProgress(task.id, progress);
        emitProgress();
    },
    authStorage: this.session.authStorage,
    modelRegistry: this.session.modelRegistry,
    settings: this.session.settings,
    contextFiles,
    skills: availableSkills,
    autoloadSkills: resolvedAutoloadSkills,
    workspaceTree: this.session.workspaceTree,
    promptTemplates,
    localProtocolOptions,
    parentArtifactManager,
    parentHindsightSessionState: this.session.getHindsightSessionState?.(),
    parentTelemetry: this.session.getTelemetry?.(),
    forkContextSeed,
};
```

Then both `runSubprocess` calls spread this and override `runMode`, `resumeMessage`, `sessionFile`, `cacheAffinity`, and optionally `worktree`.

### Change 2B: Add `attemptFreshFallback` helper

Returns `{ result, freshActor, freshSessionFile } | undefined`. Handles all registry finalization internally for both the failed-resume actor and the fresh actor.

```ts
interface FreshFallbackResult {
    result: SingleResult;
    freshActor: WorkflowActorRecord;
    freshSessionFile: string;
}

const attemptFreshFallback = async (
    result: SingleResult,
    worktree?: string,
): Promise<FreshFallbackResult | undefined> => {
    // Only retry when this was a resumed actor that failed at subprocess level
    if (actorRouting.kind !== "actor" || actorRouting.runMode !== "message") return undefined;
    if (result.paused) return undefined;
    if ("aborted" in result && result.aborted) return undefined;
    if (result.exitCode === 0 && !result.error) return undefined;

    // 1. Finalize the failed resume (marks actor "failed")
    await finalizeWorkflowActorResult(result);

    // 2. Allocate fresh actor (same key → same id → upsert replaces)
    const freshSessionFile = path.join(
        effectiveArtifactsDir,
        `${workflowActorId(actorRouting.actor)}-${Date.now()}.jsonl`,
    );
    const freshActor = allocateActorRecord(actorRouting.actor, freshSessionFile);
    const wfSessionId = this.session.getSessionId?.();
    if (wfSessionId) {
        const reg = await readActorRegistry(this.session.cwd, wfSessionId);
        await writeActorRegistryAtomic(
            this.session.cwd, wfSessionId,
            markActorRunning(upsertActor(reg, freshActor), freshActor.id, task.id),
        );
    }

    // 3. Re-run with fresh spawn
    const freshResult = await runSubprocess({
        ...runSubprocessBaseArgs,
        ...(worktree ? { worktree } : {}),
        runMode: "initial",
        resumeMessage: undefined,
        sessionFile: freshSessionFile,
        cacheAffinity: undefined,
    });

    // 4. Finalize fresh actor in registry
    if (wfSessionId) {
        const reg2 = await readActorRegistry(this.session.cwd, wfSessionId);
        const updatedReg = freshResult.paused
            ? markActorPaused(reg2, freshActor.id, freshSessionFile, task.id)
            : freshResult.exitCode === 0 && !freshResult.error
                ? markActorIdle(reg2, freshActor.id, freshSessionFile, task.id)
                : markActorFailed(reg2, freshActor.id, freshResult.error ?? freshResult.stderr ?? "fresh spawn failed", task.id);
        await writeActorRegistryAtomic(this.session.cwd, wfSessionId, updatedReg);
    }

    return { result: freshResult, freshActor, freshSessionFile };
};
```

### Change 2C: Wire fallback into non-isolated path

**Before** (lines 1656-1658):
```ts
const resultWithForkContext = forkContext ? { ...result, forkContext } : result;
await finalizeWorkflowActorResult(resultWithForkContext);
return resultWithForkContext;
```

**After**:
```ts
// Fresh-spawn fallback: if resumed actor failed, retry with fresh actor
const freshFallback = await attemptFreshFallback(result);
if (freshFallback) {
    // Helper already finalized both actors — just return
    const freshWithForkContext = forkContext ? { ...freshFallback.result, forkContext } : freshFallback.result;
    return freshWithForkContext;
}
const resultWithForkContext = forkContext ? { ...result, forkContext } : result;
await finalizeWorkflowActorResult(resultWithForkContext);
return resultWithForkContext;
```

### Change 2D: Wire fallback into isolated path

Insert between `runSubprocess` result (line ~1720) and merge/patch post-processing. Key points:
- Change `const result` to `let result` at line 1672
- On fresh success, rebind `finalizeWorkflowActorResult` to fresh actor before merge/patch
- On fresh failure, return directly (helper already finalized — NO extra `finalizeWorkflowActorResult` call)

```ts
let result = await runSubprocess({ ... });

// Fresh-spawn fallback
const freshFallback = await attemptFreshFallback(result, isolationDir);
if (freshFallback) {
    if (freshFallback.result.exitCode !== 0 || freshFallback.result.error) {
        // Fresh also failed — helper already finalized, return directly
        const freshWithForkContext = forkContext ? { ...freshFallback.result, forkContext } : freshFallback.result;
        return freshWithForkContext;
    }
    // Fresh succeeded — rebind for merge/patch post-processing
    result = freshFallback.result;
    taskSessionFile = freshFallback.freshSessionFile;  // requires `let taskSessionFile`
    finalizeWorkflowActorResult = async (r: SingleResult): Promise<void> => {
        const wfSid = this.session.getSessionId?.();
        if (!wfSid) return;
        const reg = await readActorRegistry(this.session.cwd, wfSid);
        const updated = r.paused
            ? markActorPaused(reg, freshFallback.freshActor.id, freshFallback.freshSessionFile, task.id)
            : r.exitCode === 0 && !r.error
                ? markActorIdle(reg, freshFallback.freshActor.id, freshFallback.freshSessionFile, task.id)
                : markActorFailed(reg, freshFallback.freshActor.id, r.error ?? r.stderr ?? "failed", task.id);
        await writeActorRegistryAtomic(this.session.cwd, wfSid, updated);
    };
}

const resultWithForkContext = forkContext ? { ...result, forkContext } : result;
if (mergeMode === "branch" && resultWithForkContext.exitCode === 0) {
    // ... existing merge/patch post-processing unchanged
```

Note: `taskSessionFile` (line 1574) and `finalizeWorkflowActorResult` (line 1583) must become `let` declarations.

---

## Acceptance Criteria

1. **Same-call seamless retry**: Resume failure → automatic fresh spawn within the same call. Main agent receives one result.
2. **Exactly-once retry**: Max one fresh-spawn retry per `runTask`. Fresh failure returns as-is.
3. **Fresh actor is resume-eligible**: On success, fresh actor → `idle` → selectable for future resume.
4. **Fresh failure passthrough**: If fresh spawn fails, result returned with fresh actor marked `failed`.
5. **Failed actors excluded**: `isWorkflowActorSelectable` returns `false` for `failed`.
6. **Both paths covered**: Non-isolated and isolated execution paths both support fallback.
7. **Aborted excluded**: Signal-cancelled subprocesses do not trigger fresh fallback.
8. **No stale closure**: Isolated fallthrough rebinds `finalizeWorkflowActorResult` and `taskSessionFile` to fresh actor.
9. **No double finalize**: Helper handles all finalization; callers do not redundantly finalize.
10. **Cross-call contract**: Next call with pre-existing `failed` actor → `resolveCompatibleActor` skips it → allocates `runMode: "initial"` directly.
11. **Existing tests pass**: `bun test packages/coding-agent/` and `bun run check:ts`.

## Verification

1. Unit test for `isWorkflowActorSelectable` with `failed` status.
2. Routing test in `task-workflow-actor-routing.test.ts` for failed-resume → fresh-spawn.
3. Type check and existing test suite pass.
