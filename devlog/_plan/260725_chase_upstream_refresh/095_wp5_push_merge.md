# 095 — wp5: push dev, merge into main, push main

Pre-approved by the user at goal start ("푸시하고 main에 머지해놔"). This is the only phase that changes
external state, so the pre-push state is recorded before acting.

## Pre-push state (2026-07-26)

- `dev` is **319 commits ahead** of `origin/dev`, **0 behind** — fast-forward, no divergence.
- `main` is **30 commits ahead** of `origin/main`, **0 behind** (the pre-session housekeeping commits).
- Working tree: only `.codexclaw/` runtime state pending.

## Gates before push

| gate | result |
|---|---|
| `bun run check:ts` | exit 0 |
| `bun scripts/verify-g002-gates.ts` | PASS |
| `bun scripts/check-visible-definitions.ts` | PASS |
| `bun scripts/rebrand-inventory.ts --strict` | exit 0 |
| `bun test packages/coding-agent/test/default-jwc-definitions.test.ts` | 21/21 |
| suites (ai + agent + utils + stats) | 2238 pass, 0 fail |

## Steps

1. `git push origin dev` — publish the 319 commits.
2. `git checkout main && git merge dev` — expect fast-forward or a clean merge; `main` has 30 unpushed commits that `dev` already contains via the earlier `main→dev` merge (3162bf8), so verify before merging.
3. Re-run `check:ts` on `main` after the merge (a merge can resurrect a stale file even when both sides were green).
4. `git push origin main`.
5. Return to `dev` and report exact local/remote SHAs for both branches.

## Accept criteria

- E1: `git ls-remote origin refs/heads/dev` equals local `dev` HEAD.
- E2: `git ls-remote origin refs/heads/main` equals local `main` HEAD.
- E3: post-merge `main` passes `check:ts` (exit 0).
- E4: no force-push, no history rewrite, no branch deletion — only fast-forward or a clean merge commit.
- E5: exact SHAs reported for both branches, before and after.
