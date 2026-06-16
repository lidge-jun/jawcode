# 02 — cli-jaw 통합 시임 분석

> cli-jaw 루트: `/Users/jun/Developer/new/700_projects/cli-jaw/` (Node ≥22.4, better-sqlite3)

## 현재 런타임 구조: 전부 spawn 기반

| 런타임 | 방식 | 파일 | 취약점 |
|--------|------|------|--------|
| Claude/Codex/Gemini 등 | 벤더 CLI 자식 프로세스 | `src/agent/spawn.ts` (2,388줄) | 세션 ID 역추적 resume |
| Pi | `pi --mode rpc` JSONL 파이프 | `src/agent/pi-runtime.ts` | 프로세스 수명 관리 |
| Kiro | CLI 출력 ANSI 정규식 파싱 | `src/agent/kiro-runtime.ts` | 가장 취약 |
| Claude-E | Rust 헬퍼(`native/jaw-claude-i`)가 Claude Code 제어 | `src/agent/claude-e-runtime.ts` | 자체 빌드 필요 |

resume 계층: `src/agent/resume-classifier.ts`, `src/agent/session-persistence.ts`,
`src/agent/spawn/resume.ts` — jawcode 네이티브 세션이 대체할 대상.

## 디스패치 계약 — 어댑터 진입점

`src/agent/spawn.ts:677` `spawnAgent(prompt, opts): SpawnResult`
- 반환 `{ child: ChildProcess | null, promise: Promise<{text, code, ...}> }`
- **`child: null` 경로가 이미 존재** (settings gate 대기 경로) → in-process 런타임이
  자식 프로세스 없이 이 계약을 만족시킬 수 있음이 코드로 증명됨
- 큐/게이트: `isAgentBusy()`, `queueCtrl`, fallback 체인 — cli 값만 추가하면 그대로 탐
- 이벤트: `src/core/bus.ts` `broadcast(event, payload, scope)` — AgentEvent 매핑 대상

## 스킬 — 이미 런타임 중립

- 위치: `~/.cli-jaw/skills/` (29개) + `skills_ref/` + 리포 번들
- 주입: `src/prompt/builder.ts` — SKILL.md frontmatter(name/description/keywords/triggers)를
  파싱해 시스템 프롬프트에 스킬 목록으로 삽입. **외부 CLI 의존성 없음.**
- gjc 쪽 대응: `discoverSkills()` + `buildSystemPrompt()` — 같은 SKILL.md 포맷 계열
- 브리지 전략 후보:
  1. cli-jaw 프롬프트 빌더 산출물을 `createAgentSession()`의 시스템 프롬프트로 주입 (최소 작업)
  2. gjc `discoverSkills()`에 `~/.cli-jaw/skills`를 추가 디스커버리 루트로 등록 (네이티브)

## PABCD — 프롬프트 주입 기반이라 이식 비용 낮음

- `src/orchestrator/state-machine.ts` — P/A/B/C/D 단계별 프롬프트 텍스트 생성 (L370–516)
- `src/cli/commands.ts:265` — `orchestrate` (alias `pabcd`) 커맨드
- 현재: 단계 프롬프트를 spawn된 CLI의 입력에 끼워넣음
- jawcode에서: 동일 텍스트를 세션 메시지로 주입하면 즉시 동작.
  장기적으로는 단계 전환·도구 게이팅을 루프 코드 레벨에서 강제 가능
  (예: P/A 단계에서 write/edit 도구 비활성 — gjc role agent의 read-only 게이팅과 동일 패턴)

## 세션 — jaw.db로 단일화하면 spawn/resume 소멸

- 현재: jaw.db(better-sqlite3)가 cli-jaw 세션 메타를, 실제 대화 상태는 각 벤더 CLI가 소유
  → resume = 외부 세션 ID 추적 (깨지기 쉬움)
- jawcode: 메시지 배열이 in-process 소유물 → resume = DB에서 메시지 로드 후 루프 재개,
  steer = 돌고 있는 루프에 메시지 push (`steerAgent`의 kill-respawn 불필요)
- 결정 필요: jaw.db에 통합 vs gjc agent db(`packages/coding-agent/src/session/`) 활용
