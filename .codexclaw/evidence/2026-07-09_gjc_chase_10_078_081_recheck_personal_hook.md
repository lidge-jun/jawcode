# Evidence Receipt — GJC Chase Cards 10.078-081 Recheck

Date: 2026-07-09
Working directory: /Users/jun/Developer/new/700_projects/jawcode

## Check 1 — Interview Decision blocks
Command:
```bash
rg -n '^## Interview Decision \(2026-07-09\)|^> \*\*Classification\*\*:|^> \*\*Execution order\*\*:|^> \*\*Implementation approach\*\*:|^> \*\*OPEN ASSUMPTIONS\*\*:' struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md
```
Output:
```text
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:18:## Interview Decision (2026-07-09)
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:20:> **Classification**: import all for runtime discovery and inline invocation; adapt slash-command adjacencies where JWC already has local behavior.
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:21:> **Execution order**: skill phase in the sequence `model/provider → context/perf → session → skill → TUI → Telegram`.
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:22:> **Implementation approach**: Import both runtime skill discovery and inline skill invocation because the combined result is a major JWC skill UX upgrade; keep status open until implementation and focused tests land.
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:23:> **OPEN ASSUMPTIONS**: Slash commands adjacent to the skill UX (`/effort`, `/quit`, `/clear`, `/changelog`) still need per-command parity checks before code import.
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:18:## Interview Decision (2026-07-09)
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:20:> **Classification**: import all stability patches; CI sharding remains reference only.
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:21:> **Execution order**: session phase in the sequence `model/provider → context/perf → session → skill → TUI → Telegram`.
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:22:> **Implementation approach**: Import or adapt every subagent, fork, yield-contract, IRC, output, receipt, and MCP lifecycle hardening patch, but do not copy upstream CI sharding mechanics into JWC from this card.
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:23:> **OPEN ASSUMPTIONS**: JWC owner files may already contain some fixes under renamed symbols; implementation should verify semantic parity before duplicating logic.
struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md:13:## Interview Decision (2026-07-09)
struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md:15:> **Classification**: import all stability patches; CI sharding and install script changes are reference only.
struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md:16:> **Execution order**: session phase in the sequence `model/provider → context/perf → session → skill → TUI → Telegram`.
struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md:17:> **Implementation approach**: Import/adapt session vanish evidence, postmortem recovery, lifecycle state, event ordering, storage tolerance, composer/task cancellation, and runtime stability patches; keep upstream CI sharding and install-script mechanics as references because JWC CI/install surfaces differ.
struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md:18:> **OPEN ASSUMPTIONS**: Shell-script concepts must be translated to JWC `.jwc` state and current lifecycle owners; no `gjc-session` public names should leak into JWC.
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:14:## Interview Decision (2026-07-09)
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:16:> **Classification**: import all.
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:17:> **Execution order**: first in the sequence `model/provider → context/perf → session → skill → TUI → Telegram`.
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:18:> **Implementation approach**: Import all model/provider v2 changes, including every provider-specific patch; record the companion opencodex patch plan under `struct_har/chase/model/`; include Fugu/Sakana and ZAI rather than leaving them as optional candidates.
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:19:> **OPEN ASSUMPTIONS**: Generated model metadata still must flow through descriptors/generators rather than direct `models.json` edits, and JWC-facing names must remain `jwc`/`.jwc`.
```
Judgement: PASS — all four cards contain the requested Interview Decision section and fields.

## Check 2 — Status and decision rows
Command:
```bash
rg -n '^> MOC: .*⬜|Runtime skill discovery \| \*\*Import\*\*|Inline skill invocation \| \*\*Import\*\*|CI sharding \| \*\*Reference only\*\*|Fugu/Sakana login URL.*\*\*Import\*\*|ZAI weekly limit exhaustion.*\*\*Import\*\*|opencodex companion patch plan|install binary atomic download \| \*\*Reference only\*\*|full workspace affected-test splitting \| \*\*Reference only\*\*' struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md
```
Output:
```text
struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md:3:> MOC: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · G1 · ⬜ · P2
struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md:109:| install binary atomic download | **Reference only** | User decision: install script changes are reference only because JWC install surfaces differ. |
struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md:111:| full workspace affected-test splitting | **Reference only** | User decision: CI sharding remains reference only because JWC CI topology differs. |
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:3:> MOC: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · G1 · ⬜ · P1
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:106:| Fugu/Sakana login URL and `fish_` placeholder | **Import** | User decision: include all provider-specific patches, including Fugu/Sakana. If native provider exposure is still absent, record the provider gap and OCX/JWC routing implications instead of dropping the patch. |
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:107:| ZAI weekly limit exhaustion | **Import** | User decision: include all provider-specific patches, including ZAI limit taxonomy. Keep detection narrow and provider-owned. |
struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md:118:| opencodex companion patch plan | **Record in `model/`** | User decision: the OCX patch plan must be tracked in the model/provider source-of-truth layer alongside the JWC import plan. |
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:3:> MOC: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · G1 · ⬜ · P2
struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md:102:| CI sharding | **Reference only**. | User decision: upstream CI sharding is not imported here because JWC CI topology differs. |
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:3:> MOC: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · G1 · ⬜ · P2
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:84:| Runtime skill discovery | **Import**. | User decision: import runtime discovery as part of a broad JWC skill UX upgrade. Preserve JWC `.jwc` boundaries and existing config precedence while importing. |
struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md:86:| Inline skill invocation | **Import**. | User decision: import inline invocation together with runtime discovery. Implementation must cover editor, prompt, ACP, and autocomplete tests. |
```
Judgement: PASS — the four card statuses remain ⬜ and the requested decision-table rows are present.

## Check 3 — Model patch plan
Command:
```bash
rg -n 'Interview Decision Patch Plan \(2026-07-09\)|Fugu/Sakana|ZAI|OpenCode Go / Kimi|Safety refusal and bounded retry behavior' struct_har/chase/model/004_cross_project_patch_index.md
```
Output:
```text
57:### Interview Decision Patch Plan (2026-07-09)
61:Import all provider-specific patches, including Fugu/Sakana and ZAI. That does not mean every patch becomes native JWC code. It means every imported provider delta must be triaged across both JWC and OCX, because OCX is the Codex proxy path where provider aliases, model IDs, auth modes, wire adapters, and catalog visibility may need parallel treatment.
65:| All provider-specific patches from GJC/OMP model/provider deltas | Record and import/adapt where OCX owns the proxy route. | Fugu/Sakana, ZAI, Kimi/OpenCode Go compatibility, OpenAI-compatible retry/limit taxonomy, safety/refusal semantics, and catalog metadata should be checked against OCX registry/router/adapters/catalog instead of assuming JWC-native ownership covers proxy behavior. |
66:| Fugu/Sakana | Add or update OCX registry/auth metadata if OCX exposes the provider or routes compatible models. | Preserve OCX provider naming and auth mode; do not infer native JWC provider exposure from OCX support. |
67:| ZAI | Check OCX `zai` registry metadata and add narrow weekly-limit classification only in the OCX provider/adapter path that emits ZAI errors. | Avoid generic string heuristics in shared retry logic unless evidence shows multiple providers share the exact code. |
68:| OpenCode Go / Kimi compatibility | Check `src/providers/registry.ts`, `src/server/adapter-resolve.ts`, `src/adapters/`, `src/responses/`, and `src/router.ts` for OpenAI-compatible request/response normalization. | Keep compatibility behavior in the OpenAI-compatible proxy layer. |
69:| Safety refusal and bounded retry behavior | Mirror terminality and retry bounds only where OCX controls retry decisions. | Do not duplicate JWC session retry logic in OCX unless OCX itself retries upstream requests. |
126:5. When a provider patch is imported into JWC, decide separately: native JWC runtime support, OCX proxy route, both, or docs-only. The 2026-07-09 interview decision makes this check mandatory for all provider-specific deltas, including Fugu/Sakana auth and ZAI weekly-limit/model behavior.
```
Judgement: PASS — opencodex companion planning is recorded in the model patch index.

## Check 4 — Scoped status
Command:
```bash
git status --short -- <target files and MOC guard files>
```
Output:
```text
 M struct_har/chase/10_gjc_chase_MOC.md
 M struct_har/chase/20_omp_chase_MOC.md
?? struct_har/chase/10.078_gjc_chase_skill_discovery_slash_commands.md
?? struct_har/chase/10.079_gjc_chase_subagent_fork_session_hardening.md
?? struct_har/chase/10.080_gjc_chase_model_provider_effort_fugu_safety.md
?? struct_har/chase/10.081_gjc_chase_session_vanish_postmortem_lifecycle.md
?? struct_har/chase/model/004_cross_project_patch_index.md
```
Judgement: PASS with note — target files are untracked in this worktree; MOC files show existing modifications but were not edited by this task.

## Overall Judgement
PASS — requested documentation edits are verified. No cxc commands were run, no files were moved to _fin/, and no MOC files were modified by this task.
