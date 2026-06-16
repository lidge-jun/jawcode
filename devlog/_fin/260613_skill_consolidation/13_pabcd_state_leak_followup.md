# PABCD shared-state leak follow-up audit

Date: 2026-06-14
Scope: read-only investigation after the PABCD stage-header stale shared-state incident. No product-code patch is included in this note.

## Incident recap

A stale shared `.jwc/state/pabcd-state.json` with `current_phase: "i"` and `active: true` leaked into a fresh TUI session. `AgentSession.#buildPabcdStageMessage()` reads PABCD state every turn, so the stale shared envelope injected `[PABCD — I: INTERVIEW]` into an unrelated first turn. That caused the model to load `/skill:jaw-interview`; Phase 0 of that skill then instructed direct reads of absent settings files, producing noisy red `Read ...settings.json` failures.

The immediate fix already committed on `dev` makes `readPabcdStateWithFallback(cwd, sessionId)` session-strict when a session id is present. Shared PABCD state is now only read by callers without a session id.

## Audit findings

### 1. Skill active-state still has intentional sessionless fallback semantics

Files:
- `packages/coding-agent/src/skill-state/active-state.ts`
- `packages/coding-agent/src/jwc-runtime/state-runtime.ts`
- `packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts`
- `packages/coding-agent/src/hooks/skill-state.ts`
- `packages/coding-agent/src/session/agent-session.ts`

Current behavior:
- `readVisibleSkillActiveState(cwd, sessionId)` merges the session-scoped active state with root `.jwc/state/skill-active-state.json`.
- Root entries with no `session_id` are considered global fallback rows visible to any session.
- Exact-session rows outrank sessionless rows, but a sessionless active row still wins when the fresh session has no scoped row.

Why this is risky:
- This is the same shape as the PABCD bug: a stale root active row can affect a new session before that session has any local workflow state.
- The status-line HUD partially defends against this by filtering entries to `entry.session_id === sessionId`, but non-HUD callers use the merged visible state directly.

Known call paths that can still be influenced by a stale sessionless root row:
- `state-runtime.inferModeFromActiveState()` can infer `jwc state read|write|clear|handoff` caller mode from root state when no `--mode` is supplied.
- `jaw-interview-mutation-guard.isActiveJawInterview()` can treat a fresh session as inside jaw-interview when both root `skill-active-state.json` and root `jaw-interview-state.json` remain active/sessionless.
- `AgentSession.refreshJwcSubskillTools()` can pick `activeState.skill` from the visible state and attempt subskill-tool refresh for a workflow that belongs to stale root state.
- Hook `buildSkillStopOutput()` can block a fresh session on a handoff-required root workflow if it sees an active sessionless entry and an active root mode-state.

Important nuance:
- The sessionless fallback was introduced for legacy/native CLI compatibility and handoff repair. Tests explicitly cover sessionless seed -> session handoff and root aggregate visibility. Removing it blindly would break existing compatibility behavior.

Recommended follow-up:
- Split active-state reads into explicit policies:
  - `readSessionStrictSkillActiveState()` for live TUI/session prompt injection, mutation guards, stop hooks, and subskill refresh.
  - `readVisibleSkillActiveState()` or `readLegacyCompatibleSkillActiveState()` for standalone CLI/status/doctor/migration surfaces.
- Add stale-root regression tests mirroring the PABCD test:
  - Fresh `sessionId` + root `jaw-interview` active should not trigger mutation guard unless the root entry is explicitly marked global/current.
  - Fresh `sessionId` + root `ralplan`/`jaw-interview` active should not block Stop hook.
  - Fresh `sessionId` + root `ultragoal-state.json` active should not inject active-goal prompt context.
- If global workflows must remain supported, require an explicit `scope: "global"` / `session_id: "*"` marker rather than treating missing `session_id` as globally current forever.

### 2. Root mode-state fallback exists in hook and guard code

Files:
- `packages/coding-agent/src/hooks/skill-state.ts`
- `packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts`

Current behavior:
- `hooks/skill-state.ts::readVisibleModeState()` reads session mode-state first, then root mode-state.
- `jaw-interview-mutation-guard.ts::readVisibleModeState()` does the same.
- Context checks allow root mode-state with no `session_id` to match any session.

Why this is risky:
- Even if active-state filtering is tightened later, root mode-state fallback can still make a stale root workflow look live to a new session.
- This is most visible for jaw-interview because the mutation guard blocks all product writes while it thinks interview is active.

Recommended follow-up:
- For live session surfaces, root mode-state fallback should require either no session id, an exact `session_id`, or an explicit global marker.
- Add tests for root active `jaw-interview-state.json` with no session id and a fresh session id; expected behavior should be decided explicitly instead of inherited from legacy fallback.

### 3. Jaw-interview Phase 0 still instructs direct settings-file reads

File:
- `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`

Current behavior:
- Phase 0 requires the model to read `[$GJC_CONFIG_DIR|~/.jwc]/settings.json` and `./.jwc/settings.json` directly before any announcement.
- The native runtime already has a resolver for modern config and legacy settings:
  - modern `~/.jwc/agent/config.yml`
  - project `.jwc/settings.json`
  - user `settings.json`
  - default `0.05`

Why this is risky:
- Missing optional settings files produce visible tool failures even when default behavior is valid.
- The skill prompt and native runtime can drift: the prompt does not mention the modern `config.yml` source first, while the runtime does.

Recommended follow-up:
- Move threshold resolution fully into native activation output/state and make the skill consume `threshold` + `threshold_source` from state.
- If the skill must remain self-sufficient, instruct it to treat missing settings files as normal and avoid visible hard-failure reads for optional config.
- Add a prompt regression test that `/skill:jaw-interview` Phase 0 instructions match `resolveConfiguredAmbiguityThreshold()` precedence.

### 4. PABCD isolation tests should include all live consumers

Files:
- `packages/coding-agent/src/modes/components/status-line/workflow-readers.ts`
- `packages/coding-agent/src/session/agent-session.ts`
- `packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts`
- `packages/coding-agent/test/status-line-workflow-readers.test.ts`

Current state:
- The committed fix covers `readPabcdStateWithFallback()` and status-line segment reads.
- The per-turn hidden injection path is covered indirectly through the shared helper, but there is no direct `AgentSession.#buildPabcdStageMessage()`-level regression.

Recommended follow-up:
- Add an AgentSession-level test or narrow exported test seam proving that a fresh session with only shared PABCD state does not append a hidden `pabcd-stage-context` message.
- Keep the status-line test that expects `readPabcdSegmentState(cwd, sessionId)` to return `null` when only shared PABCD state exists.

## Suggested priority

1. Keep the PABCD fix as-is.
2. Add regression tests around sessionless root active-state leakage before changing semantics.
3. Introduce strict-vs-legacy active-state read APIs and migrate live TUI/session hooks to strict reads.
4. Update jaw-interview Phase 0 so optional settings resolution is native/state-driven and does not cause visible missing-file tool errors.
