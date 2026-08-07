# 150 — wp11 P: Windows `.cmd` shim spawning (BatBadBut / CVE-2024-24576)

wp11 exists because wp10's A-audit rejected my disposition of three anchors — `967befdf4`, `078893311`,
`e509fc3cb` — as "deferred, surface differs". That is not an acceptable disposition for a command-injection
fix, so they get their own work-phase.

## What upstream fixed

On Windows, spawning a `.cmd`/`.bat` file goes through `cmd.exe`, whose parser runs **before** the program
sees its arguments. An argument containing `%VAR%`, quotes, or metacharacters can therefore be expanded or
injected — CVE-2024-24576, "BatBadBut". Upstream's three commits build a `cmd.exe /d /e:ON /v:OFF /c` command
line themselves, neutralize `%` and quotes in **both** the arguments and the resolved command path, and spawn
with `windowsVerbatimArguments` so libuv does not re-quote (libuv targets `CommandLineToArgvW`, not
`cmd.exe`, so letting it re-quote reopens the hole).

> **Revised after A-audit (Darwin, FAIL — 6 required fixes).** The audit answered the open Bun question with a
> source-level evidence chain and **inverted the threat model**. Corrections kept visible.

## Retracted threat statement

The draft said the BatBadBut injection was "reachable in principle" today. **It is not**, and the real finding
is arguably worse for users:

- Bun 1.3.14's Windows resolver probes `.exe` → `.cmd` → `.bat`, so bare `npx` **does** resolve to `npx.cmd`.
- But `Bun.spawn` hands that resolved batch path straight to libuv/`CreateProcessW`, which **cannot launch a
  batch file** — Windows requires `cmd.exe /c` for that.
- Bun's Windows backend only forwards `windowsVerbatimArguments`; it performs no batch detection or escaping.

So on a normal Windows install, JWC's **bundled default MCP server fails to start** — `mcp-defaults.json`
ships `npx -y @upstash/context7-mcp@latest`. The current state is a **compatibility break, not an exploit**.

That inverts the cycle: the injection risk does not exist yet — **it is introduced by the compatibility fix.**
Any route through `cmd.exe` must carry the hardening in the same change, or fixing Windows MCP startup would
create the CVE the upstream commits exist to close.

## Exposure inventory — corrected

| surface | finding |
|---|---|
| MCP stdio transport | passes `[config.command, ...args]` through unchanged; bundled default is `npx` |
| ptree launcher consumers | **17**, not the 13 the draft claimed (15 direct `ptree.spawn`/`exec` + 2 `spawnOwnedProcess`) |
| LSP workspace diagnostics | runs `["npx","tsc","--noEmit"]` through **`Bun.spawn` directly**, bypassing ptree entirely (`lsp/index.ts`) |
| LSP discovery | *deliberately* resolves project-local `.cmd`/`.bat` shims (`lsp/config.ts` `WINDOWS_LOCAL_EXECUTABLE_EXTENSIONS`), then launches them — defaults include `typescript-language-server`, Biome, ESLint, Pyright |
| DAP adapters | reuse that resolver; `dap/defaults.json` includes npm-backed `js-debug-adapter` |
| hooks / extensions / custom commands | arbitrary command names through `exec/exec.ts` |

The draft missed every row after the first two. That matters for ownership: a blanket ptree rewrite would
silently reinterpret hooks, custom commands and package tooling through `cmd.exe` **and still miss** the
direct `Bun.spawn` call in LSP diagnostics.

### `completion.notifyCommand` — dismissal was wrong

The draft called it "user-authored, therefore not injection". The command *string* is user-level, but
**model-generated text enters its environment**: `JWC_NOTIFICATION_BODY` and
`JWC_NOTIFICATION_LAST_ASSISTANT_MESSAGE` carry assistant output, and `cleanNotificationEnvValue` only strips
NUL and truncates — it does not touch `%`, `!`, quotes, `&`, `|`, `^`, or newlines.

If a Windows user's command interpolates `%JWC_NOTIFICATION_BODY%`, `cmd.exe` expands it **before** parsing
operators, so model text can escape quoting. The source is user-authored; the expanded command line is not.
Length clamping is not an injection defense. Recorded as a **separate tracked gadget**, not silently dropped.

## Design — MCP-owned, not ptree-global

The draft put resolution in `ptree.ts`. The audit is right that this is the wrong owner: ptree has 17
consumers including bash execution, SSH, hooks and custom commands, and making it silently reinterpret every
command through `cmd.exe` is a far larger blast radius than the defect. Upstream's three commits are MCP
transport fixes for the same reason.

- **`runtime-mcp/transports/stdio.ts`** owns resolution and command-line construction. It has the config, cwd
  and async context the resolver needs.
- **`runtime/process-lifecycle.ts`** gains only an explicit `windowsVerbatimArguments` pass-through.
- **`packages/utils/src/ptree.ts`** gains only the option plumbing — no automatic rewriting.

Resolution and escaping stay **separate**:

- *Resolution* (filesystem, impure): find whether the command resolves to a `.cmd`/`.bat`. It must preserve
  Bun's existing PATH semantics and must **not** add implicit current-directory lookup — that would let a
  repository-local hostile `npx.cmd` win, trading one vulnerability for another.
- *Escaping* (pure, unit-testable): neutralize `%` so `%VAR%` cannot expand, escape embedded quotes, and quote
  each token for `cmd.exe`'s parser rather than `CommandLineToArgvW`. Apply it to the **command path too**
  (`e509fc3cb`) — a `%` in the shim path expands before launch otherwise.
- Spawn with `windowsVerbatimArguments: true` on that branch only, so libuv does not re-quote what we built.
- Non-Windows and non-batch targets keep the current path byte-for-byte.

## Owner paths

- `packages/coding-agent/src/runtime-mcp/transports/stdio.ts`
- `packages/coding-agent/src/runtime/process-lifecycle.ts`
- `packages/utils/src/ptree.ts` (option plumbing only)
- `packages/coding-agent/test/mcp-windows-shim.test.ts` (new)
- `.github/workflows/dev-ci.yml` (targeted Windows job)

## Verification

The draft proposed proving the escaping against a **locally written model of `cmd.exe`'s parser**. The audit
correctly rejected that: a hand-rolled parser model reproduces exactly the assumptions the implementation
makes, so it can only confirm my own misunderstanding. For a security fix that is not acceptable.

**Pure-unit layer (runs anywhere):** `%VAR%` neutralized; quotes and `& | ^ < >` escaped; `%` in the resolved
command path neutralized; `.exe`/extension-less targets untouched; non-Windows returns unchanged argv.

**Real-Windows layer (required before merge):** the repo already has Windows runner infrastructure in
`.github/workflows/build-natives.yml` (`windows-2022`), but regular CI is Ubuntu/macOS only. Add a targeted
Windows job that executes a **real temporary `.cmd` shim** and asserts:

1. exact argv round-trip — the shim receives the arguments byte-for-byte;
2. a sentinel command embedded in an argument does **not** execute;
3. `%VAR%`, quotes and metacharacters survive as literals;
4. a `%` in the shim path does not expand;
5. CR/LF/NUL in arguments are rejected rather than smuggled.

If that job cannot be added, this cycle ships **no code** and the finding is escalated instead. Shipping
unexecutable, unverifiable security code would be worse than shipping nothing.

## Not in scope, but tracked

- **`completion.notifyCommand` env-expansion gadget** — conditional Windows injection via model-controlled
  `%JWC_NOTIFICATION_*%`. Needs its own decision: sanitize the values, or document the interpolation hazard.
- The remaining 25 deferred `20.088` gaps.
