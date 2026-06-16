# Port Shorthand (`--NNNN`) Global CLI Feature

> `jaw chat --3458`, `jaw serve --3458`, `jaw service --3458` 등  
> `--숫자` 패턴을 포트로 인식하여 `--home ~/.cli-jaw-3458`으로 자동 매핑

## Status: PLAN

## Background

jaw 인스턴스는 포트 번호로 구분됨 (기본 3457). 각 인스턴스의 home 디렉토리는 `~/.cli-jaw-{port}` 규칙을 따름.
현재는 특정 인스턴스를 대상으로 CLI 명령을 실행하려면 `--home ~/.cli-jaw-3458` 같은 긴 경로를 지정해야 함.

**목표**: `--3458` 같은 숫자 플래그만으로 포트 기반 인스턴스 라우팅을 지원.

## Scope

### Phase 1: argv 전처리 (Core)
- [ ] `cli.ts`의 `runCli()` 진입점에서 argv 전처리
- [ ] `--NNNN` 패턴 감지 (1000~65535 범위의 4~5자리 숫자)
- [ ] `--home ~/.cli-jaw-{NNNN}` + `--port {NNNN}`으로 치환
- [ ] 기존 `--home` 플래그와의 충돌 처리 (둘 다 있으면 에러)

### Phase 2: 명령별 적용
- [ ] **전역 적용 대상**: 모든 등록 명령에 자동 전파
  - `chat`, `memory`, `goal`, `orchestrate`, `interview`
  - `harness`, `session`, `state`, `skills`
  - `launch` (기본 명령)
- [ ] jaw-brand-only 명령 포함 검증

### Phase 3: --help 업데이트
- [ ] **루트 help** (`jaw --help`)
  - 상단 USAGE 섹션에 `--NNNN` 숏핸드 설명 추가
  - "Instance Routing" 섹션 신설 또는 기존 Configuration 하위에 추가
- [ ] **각 명령 help** (`jaw chat --help`, `jaw goal --help` 등)
  - 명령별 flags 목록에 port shorthand 안내 추가
  - examples에 `--3458` 사용 예시 추가
- [ ] **getExtraHelpText()** (`cli/args.ts:215`)
  - Configuration 섹션에 `--NNNN` 설명 라인 추가
  - 예: `--NNNN                     - Port shorthand (e.g., --3458 → ~/.cli-jaw-3458)`
- [ ] **renderRootHelp()** (`utils/src/cli.ts:253`)
  - USAGE 라인에 `[--PORT]` 표기 추가

### Phase 4: 검증
- [ ] 단위 테스트: argv 전처리 함수
- [ ] 통합 테스트: `jaw chat --3458` end-to-end
- [ ] 에러 케이스: 잘못된 포트 범위, `--home`과 중복

## Architecture

### 진입점: `cli.ts` → `runCli(argv)`

```
argv: ["chat", "search", "hello", "--3458"]
  ↓ expandPortShorthand()
argv: ["chat", "search", "hello", "--home", "~/.cli-jaw-3458", "--port", "3458"]
  ↓ 기존 라우팅 (isSubcommand → run)
```

### 변경 파일 목록

| 파일 | 변경 | Phase |
|------|------|-------|
| `packages/coding-agent/src/cli.ts` | `expandPortShorthand()` 호출 추가 | P1 |
| `packages/coding-agent/src/cli/port-shorthand.ts` | 새 파일: 전처리 로직 | P1 |
| `packages/coding-agent/src/cli/args.ts` | `getExtraHelpText()` 수정 | P3 |
| `packages/utils/src/cli.ts` | `renderRootHelp()` USAGE 수정 | P3 |
| `packages/coding-agent/src/commands/chat.ts` | examples에 `--3458` 추가 | P3 |
| `packages/coding-agent/src/commands/goal.ts` | examples에 `--3458` 추가 | P3 |
| `packages/coding-agent/src/commands/memory.ts` | examples에 `--3458` 추가 | P3 |
| `packages/coding-agent/src/commands/launch.ts` | examples에 `--3458` 추가 | P3 |
| `packages/coding-agent/test/port-shorthand.test.ts` | 새 파일: 테스트 | P4 |

### 핵심 함수: `expandPortShorthand(argv: string[]): string[]`

```ts
const PORT_SHORTHAND_RE = /^--(\d{4,5})$/;

export function expandPortShorthand(argv: string[]): string[] {
  const result: string[] = [];
  let portFound: string | null = null;

  for (const arg of argv) {
    const m = PORT_SHORTHAND_RE.exec(arg);
    if (m) {
      const port = parseInt(m[1], 10);
      if (port < 1000 || port > 65535) {
        // 범위 밖 → 그대로 통과 (다른 플래그일 수 있음)
        result.push(arg);
        continue;
      }
      if (portFound) {
        throw new Error(`Duplicate port shorthand: --${portFound} and ${arg}`);
      }
      portFound = m[1];
      result.push("--home", `${os.homedir()}/.cli-jaw-${portFound}`);
      result.push("--port", portFound);
    } else {
      result.push(arg);
    }
  }

  // --home과 port shorthand 동시 사용 체크
  if (portFound && argv.includes("--home")) {
    throw new Error(`Cannot use --${portFound} with explicit --home`);
  }

  return result;
}
```

## Risks & Edge Cases

1. **숫자 충돌**: `--3458`이 다른 의미로 쓰이는 명령이 있나? → 현재 없음 (플래그는 모두 named)
2. **기본 포트 (3457)**: `--3457`도 작동해야 하나? → Yes, 명시적 라우팅으로 유용
3. **존재하지 않는 인스턴스**: `~/.cli-jaw-9999`가 없으면? → 명령 레벨에서 에러 처리 (전처리는 경로만 확장)
4. **`jaw serve --3458`**: serve 명령이 jawcode에 있나? → 현재 없음 (cli-jaw 서버 측). jawcode CLI에는 `harness start`가 유사. cli-jaw 서버 측은 별도 작업.

## Decision Log

| ID | Decision | Reason |
|----|----------|--------|
| D1 | argv 전처리 방식 (명령 진입 전) | 모든 명령에 일괄 적용, 명령별 수정 불필요 |
| D2 | 포트 범위 1000-65535 | 표준 포트 범위, 3~4자리 미만은 다른 플래그와 충돌 가능 |
| D3 | `--home` + `--port` 동시 주입 | home만 주입하면 API 포트가 틀어짐 |
| D4 | --help 업데이트는 Phase 3에서 일괄 | 기능 구현 후 help 텍스트 통일 |
