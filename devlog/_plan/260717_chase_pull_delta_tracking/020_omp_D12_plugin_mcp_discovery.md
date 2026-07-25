# 020_omp_D12_plugin_mcp_discovery

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D12 — plugin, MCP, and skill discovery
> Sol priority: P2
> Model-related: no
> Card target: 20.064_plugin_mcp_discovery
> Worker: OW7

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `17a38cefa` | guard scoped plugin verb aliases | CLI command dispatch |
| 2 | `b16aa7a81` | refresh interactive skill commands | interactive mode; session skill state |
| 3 | `bf3764fa4` | stabilize prompt cache with delta notices | session prompt assembly; xdev notices |
| 4 | `0d0df064e` | limit cwd-based command rooting to Codex import | `packages/coding-agent/src/discovery/codex.ts` |
| 5 | `e88c45f06` | resolve plugin stdio commands against rooted cwd | discovery root substitution |
| 6 | `d6683c351` | root Codex TOML MCP command/cwd at config dir | Codex config discovery |
| 7 | `52f0d3f9e` | tolerate malformed plugin cwd | plugin discovery |
| 8 | `19674b8df` | reload runtime skill state | SDK/session/slash-command registry |
| 9 | `6467a3119` | root relative plugin MCP command and cwd | Claude/OMP plugin discovery |
| 10 | `2d519d8f8` | guard plugin tool renderers from crashes | tool-execution component |
| 11 | `8c387307e` | stabilize local-image MCP regression coverage | MCP tool argument tests |
| 12 | `cf4e510ac` | resolve bare skill URLs to directories | skill internal URL protocol |
| 13 | `a0a6949a4` | match stdio spawn overload for TCC | MCP stdio transport |
| 14 | `3ebcb3690` | thread local roots through startup tools | extension runner; SDK |
| 15 | `b097019fe` | resolve local image paths in MCP tool calls | MCP tool bridge; custom-tool context |

## 주제 분석

이 클러스터는 플러그인 설정 파일의 위치를 실제 실행 기준점으로 유지하는 문제를 다룬다. 상대 stdio command와 cwd는 프로세스 시작 위치가 아니라 plugin 또는 `config.toml` 디렉터리를 기준으로 해석한다. local root와 image path도 startup tool context까지 전달해 MCP 결과가 다른 세션 위치에서 깨지지 않게 한다.

skill 변경은 runtime state, slash command, system prompt cache를 함께 갱신해야 한다. 전체 prompt를 무조건 재생성하는 대신 delta notice로 mount 변화를 알리고, bare skill URL은 파일이 아닌 디렉터리 자원으로 해석한다. plugin verb alias와 renderer crash guard는 잘못된 플러그인 하나가 CLI 명령이나 전체 TUI를 장악하지 못하게 하는 방어선이다.

## Worktree 대조

JWC에는 `packages/coding-agent/src/discovery/codex.ts`와 새 `packages/coding-agent/src/extensibility/runtime-skill-discovery.ts`가 있다. 반면 OMP와 같은 `packages/coding-agent/src/mcp/` 디렉터리와 `xd://` delta-notice 구조는 없다. 현재 JWC의 MCP·plugin 책임은 discovery, extensibility, session, `internal-urls/local-protocol.ts`에 분산되어 있으므로 config-dir rooting과 local path 해석을 이 owner들에 맞춰 대조해야 한다. runtime skill refresh는 현재 dirty worktree 변경과 직접 겹치므로 구현 전에 기존 변경을 우선 보존해야 한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `2439f77e7` | fix(plugins): refreshed stale bun git cache before reinstall | plugin/MCP/discovery |
| 2 | `459682cc6` | fix(plugins): skipped invalid custom tool entries | plugin/MCP/discovery |
| 3 | `5a4a6670b` | feat(pi-walker): ignored parent rules that cover explicitly rooted walks | plugin/MCP/discovery |
| 4 | `7881fce97` | fix(plugins): preserved native commonjs helper loading | plugin/MCP/discovery |
| 5 | `a327992c8` | fix(lsp): sent initial workspace configuration | plugin/MCP/discovery |
| 6 | `b0d98d9e2` | fix(coding-agent): decoupled lsp diagnostics from tool execution | plugin/MCP/discovery |
| 7 | `b52c79802` | feat(coding-agent/discovery): set builtin discovery rules to interruptMode never | plugin/MCP/discovery |
