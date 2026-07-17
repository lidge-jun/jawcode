# 001 — pull evidence (fetch 결과)

> Date: 2026-07-17
> Phase: 0 (docs-first)

## Fetch 전후

| 축 | clone 경로 | remote | before HEAD | after HEAD | range | non-merge |
|---|---|---|---|---|---|---:|
| **GJC** | `devlog/_gjc_chase/gajae-code` | `upstream dev` | `4a80bac9` (v0.9.6) | `3ddf26079` (post-v0.11.1) | `4a80bac9..3ddf26079` | **302** |
| **OMP** | `devlog/_omp_chase/oh-my-pi` | `origin main` | `7aa1d581c` (v16.4.2) | `b0d04e517` (v17.0.1) | `7aa1d581c..b0d04e517` | **586** |

## 버전 경계

### GJC

- v0.9.6 (last carded) → v0.10.0 → v0.10.1 → v0.10.2 → v0.11.0 → v0.11.1+
- 주요 변화: SDK lifecycle hardening, command palette, security/control-token neutralization, Grok 4.5, durable model selection

### OMP

- v16.4.2 (last carded) → v16.4.3 → v16.4.4 → v17.0.0 → v17.0.1
- 주요 변화: model hub, vibe mode, ask dialog, credential rotation, Anthropic/Google schema hardening, usage/quota classification

## 검증 명령

```bash
# GJC
cd devlog/_gjc_chase/gajae-code
git rev-list --count 4a80bac9..upstream/dev --no-merges  # → 302
git cat-file -e 4a80bac9  # → exit 0
git cat-file -e 3ddf26079  # → exit 0

# OMP
cd devlog/_omp_chase/oh-my-pi
git rev-list --count 7aa1d581c..origin/main --no-merges  # → 586
git cat-file -e 7aa1d581c  # → exit 0
git cat-file -e b0d04e517  # → exit 0
```

## 상태

fetch만 완료, pull(fast-forward)은 Boss 승인 대기. clone HEAD는 아직 이전 위치.
