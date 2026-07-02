# Phase 20 — close 20.035 tool schema/task/TTS/stats reference

## Decision

Close `20.035` as reference-triage with no product code changes:

- REJECT for now: OMP's `paths` array → path string public tool-contract change. JWC should not break public schema compatibility without a separate product decision and migration tests.
- ALREADY TRACKED: OMP task role rename/default/policy work maps to JWC's existing `20.027` prompt/subagent discovery closure plus current task concurrency/recursion code paths.
- DEFER: TTS/STT natural speech surfaces are not current JWC requirements; keep them as future voice-feature references.
- TRACK ELSEWHERE: stats dashboard expansion remains under stats-specific cards such as `20.029`, not this mixed public-contract card.

## Source anchors

`git -C devlog/_omp_chase/oh-my-pi log --oneline b6c9747d4..0ea6ea630 --grep='schema|task|tts|stats|tool'`

- `95b91c7f7 feat(coding-agent/tools)!: replaced paths arrays with path strings`
- `b149cfce7`, `bbe574a8d`, `8a5124df5` mid-run todo nudges
- `720fb3f12`, `6c1152647` oracle/tester and quick_task/sonic naming
- `1b9c6be12`, `88ae6c531`, `8e2dfcc43` task policy/semaphore hardening
- `94645752f`, `41cc57c23` TTS/speech pipeline
- `fbf3a6eb3`, `0d3d4c636` stats dashboard/test work

## JWC evidence

- `struct_har/chase/_fin/20/20.027_omp_chase_prompts_subagent_discovery_rules.md` already records JWC-specific task role/default decisions and rejects OMP role-name copying.
- `packages/coding-agent/src/session/agent-session.ts` contains current todo/TTSR/task lifecycle surfaces; no path-schema migration is safe as a docs-only quick-close.
- `packages/stats/` and `structure/60_release_publishing.md` show stats is a real JWC package surface, while dashboard expansion should remain stats-specific.
- `docs/keybindings.md` already names STT keybinding surface; full TTS/STT pipeline remains future scope.

## Patch

- Move `struct_har/chase/20.035_omp_chase_tool_schema_task_tts_stats.md` to `_fin/20`.
- Update follow/gap/MOC indexes from open to `_fin`.
- Update `_fin/INDEX.md` with the completed OMP reference card.

## Verification

Run:

```bash
python3 - <<'PY'
from pathlib import Path
base = Path('/Users/jun/Developer/new/700_projects/jawcode')
card = base / 'struct_har/chase/_fin/20/20.035_omp_chase_tool_schema_task_tts_stats.md'
assert card.exists()
assert not (base / 'struct_har/chase/20.035_omp_chase_tool_schema_task_tts_stats.md').exists()
for rel in ['../../20_omp_chase_MOC.md', '../../../../devlog/_plan/260702_chase_quick_close/20_phase2_20035_tool_schema_task_policy.md']:
    assert (card.parent / rel).resolve().exists()
print('20.035 link-and-index-check ok')
PY
```

Also run the target-file trailing whitespace check before commit. Full `git diff --check` is expected to keep reporting the unrelated pre-existing trailing whitespace in `devlog/_plan/260702_tui_stabilization/12_gpt55_review.md`.
