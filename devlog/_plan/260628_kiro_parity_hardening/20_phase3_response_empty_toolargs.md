# 20 — Phase 3: response-side empty tool arguments (post-400-fix)

> 상태: [진단/계측] — 실제 이벤트 캡처 대기
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

## 다음
사용자가 `JWC_KIRO_DEBUG=1 jwc` 로 `tool use 10개` 1회 실행 → `/tmp/jwc-kiro-debug.jsonl`의
tool 이벤트(name/input/toolUseId/stop 형태)를 공유 → 그 실제 형태로 파서를 정확히 수정.
