# P1.5.3 C failure synthesis

> C reviewer: `agent://21-P153CAdversarial`
> Verdict: FAIL

## Findings

### C-P153-1 — grep + unavailable digest paths unverified

Root cause: implementation/test gap. `resultDigest()` supports `grep` and `search digest unavailable`, but `pruning-redteam.test.ts` only tested bash and parseable search.

Decision: route to B/code+test fix. Add redteam cases for grep count digest and unparseable search fallback.

### C-P153-2 — bash tail/error digest extraction under-tested and currently truncated away

Root cause: implementation/test mismatch. The source builds `exit=`, `tail=`, and `error=` fields, but the bounded notice char budget can truncate the digest to `exit=...` only. The plan requires tail/error when available.

Decision: route to B/code+test fix. Keep bounded notices but add a small additive digest budget so the digest can include exit/tail/error summaries while staying compact. Then assert `tail=` and `error=` in the bash redteam test.

## Rejected routes

- Plan route: rejected; the stated acceptance is useful and matches the intended upstream digest value.
- Spec route: rejected; requirements are clear.
- Environment route: rejected; no tooling failure.

## Verification after fix

- `bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts`
- focused biome command from plan
- `bun --cwd=packages/agent run check`
