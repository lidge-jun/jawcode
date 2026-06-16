# 01 — performance gap analysis

## 1. Confirmed incident root causes

### G1. CUA eager startup was stale user MCP config

Evidence:

- `packages/coding-agent/src/defaults/jwc/mcp-defaults.json` contains only `context7` managed default.
- `packages/coding-agent/src/defaults/jwc-defaults.ts` removes only the exact legacy managed `cua-driver` entry and preserves custom MCP entries.
- Built-in `ComputerUseTool` has `loadMode = "discoverable"` and owns a `LazyCuaDriverBackend`; `cua-driver mcp` is reached only through `execute()` → backend `call()` → `#ensureConnection()`.
- The live `/Users/jun/.jwc/agent/mcp.json` had `computer-use` and `cua-driver`; it has now been patched to `context7` only.

Status: **incident mitigated by config cleanup**. Source follow-up is generic MCP lifecycle cleanup, not CUA-specific deletion.

### G2. TUI render CPU: full logical frame and repeated text wrapping

Evidence:

- `packages/tui/src/tui.ts` renders the full uncommitted tree each frame, then expands viewport fill, applies line resets, truncates, and diffs.
- `packages/tui/src/components/text.ts` caches only exact `(text,width)` per Text instance; a streaming append invalidates the full text and re-runs `wrapTextWithAnsi`.
- `packages/tui/src/components/box.ts` renders children before Box cache comparison, so Box cache does not save child wrap/render cost.
- Live process samples show `pi_natives::text::wrap_text_with_ansi_c_callback`, `visible_width_u16_up_to`, Unicode segmentation, and allocator paths.

Impact: **high CPU**, especially with long tool output, assistant markdown, current live turn, and multi-session concurrency.

### G3. Tool collapsed/minimized paths still do hidden full work

Evidence:

- `ToolExecutionComponent.render()` minimized path calls `super.render(width)` solely to compute hidden line count before returning a two-line status summary.
- `createCollapsedPreview()` calls `truncateToVisualLines()` each render.
- `truncateToVisualLines()` renders the entire preview text to all visual lines through a shared `Text`, then slices the last N lines.
- `ReadToolGroupComponent` recreates preview components on updates; `renderCodeCell()` splits full content before slicing visible lines.

Impact: **very high avoidable CPU** while preserving exactly the same UX.

### G4. Assistant markdown / ctrl+t eager replay cost

Evidence:

- `AssistantMessageComponent.updateContent()` clears/rebuilds children and creates fresh Markdown instances on streaming updates, losing Markdown per-instance cache.
- `Markdown` has module/per-instance caches, but cache misses parse with `marked`, wrap rendered lines, and compute width for tables/quotes/code.
- `FullTranscriptOverlayComponent` in session mode materializes all transcript lines before slicing bottom viewport.
- ctrl+t opens at bottom, but line generation is still whole-history eager.

Impact: **high CPU/RSS on large history or streaming markdown**, especially with rich transcript rendering.

### G5. Session resume RSS and duplicated materialization

Evidence:

- `SessionManager.open(filePath)` full-loads JSONL to find `cwd`, then initializes a manager that loads the same file again.
- `setSessionFile()` full-loads, migrates, resolves blob refs, externalizes resident entries, sanitizes replay metadata, and rebuilds indexes.
- Instance `buildSessionContext()` and `buildVisibleTranscriptContext()` call `getEntries()`, which materializes all non-header entries, not only the active branch.
- `sdk.ts` calls `buildSessionContext()` and then immediately `getBranch()` for flags, causing redundant branch materialization.

Impact: **high RSS and startup CPU** on large sessions, especially with abandoned branches or large tool outputs.

### G6. Token counting hot path

Evidence:

- Live sample for one `jwc` process showed `count_tokens_c_callback`, rayon iterator, tiktoken `CoreBPE`, and regex work.
- Current gap analysis did not finish a full callsite inventory; this needs a separate P2 lane.

Impact: **medium-to-high CPU** during prompt/context rebuilds; correctness risks differ from TUI render cache, so keep separate.

### G7. Tool registry / MCP schema payload

Evidence:

- `createTools()` with no allowlist materializes all allowed built-ins before SDK later filters active tool names for discovery mode.
- MCPTool/DeferredMCPTool constructors normalize full MCP `inputSchema` immediately.
- Tool/schema byte-size instrumentation is missing.

Impact: **startup heap/prompt-cache churn**, lower confidence than TUI/session gaps until measured.

## 2. Confidence / impact ranking

| Rank | Gap | Confidence | Impact | First patch type |
|---:|---|---|---|---|
| 1 | Tool minimized/collapsed hidden full render | High | High CPU | Safe code patch |
| 2 | TUI live text full rewrap / prepared line repeated width work | High | High CPU | Measurement + safe caches |
| 3 | Session open/context duplicate materialization | High | High RSS/CPU | Safe staged refactor |
| 4 | Assistant streaming markdown child rebuild | High | Medium-high CPU | Safe component reuse |
| 5 | ctrl+t full transcript eager materialization | Medium-high | Medium-high CPU/RSS | Lazy tail render, more tests |
| 6 | MCP cleanup ownership | Medium-high | Zombie/process hygiene | Safe lifecycle patch |
| 7 | Tool registry/schema materialization | Medium | Startup heap | Instrument first |
| 8 | Token counting repeat work | Medium | Medium-high CPU | Separate inventory/cache plan |

## 3. Gaps that are not primary culprits

- **Long-term memory backend:** current live settings leave memory off; memory DB is tiny. Hardening later, not incident root.
- **Managed CUA defaults:** already context7-only; config cleanup fixed eager CUA.
- **Terminal write volume alone:** diff/viewport repaint reduce terminal I/O, but hot samples are pre-render text work.
