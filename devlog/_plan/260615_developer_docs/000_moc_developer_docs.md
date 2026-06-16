# Developer Documentation Site — 50+ Pages Full Reference

## 배경

Jawcode 공개 배포 전 마지막 폴리싱. 접이식 사이드바 기반 50+ 페이지 개발자 문서.
docs/, structure/, prompts/tools/, struct_har/ 전수 조사 완료.

## 전수 조사 결과

| 소스 | 파일 수 | 라인 수 | 공개 가능 | 내부 전용 |
|---|---|---|---|---|
| docs/ | 82 | 16,041 | 76 | 6 |
| structure/ | 10 | 2,330 | 7 (편집 필요) | 3 |
| prompts/tools/ | 45 | ~4,500 | 38 (API ref 소스) | 7 |
| struct_har/ | ~20 | ~5,000 | 0 (비교 분석) | 전체 |
| **합계** | **157** | **~28,000** | **121** | **36** |

### 발견된 모순
1. `docs/sdk.md` — `@gajae-code/coding-agent` 참조, 공개 npm은 `jawcode`
2. `docs/REBRANDING_PLAN_260525.md` — red-claw 기본이라 기술, 실제는 abyss-bite
3. `docs/grok-build-provider-design.md` — owner sign-off 미완료
4. `docs/brand-assets.md` — hero.png/character.png 참조, 실제 docs-site는 다른 로고

## 문서 구조 (15 카테고리, 55 페이지)

### 001–009: Getting Started
```
001 Installation (npm / bun / source / binary)
002 Quick Start (first session, basic commands)
003 CLI Reference (flags, env vars, modes)
004 Environment Variables
005 Troubleshooting
```

### 010–019: Architecture
```
010 Architecture Overview (8 packages + 1 crate)
011 Package Map (ai, agent, coding-agent, tui, natives, utils, stats, jwc)
012 Agent Loop (turn cycle, tool dispatch, streaming)
013 Prompt Assembly Pipeline (Handlebars, system prompt sections)
014 Compaction & Context Management
015 Binary Build (compile targets, worker entrypoints)
```

### 020–029: IPABCD Workflow
```
020 Workflow Overview (IPABCD pipeline, stage gates)
021 Interview Stage (jaw-interview, ambiguity scoring)
022 Plan Stage (critic consensus, plan format)
023 Audit Stage (planner + architect dual audit)
024 Build Stage (executor dispatch, verifier)
025 Check Stage (mechanical gates, adversarial review, 3-way reject)
026 Done Stage (summary, WONDER+REFLECT)
027 Human Control Model (HITL vs HOTL)
028 Goal Mode (durable execution ledger)
029 Team Mode (tmux-backed workers)
```

### 030–039: Tools Reference
```
030 Tools Overview (essential vs discoverable, tool discovery)
031 File System Tools (read, find, search, write)
032 Edit Tools (edit, ast_grep, ast_edit)
033 Execution Tools (bash, eval, browser, debug, computer_use)
034 Orchestration Tools (task, subagent, background, monitor, job)
035 Workflow Tools (goal, skill, resolve, checkpoint, rewind)
036 Code Intelligence (lsp, github)
037 Web & Media (web_search, inspect_image, generate_image, render_mermaid)
038 Utility Tools (ask, todo_write, irc, ssh, calc, recipe, cron)
039 Tool API Reference (schema, parameters, return types per tool)
```

### 040–044: Providers & Models
```
040 Providers Overview (46 providers, discovery, dynamic models)
041 Provider Setup Guide (API keys, OAuth, custom providers)
042 Model Configuration (model selector, profiles, wireModelId, [1m] variants)
043 Model Cache & Discovery (models.db, preferDiscoveryLimit, reference maps)
044 Search Providers (Tavily, Exa, Brave, SearXNG, web_fetch)
```

### 045–049: Subagent System
```
045 Subagent Overview (fork/spawn/resume, async execution)
046 Executor & executor_ext (fork semantics, model routing)
047 Architect, Planner, Critic (read-only audit agents)
048 Correction De-anchoring Protocol (3+ hypotheses, bias mitigation)
049 Prompt Cache Architecture (static/dynamic boundary, cache-aware spawning)
```

### 050–054: TUI & Themes
```
050 TUI Architecture (differential renderer, viewport model)
051 Welcome Banner (gradient sweep, JAW_FIN_LOGO)
052 Theme System (abyss-bite, custom themes, theme JSON schema)
053 Keybindings (ctrl+j panel, full transcript, model selector)
054 Background Footer Panel (bg rows, ctrl+j expand)
```

### 055–059: Configuration
```
055 Configuration Reference (config.yml, all settings)
056 Settings Schema (typed settings, UI tabs, defaults)
057 Auth Setup (API keys, OAuth, Bedrock, Vertex)
058 Identity & Personalization (name, emoji, vibe, language)
059 Project Rules (.jwc/, AGENTS.md, dir-context)
```

### 060–064: SDK & Embedding
```
060 SDK Overview (jawcode/sdk, createAgentSession)
061 SDK API Reference (session options, tool registration)
062 cli-jaw Integration (embedding surface, managed Bun)
063 Bridge & RPC (remote control protocol)
064 MCP Server Mode
```

### 065–069: Performance
```
065 Performance Overview (Bun-native, prompt caching, streaming)
066 Prompt Caching (static/dynamic boundary, cache statistics)
067 Compaction (auto-compact, microcompact, continuation summary)
068 Native Bindings (Rust grep, text processing)
069 Profiling Guide (perf corpus, flame graphs)
```

### 070–074: Security
```
070 Security Overview (OWASP awareness, prompt injection defense)
071 Blast Radius & Reversibility (destructive action policy)
072 Auth & Credentials (OAuth flow, API key safety)
073 Sandbox & Permissions (tool allowlists, bash restrictions)
074 Reporting Vulnerabilities
```

### 075–079: Extending
```
075 Skills System (bundled skills, custom skills, skill discovery)
076 Slash Commands (built-in, custom registration)
077 Custom Tools (tool factory, discoverable tools)
078 MCP Integration (MCP servers, runtime discovery)
079 Hooks & Plugins (lifecycle hooks, extension points)
```

### 080–084: Contributing
```
080 Contributing Guide (code quality, conventions, gates)
081 Development Setup (bun install, defaults, typecheck)
082 Testing Guide (test rules, fixtures, verification)
083 Naming Conventions (jwc/gjc, rebrand surface)
084 Fork Delta & Upstream Sync
```

### 085–089: Reference
```
085 Lineage (gajae-code, oh-my-pi, cli-jaw)
086 Changelog
087 Project Status & Roadmap
088 Glossary (IPABCD terms, agent roles)
089 FAQ
```

## devlog 번호 체계

| 번호대 | 용도 |
|---|---|
| 001–099 | 문서 작성 계획/인벤토리/의사결정 devlog |
| 100+ | PABCD 구현 사이클 — API gap 발견 시 보고용, docs 수정하지 않음 |

## 기술 결정

| 결정 | 선택 |
|---|---|
| 사이트 프레임워크 | 정적 HTML (현재 docs-site/ 확장) |
| 사이드바 | 접이식 좌측 사이드바, JS 토글 |
| 콘텐츠 소스 | 기존 docs/+structure/ 재구성 + 코드에서 새로 추출 |
| i18n | EN 메인 + KO 토글 (기존 i18n.js 재사용) |
| API 레퍼런스 | prompts/tools/*.md에서 파라미터/반환값 추출 |
| 페이지당 라인 수 | 200–500줄 (읽기 적정) |

## Phase

- [x] 001: 전수 조사 (5 서브에이전트 병렬)
- [x] 002: 55페이지 구조 설계
- [ ] 003: PABCD P-stage (계획)
- [ ] 100+: 구현 사이클
