# 28 B Verifier R4 — Shared Active-State Restoration

DONE

- Verified `27_c_failure_synthesis_r3.md` fix is implemented: session retire removes the same-session session active entry and root authoritative active entry only when `rootJawInterview.session_id === input.sessionId`.
- Verified restoration behavior: after removing a same-session root active entry, the helper reads root `jaw-interview-state.json`; if valid and `active:true`, it restores root active-state via `syncSkillActiveState(...)`.
- Verified preservation behavior: unrelated/root shared active entry is preserved unless it matches the retiring session id.
- Verified regression coverage: runtime-created session stale root entry cleanup; shared runtime entry restored after session runtime entry retirement; previous isolated-session preservation cases remain.
- Verified HTML guard restrictions remain: `.html` allowed only for mockup/wireframe/prototype paths outside `.jwc`; product HTML and `.jwc/**/*.html` remain blocked.
- Verified P/reset cleanup remains plan-aligned: P cleanup after successful persistence/checkpoint; reset cleanup after `fs.unlink`; dry-run unaffected.
- Focused tests run: `bun test packages/coding-agent/test/jaw-interview-mutation-guard.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts` → 91 pass, 0 fail, 488 expect() calls.
- Main-session Biome verification: `bunx biome check <touched source/test files>` → OK.
