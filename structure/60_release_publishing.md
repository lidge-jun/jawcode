# Release & Publishing Guide

> 2026-06-16 기준. `jawcode` npm 패키지 + `@jawcode-dev/*` scope.

## 패키지 구조

| npm 패키지 | 소스 | 역할 | publish 여부 |
|---|---|---|---|
| `jawcode` | `packages/jwc/` | CLI bin `jwc`, managed Bun bootstrap, bundle | ✅ public |
| `@jawcode-dev/natives` | `packages/natives/` | Rust N-API addon (grep, ast-grep, PTY, shell) | ✅ public |
| `@jawcode-dev/ai` | `packages/ai/` | Multi-provider LLM client | ❌ workspace-only |
| `@jawcode-dev/agent-core` | `packages/agent/` | Agent runtime | ❌ workspace-only |
| `@jawcode-dev/coding-agent` | `packages/coding-agent/` | Main CLI impl | ❌ workspace-only |
| `@jawcode-dev/tui` | `packages/tui/` | Terminal UI | ❌ workspace-only |
| `@jawcode-dev/utils` | `packages/utils/` | Shared utils | ❌ workspace-only |
| `@jawcode-dev/stats` | `packages/stats/` | Usage dashboard | ❌ workspace-only |

## npm org & scope

- **npm org**: `@jawcode-dev` (https://www.npmjs.com/org/jawcode-dev)
- `@jawcode` org는 사용 불가 — unscoped `jawcode` 패키지가 이미 존재하여 npm이 동명 org 생성을 차단
- Trusted Publishing (OIDC)은 `jawcode` 패키지에만 설정됨 (repo: `lidge-jun/jawcode`, workflow: `release.yml`)

## 2FA 설정

npm 2FA가 `auth-and-writes`이면 **매 publish마다 OTP 필요**. 자동화하려면:

```sh
npm profile set enable-2fa auth-only
```

이후 publish에 OTP 안 물어봄. 로그인/토큰 생성에만 OTP 필요.

## Release 절차

### 1. 버전 범프

모든 workspace 패키지 version 동기화:

```sh
# 모든 패키지 버전 범프 (benchmarks, jawcode-compat 제외)
for f in packages/*/package.json; do
  name=$(grep '"name"' "$f" | head -1 | sed 's/.*: "//;s/".*//')
  case "$name" in *benchmark*|jawcode-compat) continue ;; esac
  sed -i '' 's/"version": "OLD"/"version": "NEW"/' "$f"
done

# Root catalog 버전도 동기화
# package.json → workspaces.catalog 아래 @jawcode-dev/* 버전

# G002 gate 업데이트
# scripts/verify-g002-gates.ts → ALLOWED_PUBLIC_PACKAGE_VERSIONS
```

### 2. Bundle 빌드

```sh
bun --cwd=packages/jwc run bundle      # jwc.bundle.js + sync-worker.js
bun --cwd=packages/jwc run build:node   # dist-node/sdk.js (Node SDK)
```

**주의**: bundle은 빌드 시점의 소스를 인라인함. 브랜딩, 프롬프트, 설정 변경 후 반드시 재빌드.

### 3. Natives 빌드 (cross-platform)

#### CI 빌드 (권장)

```sh
gh workflow run build-natives.yml --ref main
```

타겟:
- `darwin-arm64` (macos-14)
- `linux-x64-baseline` + `linux-x64-modern` (ubuntu-22.04)
- `win32-x64-baseline` + `win32-x64-modern` (windows-2022)
- `darwin-x64-baseline` (macos-13) — runner 느림, 필요 시만

빌드 후 artifact 다운로드:

```sh
gh run download <run-id> --dir /tmp/natives-artifacts/
cp /tmp/natives-artifacts/*.node packages/natives/native/
```

#### 로컬 빌드 (현재 플랫폼만)

```sh
bun --cwd=packages/natives run build
```

### 4. Version Sentinel

Rust N-API addon에 `__piNativesV{major}_{minor}_{patch}` sentinel 함수가 있음:

- 정의: `crates/pi-natives/src/lib.rs` — `#[napi(js_name = "__piNativesV1_0_4")]`
- 체크: `packages/natives/native/loader-state.js` — `versionSentinelExport`

**sentinel은 native ABI가 변경될 때만 범프**. patch-level 패키지 버전 범프 (바이너리 동일)는 loader의 sentinel을 고정:

```js
// loader-state.js
const versionSentinelExport = `__piNativesV1_0_4`;  // pinned to binary ABI version
```

**sentinel 불일치 시**: `.node` 로드 성공하지만 `__piNativesVX_Y_Z` export 없어서 throw. 에러 메시지: "version sentinel ... The .node file on disk is from a different release than this loader".

### 5. Publish

```sh
# natives 먼저 (jwc가 optionalDependencies로 참조)
cd packages/natives && npm publish --access public --tag latest

# jawcode
cd packages/jwc && npm publish --access public --tag latest
```

### 6. Branch sync

```sh
# main = dev (publish 커밋 포함)
git checkout main && git reset --hard dev && git push origin main -f

# preview = main
git checkout preview && git reset --hard main && git push origin preview -f

# dev 한 커밋 앞으로
git checkout dev
echo "# $(date +%s)" >> .dev-marker && git add .dev-marker
git commit -m "chore(dev): dev marker" && git push origin dev
```

## 트러블슈팅

### `bun install` 시 `blocked by minimum-release-age`

`bunfig.toml`에 `minimumReleaseAge = 259200` (3일). 새로 publish한 패키지는 3일 후 자동 해결.

CI에서 우회:
```sh
sed -i 's/minimumReleaseAge = 259200/minimumReleaseAge = 0/' bunfig.toml
bun install
```

### `Cannot publish over the previously published versions`

이미 해당 버전이 npm에 존재. 버전 범프 필요.

### `npm error EOTP` / `one-time password`

2FA가 `auth-and-writes` 모드. `npm profile set enable-2fa auth-only`로 변경.

### Windows: `no prebuilt binary for win32-x64`

`@jawcode-dev/natives`에 win32-x64 .node 바이너리 미포함. `build-natives.yml` CI로 빌드 후 재publish.

### Windows: version sentinel 불일치

`.node` 바이너리의 sentinel과 loader의 sentinel이 다름. `crates/pi-natives/src/lib.rs`의 `js_name`과 `loader-state.js`의 `versionSentinelExport`가 일치하는지 확인.

### `zsh: killed jwc`

npm 글로벌 설치된 `jwc`가 crash. `bun install -g jawcode@latest`로 재설치하거나 workspace에서 직접 실행:
```sh
bun packages/coding-agent/src/cli.ts
```

### 브랜딩 "GJC forge" / "Gajae forge" 표시

`packages/jwc/dist/jwc.bundle.js`가 오래된 빌드. `bun --cwd=packages/jwc run bundle` 후 재publish.

## Native 플랫폼 지원 현황

| Platform | Arch | Status |
|---|---|---|
| darwin | arm64 | ✅ 로컬 빌드 + CI |
| darwin | x64 | ⚠️ CI only (macos-13 runner 느림) |
| linux | x64 (baseline) | ✅ CI |
| linux | x64 (modern/AVX2) | ✅ CI |
| win32 | x64 (baseline) | ✅ CI |
| win32 | x64 (modern/AVX2) | ✅ CI |
| linux | arm64 | ❌ 미지원 |
| win32 | arm64 | ❌ 미지원 |

Graceful degradation: natives 로드 실패 시 hard crash 대신 warning + stub proxy. 실제 native 기능 호출 시 throw.
