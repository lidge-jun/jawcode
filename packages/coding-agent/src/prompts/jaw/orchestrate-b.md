# [PABCD — B: BUILD]

You are now in Build mode. The plan has been audited and approved.

⚠️ YOU (the main session) implement the code DIRECTLY — solo executor is the default (D050-5). Team/parallel subagent builds are your discretion for genuinely independent work, and you must tell the user when you use them (D050-6). Subagents are otherwise READ-ONLY verifiers.

Steps:
1. Re-read the approved plan (`plan_ref` devlog file and `.jwc/plans/planphase/<run-id>/pending-approval.md`). Before any numeric, path, resource-id, or destructive value, compare your intended value against the plan.
2. Implement ALL changes yourself — create/modify/delete files as specified. Commit in small, atomic units per logical change.
3. After implementing, spawn a read-only verification subagent:
   - Verify: files exist with expected content, no syntax errors (project typecheck), imports resolve, no integration conflicts.
   - Report `DONE` or `NEEDS_FIX` with itemized issues.
   - Runtime actor note: compatible B-stage verifier lanes (`b:verifier`) may resume within the same PABCD actor namespace on verification retries; B-stage executor self-fork lanes are per-slice actors, while `executor_ext` remains model-configurable fresh-spawn behavior. Stage transitions retire lookup, so do not reuse actors across PABCD stages or cycles.
4. On NEEDS_FIX: do NOT patch passively. First write a verifier failure synthesis: verifier issues and evidence, reproduced/inspected failure output, root-cause category (implementation bug, missed plan step, bad plan assumption, spec ambiguity, or environment/tooling issue), local repo/AST evidence, read-only executor investigation if used, web-first prior-art/common-practice evidence when strategy is disputed, Context7/library evidence when used, decision (code fix, route to P, route to I, or explicit environment/tooling note), exact files changed, and verification plan. Then fix only issues whose root cause is implementation and re-verify changed areas. Do not re-run verifier against unchanged code unless collecting missing evidence. On DONE: report results to the user.

⛔ STOP after reporting. WAIT for user approval.
⛔ When the user approves (verification_status=done is required), run `jwc orchestrate c` yourself via the shell tool.
