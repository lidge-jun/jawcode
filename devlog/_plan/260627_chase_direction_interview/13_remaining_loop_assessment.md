# Remaining-loop assessment — test-env blocker vs C3/C4 closure rigor

> WP4 entry assessment (2026-06-27). After WP1–WP3 (interview directions recorded, 6 reference
> cards retired, 10.013 coded), the remaining goal-target cards are the **prior-decided** set.
> This note records why proper closure of that set is impeded, for the Stop/Pause Audit.

## Test environment is broadly broken (confirmed, pre-existing, out of scope)

- The native version drift is NOT TUI-only: an isolated non-TUI test
  (`test/goals/goal-mode-integration.test.ts`) ALSO fails at native load via
  `packages/utils/node_modules/@jawcode-dev/natives`. Nearly all coding-agent runtime tests
  load `@jawcode-dev/utils` → natives, so they are blocked.
- Version desync is multi-way: node_modules loader expects sentinel `__piNativesV1_0_2`; the
  crate source (`crates/pi-natives/src/lib.rs`) exports `nV1_0_4`; `packages/natives/package.json`
  is `1.0.6`. A local crate rebuild produces 1.0.4, still ≠ the installed 1.0.2 loader.
- A second pre-existing failure also surfaces in bulk runs: `packages/utils/src/prompt.ts:458`
  `Cannot access 'compiledTemplateCache' before initialization` (TDZ).
- Fixing these = native release-version re-sync + `bun install` (lockfile/native side effects the
  260626 refresh explicitly fenced off) — **out of scope** for the chase-card goal and prior-deferred.

## Remaining goal-target cards are C3/C4 (need test verification)

| card | nature | class | clean diff-only close? |
|------|--------|-------|------------------------|
| 10.002 ai_auth | auth/oauth divergence | **C4** | NO — see below |
| 10.003 cursor | provider integration | C2/C3 | maybe (diff) |
| 10.005 task_subagent | forkContext gating | C3 | done-gate demands focused tests (blocked) |
| 10.007 team tmux self-heal | **net-new code** | C3 | NO — needs new code + tests |
| 10.012 goal steering | **large net-new** (6 commands) | C3 | NO — needs code + tests |
| 10.021 redteam · 10.023 task-notif · 10.024 coordinator-mcp | split | C2/C3 | per-card diff TBD |
| 20.005 steering · 20.006 tui-input | behavioral / TUI | C2/C3 | tests blocked |

### 10.002 diff evidence (why it is not a clean tsc-only close)

- ✅ jwc already has the high-priority `utils/oauth/local-token-detect.ts` and `providers/kiro.ts`.
- ⚠️ `packages/ai/src/auth-storage.ts` diverges **349 lines** from gjc; oauth files differ
  (anthropic, google-*, kimi, openai-codex, index); gjc adds providers jwc lacks (`fugu.ts`,
  `glm-zcode.ts`).
- This is **C4 (auth/security)**. Whether the 349-line divergence hides upstream auth fixes jwc
  should adopt — vs jwc's intentional fork — cannot be responsibly certified tsc-only. Forcing a
  "conscious-hold" close to satisfy the loop would be unfaithful for an auth surface.

## Assessment

- The goal gate is "tsc/test/diff"; tsc+diff CAN close pure documentation/diff-judgment cards
  where jwc is demonstrably adequate and **no code changes**.
- But the remaining set is dominated by net-new code (10.007, 10.012) and C3/C4 surfaces
  (10.002 auth, 10.005 gated subagent) whose faithful closure needs runtime test verification —
  which is broadly blocked.
- This is a genuine capability impediment (cannot run tests) tied to a user/infra decision
  (authorize fixing the native/test env, which is out-of-scope release work) — exactly the
  "human judgment on a business/process decision" stop condition.

## Recommendation

Pause the loop with the agent/audit form after an independent review, and surface the decision:
either (a) authorize a test-env restoration pass (native re-sync) so the remaining C3/C4 cards
can be properly closed with tests, or (b) explicitly accept tsc/diff-only closure rigor for the
remaining set. Session work to date (interview + WP1–WP3) is complete and verified.
