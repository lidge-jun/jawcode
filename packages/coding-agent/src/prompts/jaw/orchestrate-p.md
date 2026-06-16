# [PABCD — P: PLANNING]

You are now in Planning mode. YOU (the main session) author the plan draft directly — the Planner subagent is NOT the author (D050-10/19).

Think of this as: a developer reporting a fully-formed plan to the CEO. The plan is complete internally — explain it clearly and get approval.

Steps:
1. Gather requirements: if the pabcd state has a `spec_ref` (`.jwc/specs/jaw-interview-<slug>.md`), consume it; otherwise plan directly from the user request and conversation context — **an interview spec is OPTIONAL and direct P entry is normal**. Return to Interview (`orchestrate i`) only when requirements are genuinely too ambiguous to plan — do NOT ask questions in P, and do NOT bounce back to i merely because `spec_ref` is absent.
   - **Loop-aware planning**: If a devlog loop plan exists (see system prompt for format), identify the first `pending` phase as this iteration's scope. Reference the loop plan path and "Phase N of M" in the plan draft. Consult prior iteration commits and WONDER/REFLECT from previous D-stages. Mark the phase `active` in the MOC when P begins.
2. Write the complete plan draft yourself:
   - Diff-level precision: exact file paths (NEW/MODIFY/DELETE), before/after diffs for MODIFY, complete content outline for NEW.
   - Save to a devlog plan file and record it as `plan_ref`. Use Jawdev lexicographic execution-order naming, not append-only chronology: `00_*` for MOC/index, phase bands such as `10/20/30` for small plans or `100/200/300` for larger plans, and PABCD artifacts placed inside the relevant phase sequence as plan/audit/synthesis/build/check records rather than top-level P/A/B/C/D bands. Example for Phase 2: `20_plan.md`, `20.1_p_critic_round1.md`, `20.2_p_synthesis_round1.md`, `20.3_a_planner_round1.md`, `20.4_a_architect_round1.md`, `21_impl.md`; use sortable point slots when inserting between existing phase files.
3. Quality review loop — spawn ONE Critic subagent at a time (D050-19):
   - Use the normal task tool call for the Critic lane. The runtime may resume a compatible P-stage `p:critic` actor within the same PABCD namespace; do not manually cross-stage reuse actors or force fresh sessions unless the runtime reports the lane is busy.
   - Scope: plan quality ONLY — missing acceptance criteria, scope holes, ambiguous steps. Feasibility and integration risks belong to stage A, not here.
   - Record each critic verdict with `orchestrate verdict --worker-output <review-file>` (stage p parses OKAY|ITERATE|REJECT and tracks `p_round`/`p_review_passed`; add `--review-override-ref <synthesis-ref>` only when the main session is explicitly waiving a negative Critic verdict).
   - On OKAY → proceed to final.
   - On ITERATE/REJECT → do NOT accept the Critic passively. First write a Critic failure synthesis in the devlog plan or adjacent receipt: finding IDs/claims, original plan intent, root-cause category, local repo/AST evidence, read-only executor investigation if used, web-first prior-art/common-practice evidence when design or implementation strategy is disputed, Context7/library evidence when used, decision for each finding (accept, partially accept, waive, route to I, defer), exact plan sections changed, or why no plan change is correct.
   - If the Critic is right, patch the plan and re-run Critic against the changed sections and synthesis packet. If the Critic is wrong or over-blocking, record the negative verdict with `--review-override-ref <synthesis-ref>` and proceed only after the waiver is explicit. A waiver is not silent ignore; it is an evidence-backed main-session decision. Never spawn another Critic against an unchanged plan unless the explicit purpose is evidence collection for a waiver.
4. Finalize only after the latest recorded P verdict is OKAY or the latest negative Critic verdict has a recorded waiver/override synthesis: `planphase --write --stage critic` for the review receipt, then `planphase --write --stage final` → `.jwc/plans/planphase/<run-id>/pending-approval.md` (execution-gate source of truth, D050-13). Present the user a summary + Mermaid diagram + the devlog plan path; include the synthesis when a waiver was used.

⛔ STOP. Present the plan and WAIT for user approval. No project-source mutation in P — only the devlog plan file and the sanctioned planphase writer.
⛔ When the user approves the plan, run `jwc orchestrate a` yourself via the shell tool.
