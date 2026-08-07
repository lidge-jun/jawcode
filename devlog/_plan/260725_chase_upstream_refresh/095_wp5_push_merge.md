# 095 — wp5: push dev, merge into main, push main

Pre-approved by the user at goal start ("푸시하고 main에 머지해놔"). This is the only phase that changes
external state, so the pre-push state is recorded before acting.

## Pre-push state (2026-07-26, refreshed after the A-audit)

- `dev` is **320 commits ahead** of `origin/dev`, **0 behind** (the plan commit itself added one) — fast-forward, no divergence.
- `main` is **30 commits ahead** of `origin/main`, **0 behind**; `git merge-base --is-ancestor main dev` succeeds, so `main` is an ANCESTOR of `dev` and the promotion is a pure fast-forward with no 3-way merge and no stale-file resurrection.
- Working tree: `.codexclaw/` runtime state pending — must be settled before any `git checkout main`, or the checkout aborts.
- **The remote is PUBLIC** (`gh repo view` → `"visibility":"PUBLIC"`).

## BLOCKING FINDING — `.codexclaw/` runtime state would be published irreversibly

`.codexclaw/` is tracked (133 files, **18MB**) with no ignore rule covering the already-tracked files. It
entered the tree in a prior round's commit `f399dada`, not by a deliberate decision to publish it.

**Correction (C-review):** an earlier draft claimed `.codexclaw/` is absent from BOTH remotes. That is wrong —
`origin/main` already publishes 6 files: `bridge.db`, `friction.jsonl`, an interview JSONL, `session.md`, a
session JSON, and `subagents.json`. So the accurate framing is not "publishing something entirely new" but
"expanding an accidental exposure by ~18MB", including the 15MB cache DB, the `.val` blobs, every goalplan
ledger, and this session's state — none of which is on either remote today.

That correction does not weaken the hold: prior accidental exposure is not consent to a much larger one, and
this is still the last moment to clean it without a public force-push.

| path | size | nature |
|---|---|---|
| `cache/repomap/tags.v1/cache.db` | 15MB | tree-sitter symbol cache (SQLite) |
| `friction.jsonl` | 860KB | tool-failure log containing working text |
| `bridge.db` + 14 `.val` blobs | ~200KB | binary caches |
| `sessions/*.json`, `ledger.jsonl`, goalplans | rest | session phase state |

No token/key patterns were found and the session JSON is phase/ID-shaped rather than transcript-shaped, but
`friction.jsonl` carries working text and many files embed `/Users/jun/...` absolute paths.

**Why this is a stop-and-ask rather than a judgment call:** on a PUBLIC remote, a later delete commit does not
remove the objects — only a history rewrite plus force-push would, which is exactly the irreversible operation
the loop is meant to avoid. Cleaning it now costs one local rewrite of unpushed history; cleaning it later
costs a public force-push. 51 of the 320 unpushed commits touch `.codexclaw/`.

Options put to the user: (A) strip `.codexclaw/` from the unpushed history + add a `.gitignore` rule, then
push; (B) push as-is; (C) hold the push. Recommendation: **A**.

## Gates before push

| gate | result |
|---|---|
| `bun run check:ts` | exit 0 |
| `bun scripts/verify-g002-gates.ts` | PASS |
| `bun scripts/check-visible-definitions.ts` | PASS |
| `bun scripts/rebrand-inventory.ts --strict` | exit 0 |
| `bun test packages/coding-agent/test/default-jwc-definitions.test.ts` | 21/21 |
| suites (ai + agent + utils + stats) | 2238 pass, 0 fail |
| `bun run ci:test:smoke` | exit 0 — `smoke-test: ok` (added per A-audit; CLI/native/worker surface changed broadly) |

## Steps

0. **Resolve the `.codexclaw/` publication decision with the user** (blocking — see above), and settle the dirty runtime files so `git checkout main` cannot abort.
1. `git push origin dev` — publish the 320 commits.
2. `git checkout main && git merge --ff-only dev` — `main` is an ancestor of `dev`, so require a fast-forward and let the command FAIL rather than silently creating a merge commit.
3. Re-run `check:ts` on `main` after the merge (a merge can resurrect a stale file even when both sides were green).
4. `git push origin main`.
5. Return to `dev` and report exact local/remote SHAs for both branches.
6. Immediately before step 1, re-verify remote SHAs and ancestry (`git fetch` + `rev-list --left-right`) — the audit's topology reading was taken from local refs.

## Accept criteria

- E1: `git ls-remote origin refs/heads/dev` equals local `dev` HEAD.
- E2: `git ls-remote origin refs/heads/main` equals local `main` HEAD.
- E3: post-merge `main` passes `check:ts` (exit 0).
- E4: no force-push, no history rewrite, no branch deletion — only fast-forward or a clean merge commit.
- E5: exact SHAs reported for both branches, before and after.
- E6: the `.codexclaw/` publication decision is explicitly recorded before the first push.
- E7: `bun run ci:test:smoke` exits 0 before pushing.
