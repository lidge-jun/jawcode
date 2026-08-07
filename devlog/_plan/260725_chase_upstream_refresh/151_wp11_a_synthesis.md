# 151 — wp11 A synthesis: the threat model was backwards

Darwin returned **FAIL** with 6 required fixes and, more importantly, answered the one question the plan had
left open — decisively, with a source-level evidence chain.

## The answer that inverted the cycle

**Does Bun 1.3.14 safely execute Windows `.cmd` shims? No — and it cannot execute them at all.**

- Bun's Windows resolver probes `.exe` → `.cmd` → `.bat`, so bare `npx` **does** resolve to `npx.cmd`.
- `Bun.spawn` then passes that batch path to libuv/`CreateProcessW`, which cannot launch a batch file;
  Windows requires `cmd.exe /c`.
- Bun's Windows backend only forwards `windowsVerbatimArguments` — no batch detection, no escaping.
- Bun 1.3.14's release notes contain no batch-shim fix, and Bun issue #29636 independently documents `.cmd`
  wrapper `EINVAL`.

So JWC's **bundled default MCP server cannot start on Windows** (`mcp-defaults.json` ships `npx -y
@upstash/context7-mcp@latest`). The live problem is a compatibility break, not an exploit.

**The injection risk is introduced by the fix, not present before it.** That is the opposite of what my plan
said, and it changes the engineering rule: any change that routes through `cmd.exe` to make Windows MCP work
must carry the BatBadBut hardening *in the same change*, or it manufactures the CVE.

I would not have found this by reading JWC alone. The plan had flagged it as an open question to resolve in B;
the audit resolved it before a line of code was written, which is the entire point of the gate.

## Verification before acceptance

| finding | independent check | holds? |
|---|---|---|
| bundled default really is `npx` | `mcp-defaults.json` → `"command": "npx"` | **yes** |
| LSP bypasses ptree entirely | `lsp/index.ts` runs `["npx","tsc","--noEmit"]` via `Bun.spawn` | **yes** |
| LSP deliberately resolves `.cmd` | `lsp/config.ts` `WINDOWS_LOCAL_EXECUTABLE_EXTENSIONS = [".exe",".cmd",".bat"]` | **yes** |
| notify env is not sanitized | `cleanNotificationEnvValue` strips only NUL and truncates | **yes** |
| no Windows test CI | `ci.yml` is ubuntu + macos-14; only `build-natives.yml` has `windows-2022`, and it builds artifacts | **yes** |

## Disposition

| # | finding | disposition |
|---|---|---|
| 1 | threat statement backwards | **accepted, retracted.** Reframed: broken Windows startup now, injection risk introduced by the fix |
| 2 | ptree is the wrong owner | **accepted.** Moved to the MCP transport; ptree gets option plumbing only. A blanket rewrite would reinterpret hooks, custom commands and SSH through `cmd.exe` |
| 3 | resolution vs escaping conflated; implicit cwd lookup | **accepted.** Split, and explicitly no current-directory lookup — that would let a repo-local hostile `npx.cmd` win |
| 4 | "13 spawn sites" wrong | **accepted.** 17 consumers, plus three surfaces the draft missed entirely (LSP diagnostics, LSP/DAP shim resolution) |
| 5 | `completion.notifyCommand` dismissal indefensible | **accepted.** Model text reaches `%JWC_NOTIFICATION_*%`; `cmd.exe` expands before parsing operators. Tracked as a separate gadget |
| 6 | parser-model test is circular | **accepted.** A hand-rolled `cmd.exe` model can only confirm my own assumptions. A real Windows job executing a real `.cmd` shim is now a merge precondition |

## The rule this cycle adopts

If the Windows job cannot be added, **this cycle ships no code** and escalates instead. Shipping security code
that cannot be executed on any machine in the pipeline is worse than shipping nothing: it looks like the
problem is handled.
