# 100 — wp6: strip `.codexclaw/` from unpushed history, remap doc SHAs, then push

wp5 stopped at a user decision: publish `.codexclaw/` on a PUBLIC remote, or clean it first. wp6 does **not**
claim that decision is void. It narrows the decision to the part that is genuinely user-owned and executes the
part that is not.

## Retracted argument (A-audit CRITICAL/MAJOR, accepted)

A first draft of this plan argued the hold was void because the unpushed range carried ~120MB of unique
`.codexclaw` blobs. The independent auditor disproved it:

| claim | reality |
|---|---|
| 119.9MB unique blobs | 114.7MB raw, 113.9MB unpublished; 7 cache-DB versions, not 8 |
| "what a push transfers" | an isolated pack of those blobs is **3.71MB** — raw blob sum is not transfer cost |
| "`.gitignore` already declares the intent for the directory" | the rules cover **16 of 133** tracked files; the other 117 (88 `evidence/`, 18 `goalplans/`, 6 `sessions/`, …) are explicitly marked *undecided* by the comment on `.gitignore:101` |

Size was the wrong axis, and using it to overrule a recorded user decision was rationalization. The argument
is withdrawn. What follows rests on a different footing.

## The actual basis for acting

The decision is **asymmetric in reversibility**, and only one branch of it stays reversible:

- Push now → the blobs are public forever. Retracting them later needs a history rewrite **plus a public
  force-push**, which the loop's own rules forbid without explicit instruction.
- Strip now → nothing is lost. The files stay on disk untouched (only Git stops tracking them), the old graph
  stays addressable via a local backup ref, and re-adding them later is one `git add -f`.

So "strip, then push" preserves the user's ability to decide either way; "push as-is" destroys it. wp5's hold
was correct in refusing to publish unilaterally, but holding the *entire* 326-commit chase body hostage to a
question about a tool's scratch directory is itself a decision — and the more expensive one.

Two further facts bound the scope:

- **`evidence/` (88 files) is not load-bearing for the product.** No tracked file outside `.codexclaw/`
  references any of those 88 filenames (checked by exact-string search over the whole worktree), and the
  chase corpus that *is* published lives in `struct_har/chase/_fin/` (97 + 64 cards). Nothing in the repo's
  documented state depends on `.codexclaw/evidence/` being published.
- **This is not a retraction operation.** The 6 files already on `origin/main` stay there. wp6 only declines
  to *add* 227 more unpublished blobs.

What stays user-owned and is NOT decided here: whether the already-public 6 files get force-push-retracted,
and whether `.codexclaw/evidence/` should be *deliberately* published later as project history. Both are
recorded as open in the closeout.

## What is and is not already published

| ref | `.codexclaw/` files |
|---|---|
| `origin/dev` | **0** — never published there |
| `origin/main` | 6 — `bridge.db`, `friction.jsonl`, one interview JSONL, `session.md`, one session JSON, `subagents.json` |

Those 6 blobs stay in `origin/main`'s history no matter what wp6 does; retracting them needs a public
force-push, which stays out of scope. wp6's goal is narrower and fully reversible-free: do not *add* 120MB.

## Rewrite scope — published SHAs must not move

`dev` is 326 commits ahead of `origin/dev`, but 218 of those are reachable from `origin/main` and are
therefore already published. Rewriting them would fabricate divergence against a pushed branch.

Per the A-audit MAJOR, scope must be proven against **every advertised remote ref**, not just two. All of them
are now fetched locally (`origin/preview`, `refs/pull/1|2/head` as `origin-pr/*`, tag `v1.0.0`):

```
git rev-list --count dev main --not origin/dev origin/main origin/preview origin-pr/1 origin-pr/2 v1.0.0
→ 108                                   # identical to the two-ref scope
intersection with all published refs    → 0
```

So the rewrite set is exactly **108 commits**, of which **36** touch `.codexclaw/`, and it intersects nothing
published anywhere on the remote. The auditor independently confirmed that `filter-branch`'s internal
`--simplify-merges` walk selects the same 108 commits with a zero intersection against published history, and
that excluded parents keep their original SHAs because they have no map entry.

`origin/main` is an ancestor of `dev`, and `main` is an ancestor of `dev`. Local `main` contributes 30
selected commits, 3 of which prune away, leaving a rewritten 27-commit chain still rooted at an unchanged
`origin/main` — so `git push origin main` stays a fast-forward after the rewrite.

## Steps

0. **Preserve the live runtime state outside the repo.** `filter-branch` refuses to run on a dirty tree
   (`require_clean_work_tree`), and on exit it runs `git read-tree -u -m HEAD`, which **deletes** the
   now-untracked `.codexclaw` files from the working tree. So: copy `.codexclaw/` to a path outside the repo,
   commit this plan file plus the current runtime checkpoint (that commit joins the rewrite set and is itself
   stripped), then restore the copy afterwards as ignored-but-present files. The loop keeps its state.
1. Create backup refs under `refs/wp6-backup/{dev,main}` — **not tags**, so a later `git push --tags` cannot
   republish the garbage-bearing graph (A-audit MAJOR).
2. `git filter-branch --state-branch refs/wp6/filter-map
   --index-filter 'git rm -r --cached --ignore-unmatch .codexclaw' --prune-empty
   -- dev main --not origin/dev origin/main`.
   `--state-branch` is required: `.git/filter-branch/map` does not exist in Git 2.50.1, the real map lives in
   `.git-rewrite/map` and is deleted on exit, and `refs/original/` preserves only branch tips. Without it,
   step 5 is impossible (A-audit CRITICAL).
3. Verify: `git ls-tree -r dev -- .codexclaw` empty; no commit in the new range touches `.codexclaw/`; all
   published refs unchanged; `main` still an ancestor of `dev`; and the non-`.codexclaw` tree at the new `dev`
   tip **byte-identical** to the old tip (`git diff refs/wp6-backup/dev dev -- . ':!.codexclaw'` empty).
4. Extend `.gitignore` from the 3 prefix rules to the whole `.codexclaw/` directory, and replace the
   now-false "until their publication is decided" comment with what was actually decided.
5. Remap doc-cited SHAs from `git show refs/wp6/filter-map:filter.map` — 45 documents cite **56** short SHAs
   across 173 occurrences (the auditor's count supersedes the earlier 54/44). Match on the full old SHA, emit
   freshly-computed unique abbreviations, and for the 12 pruned commits cite the surviving parent rather than
   inventing a SHA. Then re-run the closure-integrity gate to prove every citation resolves.
6. Re-run the gates on the rewritten `dev` (`check:ts`, `verify-g002-gates`, `check-visible-definitions`,
   `rebrand-inventory --strict`, `default-jwc-definitions`, `ci:test:smoke`, both chase gates).
7. `git push origin dev` → `git checkout main && git merge --ff-only dev` → gates → `git push origin main`
   → back to `dev`, report exact local/remote SHAs.

## Risks and how each is contained

| risk | containment |
|---|---|
| rewrite touches published commits | scope excludes every advertised remote ref (branches + PR heads + tag); intersection measured at 0; re-verified immediately before push |
| source content silently altered | `git diff` old-tip vs new-tip excluding `.codexclaw` must be empty |
| `--prune-empty` drops a meaningful commit | exactly 12 of the 36 become empty, all `.codexclaw`-only, all with a selected single parent; the merge `3162bf8` is retained because only single-parent commits are pruned; the list is enumerated in the closeout |
| docs cite dead SHAs | step 5 remaps all 56 via `--state-branch`, and the closure-integrity gate re-runs to prove every cited SHA resolves |
| loop state deleted by `filter-branch`'s exit `read-tree -u` | step 0 copies `.codexclaw/` outside the repo first and restores it after |
| backup graph accidentally republished | backups live under `refs/wp6-backup/`, which no push refspec or `--tags` touches |

## Explicitly out of scope

- Force-pushing to retract the 6 files already on `origin/main`.
- The 12 card-id collisions and the 136 legacy `_fin` cards — still user decisions.
- `packages/tui/src/tui.ts` and `modes/components/welcome.ts` — user-curated, untouched.
