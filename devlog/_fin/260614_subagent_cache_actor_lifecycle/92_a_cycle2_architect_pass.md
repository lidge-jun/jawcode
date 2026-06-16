PASS

[MEDIUM] 80_pabcd_phase_execution_plan.md §6.1 step 2 / agent-session.ts — Actor-scoped session open/restore is required before compaction/prewarm but concrete helper naming can be sharpened in B-stage — Add a named primitive and never pass the parent session into maintenance.
[MEDIUM] 80_pabcd_phase_execution_plan.md §3.1 NEW / §4.1 NEW vs §8.2 — New black-box/self-fork test files should be read as cycle-2 B-stage deliverables, mandatory post-B per §8.2 — Tag those paths clearly when editing the plan further.
[LOW] 80_pabcd_phase_execution_plan.md header §1 status vs §11 — Cycle-1 B scaffold vs cycle-2 B deliverables can be misread — Keep status wording tied to cycle-2 B/C closeout.
[LOW] 80_pabcd_phase_execution_plan.md §7.1 vs §11 — Model UI discovery is already satisfied by cycle-1 evidence; remaining Phase 5 work should point to §12 OPEN only.

Single point most likely to break first: Implementing `maintainWorkflowActorBeforeResume` without a named actor-scoped session open primitive will most likely run compaction/prewarm on the parent session or skip maintenance entirely, so PABCD `runMode: "message"` resume will violate the actor-local contract in §3.3/§6.1 even if registry routing otherwise works.
