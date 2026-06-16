# 01 — gajae-code 실사 (포크 직후)

> 2026-06-12, gajae-code 0.4.4 `498d86b` 기준.
> 사전 분석: `/Users/jun/Developer/new/002_proxy/003_gjc/` (ai 패키지 ~208개 문서),
> `/Users/jun/Developer/new/002_proxy/devlog/gjc_src/` (ai 패키지 소스 스냅샷 2026-06-11).

## 결론: "에이전트 런타임의 전부"가 이미 있다

당초 가정(gjc = 프로바이더 계층만)은 틀렸다. 풀 모노레포에는 Claude Code급
코딩 에이전트 전체가 구현돼 있다:

| 필요 요소 | gjc 보유 여부 | 위치 (절대 경로 기준 루트: `/Users/jun/Developer/new/700_projects/jawcode/`) |
|-----------|--------------|------|
| 프로바이더/인증/스트리밍 | ✅ 44+ 프로바이더 | `packages/ai/` (stream.ts 902줄 디스패처, OAuth 40+) |
| 에이전트 루프 | ✅ | `packages/agent/src/agent-loop.ts` + 컴팩션/컨텍스트 관리 |
| 도구 (read/bash/edit/write/grep/browser/ast-edit…) | ✅ | `packages/coding-agent/src/tools/` |
| TUI | ✅ 차등 렌더링 자체 라이브러리 | `packages/tui/` + `coding-agent/src/modes/interactive-mode.ts` |
| 세션 영속화 | ✅ agent db | `packages/coding-agent/src/session/` |
| 스킬 시스템 | ✅ SKILL.md 디스커버리 | `packages/coding-agent/src/extensibility/skills.ts` |
| 슬래시커맨드 | ✅ 레지스트리 + 파일 기반 | `packages/coding-agent/src/slash-commands/`, `extensibility/slash-commands.ts` |
| 워크플로 오케스트레이션 | ✅ 4종 고정 (deep-interview/ralplan/ultragoal/team) | `packages/coding-agent/src/defaults/gjc/skills/` |
| 프로그래매틱 SDK | ✅ ★ | `packages/coding-agent/src/sdk.ts` `createAgentSession()` |
| RPC 모드 (사이드카 통로) | ✅ JSONL | `packages/coding-agent/src/modes/rpc/` |
| ACP | ✅ | `packages/coding-agent/src/modes/acp/` |
| MCP | ✅ | `coordinator-mcp/`, `runtime-mcp/` |
| 서브에이전트/롤 | ✅ 4종 (executor/architect/planner/critic) | `packages/coding-agent/src/prompts/agents/` |

## sdk.ts 핵심 표면 (임베딩 시임)

```
createAgentSession(options): Promise<CreateAgentSessionResult>   // L796
buildSystemPrompt(options)                                        // L508
discoverSkills(...)                                                // L444
discoverSlashCommands(...)                                         // L478
discoverPromptTemplates(cwd, agentDir)                              // L468
discoverAuthStorage(agentDir)                                       // L409
discoverExtensions(cwd)                                             // L437
```

타입: `Settings`, `SkillsSettings`, `Skill`, `FileSlashCommand`, `CustomTool`, `Tool` 등 export.

## 런타임 제약: Bun

- 루트 `package.json`: `"packageManager": "bun@1.3.14"`, Bun workspaces + catalog
- `Bun.*` 직접 사용처 (grep 결과):
  - `packages/ai/`: ~20지점 — `Bun.env`, `Bun.hash`, `Bun.JSONL.parseChunk`(base-stream.ts),
    `Bun.JSON5`(cursor.ts), `Bun.file`, `Bun.spawn`(aws-credentials.ts), `Bun.WebSocket`(codex)
  - `packages/agent/`: 4파일 — agent.ts, agent-loop.ts, harmony-leak.ts, compaction/openai.ts
  - `packages/tui/`: 7파일 (TUI 바이너리 전용 — 서버 임베딩에는 불필요)
- 네이티브 모듈: `crates/` Rust → napi-rs (`@gajae-code/natives`) — Node에서도 로드 가능 형식

## 업스트림 계약 (AGENTS.md — 수정 금지)

- 기본 워크플로 스킬은 정확히 4종, 롤 에이전트 정확히 4종 — 임의 추가 금지
- 런타임 상태는 `.gjc/` 아래 고정
- 공개 커맨드/경로/예시는 `gjc`, `.gjc` 사용
- → jawcode가 cli-jaw 스킬을 들여올 때는 **기본 셋 확장이 아니라**
  `.gjc` 사용자/프로젝트 디스커버리 경로 또는 SDK 주입으로 들어가야 계약과 충돌하지 않음
