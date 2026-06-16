# 24 B Verifier R2 — C Failure Fixes

DONE

- C-FAIL-1 fixed: `retireJawInterviewStateForWorkflowExit({ sessionId })` now routes through `retireJawInterviewActiveState`, which calls `removeActiveEntry` + `rebuildActiveSnapshot` with the session scope only; root/shared retire still uses `syncSkillActiveState`. Regression coverage asserts session P/reset retires session active-state while root jaw-interview mode and root active-state remain active.
- C-FAIL-2 fixed: `.html` allowance is no longer extension-only. `isInterviewDocumentPath` allows `.md`, but `.html` only when the path matches mockup/wireframe/prototype naming; `src/index.html` is covered as blocked during active interview.
- C-FAIL-3 fixed: `.jwc/**/*.html` is explicitly rejected before mockup matching via `relativeJwcSegments(...)?[0] === ".jwc"`, and tests cover `.jwc/specs/mockup.html` plus `.jwc/mockups/mockup.html` as runtime-owned blocked paths.
- Mockup HTML outside `.jwc` remains allowed: tests cover direct write, apply-patch add, hashline edit, and raw-path allowance for mockup/wireframe HTML paths.
- P/reset cleanup behavior remains intact: P cleanup still runs only after successful PABCD persist + goal checkpoint and only retires handoff; reset cleanup still runs after successful `fs.unlink`, includes active interviewing, and dry-run branches before cleanup.
- Focused verification run: `bun test packages/coding-agent/test/jaw-interview-mutation-guard.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts` → 89 pass, 0 fail, 474 expects.
- Main-session Biome verification: `bunx biome check <touched source/test files>` → OK.
