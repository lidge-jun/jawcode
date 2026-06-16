# Providers — Codex 전송 · 모델 패치 · 검색 (정본 통합)

> OpenAI Codex 전송로/진단 · 모델별 동작 패치 4층 · web 검색 프로바이더를 한 도메인으로 묶음 (260613).


---

# 1. Codex Transport


---

## Codex Transport — WS/SSE 전송·프리워밍·워치독·레이트리밋 텔레메트리 (정본)

> OpenAI Codex(ChatGPT 백엔드 Responses) 전송로의 jwc 전용 안정화·가시성 레이어 정본.
> 콜드스타트(프로덕션 2m15s 측정)·끊김·과부하를 줄이고 운영자에게 전송 상태를 노출한다.
> 모델 카탈로그/노출 패치는 [providers.md](./30_providers.md), 일반 검색은
> [search.md](./30_providers.md) 참조. 구현·진단 경위는 [devlog/_fin/000000_reformation](../devlog/_fin/000000_reformation/00_moc_toolcall_loop_reformation.md)
> (T1/T4/D5 + 측정 기반 진단).

Codex는 다른 OpenAI-compat 프로바이더와 달리 **WebSocket 우선, SSE 폴백**의 자체 전송로를
쓴다(`packages/ai/src/providers/openai-codex-responses.ts`). 그 위에 네 가지 jwc 패치가 얹혀 있다.

---

### 1. WebSocket 라이프사이클 (T4)

- 핸드셰이크가 진행 중이면 **새 요청이 기존 pending 핸드셰이크에 조인**(중복 연결 방지),
  치명 오류에는 **유한 retry 예산**을 둬 무한 재시도를 막는다.
- 위치: `openai-codex-responses.ts` (`36738838`).

### 2. 워치독 — 네이티브 패리티 (T4 후속)

- **300s idle floor + first-event floor**: 첫 이벤트까지/이벤트 간 유휴를 300초 바닥으로 둬
  네이티브 Codex 클라이언트와 동일한 끊김 판정. 너무 짧은 타임아웃이 정상 스트림을 죽이던 문제 교정.
- 위치: `packages/ai/src/providers/register-builtins.ts`, `packages/ai/src/utils/idle-iterator.ts`,
  `openai-codex-responses.ts`(SSE idle 폴백) (`93b7b66e`).

### 3. 콘텐츠 프리워밍 (T1)

- `generate:false` prefill로 모델 호스트를 미리 데우고, **유휴 시 최대 6회까지 4분 간격 갱신**.
  콜드스타트 2m15s를 상각. SDK 진입(`sdk.ts`)에서 세션 생성 시 best-effort로 발화.
- **모델 전환 시 idle-refresh 타이머 취소**(`1efee068`): 모델을 바꾸면 진행 중인 유휴 갱신 타이머를
  취소하고, 다음 turn_end에 새 모델이 여전히 codex면 재무장한다(stale 모델 프리워밍 방지).
- 위치: `packages/agent/src/agent.ts`, `packages/coding-agent/src/sdk.ts`,
  `packages/coding-agent/src/session/agent-session.ts` (`cd41e54d`, `1efee068`).

### 4. 레이트리밋 텔레메트리 + 과부하 분류 (D5)

- 스트림 내 `codex.rate_limits` 푸시 이벤트를 캡처해 사용률을 추적, **≥75%면 푸터에 `%` 마커**
  (마커 렌더는 `packages/coding-agent/src/modes/components/status-line/segments.ts`).
- `server_is_overloaded`를 명시 분류해 일반 오류와 구분.
- 위치: `packages/ai/src/provider-details.ts`(레이트리밋 값), `agent-session.ts`, `segments.ts`(푸터 `%`) (`bad0a8e1`).
- **레이트리밋 watchdog 우회 (`65d36ec3`)**: `codex.rate_limits`를 `CODEX_PROGRESS_EVENT_TYPES`에
  넣어, 추론 정적 구간에서 레이트리밋 푸시만 흐를 때 300s idle 워치독이 오발화해 스트림을 죽이던
  문제를 막는다(+ final-args refresh 중복 제거).

### 5. 전송 상태 가시성 (visibility)

- 푸터에 전송로 마커 `ws`/`sse`/`sse!`(폴백 강제) 표시, delta/full 로그, 폴백 발생 시 notice.
- 위치: `agent-session.ts` (`76176ce3`).

> 참고 — fast/service_tier 표시(`bf4feb28` ⚡? → `7315a7a6` revert): `/fast`의 `service_tier:priority`가
> 백엔드에서 조용히 `default`로 강등되는지 보이려 했으나, **`service_tier` 에코는 fast-실현 신호가
> 아님**이 판명돼 ⚡? 마커는 되돌렸다. `/fast` 설정 영속화 자체는 [fork-delta.md](./40_fork-delta.md) 참조.

---

### 6. 진단 결론 — "fast 둔화"는 서버측 (클라 수리 불가)

위 패치들은 전송 **안정화·가시성**이며, 사용자가 겪은 "대화 이어가면/끊어치면 출력 둔화,
기다리면 회복"의 **근본 원인은 아니다.** 측정 기반 진단(전문: [10.04](../devlog/_fin/000000_reformation/10.04_symptom_burst_slowdown.md)):

- **원인 = gpt-5.5 `fast`(service_tier=priority) 서버측 회귀.** 5중 확정: ① 사용자 실증(fast off→둔화0)
  ② 코드(codex·jwc 모두 passthrough — tier 전용 타임아웃/재시도 없음, 100% 서버측)
  ③ openai/codex 이슈 다발(#24422 등, 2026-04~, 미해결) ④ headless 버스트 미재현(간헐 서버 현상)
  ⑤ 공식 문서(priority는 spiky 트래픽 부적합).
- **기각된 가설(측정)**: 서버 quota 스로틀(rate_limits 6% 평탄) / 클라 라운드당 clone+stringify
  (마이크로벤치 0.6ms) / 배칭 프롬프트 유도(gpt-5.5 무반응, revert).
- **완화책**(수리 아님): `/fast off`(=`serviceTier:none`) + effort `:high→:medium`(체감 3~5x) +
  단순작업 `gpt-5.4-mini`. 가시성 패치(델타/full 로그·rate_limit 텔레메트리)가 **이 진단을 가능케 함**.

### 7. 별개 상존 — TUI 긴-텍스트 마크다운 O(n²) (전송 무관)

- `coding-agent/src/modes/components/assistant-message.ts:193` `updateContent`가 텍스트 델타마다
  누적 전체 텍스트로 `new Markdown(fullText)` 재생성 → 캐시 키가 전체 텍스트라 토큰마다 미스 →
  전체 lexer+highlight 재실행 = **출력 길이에 O(n²)**. 긴 단일 응답 렌더 둔화 유발(본 fast 증상의
  주인은 아님). **확정 패치 후보**지만 보호된 TUI 영역(메모리 `tui-visual-design-protected`)이라
  코얼레싱/tail-only 파싱은 시각 검증 후 적용. (툴-args O(n²) `G5`는 이미 수리 — `1814bb95`.)

### 근거 파일

| 영역 | 위치 | commit |
|---|---|---|
| WS 라이프사이클 | `packages/ai/src/providers/openai-codex-responses.ts` | `36738838` |
| 워치독 floor | `register-builtins.ts`, `utils/idle-iterator.ts` | `93b7b66e` |
| 프리워밍 | `agent/src/agent.ts`, `coding-agent/src/sdk.ts`, `agent-session.ts` | `cd41e54d` |
| 레이트리밋 텔레메트리 | `provider-details.ts`, `agent-session.ts` | `bad0a8e1` |
| 전송 가시성 | `agent-session.ts` | `76176ce3` |
| 안정화(레이트리밋 progress 중복·final-args refresh) | 리뷰 후속 | `65d36ec3` |


---

# 2. Model Patches


---

## 모델별 동작 패치 지도 (model behavior patch map)

> 특정 모델/프로바이더가 jwc 안에서 오동작할 때 **어디를 고치면 되는지**의 정본.
> 지금까지 패치한 모델 내역(§1)과, 다른 프로바이더에서 문제가 터졌을 때 따라가는
> 플레이북(§3)을 담는다. 상세 경위는 devlog 081 밴드, 구현은 각 코드 위치 참조.

jwc에서 "모델이 이상하다"는 문제는 대부분 네 층 중 하나에서 고친다: ① **카탈로그**
(모델 스펙·호환 플래그), ② **요청 변환기**(프로바이더별 파라미터 가공), ③ **모델별
시스템 프롬프트 주입**(행동 교정), ④ **도구/호스트 측 방어**(모델 무관 일반화).
아래로 갈수록 적용 범위가 넓고 위로 갈수록 정밀하다. 원칙: **사실 오류(스펙·파라미터)는
①②로, 행동 습성은 ③으로, 모든 모델이 당할 수 있는 함정은 ④로.**

---

### 1. 패치 완료 내역 (2026-06-12 기준)

| 대상 | 증상 | 패치 층 | 위치 | devlog |
|---|---|---|---|---|
| xai/grok-composer-2.5-fast | 미등록 모델 | ① 카탈로그 엔트리 | `packages/ai/src/models.json` xai 블록 (ctx 200k / maxOut 64k) | #518 (업스트림 머지) |
| 〃 | `reasoningEffort` 400 거부 | ① per-model compat | 같은 엔트리 `"compat": {"supportsReasoningEffort": false}` | 081 밴드, #518 |
| composer-* (xai·cursor 공통) | hashline 앵커 날조·sed 읽기·python 대역외 수정·heredoc에 추론 누출·타임아웃을 성공으로 오인·unpruned find 루프 | ③ 프롬프트 주입 | `packages/ai/src/providers/composer-discipline.ts` (+ 주입: `openai-completions.ts` convertMessages, `cursor.ts` buildCursorSystemPromptJsons) | [081.8](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/081.8_issue_composer_anchor_fabrication.md), [081.11](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/081.11_issue_composer_bash_timeout_loops.md) |
| cursor 프로바이더 전 모델 | Cursor IDE 관습 가정 (.cursorrules 등) | ③ 프롬프트 주입 | `cursor.ts` `CURSOR_HOST_OVERRIDE_PROMPT` | 081.6 |
| cursor 전송로 | bash timeout ms↔s 단위 혼동 (30000ms→3600s) | ② 변환기 | `coding-agent/src/cursor.ts` `shellTimeoutSeconds` | #519 (업스트림 머지) |
| 전 모델 (출력 64k+ 카탈로그) | 컴팩션 임계 과소 (예약 64k vs 실요청 32k) | ④ 호스트 | `packages/ai/src/stream.ts` `effectiveMaxOutputTokens` + agent-session/context-usage 정렬 | [081.9 §6](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/081.9_issue_composer_autocontinue_no_stop.md) |
| 전 모델 | bash 타임아웃 kill이 부분 출력만 반환 → 성공 오인 | ④ 호스트 | `coding-agent/src/tools/bash.ts` `formatTimedOutResult` (KILLED 명시) | 081.11 옵션 B |
| 전 모델 (표시) | 상태줄 session_name이 composer 환각 타이틀 전문 렌더 | ④ 호스트 | `status-line/segments.ts` sessionNameSegment 미렌더 | [081.10](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/081.10_issue_statusline_title_leak.md) |
| (프록시, 레포 밖) composer via progrok | 자체 하네스 도구 호출·effort 400 | 외부 | `002_proxy/05_progrok/src/proxy/composer-inject.ts` | progrok devlog 260604 |
| codex spark 모델 | reasoning 파라미터 전송 시 거부 | ② 변환기 | `packages/ai/src/providers/openai-codex/request-transformer.ts` (spark id면 reasoning strip) | 99.30.04 S3 (`a0fa4b6a`) |
| codex provider 노출 | auto-review·legacy id가 셀렉터를 오염 | ① 카탈로그(노출 정책) | `provider-models/special.ts` + `utils/discovery/codex.ts` — spark 유지, auto-review/legacy는 `unlisted` | 99.30.04 S2 (`f2e2858a`) |
| xai/grok-composer-2.5-fast | OAuth `/v1/models` 응답에서 누락 | ① 카탈로그(정적 주입) | `provider-models/openai-compat.ts` — xai OAuth 경로에서 정적 주입 + OAuth allowlist | 99.30.04 S10/S4 (`1b9a1289`, `0eed7753`) |
| antigravity·anthropic (동적 외) | 동적 디스커버리 밖에서 카탈로그-only id 노출 | ① 카탈로그(노출 정책) | `provider-models/google.ts`·`openai-compat.ts` `markUnlistedOutsideDynamic` | 99.30.04 S4+S5 (`0eed7753`) |

### 2. 패치 층별 코드 지도

#### ① 카탈로그 — `packages/ai/src/models.json`

- 모델 엔트리: `contextWindow`, `maxTokens`, `reasoning`, `thinking`, `cost`, `baseUrl`.
- **per-model `compat`**: `OpenAICompat` 키를 모델 단위로 오버라이드 (`resolveOpenAICompat`,
  `openai-completions-compat.ts:253`이 provider 기본값 위에 머지). 예: composer의
  `supportsReasoningEffort: false`. provider 휴리스틱(예: `isGrok`)을 건드리지 말고
  **반드시 해당 모델 엔트리에만** 둔다.
- ⚠️ **모델 캐시 함정**: `~/.jwc/agent/models.db`(`model_cache`, authoritative 플래그)가
  스테일 compat을 서빙할 수 있다. 카탈로그 수정 후 살아있는 400이 계속되면 캐시 row를
  확인하고 갱신/삭제할 것 (081 밴드에서 실제로 당함).
- **`Model.unlisted` 노출 정책 (99.30.04)**: 디스커버리 기반 프로바이더가 카탈로그-only id를
  드롭하는 대신 `unlisted`로 태깅한다(`Model.unlisted` 필드 `types.ts`, `markUnlistedOutsideDynamic`
  `model-manager.ts`, `f3215869`). 셀렉터는 기본 숨김·요청 시 노출. provider별 노출 결정은 §1
  표의 codex/xai/antigravity/anthropic 행 참조 — **드롭이 아니라 노출 제어로 처리**하는 게 원칙.

#### ② 요청 변환기 — 프로바이더별 wire 가공

- openai-completions: `convertMessages`/`streamOpenAICompletions` (`openai-completions.ts`),
  effort 게이팅 :1212-1236, maxTokens 기본 `effectiveMaxOutputTokens` (stream.ts).
- cursor RPC: protobuf 빌드 (`cursor.ts` buildGrpcRequest), exec 핸들러 단위 변환은
  `coding-agent/src/cursor.ts`.
- 파라미터를 "조용히 떨군다/변환한다"류는 전부 이 층.

#### ③ 모델별 시스템 프롬프트 주입 — 행동 교정

| 경로 | 주입 지점 | 현재 입주자 |
|---|---|---|
| openai-completions (xai 직결 등) | `convertMessages` 시스템 프롬프트 unshift (`openai-completions.ts:1432` 부근) | `COMPOSER_EDIT_DISCIPLINE_PROMPT` (composer 한정) |
| cursor RPC | `buildCursorSystemPromptJsons(systemPrompt, modelId?)` | `CURSOR_HOST_OVERRIDE_PROMPT` (전 모델) + discipline (composer 한정) |
| anthropic / google / codex | **주입 지점 미구축** — 필요 시 같은 패턴(시스템 블록 선두 prepend)으로 신설 | — |

규약: 모델 판별은 id 부분 문자열 헬퍼(`isComposerHarnessModel` 식)로 한 곳에, 프롬프트
텍스트는 **관찰된 실패 모드를 정조준한 명령문**으로(일반론 금지), 호스트 시스템 프롬프트가
있을 때만 주입(베어 호출 오염 방지), KV 캐시를 위해 항상 선두 고정.

#### ④ 도구/호스트 방어 — 모델 무관 일반화

특정 모델 때문에 발견했어도 **모든 모델이 당할 수 있으면** 이 층으로 격상한다.
사례: bash KILLED 명시(081.11 B), 컴팩션 예약·요청 정합(081.9 E), cursor ms→s(#519).

### 3. 플레이북 — 새 프로바이더/모델에서 문제가 터지면

1. **증거 먼저**: 세션 JSONL(`~/.jwc/agent/sessions/<cwd-slug>/*.jsonl`)에서 도구 호출·
   stopReason·에러를 추출. HTTP 400은 `~/.jwc/logs/http-400-requests/*.json`이 원문 요청을
   담고 있다. 모델의 자기 설명은 증거가 아니다 (devlog 081 교훈 — composer 자기 진단은 confabulation).
2. **층 판별**:
   - 4xx/파라미터 거부 → ①(compat) 또는 ②(변환기). 먼저 ①로 풀리는지 본다.
   - 스펙 불일치(컨텍스트/출력 한도) → ① + 캐시(models.db) 확인.
   - 도구 오남용·형식 위반·추론 누출 등 습성 → ③ discipline 블록 (기존 텍스트에 조항
     추가가 우선, 새 모델군이면 새 모듈).
   - 어느 모델이든 같은 함정에 빠질 구조 → ④.
3. **구현 규약**: fork-delta 최소화 — 신규 파일 + 기존 파일 한두 줄 후킹. 주석에
   `jwc fork (devlog NNN.N)` 표기. 테스트는 packages/ai|coding-agent `test/`에 모델별
   주입/비주입 양쪽 케이스.
4. **검증**: 단위 테스트 + 살아있는 jwc 한 방(`jwc -p --no-session --model "<prov>/<id>" "Reply with exactly: OK"`).
   캐시 스테일 의심 시 models.db 직검. ⚠️ jwc는 `packages/jwc/dist/jwc.bundle.js`가 있으면 **번들 우선** —
   소스 패치 후 `cd packages/jwc && bun run bundle` 재번들 필수 (스테일 번들 = 패치 미반영 오판의 단골).
5. **기록**: devlog 081 밴드(또는 해당 밴드)에 issue 문서 + 081 MOC 행 + **이 문서 §1 표에
   행 추가**. 업스트림 가치가 있으면(사실 오류 계열) PR, 행동 교정(③)은 fork 유지가 기본.

### 4. 빠른 참조 — 자주 쓰는 진단 한 줄

```bash
## 모델 캐시에서 특정 모델 compat 확인
sqlite3 ~/.jwc/agent/models.db "select models from model_cache where provider='xai'" | python3 -m json.tool | grep -A3 composer
## 세션에서 도구 거부/에러 빈도
grep -c "anchors do not match" ~/.jwc/agent/sessions/<slug>/<session>.jsonl
## 살아있는 검증
jwc -p --no-session --no-tools --model "xai/grok-composer-2.5-fast" --thinking high "Reply with exactly: OK"
```


---

# 2b. Tokenizer routing (provider → native encoding)

> 활성 `{ provider, id }`에서 **컨텍스트 카운트·컴팩션·prune**에 쓰는 BPE family/encoding 정본. 요청 wire(②)와 별개.

## 해석 체인

1. `packages/ai/src/utils/tokenizer-routing.ts` — `resolveTokenizerFamily(model)` (`29-85`).
2. `packages/coding-agent/src/utils/tokenizer-encoding.ts` — `resolveModelEncoding` → `@gajae-code/natives` `Encoding`; lazy family는 `tokenizer-download` (`18-28`).

## 소비처 (coding-agent)

- **컴팩션·prune·autocompact**: `agent-session.ts` — `#estimateContextTokensForCompaction`, `#estimateMessagesTokens`, `prepareCompaction` / `pruneToolOutputs` (`resolveModelEncoding` @ `253`, `6334`, `9893`).
- **표시**: 상태줄·context-usage — display는 heuristic; compaction만 native.

## provider → family (기본)

`PROVIDER_TO_FAMILY` (`tokenizer-routing.ts:29-57`): anthropic→claude; openai/openai-codex/azure-openai/xai/**cursor**/github-copilot/qwen·alibaba→o200k_base; google*→gemma; groq/fireworks/together/cerebras→llama3; deepseek/mistral/minimax*/cohere→각 family.

## id/호스트 예외

- `amazon-bedrock` (`59-68`), `google-vertex` (`71-76`), anthropic `isClaudeV2` → claude_v2 (`79-82`), 미등록 → `o200k_base` (`84`).

## 진단

새 provider는 ②와 별도로 `PROVIDER_TO_FAMILY`에 family 명시. 컴팩션 이상 시 `resolveTokenizerFamily` + usage vs `#estimateMessagesTokens` 비교.

---

# 3. Search


---

## Web Search — 프로바이더 전환·OAuth/키 게이팅·통합 검색 (정본)

> `web_search` 도구가 어떤 프로바이더로 나가는지, 운영자가 `/searchengine`으로 어떻게
> 갈아끼우는지, 어떤 자격증명이 어떤 엔진을 푸는지의 정본. 구현 경위는 devlog
> [_fin/260612_searchengine](../devlog/_fin/260612_searchengine/00_moc_searchengine.md).

검색 표면은 세 층이다: ① **프로바이더 레이어**(엔진별 구현 + 해석 체인), ② **선택 표면**
(`providers.webSearch` 설정 + `/searchengine` 슬래시), ③ **가용성 게이팅**(OAuth/키 보유에
따른 활성화). 핵심 원칙: **검색 프로바이더는 활성 모델과 독립**이며, `auto`는 "지금 모델의
네이티브 검색"을 고르는 편의 기본값일 뿐이다.

---

### 1. 프로바이더 레이어

- 등록부: `getSearchProvider(id)`가 `PROVIDER_META`에서 lazy `import()`로 로드하고
  `instanceCache`에 캐싱한다 (`packages/coding-agent/src/web/search/provider.ts:119`).
- 해석 체인: `resolveProviderChain(authStorage, preferred, activeModelProvider)`
  (`provider.ts:206`) — ① 명시 선택 프로바이더가 가용하면 1순위, ② 아니면 활성 모델의
  네이티브 검색(그 프로바이더 `isAvailable`이 참일 때만), ③ **키리스 DuckDuckGo를 항상
  말단 폴백으로 추가**. keyed 단독 프로바이더는 auto에서 절대 자동 선택되지 않고 명시 선택
  전용이다.
- 도구 진입: `WebSearchTool` (`src/web/search/index.ts:229`), CLI는 `runSearchQuery`
  (`index.ts:211`). 자격증명은 오직 `AuthStorage`로만 해석(`getApiKey`/`getOAuthAccess`) —
  사이드 스토어 직접 오픈 금지(`providers/base.ts` 계약).
- 응답 형태: 모든 프로바이더가 `SearchResponse`(answer? + `SearchSource[]` + citations?)로
  정규화 (`src/web/search/types.ts`).

#### 프로바이더 목록 (16종)

`SearchProviderId` 유니온 (`types.ts`): duckduckgo, exa, brave, jina, kimi, zai, anthropic,
perplexity, gemini, codex, tavily, parallel, kagi, synthetic, searxng, **xai**.
설정 enum은 `providers.webSearch` (`src/config/settings-schema.ts:2721`), 기본 `auto`.

---

### 2. 가용성 게이팅 — OAuth 해금 vs 키 전용

각 프로바이더 `isAvailable(authStorage)`가 진실의 원천. 모델 레이어의 OAuth 게이팅
(`#isModelAvailable` = `keyless || hasAuth(provider)`)과 **동일한 스토리지 키**를 검사하므로,
모델용 OAuth 로그인이 곧 그 프로바이더의 검색도 푼다.

#### OAuth로 활성화 (6종)

| 검색 프로바이더 | 자격증명 | 로그인 |
|---|---|---|
| codex | `hasOAuth("openai-codex")` | OpenAI |
| anthropic | `hasAuth("anthropic")` (Claude OAuth 포함) + `ANTHROPIC_SEARCH_API_KEY` | Claude |
| gemini | `hasOAuth("google-gemini-cli"\|"google-antigravity")` | Google |
| perplexity | `hasAuth("perplexity")` (OAuth bearer) / `PERPLEXITY_COOKIES` / `PERPLEXITY_API_KEY` | Perplexity |
| kimi | `hasAuth("kimi-code")`(OAuth) / `MOONSHOT_SEARCH_API_KEY` / `KIMI_SEARCH_API_KEY` | Moonshot/Kimi |
| **xai** | `hasOAuth("xai")` / `hasAuth("xai")` / `XAI_API_KEY` | xAI (`grok login`) |

#### 키/엔드포인트 전용 (OAuth 경로 없음)

zai(`ZAI_API_KEY`), tavily, brave, jina, exa(+`exa.enabled`), kagi(authStorage 전용),
parallel, synthetic, searxng(`SEARXNG_ENDPOINT`). 키 보유 시에만 활성.

> ⚠️ anthropic은 `isAvailable`이 `ANTHROPIC_SEARCH_API_KEY`만 검사하지만 `hasAuth("anthropic")`로
> Claude OAuth도 인정 — 즉 Claude 로그인만으로 별도 검색 키 없이 anthropic 검색이 열린다.

---

### 3. `auto` 모드 — 활성 모델 → 네이티브 검색

`MODEL_PROVIDER_TO_SEARCH` (`provider.ts:157`)가 활성 모델 provider를 그 네이티브 검색으로
매핑한다. **8개 계열**에서 동작:

| 모델 provider | → 검색 |
|---|---|
| openai / openai-codex / openai-responses | codex |
| anthropic | anthropic |
| google / google-gemini-cli / google-antigravity / gemini | gemini |
| moonshot / kimi-code / kimi | kimi |
| zai | zai |
| perplexity | perplexity |
| synthetic | synthetic |
| xai / grok | xai |

매핑에 없는 provider(deepseek·mistral·cerebras·ollama·lm-studio·커스텀 compat 등)는 네이티브
검색이 없으니 `auto`가 **DuckDuckGo로 폴백**한다. status 표시용 헬퍼는
`nativeSearchProviderFor(modelProvider)` (`provider.ts:190`).

이 8개는 **모델을 돌리는 자격증명 = 검색을 푸는 자격증명**이 동일하므로, 해당 모델을 쓸 수
있으면 `auto` 검색이 추가 설정 없이 같이 열린다.

---

### 4. `/searchengine` 슬래시 표면

- 스펙: `src/slash-commands/builtin-registry.ts:563` — `allowArgs: true`(필수, 없으면 TUI
  디스패처 게이트 `:1576`가 인자형을 LLM 채팅으로 흘림 = cmd_audit P1), 대문자 `SEARCHENGINE`
  명시 alias(룩업은 대소문자 구분).
- 인자 정규화 `normalizeSearchEngineArg` (`:220`): `chatgpt`/`openai`→codex, `claude`→anthropic,
  `google`→gemini, `grok`/`x`→xai, `ddg`/`duck`→duckduckgo, `active`/`native`/`default`→auto;
  나머지는 정식 id 직통.
- `status`(또는 무인자): 실제 `isAvailable` 프로브로 **Activated vs Needs-setup** 분리 표시,
  provider별 셋업 힌트 `SEARCH_ENGINE_SETUP_HINTS` (`:258`).
- 전환: `providers.webSearch` 설정에 SETTING_HOOK이 없어 **이중 기록 필수** —
  `settings.set` + `setPreferredSearchProvider(next)` (`provider.ts:180`) 둘 다 호출 후
  `notifyConfigChanged`. 키 없는 keyed 프로바이더를 골라도 persist하되 "not activated yet"
  경고(`:607`) — 검색은 그때까지 DuckDuckGo.
- 활성 모델과 독립: Claude 모델 + (OpenAI OAuth 보유 시) codex 검색처럼 섞어 쓸 수 있다.
  `auto`만이 모델-검색을 묶는 디폴트.

---

### 5. xAI Grok — 통합 웹 + X 검색

`src/web/search/providers/xai.ts`. xAI Responses API(`https://api.x.ai/v1/responses`,
`xai.ts:30`)에 **`web_search` + `x_search` 두 도구를 함께 탑재**(`XAI_SEARCH_TOOLS`,
`xai.ts:35`)해 일반 웹과 X 라이브 인덱스를 한 왕복에 통합 검색하고, Grok이 질의별로 소스를
고른다 — X 전용이 아니다.

- 라이브 탐침으로 확인한 유효 도구: `web_search`, `x_search`, `collections_search`,
  `file_search`, `code_exec`, `function` (`news_search`는 무효). 공개 웹 검색은 앞 둘이 전부.
- bearer는 `getOAuthAccess("xai")` → `getApiKey("xai")`/`XAI_API_KEY` 순. 답변 + `url_citation`
  주석을 `SearchSource[]`로 가상화. xAI가 citation title을 인덱스 번호로 주는 결함 → URL 폴백.
- 라이브 검증(grok OAuth): 웹+X 소스 혼합 왕복 확인. 포팅 원천: cli-jaw devlog 260530.

---

### 근거 파일

| 영역 | 위치 |
|---|---|
| 등록부·해석 체인·auto 매핑 | `packages/coding-agent/src/web/search/provider.ts:119,157,190,206` |
| 도구·CLI 진입 | `src/web/search/index.ts:146,211,229` |
| 타입·프로바이더 유니온 | `src/web/search/types.ts` |
| 설정 enum | `src/config/settings-schema.ts:2721` |
| `/searchengine` 스펙·게이팅·힌트 | `src/slash-commands/builtin-registry.ts:220,258,563,1576` |
| xAI 통합 검색 | `src/web/search/providers/xai.ts:30,35,161` |
| 프로바이더별 `isAvailable` | `src/web/search/providers/*.ts` |
