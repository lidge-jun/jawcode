# 10 — MOC: 전반적 개선 (툴콜링 루프 공통 계층)

> 상태: 골격 ✅ (260613) / 타 에이전트 조사 ✅ (CC·opencode·gemini-cli, 핵심 주장 직접
> 검증 완료 — [10.01](./10.01_research_claude_code.md), [10.02](./10.02_research_opencode_gemini.md)) /
> codex-rs 심층 서브에이전트 ⬜ 진행 중 / 수리 ⬜
> 밴드 구조: 00.x = Codex 유래 개선 ([00_moc](./00_moc_toolcall_loop_reformation.md)),
> **10.x = 전반적 개선** (이 문서가 MOC).
> 입력: 사용자 "전반적인 툴콜링 루프의 버그 같으니까", "000000 안에 플랜 자체를 00은 codex
> 개선, 10은 전반적 개선으로 문서화".

00 밴드가 "Codex 백엔드와의 대화 방법"(전송·캐시·프리웜)을 다룬다면, 10 밴드는 **백엔드가
무엇이든 적용되는 클라이언트 공통 계층** — 워치독, 지표, 가시성, 히스토리 직렬화, 멀티계정,
TUI 스트리밍 — 을 다룬다. 00 밴드 검증 과정에서 발견됐지만 Codex 한정이 아닌 항목들을
여기로 승격하고, Claude Code·opencode·gemini-cli 조사로 보강한다.

## G1 — 스트림 워치독 체계화

`Provider stream stalled / timed out` 워치독(`packages/ai/src/providers/register-builtins.ts:166-167,211-219`)은
전 프로바이더 공통인데 floor가 일률적이라 high effort 추론 침묵 구간을 장애로 오판한다
(00 밴드 T2와 동일 항목 — 구현은 공통 계층이므로 10 밴드 소유).

- `LazyStreamLimits`(:182-191, gemini 선례)를 **effort·컨텍스트 크기 연동**으로 일반화.
- stall 발생 시 "끊은 시점까지의 경과·수신 이벤트 수·재시도 비용"을 구조화 로그로 남겨
  오발/실제 장애를 사후 구분 가능하게.
- 캘리브레이션 기준값 (조사 결과): codex-rs **300초**(서버가 원격 덮어쓰기 가능,
  [00.02](./00.02_research_codex_rs_deep.md) B절), Claude Code **90초**(45초 경고, 30초
  스톨은 로그만, [10.01](./10.01_research_claude_code.md) §2), gemini-cli는 **연결 단계/
  스트림 중 예산 분리**(10회·5s vs 4회·1s, [10.02](./10.02_research_opencode_gemini.md) G-2).
  gpt-5.5 xhigh가 서버측에서 첫 출력 전 30분까지 침묵한 사례(#24260)가 있으므로 codex
  프로바이더 floor는 네이티브와 같은 300초급 + 경고/RETRY 이벤트로 침묵 가시화가 정답.
- 추가: `retry-after-ms`/`retry-after` 헤더 우선 백오프(opencode O2), 백그라운드성 호출은
  429/529 즉시 포기(CC §2 패턴).

## G2 — 지표 분리: 턴 평균 vs 순간 속도 vs TTFT

푸터 `⤴ tok/s`(`status-line/token-rate.ts:42-66`)는 `output ÷ 턴 전체 시간`이라 전송 문제와
모델 속도를 구분 못 한다 (00 밴드 조사에서 1.7 tok/s 오진단 유도 전례).

- 순간 출력 속도(최근 N초 윈도), TTFT(요청→첫 이벤트), 턴 평균을 분리 표기.
- 증상 ③(스트림 중간 레이트 붕괴) 같은 패턴은 순간 속도 그래프 없이는 보이지 않는다.

## G3 — 전송·폴백 가시성 (프로바이더 공통)

- 푸터에 transport 상태 (`websocket` / `sse(fallback)` / 프로바이더별 등가물).
- 요청 디버그 로그에 delta/full·input 아이템 수 포함 (00 밴드 T3와 공유).
- 조용한 강등(WS→SSE, fast-mode auto-fallback류) 전반에 1회성 notice 패턴 표준화
  (`agent-session.ts:6056-6063` 선례의 일반화).

## G4 — 히스토리 직렬화 안정성 (append/캐시 공통 기반)

델타 append(`buildAppendInput`, `openai-codex-responses.ts:1799-1819`)와 프롬프트 캐시 모두
"히스토리 직렬화가 바이트 단위로 안정"해야 작동한다. 현재 깨뜨릴 수 있는 요인:

- 조건부 `"# Juice: 0 !important"` 주입(`openai-responses-shared.ts:765-771`) — reasoning
  토글 시 input 구조 변경.
- 시스템 프롬프트가 턴마다 재구성(`context.systemPrompt` 라이브 참조) — 동적 내용 유입 시
  prefix 불안정.
- 수리 방향: 직렬화 스냅샷 비교 유틸 추가 — append 리셋이 일어날 때 "어느 인덱스의 어떤
  필드가 달라졌는지"를 디버그 로그로 출력 (현재는 원인 불명 리셋).

## G5 — 증상 ③ 판별: 스트림 중간 출력 레이트 붕괴 → **판정 완료: 클라이언트 O(n²) 렌더 버그**

같은 응답 안에서 첫 툴콜 args는 빠르고 다음 툴콜 args가 기어나오는 현상 (00 밴드 증상 ③).

**판정 (260613)**: 사용자 재현 — "끊고 재호출하면 다시 첫 번째는 빠름" = 계정 단위 서버
스로틀 배제, **응답 단위 누적 + 위치 의존** = 클라이언트. 코드로 인과 확정:

1. `modes/controllers/event-controller.ts:420-480` — `message_update`(모든 toolcall_delta)
   마다 스트리밍 메시지의 **모든 toolCall 블록을 순회**하며 각 컴포넌트에
   `updateArgs(renderArgs)` 호출. **이미 완성된 선행 툴콜 컴포넌트도 매 델타마다 포함**.
   `renderArgs`는 매번 새 스프레드 객체(`{...arguments, __partialJson}`) — 참조 동일성
   가드 불가.
2. `modes/components/tool-execution.ts:226-231` `updateArgs` — 호출당:
   `structuredClone(args)`(선행 Write의 전체 파일 콘텐츠 + 완성 `__partialJson` 문자열
   딥카피, :45-52) + `#runPreviewDiff`(memo 가드 자체가 `extractCompleteEdits` 파싱 +
   `JSON.stringify`, :252-267) + `#updateDisplay()` 풀 재렌더 (:479-).
3. 결과: 두 번째 Write의 델타당 비용 ∝ **선행 완성 콘텐츠 크기** → O(완성 콘텐츠 × 델타 수).
   Bun 단일 스레드 포화 → WS 소비 정체 → 토큰이 기어나오는 것처럼 보임. 취소 후 재호출은
   새 메시지(toolCall 1개)라 즉시 회복.

수리 (G5-fix) — **적용 완료 (260613)**:

- ✅ event-controller: `toolcall_delta` 이벤트에서 `contentIndex`와 다른 블록 중 컴포넌트가
  이미 있는 것은 스킵 (신규 블록 생성·비델타 이벤트의 풀 싱크는 보존).
- ✅ `updateArgs`: `__partialJson` 동일 + 인자 키 개수 동일이면 clone·diff·재렌더 조기 탈출.
  키 개수 지문은 "스트리밍 끝에서 프로바이더가 partialJson 변경 없이 파싱된 arguments를
  교체"하는 전이(codex 경로)를 가드가 삼키지 않도록 하는 안전핀. 이 가드는 컨트롤러
  스킵이 못 막는 **text_delta 주도 루프**(툴 뒤 프로스 스트리밍 중 settled 툴 재갱신)도
  차단한다.
- 검증: `tsgo --noEmit` 통과, 관련 테스트 147개(event-controller·streaming-preview·
  read-group·tool-execution·edit/apply-patch/vim 렌더러) 전부 통과.
- 보류: `structuredClone`에서 `__partialJson` 제외, 렌더 ~50ms 코얼레싱 — 가드 적용 후
  빈도가 급감하므로 실측 후 필요 시.
- contentIndex 의미 검증: codex(`blocks.length-1`, `openai-codex-responses.ts:872`)·
  anthropic(`blocks` 배열 인덱스, `anthropic.ts:1265-1276`) 모두 `message.content` 인덱스
  — 컨트롤러 순회 배열과 동일.

원 증상 ①(1.7 tok/s 대형 세션)도 연속 Write/Edit 턴이었으므로 이 버그가 주 증폭기였을
가능성이 높다 — 수리 후 00 밴드 검증 시나리오 재측정 필수. (단 00.02 A절의 업스트림 저하
이슈는 별개로 실재.)

원래의 판별 테스트 (참고용 보존):

1. **서버 스로틀 가설**: 신선한 소형 컨텍스트 세션에서 대형 Write 연속 2회 → 재현되면
   사용량 무관 = 클라이언트, 재현 안 되고 사용량 누적 후만 재현되면 서버 QoS.
2. **숨김 추론 가설**: 해당 라운드 usage의 `reasoningTokens` 비중 확인 — args 정체 구간이
   추론이면 reasoning이 output의 대부분을 차지.
3. **클라이언트 이벤트 루프 가설**: 대형 파일 Write 직후 TUI 렌더(마크다운 프리뷰·디프)가
   Bun 단일 스레드에서 WS `onmessage` 소비를 지연시키는지 — `PI_CODEX_DEBUG` 타이밍 로그에
   수신 시각 vs 렌더 시각 분리 기록 후 비교.
4. **(최우선, 조사 반영)** 백엔드가 스트림 중간에 푸시하는 `codex.rate_limits` 이벤트
   (primary 15분/secondary 일간 윈도 `used_percent`·`reset_at`, 00.02 D5)를 수신·노출하면
   서버 스로틀 여부를 즉석 판정 가능. `server_is_overloaded`/`slow_down` 코드 분류도 함께.
5. **(조사 반영)** 같은 시각에 네이티브 codex로 동일 작업 대조 — 서버측 저하(#24585,
   00.02 A절)가 진행 중인 시간대인지 격리.

결과에 따라 소유 밴드 결정 (서버 → 00, 클라이언트 → 10).

## G11 — 스트리밍 핫패스 전수 감사 (260613, G5-fix 후속)

G5와 같은 계열(델타당/라운드당 누적 비용)을 코드 전반에서 감사한 결과.

**수리 완료:**

- ✅ G5-fix (event-controller + updateArgs 가드) — 위 참조.
- ✅ **TTSR 버퍼 O(n²)** — `export/ttsr.ts:checkDelta`가 델타마다 풀 버퍼 문자열 재생성 +
  룰별 정규식을 누적 버퍼 전체에 실행했음. 룰이 등록된 세션에선 모든 text/thinking/toolcall
  델타가 해당. **16KB 테일 윈도우**(`TTSR_MATCH_WINDOW_CHARS`)로 바운딩 — 조건 패턴은
  국소적이므로 크로스 델타 매칭은 유지되고 정착분 재스캔만 제거. ttsr 테스트 20개 통과.

**설계상 이미 방어돼 있음 (무죄 판정):**

- TUI Markdown: 모듈 레벨 LRU 렌더 캐시(L2)가 "컨트롤러가 인스턴스를 재생성해도" 동일
  텍스트 재파싱을 막음 (`tui/src/components/markdown.ts:33-44`). 활성 테일만 캐시 미스 —
  자기 블록 크기에 바운딩.
- `#preCacheStreamingEditFile`: `#streamingEditFileCache.has()` 가드로 파일 read 1회.
- 세션 영속화: `message_end`에서만 기록, 델타당 디스크 I/O 없음.
- agent-loop: `structuredClone`은 abort 경로에서만.

**P2 — 라운드당 O(컨텍스트) CPU (버그 아님, 최적화 후보):**

- codex 프로바이더가 라운드당 풀 요청 본문을 `structuredCloneJSON` 2회
  (`openai-codex-responses.ts:704,1255`) + `buildAppendInput`이 베이스라인 전 아이템을
  매 라운드 `JSON.stringify` 비교 (:1806-1817). 92K 컨텍스트에서 라운드당 수~수십 ms.
  델타 요청 자체는 작으므로 이게 라운드 CPU의 지배항 — 아이템별 직렬화 캐시로 개선 가능.
- anthropic/bedrock/cursor는 델타마다 `parseStreamingJson(partialJson)` (자기 args에
  O(n²), 50KB args ≈ 총 100~300ms 수준). codex 경로는 완료 시 1회 파싱 — 파싱 스로틀로
  통일 가능.
- `#maybeAbortStreamingEdit`(edit 툴 한정): lineCount 메모 **앞**의 normalizeDiff/split이
  델타마다 누적 diff 전체에 실행 (`agent-session.ts:2847-2858`) — 길이 증가분 체크를
  메모 앞으로 당기면 제거 가능.

## G6 — 멀티계정 풀 경계 규율

`auth-storage.ts`(:640-991)의 round-robin 풀은 프로바이더 공통. 계정 전환 = 연결·캐시·델타
상태 전부 무효이므로:

- 전환은 턴 경계로만 제한 + notice 노출.
- 크리덴셜 만료 직전 선제 refresh(이미 단일 rotation point 설계 있음 :409-415)와 프리웜
  연동 — 전환 직후 콘텐츠 프리웜으로 새 계정 캐시 워밍.

## G7 — 타 에이전트 조사 (완료)

| 출처 | 결과 문서 |
|---|---|
| Claude Code (디옵 소스) | [10.01_research_claude_code.md](./10.01_research_claude_code.md) |
| opencode · gemini-cli | [10.02_research_opencode_gemini.md](./10.02_research_opencode_gemini.md) |
| codex-rs 심층 + 외부 요인 | [00.02_research_codex_rs_deep.md](./00.02_research_codex_rs_deep.md) |

## G8 — 툴 출력 규율: 스필 + 마이크로컴팩션 (조사 반영 신규)

4개 구현 전부 같은 결론 — 거대 툴 출력을 히스토리에 인라인으로 두지 않는다:

- CC: 툴당 50K chars 초과분 디스크 스필 + `<persisted-output>` 경로 참조, 오래된 툴 결과
  `[cleared]` 치환 마이크로컴팩션 (10.01 §3·§5).
- opencode: 2,000줄/50KB 스필 + "재독은 explore에 위임" 힌트, 40K 토큰 인라인 프루닝 (10.02 O3·O4).
- gemini-cli: 압축 전 50K 토큰 초과분 **head 20%+tail 80%** 스필 (10.02 G-4).
- codex-rs: head+tail 중간 절단 + 총 라인 수 프리픽스 (00.02 D6).

채택안: head+tail 스필(gemini 방식) + 마이크로컴팩션(CC 방식) 조합. G4(직렬화 안정성)와
시너지 — 델타·캐시·재전송 비용의 곱셈 항인 컨텍스트 상수를 직접 줄인다.

## G9 — mid-stream 툴 디스패치 (조사 반영 신규)

CC(`StreamingToolExecutor`, 10.01 §1)와 codex-rs(`in_flight.push_back` on OutputItemDone,
00.02 D3) **둘 다** 응답 스트림이 끝나기 전에 툴 실행을 시작한다. jawcode만 응답 완료 후
일괄 실행 (`agent-loop.ts:1215-1229`). 연속 툴 라운드에서 라운드당 수 초 절감 — 동시성
규칙은 기존 shared/exclusive를 그대로 쓰되 시작 시점만 `output_item.done` 도착 시로 당긴다.

## G10 — fast-ack 마이크로 응답 (조사 반영 신규)

gemini-cli: 조향 입력에 소형 모델 1.2초 하드 타임아웃 + 정적 폴백 (10.02 G-1). 증상 ②의
**체감** 완화 — 전송 수리(00.01 T1)와 별개로 UX 층에서 병행. CC의 사이드콜 은닉 패턴
(10.01 §4)과 같은 슬롯에서 설계.

## 실행 순서

1. G3 가시성 (00 밴드 T3와 동시 — 같은 패치)
2. G1 워치독 (00 밴드 T2와 동시)
3. G5 판별 테스트 → 증상 ③ 소유 밴드 확정
4. G2 지표 분리
5. G7 조사 → G4·신규 항목 구체화
6. G6 멀티계정 규율
