# PABCD 입력 테두리 light cycling 효과

> 상태: 🔨 구현 중 (260613)

## 설계

PABCD 모드 활성 시 채팅 입력 테두리에 phase별 색상 띠 + breathing pulse 애니메이션.

### Phase 색상

| Phase | 색상 | HSL hue | cli-jaw oklch | 색감 |
|---|---|---|---|---|
| I | cyan-blue | 200° | `oklch(70% 0.15 200)` | 정보 수집 |
| P | blue-purple | 240° | `oklch(63% 0.17 260)` | 계획 수립 |
| A | amber/gold | 45° | `oklch(78% 0.16 75)` | 감사/검증 |
| B | teal-green | 150° | `oklch(72% 0.17 150)` | 구현 |
| C | purple-magenta | 290° | `oklch(60% 0.2 300)` | 최종 검증 |
| D | white | — | — | 완료 |

### Breathing Pulse

- saturation 80% 고정, lightness를 35%↔65% 사이에서 sinusoidal 순환
- 주기: ~2초 (부드러운 호흡 효과)
- 프레임: 10fps (100ms interval) — 터미널 부하 최소
- 메모리: < 0.01MB (ANSI 문자열 1줄 재생성)

### 구현 위치

- `interactive-mode.ts` `updateEditorChrome()` — PABCD 상태 감지 + borderColor 설정
- 새 유틸: `pabcd-border.ts` — phase→color 매핑 + breathing timer

### 동작

```
PABCD IDLE → 일반 테두리 (session accent / thinking level)
PABCD P active → 노란 breathing pulse 테두리
PABCD B active → 초록 breathing pulse 테두리
PABCD complete → 일반 테두리로 복원
```

timer는 PABCD 진입 시 시작, IDLE 복귀 시 정리.
