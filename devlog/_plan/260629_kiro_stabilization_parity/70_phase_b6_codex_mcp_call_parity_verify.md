# B6 — Codex MCP-call parity (verify-only)

SoT: opencodex `parseResponse` (commit dd1d924 "add parseResponse so web_search tool works
(kiro-only 500)") + namespaced MCP/Computer Use tool-name preservation (`kiro-tools.ts`).

## Conclusion: not a porting gap for jawcode's architecture

Verified against both repos (cross-checked by the PABCD audit subagent).

1. `parseResponse` is an opencodex-only artifact. opencodex is an OpenAI-Responses proxy where
   Codex always advertises the hosted `web_search` tool, serviced by a NON-streaming sidecar loop
   (`src/web-search/loop.ts`) that hard-requires `adapter.parseResponse`. kiro was the only adapter
   missing it → kiro-only HTTP 500. jawcode has no such sidecar: its non-streaming branch
   (`auth-gateway/server.ts`, `if (!parsed.stream)`) reuses the SAME streaming `streamKiro`
   generator and awaits `events.result()`. There is no second collect-into-array adapter contract to
   satisfy, so there is nothing to port. A grep for a web-search sidecar / `parseResponse` concept
   in `packages/ai` + `packages/coding-agent` finds none.

2. Namespaced MCP / Computer Use tool names are already sent verbatim. jawcode's `convertTools`
   sends `name: t.name` with no 64-char truncation (locked by the existing
   `kiro-payload.test.ts` "long tool names are sent verbatim" test), and tool-call replay uses
   `name: tc.name`. jawcode relies on the harness producing pre-namespaced `tool.name` values rather
   than carrying a separate `namespace` field at wire time — functionally equivalent to opencodex's
   `namespacedToolName(namespace, name)` join.

## Result

No code change required. The Codex-MCP-specific failure mode opencodex fixed cannot occur in
jawcode's architecture, and the tool-name fidelity half is already satisfied and test-locked.
(Bonus: the B3b structuredToolIds guard makes the MCP tool-result round trip more robust on resumed
turns than before.)
