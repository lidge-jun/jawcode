PASS

§3.3 now gives the complete `.inheritContext` tail (`fork-context cloned-token accounting.`) in the split planned-after block; the prior truncation is gone. Bundled-agent list correctly adds `executor_ext` while keeping the rest aligned with `packages/coding-agent/src/prompts/tools/task.md`.

[low] §3.3 shows the bullet as a wrapped multi-line excerpt — implement as the same `.inheritContext` bullet inside `{{#if contextEnabled}}`, not as separate list items.

The single statement an implementer would most likely misread: a per-task `.model: "provider/modelId[:effort]"` on `agent: "executor"` does not satisfy an explicit external/ext/model-diverse executor request; use `agent: "executor_ext"`.
