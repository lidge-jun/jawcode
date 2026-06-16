# 110 — cli-jaw merge preconditions

## Preconditions

| Gate | Requirement | Evidence target |
|---|---|---|
| G-110-1 | JWC embedding facade is stable | `jawcode/sdk` export map or successor doc |
| G-110-2 | JWC runtime can be imported without TUI-only Bun paths | focused Node/import smoke |
| G-110-3 | cli-jaw does not need global `jwc` | PATH-negative smoke in cli-jaw |
| G-110-4 | session ownership is explicit | jaw.db vs `.jwc` state map |
| G-110-5 | rollback is explicit | cli-jaw settings fallback plan |

## cli-jaw merge concept

The merge into cli-jaw should be a small integration layer, not a source dump:

- `JawRuntime` service owns resident JWC sessions.
- cli-jaw maps channel/session events into the runtime.
- cli-jaw persists user-facing transcript/state in jaw.db.
- JWC owns its internal workflow state where needed.
- fallback vendor CLI path remains available for one release.

## Anti-goals

- no primary shell-out to global `jwc`;
- no requirement that users install jawcode repo separately;
- no forced monorepo migration;
- no full internal namespace rename during the first merge.
