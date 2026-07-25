# WP4 — Card 20.019: codex/AI config (base URL · reasoning · verbosity · tiny role)

> Goal `f8909338-255` · PABCD work-phase 4 · Card `struct_har/chase/20.019_omp_chase_codex_ai_config.md`
> OMP source: `0fc6d136..ca9f2847e` (v16.1.20→v16.2.5). **reference-only, 1:1 port FORBIDDEN, decision=ADAPT.**

## Why (non-dev summary)

OMP가 codex/AI config 5개 항목을 손봤어요. 독립 audit(explorer Bacon gpt-5.4) 결과 JWC 갭은 2개만 실제 채택감이에요: (#1) codex usage URL이 streaming base-URL override를 만나면 깨지는 버그, (#3) textVerbosity가 Codex엔 있지만 generic stream/OpenAI Responses엔 연결 안 됨. 나머지는 JWC에 표면이 없거나(all_turns) 정책/대형 변경이라 보류해요.

## Independent audit (explorer Bacon, gpt-5.4) — 5 config items

| # | OMP item | anchor | verdict | evidence |
|---|---|---|---|---|
| 1 | codex base-URL parsing | `f46d03093` | **ADOPT** | JWC `normalizeCodexBaseUrl` (`usage/openai-codex.ts:188`)가 canonical host+`/backend-api` 포함이면 base를 그대로 반환 → streaming override `https://chatgpt.com/backend-api/codex/responses`면 `buildCodexUsageUrl`(`:202`)이 `.../codex/responses/wham/usage`(깨짐) 생성. OMP fix=canonical host면 extra path 무시하고 `${origin}/backend-api`. |
| 2 | codex reasoning `all_turns` | `2708c1edb` | **INAPPLICABLE** | JWC `ReasoningConfig`/`CodexRequestOptions`에 `context`/`reasoningContext` 없음(`providers/openai-codex/request-transformer.ts:5`/`:10`), `all_turns` grep 0. 막을 surface 없음. |
| 3 | configurable textVerbosity (OpenAI stream) | `2863a9c4e` | **ADOPT** | Codex provider-local엔 이미 있음(`openai-codex-responses.ts:75`/`:78`), 그러나 generic `SimpleStreamOptions`(`types.ts:406`)·`OpenAIResponsesOptions`(`openai-responses.ts:97`)·`stream.ts`(`:719`/`:737`) plumbing 부재. |
| 4 | default reasoning/verbosity 상향 | `f018c5ce8` | **DEFER** | #2(all_turns) 의존 + verbosity low→high·summary 강제는 동작/비용 기본값 정책 변경. ADAPT 카드 "작고 안전" 범위 밖. |
| 5 | tiny model role (background tasks) | `f0f7a5ba8` | **DEFER** | JWC built-in role=`default`만(`model-registry.ts:65`), tiny role 개념·`tiny/` 디렉터리 부재. role registry+resolver+schema+callsites 동반 확장 필요한 기능 슬라이스. |

## Implementation — 2 slices

### Slice WP4-A — codex usage base-URL fix (#1)

MODIFY `packages/ai/src/usage/openai-codex.ts`:
- `normalizeCodexBaseUrl`: trimmed string을 `new URL()`로 파싱하여 https 프로토콜 AND exact hostname in {chatgpt.com, chat.openai.com}일 때만 `${url.origin}/backend-api`로 정규화(streaming override path 제거). 파싱 실패/비-canonical/non-https는 기존 fallback 유지. 현행 startsWith는 http special-case 안 하므로 https 한정 유지로 동작 보존 + host-boundary 강화. `${origin}/backend-api`는 default CODEX_BASE_URL(`providers/openai-codex/constants.ts:5`)과 일치.
- JWC-native: OMP는 별도 `openai-codex-base-url.ts` 파일이지만 JWC는 inline 유지(파일 분리 안 함=1:1 port 회피). 단위 테스트용으로 `normalizeCodexBaseUrl` + `buildCodexUsageUrl`을 **export** 추가(기존 internal → named export).

NEW test `packages/ai/test/openai-codex-base-url.test.ts`:
- canonical origin (no path) → `${origin}/backend-api`
- canonical + `/backend-api` → 그대로
- canonical + streaming override `/backend-api/codex/responses` → `${origin}/backend-api` (회귀가드: `wham/usage` 덧붙여도 정상)
- non-canonical host → `CODEX_BASE_URL`
- buildCodexUsageUrl: `${base}/wham/usage` 단일 슬래시.

### Slice WP4-B — textVerbosity plumbing (#3)

MODIFY:
- `packages/ai/src/types.ts` (SimpleStreamOptions 시작 `:407`): `textVerbosity?` 추가.
- `packages/ai/src/providers/openai-responses.ts`: `OpenAIResponsesOptions`(:97)에 `textVerbosity?` 추가; `buildParams`(:433)에서 `applyCommonResponsesSamplingParams`(:484) 직후 official-endpoint-gated로 `params.text = {...params.text, verbosity}` 매핑. helper `isOfficialOpenAIResponsesEndpoint`: provider=openai 그리고 (effectiveBaseUrl 미지정 또는 hostname=api.openai.com), effectiveBaseUrl = resolvedBaseUrl ?? model.baseUrl (buildParams의 resolvedBaseUrl 사용, :438/:247/:261). SDK 타입 ResponseTextConfig.verbosity OK.
- `packages/ai/src/stream.ts` mapOptionsForApi: **openai-responses(:720)·openai-codex-responses(:738) 2개 case에만** `textVerbosity: options?.textVerbosity` 추가. **azure case 제외**(AzureOpenAIResponsesOptions에 textVerbosity 없음 → 타입에러/dead plumbing, audit FAIL 사유). codex case는 중복 아님 — direct call엔 이미 먹지만 streamSimple() generic 경로에서 누락분 복구.

NEW/EXTEND test: openai-responses buildParams가 official endpoint면 `text.verbosity` 세팅, 비-official(baseUrl≠api.openai.com)면 미세팅 검증.

## Verification gate

- `bun test` 신규/관련 테스트 green.
- `cd packages/ai && bun run check:types` exit 0.
- `bunx biome check --write` 신규 파일.
- 네이밍: added 라인에 gjc/gajae/omp/pi 신규 리터럴 0.
- `git diff --check` clean. 인용 OMP SHA(f46d03093/2863a9c4e/2708c1edb/f018c5ce8/f0f7a5ba8) resolve.

## PABCD

- P: this plan. A: Bacon audit(5 verdict) + adversarial Hubble re-audit → **FAIL→fixed 4 items**: WP4-A https+exact-hostname gating, WP4-B azure case 제거, endpoint gate resolvedBaseUrl 사용, 경로/라인 정정(types.ts:407, providers/ prefix). B: 2 슬라이스 atomic 커밋. C: test+tsc. D: evidence.

## Decisions recorded (card Done Gate)

- #1 ADOPT, #3 ADOPT (JWC code), #2 INAPPLICABLE, #4 DEFER, #5 DEFER. #4/#5는 별도 백로그 후보(009 ③).

## Feeds / depends

- depends: 10.036(_fin AI provider/auth/catalog), 20.023(_fin service-tier). feeds: 향후 tiny-role 카드(#5), default-verbosity 정책(#4).
