# 152 — wp11 closeout: Windows `.cmd` launch, escaped

Outcome: **DONE** — the MCP stdio transport now launches Windows batch shims through `cmd.exe` with
BatBadBut escaping, and a `windows-2022` CI job executes a real `.cmd` shim to prove it.

| phase | evidence |
|---|---|
| P | `150` — exposure probed |
| A | Darwin **FAIL** (6 fixes) → folded in `151`; answered the Bun question decisively |
| B | `6724d00` implementation, `974ea59` escaping correction |
| C | verifier blocked by a content filter; verified in-session, and it found a real defect |

## The investigation inverted the problem

I opened this phase believing JWC had a live command-injection hole. The audit proved otherwise, with a
source-level chain through Bun's resolver, spawn bindings and libuv:

**Bun 1.3.14 cannot launch `.cmd` files at all.** It resolves bare `npx` → `npx.cmd`, then hands that batch
path to `CreateProcessW`, which requires `cmd.exe /c` for batch files.

So the live defect was a **compatibility break**: JWC's bundled default MCP server
(`npx -y @upstash/context7-mcp@latest`) never starts on Windows. And the injection risk is **introduced by
the fix** — routing through `cmd.exe` without escaping manufactures CVE-2024-24576. That is why the escaping
and the compatibility fix had to land in one commit; shipping the fix alone would have created the CVE.

## What shipped

- `runtime-mcp/transports/windows-batch-launch.ts` — pure, argv-in/argv-out: `%` neutralized so `%VAR%`
  cannot expand, quotes doubled, backslash runs handled before a closing quote, NUL/CR/LF rejected rather
  than truncated, and the **command path escaped too** (a `%` in the shim path expands otherwise).
- `cmd.exe /d /e:ON /v:OFF /c` — `/v:OFF` matters independently: with delayed expansion on, a `!` in an
  argument expands.
- `windowsVerbatimArguments` plumbing only in `ptree` and the owned-process layer. **No automatic rewriting
  there:** ptree has 17 consumers including bash execution, SSH and hooks, and making it reinterpret every
  command through `cmd.exe` would be a far larger blast radius than the defect.
- `cleanNotificationEnvValue` now neutralizes `cmd.exe` metacharacters on win32. Model-generated text reaches
  `%JWC_NOTIFICATION_BODY%`, and `cmd.exe` expands it *before* parsing operators. Verified the POSIX path is
  not equivalent: `sh -c 'echo "$VAR"'` does not re-parse operators out of an environment value.

## The C round found a real defect — in my own escaping

The security verifier was blocked by a content filter, so I reviewed the escaping by hand against upstream's
implementation. My "safe unquoted" character class included `,` and `=`. **`cmd.exe` treats those as token
separators**, so `--define=a,b` would have arrived split into several arguments. Aligned to upstream's set and
pinned with an ablation-verified regression.

Injection attempts probed and defeated: quote-escape, backslash-then-quote, doubled/tripled quotes, `%VAR%`,
caret escape, delayed expansion, lone `"`, lone `%`, trailing backslash. Every one stayed inside its quoted
region with a balanced quote count.

## Honest limits

- **Independent verification did not happen for the final commit.** The verifier was filtered out. Hand review
  plus ablation is weaker than an adversarial second reader, and this is recorded rather than glossed.
- **The escaping is not executed off Windows.** The pure layer runs everywhere; the real-shim test runs only
  on the new `windows-2022` job. Until that job runs, `cmd.exe`'s actual parser has not seen this code.
- **Only the MCP transport is fixed.** LSP diagnostics still run `["npx","tsc"]` through a direct
  `Bun.spawn`, and LSP/DAP resolve `.cmd` shims themselves. Those remain exposed to the same
  *compatibility* break and are named in the card, not silently covered.

## Verification

`check:ts` 0 · `check:rs` 0 · `check:schemas` 0 · `verify-g002-gates` PASS · `rebrand-inventory --strict` PASS
· `ci:test:smoke` ok · 1,247 targeted tests pass / 0 fail · 16 escaping tests + 1 Windows-only execution test.

`sdk-mcp-discovery.test.ts` carries 1 pre-existing failure, reproduced with these source files stashed.

## Carried forward

- LSP/DAP Windows shim surfaces (same compatibility break, no injection exposure until they route through
  `cmd.exe` too).
- The remaining 25 deferred `20.088` gaps.
