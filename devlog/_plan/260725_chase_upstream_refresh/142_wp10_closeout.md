# 142 — wp10 closeout: git launch failure must not become a confident answer

Outcome: **DONE (partial by design)** — read-only git helpers degrade instead of crashing, and no caller now
reports a confident fact about a repository git could not inspect. `20.088` archived ADAPT-partial with 25
named gaps; three security anchors escalated to **wp11**.

| phase | evidence |
|---|---|
| P | `140` — 46 anchors triaged |
| A | Euclid **FAIL** (10 fixes, one security-blocking) → folded in `141` |
| B | `fc267ff` implementation |
| C | Rawls **FAIL** ×3 → `0d07942`, `fed4c6e`, `81e5cb4`, `2e9cc79`, `d4b0628` |
| _fin | MOC row, INDEX 66→67, tier link |

## The defect

`runCommand` spawned git unguarded, and `Bun.spawn` throws `ENOENT` **synchronously**, so 16 read-only helpers
that bypass `ensureAvailable()` escaped as unhandled rejections — Windows without git, or relying on WSL git.

The fix that mattered was not the catch. It was refusing to let "git never ran" masquerade as an answer.

## Why a typed discriminator, not an exit code

Upstream folded launch failure into a non-zero result. The audit killed that with one command:

```
git -c alias.probe='!exit 127' probe   →  127
```

Real git can produce 127, so no exit code separates "git says no" from "git never ran". Collapsing would have
made `/review` announce **"No uncommitted changes found"**, `branch.default` silently keep an assumed `main`,
`ref.exists` report a branch missing, and `patch.canApply` report a conflict — every one a confident claim
about a repository nobody could read.

## Four rounds, four different mistakes of mine

Worth recording precisely, because they were not variations on one error:

- **A-round:** I deferred three Windows **command-injection** anchors as "surface differs". That is not an
  acceptable disposition for a security fix, and the premise was false — `ptree.ts` has no `.cmd`/`.bat`
  resolution, BatBadBut escaping, or `windowsVerbatimArguments`. They became wp11.
- **C1:** I fixed the two callers I happened to look at and left the same bug class in four others.
- **C2:** correcting that, I over-narrowed — treating only a *launch* failure as unavailable, so a **corrupt
  index** (git runs, fails fatally) read as a clean tree.
- **C3:** my replacement matched git's error text. Under `LC_ALL=fr_FR.UTF-8` the same condition reads
  `n'est un dépôt git`, so a plain non-repo was misreported as unavailable. Comparing the resolved repository
  root is locale-independent; verified under both `C` and `fr_FR.UTF-8`.

The through-line: each fix was correct about the case in front of me and wrong about the next one out.

## Final behavior

Exactly one case is a genuine empty answer: git resolves no repository at that path. A corrupt index,
unreadable `.git`, dubious ownership, a `.git` directory that only *looks* like a repo, or a failed launch all
report **unavailable**. Checked and mutating commands still fail loudly — a user asking to commit must never
silently get a no-op.

## Verification

`check:ts` 0 · `check:rs` 0 · `check:schemas` 0 · `verify-g002-gates` PASS · `rebrand-inventory --strict` PASS
· `ci:test:smoke` ok · targeted suites **1,290 pass / 0 fail**. Ablation red.

`test/task*` carries 20 failures that are **pre-existing and unrelated** — reproduced with `utils/git.ts`
reverted, and independently confirmed by the reviewer against two archives.

A note for whoever writes the next git test: **`/tmp` is not a safe fixture on this machine.** A stray
`/tmp/.git/jaw-diff` scratch directory makes it look like a repository root; the new tests create their own
`mkdtemp` directories.

## Carried forward

- **wp11 (security):** Windows cmd-shim injection — `967befdf4`, `078893311`, `e509fc3cb`.
- **Residual (25):** musl release asset selection, `FICLONE` type on musl, PulseAudio hardcoding, codex
  context-window floor, daemon spawns without `windowsHide`, robojwc rate-limit parity, quota-window display,
  `getPackageDir` compiled-shim probe, and others named in the card.
- **Boundary question for the user:** installer anchors. The recorded non-goal names npm release/publish
  specifically, so whether `scripts/install.sh` counts as out of scope is your call, not mine to assume.
- **Remaining bucket-A cards:** GJC `10.110`, `10.112`; OMP `20.082`.
