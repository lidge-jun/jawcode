# 12 — C-stage failure synthesis (/tone, adversarial round 1)

> Stage 1 mechanical gates: 전부 green (bun test identity 11/11 · coding-agent check · root check:ts incl. schemas/rebrand — ALL_GATES_GREEN).
> Stage 2 adversarial review (openai/gpt-5.5:high, read-only): **FAIL** — ADV-1(high)/ADV-2(low).

## ADV-1 [high] — accept, route b

**주장**: `buildToneCustomInstruction()`이 지시하는 `jwc config set identity.toneCustom "<text>"` 영속 경로가 자유형 문안에 불안전.
**메인 세션 소스 검증 (확정)**:
- `src/cli/config-cli.ts:108` — `else if (!arg.startsWith("-"))`: `-`로 시작하는 argv 토큰을 침묵 드롭. 불릿("- ...")으로 시작하는 tone 문안은 값이 통째로 사라짐.
- `config-cli.ts:117` — 다중 positional은 `" "` join: 따옴표 없이 넘기면 개행 소실.
- `config-cli.ts:177,233` — string 값 trim: 양끝 공백/개행은 verbatim 아님 (단, /tone 계약 자체가 "trim만"이므로 이 부분은 계약 합치).
- instruction에 따옴표/셸 확장 가드 부재.

**수정 (스코프 최소)**:
1. `config-cli.ts` `parseConfigArgs()`에 표준 `--` end-of-flags 구분자 추가 — `--` 이후 토큰은 `-` 시작 여부와 무관하게 전부 positional. (동일 파일 다른 동작 무변)
2. `buildToneCustomInstruction()` 영속 지시 재작성: 붙여넣은 문안을 single-quoted heredoc으로 임시 파일에 verbatim 기록 → `jwc config set identity.toneCustom -- "$(cat <file>)"` → `jwc config set identity.tone custom`. 따옴표/확장/선두 `-` 전부 안전; 개행은 명령 치환 규칙상 내부 보존·말미 strip(CLI trim과 동일 계약).
3. `test/config-cli.test.ts`에 `parseConfigArgs` `--` 케이스 추가 (선두 `-` 값 보존).

**근본 원인 분류**: implementation bug (instruction이 CLI 인자 파서의 flag-드롭 동작을 미검증 전제) — plan §4 custom 무인자 계약의 "config set으로 영속" 문구 자체는 유지되므로 plan 회귀 불필요.

## ADV-2 [low] — waive (evidence)

**주장**: plan a-r2 §4 "인라인 custom의 trim 결과가 빈 문자열이면 에러+usage" 미구현 — 공백만 있는 `/tone custom   `이 무인자 인터뷰 lane으로 떨어짐.
**검증**: `slash-commands/helpers/parse.ts:31-35`가 args 꼬리를 선-trim하므로 "custom 뒤 공백만" 입력은 파서 단계에서 `custom` 무인자와 구별 불가 — 해당 분기는 **도달 불가능**. 도달 가능한 유일한 폴백(무인자 인터뷰 lane)은 에러+usage보다 엄격히 유용하며 침묵 오상태 없음. plan의 해당 문장은 도달 불가 분기를 기술한 것으로, 코드/플랜 어느 쪽도 수정하지 않고 본 synthesis를 waiver 근거로 기록.

## 라우팅

- 채택: `orchestrate b` (ADV-1 코드 수정: config-cli `--` + instruction 재작성 + 테스트).
- 기각: `orchestrate p` 회귀 — plan 계약 문구는 유지되고 결함은 구현 전제 오류. `orchestrate i` 해당 없음. 환경/툴링 이슈 아님.
