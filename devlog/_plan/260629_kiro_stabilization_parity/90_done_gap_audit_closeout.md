# 90 — Done: Kiro stabilization parity closeout

opencodex `dev` Kiro adapter (31 commits, split `src/adapters/kiro-*.ts`) was used as the source of
truth. Each opencodex hardening was reimplemented in jawcode's single-file idiom and locked with
tests. Every phase was committed independently with a devlog record.

## Shipped (B1–B7)

| Phase | Change | Commit |
| - | - | - |
| B1 | Skip synthetic thinking tags in tool/continue mode | c1ddc8b |
| B2 | Estimated token usage + context-usage percentage | 0998014 |
| B3 | Truncation detection + fail-closed surfacing | 42359cb |
| B3b | Fallback prose for unstructured tool calls/results (structuredToolIds) | b627884 |
| B4 | Per-attempt 100s request/stream timeout | 240926d |
| B5 | Validate/infer region for runtime token refresh | 09a5b05 |
| B6 | Codex MCP-call parity — verified N/A (no web-search sidecar; names verbatim) | fb00718 |
| B7 | aws-eventstream frame/header bounds + catalog #404/#489 (dangling work landed) | 6801723, c8a65f4 |

## PABCD check fixes (gpt-5.5 reviewers)

- B3 stale `tool_stop`: a delayed stop for an already-finalized tool could finalize/validate a
  different open tool in parallel streams. Fixed to ignore a stop whose `toolUseId` != the open
  tool. (commit b80c2ea)
- B1 SoT drift: opencodex HEAD reverted the "skip thinking when tools advertised" rule (b496629 →
  b19d4a0). Re-aligned to HEAD — injection is skipped only for `toolResults` / `"(continue)"` /
  fallback carriers, not on tool advertisement. (commit 719cd3e)
- Final gpt-5.5 re-verification of both fixes: GO.

## Verification

- Full `packages/ai` suite: 1376 pass, 0 fail, 337 skip (the 3 previously-noted #404/#489 failures
  are now fixed by B7). New Kiro regression coverage: payload (24), usage (6), truncation (5),
  region (4), stream-integration (11), plus errors/thinking/stream suites — all green.
- `bun run check:types` (packages/ai): clean.
- biome check on all touched Kiro files: clean.
- Independent subagent reviews: an initial gap audit (validated the inventory, surfaced the B3b
  structuredToolIds risk + runtime-OAuth split) and a final PABCD check review.

## Deliberate divergences from opencodex (documented, not gaps)

- jawcode keeps the shared `fetchWithRetry` retry surface (5xx/408/429) rather than opencodex's
  fixed status set; only the missing per-attempt timeout was added.
- The fail-open `{_raw}` finalize remains reachable ONLY from the reviewed parallel-tool
  interleaving recovery; normal stop / end-of-stream now fail closed on incomplete JSON.
- The login-flow `utils/oauth/kiro.ts` keeps its `us-east-1` refresh URL (initial-login surface);
  runtime refresh now validates/infers region. A full port of opencodex's 256-line credential
  importer (enterprise SSO, aws_sso_oidc, structured diagnostics) is a separate login-surface task.

## Residual / follow-up

- Live smoke (`tool use 10개`, long/parallel sessions) is the user's to run; it cannot be verified
  here.
- Optional future parity: port the broader opencodex credential importer to the login surface; align
  the retry status set if exact parity is ever required.
