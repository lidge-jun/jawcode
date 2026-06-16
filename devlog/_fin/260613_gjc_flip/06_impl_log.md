# 06 — 실행 로그 (260613 밤)

| 단계 | 상태 | 검증 |
|---|---|---|
| F1 디렉터리 플립 (jwc-runtime·jwc-plugins·defaults/jwc·jwc-defaults·embedded:jwc·test/jwc-runtime + 파일 2종) | ✅ | tsc 0 · 관련 440 pass |
| F2 심볼 리네임 (Gjc→Jwc 88파일 · GajaeCode→Jawcode · 소문자 camel 12종 14파일) | ✅ | tsc 0 · brand/identity 420 pass |
| F3 receipt/CLI 계약 (owner jwc-* 쓰기 + gjc-* read-both 4사이트 · goals.json 필드 jwc* + 레거시 폴백 · CLI 문구 `jwc …` 버그픽스 · cmdref verb) | ✅ | state/goal 스위트 503 pass |
| F4 런타임 코드값 (stop-reason `jwc_*` · ACP `_jwc/` 별칭(+`_gjc/` 유지) · worker/rpc/launch 기본 커맨드 `jwc`) | ✅ | acp/tmux/team 게이트 green |
| F5 테스트/스크립트 인프라 (테스트 파일 12종+픽스처 2디렉터리+scripts 6종 리네임 · `check:jwc-ui` · ci-jwc-state-gates exit 0) | ✅ | check:jwc-ui 0 · ci-gates 0 |
| F2.5 SCREAMING 상수 (CANONICAL_JWC_WORKFLOW_SKILLS 등 6종 23파일) | ✅ | tsc 0 |
| F6 전체 검증 | ✅ | 하단 표 |

## F6 검증 결과

| 패키지 | 결과 |
|---|---|
| coding-agent | **5,590+ pass / 356 skip / 잔여 fail 전부 기존-입증** (stash 대조: skills×4 · editor-component · hook-editor · bash-acp · brand-compat no-op · settings-memory×2 · redesigned-shell×2 · btw-escape · local-query) |
| tui | 478 pass 0 fail |
| utils | 90 pass 0 fail |
| ai | 1,286 pass 0 fail (http-inspector 2건은 기존 실패 — jwc 기대값으로 갱신해 해소) |
| check:jwc-ui · rebrand-inventory --strict · ci-jwc-state-gates | 전부 exit 0 |
| tsc | 전 패키지 0 에러 |

플립 중 회귀로 판정된 것은 전부 같은 세션에서 수정 (cmdref 스크립트명 테스트 참조 2건 · doctor fix-hint ·
launch fallback 단언 · IME/escape 목 갭). **커밋 없음** — 워킹트리 상태로 사용자 검수 대기.

## 잔여 (연기 명단은 05 §연기 그대로)

- 사용자 검수 → 커밋 분할 (F1~F5 단위 권장)
- CI job명·release artifact·bins — 브랜치 보호/설치 호환 확인 후 별도
