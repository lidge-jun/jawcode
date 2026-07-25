# Phase 30 — adapt 10.068-A Windows psmux attach retry

## Scope

Adapt only the `10.068` source fact anchored at GJC `49ba4f3d`:

- Windows native `psmux` can briefly refuse `attach-session` with `(os error 10061)` after a session is created and profiled.
- If the session still exists, JWC should wait briefly and retry `attach-session` once.
- If the session disappeared after that transient attach refusal, JWC should recreate the session, reapply the managed-window/profile steps, and retry attach once.

This is a partial 10.068 sub-slice. Do not move `10.068` to `_fin` in this phase because the card still tracks owner fail-closed, launch sizing, cmux title sync, Telegram owner-race/internal-session/chunking, and TUI detach EIO facts.

## Patch plan

Modify:

- `packages/coding-agent/src/jwc-runtime/launch-tmux.ts`
- `packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts`
- `struct_har/chase/10.068_gjc_chase_tmux_telegram_session_resilience.md`

No `_fin` move or chase index update is planned for this phase.

## Implementation notes

- Keep the condition narrow: `platform === "win32"` plus resolved psmux command plus stderr containing `os error 10061`.
- Reuse JWC target builders and `buildJwc*` naming; do not copy GJC-only helper names into public JWC docs.
- Preserve existing psmux registration backoff behavior: a missing session before profile remains a launch failure, not an immediate recreate loop.
- Keep attach retry synchronous and bounded to one retry path.

## Verification

Run:

```bash
bun test packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts
python3 - <<'PY'
from pathlib import Path
base = Path('/Users/jun/Developer/new/700_projects/jawcode')
for rel in [
    'packages/coding-agent/src/jwc-runtime/launch-tmux.ts',
    'packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts',
    'struct_har/chase/10.068_gjc_chase_tmux_telegram_session_resilience.md',
    'devlog/_plan/260702_chase_quick_close/30_phase3_10068_psmux_attach_retry.md',
]:
    text = (base / rel).read_text()
    bad = [i for i, line in enumerate(text.splitlines(), 1) if line.rstrip() != line]
    assert not bad, f'{rel}: trailing whitespace at {bad[:5]}'
print('10.068-A target whitespace ok')
PY
```

Full `git diff --check` may still report unrelated pre-existing whitespace in `devlog/_plan/260702_tui_stabilization/12_gpt55_review.md`; use the target-file check for this phase.
