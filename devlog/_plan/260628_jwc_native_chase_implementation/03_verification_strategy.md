# 03 Verification strategy

## Global checks

Run these before each commit unless the slice is docs-only and explicitly records why package checks are unnecessary.

1. `git diff --check`
2. `git status --short`
3. Focused tests for the touched package or behavior
4. `bun check` or `bun run check:ts` for TypeScript/package changes, following `AGENTS.md`
5. `bun run check:rs` or `bun check` for slices touching `crates/*` or Rust/N-API boundaries

## Reviewer routing

| Change type | Reviewer |
|---|---|
| docs-only plan or chase card | Docs |
| CLI/config/runtime process | Backend |
| auth, token, remote input, file transfer, network | Backend plus security-focused review |
| TUI/render/input | Frontend |
| module boundaries, plugin registry, control-plane contracts | Backend plus architecture review |

## Evidence bundle per card

Every implementation card needs:

1. Documentation evidence: devlog plan/check file and updated chase card or MOC.
2. Implementation evidence: changed source/test paths or explicit no-code rejection rationale.
3. Verification evidence: fresh command output and reviewer verdict.
4. Commit evidence: atomic commit hash after staging only intended files.

## Source evidence rules

Use source clone paths as read-only facts:

- GJC: `devlog/_gjc_chase/gajae-code`
- OMP: `devlog/_omp_chase/oh-my-pi`
- Naming contract: `struct_har/chase/008_gjc_jwc_naming_contract.md`

Do not stage or commit source clone changes. If a clone branch is stale, record the mismatch before using the source fact.

## Failure handling

If a focused test fails:

1. Identify whether the failure is caused by the current slice.
2. If caused by the slice, fix before advancing.
3. If unrelated, record the exact command and failure in the phase check file and keep the slice evidence scoped.
4. Do not close a card solely on a broad lint/check pass.
