# 20 — Phase 3: response-side empty tool arguments (post-400-fix)

> 상태: [해결] — 라이브 캡처로 근본원인 확정 + 수정 + 라이브 재검증 완료
> Goal: aed2cc47-f1b
> 선행: 00(interleaving), 10(input-object). 이 둘로 REQUEST_BODY_INVALID 400은 해소됨.

## 진전

phase1+2 적용 후 라이브 `tool use 10개` 결과: **400 사라짐.** 요청이 모델까지 도달,
tool 호출이 실제 실행됨. → 요청(wire) 계약은 이제 맞음.

## 새 증상 (다른 버그)

tool 호출이 **빈 인자 `{}`**로 실행됨:
- Bash: `command: Invalid input: expected string, received undefined` / `Received arguments: {}`
- context7 resolve-library-id: `query/libraryName is required` / `{}`
모델이 재시도해도 동일 → 응답 스트림에서 tool **input 인자가 파서로 안 잡힘**.

## 가설 (미확정 — 캡처로 검증)

`packages/ai/src/providers/kiro.ts` `parseKiroPayload` + 이벤트 루프는 단일
`currentToolCall` 변수로 순차 tool 가정. CodeWhisperer가 (a) 각 input 조각 이벤트에
`name`을 반복 포함하면 매 조각이 `tool_start`로 처리돼 args가 리셋되거나, (b) input을
파서가 기대하지 않는 형태(예: 객체 1회 전송, 다른 필드명, 병렬 인터리브)로 보내면
args가 비게 됨. **실제 이벤트 페이로드 없이는 단정 불가** (요청측에서 추측 2회 실패한 전례).

## 계측 (이번 변경)

`JWC_KIRO_DEBUG=1`(또는 `=/path.jsonl`) 설정 시 kiro provider가
- 송신 payload 1건
- 각 raw streaming event payload + parsed event type
를 `/tmp/jwc-kiro-debug.jsonl`(또는 지정 경로)에 append. try/catch로 요청에 영향 없음.

## 근본 원인 (라이브 캡처로 확정)

`JWC_KIRO_DEBUG=/tmp/...jsonl jwc -p --model kiro/claude-sonnet-4.5` 로 직접 캡처.
CodeWhisperer tool-use 스트림은 **모든 이벤트에 `name`+`toolUseId`를 반복 포함**:

```
{"name":"bash","toolUseId":"..."}                     # start (input 없음)
{"input":"","name":"bash","toolUseId":"..."}          # input 조각 (name 포함!)
{"input":"{\"com","name":"bash","toolUseId":"..."}    # 조각
... (조각마다 name 포함) ...
{"name":"bash","stop":true,"toolUseId":"..."}         # stop (name 포함)
```

기존 `parseKiroPayload`는 `"name" in parsed` → 무조건 tool_start. 모든 input 조각이 새
tool_start로 잡혀 accumulator 매번 리셋, `"input" && !name` tool_input 분기는 영구 미실행
→ 인자 `{}`. stop도 name 때문에 tool_start로 오인.

## 수정

`parseKiroPayload`를 `stop===true` → `"input" in parsed` → `name` 순으로 판별하도록 재작성
(+ 테스트용 `export`). 핸들러는 start→input들→stop 시퀀스와 그대로 맞아 변경 불필요.

## 검증
- `kiro-stream.test.ts` 5케이스(라이브 캡처 이벤트 형태): start/input(+name)/stop/content 판별
  + 조각 누적→유효 JSON. 11/11 pass(payload 6 + stream 5), tsc 0 에러.
- **라이브 재검증**: jwc -p 캡처 재실행 → 모델 응답 "command executed successfully and output
  `hello-from-verify`" → bash tool이 실제 인자 받아 실행. 빈-args 해소 확인.

## 커밋
- `43a8f67` fix(kiro): parse tool-use stream by stop/input, not name (empty-args bug)
- `034d249` feat(kiro): opt-in wire debug capture (JWC_KIRO_DEBUG) — 진단 도구

## 다음
사용자 인터랙티브 세션에서 `tool use 10개` 최종 확인 (single-tool은 라이브 검증 완료).
