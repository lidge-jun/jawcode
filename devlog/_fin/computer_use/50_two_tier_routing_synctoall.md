# 50 — 2-tier CU 라우팅 + cli-jaw syncToAll 최신화

> 상태: ✅ **구현 완료** (cli-jaw `d78f0d62`). syncToAll 8타깃 + codex cu-mcp 제외 + claude 경로
> 수정 + 프롬프트 2-tier 재작성 + 빌드. 사용자 — "codex면 Sky, 나머지는 cu-mcp 활성화. 프롬프트에
> '정밀 AX 조작은 control(codex) 직원 경유, 아니면 내장 도구' 규칙을 박는다. syncToAll도 손봐야 한다
> (grok은 자동, kiro만)."

## 한 줄 결론

두 CU 표면은 **기능이 달라** 깔끔하게 갈린다 — **Sky(codex 전용, AX-트리)** vs **cu-mcp(나머지 전부,
좌표/스크린샷, parent 요구 없음)**. cli-jaw에는 이미 통합 MCP를 7개 프로바이더에 전파하는 `syncToAll`이
있으니, **cu-mcp 한 줄 등록 + 라우팅 규칙**만으로 비-codex 전부가 데스크톱 제어를 self-serve할 수 있다.
단 `syncToAll`이 **2026-05-30 이후 미수정**이라 엔진 명단과 어긋나 있어 **선결 보정**이 필요하다(kiro 누락).

## 왜 codex와 나머지가 갈리나 (실제 능력 경계)

| | Sky (codex 전용) | cu-mcp (나머지 전부) |
|---|---|---|
| 방식 | AX-트리 + `element_index` 요소 단위 | 스크린샷 → 비전 → 픽셀 좌표 |
| 정밀도/견고성 | 높음(레이아웃 변해도 요소로 잡음) | 낮음(좌표 의존, 포그라운드 한정) |
| parent attestation | **필요**(team 2DC432GLL2 = codex 트리, [20](./20_methodology_b_codex_sky_app.md)) | **없음**(모델 무관) |
| 가용 프로바이더 | codex 경유만 | claude·grok·gemini·cursor·opencode·kiro·jwc 등 |

→ 사용자가 제안한 라우팅("정밀 AX → control 직원 / 그 외 → 내장 도구")은 임의 정책이 아니라 **이 능력
경계를 그대로 옮긴 것**.

## cu-mcp의 결정론적 안전 정책 (서버측)

cu-mcp는 **모델과 무관하게 서버에서 강제**되는 tier 정책을 갖는다(`safety/enforcement.ts`의
`enforcePreAction` → frontmost 앱 검사 → allowlist):

- 브라우저 = **read**(클릭/타이핑 차단), 터미널·IDE = **click**(클릭만), 그 외 = **full**
- 모든 액션 전 `request_access` 필요, 미승인 앱이 frontmost면 `NOT_IN_ALLOWLIST` 거부

비-codex에게 CU를 풀어줘도 자유낙하가 아니라 **safe-by-construction** — 2-tier 설계의 핵심 근거.

## cli-jaw syncToAll 현황 (2026-05-30 마지막 수정)

`lib/mcp/format-converters.ts:141 syncToAll`이 통합 MCP를 **7개 글로벌 경로**에 전파:

| # | 타깃 | 경로 | 포맷 | 컨버터 |
|---|---|---|---|---|
| 1 | Claude | `~/.mcp.json` | JSON `mcpServers` | `toClaudeMcp` |
| 2 | Codex | `~/.codex/config.toml` | TOML `[mcp_servers.*]` | `toCodexToml`/`patchCodexToml` |
| 3 | Gemini | `~/.gemini/settings.json` | JSON `mcpServers` | `toClaudeMcp` |
| 4 | OpenCode | `~/.config/opencode/opencode.json` | JSON `mcp` | `toOpenCodeMcp` |
| 5 | Copilot | `~/.copilot/mcp-config.json` | JSON `mcpServers` | `toClaudeMcp` |
| 6 | Cursor | `~/.cursor/mcp.json` | JSON `mcpServers` | `toClaudeMcp` |
| 7 | Antigravity | `~/.gemini/antigravity/mcp_config.json` | JSON `mcpServers` | `toClaudeMcp` |

### 엔진 명단 대조 (`src/agent/args.ts`)

엔진: agy · claude · claude-e · ai-e · codex · cursor · kiro-code · gemini · grok · codex-app · opencode.

| 엔진 | sync 커버 | 비고 |
|---|---|---|
| claude/copilot/cursor/gemini/opencode/antigravity(agy) | ✅ | 직접 타깃 |
| codex / codex-app | ✅ | `~/.codex/config.toml` 공유 |
| **grok** | ✅ **자동** | grok이 `~/.cursor/mcp.json`(#6)을 compat로 스캔(`GROK_CURSOR_MCPS_ENABLED` 기본 on, grok 문서 07-mcp-servers.md:181). **별도 타깃 불필요** — 사용자 확인. config.toml > Claude > Cursor > .mcp.json 우선순위로 머지됨 |
| **kiro-code** | ❌ **누락** | sync 타깃 없음 → **추가 필요** |

`results` 객체(`:142`)도 7키 하드코딩(claude/codex/gemini/opencode/copilot/antigravity/cursor) — kiro 자리 없음.

## 적용안 (4단계)

### 1. syncToAll 최신화 — kiro 타깃 추가 + claude 경로 검증

- **kiro 타깃 추가**: 경로 `~/.kiro/settings/mcp.json`, 포맷 **JSON `mcpServers`**(`.example`의
  `"mcpServers": {}` 블록으로 확정). **`toClaudeMcp` 재활용** 가능. `results`에 `kiro: false` 추가.
  - 파일 없으면 생성할지/스킵할지는 codex(존재 시만 patch) 방식과 통일 권장.
- **grok**: 조치 없음(cursor-compat 자동). 단 사용자가 `GROK_CURSOR_MCPS_ENABLED`를 끄면 끊기므로
  주석으로 "grok은 #6 cursor compat 경유" 명시 권장.
- **claude 경로 검증** ⚠️: syncToAll #1은 `~/.mcp.json`(홈, 124B)에 쓴다. 그러나 Claude Code
  user-scope MCP 정설은 `~/.claude.json → mcpServers`(루트 `CLAUDE.md` §7, 실측 263KB·mcpServers 보유).
  홈의 `~/.mcp.json`은 표준 프로젝트 컨벤션(cwd 기준)이라 **claude/claude-e가 user-scope로 읽는지 미검증**.
  → 실측: `jwc/claude run` 계열이 어느 파일을 읽는지 확인 후, 안 읽으면 #1 타깃을 `~/.claude.json`
  패치로 교체(기존 263KB 내용 보존 머지 필수).

### 2. codex 타깃에 cu-mcp 제외 분기 (Sky 중복 방지)

codex는 번들 Sky(`computer-use@openai-bundled`)를 이미 가짐. syncToAll이 `~/.codex/config.toml`(#2)에
cu-mcp까지 쓰면 **도구 두 벌**(Sky 10 + cu-mcp 29)로 혼선·이름 충돌 위험.
→ `computer-use` 서버는 **codex 타깃 sync에서 제외**(Sky만 유지), 나머지 6개 타깃에만 전파.
구현: `toCodexToml`/`patchCodexToml` 호출 전 `config`에서 `computer-use` 키 필터 또는 타깃별 allowlist.

### 3. cu-mcp를 통합 MCP에 등록 → 전파

cli-jaw 통합 MCP(`loadUnifiedMcp`/`saveUnifiedMcp`, `JAW_HOME/mcp.json`)에 `computer-use` 엔트리 추가:

```jsonc
{ "mcpServers": { "computer-use": {
  "command": "<node-abs-path>",
  "args": ["<.../cu-mcp-server/dist/index.js>"] } } }
```

→ `syncToAll`로 claude/gemini/cursor/opencode/copilot/antigravity(+grok 자동, +kiro 신규)에 전파.
**전제**: 해당 머신에 cu-mcp가 빌드돼 있어야 함(별도 레포, `$ref` 픽스 + `cu-native` 바이너리 —
[10](./10_methodology_a_cu_mcp_reimpl.md)). 배포 표준화는 미해결(아래 결정점 3).

### 4. 프롬프트 2-tier 게이트 재작성

현재는 "codex-only(+jwc)" 게이트([40](./40_cli_jaw_gate.md)). 이를 **능력 기반 2-tier**로:

- **일반 데스크톱 조작** → 내장 cu-mcp self-serve (cu-mcp 보유 직원: codex/jwc/claude/grok/gemini/cursor/…)
- **정밀 AX-트리 / 요소 단위 / 백그라운드 견고성 요구** → **control 직원(codex) dispatch**(Sky 경유)

대상: `src/prompt/templates/employee.md`·`a1-system.md`·`orchestration.md`. 라우팅 분기 문구에
"AX-트리 정밀도 필요 여부"를 1차 판정 기준으로 추가.

## 결정점 (논의 필요)

1. **claude 타깃 경로** — `~/.mcp.json` vs `~/.claude.json` 어느 쪽을 claude/claude-e가 실제 읽는가.
   (검증 후 #1단계 확정)
2. **단일 세션 락** — cu-mcp는 `~/.claude/computer-use.lock`로 머신당 1세션. cli-jaw가 두 직원에게
   동시 CU 지시 시 경합 → **직렬화** 정책 필요.
3. **cu-mcp 배포** — 로컬 빌드 의존(미커밋, 별도 레포). syncToAll `command` 절대경로 표준화 방법
   (패키징/설치 스크립트/경로 탐지) 미결.
4. **"control 직원" 라벨** — codex를 control-tier로 명시하는 역할 라벨 신설 vs 기존 라우팅에 조건만 추가.
5. **IDE/터미널 가드** — cu-mcp는 IDE·터미널을 click-tier로 막음. cli-jaw IDE 자동화 의도 시 충돌(의도된
   안전선으로 판단).
   - **jwc 결정**: 개인 사용이므로 jwc는 `CU_TIER_OVERRIDE=full` env로 **전부 full**(브라우저·터미널·
     미디어 포함). env 게이트라 기본값은 안전 tier 유지 → cli-jaw 멀티-프로바이더는 **그대로 안전 tier**로
     두는 게 정합적(다른 모델들이 같은 무제한 권한을 공유하면 리스크가 모델 수만큼 곱해짐). 상세
     [10](./10_methodology_a_cu_mcp_reimpl.md) §full-tier 오버라이드. ✅ 적용·검증.

## Deferred: 좌표 정밀도 개선

비-Claude 모델(GPT-5.5, grok 등)의 비전 좌표 추론이 부정확해 클릭이 빗나감. 실증(260613):
GPT-5.5가 디시 글쓰기 페이지에서 `left_click` 성공했으나 좌표가 의도한 필드와 살짝 어긋남.

**이미 있는 인프라**: 그리드 오버레이(`cu-native drawGrid --grid N`), 비전 보정 계수(`est:N` 1.56x/1.97x),
AX semantic press(`ax_press` — 좌표 없이 요소 직접 조작), 커서 프리뷰(`cmdPreview`), 그리드 줌(`cmdGridZoom`).
이들은 CLI skill(`computer-use.mjs`)에 연결돼 있으나 **MCP 도구로는 미노출**.

**가장 효과적인 미구현: Set-of-Mark(SoM)** — AX 트리 요소 열거 → 스크린샷 이미지에 번호 바운딩 박스
그려서 반환 → 모델이 **번호만 지정** → 서버가 정확한 중심 좌표로 변환. 순수 JS(`inspect` 재활용 +
`sharp`로 이미지 오버레이). 모델이 픽셀 좌표를 읽을 필요가 아예 없어짐.

cli-jaw 2-tier 연계: cu-mcp(Tier 1) 정밀도 보상이 중요해지면 SoM 먼저 구현.
codex Sky(Tier 2)는 AX-트리 기반이라 좌표 정밀도 문제 자체가 없음.

## 근거

| 영역 | 위치 |
|---|---|
| syncToAll 7타깃 | `cli-jaw/lib/mcp/format-converters.ts:141-235` |
| 마지막 수정 | `2026-05-30 fe1d2db3 feat(ui): MCP settings page` |
| 엔진 명단 | `cli-jaw/src/agent/args.ts:172-300` |
| grok compat 스캔 | `~/.grok/docs/user-guide/07-mcp-servers.md:181-186` |
| kiro mcpServers | `~/.kiro/settings/mcp.json`(`.example:5` `"mcpServers": {}`) |
| claude 정설 경로 | 루트 `CLAUDE.md` §7 (`~/.claude.json → mcpServers`) |
| cu-mcp tier enforcement | `cu-mcp-server/src/safety/enforcement.ts` `enforcePreAction` |
