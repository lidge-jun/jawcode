# 190 — wp15: the second caller's config went nowhere

Anchor: GJC `7dfa17d97` *"improve SDK embedding UX"*.

| phase | evidence |
|---|---|
| P | `settings.ts:251-252` — `if (globalInstancePromise) return globalInstancePromise;` |
| A | **pass**, after rejecting upstream's comparison |
| B | `58f31d4` |
| C | gates green; two contrasting ablations |

## The gap

`Settings.init(options)` is a first-wins singleton. When it had already been initialized, the new `options`
were discarded entirely and silently. `SettingsOptions` carries `cwd`, `agentDir`, `inMemory` and
`overrides`, so an embedder passing a different project directory got the first caller's configuration with
nothing in the logs to explain it.

This is not hypothetical: `cli/shell-cli.ts` passes `cwd`, `notifications/daemon-cli.ts` passes `agentDir`,
`sdk.ts` documents `Settings.init({ cwd, agentDir })`, and `eval/py/kernel.ts` and `acp-agent.ts` call it
bare. Whichever runs first wins, and the others never find out.

## Why upstream's fix does not port

Upstream compares `JSON.stringify(options)` against the recorded init options. Applied to JWC that
misfires twice:

1. **17 call sites call `Settings.init()` with no arguments.** Omitting options means "use whatever is
   configured", not "I disagree with the configuration". Upstream's check warns on every one of them, and a
   warning that fires on ordinary startup is noise that trains people to ignore it.
2. **`JSON.stringify` is key-order sensitive.** `{ inMemory, cwd }` and `{ cwd, inMemory }` are the same
   request and would still warn.

So conflicts are computed per field, only over fields the later caller explicitly set, compared
structurally so `overrides` matches by content rather than object identity. The warning names exactly which
fields would be lost.

I did not change the return value. Handing back a second instance would split the configuration the rest of
the process reads — that is a behavior change, not a UX fix.

## Ablations

Two, deliberately contrasting:

- Neutering the comparison entirely → 4 of 7 red (the warning is real).
- Substituting upstream's `JSON.stringify` check → a **different** 4 red, including the bare-re-init and
  key-order cases (the audit finding is real, not a matter of taste).
