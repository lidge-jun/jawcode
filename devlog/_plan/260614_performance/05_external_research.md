# 05 — external research and profiling hooks

> Context7 was unavailable during this investigation (`Transport not connected`), so this lane used official Bun/Node/runtime docs and primary project docs. Re-check Context7 when it is back online.

## 1. Bun runtime profiling already covers this incident

Official Bun documentation supports the CPU-first investigation path:

- Bun benchmarking docs describe CPU and heap profiling and the `--cpu-prof`, `--cpu-prof-md`, `--heap-prof`, and `--heap-prof-md` flags. Source: <https://bun.com/docs/project/benchmarking>
- Bun runtime API docs expose `bun:jsc` heap statistics such as `heapStats()` and `memoryUsage()`, useful for separating JS heap from RSS/native allocations. Source: <https://bun.com/docs/runtime/bun-apis>
- Bun utility docs expose `Bun.stringWidth()` and `Bun.wrapAnsi()`, directly relevant to TUI width/wrap hot paths. Source: <https://bun.com/docs/runtime/utils#bun-stringwidth>
- Bun child-process docs expose subprocess `resourceUsage()`, useful for measuring MCP child processes and long-lived tool workers. Source: <https://bun.com/docs/runtime/child-process>
- Bun 1.3.7 release notes document `--cpu-prof-md` / `--heap-prof-md` Markdown outputs and mention significant `Bun.wrapAnsi()` performance work. The local runtime observed in this repo was Bun 1.3.14, so these profiling flags are expected to be available. Source: <https://bun.com/blog/bun-v1.3.7>

## 2. Memory probes should stay cheap

Node's process docs warn that `process.memoryUsage()` iterates pages and can be slow depending on allocations; `process.memoryUsage.rss()` is the cheaper RSS-only path. Use RSS-only probes for render-loop sampling and full heap stats only at coarse checkpoints. Source: <https://nodejs.org/api/process.html#processmemoryusage>

## 3. TUI rendering model comparison

Ratatui's rendering docs describe the standard terminal UI pattern: render widgets into an offscreen buffer, diff against the previous buffer, then write only changed cells. This matches JWC's general diff model, but does not remove CPU spent preparing/wrapping text before the diff. Source: <https://ratatui.rs/concepts/rendering/> and <https://ratatui.rs/concepts/rendering/under-the-hood/>

xterm.js exposes scrollback as terminal buffer state, reinforcing the product constraint that already-committed terminal text is not a mutable component tree. Source: <https://xtermjs.org/docs/api/terminal/classes/terminal/>

## 4. Unicode correctness boundary

MDN documents `Intl.Segmenter` as locale-sensitive text segmentation. This supports the safety boundary: do not replace all Unicode-aware wrapping with byte slicing. The safe path is ASCII fast paths and bounded caches while preserving Unicode/ANSI correctness for non-ASCII and colored text. Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter>

## 5. Recommended profiling recipe

CPU-first profiling should happen before and after each source patch:

```bash
bun --cpu-prof-md packages/coding-agent/bin/jwc.js --resume <large-session>
```

Then inspect the Markdown profile for these expected symbols/callers:

- `wrapTextWithAnsi`, `Bun.wrapAnsi`, `Bun.stringWidth`, `visible_width_u16_up_to`
- `ToolExecutionComponent.render`, `createCollapsedPreview`, `truncateToVisualLines`
- `AssistantMessageComponent.updateContent`, `Markdown.render`
- `FullTranscriptOverlayComponent` transcript line generation
- `count_tokens_c_callback`, tiktoken/CoreBPE callers
- session JSONL open/load/materialization functions

For memory/RSS checkpoints, prefer coarse probes:

- RSS only for frequent sampling: `process.memoryUsage.rss()`
- JS heap/native split at checkpoints: `bun:jsc` `heapStats()` / `memoryUsage()`
- MCP subprocess usage: Bun subprocess `resourceUsage()` where available

## 6. What the external research changes in the roadmap

- It strengthens CPU as the primary incident axis: use Bun CPU profiles, not heap guesses, for first patches.
- It supports keeping the current terminal scrollback UX: the diff model can stay; optimize text preparation before diff.
- It supports safe Unicode handling: add ASCII/bounded caches, not global naive string slicing.
- It supports instrumentation-first token/schema work: measure repeated token counts and MCP schema bytes before changing prompt/tool semantics.
