FAIL

[MEDIUM] devlog/_plan/260614_legacy_workflow_name_inversion/09_pabcd_p_plan.md:316-319 — frozen legacy alias policy is not fully resolved: B4a still says to either remove public registration or turn legacy command files into deprecated compatibility commands, which reopens the B-stage policy choice after the frozen table selected hidden/deprecated aliases for this transition — replace both “Either remove...” bullets with mandatory hidden/deprecated diagnostic alias behavior for `commands/ultragoal.ts` and `commands/ralplan.ts`; reserve full removal for a later cleanup after compatibility tests are retired.

Most likely remaining misread: the B4a “Either remove public registration” wording can be read as permission to delete transitional diagnostic aliases even though the frozen compatibility table requires keeping hidden/deprecated aliases during this phase.
