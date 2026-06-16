# Contradictions Report — docs vs README vs site vs code

> 100+ 시리즈: API gap / 모순 발견 시 보고만. 문서는 수정하지 않음.

## C001: docs/sdk.md — npm 패키지명
- **위치**: `docs/sdk.md`
- **모순**: `@gajae-code/coding-agent` 참조. 공개 npm 패키지는 `jawcode`.
- **영향**: 개발자가 잘못된 패키지를 설치 시도
- **해결**: README에서는 이미 `jawcode` 사용. docs/sdk.md 미수정 (내부 문서)

## C002: docs/REBRANDING_PLAN_260525.md — 테마 기본값
- **위치**: `docs/REBRANDING_PLAN_260525.md`
- **모순**: red-claw를 JWC 기본이라 기술. 실제는 `abyss-bite` (theme.ts:1801)
- **영향**: 테마 문서가 잘못된 기본값 안내
- **해결**: README에서 이미 수정 완료 (`abyss-bite` 명시)

## C003: docs/grok-build-provider-design.md — 미완료 게이트
- **위치**: `docs/grok-build-provider-design.md`
- **모순**: owner sign-off 게이트 미완료 — 공개 불가
- **영향**: 공개 문서에 포함하면 미완성 설계가 노출
- **해결**: developer docs에서 제외 (internal-only)

## C004: docs/brand-assets.md — 로고 참조
- **위치**: `docs/brand-assets.md`
- **모순**: hero.png, character.png 참조. 실제 assets는 jawcode-logo.png (상어 jaw)
- **영향**: 브랜드 에셋 가이드가 잘못된 파일 참조
- **해결**: README/site에서 이미 jawcode-logo.png 사용. docs/ 미수정

## C005: Source install — cli-jaw bootstrap 누락
- **위치**: README.md Install, docs-site installation.html
- **모순**: `bun install` 후 바로 실행 가이드. 실제로는 `~/.cli-jaw/` 부트스트랩 필요 (npm postinstall에서 자동, source에서는 수동).
- **영향**: 소스 빌드 사용자가 skills/settings 없이 실행 → 기능 제한
- **해결**: README + installation.html에 `node packages/jwc/scripts/bootstrap-cli-jaw-home.cjs` + `bun run install:defaults` 추가 완료
