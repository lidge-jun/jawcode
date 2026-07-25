# 000 — A 카드 17개 구현 로드맵

> Session: `019f6de9-f741-7233-9af9-c1684303685b`
> Goalplan: `a-cards-17-implementation-provider-safety-model`
> Date: 2026-07-17
> Archetype: spec-satisfaction (verifier = tsc + focused tests)

## 의존성 순서

```
WP1 (Provider Safety) → WP2 (Model Catalog) → WP3 (Auth/Transport) → WP4 (TUI/UX)
     ↓ foundation           ↓ depends on WP1        ↓ depends on WP1      ↓ independent
```

## Interview 결정 요약

1. Model selection: 선택적 백엔드 수용 (runtime import, UI는 JWC 재설계)
2. 새 기능: Codex Lite/telemetry만 (vibe/Warp/xdev reject)
3. TUI: JWC 자체 철학 유지, terminal correctness fix만 선별
4. IRC sidebar: overlay 유지 (sidebar reject)
5. Multi-org: 지금 불필요 (rotation/serialization만)

## OPEN ASSUMPTIONS (구현 시 검증)

- GPT-5.6 Sol/Terra/Luna provider 가용성
- resolver sticky selection 보호 여부
- Responses Lite transport mode 존재 여부
- keybinding write-back atomicity
- Kitty/sixel 버그 JWC 재현 여부
