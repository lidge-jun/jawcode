# 06 — executor investigation receipts

This file records the parallel lanes dispatched for the performance incident. The detailed receipts remain in the agent artifacts from this session.

| Lane | Agent ref | Role | CPU/RSS verdict |
|---|---|---|---|
| TUI render core | `agent://10-PerfTuiRenderCore` | Render pipeline, committed/live line handling, text cache boundaries | CPU-first: full uncommitted frame and text preparation dominate before terminal diffing |
| Tool preview / ctrl+o | `agent://11-PerfToolPreview` | Tool collapsed/minimized rendering and read previews | CPU-first: minimized/collapsed paths still render hidden content; safe high-impact fix |
| Assistant markdown / ctrl+t | `agent://12-PerfAssistantMarkdown` | Streaming assistant content, Markdown, transcript overlay | CPU-first: child rebuild and eager transcript line generation; some RSS side-effect |
| Session resume | `agent://13-PerfSessionResume` | JSONL open/load/materialization, branch/context building | Mixed: startup CPU and RSS from duplicate full-load/materialization |
| MCP lifecycle | `agent://14-PerfMcpLifecycle` | CUA/MCP startup and teardown | CUA config fixed; generic lifecycle cleanup remains process-hygiene fix |
| Tool registry/schema | `agent://15-PerfToolRegistry` | Built-in tool materialization and MCP schema normalization | Lower-confidence CPU/RSS churn until instrumentation is added |
| External research | `agent://16-PerfExternalResearch` | Bun/Node/runtime docs and profiling hooks | Confirms CPU profiles and cheap RSS probes available in Bun/Node |
| Devlog shape | `agent://17-PerfDevlogShape` | Jawdev plan-folder structure | Produced the `260614_performance` folder shape |

## Parent-session synthesis

The highest-confidence performance patches are CPU reductions that preserve UX:

1. Stop full hidden child rendering for minimized/collapsed tool output.
2. Cache/bound collapsed previews and read previews.
3. Avoid rendering direct committed children under `Box` when nothing can visually change.
4. Reuse assistant streaming blocks instead of rebuilding unaffected Markdown children.
5. Lazily generate ctrl+t visible transcript lines from the bottom.
6. Remove duplicate session JSONL full-load paths after render hot paths are measured.

Do not start with broad virtual-scroll rewrites. The product model is scrollback-native; the waste is repeated preparation of live/current-turn text, not the terminal scrollback itself.
