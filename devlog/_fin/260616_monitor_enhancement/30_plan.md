# Monitor/Background Tool Consolidation Plan

Date: 2026-06-16
PABCD Stage: P
Spec: `.jwc/specs/jaw-interview-monitor-background-consolidation.md`
Investigation: `05_competitive_analysis.md`, `10_p1_silent_deduplicate.md`
Subagent reports: P3MergeImpact, P4JobUsageAudit

---

## Scope

3 patches, 2 waves:

| Wave | Patch | Files | Risk |
|---|---|---|---|
| W1 | P1: silent + deduplicate + poll auto-apply | 2 files | LOW |
| W2 | P3: monitor → background absorption + P4: job removal | ~10 files | MEDIUM |

---

## Wave 1: P1 — silent + deduplicate

### W1-A: monitor.ts schema + implementation

**File**: `packages/coding-agent/src/tools/monitor.ts` (MODIFY)

**Schema additions** (after line 38, `persistent` field):
```typescript
silent: z.boolean().optional().describe(
  "When true, notifications queue silently without triggering a new agent turn. Default: false; auto-enabled for kind='poll'."
),
deduplicate: z.boolean().optional().describe(
  "When true, skip notification if stdout line identical to previous. Default: false; auto-enabled for kind='poll'."
),
```

**State variable** (after line 127 `let flushScheduled`):
```typescript
let lastSeenLine: string | undefined;
```

**Auto-apply for poll** (after line 119 `const persistent`):
```typescript
const effectiveSilent = params.silent ?? (params.kind === "poll");
const effectiveDedup = params.deduplicate ?? (params.kind === "poll");
```

**sendNotification triggerTurn** (line 188-190):
```diff
- { triggerTurn: true, deliverAs: "followUp" },
+ { triggerTurn: !effectiveSilent, deliverAs: "followUp" },
```

**steer fallback** (line 199):
```diff
- this.session.steer?.({ customType: "task-notification", content, details });
+ if (!effectiveSilent) {
+   this.session.steer?.({ customType: "task-notification", content, details });
+ }
```

**onRawLine deduplicate** (line 228):
```diff
  if (persistent) {
+   if (effectiveDedup && line === lastSeenLine) return;
+   lastSeenLine = line;
    schedulePersistentNotification(line);
    return;
  }
```

### W1-B: monitor.md prompt update

**File**: `packages/coding-agent/src/prompts/tools/monitor.md` (MODIFY)

Add to Inputs section after `persistent`:
```markdown
- `silent` (optional, default `false`; auto-enabled for `kind: "poll"`): when true, notifications queue silently without triggering a new agent turn. The agent sees them on its next natural turn.
- `deduplicate` (optional, default `false`; auto-enabled for `kind: "poll"`): skip notification when stdout line is identical to the previous one.
```

### Acceptance Criteria (W1)
- `kind: "poll"` monitor → notifications don't trigger agent turns (silent auto-on)
- `kind: "poll"` monitor → identical stdout lines produce 0 notifications (dedup auto-on)
- `kind: "log"` monitor → existing behavior unchanged (silent/dedup default false)
- Explicit `silent: false` on poll → overrides auto-apply, turns trigger
- Non-persistent monitor → silent/dedup irrelevant (first line only, auto-cancel)

---

## Wave 2: P3 + P4 — Tool Consolidation

### W2-A: Add `op: "start_monitor"` to background tool

**File**: `packages/coding-agent/src/tools/background.ts` (MODIFY)

Add `"start_monitor"` to op enum:
```diff
- op: z.enum(["list", "detail", "follow", "cancel", "settings"])
+ op: z.enum(["list", "detail", "follow", "cancel", "settings", "start_monitor"])
```

Add monitor-specific optional fields to schema:
```typescript
command: z.string().optional().describe("Shell command for start_monitor op"),
monitorKind: z.enum(["log", "poll", "watch", "other"]).optional().describe("Monitor category for start_monitor op"),
monitorDescription: z.string().optional().describe("Monitor description for start_monitor op"),
timeout: z.number().min(1).optional().describe("Monitor timeout for start_monitor op"),
persistent: z.boolean().optional().describe("Keep monitor past current turn"),
silent: z.boolean().optional().describe("Silent notifications for start_monitor"),
deduplicate: z.boolean().optional().describe("Dedup identical lines for start_monitor"),
```

Add execution branch in `execute()`:
```typescript
if (params.op === "start_monitor") {
  // Validate required fields
  if (!params.command) throw new ToolError("command is required for start_monitor");
  if (!params.monitorKind) throw new ToolError("monitorKind is required for start_monitor");
  if (!params.monitorDescription) throw new ToolError("monitorDescription is required for start_monitor");
  
  // Delegate to MonitorTool logic (extracted to shared function)
  return executeMonitor(this.session, {
    command: params.command,
    kind: params.monitorKind,
    description: params.monitorDescription,
    timeout: params.timeout,
    persistent: params.persistent,
    silent: params.silent,
    deduplicate: params.deduplicate,
  }, context);
}
```

Extract monitor execution logic from `MonitorTool.execute()` into shared function `executeMonitor()` in a new file `packages/coding-agent/src/tools/monitor-exec.ts`.

### W2-B: Remove MonitorTool

**File**: `packages/coding-agent/src/tools/monitor.ts` (DELETE or gut)
**File**: `packages/coding-agent/src/tools/index.ts` (MODIFY)

Remove `monitor` from `BUILTIN_TOOLS`:
```diff
- monitor: MonitorTool.createIf,
```

**Permission system** (agent-session.ts:690,693):
```diff
- PERMISSION_REQUIRED_TOOLS has "monitor"
+ PERMISSION_REQUIRED_TOOLS has "background" when op === "start_monitor"
```

Update `isShellExecutionPermissionTool()`:
```diff
- toolName === "monitor"
+ toolName === "monitor" || (toolName === "background" && params?.op === "start_monitor")
```

### W2-C: Remove JobTool

**File**: `packages/coding-agent/src/tools/job.ts` (DELETE or gut)
**File**: `packages/coding-agent/src/tools/index.ts` (MODIFY)

Remove `job` from `BUILTIN_TOOLS`:
```diff
- job: JobTool.createIf,
```

### W2-D: background tool → always active

**File**: `packages/coding-agent/src/tools/background.ts` (MODIFY)

```diff
- readonly loadMode = "discoverable";  // (or whatever current)
+ readonly loadMode = "essential";
```

### W2-E: Prompt updates

**Files**:
- `packages/coding-agent/src/prompts/tools/background.md` (MODIFY) — add start_monitor section, remove "Use `monitor`" reference
- `packages/coding-agent/src/prompts/tools/monitor.md` (DELETE)
- `packages/coding-agent/src/prompts/tools/job.md` (DELETE)
- `packages/coding-agent/src/prompts/tools/subagent.md` (MODIFY) — remove "job remains available" clause

### W2-F: System prompt update

**File**: `packages/coding-agent/src/prompts/system/system-prompt.md` (MODIFY)

Remove `{{#has tools 'job'}}` block. Update tool inventory to show `background` as always-active with start_monitor capability.

### W2-G: Test updates

- `test/agent-session-acp-permission.test.ts` — update monitor permission tests to use `background({op:"start_monitor"})`
- `test/claude-code-tools-fixtures.test.ts` — update or remove monitor.schema.json fixture
- `test/fixtures/claude-code-tools/monitor.schema.json` — delete or update
- `test/background-tool-prompts.test.ts` — update prompt file references

### W2-H: Extract monitor execution

**File**: `packages/coding-agent/src/tools/monitor-exec.ts` (NEW)

Extract the core monitor execution logic (~140 lines) from MonitorTool.execute() into:
```typescript
export async function executeMonitor(
  session: ToolSession,
  params: MonitorParams,
  context?: AgentToolContext,
): Promise<AgentToolResult<MonitorToolDetails>> { ... }
```

This keeps the logic testable and reusable without MonitorTool class.

### Acceptance Criteria (W2)
- `background({ op: "start_monitor", command: "...", monitorKind: "poll", monitorDescription: "..." })` works
- `monitor` tool name → ToolError or not found (removed)
- `job` tool name → ToolError or not found (removed)
- `background` always appears in agent tool list (essential)
- Permission prompt fires for `background({ op: "start_monitor" })`
- `bun run ci:check:full` passes
- `bun run ci:test:smoke` passes
- Existing background list/detail/follow/cancel unchanged

---

## Execution Order

```
W1 (silent + deduplicate) → verify
         ↓
W2 (tool consolidation) → verify
```

W1 first — immediate value, low risk. W2 depends on W1 (uses the silent/dedup logic).

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Permission system hardcodes "monitor" | Update isShellExecutionPermissionTool to check background+start_monitor |
| Claude Code fixture | Update or remove monitor.schema.json |
| Prompt token increase | background.md grows ~30 lines. Offset by removing monitor.md + job.md |
| Existing sessions using monitor/job | Tool-not-found at next call. Acceptable — discoverable tools are session-ephemeral |
