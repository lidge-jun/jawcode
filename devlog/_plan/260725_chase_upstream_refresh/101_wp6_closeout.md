# 101 — wp6 closeout: `.codexclaw/` stripped, dev and main published

`dev` and `main` are both at **`e1296de52f097f9b3e50d134395b030c8019fdd6`** on `origin`, and neither remote
tip carries a single `.codexclaw` file. The 326-commit chase body that wp5 held back is now public; the
agent's scratch directory is not.

## What shipped

| ref | before | after |
|---|---|---|
| `origin/dev` | `c353d7b5` | `e1296de5` (fast-forward) |
| `origin/main` | `44c9fa8` | `e1296de` (fast-forward) |

Both pushes were fast-forwards. No force-push, no published SHA moved.

## The size argument, corrected again

wp6's plan already retracted the "119.9MB justifies overruling the user" framing. Measuring the unpushed
range again before acting produced a sharper fact that cuts the other way:

| path | size in unpushed range | already declared machine-local? |
|---|---|---|
| `.codexclaw/cache/` | 106.49 MB | yes (`.gitignore`) |
| `.codexclaw/friction.jsonl` | 11.08 MB | yes |
| `.codexclaw/bridge.db*` | 0.27 MB | yes |
| **subtotal already-ignored** | **117.84 MB** | — |
| `ledger.jsonl` + `evidence/` + `goalplans/` + `sessions/` + rest | **2.06 MB** | no — user-undecided |

So 98.3% of the bulk was content the repo had *already* declared unpublishable; only ~2MB was ever genuinely
in the user's open question. That makes the size argument irrelevant to the decision rather than supportive of
it, which is why the basis for acting stayed the reversibility asymmetry from the plan, not the byte count.

A secrets scan over all 133 tracked files (`sk-`, `ghp_`, `AKIA`, `xox[baprs]-`, PEM private-key headers)
returned nothing, so the strip is not a leak response. It preserves a choice.

## Rewrite scope, proven not assumed

Scope was measured against **every advertised remote ref**, not just `dev`/`main`:

```
git rev-list dev main --not origin/dev origin/main origin/preview \
                            origin-pr/1 origin-pr/2 v1.0.0
→ 110 commits ; intersection with published history = 0
```

`git filter-branch --state-branch refs/wp6/filter-map --index-filter 'git rm -r --cached --ignore-unmatch
.codexclaw' --prune-empty` rewrote exactly those 110. `--state-branch` was mandatory: Git 2.50.1 keeps the
real map in `.git-rewrite/map` and deletes it on exit, so without it step 5 would have been impossible.

`git-filter-repo` is not installed on this machine, so the plan's `filter-branch` route stood.

### Post-rewrite verification

| check | result |
|---|---|
| `.codexclaw` entries in `dev` / `main` trees | 0 / 0 |
| source diff old-tip vs new-tip excluding `.codexclaw` | **empty** — byte-identical |
| every published ref after rewrite | unchanged (`c353d7b5`, `44c9fa8`, `a7ccef5`, `f4b6726`, `8323247`, `a5247a5`) |
| `main` ancestor of `dev`, `origin/main` ancestor of `dev` | both yes → both pushes fast-forward |
| `.codexclaw` blobs the push would transfer | **0** |
| push payload | 1,822 objects / **3.72 MB** (was 120MB of blobs) |

One commit in the rewritten range still *mentions* `.codexclaw` paths: `f399dada` shows six `D` (delete)
entries. That is correct and expected — it is the first rewritten commit on top of `origin/main`, and those
six files are the ones already published there. Deleting them is how the range reaches a `.codexclaw`-free
tree without touching published history.

`--prune-empty` removed nothing: the map holds 110 entries with zero empty targets, so the plan's projected
"12 pruned commits" did not materialize and no citation needed a surviving-parent substitution.

## SHA remap

56 old short SHAs were cited across **46 tracked documents** in **174 occurrences**. Each was rewritten to a
freshly computed unique abbreviation of its mapped commit, preserving the original citation length style.
Verified afterwards:

- stale citations still resolving to a pre-rewrite commit: **0**
- rewritten citations that fail `git rev-parse --verify`: **0**

## Gates on the rewritten tree

Run on `dev`, then re-run on `main` after the ff-merge:

| gate | result |
|---|---|
| `bun run check:ts` | exit 0 |
| `bun scripts/verify-g002-gates.ts` | passed |
| `bun scripts/check-visible-definitions.ts` | passed |
| `bun scripts/rebrand-inventory.ts --strict` | passed, 0 unexpected |
| `bun test .../default-jwc-definitions.test.ts` | 21 pass / 0 fail |
| `bun run ci:test:smoke` | `smoke-test: ok` |

### The two chase gates still fail — and it is not this change

`chase-closure-integrity` reports `FAIL — 159 cards, 136 offending` and `chase-lifecycle-check` reports
`FAIL — 235 card ids, 39 violations`. Rather than assume the remap was innocent, the pre-rewrite tip was
checked out into a scratch worktree at `refs/wp6-backup/dev` and both gates were run there: **identical
numbers, 159/136 and 235/39**. The failures are the pre-existing legacy backlog — the 136 legacy `_fin` cards
and the 12 card-id collisions — which wp6's plan and the goal both list as user decisions, out of scope.

## Recovery handles

- Pre-rewrite graph: `refs/wp6-backup/dev` and `refs/wp6-backup/main`. Deliberately **refs, not tags**, so a
  later `git push --tags` cannot republish the stripped blobs.
- Rewrite map: `git show refs/wp6/filter-map:filter.map` (110 entries).
- Runtime state: copied to `~/codexclaw_wp6_backup_20260807_232632` before `filter-branch`, restored
  afterwards. All 133 files are back on disk as ignored-but-present; the loop's goalplan and ledger survived.

`.gitignore` now ignores `.codexclaw/` wholesale, and the stale "until their publication is decided" comment
is replaced with what was actually decided.

## Still open, still the user's

- The 6 `.codexclaw` files already reachable from `origin/main`'s **history** stay there. Retracting them
  needs a public force-push — not done, not in scope.
- Whether `.codexclaw/evidence/` (88 files, 0.38MB) should later be *deliberately* published as project
  history. Stripping keeps that a live option; one `git add -f` reverses it.
- The 12 card-id collisions and 136 legacy `_fin` cards behind the two red chase gates.
