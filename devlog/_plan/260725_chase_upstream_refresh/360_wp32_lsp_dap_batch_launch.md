# 360 — wp32: the last two launchers that could not start on Windows

Source: the LSP/DAP `.cmd` surfaces carried forward from wp11 on card `20.088`.

| phase | evidence |
|---|---|
| P | traced both launchers to their spawn sites |
| A | **pass**, module placement and DAP scope resolved |
| B | `6dbdbf2` |
| C | gates green; both ablations fail |

## Finishing what wp11 started

wp11 established the fact: Bun hands a resolved `.cmd` path straight to `CreateProcessW`, which cannot launch
batch files **at all**. It fixed the MCP stdio transport and explicitly carried LSP and DAP forward as still
exposed.

That exposure is the common case, not an edge one. Language servers and debug adapters are overwhelmingly
npm-installed, so on Windows the command routinely resolves to `typescript-language-server.cmd`,
`pyright.cmd`, or a bare `npx`. The server just never starts.

## Three audit decisions

**Module placement.** The helper lived in `runtime-mcp/transports/`. Importing it into `lsp/` and `dap/`
would make both depend on the MCP subsystem for a helper that encodes properties of *Bun and `cmd.exe`* —
nothing about it was ever MCP-specific. Moved to `runtime/`; only two importers needed updating, and the move
is pinned by test so it does not drift back.

**DAP scope.** There are three `ptree.spawn` sites, but two build unix-socket paths (`/tmp/dap-*.sock`,
`--listen=unix:`) and cannot be reached on Windows. Patching them would be noise that implies coverage which
does not exist. Only the stdio spawn is changed, and the comment says why.

**A weak assertion of my own.** My first LSP test checked that `resolveWindowsBatchLaunch` was *called*.
Ablating only the argv substitution — compute the launch, then ignore it — left it **green**. Both launcher
tests now assert the result is actually consumed, and both ablations fail.

That is the third time this session an ablation has caught a test that proved a helper works without proving
anything uses it. The pattern is worth naming: asserting the call is not the same as asserting the effect.

## Scope of this phase

The escaping is unchanged and was already ablation-verified in wp11 against injection attempts. This phase is
application plus coverage, and the new test is wired into the existing `windows-2022` CI job.
