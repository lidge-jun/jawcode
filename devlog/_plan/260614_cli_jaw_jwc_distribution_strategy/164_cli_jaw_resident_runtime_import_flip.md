# 164 — cli-jaw resident runtime import flip

## Goal

Finish the cli-jaw resident JWC runtime wiring enough for typechecked source integration, and make the default SDK import use the decided package surface:

```ts
import("jawcode/sdk")
```

The global `jwc` binary remains a code-mode ACP fallback surface for now, but the main-managed resident runtime no longer defaults to `jwc/sdk`.

## Implementation

cli-jaw paths included in the slice:

- `src/agent/jwc-runtime.ts` — resident in-process runtime and `jawcode/sdk` default import.
- `src/agent/jwc-event-mapper.ts` — JWC AgentSessionEvent to existing cli-jaw bus events.
- `src/agent/spawn.ts` — main-managed `cli === "jwc"` resident branch.
- `src/code-mode/acp-host.ts` and `src/code-mode/types.ts` — ACP code-mode host scaffold.
- `src/routes/code.ts` and `server.ts` — code-mode REST routes.
- `src/cli/registry.ts`, `src/types/cli-engine.ts`, `src/core/event-bus.ts` — registry, type, and event-topic registration.
- `scripts/jwc-110-e2e.mjs` — opt-in real-provider resident runtime smoke aligned to the default JWC agent dir.

## Verification

Commands run in `/Users/jun/Developer/new/700_projects/cli-jaw`:

```sh
node -e "import('jawcode/sdk').then(m=>console.log('runtime default target ok', typeof m.createAgentSession, Object.keys(m).length))"
rg -n "jwc/sdk" src/agent scripts tests package.json package-lock.json
npm run typecheck
git diff --check -- server.ts src/agent/spawn.ts src/cli/registry.ts src/core/event-bus.ts src/types/cli-engine.ts scripts/jwc-110-e2e.mjs src/agent/jwc-runtime.ts src/agent/jwc-event-mapper.ts src/code-mode src/routes/code.ts
```

Observed evidence:

```text
runtime default target ok function 28
npm run typecheck -> exit 0
rg -n "jwc/sdk" ... -> 0 matches
```

## Result

Slice 164 closes the package-import blocker identified by the plan audit. The next slice can test no-global-`jwc` behavior and decide how much of code-mode ACP should still rely on a `jwc` executable versus an embedded/package-resolved launcher.
