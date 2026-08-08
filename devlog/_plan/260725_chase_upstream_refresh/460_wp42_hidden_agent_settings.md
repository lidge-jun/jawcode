# 460 — wp42: the screen deleted what it could not see

Source: OMP `66837a96b` (`fix(hub): restored persisted peers after resume`), from the follow-up list on the
still-open card `20.082`.

| phase | evidence |
|---|---|
| P | defect proven by probe before planning |
| A | **near-pass**, reviewer raised a blocker that changed the implementation |
| B | `c8d29be` |
| C | gates green at baseline; ablation turns all 7 red |

## Finding the anchor when the file does not exist

Upstream's fix touches `agent-hub.ts` and `persisted-agents.ts`. Neither exists in this fork. The habit that
has repeatedly paid off this session applied again: search for the capability, not the path.

The capability is "a screen that persists per-peer state and loses entries on resume." Here that is the agent
dashboard. `discoverAgents` returns 9 agents; `filterVisibleAgents` returns 5, because `explore`, `plan`,
`reviewer` and `task` are `hide: true`. `#allAgents` holds only the visible five — and both persist paths
rebuilt the entire settings value from it and called `set`.

Proven by probe before planning anything, simulating a round trip:

| key | before | after |
|---|---|---|
| `task.disabledAgents` | `[architect, reviewer]` | `[architect]` |
| `task.agentModelOverrides` | `{reviewer, explore, architect}` | `{architect}` |

Not cosmetic. `task/index.ts` reads `disabledAgents` at 495/569/1067 and `agentModelOverrides` at 1115, so a
dropped entry silently re-enables a disabled agent and reverts its model.

## What the reviewer caught

The audit came back near-pass, and the residual mattered. My first implementation preserved unmanaged entries
by reading `settings.get(...)`.

`get()` returns the **merged** view — global, then project, then a runtime override layer that model profiles
and registry bindings write to. `set()` writes only global. So preserving from `get()` and writing with
`set()` would have copied a profile's session-only choices into the user's persisted config the first time
anyone touched this screen. A fix for one kind of settings corruption would have introduced another.

Switched to `getGlobal()` for both keys, which is the layer `set()` actually owns. This is the
read-the-producer-before-patching-the-consumer lesson again, one layer further down: I was reading through an
abstraction that merges sources and writing back to only one of them.

## Why unlisted names are preserved rather than pruned

Tempting to argue that an entry for a nonexistent agent should be garbage-collected. It should not.

Discovery normalizes a missing directory to an empty result and an unreadable file to omission, so a plugin
root that failed to load is indistinguishable from a deleted one. And stale entries are inert: both execution
paths resolve the agent first and consult these settings only afterward. Preserving costs nothing; pruning on
a bad discovery pass silently changes behavior. Absence from one snapshot is not a decision.

This also repairs the load-error path as a side effect — `#allAgents` is emptied there, and the old code
would have written `[]` and `{}` over everything.

## Controls

A merge that preserves everything is trivially "correct" and completely useless, so each preservation case is
paired with a deletion control: re-enabling a visible agent must still remove it from the disabled list, and
blanking an override must still clear that key. Both are asserted. Ablating the preservation turns all seven
red.

Writing the control surfaced a real detail: `#beginModelEdit` prefills through `setValue`, which leaves the
cursor at position 0, so a delete-to-line-*start* removes nothing and the "blank it" control would have
passed while testing nothing. It needed delete-to-line-end.

## Declared residual

A **visible** agent's runtime override is still promoted to persisted config on save, because `#reloadData`
seeds the row from the merged view and the persist path writes the row back. That is pre-existing and needs a
product decision — should this screen edit the global layer or the effective one? — so it is recorded as an
explicit scope note in the test rather than quietly fixed or quietly ignored.

Three reviewer-suggested cases (explicit Ctrl+R reload, empty discovery, discovery rejection) are not tested:
toggle and model-edit both require a selected agent drawn from `#allAgents`, so no UI path reaches persistence
in those states. Recorded as untested rather than claimed.

Test: `packages/coding-agent/test/agent-dashboard-hidden-agent-settings.test.ts`.
