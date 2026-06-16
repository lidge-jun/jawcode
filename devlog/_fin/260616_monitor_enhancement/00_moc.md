# Monitor Enhancement + Background Tool Naming — MOC

Created: 2026-06-16
Status: Investigation complete, pending decision

## 문제 1: Monitor Notification Spam

### 증상
Persistent monitor가 매 stdout line마다 `triggerTurn: true`로 에이전트 턴을 강제 시작.
Poll 패턴에서 "변화 없음" 반복 시 매 30초마다 에이전트가 "대기 중" 같은 무의미한 응답 생성.

### 토큰 비용
CI poll 예시: 12분 빌드 × 30초 간격 = 24 notification → 24 에이전트 턴
- 에이전트 최소 응답 ~50 토큰 × 24 = ~1,200 토큰 낭비
- 유의미한 notification: 1개 (success/failure)
- 낭비율: 96%

### 근본 원인
`monitor.ts:188-190` — `triggerTurn: true` 하드코딩. 에이전트/사용자 제어 불가.

### 기존 완화 메커니즘 (부족)
1. microtask coalescing: 같은 tick 내 여러 줄 합침. 30초 간격엔 무의미
2. MAX_PENDING=3 큐캡: idle 에이전트는 즉시 소비 → 캡 미도달
3. non-persistent auto-cancel: persistent에선 적용 안 됨

---

## 문제 2: Background Tool 네이밍 혼란

### 현재 도구 맵

| Tool | 역할 | 에이전트 인지 |
|---|---|---|
| `bash` | 쉘 실행 + async mode | ✅ 명확 |
| `monitor` | stdout 스트리밍 시작 | ❓ 조회인지 시작인지 불분명 |
| `background` | background row 관리 | ❓ 무엇의 background? |
| `job` | legacy async poll/cancel | ❓ background와 차이 불분명 |
| `task` | subagent 생성 | ✅ 명확 |

### 에이전트 혼란 패턴
- monitor vs bash async 선택 혼동
- background vs job 혼용 (prompt에서 "legacy" 경고 반복)
- `monitor`가 관찰 도구인지 시작 도구인지 이름으로 구분 불가

---

## 제안 패치

### P1: Silent Mode + Deduplicate (핵심 — notification spam 해결)

**파일**: `packages/coding-agent/src/tools/monitor.ts`, `packages/coding-agent/src/prompts/tools/monitor.md`

Schema 추가:
```typescript
silent: z.boolean().optional().describe(
  "When true, notifications queue silently without triggering a new agent turn. "
  + "Agent sees them on next natural turn. Default: false."
),
deduplicate: z.boolean().optional().describe(
  "When true, skip notification if stdout line identical to previous. "
  + "Useful for poll monitors. Default: false."
),
```

구현:
```typescript
// sendNotification — triggerTurn 제어:
const triggerTurn = !(params.silent ?? false);
this.session.sendCustomMessage?.(msg, { triggerTurn, deliverAs: "followUp" });

// onRawLine — deduplicate:
if ((params.deduplicate ?? false) && line === lastSeenLine) return;
lastSeenLine = line;
```

효과: CI poll 24 notifications → 1 (deduplicate) 또는 0 forced turns (silent).
난이도: LOW (~20줄 변경)

### P2: Time-based Coalescing Window

Schema 추가:
```typescript
coalesceMs: z.number().int().min(100).max(60000).optional().describe(
  "Coalescing window in ms. Lines within window merged to single notification. Default: 0 (microtask)."
),
```

구현: `queueMicrotask(flushLatest)` → `setTimeout(flushLatest, coalesceMs ?? 0)`
난이도: LOW (~10줄)

### P3: Tool Rename — `monitor` → `background_monitor`

**네이밍 옵션 평가**:

| Option | 변경 | 하위 호환 | 구현 비용 |
|---|---|---|---|
| A: 접두사 | `monitor` → `background_monitor` (alias 유지) | ✅ | LOW |
| B: 동사 | `monitor` → `start_monitor` | △ | MEDIUM |
| C: 역할 | `monitor` → `stream_watcher` | ❌ | HIGH |

**권장: Option A** — `name = "background_monitor"`, 기존 `"monitor"` alias 유지.

이유:
- `background_` 접두사로 background/background_monitor 그룹화
- 에이전트가 "background 관련 도구" 계열 인식
- 기존 세션/prompt 호환

**파일**:
- `monitor.ts`: `name = "background_monitor"`
- Tool registry: alias `"monitor"` → `"background_monitor"`
- `monitor.md` → prompt 업데이트

### P4: `job` Deprecation 가속

현재 `job`은 prompt에서 "legacy" 경고만 있고 여전히 활성.
- `loadMode` → `"hidden"` (기본 비노출, 검색으로만 활성화)
- `background` op에 `"await"` 추가 (job의 `poll` 대체)
- 6개월 후 제거

---

## 우선순위

| 순위 | 패치 | 이유 |
|---|---|---|
| 1 | P1 (silent + deduplicate) | 즉시 체감. 토큰 낭비 96% 해소 |
| 2 | P3 (rename) | 에이전트 인지 개선. alias로 하위 호환 |
| 3 | P2 (coalescing window) | 고빈도 로그 시나리오 대응 |
| 4 | P4 (job deprecation) | 장기 정리. 급하지 않음 |

## Phase Plan

| Phase | File |
|---|---|
| 10 | `10_p1_silent_deduplicate.md` — P1 구현 상세 |
| 20 | `20_p3_rename.md` — P3 rename 상세 |
| 30 | `30_p2_p4_deferred.md` — P2/P4 deferred 상세 |
