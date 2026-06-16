# 40 — cli-jaw "codex-only computer use" 게이트에 jwc 추가

> cli-jaw(`700_projects/cli-jaw`) 프롬프트 템플릿 수정. 사용자 — "cli-jaw는 codex가 아니면
> computer use 쓰지 말라고 돼있는데 jwc는 추가해야돼."

## 기존 게이트

cli-jaw는 computer use를 **프롬프트 레벨**로 codex 전용 게이팅했다(코드 가드가 아니라 직원/오케스트
프롬프트의 규칙). computer-use MCP(`mcp__computer_use__*`)가 **codex 바이너리에만 번들**돼 있어서
(방법론 B), 비-codex CLI는 도구 자체가 없으니 "codex 직원에게 dispatch하거나 실패"로 처리.

해당 위치:
- `src/prompt/templates/employee.md` §`$computer-use` trigger token
- `src/prompt/templates/a1-system.md` §0 desktop-control + routing(105) + path B 헤더(160)
- `src/prompt/templates/orchestration.md` §`$computer-use` routing(40)

## 수정 — jwc를 codex와 동급(self-serve)으로

jwc도 computer-use MCP를 갖게 됐으므로(방법론 A 작동 / B 해소 시) "codex" → "codex 또는 jwc"로 확장:

- employee.md: "Your CLI is codex" → **"codex or jwc (both ship the Computer Use MCP — jwc via its
  registered `computer_use` MCP server)"**; "not codex → precondition failed" → **"neither codex nor
  jwc → precondition failed: not codex/jwc"**.
- a1-system.md §0: "Codex + TCC ready → self-serve" → **"Codex or jwc + TCC ready → self-serve
  (jwc exposes them via its registered `computer_use` MCP server)"**; "Not codex → dispatch" →
  **"CLI without the Computer Use MCP → dispatch … any codex/jwc-family employee"**; "No codex-family
  employee" → **"No codex/jwc-family employee"**.
- a1-system.md routing(105): "codex self-serves; non-codex dispatches" → **"codex/jwc self-serve;
  CLIs without the MCP dispatch to a codex/jwc-family employee"**.
- a1-system.md path B 헤더(160): "(macOS, codex-only)" → **"(macOS, codex/jwc)"**.
- orchestration.md(40): 동일 취지로 codex/jwc self-serve + codex-or-jwc-family dispatch.

## 빌드 주의

cli-jaw는 `dist/`를 실행(`CLAUDE.md` Build & Deploy Contract). 프롬프트 템플릿(`src/prompt/templates/*.md`)
변경은 `npm run build`로 dist 반영 후 매니저 재시작이 필요. (본 변경은 사용자 요청에 따른 것으로,
doc-only가 아니라 런타임 프롬프트 변경.)

## 전제

이 게이트 완화는 **해당 머신에 jwc용 computer-use MCP가 실제 등록돼 있을 때만** 유효하다(방법론 A의
`~/.jwc/agent/mcp.json`, 또는 방법론 B 해소 후). 등록 안 된 jwc에서 `$computer-use`를 받으면
도구 부재로 실패하므로, 운영상 "jwc self-serve"는 등록을 전제로 한다.
