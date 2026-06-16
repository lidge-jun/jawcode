# 10 — 전수조사 결과: 외부 의존성·머신 종속 경로

> Sonnet 3건 병렬 감사 (260613). jawcode + cli-jaw + cu-mcp 대상.

## 요약

| 대상 | 소스 코드 | 런타임 설정 | 배포 블로커 |
|---|---|---|---|
| **jawcode** | ✅ 깨끗 (`/Users/jun` 없음) | ⚠️ `~/.jwc/agent/mcp.json` 절대경로 3건 | MCP config만 |
| **cli-jaw** | ✅ 완전 깨끗 (`os.homedir()` 기반) | ✅ | 없음 |
| **cu-mcp-server** | ✅ 상대경로 (`__dirname` 기반) | ⚠️ cu-native 바이너리 경로 | 모노레포 이동 시 경로 조정 |

## jawcode 소스 (packages/) — 깨끗 ✅

`/Users/jun` 하드코딩 **0건**. runtime-mcp의 spawn/exec은 레지스트리 패턴 매칭이지 경로 참조가 아님.
테스트 파일의 `/Users/test/...` 등은 의도된 fixture.

## jawcode 런타임 설정 — MUST FIX 3건

`~/.jwc/agent/mcp.json` (repo 밖, runtime config):

| # | 경로 | 문제 | 해결 |
|---|---|---|---|
| 1 | `/Users/jun/.nvm/versions/node/v24.14.1/bin/node` | NVM node 절대경로 | `node` (PATH 의존) 또는 `process.execPath` |
| 2 | `/Users/jun/developer/codex/23_computer_use/src/cu-mcp-server/dist/index.js` | 별도 레포 절대경로 | **모노레포로 이동** → 상대경로 |
| 3 | `/Users/jun/.local/bin/cua-driver` | 외부 바이너리 절대경로 | `cua-driver` (PATH) 또는 `${CUA_DRIVER_PATH}` |

devlog의 `~/developer/codex/...` 참조는 문서 전용 — 런타임 영향 없음 (acceptable).

## cli-jaw — 깨끗 ✅

- `lib/mcp/format-converters.ts`: 모든 경로 `os.homedir()` + `join()` — 포터블
- 소스·프롬프트·structure: `/Users/jun` 0건
- `package.json`: `file:`/`link:` 의존 0건
- **GitHub 배포 블로커 없음**

## cu-mcp-server 이식 감사

### 의존성 (가벼움)
- runtime: `@modelcontextprotocol/sdk ^1.29.0` + `zod ^3.24.0`
- dev: `typescript ^5.8.0` + `tsx` + `@types/node`

### 호환성 이슈

| 항목 | cu-mcp | jawcode | 대응 |
|---|---|---|---|
| **zod** | `^3.24.0` | 카탈로그 `4.4.3` | zod v4로 업그레이드 또는 별도 pin |
| **typescript** | `^5.8.0` | `^6.0.3` | 패키지별 tsconfig 유지 (이미 있음) |
| **module** | `Node16` | `ESNext/Bundler` | 패키지별 tsconfig 유지 |
| **MCP SDK** | `^1.29.0` | 카탈로그에 없음 | 카탈로그 추가 |

### cu-native 바이너리 전략

`native.ts`의 경로 해석: `resolve(__dirname, "..", "..", "cu-native", ".build", "release", "cu-native")`
→ 형제 디렉터리 `cu-native/` 가정. 모노레포 이동 시 깨짐.

**Option A (권장): prebuilt binary** — `packages/cu-mcp-server/bin/cu-native`로 복사,
`native.ts` fallback을 `resolve(__dirname, "..", "bin", "cu-native")`로 변경.
`CU_NATIVE_PATH` env override는 이미 있음. jawcode가 이미 `@gajae-code/natives`에서 같은 패턴 사용.

**Option B: build-from-source** — Swift 소스를 `packages/cu-native/`로 복사, prebuild 스크립트.
Xcode 필요, CI 복잡. 비권장.

### 이동할 파일

```
codex/23_computer_use/src/cu-mcp-server/src/     → packages/cu-mcp-server/src/
codex/23_computer_use/src/cu-mcp-server/package.json
codex/23_computer_use/src/cu-mcp-server/tsconfig.json
cu-native/.build/release/cu-native               → packages/cu-mcp-server/bin/cu-native
```

### package.json 변경

1. `@gajae-code/cu-mcp-server` (또는 unscoped)로 리네임
2. zod 버전 결정
3. `@modelcontextprotocol/sdk` 카탈로그 추가
4. root `workspaces.packages`에 추가
5. `native.ts` fallback 경로 수정
6. `"files": ["dist", "bin"]` 추가

### 예상 공수: **Small–Medium**

- 파일 복사 + workspace 연결: ~15분
- cu-native 경로 수정: ~5분
- zod v3→v4: ~30분 (API 호환성 확인)
- E2E 테스트: ~20분
- **유일한 리스크**: zod v3→v4 마이그레이션

## cua-driver — Optional External

cua-driver는 **외부 바이너리**(`~/.local/bin/cua-driver`, trycua/cua 설치 스크립트).
jwc에 패키징하지 않고 **optional peer dependency** + 설치 가이드로 처리:

- `mcp.json`에서 `cua-driver` → PATH 기반 (`"command": "cua-driver"`)
- 설치 안 돼 있으면 해당 MCP 서버만 실패 (cu-mcp는 독립 작동)
- README에 설치 명령어 문서화
