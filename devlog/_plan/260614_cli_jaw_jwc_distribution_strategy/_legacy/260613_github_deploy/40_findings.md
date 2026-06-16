# 40 — Findings 100+: 구조적 취약점·기술 부채·dev 스킬 위반

> 작업(000-099) 중 발견된 문제를 기록. 해결은 별도 스프린트/세션에서.
> 분류: 100-119 토큰/성능 | 120-139 타입/빌드/의존 | 140-159 코드 품질 | 160-179 보안/안정성 | 180-199 DX/온보딩

---

## 100-119: 토큰·성능·리소스

### 100 — MCP Tax: 빌트인 도구 35개 = ~30K 토큰

**발견**: jwc 35개 빌트인 도구를 매 턴 전부 로드 → ~30K. Claude Code는 ~12K (deferred).
**영향**: 1M 컨텍스트의 3% 낭비.
**dev 스킬**: AGENTS.md §7 "MCP Tax".
**해결안**: `tools.discoveryMode = "all"` → read/bash/edit/write만 로드(~8K).

### 101 — MCP 격리 해제 배선이 무조건 실행

**발견**: `main.ts:911`의 `discoverAndLoadMCPTools`가 매 세션 무조건 실행. MCP config에 서버 있으면 스키마 전부 로드.
**영향**: 의도 없이 MCP 서버 등록 시 토큰 낭비.
**해결안**: per-server `discoverable: true` 플래그로 세분화.

### 102 — 단일 세션 락 경합 (cu-mcp)

**발견**: `~/.claude/computer-use.lock` 머신당 1세션. jwc + Claude Code 동시 CU 시 한쪽 차단.
**영향**: 멀티 에이전트 CU 직렬화 강제.
**해결안**: per-session 락 또는 cua-driver 전환 시 해소 (cua-driver는 락 없음).

---

## 120-139: 타입 안전성·빌드·의존성

### 120 — cu-mcp-server zod 3 vs jawcode catalog zod 4

**발견**: cu-mcp-server `"zod": "^3.24.0"`, jawcode catalog `zod: 4.4.3`. API breaking change.
**영향**: 크로스 패키지 스키마 공유 시 런타임 에러 (latent).
**해결안**: cu-mcp-server를 zod 4 마이그레이션.

### 121 — cu-native prebuilt binary: arm64 only

**발견**: `bin/cu-native`가 Mach-O arm64만. Intel Mac(darwin-x64)에서 crash.
**영향**: Intel Mac 사용자 CU 불가.
**해결안**: universal binary 또는 arch 감지 graceful skip.

### 122 — args double-cast 정당화 미비

**발견**: `consolidated.ts:539`에 `args as unknown as Input`. MCP SDK가 `Record<string,unknown>` 타입이라 필요하지만 주석 없음.
**dev 스킬**: §7.3 escape hatch requires comment.
**해결안**: 1줄 주석 추가.

---

## 140-159: 코드 품질·dev 스킬 위반

### 140 — consolidated.ts 파일 길이 542줄

**발견**: dev 스킬 §1 hard limit 500줄 초과 (8%).
**해결안**: handler를 `handlers/` 디렉터리로 분할.

### 141 — consolidated.ts magic numbers 6개

**발견**: `quality: 0.75`, `maxWidth: 1568`, `outWidth: 1200` 등 인라인.
**dev 스킬**: §6 "magic numbers → named constants".
**해결안**: `SCREENSHOT_QUALITY` 등 named constants 추출.

---

## 160-179: 보안·안정성·외부 SPI

### 160 — cua-driver SkyLight SPI 안정성 위험

**발견**: cua-driver가 macOS private SPI 8종 사용. 특히 `SLPSPostEventRecordTo`(248바이트, 문서화 안 됨)와 `_AXObserverAddNotificationAndCheckRemote`(`_` prefix)는 OS 업데이트에 깨질 수 있음.
**영향**: macOS 메이저 업데이트 후 백그라운드 CU 불가 가능.
**해결안**: `HERMES_CUA_DRIVER_VERSION` 고정 + OS 업데이트 후 검증.

---

## 180-199: DX·온보딩·설정

### 180 — ~/.jwc/agent/mcp.json은 repo 밖

**발견**: MCP 서버 설정이 user config(repo 밖). clone해도 파일 없어서 CU 안 됨.
**영향**: onboarding friction.
**해결안**: postinstall에서 기본 mcp.json 템플릿 생성, 또는 `.jwc/mcp.json`에 기본 설정.

### 181 — jwc 설치 시 ~/.cli-jaw/skills 세팅 누락

**발견**: jwc(jaw brand)는 `~/.cli-jaw/skills`를 global skill root로 사용 (`discovery/cli-jaw.ts:25`).
이 디렉터리가 없으면 native user root(`~/.jwc/agent/skills`)로 fallback하지만, cli-jaw 임베딩 시 스킬
공유가 안 됨. postinstall에서 이 경로 생성 + 기본 스킬 링크가 누락.
**영향**: jwc만 설치한 사용자가 cli-jaw 스킬을 못 씀.
**해결안**: postinstall에서 `~/.cli-jaw/skills` 디렉터리 생성 + 기본 스킬 symlink (task 070).

### 182 — ~/.jwc/agent/ 런타임 설정 파일 부재

**발견**: `mcp.json`, `settings.json`이 repo 밖 user config. clone 후 파일이 없어서
MCP 서버 등록, discoveryMode 등 설정이 기본값으로만 동작.
**영향**: onboarding friction — 문서 읽고 수동 생성해야 함.
**해결안**: postinstall에서 기본 템플릿 생성 (task 071, 072).

### 183 — natives addon: hard dep, arm64 only prebuilt

**발견**: `@gajae-code/natives`는 grep/PTY/clipboard/토큰카운팅의 hard dependency. 로드 실패 시 즉시 throw (fallback 없음). prebuilt는 `darwin-arm64`만 커밋. `linux-x64/arm64`, `darwin-x64`, `win32-x64` 지원하지만 prebuilt 없음 — cargo + napi-rs 빌드 필요.
**영향**: Intel Mac / Linux 사용자는 Rust 툴체인 설치 후 빌드해야 jwc 사용 가능.
**해결안**: CI에서 멀티 arch prebuilt 생성 + GitHub Releases 배포, 또는 postinstall에서 cargo 빌드 시도.

### 184 — 첫 실행 시 provider 안내 없음 (README/postinstall)

**발견**: jwc 첫 실행 시 provider 미설정이면 `model-onboarding-guidance.ts`가 에러 메시지로 안내하지만, README에 첫 실행 섹션 없고 postinstall에서도 안내 안 함.
**영향**: 사용자가 "jwc 깔았는데 안 됨" 경험.
**해결안**: README에 Quick Start 섹션 (task 020) + postinstall first-run hint (task 074).

### 185 — 35개 도구 중 대부분 미사용

**발견**: `recipe`, `irc`, `render_mermaid`, `ssh` 등 대부분의 턴에서 안 쓰이는 도구가 항상 로드.
**영향**: 토큰 낭비 + 모델 도구 선택 혼란 가능.
**해결안**: discoveryMode 활성화 (100번과 연결) 또는 프로파일별 도구 세트.
