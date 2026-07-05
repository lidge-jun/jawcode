# [PABCD — C: CHECK]

You are now in Check mode — a five-stage verification gate (D050-9/17): mechanical verification → adversarial review → SoT sync → render grounding (conditional) → verdict.

Stage 1 — Mechanical verification (this repo):
- Run the project's gates: `bun run check` (workspace) and the affected test files; for repo-wide changes also `bun run check:ts` at the root (includes the rebrand inventory gate).
- In other repositories, detect the project's own convention (package.json scripts, Makefile, CI config) and run the closest typecheck + test gates.
- All gates must be green. A red gate/review requires a C failure synthesis before routing: failing command output or adversarial finding, affected acceptance criterion, local repo/AST evidence checked, read-only executor investigation if used, web-first prior-art/common-practice evidence when route or strategy is disputed, Context7/library evidence when used, chosen route (code issue → `orchestrate b`, plan issue → `orchestrate p`, spec issue → `orchestrate i`, or environment/tooling issue with evidence), and rejected routes with reasons.

Stage 2 — Adversarial review:
- Re-read the diff against the plan's acceptance criteria line by line. Hunt for: silent scope drift, unverified claims, missing error handling at boundaries, doc/code mismatch.

- Runtime actor note: compatible C-stage reviewer lanes (`c:mechanical-check-reviewer`, `c:adversarial-reviewer`) may resume within the same C-stage namespace on reruns. C→B/P/I routing retires C-stage lookup before the target stage starts; never carry C reviewer actors across stages.

Stage 3 — SoT sync (DEFAULT, SOT-SYNC-01):
- Locate the repo's general source-of-truth docs (`structure/`, architecture/INDEX docs, or equivalent) — identified in P; patch them HERE so documentation and code never diverge silently. If the repo has no SoT doc, recommend creating one in the D summary.

Stage 4 — Render grounding (conditional — skip when not applicable):
When the work-phase produced an artifact whose correctness only shows when run or rendered (HTML page, SVG, game, UI, chart, animation, script with observable visual/interactive output), first mark it in-scope — `jwc orchestrate verdict --render-pending` (this arms the c→d soft warning until you resolve it) — then run the render-grounding loop before proceeding to verdict:
1. **RUN** it in its natural execution environment — headless-browser screenshot for web (1280x720 default), SVG→PNG render, execute scripts, drive games/wizards until the first interactive state change.
2. **OBSERVE** the output — actually read the screenshot/console back; a produced-but-unread screenshot is not observation.
3. **FIX** what the observation reveals, then re-run and re-observe. Stop after one clean observation; re-render only after a change.
Trigger on artifact type + change ("could this look or behave wrong in a way that only shows when it runs?"), never on task depth alone. Excluded: pure logic/config/prose covered by its own test suite. Record the verdict: `jwc orchestrate verdict --render-observed` (or `--render-not-applicable` if no render artifacts). Evidence scales with class: C2-C3 reference the observation in attestation narrative; C4 additionally persists the screenshot to the devlog.

Stage 5 — Verdict:
- Report: gates run (commands + results), acceptance criteria met/not-met, residual risks.
- All green → proceed automatically. Anything red → route back per stage 1.

When all gates are green → run `jwc orchestrate d` yourself via the shell tool immediately (no user approval required for C→D).
