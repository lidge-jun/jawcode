# 00 — MOC: GitHub 배포 전 패키징 감사

> 상태: 🟡 전수조사 진행 중. jawcode + cli-jaw GitHub 배포 전 외부 의존성·하드코딩 경로·
> 머신 종속 참조를 전부 찾아 내부화하거나 동적 해석으로 교체한다.

## 배경

cu-mcp(`~/developer/codex/23_computer_use/`)가 jawcode 외부 레포에 절대경로로 참조됨.
cua-driver(`~/.local/bin/cua-driver`)도 외부 바이너리. GitHub에 배포하면 다른 머신에서 깨짐.

## 조사 범위

| 대상 | 조사 항목 |
|---|---|
| jawcode 모노레포 | 소스·설정·MCP config의 절대경로, `file:` 의존성, 외부 바이너리 참조 |
| cli-jaw | prompt 템플릿·mcp-sync·structure의 머신 종속 경로 |
| cu-mcp-server | 의존성 포터빌리티, cu-native 바이너리 전략, 모노레포 패키지화 방안 |
| cua-driver | 외부 바이너리 → 설치 스크립트 or 선택적 의존 |

## 작업 항목 (Sonnet 전수조사 결과로 갱신 예정)

- [x] cu-mcp를 `packages/cu-mcp-server/`로 이동 (`4508c96e`)
- [x] cu-native Swift → prebuilt binary `packages/cu-mcp-server/bin/cu-native`
- [x] `~/.jwc/agent/mcp.json` → `node`(PATH) + 상대경로 + cwd
- [x] cua-driver → `cua-driver`(PATH), optional
- [x] jawcode 소스 내 `/Users/jun` → 0건 (Sonnet 감사 확인)
- [x] cli-jaw 소스 내 → 0건 (Sonnet 감사 확인)
- [x] 2차 전수조사 ([20](./20_audit_round2.md)): 외부 바이너리 11종 목록화, 설정 하드코딩 전부 해소, 런타임 외부 레포 참조 0건
- [ ] **자동 설치 스크립트** — `bun install` → postinstall에서:
  - platform=darwin 감지 → `brew install tmux` (없으면) + cua-driver 설치 스크립트 + cu-mcp tsc 빌드
  - `--safeinstall` 플래그로 선택적 (cli-jaw 패턴: `ensure:native` + `postinstall-guard.cjs`)
  - cu-native prebuilt binary는 `bin/`에 동봉 → 빌드 불필요
  - 참조: `cli-jaw/scripts/ensure-native-modules.cjs`, `cli-jaw/scripts/postinstall-guard.cjs`

## 문서

| # | 문서 | 내용 |
|---|---|---|
| 00 | 본 MOC | 감사 범위·작업 항목 |
| [10](./10_audit_results.md) | 1차 전수조사 | jawcode·cli-jaw·cu-mcp 감사 (Sonnet 3건) |
| (추가 예정) | 2차 전수조사 | 외부 바이너리·설정 하드코딩·외부 레포 참조 (Sonnet 3건) |
| bridge | [260614 deploy/fork/packaging bridge](../260614_deploy_fork_packaging_bridge/README.md) | packaging postinstall을 GitHub deploy G004와 fork promotion P6에 연결 |
