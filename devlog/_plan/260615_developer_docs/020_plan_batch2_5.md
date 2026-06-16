# Plan — Developer Docs Batches 2–5 (Pages 020–089)

## Strategy

Batch 1 인프라 완성됨. 나머지 44페이지를 4 배치로 B-stage 서브에이전트 병렬 작성.
sidebar.html은 각 배치 후 업데이트. 같은 HTML 템플릿 + CSS 재사용.

## Batch 2: IPABCD Workflow (10 pages)

```
docs-site/docs/workflow/
├── overview.html          # IPABCD 파이프라인 개요
├── interview.html         # I-stage 상세
├── plan.html              # P-stage 상세
├── audit.html             # A-stage 상세
├── build.html             # B-stage 상세
├── check.html             # C-stage 상세
├── done.html              # D-stage 상세
├── human-control.html     # HITL vs HOTL
├── goal-mode.html         # jwc goal 상세
└── team-mode.html         # jwc team 상세
```

Source: `structure/21_extensibility.md` §workflows, `docs/tools/task.md`, goal/team prompts, README workflow section.

## Batch 3: Tools + Providers + Subagents (15 pages)

```
docs-site/docs/tools/
├── overview.html          # essential vs discoverable, tool discovery
├── filesystem.html        # read, find, search, write
├── editing.html           # edit, ast_grep, ast_edit
├── execution.html         # bash, eval, browser, debug, computer_use
├── orchestration.html     # task, subagent, background, monitor, job
├── workflow-tools.html    # goal, skill, resolve, checkpoint, rewind
├── code-intelligence.html # lsp, github
├── web-media.html         # web_search, inspect_image, generate_image
├── utility.html           # ask, todo_write, irc, ssh, calc, recipe, cron
└── api-reference.html     # full parameter/return schema per tool

docs-site/docs/providers/
├── overview.html          # 46 providers, discovery
├── setup.html             # API keys, OAuth, custom
├── model-config.html      # selector, profiles, wireModelId, [1m]
├── cache-discovery.html   # models.db, preferDiscoveryLimit
└── search-providers.html  # Tavily, Exa, Brave, SearXNG
```

Source: `packages/coding-agent/src/prompts/tools/*.md`, `structure/30_providers.md`, `docs/models.md`.

## Batch 4: Subagents + TUI + Config + SDK + Perf (10 pages)

```
docs-site/docs/subagents/
├── overview.html          # fork/spawn/resume
├── executor.html          # executor + executor_ext
├── reviewers.html         # architect, planner, critic
├── de-anchoring.html      # correction protocol
└── cache-architecture.html # prompt cache-aware spawning

docs-site/docs/tui/
├── architecture.html      # renderer, viewport
└── themes.html            # abyss-bite, custom themes

docs-site/docs/config/
├── reference.html         # all settings
└── auth.html              # API keys, OAuth

docs-site/docs/sdk/
└── overview.html          # jawcode/sdk, createAgentSession
```

Source: `structure/22_session_storage.md`, `structure/31_scroll.md`, agent prompts, `docs/auth-broker-gateway.md`.

## Batch 5: Security + Extending + Contributing + Reference (9 pages)

```
docs-site/docs/security/
├── overview.html          # OWASP, blast radius
└── permissions.html       # tool allowlists, bash restrictions

docs-site/docs/extending/
├── skills.html            # bundled + custom skills
├── mcp.html               # MCP integration
└── hooks.html             # lifecycle hooks, plugins

docs-site/docs/contributing/
├── guide.html             # code quality, gates
└── development.html       # setup, testing

docs-site/docs/reference/
├── lineage.html           # gajae-code, oh-my-pi, cli-jaw
└── glossary.html          # IPABCD terms, agent roles
```

Source: `structure/11_conventions.md`, `structure/40_fork-delta.md`, `docs/hermes-mcp-bridge.md`, AGENTS.md.

## 수용 기준

1. 44 new HTML pages total across 4 batches
2. sidebar.html updated with all categories populated (no "Coming soon")
3. All pages use shared template + doc-layout.css
4. 100_contradictions.md updated with any new findings
5. All committed and pushed to dev

## 서브에이전트 할당 (B-stage)

Batch 2: 2 executors (5+5 pages)
Batch 3: 3 executors (5+5+5 pages)
Batch 4: 2 executors (5+5 pages)
Batch 5: 2 executors (5+4 pages)
