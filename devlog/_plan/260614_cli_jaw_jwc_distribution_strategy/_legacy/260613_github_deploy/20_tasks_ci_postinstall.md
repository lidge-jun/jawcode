# 20 — Tasks 040-069: CI 파이프라인 + postinstall

## 040-049: CI 파이프라인

현재: `ci.yml`(Linux self-hosted) + `dev-ci.yml`(dev 브랜치). **darwin 러너 없음**.

| # | 제목 | 설명 | 복잡도 |
|---|---|---|---|
| 040 | ci-darwin-check | `macos-14`(arm64) job → `bun install --frozen-lockfile` → biome + tsc | M |
| 041 | ci-darwin-test-smoke | darwin arm64 smoke → `--version`, `--help`, `--smoke-test` | S |
| 042 | ci-darwin-x64-secondary | `macos-15-intel` 미러, continue-on-error (non-blocking) | S |
| 043 | ci-cu-mcp-build-verify | `packages/cu-mcp-server/` tsc 빌드 → `dist/index.js` 존재 확인 | S |
| 044 | ci-gate-job | `jaw-state-gates` required status check (gjc 패턴 미러) | S |
| 045 | ci-bun-cache | bun 의존성 캐시 키 표준화 (`bun-$OS-$hash(bun.lock)`) | S |
| 046 | ci-test-scope | 845 테스트 중 darwin에서 pass하는 범위 결정, native 의존 테스트 게이트 | M |
| 047 | ci-blocker-rs-addon | `@gajae-code/natives` .node prebuilt arm64 only → 크로스컴파일 문서화 | M |
| 048 | ci-workflow-dispatch | `workflow_dispatch` input `skip_tests` (긴급 우회) | S |
| 049 | ci-dev-ci-darwin | `dev-ci.yml`에 darwin job 추가 | S |

## 060-069: postinstall / --safeinstall

cli-jaw 패턴 참조: `scripts/postinstall-guard.cjs` (CommonJS, zero-dep, safe-mode)

| # | 제목 | 설명 | 복잡도 |
|---|---|---|---|
| 060 | postinstall-guard.cjs | CommonJS entry — Node 버전 체크, safe-mode exit, dist-or-build fallback | S |
| 061 | safeinstall env flag | `JAW_SAFE=1` / `npm_config_jaw_safe=1` → exit 0 즉시 | S |
| 062 | platform-detect | `process.platform === 'darwin'` 게이트 — non-darwin은 warn + skip | S |
| 063 | tmux-install | `which tmux \|\| brew install tmux` — non-fatal | S |
| 064 | cua-driver-install | `which cua-driver \|\| curl install script` — darwin only, timeout 60s, non-fatal | S |
| 065 | cu-mcp-tsc-build | `packages/cu-mcp-server/dist/index.js` 없으면 tsc 실행 | S |
| 066 | cu-native-verify | `bin/cu-native` stat + executable bit 확인 — warn if missing | S |
| 067 | postinstall-entry | root `package.json`에 `"postinstall": "node scripts/postinstall-guard.cjs"` | S |
| 068 | postinstall orchestrator | `src/bin/postinstall.ts` → 063-066 순차 실행 | M |
| 069 | postinstall-ci-skip | `CI=true` → brew/curl 스킵, tsc + binary verify만 | S |
| 070 | cli-jaw-skills-setup | `~/.cli-jaw/skills` 디렉터리 생성 + 기본 스킬 symlink/복사. jwc가 jaw brand일 때 이 경로를 global skill root로 사용(`discovery/cli-jaw.ts:25`). 없으면 native user root(`~/.jwc/agent/skills`) fallback이지만 cli-jaw 임베딩 시 필수 | S |
| 071 | mcp-json-template | `~/.jwc/agent/mcp.json` 기본 템플릿 생성 (빈 `mcpServers: {}`). 없으면 MCP discovery가 user-scope 설정 없이 동작 — CU 등 선택적 서버 등록 안내 | S |
| 072 | settings-json-template | `~/.jwc/agent/settings.json` 기본 템플릿 생성 (`mcp.enableProjectConfig: true` 등). 없으면 기본값 사용되지만 명시적 설정 권장 | S |
| 073 | natives-addon-verify | `@gajae-code/natives` .node 로드 확인. arm64 only prebuilt → non-arm64 darwin에서 경고 + graceful degrade. hard dep라 실패 시 core 기능(grep/PTY/clipboard) 불가 | S |
| 074 | first-run-hint | `~/.jwc/agent/` 없거나 provider 미설정 시 `/provider add` 안내 출력. `model-onboarding-guidance.ts` 연계 | S |
| 075 | skill-deps-opt-in | 스킬 의존성(uv, playwright-core 등) 선택적 설치. `JWC_INSTALL_SKILL_DEPS=1` env로 opt-in (cli-jaw 패턴) | S |

| 076 | jwc-setup-defaults | `jwc setup defaults` 실행 — 기본 워크플로 스킬(jaw-interview/ralplan/ultragoal/team) 설치. `installDefaultJwcDefinitions` (idempotent, `--force` overwrite). **핵심 postinstall 액션** | S |
| 077 | bun-version-check | `bun --version >= 1.2.14` 확인 — 미달 시 hard fail + 설치 안내. jwc는 bun-native (`bun:sqlite`, `bun build --target=bun`) | S |

**Note**: task 068 (orchestrator)에서 `mkdir -p ~/.jwc/agent/` 선행 필수.

**Sonnet 5건 감사 결론**:
- DB (agent.db/history.db/github-cache.db): 전부 auto-init → postinstall 불필요
- Auth: 수동 (`/provider add` 또는 env var) → task 074에서 안내 출력
- Natives: hard dep, arm64 only → task 073에서 검증/경고
- Runtime dirs: `~/.jwc/agent/` 이하 전부 lazy mkdir → 명시적 생성은 편의 (task 068)
- 스킬: `jwc setup defaults`가 핵심 → task 076
