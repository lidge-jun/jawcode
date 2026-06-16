# 020_prompt — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.
> gjc 대조 클론 @ `269387ba`.

## 런타임·표면

- **`system-prompt.md`**: Jaw/jwc identity, `<jwc-runtime>` 내 **99.03 M1** — `jaw-interview`·`plan`·`goal`·`team` + `<native-workflow orchestrate>`; `pabcd-state.json` 경로, `readPabcdState`, `jwc orchestrate` 자가 전이·routing.
- **매 턴 주입 (99.03 M2)**: `AgentSession.#buildPabcdStageMessage`가 `readPabcdStateWithFallback(cwd, sessionId)` 후 `customType: pabcd-stage-context` 주입; 본문은 `buildPabcdStageContent` (`[PABCD — STAGE: LABEL]` + gate chips + goal objective 요약).
- **스테이지 pull (99.03 M3)**: `prompts/jaw/orchestrate-*.md` 말미 `jwc orchestrate <next>` shell 지시 (예: P→A `orchestrate-p.md:21`).
- **조립**: `createAgentSession` → `rebuildSystemPrompt` → `system-prompt.ts` 템플릿 렌더; identity 보조 `jwc-runtime/agent-identity.ts`.
- **도구/role 프롬프트**: `.jwc/`·jwc 어휘 HARD-EDIT; role agent bash 예시는 `jwc` prefix.

## 세션 스코프 읽기 (orchestrate)

- `readPabcdStateWithFallback`: `sessionId`가 있으면 **scoped** `pabcd-state.json`만 읽음 — legacy unscoped 파일이 신규 TUI 첫 턴에 I-stage 헤더를 끼워 넣는 누수를 막는다 (`orchestrate-state.ts:332-349`).

## 코드 앵커

| 항목 | path:line |
|------|-----------|
| M1 template | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/system/system-prompt.md:40`, `:50`, `:76` |
| M2 injection | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-session.ts:4701`, `:4711` |
| M2 header | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/pabcd-stage-header.ts:50` |
| state read | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/orchestrate-state.ts:340` |
| prompt build | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/system-prompt.ts:573` |

## 검증

`agent-identity-leak.test.ts`, `system-prompt-identity.test.ts`, `pabcd-stage-header.test.ts`

## 정본

- structure: [structure/20_prompt_flow.md](../../../structure/20_prompt_flow.md) §매 턴 주입 레일 #10 · §99.03 M1–M3
- fork: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)