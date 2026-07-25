# WP9 — 10.059 deep-interview wording · ask gate · render guard (ADAPT+IMPORT)

> Goal `f8909338-255` · cluster C (goal/interview UX) · card `struct_har/chase/10.059_gjc_chase_deep_interview_ask_ralplan_gate.md`
> Source: GJC `fa995807..20c299eb` v0.7.8, 6-commit interview/ask/render cluster. **1:1 port ❌ — JWC-native reconcile.**
> Decision (2026-07-01 interview): **Tier ① · ADAPT(gate/wording)+IMPORT(render guard)**.

## 6 sub-feature triage

| # | GJC commit | feature | JWC surface | disposition |
|---|---|---|---|---|
| 1 | `20c299eb` | deep-interview keeps implementation wording in interview phase | `defaults/jwc/skills/jaw-interview/SKILL.md` (phase-boundary wording absent) | **ADAPT** — JWC-authored wording + contract test |
| 2 | `eef6ec3a` | accept long inline `--spec` (ENAMETOOLONG) | `jwc-runtime/jaw-interview-runtime.ts:121` (identical guard, ENAMETOOLONG missing) | **IMPORT** — 1-line defensive guard + test |
| 3 | `f1343220` | avoid noisy optional settings reads | `jaw-interview/SKILL.md:78-98` | **ALREADY COVERED** — JWC already says native activation owns settings precedence; skill must not read settings files directly. No change. |
| 4 | `bb6f0e98` | ralplan uses ask approval gate | JWC `plan` skill is **SUPERSEDED** (native orchestrate P). Reusable value = `ask` tool `workflowGate` **stage** override (`tools/ask.ts` + `jaw-interview-gate.ts` hardcode `stage:"jaw-interview"`) | **ADAPT (stage-only)** — add optional `workflowGate.stage` override so plan/goal-staged ask prompts emit a correctly-addressed gate; **kind stays `"question"`** (audit James: `questionToGate` always builds question-answer schema `selected`/`custom`; approval/execution gates use a `decision` contract — a `kind` override would mismatch the schema) |
| 5 | `19408acc` | ultragoal ask-guard scoped to active session | JWC has **no** ultragoal-ask-guard; `jwc-runtime/goal-guard.ts` uses completion-receipt arch, `tools/ask.ts` has no goal/ultragoal guard wiring | **DEFER ③** — no JWC surface (cross-session ask hijack path does not exist in JWC) |
| 6 | `2bc0e2c5` | guard renderer string helpers against undefined | `tools/render-utils.ts` (`getPreviewLines`, `shortenPath`), `tools/eval.ts:757` (git_log unsafe cast), `packages/tui/src/utils.ts` (`truncateToWidth` no safeText) | **IMPORT** — pure defensive crash-safety; `render-middleware.ts`/`normalizeText` absent in JWC (no surface, skip) |

## Slices (atomic)

### Slice A — render undefined guard (IMPORT) [LIGHT, pure-defensive]
- `tools/render-utils.ts`: `getPreviewLines` → `if (typeof text !== "string") return [];`; `shortenPath` → `if (typeof filePath !== "string") return "";`
- `tools/eval.ts:757`: git_log cast `{sha:string; subject:string}` → `{sha?:string; subject?:string}` + `String(entry.sha ?? "")` / `String(entry.subject ?? "")`.
- `packages/tui/src/utils.ts` `truncateToWidth`: add `const safeText = typeof text === "string" ? text : String(text ?? "");` and pass `safeText` to native call; update the existing napi-guard comment.
- Tests: extend `packages/tui/test/issue-848-repro.test.ts` (+2 cases: text undefined→"", null→""); extend `packages/coding-agent/test/tools/render-utils.test.ts` (getPreviewLines/shortenPath nullish→[]/"" ).

### Slice B — long inline --spec guard (IMPORT) [LIGHT]
- `jwc-runtime/jaw-interview-runtime.ts:121`: add `&& err.code !== "ENAMETOOLONG"` so an oversized inline `--spec` string mistaken for a path falls through to verbatim spec content instead of throwing.
- Test: `test/jwc-runtime/jaw-interview-runtime.test.ts` — long inline --spec (>NAME_MAX) returns the inline content.

### Slice C — ask workflowGate stage override (ADAPT, stage-only) [STANDARD]
- **Audit fix (James FAIL):** kind override is unsafe — `questionToGate` always emits a question-answer schema (`selected`/`custom`); approval/execution gates use a `decision` contract (`approval-gate.ts`). So override **stage only**; kind stays `"question"`.
- `tools/ask.ts`: add `WorkflowGateMeta = z.object({ stage: z.enum(["jaw-interview","deep-interview","plan","planphase","goal"]) })` optional on `QuestionItem`; forward `workflowGate` into the gate question. (No `kind` field.)
- `modes/shared/agent-wire/jaw-interview-gate.ts`: add `AskGateWorkflowGateMeta { stage: RpcWorkflowStage }`, optional `workflowGate?` on `AskGateQuestion`; `questionToGate` uses `stage: question.workflowGate?.stage ?? "jaw-interview"`, `kind: "question"` (unchanged). Import `RpcWorkflowStage` type only.
- Note: JWC `RpcWorkflowStage` = `"jaw-interview"|"deep-interview"|"plan"|"planphase"|"goal"`. Enum the JWC-valid stages (NOT GJC's `ralplan`/`ultragoal`).
- Test: `jaw-interview-workflow-gates.test.ts` — a question with `workflowGate:{stage:"plan"}` emits a gate addressed to `plan` with `kind:"question"` and the same question-answer schema; default question stays `jaw-interview`/`question`.

### Slice D — interview phase-boundary wording (ADAPT) [LIGHT, JWC-authored content]
- `defaults/jwc/skills/jaw-interview/SKILL.md`: after the "Do not proceed to execution until ambiguity ≤ ..." line, add JWC-authored wording: treat user words `implementation`/"구현"/"구현 계획" as describing the eventual target, not permission to implement during interview; while interviewing do not implement/edit/launch workers; offer "interview for an implementation plan, but won't implement during jaw-interview"; implementation needs explicit phase transition + downstream execution approval. JWC naming (jaw-interview, orchestrate P), no `gjc`/`deep-interview`/`ralplan`/`ultragoal` literals.
- Test: `jaw-interview-skill-policy.test.ts` — assert the SKILL.md contains the phase-boundary contract phrases.

## Order & verification
1. Slice A (render guard) → `bun test issue-848-repro.test.ts render-utils.test.ts` + tui build n/a (pure TS).
2. Slice B (--spec) → `bun test jaw-interview-runtime.test.ts`.
3. Slice C (workflowGate) → `bun test ask.test.ts jaw-interview-workflow-gates.test.ts`.
4. Slice D (wording) → `bun test jaw-interview-skill-policy.test.ts`.
- Gate each: `cd packages/coding-agent && bun run check:types` EXIT 0; `bunx biome check --write <files>`; naming guard 0 new gjc/gajae/oh-my-pi/ralplan/ultragoal literals (added lines); `git diff --check` clean.
- A-phase: independent gpt-5.4 explorer audits triage (esp. #3 already-covered, #5 defer-no-surface, #4 superseded-plan reframe) before B.
- DEFER ③: #5 ultragoal session-scope (no JWC ultragoal-ask-guard). #6 render-middleware normalizeText (no JWC surface).

## Acceptance
| criterion | evidence |
|---|---|
| render helpers never throw on undefined/null | tui + render-utils tests pass |
| oversized inline --spec accepted | jaw-interview-runtime test passes |
| ask can address plan/goal workflow gate stage (kind stays question) | workflow-gate test passes |
| interview wording forbids in-phase implementation | skill-policy test passes |
| no JWC naming regressions | naming guard 0; diff --check clean; tsgo 0 |
