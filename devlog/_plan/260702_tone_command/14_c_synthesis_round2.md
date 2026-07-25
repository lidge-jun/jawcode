# 14 — C-stage failure synthesis round 2 (/tone, adversarial delta)

> Stage 1 mechanical gates (round 2): 전부 green — bun test config-cli+identity 19/19 · coding-agent check · root check:ts (C2_ALL_GATES_GREEN).
> Stage 2 adversarial delta (openai/gpt-5.5:high): **FAIL** — ADV-1 partial (ADV-B1/B2 신규), ADV-2 waiver sound 판정.

## 결정

| ID | severity | 결정 | 근거 |
|---|---|---|---|
| ADV-B1 | high | **accept, route b** | `buildToneCustomInstruction()`이 고정 `TONE_EOF` heredoc을 지시 — 붙여넣은 문안에 `TONE_EOF` 라인이 있으면 heredoc 조기 종료 후 나머지가 셸 명령으로 실행(주입). 사실: 셸 heredoc은 첫 정확 일치 라인에서 종료. 수정: 셸 heredoc 지시 자체를 제거 — mktemp로 유일 경로 생성 → 에이전트 file-write 도구로 verbatim 기록(셸 미경유) → `config set identity.toneCustom -- "$(cat <path>)"` → tone=custom → 임시 파일 삭제. `$(cat file)`은 파일 내용을 데이터로만 취급하므로 잔여 주입면 없음. |
| ADV-B2 | low | **accept, route b (동일 수정에 포함)** | 고정 `/tmp/tone-custom.txt` 경로는 동시/잔존 내용 클로버 위험 — mktemp 유일 경로로 대체. |

ADV-1: separator/trim 계약 부분은 resolved 판정 유지, 잔여분은 ADV-B1로 승계. ADV-2 waiver: delta 검토가 sound 확인 (helpers/parse.ts:31-35, builtin-registry.ts:1037-1063).

## 근본 원인

instruction이 "verbatim 기록" 수단으로 셸 heredoc을 특정한 것 — 에이전트는 셸 없이 쓸 수 있는 file-write 도구를 이미 가지므로 셸을 경유할 이유가 없음 (수단 과잉지정 → 주입면 생성).

## 라우팅

- 채택: `orchestrate b` — `buildToneCustomInstruction()` 문자열만 수정 (소스 1파일, 타 파일 무변).
- 기각: p/i 회귀(계약 무변), 환경 이슈 아님.
