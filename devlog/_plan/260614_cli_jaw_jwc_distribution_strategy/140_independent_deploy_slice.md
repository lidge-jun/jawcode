# 140 — independent JWC deploy slice

## Goal

Register and validate independent JWC deploy/CI so jawcode can release on its own.

## Tasks

1. Apply package target:
   - package name `jawcode`;
   - bin name `jwc`;
   - import surface `jawcode/sdk`.
2. Add package dry-run CI.
3. Add install smoke CI.
4. Add managed Bun safe-mode CI.
5. Add release artifact CI.
6. Document install/update path.
7. Keep release tag job responsible for heavyweight native matrix.

## Release readiness

Standalone JWC is release-ready only when:

- package target is `jawcode`;
- package does not require unpublished dependencies;
- tarball includes scripts/bin/dist/dist-node as intended;
- postinstall and managed Bun behavior are safe under CI and local mode;
- visible artifacts use JWC/Jawcode naming or a documented compatibility transition.

## Relationship to cli-jaw

Independent deploy is useful but not sufficient for cli-jaw integration. cli-jaw still needs its own no-global-`jwc` embedded smoke.
