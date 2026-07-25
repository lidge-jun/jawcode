# 20 Phase 2 — 10.041 TUI input/render Windows psmux

## P scope

Close `struct_har/chase/10.041_gjc_chase_tui_input_render_windows_psmux.md` as a JWC-adapted clean-follow card.

Work class: C3, because the surviving gap crosses the TUI editor package and coding-agent hook selector wiring. No security, auth, process-control, or Windows psmux runtime change is planned in this card.

## Source classification

| upstream commit | JWC decision | evidence |
|---|---|---|
| `c558504e` Windows/psmux tmux provider boundary | Defer | Platform/team behavior belongs to `10.057`, `10.061`, or prior Phase 8 `10.050`, not this TUI-only card. |
| `11e3e5f4` lobster status identity | Reject | Identity-sensitive upstream branding does not apply to JWC. |
| `19bba222` input render priority | Already implemented | `packages/tui/src/tui.ts` has input-priority render scheduling; `packages/tui/test/input-render-latency.test.ts` and `packages/tui/test/input-render-redteam.test.ts` cover it. |
| `38ac6dcd` inline Other input `@` autocomplete | Adopt/adapt now | JWC currently has inline input mode, but `Editor` lacks a public autocomplete-provider getter and `HookSelectorComponent` does not pass autocomplete into the inline editor. |
| `a8d0d5f4` passive active monitor/cron panel | Already adapted | JWC has `background-footer-panel*`, `JobsObserver.backgroundRows`, `app.background.expand`, and footer compact text instead of upstream's `active-jobs-panel` naming. |
| `932f5e07` deterministic redraw metrics | Already covered | JWC has `packages/tui/test/metrics.test.ts` and `packages/tui/test/metrics-redteam.test.ts`. |
| `61dbe110` model selector row identity | No new patch in this card | JWC's model selector uses a different two-pane/profile control design. Existing tests cover the current JWC shape; upstream's exact preset-row identity code is not directly portable. |
| `5316e261` long-session render lifecycle | Already partly covered / split | 10.060 added per-component render isolation. Other lifecycle/viewport hardening is protected by existing TUI tests and remains outside this small autocomplete gap unless a fresh regression appears. |

## Diff plan

### MODIFY `packages/tui/src/components/editor.ts`

Add a small public getter:

```ts
getAutocompleteProvider(): AutocompleteProvider | undefined
```

Do not add a duplicate `isAutocompleteOpen()` API; JWC already exposes `isShowingAutocomplete()`.

### MODIFY `packages/coding-agent/src/modes/components/hook-selector.ts`

Import `type AutocompleteProvider` from `@jawcode-dev/tui`.

Add `autocompleteProvider?: AutocompleteProvider` to `HookSelectorOptions`.

Store it on `HookSelectorComponent`.

Attach it in both editor-construction paths:

- `#createPromptEditor()` for `customInput` and `customInputDocked`.
- `#ensureListSlotEditor()` immediately after `createAskOutputPanelEditor()` for `customInputListSlot`.

Make `#handleInputModeKey()` delegate every key to the editor while `editor.isShowingAutocomplete()` is true. That keeps Enter from submitting the custom answer before the dropdown can apply an `@file` completion.

### MODIFY `packages/coding-agent/src/modes/controllers/extension-ui-controller.ts`

When a hook selector uses a free-text custom input (`customInput`, `customInputDocked`, or `customInputListSlot`), pass `this.ctx.editor.getAutocompleteProvider()` into `HookSelectorComponent`.

### MODIFY `packages/coding-agent/test/hook-selector-inline-input.test.ts`

Add a minimal deterministic `@` autocomplete provider test:

- typing `@` in inline Other input opens suggestions;
- the test yields once with `await Bun.sleep(0)` after typing `@` so the async `getSuggestions()` promise can open the dropdown before Enter is simulated;
- first Enter applies `@src/app.ts` and does not submit;
- second Enter submits the completed text;
- no-provider path keeps `@` literal and submits it.

## Documentation closure plan

After code and checks pass:

- Move `struct_har/chase/10.041_gjc_chase_tui_input_render_windows_psmux.md` to `struct_har/chase/_fin/10/10.041_gjc_chase_tui_input_render_windows_psmux.md`.
- Mark `10.041` done in `struct_har/chase/10_gjc_chase_MOC.md`.
- Mark `U9` done in `struct_har/chase/007_follow_index.md`.
- Update `struct_har/chase/002_gap_inventory.md` if it still lists `10.041` open.
- Add a `10.041` cycle note in `struct_har/chase/10.001_gjc_chase_cycle.md`.
- Add `_fin` index entry in `struct_har/chase/_fin/INDEX.md`.

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/hook-selector-inline-input.test.ts packages/tui/test/input-render-latency.test.ts packages/tui/test/input-render-redteam.test.ts packages/coding-agent/test/background-footer-panel-model.test.ts packages/coding-agent/test/jobs-observer.test.ts packages/coding-agent/test/model-selector-two-pane.test.ts
```

Full gates:

```sh
bun run check:ts
git diff --check
```

Review gate: Frontend employee read-only audit of the plan and final diff.
