# 브라우저 렌더링 시험 경과

이 문서는 실패를 보존한다. 최종 성능 측정 통과를 뜻하지 않는다.

| 실행 | 결과 | 측정 경계 |
|---|---|---|
| 초기 5분 개발 화면 관측 | FAIL | 전투 시작 전 조건 검사 오류를 발견하여 유효한 P03 결과로 채택하지 않음 |
| 조건 수정 후 정상 속도 30 AI 관측 | FAIL | 관측 시작 tick 1812, RESULT tick 6100. 전투가 5분 전에 끝나 마지막 renderer가 제거됨. `browser-performance-preliminary.json` 보존. 프레임 p95 33.4ms이며 20ms 목표 초과 |
| 빈 WebGL 캔버스 15초 기준 시험 | 측정 완료 | headless-shell p95 16.8ms. ANGLE SwiftShader 소프트웨어 렌더러. 고정 30Hz 제한으로 단정할 수 없음. Unified headless 비교 실행은 spawn UNKNOWN으로 NOT_RUN |
| 전용 perf config 첫 자동 서버 실행 | FAIL | config 기준 cwd 오류 수정 |
| 단독 개발 서버 자동 시작 | FAIL | 30초 시작 시간 초과. 생산 번들과 OS 임시 디렉터리 SQLite로 전환 |
| 단독 생산 번들·정상 속도·임시 SQLite | FAIL | 시작 퀴즈/준비 뒤 COUNTDOWN에서 20초 내 BATTLE 수신 실패. 측정 구간에 도달하지 못함. 저장된 서버는 BATTLE tick1760, 브라우저는 COUNTDOWN에 남아 있었음 |
| 정적 자산 메모리 캐시 적용 후 짧은 점검 | FAIL | CSS의 5개 PNG 외 Pixi 아틀라스 요청이 시작되지 않음. renderer frames0, pageerrors0 |
| PNG 전용 로딩(작업자·비트맵·형식 자동 감지 생략) 적용 후 | FAIL | 18개 실제 PNG HTTP200 및 renderer83frames 확인. 그러나 BATTLE WebSocket 프레임 수신이 계속 지연되어 COUNTDOWN에 남음. 전송 원인 추가 조사 중 |

`visual-spot-check-failure.json`과 `screenshots/spot-check-failure.png`는 최신 짧은 진단 실패 상태이다. 이 파일들이 5분 전투 또는 전체 경기 성공 증거로 사용되어서는 안 된다. 정상 GPU 학교 실기기는 미실행이다.

## 추가 원인 분리와 단축 복구 확인

- WebSocket 압축을 끈 첫 진단도 20초 단계 제한을 초과했다. 그 뒤 첫 BATTLE 프레임을 받았지만 native 연결 종료 코드1006을 관측했다. 압축만을 단독 원인으로 결론 내리지 않는다.
- 렌더링을 명시적으로 끈 `--no-render` 진단은 5초 카운트다운과 실제 첫 적중까지 정상 수신했다. 화면에 진단 경고가 표시되며 이 실행은 시각/게임 완성 검증이 아니다.
- 2026-10-26 18:38 KST, 모든 렌더링을 켠 생산 번들 단축 점검은 **PASS**했다. 5.2초 카운트다운, 실제 적중, AI 관찰 패널, 전체 맵 크기 갱신, 중단, 18명 갤러리를 확인했다. `visual-spot-check.json`이 해당 성공 기록이다. 앞선 실패 자료는 그대로 보존한다.
- 일반 화면에서 서버 틱·체크포인트 지연이 렌더링을 끈 경우보다 커졌다. JavaScript 렌더 제출 시간만으로 GPU/합성 비용을 추정하지 않는다. 단독 생산 번들 5분 측정은 기존 20ms 목표를 그대로 적용한다.

## 유효한 5분 관측 결과 (2026-10-26 18:46 KST)

`node node_modules/@playwright/test/cli.js test --config tests/e2e/performance.config.ts`: **FAIL, 종료 코드1**. 30 표준 AI가 시작 퀴즈를 실제로 완료한 뒤 기본 화질·DPR1·정상 속도에서 5분 내내 BATTLE을 유지했다. 다른 게임/시뮬레이션은 중단한 단독 조건이다. 실제 교전 이후 tick1769→7360(+5591), RAF 표본5113, Pixi 프레임5488을 관측했다.

| 지표 | 실측 |
|---|---:|
| RAF 간격 p50 / p95 / p99 | 50 / 116.8 / 133.4 ms |
| 목표 p95 | ≤20 ms — **실패** |
| 장면 갱신 JavaScript p95 | 1.8 ms |
| WebGL 제출 JavaScript p95 | 4.7 ms |
| 수신한 고유 이벤트 / 짧은 시각 재생 창에 포함한 이벤트 | 20,413 / 20,362 |
| 브라우저 pageerror / 필수 자산 오류 | 0 / 0 |

`browser-performance.json`에 장비·브라우저·명령·전체 수치를 기록했다. `screenshots/12-host-30-ai-five-minutes.png`를 직접 열어 전체 맵과 전투가 남아 있음을 확인했다. 51개 이벤트 차이는 12틱의 시각 재생 창과 수신 시점 차이이며, 모든 시각 이벤트 완전 전달을 독립 검증한 PASS로 해석하지 않는다. duplicates0은 코드의 고유 ID 재생 방어 이후 카운터이며 픽셀 기반 중복 검출 결과가 아니다.

로컬 Playwright 기본 Chromium 실행기는 `--enable-unsafe-swiftshader`를 추가한다. 별도 GPU 인자를 지정하지 않은 기준 시험의 실제 렌더러는 ANGLE/Vulkan SwiftShader였다. 소프트웨어 GPU 비용은 위 JavaScript 수치에 포함되지 않는다. 물리 GPU나 학교 기기의 성능으로 일반화하지 않는다.

## 물리 GPU 비교 준비

`gpu-environment-probe.json`에서 명시적 ANGLE/D3D11은 Intel Iris Xe 실제 GPU로 확인했다. 기본 Chromium은 SwiftShader였고 두 10초 빈 캔버스 기준 시험 모두 p95 16.7ms였다. 이는 게임 프레임 목표 통과 증거가 아니다.

첫 물리 GPU 전투 측정 시도는 최신 이동 회귀 수정·밸런스 변경이 서버 시작 직후 도착하여 중단했다. 완료된 5분 결과가 없으므로 **NOT_COMPLETED**이며 통과로 집계하지 않는다. 기존 소프트웨어 렌더러 5분 실패는 `browser-performance-software.json`과 `12-host-30-ai-five-minutes-software.png`에 별도로 보존했다.

최신 빌드의 두 번째 물리 GPU 시도는 전투 시작 버튼을 누르기 전에 **FAIL**했다. 첫 출정 준비 화면이 매 스냅샷마다 같은 버튼 DOM을 새로 만들면서 hover 위치 애니메이션과 포커스가 반복 초기화되어, 실제 클릭의 안정성 검사를 20초 동안 통과하지 못했다. 테스트에서 강제 클릭하지 않고, 동일한 준비 액션 내용이면 DOM을 보존하도록 UI를 수정했다. 이 실패 역시 게임/GPU 성능 통과로 집계하지 않는다.

## 최신 빌드 물리 GPU 5분 관측 (2026-10-26 19:10 KST)

`node scripts/run-physical-perf.mjs`: **P03 PASS, 종료 코드0, 전체 시험 6.6분**. 실제 Intel Iris Xe / ANGLE Direct3D11, 1366×768, DPR1, 기본 화질, 정상 속도, 표준 AI30, 생산 서버 1개로 측정했다. `browser-performance-d3d11.json`과 `browser-performance.json`은 이 실행이며, 앞선 소프트웨어 결과는 `browser-performance-software.json`에 별도 보존했다.

| 지표 | 실측 / 판정 |
|---|---|
| 5분 RAF 표본 | 18,001 |
| RAF p50 / p95 / p99 / 최대 | 16.7 / 16.8 / 16.8 / 33.4 ms |
| P03 p95≤20ms | **PASS** |
| 서버 tick 진행 | 1814→7820, +6006; 5분 내내 BATTLE |
| Pixi 프레임 | 19,022 (준비 구간 포함) |
| 이벤트 수신 / 시각 처리 / drawEvent 호출 | 19,629 / 19,629 / 19,629 |
| 재접속 과거 이벤트 생략 / 중복 재생 / 자산 오류 / pageerror | 0 / 0 / 0 / 0 |
| 장면 갱신 / WebGL 제출 JS p95 | 1.9 / 2.8 ms |
| 별도 P02 서버 틱 p95 / p99 | 57.1 / 132.07 ms — 목표15/30ms **FAIL** |

버전 지문은 JSON에 저장했다. balanceHash는 `d1ff44f2fa560d35ec775aff67396a2ff10318776d554bafe22c36a86e185f02`이다. 12번 캡처를 직접 열어 전투5:13의 전체 맵, 움직인 전선, 파괴된 일반 타워, 투사체와 실제 스킬 효과를 확인했다.

실시간 연결에서는 늦게 도착한 이벤트도 모두 시각 처리한다. 이벤트의 표시 시간은 첫 실제 렌더부터 시작해 로딩/프레임 지연 때문에 표시 전 만료되지 않는다. 인증 후 첫 복구 스냅샷의 과거 효과만 별도 카운터로 구분한다. 이 실행의 수신·처리 동일성은 검증했지만, 36개 스킬 각각의 모든 프레임에 대한 독립 픽셀 검출이나 학교 실기기 검증은 아니다.
