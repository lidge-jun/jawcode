# 00 — 150 Visible Identity Cleanup Plan

> PABCD Cycle 4 of distribution strategy (220_pabcd_execution_plan.md)
> 작업 브랜치: dev
> 분류: C2 (ordinary product slice — docs + CI config)

## 목표

user-visible 표면에서 legacy gjc/gajae-code identity를 jwc/jawcode로 전환한다.
`@gajae-code/*` 내부 스코프는 D-070-5에 의해 제외.

## 변경 파일

| Action | File | 요약 |
|--------|------|------|
| MODIFY | `README.md` | Install 섹션 + Windows 섹션 전면 재작성, Dev 섹션 test path 수정 |
| MODIFY | `.github/workflows/ci.yml` (dev) | `gjc-state-gates` → `jwc-state-gates` job ID/name/comment |
| MODIFY | `.github/workflows/dev-ci.yml` | `gjc-state-gates` → `jwc-state-gates` job ID/name/comment |
| MODIFY | `scripts/verify-g002-gates.ts` | GJC → JWC in CI gate failure output |
| MODIFY | `scripts/ci-dev-affected.ts` | robogjc/GJC → jwc/JWC in CI-visible task labels |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/070_decision_register.md` | Q-070-3 resolved 기록 |

## NOT in scope

| 항목 | 사유 |
|------|------|
| `@gajae-code/*` internal scope | D-070-5: high churn, not user-visible |
| `gajae-layofflabs-2` 러너 라벨 | 인프라 의존 — 자체호스팅 러너 0개, 러너 재등록 없이 rename 불가 |
| `structure/*.md` 내부 문서 | 소스 경로 참조, user-visible 아님 |
| `README.jwc.md` | 이미 jawcode 기준, gajae-code 언급은 lineage/compat 참조로 적절 |
| main 브랜치 CI | 이미 jawcode 기준 (simplified CI, ubuntu-latest) |
| Issue templates | legacy 없음 |

## 상세 diff

### 1. README.md — Install 섹션 (lines 22-28)

**Before:**
```markdown
## Install

```sh
npm install -g jawcode
```

Some internal workspace packages still use the transitional `@gajae-code/*` scope while the public package surface moves to Jawcode.
Packaging and cli-jaw integration are tracked in [`devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/000_moc_distribution_strategy.md`](devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/000_moc_distribution_strategy.md).
```

**After:**
```markdown
## Install

```sh
npm install -g jawcode
```

Requires Node.js 22+ and npm. The Bun runtime is installed as a package dependency automatically.
```

> Note: `engines.node` is not yet set in package.json. This README states the practical
> requirement (Node 22 for ESM shebang + setup-node in CI). A future package patch
> should add `"engines": {"node": ">=22"}` to align the contract.

### 2. README.md — Windows 섹션 (lines 30-61)

**Before:** 전체 `gjc`/`gajae-code` 기반 Windows 설치 가이드

**After:**
```markdown
### Windows (native install)

On a clean Windows 11 machine, install Node.js first, then install `jwc`:

```powershell
# 1. Install Node.js 22+ from https://nodejs.org (LTS recommended)

# 2. Install and verify jwc
npm install -g jawcode
jwc --version
jwc --smoke-test
```

`npm install -g` places the `jwc` launcher in npm's global bin directory.
That directory must be on `PATH` for `jwc` to resolve as a command.

Troubleshooting:

- **`jwc` is "not recognized".** Run `npm config get prefix` to find npm's
  global prefix, then add `<prefix>` to your `PATH`. Restart the terminal.
- **`jwc` reports an old Bun runtime.** The package provisions Bun as a
  dependency. Run `npm install -g jawcode` again to update.
```

### 3. README.md — Development 섹션 (line 176)

**Before:**
```
bun test packages/coding-agent/test/default-gjc-definitions.test.ts
```

**After:**
```
bun test packages/coding-agent/test/default-jwc-definitions.test.ts
```

### 4. CI workflows — gjc-state-gates rename

**ci.yml changes (3 lines):**
- Line 79: comment `gjc-state-gates` → `jwc-state-gates`
- Line 80: job ID `gjc-state-gates:` → `jwc-state-gates:`
- Line 81: `name: gjc-state-gates` → `name: jwc-state-gates`

**dev-ci.yml changes (3 lines):**
- Line 70: comment `gjc-state-gates` → `jwc-state-gates`
- Line 71: job ID `gjc-state-gates:` → `jwc-state-gates:`
- Line 72: `name: gjc-state-gates` → `name: jwc-state-gates`

### 5. CI scripts — user-visible GJC 라벨 (4건)

**scripts/verify-g002-gates.ts:**
- Line 349: `"contains GJC team runtime naming"` → `"contains JWC team runtime naming"`

**scripts/ci-dev-affected.ts:**
- Line 226: `"robogjc-web-typecheck"` / `"robogjc web typecheck"` → `"jwc-web-typecheck"` / `"jwc web typecheck"`
- Line 227: `"robogjc-web-build"` / `"robogjc web build"` → `"jwc-web-build"` / `"jwc web build"`
- Line 237: `"GJC CLI smoke test"` → `"JWC CLI smoke test"`

### 6. Decision register update

Q-070-3 → resolved: "Option A — direct rename. No branch protection configured on main/dev/preview. Self-hosted runners absent (0 registered), so runner label rename is infrastructure-blocked and deferred."

## 검증 기준

```bash
# 1. user-visible gjc/gajae 참조 0건 (internal scope + lineage 제외)
grep -rn 'gjc\|gajae' README.md .github/workflows/ci.yml .github/workflows/dev-ci.yml \
  | grep -v '@gajae-code' | grep -v 'gajae-layofflabs' | grep -v 'lineage from gajae-code' | wc -l
# expect: 0

# 2. jwc 로컬 실행
bun packages/jwc/bin/jwc.js --help

# 3. test path 존재 확인
ls packages/coding-agent/test/default-jwc-definitions.test.ts
```

## 커밋 계획

1. `docs: rewrite README.md for jawcode/jwc identity`
2. `ci: rename gjc-state-gates → jwc-state-gates`
3. `ci: rename GJC/robogjc labels in CI scripts`
4. `docs: resolve Q-070-3 in decision register`
