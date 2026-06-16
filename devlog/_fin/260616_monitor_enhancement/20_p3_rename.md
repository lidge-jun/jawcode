# P3: Tool Rename — monitor → background_monitor

## 현재 상태

에이전트 도구 5개 중 background 관련 3개의 관계가 불투명:

```
bash (async mode) ──→ creates background job
monitor           ──→ creates background monitor job
background        ──→ manages background rows (list/detail/follow/cancel)
job               ──→ legacy manage background jobs (poll/cancel)
```

`monitor`라는 이름만으로는:
- 뭘 모니터하는 건지 (시스템? 파일? 프로세스?)
- 시작하는 도구인지 조회하는 도구인지
- background 계열인지 독립 도구인지

알 수 없다.

## 변경안

### Tool Name
```diff
- readonly name = "monitor";
- readonly label = "Monitor";
- readonly summary = "Start a background monitor that streams stdout lines as task notifications";
+ readonly name = "background_monitor";
+ readonly label = "Background Monitor";
+ readonly summary = "Start a background monitor that streams stdout lines as task notifications";
```

### Alias 등록

Tool resolver에서 `"monitor"` → `"background_monitor"` alias:
```typescript
// tool registry or tool resolver
if (toolName === "monitor") toolName = "background_monitor";
```

기존 세션에서 `monitor` 호출 → 정상 동작.

### Prompt File
```
monitor.md → background-monitor.md (파일명)
import monitorDescription from "../prompts/tools/background-monitor.md"
```

첫 줄 업데이트:
```diff
- Start a background monitor that streams events from a long-running script.
+ Start a background monitor (`background_monitor`) that streams events
+ from a long-running script. Formerly named `monitor`.
```

### System Prompt Inventory 업데이트
```diff
- monitor: Monitor
+ background_monitor: Background Monitor (alias: monitor)
```

## 에이전트 인지 개선 효과

Before:
```
사용 가능한 도구: bash, monitor, background, job, task, ...
→ "monitor로 뭘 할 수 있지? background랑 뭐가 다르지?"
```

After:
```
사용 가능한 도구: bash, background_monitor, background, task, ...
→ "background_ 접두사 = background 관련. monitor = 시작, background = 관리"
```

## 장기 로드맵

```
Phase 1 (이번): monitor → background_monitor alias
Phase 2 (다음): job → hidden, background에 op:"await" 추가
Phase 3 (6개월 후): job 제거, background가 유일한 관리 도구
```

최종 도구 맵:
```
bash                 — 쉘 실행 (sync + async background)
background_monitor   — background stdout 스트리밍 시작
background           — background row 관리 (list/detail/follow/cancel/await)
task                 — subagent 생성
```

4개로 깔끔. `job` 사라짐.

## 파일 목록

| File | Change |
|---|---|
| `packages/coding-agent/src/tools/monitor.ts` | name/label 변경 |
| `packages/coding-agent/src/prompts/tools/monitor.md` | 파일명 변경 + 내용 |
| Tool registry / resolver | alias 등록 |
| System prompt tool inventory | 이름 업데이트 |
| `packages/coding-agent/src/prompts/agents/executor.md` | monitor 참조 |

## Acceptance Criteria

1. `background_monitor` 이름으로 호출 → 정상 동작
2. `monitor` 이름으로 호출 → alias로 정상 동작 (하위 호환)
3. System prompt에 `background_monitor` 노출
4. 기존 테스트 전부 통과
