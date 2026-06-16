# C006: Install/Update Experience Gap — Jawcode vs cli-jaw

## 현상

cli-jaw는 `npm install -g cli-jaw` 한 줄로 전체 setup 완료 (postinstall이 홈 디렉토리, skills, MCP, Claude CLI, launchd 전부 처리). Jawcode 소스 빌드는 6줄 수동 작업.

## cli-jaw가 하는 것 (Jawcode에 없는 것)

| 기능 | cli-jaw | Jawcode |
|---|---|---|
| 홈 디렉토리 생성 | postinstall 자동 | `node bootstrap-cli-jaw-home.cjs` 수동 |
| Skills 복사/전파 | `copyDefaultSkills()` + `propagateSkillsToInstances()` | bootstrap이 clone |
| MCP 서버 설치 | `installMcpServers()` (context7 등) | 없음 |
| CLI 도구 설치 | `installCliTools()` (claude, grok 등) | 없음 |
| PATH 보장 | `ensureNpmGlobalBinOnUserPath()` | 없음 |
| WSL 감지 | Windows Node 경고 | 없음 |
| legacy 마이그레이션 | `~/.cli-jaw` → 커스텀 경로 | 없음 |
| safe mode | `JAW_SAFE=1` → 최소 설치 | 없음 |
| 업데이트 | `npm update -g` → postinstall 재실행 | `git pull` + 수동 6줄 |
| env flag 제어 | `CLI_JAW_SKIP_*`, `CLI_JAW_INSTALL_*` | `JWC_SKIP_CLI_JAW_BOOTSTRAP` 하나만 |

## 필요한 패치

### P1: 원커맨드 setup
root `package.json`에 `"setup"` 스크립트 추가:
```json
"setup": "bun install && node packages/jwc/scripts/bootstrap-cli-jaw-home.cjs && bun run install:defaults"
```
README/docs에서 `bun run setup` 한 줄로 축소.

### P2: bun install postinstall hook
워크스페이스 루트 `package.json`에 postinstall 추가:
```json
"postinstall": "node packages/jwc/scripts/bootstrap-cli-jaw-home.cjs --postinstall"
```
`bun install` 시 자동 bootstrap. `--postinstall` 플래그로 조용히 실행.

### P3: jwc update 명령 (또는 스크립트)
```json
"update": "git pull && bun install"
```
postinstall이 P2에서 연결되면 `bun install`이 자동으로 bootstrap 재실행.

### P4: bun install이 packages/jwc postinstall을 트리거하는지 확인
워크스페이스 구조에서 `bun install`이 하위 패키지의 `postinstall`을 실행하는지 검증 필요. 안 되면 루트에 hook 필요.

## 우선순위

- P1 (setup 스크립트): 즉시 — README 1줄 개선
- P2 (postinstall hook): 높음 — 자동화
- P3 (update): 중간 — P2가 되면 자연스럽게 해결
- P4 (검증): P2 전에 필요

## 서브에이전트 조사 결과

### P4 결과: bun install은 워크스페이스 멤버 postinstall을 트리거하지 않음
- npm은 자동 트리거 → npm install -g jawcode는 정상
- bun install은 루트 lifecycle만 실행 → 소스 빌드 시 bootstrap 안 됨
- 해결: root package.json에 `"setup"` 스크립트 추가

### 추가 발견
- npm postinstall도 `jwc setup defaults` 안 함 → bundled JWC skills (jaw-interview, plan, goal, team) 미설치
- `jwc update`가 이미 존재 (update-cli.ts) → 하지만 update 후 `setup defaults` 미실행 → stale skills
- `install:dev`는 link 단계가 있어 일반 유저에게 안 됨

### 최종 패치 스펙

| 파일 | 변경 |
|---|---|
| `package.json` | `"setup": "bun install && node packages/jwc/scripts/bootstrap-cli-jaw-home.cjs && bun packages/coding-agent/src/cli.ts setup defaults"` 추가 |
| `packages/coding-agent/src/cli/update-cli.ts` | 업데이트 성공 후 `setup defaults` 자동 실행 |
| `README.md` | source install → `bun run setup` 한 줄, update → `jwc update` 한 줄 |
| `docs-site installation.html` | 동일 |
| root package.json postinstall | 추가하지 않음 (CI/기여자 환경 오염 방지) |

### 추가 모순
- C006: `jwc update` docs에 defaults propagation 미언급
- C007: `install:dev`가 link 단계 사용 — 일반 유저 안내에 부적합
