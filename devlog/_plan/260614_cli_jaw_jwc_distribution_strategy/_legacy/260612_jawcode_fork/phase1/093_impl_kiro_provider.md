# 093 — impl: Kiro HTTP API Provider 구현 완료

> 상태: [구현완료] ✅ — 컴파일 통과, 실 호출 동작 확인 (2026-06-12)
> 선행: 091 (HTTP API 설계), 092 (ACP 프로토콜 크래킹)
> 소속: 090 밴드 (인증 시딩)

## 요약

Kiro를 jwc의 정식 Provider로 등록 — `/login` 메뉴 노출, kiro-cli SQLite 자동 인증,
`runtime.{region}.kiro.dev` HTTP API 직접 호출, 스트리밍 응답 파싱까지 E2E 동작.

---

## ① 변경 파일 목록

### 신규 파일
| 파일 | 역할 |
|---|---|
| `packages/ai/src/providers/kiro.ts` | 핵심 스트리밍 프로바이더 (`StreamFunction<"kiro-streaming">`) |
| `packages/ai/src/utils/oauth/kiro.ts` | OAuth 로그인 플로우 (SQLite 자동 읽기 + 수동 fallback) |

### 수정 파일
| 파일 | 변경 내용 |
|---|---|
| `packages/ai/src/types.ts` | `KnownApi`에 `"kiro-streaming"`, `KnownProvider`에 `"kiro"` 추가 |
| `packages/ai/src/stream.ts` | `streamKiro` dispatch (API key 체크 우회, Bedrock 패턴) |
| `packages/ai/src/providers/register-builtins.ts` | lazy-load 등록 |
| `packages/ai/src/provider-models/special.ts` | `kiroModelManagerOptions()` — 8개 정적 모델 |
| `packages/ai/src/provider-models/descriptors.ts` | `catalogDescriptor("kiro", ...)` 엔트리 |
| `packages/ai/src/utils/oauth/types.ts` | `OAuthProvider`에 `"kiro"` 추가 |
| `packages/ai/src/utils/oauth/index.ts` | `builtInOAuthProviders` + `refreshOAuthToken` |
| `packages/ai/src/auth-storage.ts` | `login()` switch — kiro case (기존 credential 삭제 후 저장) |

### prokiro 보강 (002_proxy/49_prokiro)
| 파일 | 변경 내용 |
|---|---|
| `src/commands/login.ts` | `--from-cli` 옵션 추가, 인자 없이 실행 시 SQLite 자동 감지 |
| `src/auth/kiro-auth.ts` | `loadFromSQLiteFallback()` 실제 구현 (bun:sqlite + better-sqlite3 이중 폴백) |

---

## ② 인증 아키텍처

```
                    ┌─────────────────────────────────────┐
                    │         resolveKiroAuth()           │
                    └──────────────┬──────────────────────┘
                                   │ (우선순위 순)
    ┌──────────────────────────────┼──────────────────────────────┐
    │                              │                              │
    ▼                              ▼                              ▼
options.accessToken          options.apiKey              $env.KIRO_ACCESS_TOKEN
    │                        (jwc OAuth 저장소)               │
    │                              │                              │
    └───────────┬──────────────────┘                              │
                │                                                 │
                ▼                                                 ▼
        ~/.prokiro/auth.json                    kiro-cli SQLite DB
        (prokiro 프록시용)                   ~/Library/Application Support/
                                             kiro-cli/data.sqlite3
                                                     │
                                                     ▼
                                           auth_kv 테이블
                                    key: kirocli:social:token
                                    val: {access_token, refresh_token,
                                          expires_at, profile_arn}
```

### 토큰 수명 관리
- **캐싱**: `authCache` 전역 변수에 토큰+profileArn+만료시각 보관
- **사전 리프레시**: 만료 60초 전에 Desktop Auth 엔드포인트로 갱신
- **401 자동 재시도**: 서버 401 → refresh → 새 토큰으로 1회 재시도
- **캐시 무효화**: 리프레시 실패 시 `authCache = null` → 다음 요청에서 재로드

---

## ③ Anti-Detection (모크 강화)

### 헤더 구성
```
Authorization:              Bearer {token}
Content-Type:               application/x-amz-json-1.0
Accept:                     application/vnd.amazon.eventstream
x-amz-target:              AmazonCodeWhispererStreamingService.GenerateAssistantResponse
User-Agent:                 aws-sdk-js/1.0.27 ua/2.1 os/{os_tag} lang/js md/nodejs#22.21.1
                            api/codewhispererstreaming#1.0.27 m/E KiroIDE-{version}-{fingerprint}
x-amz-user-agent:          aws-sdk-js/1.0.27 KiroIDE-{version}-{fingerprint}
x-amzn-codewhisperer-optout: true
x-amzn-kiro-agent-mode:    vibe
x-amzn-kiro-profile-arn:   {profileArn}  ← 바이너리 분석에서 발견
amz-sdk-invocation-id:     {uuid}  ← 매 요청 새로 생성
amz-sdk-request:           attempt=1; max=3
```

### 탐지 회피 요소
| 벡터 | 대응 |
|---|---|
| OS 핑거프린트 | `os.release()` 동적 감지 (macOS 24.x 등) |
| IDE 버전 | 상수 `1.2.0` + `KIRO_SPOOF_VERSION` env override |
| 머신 핑거프린트 | SHA256(hostname+username+"kiro-jwc") — 고정 장치별 고유값 |
| Conversation ID | SHA256(첫 3+마지막 메시지) — 동일 대화면 동일 ID (안정성) |
| profileArn 헤더 | `x-amzn-kiro-profile-arn` 전용 헤더로 전송 |
| 토큰 접두사 검증 | `"aoa"` 시작하는 토큰만 수락 (가비지 credential 방어) |

### 탐지 리스크 평가
| 항목 | 수준 | 비고 |
|---|---|---|
| UA 형식 | 낮음 | JS SDK 공식 포맷 준수 |
| 요청 빈도 | 중간 | 사용자 의존 — rate limit 준수 |
| 엔드포인트 | 낮음 | `runtime.{region}.kiro.dev` 공식 경로 |
| TLS 핑거프린트 | 중간 | Bun의 TLS ≠ 브라우저/Node.js AWS SDK |
| IP 패턴 | 낮음 | 단일 유저 단일 IP |

---

## ④ 정적 모델 카탈로그

```
kiro-auto          → auto
claude-sonnet-4.5  → claude-sonnet-4.5
claude-sonnet-4    → claude-sonnet-4
claude-haiku-4.5   → claude-haiku-4.5
deepseek-3.2       → deepseek-3.2       (reasoning=true)
minimax-m2.5       → minimax-m2.5
glm-5              → glm-5
qwen3-coder-next   → qwen3-coder-next   (reasoning=true)
```

---

## ⑤ 응답 파싱 (EventStream)

Kiro 서버 응답 = AWS EventStream 바이너리 (shared decoder: `aws-eventstream.ts`)

각 이벤트 페이로드 JSON:
| 패턴 | 의미 | jwc 이벤트 |
|---|---|---|
| `{"content":"..."}` | 텍스트 청크 | `text_start` + `text_delta` |
| `{"name":"...","input":...,"toolUseId":"..."}` | 도구 호출 시작 | `toolcall_start` |
| `{"input":"..."}` (name 없음) | 도구 입력 스트리밍 | 내부 축적 |
| `{"stop":true}` | 도구 호출 완료 | `toolcall_end` |
| `{"usage":N}` | 토큰 사용량 | 무시 |

---

## ⑥ 알려진 제한

1. **Kiro ToS**: 제3자 하네스 사용 금지 조항 존재 — 개인 실험 한정
2. **TLS 핑거프린트**: Bun fetch ≠ Kiro IDE (Electron/Chromium) — JA3 차이
3. **이미지 입력**: 페이로드에 이미지 첨부 미구현 (텍스트 전용)
4. **thinking 태그**: Kiro의 fake reasoning 주입 미지원
5. **토큰 사용량**: `{"usage":N}` 이벤트를 jwc Usage에 미반영 (0 고정)

---

## ⑦ 테스트 결과

```
[2026-06-12 10:30] /login → Kiro 선택
  ✓ kiro-cli SQLite 자동 감지 (kirocli:social:token)
  ✓ profileArn 추출 (arn:aws:codewhisperer:us-east-1:...)
  ✓ Credentials saved to agent.db

[2026-06-12 10:31] 채팅 "ㅎㅇㅎㅇ"
  ✗ profileArn 누락 → ValidationException  (패치 전)
  ✓ 정상 응답 스트리밍                       (패치 후)
```

---

## ⑧ 레퍼런스

- kiro-cli 바이너리 분석: `/Applications/Kiro CLI.app/Contents/MacOS/kiro-cli-chat`
- kiro-gateway (AGPL-3.0, 참조만): `002_proxy/devlog/kiro-gateway/`
- prokiro 인증 매니저: `002_proxy/49_prokiro/src/auth/kiro-auth.ts`
- ACP 프로토콜 문서: `092_plan_kiro_acp_integration.md`
