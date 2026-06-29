# 84 Phase 8 split — 10.045 computer-use native control

## Source card

`struct_har/chase/10.045_gjc_chase_computer_use_native_control.md`

## JWC posture

Treat native desktop control as a C4 security and platform surface. JWC currently has a JS tool prompt/backend surface and tests, while the upstream source has a large Rust `crates/pi-natives/src/computer/**` module. Any native code requires a separate design, permission model, and focused security review.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| tool prompt and schema posture | `packages/coding-agent/src/prompts/tools/computer-use.md`; `packages/coding-agent/test/tools/computer-use.test.ts` |
| JS backend bridge | `packages/coding-agent/src/tools/computer-use.ts`; `packages/coding-agent/src/tools/computer-use-backend.ts` |
| native crate baseline | `crates/pi-natives/src/lib.rs`; existing `crates/pi-natives/src/*.rs`; no JWC `crates/pi-natives/src/computer/**` module found in this scan |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.045-A` | Coordinate, screenshot, stale-state, and fallback contract tests around the existing JS computer-use tool surface. | `tools/computer-use.test.ts`; prompt snapshot or schema tests. |
| `10.045-B` | Native module design doc and permission-gate tests before any Rust implementation. | security review, platform guards, no default-on native input. |
| `10.045-C` | Rust native capture/input implementation only after design approval in a later C4 PABCD loop. | Rust tests, TS bridge tests, macOS permission negative tests, no token/log leakage. |

## Reject/defer

- Copying upstream `crates/pi-natives/src/computer/**` directly into JWC.
- Enabling native input by default.
- Bypassing macOS accessibility/screen-recording permission checks.
- Claiming support without a real platform smoke or negative-permission test.

## Done-gate status

No `10.045` done-gate is closed by this split. The card remains active.
