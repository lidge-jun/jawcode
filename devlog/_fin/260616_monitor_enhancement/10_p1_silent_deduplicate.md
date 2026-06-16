# P1: Silent Mode + Deduplicate — 구현 상세

## Target Files

| File | Change |
|---|---|
| `packages/coding-agent/src/tools/monitor.ts` | schema + 구현 |
| `packages/coding-agent/src/prompts/tools/monitor.md` | 문서화 |

## Schema Diff

```diff
 const monitorSchema = z.object({
   command: z.string().describe("..."),
   kind: monitorKindEnum.describe("..."),
   description: z.string().describe("..."),
   timeout: z.number().min(1).optional().describe("..."),
   persistent: z.boolean().optional().describe("..."),
+  silent: z.boolean().optional().describe(
+    "When true, notifications are queued but do not trigger a new agent turn. "
+    + "The agent sees them on its next natural turn. Useful for poll monitors "
+    + "where most events are 'no change'. Default: false."
+  ),
+  deduplicate: z.boolean().optional().describe(
+    "When true, skip notification if the stdout line is identical to the "
+    + "previous one. Prevents repeated 'no change' notifications in poll "
+    + "patterns. Default: false."
+  ),
 });
```

## Implementation Diff

### 1. State variable 추가 (line ~127)

```diff
   let coalescedCount = 0;
   let flushScheduled = false;
+  let lastSeenLine: string | undefined;
```

### 2. sendNotification — triggerTurn 제어 (line 188-190)

```diff
-  const sendPromise = this.session.sendCustomMessage?.(
-    { customType: "task-notification", content, display: false, attribution: "agent", details },
-    { triggerTurn: true, deliverAs: "followUp" },
-  );
+  const triggerTurn = !(params.silent ?? false);
+  const sendPromise = this.session.sendCustomMessage?.(
+    { customType: "task-notification", content, display: false, attribution: "agent", details },
+    { triggerTurn, deliverAs: "followUp" },
+  );
```

### 3. onRawLine — deduplicate (line 228)

```diff
   if (persistent) {
+    if ((params.deduplicate ?? false) && line === lastSeenLine) return;
+    lastSeenLine = line;
     schedulePersistentNotification(line);
     return;
   }
```

### 4. steer fallback도 동일 적용 (line 199)

```diff
   } else {
-    this.session.steer?.({ customType: "task-notification", content, details });
+    if (!(params.silent ?? false)) {
+      this.session.steer?.({ customType: "task-notification", content, details });
+    }
   }
```

## Prompt Diff

`monitor.md` Inputs 섹션에 추가:

```diff
 - `persistent` (optional, default `false`): keep the monitor running past
   the current turn.
+- `silent` (optional, default `false`): when true, notifications queue
+  silently without triggering a new agent turn. The agent sees them on
+  its next natural turn. Use for poll monitors where most events are
+  "no change" — avoids empty response spam.
+- `deduplicate` (optional, default `false`): skip notification when the
+  stdout line is identical to the previous one. Combines well with `silent`
+  for poll patterns: only changed output queues, and it doesn't force a turn.
```

## 에이전트 사용 패턴

### Before (현재 — spam)
```
monitor({
  command: "while true; do gh run list ...; sleep 30; done",
  kind: "poll",
  description: "CI status",
  persistent: true
})
// → 매 30초마다 에이전트 턴 강제 시작 → "대기 중" 반복
```

### After — silent + deduplicate
```
monitor({
  command: "while true; do gh run list ...; sleep 30; done",
  kind: "poll",
  description: "CI status",
  persistent: true,
  silent: true,        // 턴 강제하지 않음
  deduplicate: true    // 같은 출력이면 무시
})
// → 상태 변할 때만 조용히 큐잉 → 에이전트 다음 자연 턴에서 확인
```

### After — completion-only (현재 workaround와 동일)
```
monitor({
  command: "while true; do ...; if [ done ]; then echo DONE; break; fi; sleep 30; done",
  kind: "poll",
  description: "CI completion",
  persistent: true
  // silent/deduplicate 없어도 stdout이 한 번만 → notification 1회
})
```

## Acceptance Criteria

1. `silent: true` monitor → stdout line 도착해도 에이전트 턴 시작 안 됨
2. `deduplicate: true` monitor → 동일 line 반복 시 notification 0개
3. `silent: false` (default) → 기존 동작 유지 (하위 호환)
4. `deduplicate: false` (default) → 기존 동작 유지
5. non-persistent monitor → silent/deduplicate 무관하게 기존 동작 (첫 줄만 deliver + cancel)
