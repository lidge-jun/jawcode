# 272 Phase 27 build — 10.038-D RPC fast-lane evidence

## Built

- Added focused RPC fast-lane scheduler tests.
- Fixed `get_messages` to return a defensive array snapshot.
- Added `10.038-D` chase-card evidence while keeping `10.038-B` reserved for UDS/listen.

## Changed files

- `packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts`
- `packages/coding-agent/test/rpc-fastlane.test.ts`
- `struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/270_phase27_rpc_fastlane_evidence_plan.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/271_phase27_rpc_fastlane_evidence_audit.md`

## JWC-native boundary

This phase does not copy the upstream GJC test file wholesale. It adds JWC package imports, current command type names, and a focused snapshot regression for the drift found in JWC.

