# 020_omp_D03_auth_oauth_credential

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D03 — auth/OAuth/credential
> Sol priority: P1
> Model-related: yes
> Card target: 20.055_auth_oauth_credential
> Worker: OW3

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `6ae7cdbf9` | Added automatic credential rotation for invalidated OAuth tokens | `packages/ai/src/auth-storage.ts`, auth retry |
| 2 | `792f75298` | Retained the targeted OAuth row after refresh races | auth-storage refresh race handling |
| 3 | `015d57523` | Preserved login-dialog paste routing | login dialog tests and input routing |
| 4 | `e858c1be6` | Serialized provider OAuth refreshes | auth-storage refresh coordination |
| 5 | `e49638dda` | Routed enhanced paste into login prompts | login dialog and selector controller |
| 6 | `4882c9b01` | Mounted login input for paste-code fallback URLs | login dialog lifecycle and paste fallback |
| 7 | `c97449c51` | Prevented Perplexity OAuth tokens from reaching the API-key endpoint | Perplexity web-search authentication |
| 8 | `5e74444c2` | Repaired the auth-storage rotation merge and its regression tests | auth rotation test coverage |
| 9 | `7c1375ceb` | Preserved auth fallback resolution warnings | model resolver and subagent auth diagnostics |
| 10 | `3e5b7da6f` | Added diagnostic headers to auth-gateway inference responses | auth gateway HTTP transport |
| 11 | `0ab90f63e` | Rotated through quota-limited accounts | auth retry, account selection, cooldowns |
| 12 | `7cef4a769` | Improved OAuth credential-resolution fallback | Codex account selection in auth storage |
| 13 | `c001d660e` | Claimed same-org rows through stored credential bases | org-scoped auth identity and usage cache |
| 14 | `1e8f183f4` | Claimed same-subscription rows across base identities | migrated org-only rows and broker migration |
| 15 | `fd122f7ea` | Rejected org-presence mismatches in both routing directions | remote auth broker matching |
| 16 | `e095af3be` | Required member identity within a shared org | report routing, overlays, and coverage |
| 17 | `45203a1b5` | Made org qualify rather than replace base identity | active account matching and row upgrades |
| 18 | `c2456d882` | Org-qualified account/project fallback identities | auth storage and broker routing |
| 19 | `3df97d509` | Separated broker refresh sentinels from row identity | org rotation and usage-cache regressions |
| 20 | `a47c3c90e` | Added org-decisive active matching and org-aware status caches | status line, logout, usage report |
| 21 | `bee01bfc4` | Carried org through OAuth access results | active-account and logout identity |
| 22 | `044d722a3` | Scoped Anthropic credential identity by organization | OAuth registry, broker schemas, usage routing |
| 23 | `7029789e7` | Cleared stale OAuth session stickies | auth storage selection and rotation |
| 24 | `5e781a9c7` | Clarified OAuth completion close behavior | OAuth callback UI and workflow notice |
| 25 | `3b6c3409e` | Hardened auth-storage schema handling | auth storage persistence schema |

## 주제 분석

이 클러스터는 여러 OAuth 계정을 안전하게 선택하고 갱신하는 전체 수명주기를 다룬다. 무효 토큰이나 quota 제한이 발생하면 다른 자격 증명으로 회전한다. 같은 제공자의 동시 refresh는 직렬화한다. refresh 도중 저장 행이 교체되어도 원래 대상으로 삼은 OAuth 행을 잃지 않게 한다.

조직 정보는 단순 표시값이 아니다. 같은 이메일이나 구독 기반 계정이라도 조직이 다르면 별도 자격 증명으로 취급해야 한다. 반대로 조직만으로 사용자를 동일인으로 간주해서도 안 된다. 이 구분은 브로커 라우팅, 현재 계정 표시, usage cache, logout 대상 모두에서 같은 규칙을 써야 한다.

로그인 UX와 보안 경계도 함께 바뀐다. paste-code fallback은 다이얼로그 입력 수명주기와 연결되어야 한다. Perplexity OAuth bearer는 API-key 엔드포인트로 흘러가면 안 된다. 저장 스키마는 부분 손상이나 이전 버전 데이터를 보수적으로 처리해야 한다.

## Worktree 대조

현재 JWC에는 `packages/ai/src/auth-storage.ts`, `packages/ai/src/auth-broker/`, `packages/coding-agent/src/modes/components/login-dialog.ts`가 존재한다. Perplexity는 OAuth/session bearer와 API key 경로를 모두 지원한다. 따라서 기본 표면은 갖춰져 있다.

다만 OMP의 org-scoped identity 연속 커밋은 한 함수가 아니라 저장 행 identity, 브로커 wire schema, usage cache, 상태 표시, logout까지 함께 잠그는 변경이다. JWC의 현재 로컬 수정과 겹치는 영역도 있으므로 카드 단계에서는 파일 존재만으로 동등 판정하지 말고, 동시 refresh, stale sticky, 조직 불일치, 같은 조직의 다른 사용자, paste-code, bearer 유출 방지 회귀를 계약 테스트로 대조해야 한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `376084c19` | feat(coding-agent/web): ensured proper cleanup of authentication storage | auth/OAuth/credential |
| 2 | `5c16dcb15` | fix(auth-broker): preserve config.yaml discovery | auth/OAuth/credential |
| 3 | `635687392` | fix(web-search): reuse supplied registry auth | auth/OAuth/credential |
| 4 | `aa470b9e3` | fix(coding-agent): forward sessionId to getApiKey in subagent auth fallback | auth/OAuth/credential |
| 5 | `b190a3c15` | fix(auth-broker): resolve nested auth.broker.url/token yaml keys | auth/OAuth/credential |
| 6 | `ebe79d6f5` | fix(mcp): retain DCR metadata fallback | auth/OAuth/credential |
| 7 | `fb9846592` | fix(mcp): preserved discovered registration endpoint | auth/OAuth/credential |
