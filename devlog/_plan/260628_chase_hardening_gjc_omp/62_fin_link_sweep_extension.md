# 62 Fin link sweep extension

## Scope

Final completion audit after Phase 61 found the same index-link defect class for three more `_fin`-only GJC cards: `10.004`, `10.007`, and `10.018`. This phase extends the link sweep and removes stale final-synthesis wording superseded by Phase 60.

## Planned edits

### MODIFY `struct_har/chase/002_gap_inventory.md`

- Summary row line for GJC no longer says 008/011 remain residual; it records 008/011/018/007 as `_fin` and leaves only genuinely active gaps as weak/behind.
- `10.007` link: `./10.007_gjc_chase_team_profile_self_heal.md` -> `./_fin/10/10.007_gjc_chase_team_profile_self_heal.md`.
- `10.007` detail row status changes from `중` to `✅ _fin`.

### MODIFY `struct_har/chase/003_reference_from_gjc.md`

- `10.018` link: `./10.018_gjc_chase_rpc_registry_uds.md` -> `./_fin/10/10.018_gjc_chase_rpc_registry_uds.md`.
- `10.007` link: `./10.007_gjc_chase_team_profile_self_heal.md` -> `./_fin/10/10.007_gjc_chase_team_profile_self_heal.md`.

### MODIFY `struct_har/chase/10.001_gjc_chase_cycle.md`

- `10.007` link: `./10.007_gjc_chase_team_profile_self_heal.md` -> `./_fin/10/10.007_gjc_chase_team_profile_self_heal.md`.
- `10.004` link: `./10.004_gjc_chase_session_compaction.md` -> `./_fin/10/10.004_gjc_chase_session_compaction.md`.

### MODIFY `struct_har/chase/10.019_gjc_chase_gc_file_lock.md`

- `10.007` links: `./10.007_gjc_chase_team_profile_self_heal.md` -> `./_fin/10/10.007_gjc_chase_team_profile_self_heal.md`.

### MODIFY `devlog/_plan/260628_chase_hardening_gjc_omp/02_phase_map.md`

- Append Phase 62.

### MODIFY `devlog/_plan/260628_chase_hardening_gjc_omp/50_final_synthesis.md`

- Replace the stale "Residual stale references intentionally not rewritten" table with a Phase 60 resolved/historical-anchor note.
- Replace the stale recommended-order line that still says to revisit the three residual `f0a8a3eb` references.
- Replace the residual-risk line that says the synthesis records exact residual references.
- Add a pending Phase 62 delivered-commits row before commit, then replace it with the real commit SHA after commit.

## Non-goals

- Do not move cards between active and `_fin`.
- Do not edit implementation files.
- Do not chase unrelated stale links outside the `_fin`-only cards found by the audit unless the verifier proves they fail the same completion criterion.
- Do not stage `devlog/.gitignore` or `devlog/_tmp/`.

## Verification

- Python link scan over chase-root markdown must report zero links where `./10.NNN_...` points to a missing root file but matching `_fin/10/10.NNN_...` exists:

```bash
python3 <<'PY'
import re
from pathlib import Path
root = Path("struct_har/chase")
bad = []
for md in root.glob("*.md"):
    text = md.read_text()
    for match in re.finditer(r"\]\(\./(10\.[0-9]{3}_[^)]+\.md)\)", text):
        target = root / match.group(1)
        fin = root / "_fin" / "10" / match.group(1)
        if not target.exists() and fin.exists():
            bad.append(f"{md}:{match.group(1)}")
if bad:
    print("\n".join(bad))
    raise SystemExit(1)
PY
```

- `rg '\]\(\./10\.(004|007|018)_' struct_har/chase/*.md` returns no match.
- `rg 'RPC lifecycle 잔여|receipt spool 테스트|team profile self-heal\\(007\\)' struct_har/chase/002_gap_inventory.md` returns no match.
- `rg 'team self-heal.*\\| 중 \\|' struct_har/chase/002_gap_inventory.md` returns no match.
- `rg 'Residual stale references|not rewritten|Revisit the three residual|records the exact residual references' devlog/_plan/260628_chase_hardening_gjc_omp/50_final_synthesis.md` returns no match.
- `rg 'Phase 62' devlog/_plan/260628_chase_hardening_gjc_omp/02_phase_map.md devlog/_plan/260628_chase_hardening_gjc_omp/50_final_synthesis.md` returns matches.
- `_fin` targets exist:
  - `struct_har/chase/_fin/10/10.004_gjc_chase_session_compaction.md`
  - `struct_har/chase/_fin/10/10.007_gjc_chase_team_profile_self_heal.md`
  - `struct_har/chase/_fin/10/10.018_gjc_chase_rpc_registry_uds.md`
- Synthesis no longer says the Phase 60 residual refs were "not rewritten".
- `git diff --check` passes.
- Independent Docs verifier reports DONE.
