# 141 — wp10 A synthesis: audit FAIL folded

Euclid returned **FAIL** with 10 required fixes, one of them security-blocking. All folded.

## The one that matters

I dispositioned three Windows command-injection anchors (`967befdf4`, `078893311`, `e509fc3cb`) as
**"deferred — surface differs"**. That is not an acceptable disposition for a security fix, and the premise
was wrong: JWC passes configured MCP command/args straight through (`runtime-mcp/transports/stdio.ts`), and
the shared launcher has **no** `.cmd`/`.bat` resolution, no BatBadBut escaping, and no
`windowsVerbatimArguments` — verified by search, zero hits in `packages/utils/src/ptree.ts`.

They now become **wp11**, their own security work-phase with named owners, rather than a line in a residual
list.

## The design was lossy, and the audit showed exactly where

The draft collapsed a launch failure into `exitCode: 127`. Two problems:

- **127 is not a sentinel.** Verified: `git -c alias.probe='!exit 127' probe` returns 127. A real git
  invocation can produce it.
- **It converts "cannot inspect" into a confident wrong answer.** `/review` would announce "No uncommitted
  changes found"; autoresearch would record "no pending changes" and possibly skip harness preservation;
  `branch.default` would silently keep an assumed `"main"`; `patch.canApply` would invert to "cannot apply".

A typed `launchFailure` discriminator replaces it: cosmetic callers may ignore it, decision-making callers
must surface an actionable unavailable state.

The missing-cwd diagnosis was also racy — checking directory existence *after* the spawn failed. Preflight
the cwd, resolve git to an absolute path, and report a generic launch failure for the residual race.

## Verification before acceptance

| finding | independent check | holds? |
|---|---|---|
| 16 bypasses, not 18 | `rg -c 'runCommand('` → 19; minus 1 definition and 2 guarded wrappers | **yes** |
| `status` is checked, contradicting my test | `status()` calls `runText` → `runChecked` → `ensureAvailable` | **yes** |
| real git can exit 127 | ran the alias probe → 127 | **yes** |
| `$which` searches outside `PATH` on macOS | `darwinWhich` consults Xcode/CLT dirs after `$PATH` | **yes** |
| no Windows shim escaping | `rg 'windowsVerbatimArguments\|\.cmd\|BatBadBut' ptree.ts` → 0 hits | **yes** |
| `python/robogjc` wrong | the directory is `python/robojwc` | **yes** |

## Disposition

| # | finding | disposition |
|---|---|---|
| 1 | miscount 18→16 | accepted; full bypass table recorded |
| 2 | `status` contradiction | accepted; test now targets `status.summary`, and top-level `status` is documented as intentionally loud |
| 3 | exit-127 collapse is lossy | accepted; typed `launchFailure` + per-caller policy |
| 4 | racy missing-cwd check | accepted; preflight + honest residual-race error |
| 5 | fragile PATH test | accepted; spawn-spy unit layer + hermetic absolute-execPath integration layer |
| 6 | wrong triage on catalog/updater/robojwc/STT/musl/launch/TUI/tool-refresh | accepted; each re-verdicted with file evidence, including **two anchors that were already satisfied** and which I had wrongly called gaps |
| 7 | security anchors deferred on a cosmetic argument | accepted; escalated to wp11 |
| 8 | false "16 deferred with owners" summary | accepted; counts recomputed to 46 |
| 9 | fabricated `src/tools/xdev.ts`, wrong `python/robogjc` | accepted; citation withdrawn, path corrected |
| 10 | card's `bb1593941` file inventory incomplete | accepted; recorded as a **card-data defect** — the card itself omits upstream product/test files, so the triage inherited a blind spot |

## Pattern worth naming

Fourth consecutive cycle where the audit caught my triage erring toward less work. The specific failure keeps
repeating: I dismiss an anchor from a *path-shaped* check ("no `packages/catalog`", "no `src/launch/`")
instead of searching the fork for the capability. Two anchors here were the opposite error — I called them
gaps when JWC already satisfies them. Both directions come from the same root: verdicts asserted from
structure rather than behavior.
