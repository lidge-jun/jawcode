# 20 — 2차 전수조사: 외부 바이너리·설정 하드코딩·외부 레포 참조

> Sonnet 3건 병렬 (260613). jawcode 전체 대상.

## 결론

**cu-mcp가 유일한 런타임 외부 의존이었고, 내부화 완료**. 소스 코드는 깨끗.
`~/.jwc/agent/mcp.json`의 하드코딩도 전부 해소 (`node` PATH + 상대경로 + cwd fallback).

## 외부 바이너리 의존 전수 목록

| # | 바이너리 | 용도 | 필수/선택 | 배포 리스크 |
|---|---|---|---|---|
| 1 | **bun** | 런타임·패키지 관리 | 필수 | CRITICAL — 설치 필요 |
| 2 | **git** | worktree·커밋 | 필수 | CRITICAL — 기본 설치 |
| 3 | **tmux** | 멀티 에이전트 병렬 세션 | team 모드 필수 | HIGH — single-agent는 무관 |
| 4 | **cu-native** (Swift, arm64) | CU MCP 네이티브 제어 | CU 사용 시 필수 | ✅ prebuilt `bin/` 동봉 (darwin-arm64 only) |
| 5 | **@gajae-code/natives** (Rust N-API) | grep·PTY·clipboard·토큰 | 필수 | ✅ prebuilt `.node` 동봉 (darwin-arm64). 다른 arch는 cargo 빌드 필요 |
| 6 | **gh** (GitHub CLI) | PR·이슈 | 선택 ($which 게이트) | LOW |
| 7 | **just/task/make/cargo** | recipe runner | 선택 ($which 게이트) | LOW |
| 8 | **swiftlint** | Swift 린팅 | 선택 | LOW |
| 9 | **lspmux** | LSP 멀티플렉서 | 선택 (fallback 있음) | LOW |
| 10 | **python3** | eval·setup | 선택 | LOW |
| 11 | **cua-driver** | 백그라운드 CU | 선택 | LOW — 설치 가이드 |

**CRITICAL**: bun + git (사실상 모든 dev 머신에 있음)
**HIGH**: tmux (team 모드)
**나머지**: 전부 선택적, $which 게이트로 graceful skip

## 설정 파일 하드코딩

| 파일 | git 추적 | 문제 | 해결 |
|---|---|---|---|
| `~/.jwc/agent/mcp.json` | ❌ (user config) | ~~`cwd` 하드코딩~~ → **해소** (cwd 필드 제거, `getProjectDir()` fallback) | ✅ |
| `~/.jwc/state/**/*.json` | ❌ (.gitignored) | 런타임 생성 절대경로 | 무시 — 런타임 생성 |
| test fixtures (harmony-leak 등) | ✅ | 캡처된 세션 데이터 내 예시 경로 | 무시 — inert data |

## 외부 레포 참조

| 참조 | 위치 | 런타임 영향 | 대응 |
|---|---|---|---|
| `~/developer/codex/...` | devlog `_plan/computer_use/` 15건 | ❌ docs only | 허용 |
| `~/Developer/codex/hermes-agent/` | devlog 참조 | ❌ docs only | 허용 |
| struct_har → `_upstream_gjc/` | 레포 내부 | ❌ self-contained | 무시 |

**런타임 외부 레포 참조: 0건**
