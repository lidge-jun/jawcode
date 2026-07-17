# 010_gjc_C02_security_prompt_control_token

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C02 — control-token neutralization, untrusted content framing, reasoning egress gating, hostile boundary fixes
> Sol priority: P1
> Model-related: yes
> Card target: 10.089_security_prompt_control_token
> Worker: GW2

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `3d8cf3647` | fix(task): quarantine bundled agent prompt fragments | `packages/coding-agent/src/prompts/agent-fragments/ralplan-persistence.md`<br>`packages/coding-agent/src/prompts/agent-fragments/restricted-bash.md` |
| 2 | `ffc33da2f` | fix(prompts): isolate untrusted runtime context | `packages/coding-agent/src/runtime-mcp/manager.ts`<br>`packages/coding-agent/src/sdk/session.ts` |
| 3 | `36d99ce07` | fix(prompts): harden web search content framing (#2343) | `packages/coding-agent/src/web/search/index.ts`<br>`packages/coding-agent/test/qa-prompts-redteam.test.ts` |
| 4 | `f912eddcf` | fix(security): close Codex reasoning and summary queue races | `packages/ai/src/providers/anthropic-messages-server.ts`<br>`packages/ai/src/providers/openai-chat-server.ts` |
| 5 | `9abb3e02e` | fix(security): suppress raw reasoning egress and gate directed frames | `packages/ai/src/providers/openai-responses-server.ts`<br>`packages/ai/test/auth-gateway-openai-responses.test.ts` |
| 6 | `9036b594e` | fix(ai): fail closed for unmarked Responses reasoning | `packages/ai/src/providers/anthropic-messages-server.ts`<br>`packages/ai/src/providers/openai-chat-server.ts` |
| 7 | `2bbcd6a46` | fix(telegram): harden directed replay and reasoning provenance | `packages/ai/src/providers/openai-responses-server.ts`<br>`packages/coding-agent/src/sdk/bus/config-commands.ts` |
| 8 | `d2ee76f83` | feat(telegram): implement /verbose /lean tool-activity + reasoning-summary contract (#2304) | `packages/agent/src/agent-loop.ts`<br>`packages/agent/src/proxy.ts` |
| 9 | `986c9be15` | fix(prompts): close hostile boundary variants (#2343 #2351 #2352) | `packages/coding-agent/src/sdk/session.ts`<br>`packages/coding-agent/src/session/agent-session.ts` |
| 10 | `6070baedd` | fix prompts and URL read cleanup gates (#2343 #2344 #2350 #2351 #2353) | `packages/coding-agent/src/sdk/protocol/operation-inventory.generated.json`<br>`packages/coding-agent/src/sdk/session.ts` |
| 11 | `d97b56e99` | fix: neutralize file mention closing tags (#2352) | `packages/coding-agent/src/session/messages.ts`<br>`packages/coding-agent/test/session-messages.test.ts` |
| 12 | `6efa541e2` | fix: frame fetched content as untrusted (#2343) | `packages/coding-agent/src/tools/fetch.ts`<br>`packages/coding-agent/src/web/search/index.ts` |
| 13 | `cf94f8804` | fix(ai,agent): explicit invalid_prompt classification + bounded circuit breaker (#2282) (#2314) | `packages/agent/src/agent-loop.ts`<br>`packages/agent/test/agent-loop-invalid-prompt-breaker.test.ts` |
| 14 | `26bb02e72` | fix(coding-agent): close hostile review gaps in profile recovery (#2293) | `packages/coding-agent/src/main.ts`<br>`packages/coding-agent/test/cli-args-mpreset.test.ts` |
| 15 | `749449a6a` | fix(ai): scope header-form control-token match to header grammar (gpt-5.6 invalid_prompt) (#2279) | `packages/ai/src/utils.ts`<br>`packages/ai/test/control-token-header-form.test.ts` |
| 16 | `032f5cb6b` | fix(agent): neutralize control tokens on remote compaction paths (gpt-5.6 Request blocked) (#2197) | `packages/agent/src/compaction/openai.ts`<br>`packages/agent/test/remote-compaction.test.ts` |
| 17 | `5ca557eaa` | fix(ai): neutralize leaked control tokens at the Responses request boundary (gpt-5.6 Request blocked) (#2192) | `packages/ai/src/providers/openai-codex-responses.ts`<br>`packages/ai/src/providers/openai-responses.ts` |
| 18 | `9663f7744` | fix(ai): neutralize leaked reserved control tokens in Codex replay history (#2144) | `packages/ai/src/utils.ts`<br>`packages/ai/test/openai-responses-history-payload.test.ts` |
| 19 | `67a8fd4be` | fix(agent): neutralize control tokens on remote compaction paths (gpt-5.6 Request blocked) (#2197) | `packages/agent/src/compaction/openai.ts`<br>`packages/agent/test/remote-compaction.test.ts` |
| 20 | `632b8a434` | fix(ai): neutralize leaked control tokens at the Responses request boundary (gpt-5.6 Request blocked) (#2192) | `packages/ai/src/providers/openai-codex-responses.ts`<br>`packages/ai/src/providers/openai-responses.ts` |
| 21 | `7721aa935` | fix(ai): neutralize leaked reserved control tokens in Codex replay history (#2144) | `packages/ai/src/utils.ts`<br>`packages/ai/test/openai-responses-history-payload.test.ts` |

## 주제 분석

이 묶음은 외부 콘텐츠와 모델 내부 제어 문법이 같은 문자열 채널을 공유할 때 생기는 경계 혼동을 막는다. fetched content와 runtime context를 명시적으로 untrusted로 감싸고, 파일 mention의 닫는 태그와 Codex reserved control token을 요청 경계·replay history·remote compaction에서 중화한다. GPT-5.6의 `Request blocked` 및 `invalid_prompt`를 단순 재시도로 증폭하지 않도록 분류와 bounded circuit breaker도 추가한다.

reasoning 경로는 별도 위험면이다. 표시 가능한 summary와 raw reasoning을 구분하고, directed frame과 Telegram replay에서도 provenance와 egress gate를 유지한다. JWC에 적용할 때는 provider request 직전, compaction 산출물, 프롬프트 조립, notification 전송을 하나의 end-to-end 경계로 검증해야 한다.

## Worktree 대조

현재 JWC의 정확한 키워드 검색에서는 `packages/ai/src/providers/openai-responses-shared.ts`의 raw reasoning delta 처리만 확인된다. `control-token`, `invalid_prompt`, `Request blocked`, untrusted framing, reasoning egress gate에 해당하는 명시적 방어는 찾지 못했다. `packages/ai` Responses transport와 `packages/agent/src/compaction/`, `packages/coding-agent` prompt assembly를 upstream diff 기준으로 함께 점검해야 한다.

