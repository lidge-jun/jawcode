# 091 — plan: kiro 프로바이더 추가 (타당성 도시에)

> 상태: [제안] ⬜ — ToS 리스크(§⑥) 수용 결정 전 착수 금지. 조사: 웹 리서치 서브에이전트, 2026-06-12.
> 소속: 090 밴드 (인증 시딩 — 토큰 캐시 임포트가 D7 시딩 패턴과 동형).
> **착수 시점: 밴드 순서 무관** — 기술적 선행 의존 없음(기존 OAuth 인프라 재사용). 유일한 게이트는 ToS 리스크 수용 결정.

Kiro(AWS의 에이전틱 IDE, kiro.dev) 구독 쿼터로 Claude 모델을 jwc에서 쓰기 위한 신규 프로바이더.
**타당성: 높음, 난이도: 중하.** 결정적 자산 두 가지 — ① 레포 안에 레퍼런스가 이미 체크인되어 있다
(`devlog/_reference/002_proxy/devlog/kiro-gateway/` = jwadow/kiro-gateway 전체 Python 소스,
`devlog/_reference/002_proxy/49_prokiro/` = Kiro 인증 TS 포팅 자체 프로젝트). ② jawcode는 pi-mono
포크라서 **pi용 Kiro 프로바이더(`pi-provider-kiro`)가 이미 존재**하며, jawcode의
`pi.registerProvider()` 확장 API(`packages/coding-agent/src/extensibility/extensions/types.ts:1072`)와
인터페이스가 일치한다.

## ① 인증 플로우

AWS Builder ID / IAM Identity Center(SSO) / Google·GitHub 소셜 로그인 지원.
> 출처: [Kiro 공식 인증 문서](https://kiro.dev/docs/getting-started/authentication/)

| 경로 | 토큰 소스 (디스크) | 리프레시 |
|---|---|---|
| Kiro Desktop (IDE) | `~/.aws/sso/cache/kiro-auth-token.json` (accessToken/refreshToken/expiresAt/profileArn/region) | `POST https://prod.{region}.auth.desktop.kiro.dev/refreshToken` |
| AWS SSO OIDC (kiro-cli) | `~/.local/share/kiro-cli/data.sqlite3` (`kirocli:social:token` 등) + `~/.aws/sso/cache/{clientIdHash}.json` | `POST https://oidc.{region}.amazonaws.com/token` (`grantType: refresh_token`) |

> 출처: [kiro-gateway README](https://github.com/jwadow/kiro-gateway), 로컬 `devlog/_reference/002_proxy/devlog/kiro-gateway/kiro/auth.py:463-469`, `kiro/config.py:157`

- API 콜은 SigV4가 아니라 **`Authorization: Bearer {accessToken}`** — `aws-sigv4.ts` 불필요.
- 소셜 OAuth는 Cognito가 서드파티 localhost 콜백을 거부 → 서드파티 클라이언트는 **Builder ID 디바이스
  플로우** 또는 **IDE/CLI 캐시 임포트**가 표준 (090 밴드 토큰 시딩 패턴과 동형).
  > 출처: [CLIProxyAPIPlus kiro auth](https://github.com/router-for-me/CLIProxyAPIPlus/blob/main/internal/auth/kiro/aws.go)
- kiro-cli가 갱신 토큰을 SQLite에 안 쓰는 버그 보고 있음 — 외부 임포트 시 갱신 충돌 주의.
  > 출처: [kirodotdev/Kiro#4847](https://github.com/kirodotdev/Kiro/issues/4847), [9router#1253](https://github.com/decolua/9router/issues/1253)

## ② 엔드포인트 / 프로토콜

- 호스트: `https://runtime.{region}.kiro.dev` (구 `codewhisperer.us-east-1.amazonaws.com` 대체) —
  로컬 `kiro/config.py:178-185`
- 호출: 단일 POST, 헤더 `x-amz-target: AmazonCodeWhispererStreamingService.GenerateAssistantResponse`,
  `Content-Type: application/x-amz-json-1.0`, Bearer, **Kiro IDE 위장 User-Agent**
  (`KiroIDE-0.7.45-{fingerprint}`) + `x-amzn-kiro-agent-mode: vibe` — 로컬 `kiro/utils.py:79-89`
  > 출처: [kiro2api DeepWiki](https://deepwiki.com/caidaoli/kiro2api) (AmzTarget 교차 검증)
- 요청 바디: `conversationState` — `history`는 user/assistant 엄격 교대, 도구는
  `userInputMessageContext.tools[].toolSpecification` (도구명 64자 제한) — 로컬 `kiro/converters_core.py`
- 응답: `application/vnd.amazon.eventstream` 바이너리 프레이밍.
  **재사용 가능**: `packages/ai/src/providers/aws-eventstream.ts`의 `decodeEventStream`이 프렐류드/CRC
  검증까지 하는 정식 디코더로, `amazon-bedrock.ts`가 이미 사용 중 — kiro-gateway의 텍스트 스캔 방식보다 견고.
- 일부 모델이 툴콜을 `[Called func with args: {...}]` 텍스트로 뱉는 케이스 → 브래킷 파서 폴백 필요 —
  로컬 `kiro/parsers.py:92`

## ③ 모델 / 쿼터

- 요금제: Free $0/50크레딧, Pro $20/1,000, Pro+ $40/2,000, Pro Max $100/5,000, Power $200/10,000,
  초과 $0.04/크레딧.
  > 출처: [kiro.dev/pricing](https://kiro.dev/pricing/) (공식), [Lushbinary 2026 비교](https://lushbinary.com/blog/ai-coding-agents-comparison-cursor-windsurf-claude-copilot-kiro-2026/) — 2출처 교차 확인
- 모델: Auto, Claude Sonnet 4.5/4.6, Haiku 4.5, Opus 4.5/4.6/4.7 + 오픈웨이트(glm, deepseek-v3.2,
  minimax-m2.x, qwen3-coder 등). 크레딧 멀티플라이어 정확값은 **미검증** (단일 출처).
  > 출처: [kiro.dev/pricing](https://kiro.dev/pricing/), [pi-provider-kiro](https://github.com/mikeyobrien/pi-provider-kiro)

## ④ 선행 사례

| 프로젝트 | 방식 | 툴콜 | 활동 |
|---|---|---|---|
| [pi-provider-kiro](https://github.com/mikeyobrien/pi-provider-kiro) ⭐최적합 | TS, **pi 확장**(`registerProvider`) — jawcode와 동일 인터페이스 | 지원 | 2026-05 push, v0.8.0, 활발 |
| [kiro-gateway](https://github.com/jwadow/kiro-gateway) | Python 로컬 프록시 (OpenAI+Anthropic 호환) | 지원 | 2026-05 push, 1.9k★, **AGPL-3.0 주의** |
| [kiro2api](https://github.com/caidaoli/kiro2api) | Go 게이트웨이, 멀티계정 | 지원 | 2025-10 이후 정체 |
| [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 계열 | Go 멀티 프로바이더 | 지원 | 매우 활발 (37k★) |

## ⑤ 구현 스케치

**경로 A (최단, 1차 권장)**: `pi-provider-kiro`를 jawcode 확장으로 로드.
`ExtensionAPI.registerProvider()`(`extensibility/extensions/types.ts:1083-1111`)가
`streamSimple` + `oauth.login/refreshToken/getApiKey`를 받음 — 포크 간 타입 드리프트만 검증.

**경로 B (빌트인 벤더링)** — 추가/수정 파일:

1. NEW `packages/ai/src/providers/kiro.ts` — `streamKiro`. 템플릿은 **`google-gemini-cli.ts`**
   (OAuth 구독형 + 커스텀 변환 + 위장 헤더, 구조 거의 1:1), 응답 파싱은 `amazon-bedrock.ts`의
   `decodeEventStream` 패턴. 요청 변환은 로컬 `kiro/converters_core.py` + pi-provider-kiro `transform.ts` 포팅
2. NEW `packages/ai/src/utils/oauth/kiro.ts` — 디바이스 플로우 + 양대 리프레시 + 캐시 임포트.
   `oauth/index.ts`의 `refreshOAuthToken` switch(261행)에 케이스 추가
3. MODIFY `packages/ai/src/providers/register-builtins.ts` — `createLazyStream` 등록 (Bedrock 패턴, 412행 참조)
4. NEW `kiro-headers.ts` — User-Agent/x-amz-target/agent-mode 생성 (`kiro/utils.py:61-89` 포팅)

## ⑥ 리스크 — 착수 게이트

- **ToS 명문 금지**: Kiro 공식 FAQ가 서드파티 하네스 사용 금지를 명시
  ("Use with OpenClaw and similar tools that leverage third-party harnesses is prohibited").
  > 출처: [kiro.dev/faq](https://kiro.dev/faq/), [kiro.dev/pricing](https://kiro.dev/pricing/) — 공식 2곳
- **실제 제재 사례**: 403 `TEMPORARILY_SUSPENDED`, `AccountSuspendedException`, 423 Locked 등 계정
  정지 다수 보고. 원인이 클라이언트 탐지인지 사용량 패턴인지는 **미검증**.
  > 출처: [OmniRoute#2026](https://github.com/diegosouzapw/OmniRoute/issues/2026), [kirodotdev/Kiro#6524](https://github.com/kirodotdev/Kiro/issues/6524)
- 탐지 벡터: IDE User-Agent + 머신 핑거프린트 위장 필요, 클라이언트 버전 헤더 하드코딩 → 구버전 차단 시 갱신 부담.
- 라이선스: kiro-gateway는 AGPL-3.0 — 코드 직접 포팅 금지(참조만). pi-provider-kiro 라이선스 별도 확인.
- 권고: **개인 실험 한정 + 본계정 분리**. 착수 여부는 인터뷰에서 결정 (착수 전 인터뷰 필요).
