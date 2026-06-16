# Decision Record

Date: 2026-06-16

## D1: CI Job Strategy → 단일 job 합침

check+package를 하나의 job으로 합침.
- 이유: 가장 간단, ~6min 절약, artifact 관리 불필요
- mac-native-probes는 별도 유지 (다른 OS)

## D2: gjc 정리 범위 → 전부 (benchmark 제외)

CI/install/package + robojwc + Docker 전부 정리 (~30건).
benchmark의 gjc-rpc 의존 항목만 제외 (별도 gjc-rpc → jwc-rpc rename 필요).

## D3: Version Bump → 1.0.1 (patch)

jawcode@1.0.0은 npm에 broken dep으로 올라감. 1.0.1로 patch publish.
@gajae-code/natives@1.0.0도 함께 publish 필요.

## D4: Types Fix → DEFERRED

packages/jwc는 Bun-first 패키지로 .ts 소스를 types로 의도적 제공.
tsconfig.publish.json 추가 시점에 별도 처리.

## D5: Dep Version Strategy → hard-coded 1.0.0 (A-stage revised)

원래 workspace:* 계획이었으나 ARCH-A15 (npm pack이 literal workspace:*를 tarball에 포함) 때문에 철회.
hard-coded 1.0.0 + version-match gate (W1-E)로 대체.
