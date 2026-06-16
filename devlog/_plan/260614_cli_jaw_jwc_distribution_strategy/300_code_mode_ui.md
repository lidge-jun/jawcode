# 300 — Code mode Manager UI

> PABCD slice. Repo for implementation: cli-jaw. Classification: C3.
> Depends on: 290 (Code REST ↔ ACP boundary).
> Current doc role: frontend/mockup contract for native cli-jaw Manager Code mode using jawcode/JWC ACP/SDK contracts.

## Problem

cli-jaw has Code REST/ACP backend primitives, but the Manager UI needs a native Code mode surface. The corrected design from `301` is cwd-first and composer-first:

```text
Open Code mode
→ load last cwd or require cwd picker
→ show empty Code chat/composer
→ first prompt creates cwd-keyed JWC Code session
→ Manager spawns/attaches `jwc` in that cwd
→ transcript renders from top
→ composer remains the primary input
```

## 301 crystallized frontend contract

### Scope and identity

- Code mode is independent from selected cli-jaw instances.
- Code mode primary state is `cwd + JWC session id`, not a cli-jaw instance card.
- Opening Code mode does **not** spawn JWC.
- The first submitted prompt creates a cwd-keyed JWC Code session and starts/attaches `jwc`.

### Main layout

Use the supplied Claude-style reference as layout/UX inspiration only, not as theme. Keep Jaw/cli-jaw visual identity.

```text
Manager shell
├─ left app/session navigation shell
├─ central Code canvas
│  ├─ transcript area from top
│  ├─ workspace/git chips near composer
│  └─ single composer anchored near bottom
└─ progressive panels
   ├─ Folders
   ├─ Diff
   ├─ Tools
   ├─ Auth
   └─ Logs/status as needed
```

Central canvas rules:

- Transcript renders from top in chronological order.
- Composer is the only primary prompt input.
- The primary UI must not be a heavy split-view session manager.
- Session/recent lists may exist as lightweight navigation, but they are secondary to cwd + active JWC session.

### Composer and status row

```text
[ Describe a task or ask a question                                      ]

Ask permissions   +   mic                          provider / model / effort / ◔ context
└ left controls are independent                    └ right controls are independent dropdown/status items
```

Rules:

- Left controls: `Ask permissions`, `+`, `mic`.
- Right controls: provider, model, effort, context spinner/status.
- Provider/model/effort are dropdown-like controls.
- Context spinner is a context/status indicator, not a model selector.
- Before session start: provider/model/effort are mutable.
- After session start: provider/model are session identity; changing them proposes a new Code session.
- Effort may change for the next turn and should log a small transcript/status event.

### Workspace chips

Near the composer, show compact context chips:

- `Local`
- repo/project name, e.g. `cli-jaw`
- branch, e.g. `dev`
- worktree state
- cwd picker/change affordance before first prompt

Backend source for repository metadata: `GET /api/code/git-info?cwd=...` from cli-jaw `src/routes/code.ts`.

### Auth/model visibility

- Normal provider/model picker shows authenticated/available options only.
- Unauthenticated provider/model rows are hidden, not disabled.
- If no authenticated provider/model exists, show compact `login required` / `/login` action instead of fake choices.
- `/login` opens Auth Center modal.
- Auth Center is the discovery surface for unauthenticated providers.
- Successful login refreshes provider/model inventory without full Manager reload.
- Auth inventory route/bridge must be resolved in cli-jaw implementation or marked `TBD — cli-jaw checkout required` in parity docs.

### Permission baseline

- Do not force blocking approval UI into this slice.
- Match current Jaw Code behavior baseline: show bypass/policy status indication.
- If explicit approval UX is reopened later, design it in a separate phase.

### Chrome/logo polish

The macOS traffic-light controls and `CLI-JAW DASH` brand currently risk visual collision. This UI phase includes shell polish:

```text
[macOS traffic lights]   CLI-JAW DASH
                         └─ aligned baseline / no overlap
```

Acceptance:

- Brand text has enough left offset from traffic lights.
- Vertical alignment matches the header/search row.
- Jaw/Code switch is not placed inside the traffic-light/logo hit zone.
- Resizing does not reintroduce overlap.

## API/frontend mapping

| UI action/state | cli-jaw API | Notes |
|---|---|---|
| Cwd metadata chips | `GET /api/code/git-info?cwd=...` | Requires absolute cwd. |
| First prompt session start | `POST /api/code/sessions` then `POST /api/code/sessions/:id/prompt` | Opening Code mode alone does not call this. |
| Prompt stream | `GET /api/events` with topic `jwc` / `code_*` events | AcpHost publishes `code_${kind}`. |
| Cancel turn | `POST /api/code/sessions/:id/cancel` | Maps to ACP `session/cancel`. |
| Close session | `DELETE /api/code/sessions/:id` | Maps to ACP `session/close`. |
| Auth/model inventory | `TBD — cli-jaw checkout required` | Must be resolved or blocked before implementation. |

## Superseded assumptions

The old planning shape that centered a large session manager pane and mandatory browser approval flow is superseded. Those concepts may reappear only as secondary/recent/session management affordances after the cwd-first composer experience is implemented.

## Frontend mockup acceptance

- [ ] Code mode opens to last cwd or required cwd picker.
- [ ] Opening Code mode does not spawn JWC.
- [ ] First prompt creates a cwd-keyed JWC Code session.
- [ ] Transcript renders from the top.
- [ ] Composer remains the primary input.
- [ ] Composer footer has left `Ask permissions / + / mic` and right `provider / model / effort / context`.
- [ ] Unauthenticated providers/models are hidden from the normal picker.
- [ ] `/login` Auth Center is the discovery/login surface.
- [ ] Provider/model change after session start proposes a new Code session.
- [ ] Effort change after session start applies next turn.
- [ ] Blocking approval queue/cards are not required in this slice.
- [ ] `CLI-JAW DASH` aligns with macOS traffic-light controls without overlap.

## Verification

```bash
# cli-jaw checkout, after implementation
npm run build:frontend
# Browser/manual:
# - open Manager Code mode;
# - verify no JWC spawn before first prompt;
# - choose cwd;
# - send prompt;
# - observe Code REST + SSE stream;
# - verify auth picker hidden-only behavior;
# - verify traffic-light/logo alignment.
```

## Not in scope

- Existing Jaw mode runtime attach (slice 305).
- Detailed permission approval queue/cards.
- Making Code mode a selected cli-jaw instance sub-view.
- Parity matrix closure (slice 310).
