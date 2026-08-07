# 220 — wp18: `--continue` handed back the conversation you cleared

Anchor: OMP `447eb51f2` *"persist /new boundary so autoResume does not resume pre-/new transcript"*. The
second of the two `/new` follow-ups named in the wp12 closeout.

| phase | evidence |
|---|---|
| P | end-to-end reproduction |
| A | **pass**, after separating three breadcrumb states |
| B | `0a15ff9` |
| C | gates green; ablation with two controls |

## The bug is an interaction, not a single mistake

Two reasonable behaviors combine badly:

1. **Persistence is lazy.** `_persist` skips writing until an assistant message exists, so a session that
   never got a reply leaves no file. That is deliberate — it avoids littering the sessions directory.
2. **The breadcrumb reader verified the target.** `fs.statSync(...)`, and `null` if absent — also reasonable
   in isolation, since a deleted session should not be resumed.

Together: after `/new` the breadcrumb points at a file that does not exist *yet*, the reader calls that
"no breadcrumb", and `continueRecent` falls back to `findMostRecentSession` — the transcript from before the
clear. So:

```
start session → say something → /new → quit → jwc --continue
```

hands back the conversation the user just cleared. Someone who clears a session precisely *because* it
contained something sensitive gets it back on the next launch.

## The real risk was over-suppression

A fix that made `continueRecent` stop resuming would also make the reproduction pass. Three states have to
stay distinct:

| breadcrumb | target on disk | behavior |
|---|---|---|
| present | yes | resume it — **unchanged** |
| present | no | fresh start — **the only change** |
| absent | — | fall back to most recent — **unchanged** |

Rows 1 and 3 have their own tests. The ablation restoring the old fallback turns only the row-2 test red and
leaves both controls green, which is what makes the fix a boundary rather than a mute button.

## A note on reproduction cost

Getting the repro honest took four attempts: the manager exposes `getSessionFile()` rather than a
`sessionFile` property, `appendMessage` rather than `appendUserMessage`, and the usage object needs
`cost.total` or `#appendEntry` throws. Each failure was my test being wrong, not the product. Worth
recording, because a red test proves nothing until you know *why* it is red.
