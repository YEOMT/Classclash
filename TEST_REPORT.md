# 2026-10-27 LOL 맵·포지션 리워크 검증

구현 커밋: 05dd1223950539e4c0dc1efe057bcbd022cdb10d. 브랜치: codex/positions-jungle-rework. 아래 이전 보고서는 당시 버전의 이력이며 이번 리워크의 검증 결과와 구분합니다.

## 실제 실행한 검사

| 범위 | 상태 | 결과·증거 |
|---|---|---|
| TypeScript / 운영 빌드 / 자산 체크섬 | PASS | jungle-typecheck.log, jungle-build.log. 원본 맵·18 PNG 해시, 모든 연결 프레임 범위 확인 |
| 자동 회귀 | PASS | 185 PASS / 0 FAIL / 0 SKIP, 52.98초. artifacts/jungle-unit-final.log. 실제 HTTP/WS 재시작·중복 요청·권한·저장 복구 포함 |
| 정글 / 포지션 | PASS | 실제 기본 레벨 캠프 사냥, 아군 우선, 지원/침투, 회복, 라인 인원 집계, 양 본진→전체 캠프 경로, 넥서스 뒤 큰 영웅 경로, 준비 중 학생, 생존 중 위치 변경 거부 |
| 표준 AI 30명 완주 | PASS | 고정 스텝 동일 엔진 2경기 모두 실제 넥서스 파괴·7개 시상. 자원 우회·HP 차감·시간 판정 없음. artifacts/jungle-verified-results.json |
| 10~13분 목표 분포 | FAIL | 시드1001: 743.20초 (12:23.2), 시드1002: 358.20초 (5:58.2). 1/2만 목표 범위. test:soak 종료 코드 1. 표본 2개이며 충분한 분포 검증 아님 |
| 실제 사람 1 + AI 29 브라우저 | PASS | 396.45 게임초, A 승리. 인간 30답 제출, 수동 출진 2회(정글→미드), 새로고침 복구, 넥서스 파괴, 7개 시상. JS 오류 0. 개발 시험 스케줄러 ×4 표시. artifacts/jungle-rework/browser-result.json / jungle-browser.log |
| 시각 검토 | PASS (대표 화면) | 호스트 전체 맵·실제 전투, 학생 UI/카메라, 18종 원본 공격 동작, 시상 화면을 캡처 후 육안 확인. 화면이 비어 있지 않고 원본 맵·유닛·HP·이펙트가 표시됨 |
| 재경기 서버 규칙 / 퀴즈 중 사망 | PASS (자동 회귀) | 기존 서버 회귀에서 초기화·보상·사망 후 정비 규칙을 검증. 아래 브라우저 장기 반복과 구분 |
| 3회 연속 전체 재경기 / 모든 스킬 시각 조합 | 미실행 | 새 맵에서 긴 브라우저 반복·전수 시각 검토는 사용자 지시에 따라 후속 폴리싱 |
| 40시드 분포 / 30 독립 브라우저 / 학교 기기 | 미실행 | 이번 리워크에서는 2개 AI 시드와 호스트+학생 Chromium 2화면 사용 |
| 공개 배포 | 미실행 | 로컬 3001번 서버 제공. GitHub Pages가 실시간 서버를 제공한다고 주장하지 않음 |

## 시각 점검 재현

1. npm ci → npm run build → npm start. 새 방 → 학생 참가 → 30명 채우기 → 시작 20문제 → 영웅 선택 → 탑/미드/바텀/정글 선택 → 준비 → 호스트 시작.
2. 정글러의 아군 캠프 이동·공격·체력 감소·처치, 캠프 재생성 시계, 부족한 라인 지원/침투·저체력 회복 표시를 관찰합니다. 살아 있는 동안 포지션 변경 버튼은 없습니다.
3. 학생 퀴즈 10문제 후 사망 시 정비에서 새 포지션을 고르고 직접 출진합니다. 적 넥서스 파괴 뒤 시상과 재경기 버튼을 확인합니다.
4. npm run test:jungle은 실제 Chromium으로 위 핵심 흐름을 수행하고 캡처와 JSON을 남기며 실패 시 비정상 종료합니다. champion-review.html은 원본 PNG 프레임을 직접 재생합니다.

캡처: artifacts/jungle-rework/01-positions.png, 02-host-full-map.png, 03-jungler-camera.png, 04-awards.png, 05-native-champions.png. 이번 버전 전투 동영상은 녹화하지 않았으며 위 재현 절차와 실행 가능한 브라우저 검사를 제공합니다.

## 남은 폴리싱·제한

- 경기 길이 편차가 큽니다. 목표 10~13분은 유지하며 강제 시간 승리는 없습니다.
- 30 AI 두 경기의 5초 정체 진단은 각각 28 / 9건, 불법 위치 0건입니다. 혼잡·대기와 실제 경로 정체의 세부 분류 및 추가 완화는 남아 있습니다. 엔진 tickRoom p95는 14.49 / 10.21ms이며 SQLite 저장·방송 비용을 포함한 전체 서버 성능 보증이 아닙니다.
- 첨부 챔피언 외형·원본 클립을 기존 18종 역할과 36개 스킬에 연결했습니다. 첨부 패키지의 LoL 고유 능력 전체 이식은 아닙니다. 일부 원본 단일 시전/피격 동작을 공유하며 각 게임 스킬 판정·효과는 구분됩니다.
- 원본 출처·작성자·해시는 assets/source/jungle-rework/provenance.json에 기록했습니다. 첨부 맵의 별도 라이선스 확인은 하지 못했으며 원본을 자체 제작/CC0로 표기하지 않습니다.
- 리워크 전 전체 미커밋 작업과 원본 ZIP은 보존했습니다. 새 기본 DB data/class-clash-jungle.sqlite로 이전 data/class-clash.sqlite와 분리했습니다.
- 이번 리워크는 로컬 브랜치에 저장했습니다. 공개 배포 및 새 브랜치의 원격 push는 하지 않았습니다.

---

# 이전 버전 검증 기록 (아래 내용은 현재 리워크의 PASS 근거가 아님)

# Class Clash 실행 검증 보고서

2026-10-26. 첫 플레이 가능 버전. 사용자의 마지막 요청에 따라 장시간 분포·반복 검증은 후속 폴리싱으로 이관한다. 구현과 검증을 구분하며 미실행을 통과로 표시하지 않는다.

## 구현 범위

Node 권위 서버·SQLite WAL, 최대30명 호스트·학생·AI 로비, 시작20문제/전투10문제/30초쿨타임, 서버 채점·재화·뽑기, 독립 영웅 성장, 사망 후 수동 재출정, 실제 2라인 전투·넥서스 승리, 7개 시상과 재경기를 연결했다. 18영웅·36스킬·5,184개 방향별 도트 프레임을 포함한다. 임의 시간 종료나 HP 비교 승리는 없다.

## 환경과 재현

- Windows11 Home 10.0.26200, Intel Core i5-1340P, RAM 약16GB.
- Node24.19.0, npm12.2.1, Chromium156.0.8078.4, Playwright1.64.1.
- 로컬 브랜치 codex/first-playable. 검증 대상 구현 커밋94f16bb. 문서·증거의 최종 커밋은 git log -1로 확인한다.
- 로컬 실행: `npm ci`, `npm run build`, `npm start`. Windows는 `start-local.cmd`. 호스트·학생·LAN 사용법은 README.md.
- 브라우저 기능 검사는 실제 HTTP/WS·Chromium이다. 시험 배속은 화면에 표시한다. 성능 검사는 정상1배속이다.
- GPU 측정은 실제 Intel Iris Xe/Direct3D11 어댑터를 확인했다. SwiftShader 결과는 별도로 보존한다.

## 실제 실행 결과

| ID / 범위 | 상태 | 관측과 증거 |
|---|---|---|
| BUILD / 운영 빌드 | PASS | 후보11 서버·클라이언트·18PNG 재생성, Vite/esbuild 정상 종료 |
| TYPE / 타입 | PASS | 후보11 변경 후 검사. artifacts/candidate11-typecheck-results.txt |
| UNIT / 규칙·저장·영웅 | PASS | 최종94f16bb에서157/157, 실패·취소·건너뜀0,9.915초, 종료코드0. artifacts/unit-results-final.txt. 새 설치 별도153/153 |
| COMBAT / 최종 밸런스 | PASS | 후보11 전투21/21. artifacts/candidate11-combat-results.txt |
| QUIZ-UI / 문항 전환 | PASS | ACK/문항 스냅샷 순서 경합 수정, 경계 회귀4/4. 실제 전투 퀴즈10문제·사망·새로고침·수동 재출정도 전체 완주 경기에서 확인 |
| HERO / 18명·36스킬 | PASS | 실제 PNG 프레임·실루엣, 실제 AI 발동·히트 틱·조건별 판정 회귀. 모든 시각 조합의 수동 승인은 아님 |
| BOT / 학습 분포 | PASS | 실제 관리자 프로필별10,200답. 정답률0.54461/0.74029/0.89265, 평균 응답4.52052/3.02190/1.92292초 |
| DRAW / 뽑기 분포 | PASS | 10개 풀1,000,000표본, 전설30,000표본. 일반 전설0%, 고급10%, 정확히3전설 |
| RESTORE / 실제 서버 재시작 | PASS | 지급 ACK 후 강제 종료·SQLite 복구·동일 답안 재전송·보상1회. 모든 열린 브라우저 상태 조합 검증과 구분 |
| LOAD / 학생30+호스트 | PASS | 독립 인증WS31개,600답,30동시뽑기,30재전송,재접속,실제 전투20.011초. wire 평균86.54~87.75KiB/s. artifacts/load-results.json |
| LOBBY / 브라우저 | PASS | 없는 방·이름 오류 복구, AI팀 이동 양 화면, 빈 팀 시작 차단, 호스트 새로고침. 2/2,12.6초. 화면20~24 |
| UI / 사람1+AI29 초반 | PASS | 로비→20문제→영웅→준비→교전→새로고침·퀴즈. 390px CSS 가로 넘침 없음. 실기기 시험 아님 |
| HUMAN29 / 최종 전체 경기 | PASS | 사람1+AI29, 실제 넥서스 파괴688.65초(11분28.65초), 청팀 승리.30답·7번 문제 중 사망·새로고침·수동 출정2회·7개 시상·학생 결과 재접속 동등성, JS오류0. 실제 Chromium 검사1/1, 벽시계3.5분(표시된4배속). artifacts/browser-human29.json 및 e2e-human-final-log.txt |
| REMATCH / 3회 연속 완주 | NOT_RUN | 전용 시험 구현. 이전 장기 시도는 부하/trace 시간 초과 FAIL로 보존. 최종4경기 완주는 사용자 요청으로 후속 폴리싱에 이관 |
| P03 / 호스트5분 프레임 | PASS | 실제 Iris Xe,1366×768,DPR1,정상속도30AI. RAF18,001표본 p95/p99=16.8ms. artifacts/browser-performance-d3d11.json |
| P09 / 전투 사건 표시 | PASS | 같은5분에서19,629수신=소비=표시,중복·자산·브라우저 오류0. 모든 장애 주입 조합 검증은 별도 |
| P02 / 서버 스텝 비용 | FAIL | p95=57.1ms,p99=132.07ms,목표15/30ms 초과. 전투·방송·SQLite FULL 체크포인트 포함. 평균20Hz 유지 |
| P15 / 새 설치 | PASS | 정확한5df4f7e 새 git archive에서 install/dev/typecheck/build/start/PNG/방/2AI 퀴즈 확인. 처음 빌드 전152PASS/1FAIL, pretest 자동 빌드 수정 후153/153. artifacts/fresh-checkout-results.json에 수정 범위 명시 |
| DEPLOY / 공개 배포 | NOT_RUN | 외부 Node 호스팅 자격 증명 없음. GitHub Pages를 실시간 서버로 표시하지 않음 |
| DEVICE / 학교 기기 | NOT_RUN | 실제 학교 PC·태블릿·무선망 접근 없음 |
| GITHUB / 원격 반영 | FAIL | CLI 인증 없음, 연결 API403 Resource not accessible by integration. 로컬 소스 보존 |

UNIT 재현은 운영 빌드 후 `node --import tsx --test tests/*.test.ts`. HUMAN29는 `npm run test:e2e -- tests/e2e/full-game.spec.ts --grep "one human"`. Windows GPU 설정은 `CLASH_TEST_GPU=d3d11`이다.

P03/P09는 종착 구조물 HP 조정 전 후보10에서 측정했다. Pixi 렌더러는 동일하지만 이후 퀴즈 UI와 전송 대기 처리도 수정되었으므로 최종 소스의 새5분 실행으로 표현하지 않는다. 실패한 SwiftShader 자료도 artifacts/browser-performance-software.json에 보존한다.

## 표준 AI 경기 길이

최종 후보11: 외부9,000/내부12,000/수호9,000/넥서스12,000HP, 사망 최소 대기20초. 미니언의 실제 구조물 공격 배율은480/600/720초에2/8/16이다. 양 팀에 동일 적용하며 봇에 추가 재화를 주지 않는다. 조정 근거는 CHANGELOG.md.

| 시드 | 실제 결과 | 길이 | 10~13분 목표 |
|---|---|---:|---|
| 1001 | 넥서스 파괴 종료 |818.95초|FAIL|
| 1002 | 넥서스 파괴 종료 |612.85초|PASS|
| 1003 |900초 관측 상한에도 전투 중|미완료|FAIL|

3개 중 정상 종료2개, 목표1개. 이동 정체·불법 위치·봇 정체·음수 자원·동시 영웅 중복은 이 세 관측에서0이다. **40시드 분포는 NOT_RUN/미완료**다. 나머지37개와 추가 밸런싱을 최신 사용자 요청으로 폴리싱에 이관했다. 자료는 artifacts/soak-candidate11-final40/, 재개는 docs/SOAK_RUNBOOK.md.

후보9는10경기 모두 종료했으나 목표6/10으로 실패. 후보10은3관측 중1완료·2미완료로 탐색 중단. 다른 설정의 결과를 합치지 않고 실패 자료도 보존한다. 900초는 관측 상한이며 게임의 강제 승리 시각이 아니다.

## 시각 자료·제작 상태

- 실제 주요 화면: artifacts/screenshots/. 로비·퀴즈·정비·전체 맵·학생 추적·AI 관찰·모바일 CSS 화면.
- 재현 가능한 점검: artifacts/VISUAL_REVIEW.md. 제작·출처: docs/ART_REFERENCE.md.
- 원본 제작 소스 scripts/build-sprites.mjs, PNG/애니메이션 public/assets/heroes/,18명 갤러리 public/art-gallery.html.
- Teamfight Manager 공식 자료의 역할·액션 명료함을 참고했고 원작 자산은 복제하지 않았다. 갤러리는 전투 영상이 아니다.

## 후속 폴리싱

경기 길이 분포 안정화, 서버 스텝 비용, 3회 연속 완주와 메모리 추적, 모든 스킬 시각 조합·네트워크 장애 주입을 이어서 검증한다. 세부 조건은 docs/ACCEPTANCE_MATRIX.md와 docs/COMBAT_ACCEPTANCE.md의 PASS/FAIL/NOT_RUN을 따른다. 모든 명세 인수를 통과했다고 주장하지 않는다.
