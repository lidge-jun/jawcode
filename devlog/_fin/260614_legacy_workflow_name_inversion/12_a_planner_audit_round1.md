FAIL

[HIGH] `09_pabcd_p_plan.md:433` — approval-gate stage is left as "`plan` or `planphase` according to contract context", forcing implementers to decide the wire contract during B-stage — specify exact field-level mapping: workflow/approval identity emits `plan`; artifact-writer/storage contract emits `planphase`, or document the opposite with named fields.

[MEDIUM] `09_pabcd_p_plan.md:42-45`, `09_pabcd_p_plan.md:152-153`, `09_pabcd_p_plan.md:311-315` — frozen compatibility policy still uses "remove or keep" choices for legacy commands, so the alias policy is not fully frozen — choose one behavior per surface: hidden deprecated alias with required diagnostics/tests, or complete removal with required failing/absence tests.

[MEDIUM] `09_pabcd_p_plan.md:531-549`, `09_pabcd_p_plan.md:553-579` — added verification coverage is listed but not incorporated into the executable verification command set, so implementers can satisfy the written verification plan while skipping CLI/help, hook/HUD, public-legacy inventory, and additional RPC client tests — add those exact test files/scripts or smoke commands to the verification plan.

[LOW] `09_pabcd_p_plan.md:14-22` — current drift lists `state-runtime.ts` and `skill-state/workflow-hud.ts`, but later phases do not assign concrete inspect/update/keep-or-discard work items for those files — add explicit B-stage reconciliation bullets for each drift file or remove them from the drift list if obsolete.

[LOW] `09_pabcd_p_plan.md:78-79` — "write-side strict enum only accepts `plan` / `goal`" can be read as excluding unaffected canonical workflows even though the snippet preserves `jaw-interview` and `team` — reword to "write-side canonical skills preserve `jaw-interview`/`team` and replace only `ralplan`→`plan`, `ultragoal`→`goal`."

The statement an implementer would most likely misread: "approval stage `plan` or `planphase` according to contract context."
