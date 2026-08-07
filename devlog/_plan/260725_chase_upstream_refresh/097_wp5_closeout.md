# 097 — wp5 closeout: promotion prepared, publication decision escalated

Outcome: **NEEDS_HUMAN** — everything the loop can decide is done; the one remaining step needs a user call.

| phase | evidence |
|---|---|
| P | `095_wp5_push_merge.md` — pre-push state, ordered steps, 7 accept criteria |
| A | Maxwell GO-WITH-FIXES (4) → `096`: topology refreshed, `--ff-only` enforced, dirty state settled before checkout, `ci:test:smoke` added AND executed. Blocker 2 escalated |
| B | worktree settled, ancestry re-verified, `.gitignore` added for future codexclaw caches/blobs/friction log WITHOUT rewriting history |
| C | Gauss GO-WITH-FIXES (1) → corrected a factual error in our own write-up; hold judged CORRECT |

## Final verified state

| ref | SHA |
|---|---|
| local `dev` | `afadf7d72adcaf430056e91f4cf624fcbb2769cd` |
| local `main` | `0cf88f3d3905cc1fc70067f2363d59fc28b8e012` |
| remote `dev` | `c353d7b50cbd8cea2be86f5775f1ebd2372f24fa` |
| remote `main` | `44c9fa8fa6a09f841ffd068bfffd142da5f49b6a` |

`dev` is 325 ahead / 0 behind `origin/dev`; `main` is an ancestor of `dev` (`--ff-only` safe); worktree clean.

Gates re-run by the reviewer independently at this HEAD: `check:ts` 0, G002 PASS, visible-definitions PASS,
rebrand `--strict` 0, default-jwc-definitions 21/21, `ci:test:smoke` `smoke-test: ok`, `git diff --check` clean.

## Why the push is held

The repo is PUBLIC. `.codexclaw/` is 133 tracked files / 18MB with no ignore rule covering what is already
tracked, and 53 of the unpushed commits touch it. Pushing publishes the 15MB tree-sitter SQLite cache, binary
`.val` blobs, every goalplan ledger, and this session's state.

**Correction the C-review forced on us:** 6 `.codexclaw` files are ALREADY on `origin/main` (`bridge.db`,
`friction.jsonl`, an interview JSONL, `session.md`, a session JSON, `subagents.json`). So this is not a brand-new
exposure — it is expanding an accidental one by ~18MB. The reviewer judged the hold correct anyway: prior
accidental exposure is not consent to a larger one, and a public delete commit cannot retract blobs.

Sensitivity, verified by the reviewer rather than asserted by us: no tokens, keys, `ghp_`, Bearer credentials,
private keys or passwords. 242 `/Users/jun/...` absolute-path matches. Session JSON is workflow metadata, not
transcripts. Goalplan ledgers expose objectives and work plans in detail. `friction.jsonl` contains normalized
command output, source snippets and diffs — file content, not user prompts (our earlier wording overstated this).

## What was NOT done, deliberately

- No history rewrite, no `git rm --cached`. The reviewer agreed `rm --cached` would be worse: it hides the files
  at the tip while the blobs still publish from the 53 earlier commits, producing a "deleted but public" state.
- The `.gitignore` addition only stops FUTURE contamination; 16 currently-tracked files remain tracked.

## The decision

- **A** — strip `.codexclaw/` from the unpushed history, then push → merge `--ff-only` → push (recommended).
- **B** — push as-is, accepting the expansion. Reviewer: safe to execute immediately given the worktree is now
  clean and ancestry re-verified.
- **C** — hold the push; work stays committed locally.
