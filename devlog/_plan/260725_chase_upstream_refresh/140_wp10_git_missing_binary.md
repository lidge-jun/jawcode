# 140 — wp10 P: degrade read-only git helpers when the git binary is missing

wp10 takes `20.088` (OMP: release, build, platform, CI hardening), 46 anchors.

> **Revised after A-audit (Euclid, FAIL — 10 required fixes, one security-blocking).** The draft miscounted
> call sites, contradicted itself about `status`, proposed lossy failure semantics, and — the serious one —
> deferred three Windows command-injection anchors as "surface differs". Corrections kept visible.

## Retracted claims

| draft claim | reality | check |
|---|---|---|
| "18 direct `runCommand` bypasses" | **16.** 19 textual occurrences − 1 definition − 2 guarded wrappers | `rg -c 'runCommand('` → 19 |
| "`status` degrades" (test #2) | **false.** Top-level `status` goes through `runText` → `runChecked` → `ensureAvailable`, so it throws `GitCommandError` by design. Only `status.summary` is a direct bypass | read `git.ts:788` |
| Windows MCP shim anchors "deferred — surface differs" | **wrong disposition for a security fix.** JWC passes configured MCP command/args straight through, and `ptree.ts` has no `.cmd`/`.bat` resolution, no BatBadBut escaping, no `windowsVerbatimArguments` | `rg 'windowsVerbatimArguments|\.cmd|BatBadBut' ptree.ts` → **0 hits** |
| catalog anchors "JWC has no `packages/catalog`" | **too broad.** The equivalents live in `packages/ai` (`scripts/generate-models.ts`, `model-manager.ts`, `utils/discovery/codex.ts`); at least one is a live runtime gap | audit file:line |
| `python/robogjc` | **wrong path.** It is `python/robojwc` | `ls python/` |

"Surface differs" is not an acceptable disposition for a command-injection fix. That is the error I most want
recorded, because it disposed of a security anchor on a cosmetic argument.

## The defect, proven at runtime

`utils/git.ts` guards only two wrappers — `runChecked` and `tryText` call `ensureAvailable()` — while **16
direct `runCommand` call sites bypass them**, and `runCommand` reaches `Bun.spawn(["git", ...])` unguarded.
`Bun.spawn` throws `ENOENT` *synchronously*, so a missing git escapes as an unhandled rejection instead of
degrading (Windows without git, or relying on WSL git).

Probed in a subprocess with an empty effective `PATH` — an in-process `PATH` edit is not enough, because Bun
resolves and caches the executable at startup, which made a first attempt falsely report success:

```
diff(allowFailure)  THROWS ENOENT      diff.has        THROWS ENOENT
status              THROWS ENOENT      status.summary  THROWS ENOENT
head.short          THROWS ENOENT      ls.submodules   THROWS ENOENT
branch.current      → "dev"   (filesystem fallback, already correct)
branch.default      → "main"  (filesystem fallback, already correct)
head.sha / repo.root → resolved via filesystem, already correct
```

### The `$which` / spawn mismatch (audit, not in the draft)

On macOS, `$which` also searches Xcode/CLT directories *outside* `PATH` (`packages/utils/src/which.ts`), but
`runCommand` spawns bare `"git"`. So `ensureAvailable()` can pass while the spawn still fails. Resolving git
to an **absolute path** once and spawning that closes the mismatch rather than papering over it.

## Design — corrected

The draft collapsed launch failure into `exitCode: 127`. The audit killed that: **real git can return 127**
(verified — `git -c alias.probe='!exit 127' probe` → 127), so 127 is not a sentinel, and collapsing erases
the difference between "clean" and "could not inspect". That distinction matters because of where it lands:

| caller | with a bare-127 collapse | why it is wrong |
|---|---|---|
| `/review` | "No uncommitted changes found" | tells the user their tree is clean when git is simply missing |
| autoresearch `init-experiment` | "no pending changes" | may skip harness preservation |
| `branch.default` | silently keeps the assumed `"main"` | wrong branch, no signal |
| `ref.exists` | "branch does not exist" | masks the real cause in push handling |
| `patch.canApply` | "patch cannot apply" | inverted meaning |
| `status.summary` | status segment silently blank | cosmetic, acceptable |
| `branch.tryDelete`, `worktree.tryRemove` | `false` | consistent with their best-effort API |

So the launch failure gets a **typed discriminator**, not a magic exit code:

- `GitCommandResult` gains an optional `launchFailure` field naming the cause.
- Cosmetic callers (status line) may ignore it and render nothing.
- Decision-making callers (`/review`, autoresearch, ref/branch queries) must surface an **actionable
  unavailable** state rather than a confident wrong answer.
- `ensureAvailable()` stays: checked and mutating commands keep failing loudly with `git is not installed.`
  A user asking to commit must never silently get a no-op.

### Missing cwd vs missing git — without the race (upstream `a07d72f63`)

A deleted `cwd` also makes `Bun.spawn` throw `ENOENT`. The draft proposed checking directory existence *after*
the spawn failed; the audit correctly called that racy — the directory can vanish or reappear in between. The
honest order is:

1. resolve git to an absolute executable path once;
2. validate `cwd` **before** spawning;
3. spawn the absolute path;
4. if `ENOENT` still occurs, report a generic launch/precondition failure instead of asserting which resource
   disappeared.

## Anchor triage — all 46

| anchor group | JWC state | disposition |
|---|---|---|
| `d0f1cd1b7`, `a07d72f63` git missing-binary / missing-cwd | 16 unguarded `runCommand` sites; ENOENT crash reproduced | **IMPLEMENT** |
| **`967befdf4`, `078893311`, `e509fc3cb` Windows cmd-shim injection** | `runtime-mcp/transports/stdio.ts` passes configured command/args straight through; `packages/utils/src/ptree.ts` has **no** `.cmd`/`.bat` resolution, BatBadBut escaping, or `windowsVerbatimArguments` | **SECURITY GAP — own work-phase (wp11), owners named; NOT dispositioned as "surface differs"** |
| release/publish/CI — `83cb70eaf`, `6efcdfb66`, `945ccf4bb`, `29ff6bebb`, `7f0b82f57`, `9169a7018`, `91443501f` | `.github/workflows/`, `scripts/ci-release-publish.ts` | **OUT OF SCOPE — release/publish is UNSAFE per the goal** |
| changelog-only — `f1cf6af33`, `a58066bfd`, `d1b6069f2` | changelog section reconciliation | **non-applicable (docs bookkeeping)**, classified explicitly rather than bulked into "CI" |
| `bb1593941` vouching | upstream also changes `python/robomp` product code the card's file list omits; JWC has equivalents in `python/robojwc/src/github_events.py`, `server.py` | **GAP — deferred, named** (draft wrongly called this OOS) |
| `59877a01b` musl release asset | product updater code: `cli/update-cli.ts` selects platform/arch only, no musl asset selection | **GAP — deferred, named** (draft wrongly called this OOS) |
| installer — `b5b645c92`, `329db086f` | `scripts/install.sh`; the goal's non-goal names npm release/publish specifically | **boundary-dependent — deferred, flagged for the user** |
| catalog — `930bb33f4`, `62c164d25` codex context floor | live runtime gap: a reported 272K window beats the 372K fallback in `packages/ai/src/utils/discovery/codex.ts` | **GAP — deferred, named** |
| catalog — `51ab2fcf2` codex discovery authoritative | appears already satisfied by `provider-models/special.ts` | **already satisfied** |
| catalog — `e06ac0b78`, `b823c1883`, `0becfbe19`, `0069a84c9` | equivalents exist in `packages/ai/scripts/generate-models.ts`, `model-manager.ts`; `models.json` is generator-owned per `AGENTS.md` | **deferred — needs generator-side comparison** |
| catalog — `ee26bec5a`, `5ebafcd9f` Devin variants | Devin-specific seeds/variants | **non-applicable (pending final-state reconciliation)** |
| TUI — `e7f3fde12`, `a2c90f5e5` | do **not** touch the protected welcome / viewport-scroll / tool-folding surfaces named in `AGENTS.md` | **deferred — needs behavioral probe** (draft's NEEDS_HUMAN rationale was wrong) |
| launch/daemon windows — `5b6e8db2d`, `382f932d5` | JWC has equivalent long-lived daemon spawning, incl. a detached owner spawn without `windowsHide` in `commands/harness.ts` | **GAP — deferred, named** (draft's path-based dismissal was wrong) |
| `52e2fcb74` musl FICLONE | exact gap: `crates/pi-iso/src/linux_reflink.rs` still declares `FICLONE` as `libc::c_ulong` | **GAP — deferred, named** (not host-dependent) |
| `26e75b251` linux ffmpeg input | exact gap: `stt/recorder.ts` hardcodes PulseAudio | **GAP — deferred, named** |
| `b6e68fd24` explore→scout | JWC intentionally retains a hidden `explore` role | **intentional divergence — rejected with canon evidence** |
| `5082763d4`, `4a2599368` `getPackageDir` | equivalent compat/`getPackageDir` surfaces exist | **deferred — compiled-shim probe** |
| `248421fdf`, `d815a4389` xdev notices | whole-tree search finds no Xdev registry or `xd://` mount | **non-applicable** (the draft's `src/tools/xdev.ts` citation was fabricated and is withdrawn) |
| `51ac313a6`, `0a4b26570` transactional tool refresh | **already satisfied**: `agent-session.ts` snapshots/restores registry, indexes, selections, active tools, prompts and signature, with rollback assertions in `agent-session-tool-rebuild-skip.test.ts` | **already satisfied** (draft wrongly called this a gap) |
| `4fd9dd572`, `c93e38b14`, `b55e6b91f`, `705a6118f` quota display | equivalent grouping/window surfaces near `command-controller.ts` | **deferred — needs behavioral comparison** |
| `8640c0dde` script rename | `python/robojwc/web/package.json` still names the script `typecheck` | **GAP — deferred, cosmetic** (draft cited the wrong path `python/robogjc`) |

**1 implemented · 1 escalated to its own security work-phase · 7 out-of-scope (release/publish) ·
8 non-applicable · 2 already satisfied · 1 intentional divergence · 25 deferred with owners ·
1 boundary-dependent (installer, flagged for the user).** `20.088` closes **ADAPT-partial**.

## Owner paths

- `packages/coding-agent/src/utils/git.ts`
- `packages/coding-agent/test/git-missing-binary.test.ts` (new)

## Verification — corrected

The draft's "PATH contains only a symlinked bun" recipe is not portable: it leans on symlink behavior and Unix
`PATH` conventions, macOS `$which` searches CLT paths outside `PATH`, and Windows env keys are
case-insensitive. Two complementary layers instead:

**Deterministic unit layer** — `vi.spyOn(Bun, "spawn")` throwing a synthetic `ENOENT` proves the launch-error
mapping on every platform, with no dependency on the developer's git. (`mock.module()` stays out per
`AGENTS.md`.)

**Hermetic integration layer** — spawn the child via absolute `process.execPath`, strip every case variant of
`PATH`, and point `PATH` at a fresh empty temp dir.

Cases:

1. `diff({ allowFailure: true })` returns empty output instead of throwing.
2. `status.summary` returns `null` instead of throwing — **not** top-level `status`, which is checked by
   design and must keep throwing.
3. A checked/mutating command still fails loudly with `git is not installed.`
4. A nonexistent `cwd` is rejected in preflight, distinctly from a missing git binary.
5. A decision-making caller can observe `launchFailure` rather than being handed a confident wrong answer.
6. With git present, every helper behaves exactly as before.

Gates: `bun run check:ts`, the git-focused suites, plus the standard gate set before push.

## Not in scope

Release, publish and CI workflows (UNSAFE per the goal). Installer anchors are boundary-dependent and flagged
for the user rather than silently claimed. The Windows cmd-shim injection anchors move to **wp11** as their
own security unit — deferring a command-injection fix on a "surface differs" argument was the draft's worst
call, and it is not repeated here.
