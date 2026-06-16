# Extensibility

> 확장 표면은 capability API가 중심이다. jaw brand(`jwc`)에서는 `~/.cli-jaw/skills` global root가 native user root를 대체하고, D5의 project-level 우선순위는 아직 미완이다.

## Capability / Source Path

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| native source paths | native user base는 `getConfigDirName()`, project dir는 `.jwc`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:28`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:36` |
| other provider paths | claude/codex/gemini/opencode/cursor 등 source path도 정의되어 있다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:38`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:43`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:53` |
| source metadata | provider/path/level을 `SourceMeta`로 만든다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:106` |

## Skills

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| skill shape | `name`, `description`, `filePath`, `baseDir`, `source`, `hide`, `_source`, embedded `content`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:13` |
| active snapshot | active session skills는 process-global `activeSkills`에 저장되고 `skill://` handler가 읽는다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:41`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:43` |
| native-only filter | `loadSkills()`는 jaw brand가 아니면 native `.jwc` source만 허용한다. jaw brand에서는 `cli-jaw`/`agents` provider도 활성화된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:124`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:142` |
| cli-jaw global root | jaw brand + `~/.cli-jaw/skills` 존재 시 native user root를 대체한다. 없으면 native user root fallback. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/cli-jaw.ts:4`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:129` |
| capability load | skills는 `loadCapability(skillCapability.id, {cwd})`로 수집된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:132` |
| source scan | project ancestor `.jwc/skills`와 user `~/.jwc/agent/skills`를 scan한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/builtin.ts:284`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/builtin.ts:286`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/builtin.ts:299` |
| collision | 같은 skill name이 이미 있으면 뒤 skill은 skip하고 warning을 쌓는다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:184`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:186` |
| custom directories | settings `customDirectories`는 provider `custom:user`로 별도 scan된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:111`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:204` |
| deterministic order | 최종 skills는 `compareSkillOrder`로 정렬된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:270` |

## Slash Commands

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| builtin registry | `BUILTIN_SLASH_COMMANDS`는 declarative registry를 completion/hint 함수로 materialize한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/slash-commands.ts:93`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/slash-commands.ts:97` |
| file slash command shape | `name`, `description`, `content`, `source`, `_source`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/slash-commands.ts:119` |
| capability load | file commands는 `loadCapability(slashCommandCapability.id, {cwd})`로 로드된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/slash-commands.ts:158`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/slash-commands.ts:162` |
| native scan | builtin provider는 config dirs의 `commands/*.md`를 scan한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/builtin.ts:325`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/builtin.ts:330` |
| active commands | builtin slash names include `settings`, `theme`, `goal`, `model`, `memory`, `provider`, `login`, `searchengine`, etc. `searchengine`는 [search.md](./30_providers.md) 참조. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/slash-commands/builtin-registry.ts:212`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/slash-commands/builtin-registry.ts:228`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/slash-commands/builtin-registry.ts:910` |
| `/help` 도킹 2-페인 카탈로그 (99.20.08) | 모델-셀렉터 문법의 docked 2-pane 선택기: builtin/skill/custom 탭 분할, enter로 커맨드 삽입. ACP는 plain 카탈로그 핸들. | `8e17a1ce` (99.20.08), `src/slash-commands/builtin-registry.ts` |
| 세션 슬래시 표면 (99.07.01) | `/fork [msg]`·`/branch`·`/resume <id>`·`/sessions`·`/switch`(alias). `AgentSession.fork()`는 큐 메시지 클리어. | `7fa8a9d0` (99.07.01) |
| `/model` 2-페인 키보드 (99.30.04 S7.1) | 화살표로 리스트 순환, space로 provider/model 페인 전환 복원. | `04132930` (99.30.04 S7.1) |

## Custom Tools

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| loader | custom tool loader는 Bun native import로 TS tool module을 로드한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/custom-tools/loader.ts:1`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/custom-tools/loader.ts:44` |
| declarative files | `.md`, `.json`은 executable module로 로드하지 않고 error 처리한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/custom-tools/loader.ts:32` |
| API injection | factory에는 cwd, exec, ui, logger, typebox, zod, `pi`가 들어간다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/custom-tools/loader.ts:99` |
| conflict detection | builtin names와 충돌하면 tool을 skip하고 error를 기록한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/custom-tools/loader.ts:121`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/custom-tools/loader.ts:135` |

## Hooks

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| loader | hook module은 default function을 export해야 한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:157`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:164`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:168` |
| API | hook API는 `on`, `sendMessage`, `appendEntry`, `registerMessageRenderer`, `registerCommand`, `exec`, `logger`, `typebox`, `zod`, `pi`를 제공한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:90`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:107`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:129`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:141` |
| discovery | hooks는 capability API discovery + explicit configured paths를 합쳐 로드한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:225`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:249`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/hooks/loader.ts:253` |

## Plugins

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| plugin manifest | plugin package manifest는 tools/hooks/extensions/commands/features/settings를 가질 수 있다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/plugins/types.ts:24`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/plugins/types.ts:35`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/plugins/types.ts:44` |
| installed plugin | installed plugin record는 name/version/path/manifest/enabledFeatures/enabled를 가진다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/plugins/types.ts:99` |
| plugin root | user root는 `getAgentDir()/gjc-plugins`, project root는 `<cwd>/.jwc/gjc-plugins` (디렉터리명은 legacy 내부 식별자). | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/gjc-plugins/paths.ts:6`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/gjc-plugins/paths.ts:10` |
| root discovery | root 또는 child dir에 plugin manifest가 있으면 plugin root로 인정한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/gjc-plugins/paths.ts:18`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/gjc-plugins/paths.ts:28` |
| extension load | extension loader는 native capability modules와 installed plugin extension paths를 합친다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/extensions/loader.ts:505`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/extensions/loader.ts:513` |

## MCP Runtime (격리 + 해제 배선)

> 공개 GJC 표면은 MCP 런타임 디스커버리를 **의도적으로 격리(quarantine)**한다. `createAgentSession`은
> 명시적으로 넘긴 `options.mcpManager`만 쓰고 직접 디스커버리하지 않는다. `main.ts`에서 CLI 경로에
> 한해 디스커버리를 켜는 배선을 추가했다(`0b493665`). 전체 조사: [`devlog/_plan/computer_use/`](../devlog/_plan/computer_use/00_moc_computer_use.md).

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| 격리 선언 | SDK가 MCP 런타임 디스커버리를 deprecated/ignored로 격리. project/user MCP config를 여기서 절대 디스커버 안 함. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:278`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1273` |
| 해제 배선 | `runRootCommand`가 `discoverAndLoadMCPTools(getProjectDir(), …)`로 manager를 만들어 `sessionOptions.mcpManager` + `customTools`로 주입. print 경로는 `sessionManager` undefined라 `getProjectDir()` 사용. `createTools()`가 manager를 참조 안 하므로 tool을 `customTools`로 명시 전달해야 모델이 봄. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/main.ts:41`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/main.ts:913` |
| config 스캔 | builtin discovery가 `{cwd}/.jwc/{mcp.json,.mcp.json}`(project) + `~/.jwc/agent/{mcp.json,.mcp.json}`(user)를 스캔. 등록은 읽히나 세션엔 위 배선으로만 물림. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/builtin.ts:205`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/builtin.ts:209` |
| startup 레이스 | `STARTUP_TIMEOUT_MS = 250`. 모든 서버 병렬 연결 후 `Promise.race([allSettled, delay(250)])`. 250ms 초과 + 캐시 없으면 abort. 가벼운 node 스크립트는 통과, 서명된 `.app`은 실패(닭-달걀). | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/manager.ts:60`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/manager.ts:459` |
| 스키마 정규화 | MCP 도구 스키마는 `normalizeSchemaForMCP`로 정규화되나 `$ref` 인라인(deref)은 안 함 → 깨진 `$ref`는 provider 400. cu-mcp는 소스에서 `$ref` 미발생하게 고침. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/tool-bridge.ts:234` |
| tool-cache | 서버별 도구 정의를 agent.db에 캐시해 다음 startup을 빠르게. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/tool-cache.ts` |

## Computer Use (cu-mcp)

> 데스크톱 제어는 모델 기능이 아니라 **MCP 서버**다. jwc는 위 격리 해제 + 외부 **cu-mcp** 서버 등록으로
> 데스크톱 제어를 self-serve한다(grok-4.3 실증). codex 번들 Sky(AX-트리)는 codex 부모 코드서명
> attestation으로 jwc에선 직접 구동 불가 — 방법론 비교는 [`computer_use/00_moc`](../devlog/_plan/computer_use/00_moc_computer_use.md).
> cu-mcp 소스: `~/developer/codex/23_computer_use/src/cu-mcp-server/`(별도 레포, Anthropic computer-use 표면 재구현, 좌표/스크린샷 기반).

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| 등록 | `jwc setup defaults`가 user 스코프 `~/.jwc/agent/mcp.json`에 managed defaults를 복구한다. managed default는 `context7`만 설치한다. 예전 exact managed `cua-driver` entry(`{ command: "cua-driver", args: ["mcp"] }`)는 cleanup 대상이며, env/cwd/args가 다른 사용자 커스텀 `cua-driver`/`computer-use` MCP 서버는 보존한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:197`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:211` |
| 서버 엔트리 | MCP stdio 서버(`@modelcontextprotocol/sdk`), 29 도구(mouse·keyboard·screenshot·scroll·app·clipboard·batch·utility·teach·inspect). | `~/developer/codex/23_computer_use/src/cu-mcp-server/src/index.ts`, `~/developer/codex/23_computer_use/src/cu-mcp-server/src/tools/*.ts` |
| 네이티브 제어 | `native.ts`가 `CU_NATIVE_PATH`(또는 `.build/release/cu-native`)의 Swift 바이너리를 `execFile`로 호출해 실제 마우스/키보드/스크린샷 수행. | `~/developer/codex/23_computer_use/src/cu-mcp-server/src/native.ts:12` |
| 결정론적 tier | `categoryToTier(getAppCategory(bundleId))`: 브라우저/trading=read, 터미널·IDE=click, media=차단, 그 외=full. `request_access` 부여 + 매 액션 `enforcePreAction`/`enforcePointUnderClick`로 서버에서 강제(모델 무관). | `~/developer/codex/23_computer_use/src/cu-mcp-server/src/safety/tiers.ts:35`, `…/src/safety/enforcement.ts`, `…/src/tools/app.ts:96` |
| 카테고리 리스트 | 브라우저/터미널/trading/media bundle-id 집합. | `~/developer/codex/23_computer_use/src/cu-mcp-server/src/safety/bundleIds.ts` |
| full-tier 오버라이드 | `CU_TIER_OVERRIDE=full`이면 `isFullTierOverride()`가 모든 카테고리(미디어 포함)를 full로. jwc는 `mcp.json`의 `env`로 켬(개인 사용). 기본값은 안전 tier 유지 → cli-jaw 멀티-프로바이더는 safe-by-construction. 시스템 키콤보(⌘Q 등)는 별개로 차단. | `~/developer/codex/23_computer_use/src/cu-mcp-server/src/safety/tiers.ts:25`, `…/src/safety/tiers.ts:36` |
| 단일 세션 락 | 머신당 1세션 락 `~/.claude/computer-use.lock`. | `~/developer/codex/23_computer_use/src/cu-mcp-server/src/safety/lock.ts` |
| Anthropic 표면 추종 | cu-mcp는 **Claude Code 내장 computer-use(`computer_20250124`)의 도구 표면을 정본**으로 따른다. 도구명·파라미터 타입·description을 Anthropic 표면에 맞추고, cu-mcp 전용 확장(inspect/ax_press/teach)은 상위 호환으로 추가. 주요 맞춤: `switch_display` 모니터 **이름**(string) 기반 / `screenshot`·`zoom`에 `save_to_disk` 파라미터(`/tmp/cu-mcp-screenshots/`) / `coordinate` description Anthropic 원문 / screenshot 응답에 멀티모니터 이름 안내 / auto 모드에서 frontmost 앱 디스플레이 자동 감지. | Claude Code `/mcp` 도구 스키마 대조 기준 |
| 통합 도구 모드 | cu-mcp-server는 수동 MCP 등록 시 `CU_MCP_MODE=consolidated`로 29개 도구 대신 **1개 `computer_use` 도구(action discriminator)** 를 등록할 수 있다. jwc managed default에서는 제거됨; 오래된 수동 `computer-use` entry의 시작 비용은 사용자가 mcp config에서 disable/remove로 제어한다. | `packages/cu-mcp-server/src/tools/consolidated.ts`, `packages/cu-mcp-server/src/index.ts` |
| built-in `computer_use` proxy | `ComputerUseTool`(`name=computer_use`, `loadMode=discoverable`)가 action discriminator로 MVP 액션을 `LazyCuaDriverBackend`(cua-driver Sky MCP, `command: cua-driver`, `args: ["mcp"]`)에 위임. 첫 호출 lazy connect; `registerSessionCleanup("computer_use.lazy_cua_driver", dispose)`. cu-mcp(수동 MCP)와 cua-driver(기본 proxy 백엔드)는 별개 경로. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/computer-use.ts:177`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/computer-use-backend.ts:9`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:342` |

도구 과노출 방지는 discovery/BM25 선택 계층에서 담당한다. Built-in `computer_use`는 discoverable tool로 노출되고, backend `cua-driver` 프로세스는 실제 호출 전까지 시작하지 않는다. 수동 MCP `computer-use`/`cua-driver` entry는 별도 advanced surface로 보존된다.

## D5와 현재 gap

| 목표 | 현재 코드 | gap |
|---|---|---|
| `~/.cli-jaw/skills` global 우선 | jaw brand에서 `cli-jaw` provider가 `~/.cli-jaw/skills`를 scan하고, 디렉터리가 있으면 native user root를 suppress한다. | project-level `.jwc/skills` vs global 우선순위, frontmatter 호환, collision override 세부는 D5 완료 전. 근거: `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/cli-jaw.ts:17`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:134` |
| cli-jaw embedded skill 공유 | jaw brand에서만 `cli-jaw`/`agents` provider skill surface가 활성화된다. | legacy upstream bin 경로에서는 native-only. M2 임베딩 시 brand detection/`customDirectories` 정책 재검토 필요. 근거: `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/extensibility/skills.ts:142`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/discovery/helpers.ts:106` |


---

# (merged) Bundled Workflow Skills (4종)


---

## Default Workflow Definitions

> jwc의 공개 workflow surface는 기본 4종 + **native IPABCD orchestration**(`jwc orchestrate`)이다.
> public alias는 `jaw-interview`, `plan`, `goal`, `team`이다. 공개 번들 스킬은 `defaults/jwc/skills/{jaw-interview,plan,team,goal}/SKILL.md`; CLI 호환 `jwc ralplan` / `jwc ultragoal`만 legacy 엔진 subcommand.

### Native orchestration (050 — 런타임 ✅ · discovery ✅ 99.03)

| 표면 | 동작 | 상태 |
|---|---|---|
| CLI | `jwc orchestrate <i\|p\|a\|b\|c\|d>`, `audit-prompt`, `status`, **`reset`** (99.07-U1: 어느 상태→idle, goal 불가침, --shared/--dry-run) | ✅ 구현 (`orchestrate-runtime.ts`) |
| interview CLI | `jwc interview cancel` | ✅ **99.07-U2** — 세션 스코프 상태 파일 삭제 + HUD inactive 동기화 (`jaw-interview-runtime.ts`) |
| Slash | `/orchestrate` (jaw brand only) | ✅ |
| State | `.jwc/state/sessions/<id>/pabcd-state.json` | ✅ `orchestrate-state.ts` |
| 전이 규칙 | **P 직행 1급화** — `i`는 `P`의 필수 선행이 아님(idle→P 직접 가능) | ✅ `2d3a14a8` (260613 실측) |
| 세션 스코프 | `JWC_SESSION_ID` env 자동 디폴트 — 전역 상태 오염 차단 | ✅ `8331c03b` (`orchestrate-runtime.ts`) |
| 상태 리더 폴백 | pabcd 상태 스코프→**공유 경로 폴백** (라이브 TUI HUD 띠/헤더 미표시 버그 수정) | ✅ `ac42e4f3` (`orchestrate-state.ts`·`workflow-readers.ts`) |
| Stage prompts | `prompts/jaw/orchestrate-*.md` — CLI stdout pull | ✅ |
| **모델 discovery** | `system-prompt.md`에 orchestrate/IPABCD | ✅ **99.03 M1** 완료 (`45cba4e2`) |
| **매 턴 단계 헤더** | `pabcd-stage-context` custom message | ✅ **99.03 M2** 완료 (`8a7ea342`) |
| dev-pabcd 스킬 | 글로벌 스킬 | jaw에서 **의도 차단** — native 표면으로 대체 |

레디니스: [status.md](./50_status.md) · 마감 맵: [status.md](./50_status.md).

### Public bundled workflow definitions (4종)

| Public workflow | 목적 | bundled source | 근거 |
|---|---|---|---|
| `jaw-interview` | IPABCD **I** — Socratic interview → `.jwc/specs/`; **99.30.02부터 핸드오프가 `jwc orchestrate p --spec-ref`로 재배선** | `defaults/jwc/skills/jaw-interview/SKILL.md` | `jwc-defaults.ts:17`, `8e17a1ce` |
| `plan` / `jwc orchestrate` | IPABCD/PABCD **P/A/B/C/D** — 합의 플래닝 정본 `jwc orchestrate p`·`jwc planphase`. public `/skill:plan`은 SUPERSEDED 호환(`defaults/jwc/skills/plan/SKILL.md`). | `defaults/jwc/skills/plan/SKILL.md` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:16`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md:12` |
| `goal` / `jwc goal` | Durable goal ledger → `.jwc/goal/` (`brief.md`, `goals.json`, `ledger.jsonl`). public `/skill:goal`은 `defaults/jwc/skills/goal/SKILL.md`. | `defaults/jwc/skills/goal/SKILL.md` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/goal-cli.ts`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md:16` |
| `team` | IPABCD **B** — tmux workers → `.jwc/state/team/` | `team/SKILL.md` | |

### 99.08 PABCD–goal 융합 (260613)

- **99.08-A** (`09f7fb20`): 매 턴 `pabcd-stage-context` 헤더(prompt_flow 레일 #4)에 현재 goal
  objective를 병기 — 단계 컨텍스트와 목표가 한 헤더에 같이 주입된다.
- **99.08-B** (`a771f492`): `jwc orchestrate` 전이가 일어날 때마다 goal 체크포인트를 자동 기록 —
  수동 `/goal` 호출 없이 단계 진행이 ledger에 남는다.
- 제어 모델: standalone PABCD의 기본은 **HITL**이다. P/A/B 같은 주요 전환은 사람이 승인한다.
  `jwc goal`이 활성화된 PABCD만 **HOTL**로 해석한다. 이때 에이전트는 checkpoint 증거를 남기며 계속 진행하고,
  사람은 진행을 지켜보다가 steer/pause/cancel로 개입한다.
- 근거: [prompt_flow.md](./20_prompt_flow.md) 99.03/99.08 표.

### Upstream baseline vs jwc runtime

| 계층 | upstream jawcode `[기본값]` | jwc runtime `[기본값]` | 호환 |
|---|---|---|---|
| bundled skill slug | `deep-interview` | `jaw-interview` | legacy skill alias accepted for state/read compatibility, not the public path |
| system prompt routing | `deep-interview` | `jaw-interview` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/system/system-prompt.md:63` |
| CLI subcommand | (upstream `deep-interview`) | `jwc interview` alias `deep-interview` — **jaw 브랜드 전용 등록**(D050-24/25 `jawOnlyCommands` 게이트; legacy upstream bin은 `/skill:jaw-interview` 경로만) | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts` `jawOnlyCommands` |
| persisted state slug | `deep-interview` (legacy) | write는 `jaw-interview` only | `normalizeWorkflowSkillSlug()` read-compat — `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/state-schema.ts:24`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/state-schema.ts:30` |

### Bundling / Load Contract

| 항목 | 현재 계약 | 근거 |
|---|---|---|
| default names | `["jaw-interview", "plan", "team", "goal"]` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:17` |
| embedded imports | 4개 `SKILL.md`와 fragment 3개가 TS import로 bundled 된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:7`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:92` |
| session invariant | explicit `options.skills`가 있어도 4 workflow skill을 보존한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1003`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:1019` |
| repo-visible `.jwc` defaults | commit하지 않는다. runtime user/project `.jwc` discovery는 지원한다. | `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:27`, `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:28` |

### Skill별 계약

| Public workflow | Pipeline / phases | Artifact 경로 | Gate 정책 | 근거 |
|---|---|---|---|---|
| `jaw-interview` | Phase 0 ambiguity threshold → Phase 1 initialize → Round 0 topology gate → Phase 2 interview loop → Phase 3 challenge agents → Phase 4 crystallize spec → Phase 5 execution bridge. | handoff `.jwc/specs/jaw-interview-{slug}.md`; legacy spec glob은 `{jaw-interview,deep-interview,deep}-*.md` 호환 읽기. | ambiguity threshold와 topology gate가 blocking prerequisite. 실행은 승인 전 금지. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md:7`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md:78`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jaw-interview/structured-renderer.ts:1` |
| `plan` / `jwc orchestrate` | native IPABCD/PABCD state machine: I(optional) → P → A → B → C → D. P can start directly without an interview spec when the request is already concrete. | `.jwc/plans/` planning artifacts + devlog plan refs. | source mutation waits for explicit approval unless already in approved goal-mode execution. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/jaw/orchestrate-p.md:1`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/commands/orchestrate.ts:23` |
| `goal` / `jwc goal` | `jwc goal` + inline `goal` tool; PABCD stage **transition**마다 **99.08-B** ledger checkpoint (active goal 시). | `.jwc/goal/` | completion cleanup and review gate가 mandatory. team과 함께 쓸 수 있음. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/goal-engine.ts`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts:399` |
| `team` | invocation contract → pre-context intake gate → runtime behavior → required lifecycle → commands/data/control planes. | `.jwc/state/team/`, mailbox/dispatch APIs, tmux panes. | pre-context intake gate, team-first launch contract, active leader monitoring rule. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md:37`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md:51`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md:97`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md:221` |

### Routing 규칙

| 상황 | 기본 workflow | 근거 |
|---|---|---|
| 명확하고 낮은 위험의 구현 | direct implementation | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/system/system-prompt.md:62` |
| intent/scope/acceptance criteria가 모호함 | `jaw-interview` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/system/system-prompt.md:63` |
| 요구사항은 충분하나 architecture/sequence/verification consensus 필요 | `plan` / `jwc orchestrate p` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/jaw/orchestrate-p.md:1` |
| durable goal ledger 필요 | `goal` / `jwc goal` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/goal-cli.ts:147` |
| 승인된 작업이 병렬 worker 이득을 봄 | `team` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/system/system-prompt.md:66` |

### jaw workflow 병합 상태

| 밴드 | 병합 대상 | 상태 | 근거 |
|---|---|---|---|
| 040 | `jaw-interview` (구 `deep-interview` + jaw Interview) | `[확정]` 구현 완료 | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/042_diff_jaw_interview.md:3` |
| 050 | `plan` + IPABCD/PABCD + orchestrate | 런타임 ✅ · discovery ✅ **99.03** | `status`, `050_plan/02_code_facts` |
| 060 | `goal` + `jwc goal` | 런타임 ✅ | `060_goal` |
| 030/050 | `team` + dispatch/PABCD | 대기 | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/05_interview_conclusions.md:12` |
