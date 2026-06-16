# [PABCD — A: PLAN AUDIT]

You are now in Plan Audit mode. This stage audits YOUR PLAN — not code. Independent subagents verify feasibility and integration risk before any coding begins (D050-20).

⚠️ You MUST spawn audit subagents. Do NOT skip this stage or declare it unnecessary.

Steps:
1. Audit mode is decided AT ENTRY (D050-21): before running `orchestrate a`, apply the trivial predicate to the plan diff — single file, single behavior, explicit acceptance criteria → enter with `--audit-mode solo`; otherwise `--audit-mode dual` (default). `--deliberate` forces `dual`. The mode is persisted in ctx (`a_audit_mode`).
2. Spawn the auditors IN PARALLEL (dual) or Architect only (solo). Use the normal task tool call; the runtime may resume compatible A-stage audit actors (`a:planner-auditor`, `a:architect-auditor`) within the same PABCD namespace and retires them on stage transition:
   - **Planner lens** — plan coherence: every decision covered, acceptance criteria sufficient, no ambiguous steps.
   - **Architect lens** — integration risk: imports resolve, signatures match real code, no copy-paste hazards, gates/CI impact.
   - Fetch each spawn prompt with `orchestrate audit-prompt planner` / `orchestrate audit-prompt architect` — these fix the output contract to `PASS | FAIL` + itemized findings (severity, file:line evidence, fix suggestion). Do NOT use the embedded legacy-vocabulary planning prompts for stage-a audits (D050-23).
3. Record each lens verdict with `orchestrate verdict --audit-lens planner|architect --revision-id <a-revision-id> --worker-output <report-file>`. If any lens FAILs:
   - Do NOT accept the auditor passively. Write an A-stage synthesis before changing the plan or requesting re-audit: lens finding IDs, original design intent, shared root cause, conflicts between Planner and Architect suggestions, local repo/AST evidence, read-only executor investigation if used, web-first prior-art/common-practice evidence when design or strategy is disputed, Context7/library evidence when used, chosen compromise, waived/rejected findings and why, exact plan sections changed, and residual risk.
   - If the auditor is right, revise the plan and record the synthesis for the next revision before delta re-audit. If an auditor finding is wrong or over-blocking, document the waiver in the synthesis; do not convert the overall audit to PASS by overwriting a scalar verdict. Rely on runtime aggregate status or explicit user approval for unresolved waivers.
   - Re-run a DELTA re-audit on the synthesis packet plus changed sections and unresolved finding IDs. Round cap: `a_round ≤ 3`. If still failing after round 3, STOP and escalate to the user.
4. On PASS: report PASS only when the runtime aggregate audit status is pass for the current revision — Architect PASS in solo mode; Planner + Architect PASS in dual mode. A single lens PASS is not enough in dual mode. Then report findings + resolutions to the user.

⛔ STOP after reporting. WAIT for user approval.
⛔ When the user approves (audit_status=pass is required), run `jwc orchestrate b` yourself via the shell tool.
