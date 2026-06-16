# C-stage check — H1 ctrl+t component replay

Date: 2026-06-15

## Skill precheck

C-stage prompt requested `/skill:dev-testing`. No bundled or repo-visible `dev-testing` SKILL.md exists in this checkout; local search found only historical compatibility references and the stage-skill map pointer. Proceeded with repository `AGENTS.md` verification conventions.

## Mechanical gates

Focused regression suite:

```bash
bun test packages/coding-agent/test/session-transcript-replay.test.ts packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/keybindings-display.test.ts packages/coding-agent/test/modes/controllers/command-controller-hotkeys.test.ts packages/coding-agent/test/thinking-collapse.test.ts packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/modes/utils/render-initial-messages-dedupe.test.ts
```

Result:

```text
87 pass
0 fail
360 expect() calls
```

Package typecheck:

```bash
bun --cwd=packages/coding-agent run check:types
```

Result:

```text
$ tsgo -p tsconfig.json --noEmit
```

Workspace gate:

```bash
bun run check
```

Result:

```text
Checked 2275 files in 888ms. No fixes applied.
Rust scope check passed.
[OK] Node 20 baseline guard passed.
GJC UI redesign verification passed.
... package checks ...
Done in 6.16s
```

## Adversarial review

Initial C review `76-CStageAdversarialH1` returned `FAIL` with requested hardening:

- wire `getUserMessageText` through controller replay deps;
- prove controller dependency wiring and `itemCount` behavior;
- cover empty historical replay through `showFullTranscript()`;
- expand replay edge-case matrix.

Applied fixes:

- `input-controller.ts` now passes `getUserMessageText` into `buildSessionTranscriptComponents()`.
- `session-transcript-replay.ts` falls back to local text extraction when the supplied extractor returns an empty string, preserving developer-message behavior.
- `input-controller-keybindings.test.ts` now covers replay dependency wiring, settings getter calls, renderer/tool lookup calls, item-count header, live tail, and empty historical replay through the controller path.
- `session-transcript-replay.test.ts` now covers synthetic error results, internal-URL read exclusion, image-only read handoff, pending tool calls, file mentions, async result rows, and IRC rows.

Final adversarial review `78-CStageAdversarialPassCheck` returned `PASS`:

```json
{
  "verdict": "PASS",
  "architectural_status": "CLEAR",
  "code_review_recommendation": "APPROVE",
  "summary": "Prior blockers resolved in scoped files: getUserMessageText wired in showFullTranscript replay deps; controller tests cover dependency wiring, itemCount header, live tail, and empty historical replay; replay/overlay tests cover the stated edge-case matrix. No new blocking issues in the five inspected paths."
}
```

## Verdict

C-stage is green. Mechanical gates pass and adversarial review passes. Proceed to D-stage.
