# Competitive Analysis: Background/Monitor Tool Design

Date: 2026-06-16

## 3사 비교 요약

### monitor/background 관련 도구 존재 여부

| 제품 | monitor 도구 | background 관리 | 비동기 전략 |
|---|---|---|---|
| codex-rs | ❌ 없음 | ❌ 없음 | sub-agent (`spawn_agent` + `wait_agent`) + hooks |
| opencode | ❌ 없음 | `BackgroundJob.Service` (내부) | `task` 도구 (background execution 내장) |
| claude code | ❌ 없음 | ❌ 없음 | `TaskCreate/Get/List/Stop/Update/Output` 6개 분리 + `CronCreate/Delete/List` |
| **jwc** | ✅ `monitor` | ✅ `background` + `job` | `task` + `subagent` + `monitor` + `background` + `job` |

**결론: monitor는 jwc 고유 기능. 경쟁 제품에 참고할 대상 없음.**

### 네이밍 패턴

| 제품 | 패턴 | 예시 |
|---|---|---|
| codex-rs | `동사_대상` | `spawn_agent`, `wait_agent`, `shell_command` |
| opencode | `단일 명사` | `shell`, `read`, `write`, `task` |
| claude code | `PascalCase 대상` (내부), API는 `snake_case` | `TaskCreate`, `BashTool`, `FileEditTool` |
| jwc | **혼합** | `bash`, `monitor`, `background`, `task`, `subagent` |

jwc의 네이밍이 가장 비일관적:
- `bash` (명사) vs `monitor` (동사/명사 모호) vs `background` (형용사)
- `task` (명사, 생성) vs `subagent` (명사, 관리) — 왜 분리?

### Sub-agent 도구 설계 비교

| 제품 | 생성 | 조회 | 중지 | 통신 |
|---|---|---|---|---|
| codex-rs | `spawn_agent` | `wait_agent` / `list_agents` | `close_agent` | `send_message` |
| opencode | `task` (하나로 통합) | `task` 내 background | — | — |
| claude code | `TaskCreate` | `TaskGet` / `TaskList` | `TaskStop` | `SendMessage` + `TaskUpdate` / `TaskOutput` |
| jwc | `task` | `subagent list/inspect/await` | `subagent cancel` | `irc` |

## 시사점

1. **monitor는 jwc의 차별화 기능** — 다른 제품이 안 하는 걸 하고 있으므로 참고 대상 없이 자체 설계
2. **background/job 통합은 맞는 방향** — opencode도 내부적으로 BackgroundJob 하나, claude code도 Task 계열로 통합
3. **네이밍은 codex-rs의 `동사_대상` 패턴이 가장 명확** — 하지만 jwc는 이미 많은 도구가 단일 명사 (`bash`, `read`, `write`)라서 전면 리네임은 비용 대비 효과 낮음
4. **`background_monitor`는 합리적 타협** — 기존 단일 명사 패턴(`bash`)과 공존하면서, background 계열을 접두사로 그룹화
