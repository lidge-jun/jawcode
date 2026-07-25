# 010_gjc_C04_prompt_refactor_compact_ralplan

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C04 — core prompt compaction, shared role-agent ralplan guidance, dead discovery plumbing removal
> Sol priority: P2
> Model-related: no
> Card target: 10.090_prompt_refactor_compact_ralplan
> Worker: GW2

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `3d8cf3647` | fix(task): quarantine bundled agent prompt fragments | `packages/coding-agent/src/prompts/agent-fragments/ralplan-persistence.md`<br>`packages/coding-agent/src/prompts/agent-fragments/restricted-bash.md` |
| 2 | `ffc33da2f` | fix(prompts): isolate untrusted runtime context | `packages/coding-agent/src/runtime-mcp/manager.ts`<br>`packages/coding-agent/src/sdk/session.ts` |
| 3 | `36d99ce07` | fix(prompts): harden web search content framing (#2343) | `packages/coding-agent/src/web/search/index.ts`<br>`packages/coding-agent/test/qa-prompts-redteam.test.ts` |
| 4 | `e0ab4078d` | style(prompts): format discovery fixture | `packages/coding-agent/test/tools/search-tool-bm25.test.ts` |
| 5 | `0f2d2652e` | test(coding-agent): narrow prompt content fixtures | `packages/coding-agent/test/qa-prompts-redteam.test.ts`<br>`packages/coding-agent/test/session-messages.test.ts` |
| 6 | `260c1a5cc` | chore(prompts): regenerate docs index | `packages/coding-agent/src/internal-urls/docs-index.generated.ts` |
| 7 | `588b25e46` | style(prompts): format architecture changes | `packages/coding-agent/src/session/agent-session.ts`<br>`packages/coding-agent/src/session/messages.ts` |
| 8 | `986c9be15` | fix(prompts): close hostile boundary variants (#2343 #2351 #2352) | `packages/coding-agent/src/sdk/session.ts`<br>`packages/coding-agent/src/session/agent-session.ts` |
| 9 | `6070baedd` | fix prompts and URL read cleanup gates (#2343 #2344 #2350 #2351 #2353) | `packages/coding-agent/src/sdk/protocol/operation-inventory.generated.json`<br>`packages/coding-agent/src/sdk/session.ts` |
| 10 | `461839bb1` | fix(coding-agent): restore unified discovery contracts (#2344 #2350 #2353) | `packages/coding-agent/src/sdk/session.ts`<br>`packages/coding-agent/src/session/agent-session.ts` |
| 11 | `3c220428e` | test(prompts): cover shared prompt composition (#2351) | `packages/coding-agent/src/system-prompt.ts`<br>`packages/coding-agent/test/default-gjc-definitions.test.ts` |
| 12 | `281950221` | refactor(prompts): remove dead discovery prompt plumbing (#2351) | `packages/coding-agent/src/prompts/system/custom-system-prompt.md`<br>`packages/coding-agent/src/system-prompt.ts` |
| 13 | `5ef3f9aaf` | refactor(prompts): share role-agent ralplan guidance (#2350) | `packages/coding-agent/src/prompts/agents/architect.md`<br>`packages/coding-agent/src/prompts/agents/critic.md` |
| 14 | `ddaa78a6f` | refactor(prompts): compact core prompt guidance (#2345 #2346 #2347 #2348) | `packages/coding-agent/src/prompts/system/system-prompt.md`<br>`packages/coding-agent/src/prompts/tools/bash.md` |
| 15 | `64c3abd4a` | refactor: remove MCP discovery shims (#2353) | `packages/coding-agent/src/runtime-mcp/discoverable-tool-metadata.ts`<br>`packages/coding-agent/src/sdk/session.ts` |
| 16 | `50dc0e9c9` | fix: make tool discovery description static (#2344) | `packages/coding-agent/src/prompts/tools/search-tool-bm25.md`<br>`packages/coding-agent/src/tools/search-tool-bm25.ts` |

## 주제 분석

이 묶음은 system prompt의 책임을 줄이고 중복 지침을 공유 문서로 모은다. core guidance를 compact하게 만들고, role agent가 사용하는 ralplan 지침을 공통화하며, 더 이상 쓰지 않는 discovery prompt plumbing과 MCP discovery shim을 제거한다. fixture와 prompt composition 테스트는 축약 과정에서 보안 framing이나 역할 계약이 빠지지 않도록 고정한다.

JWC는 GJC의 `ralplan`을 공개 워크플로로 그대로 노출하지 않으므로 문자열 치환식 포팅은 맞지 않는다. upstream의 구조적 개선만 추출하고, JWC의 `plan`/`jwc orchestrate p` 명칭과 현재 static prompt 파일 계약을 보존해야 한다.

## Worktree 대조

JWC에는 `packages/coding-agent/src/commands/ralplan.ts`가 deprecated compatibility shim으로 남아 있고, 실제 planning 표면은 `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`와 JWC workflow로 이동해 있다. system prompt 조립은 `packages/coding-agent/src/system-prompt.ts`, discovery는 `packages/coding-agent/src/discovery/`에 분리돼 있다. shared ralplan guidance나 upstream compact-core 식별자는 보이지 않으므로, 이름이 아니라 prompt block과 discovery wiring의 실제 diff를 대조해야 한다.

