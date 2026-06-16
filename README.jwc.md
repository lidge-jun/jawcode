# Jawcode (jwc)

> [`gajae-code`](https://github.com/Yeachan-Heo/gajae-code) 포크. cli-jaw의 네이티브 에이전트 런타임. Jawcode/JWC 표면을 기준으로 패키징되는 빌드. 내부 `@jawcode-dev/*` 패키지 네임스페이스는 업스트림에서 유래.

## 관계

- **엔진**: Jawcode runtime — **소스 하드 수정 원칙** (인터뷰 260612 02:04 확정): 프롬프트·번들 스킬에 Jawcode/JWC 어휘 직접 기입, 가드는 JWC 기준. 업스트림 머지 시 프롬프트 충돌은 수용 비용. 공개 표면은 Jawcode/JWC만 사용한다.
- **npm package**: `jawcode` — `npm install -g jawcode`
- **jwc bin**: `packages/jwc/bin/jwc.js` — 설치 후 사용자 명령은 `jwc`
- **임베딩 표면**: `jawcode/sdk` (`packages/jwc/src/sdk.ts`가 현 소스 위치) — cli-jaw가 import하는 단일 통로
- 상태 경로는 `.jwc/` 기준이다. 공개 릴리스 에셋명은 `jwc-<platform>-<arch>` 기준이다.
- **워크플로 표면**: 공개 기본값은 `jaw-interview`, `plan`/`jwc orchestrate`, `goal`/`jwc goal`, `team`이다. `ralplan`/`ultragoal`은 내부 엔진·호환 명칭으로만 취급한다.
- **사람 개입 기본값**: PABCD 자체는 **HITL**(사람이 단계 전환을 확인)이다. `jwc goal`로 감싼 PABCD만 **HOTL**(에이전트가 증거를 남기며 계속 진행, 사람은 관찰하다가 필요할 때 개입)로 본다.

## 실행

```sh
bun packages/jwc/bin/jwc.js            # TUI
bun packages/jwc/bin/jwc.js --version  # jwc/<engine version>
```

기여: [CONTRIBUTING.jwc.md](./CONTRIBUTING.jwc.md) · beta 문서 마감: [structure/50_status.md](structure/50_status.md)
문서 정본 가이드와 에이전트용 개발로그는 [`AGENTS.md`](./AGENTS.md)에 적는다.

## 아이덴티티 설정

`/settings` Identity 탭(또는 `identity.{name,emoji,vibe,language}` config 키)으로 에이전트 이름/말투/언어를
설정하면 시스템 프롬프트에 반영된다. `/identity`는 설정 경로 안내, `/identity-auto`는 대화형 설정. 미설정 시 업스트림과 동일.

## 현재 개발 축

- 000–099: JWC 단독 표면 안정화 — `jwc`, `.jwc`, 기본 workflow alias, IPABCD discovery, memory/goal/orchestrate 기초.
- 100–150: cli-jaw 통합 전 준비 — `jawcode/sdk`, standalone package, managed Bun, local tarball/install smoke, active public legacy-identity zero cleanup. 150은 Jawcode repo와 cli-jaw embedded Jawcode bundle을 함께 본다.
- 160 이후: cli-jaw dependency merge, no-global-`jwc` embedded runtime, 새 GitHub Actions/릴리스 CI 재설계. 현재 repo-visible CI workflow는 의도적으로 제거되어 있다.

정본 계획: `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/000_moc_distribution_strategy.md` · 코드 지도: `structure/00_INDEX.md` · **레디니스**: `structure/50_status.md` · 로직: `structure/40_fork-delta.md` · 문서 삼축: `structure/00_INDEX.md` · 대조: `struct_har/README.md` · omp: `struct_har/omp_origin/README.md`
