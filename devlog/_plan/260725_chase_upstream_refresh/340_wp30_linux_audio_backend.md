# 340 — wp30: voice input assumed a sound server half of Linux no longer runs

Source: named residual in the wp10 `_fin` card for `20.088` — *"PulseAudio hardcoded in
`stt/recorder.ts`"*.

| phase | evidence |
|---|---|
| P | source trace + a real `ffmpeg -devices` run |
| A | **pass**, probe cost measured, fallback preserved |
| B | `4281779` |
| C | gates green; two ablations |

## The assumption

`startFFmpegRecording` used `-f pulse -i default` for *every* non-Windows, non-macOS platform. PipeWire is
the default on current Fedora and Ubuntu, and a PipeWire-only box has no `pulse` input device — ffmpeg exits
immediately. ALSA-only systems fail identically. The user sees a raw ffmpeg error, not anything that points
at the actual problem.

## The risk was breaking what already works

Changing a default that works today for PulseAudio users is the real hazard here, and it is easy to
rationalize away. So the design is deliberately one-directional: probe failure, empty output, or anything
unparseable all fall back to `pulse` — the exact previous value. This can widen the set of working systems
and cannot narrow it.

On probe cost, I measured rather than assumed: `ffmpeg -hide_banner -devices` returns the compiled-in device
list in about 0.2s and does **not** open audio hardware, so it cannot block on a busy device or trigger a
permissions prompt. Cached per process.

Order matters and is asserted: `pulse` must not come first, or a PipeWire box selects the one backend it
does not have.

## My first four tests proved nothing about behavior

They were all source-shape assertions — "the file contains this string". That catches a deletion but says
nothing about whether the selection is *correct*. Added five behavioral cases over realistic `-devices`
output, including a word-boundary case so `pulseaudio-utils` appearing in a device *description* does not
falsely count as the `pulse` device being present.

## The musl asset residual, declined

`getBinaryName` picks `jwc-linux-x64` with no libc variant, which reads like a bug. It is not actionable
here: **no musl asset is published** by `release.yml`, so teaching the updater to select one requires adding
a musl build to the release workflow. The recorded non-goal names npm release/publish specifically, so this
is the user's call, not mine to infer.
