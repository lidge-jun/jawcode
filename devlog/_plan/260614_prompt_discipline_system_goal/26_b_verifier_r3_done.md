# 26 B Verifier R3 — Active Entry Leak Fix

DONE

- C2 active-entry leak fixed: `retireJawInterviewActiveState` now removes/rebuilds the session active entry/snapshot and then reads root authoritative active entries; it removes/rebuilds the root `jaw-interview` entry only when `rootJawInterview.session_id === input.sessionId`, preserving root entries with no session or a different session.
- Runtime-created regression exists: `orchestrate-state.test.ts` uses real `runNativeJawInterviewCommand --write --session-id session-A --json`, then session `p`, and asserts both session and root snapshots no longer report active `jaw-interview` for that session.
- Preservation coverage remains: session P/reset tests seed a true shared/root active jaw-interview and assert root mode plus root active-state stay active while the session scope is retired.
- Previous HTML guard fixes still hold: guard allows `.md`, allows `.html` only for mockup/wireframe/prototype paths outside `.jwc`, blocks `src/index.html`, and blocks `.jwc/**/*.html`; tests cover direct write, apply-patch, hashline edit, and raw-path cases.
- P/reset cleanup remains plan-aligned: P cleanup still runs after successful PABCD persist + goal checkpoint and only retires handoff; reset cleanup still runs after successful unlink, includes active interviewing, and is skipped by dry-run.
- Focused verification run: `bun test packages/coding-agent/test/jaw-interview-mutation-guard.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts` → 90 pass, 0 fail, 480 expects.
- Main-session Biome verification: `bunx biome check <touched source/test files>` → OK.
