# Class Clash 0.2 검증 보고서

기록일: 2026. 10. 29. 오전 1:19:57 KST. 검증 런타임 커밋: **9f8601ec31ee1b84a670f52467855a2ca08da8a8**. 원본 자산 manifest SHA-256: **bba2f9090927e34c8c670e0d8ccc681603f07d22accffbd160de4670485f9d09**.

최종 사용자 확정은 **이 채팅의 LOL 3라인 + 정글**과 18챔피언의 외형·native 애니메이션이다. 첨부 문서의 2라인 조항을 대체한 근거는 docs/class-clash-0.2/00_USER_OVERRIDES.md에 있다. 실행 가능한 통합본이며, **0.2 품질 인수를 모두 통과한 상태는 아니다.** 실패·미실행·공개 배포를 기능 구현과 구별한다.

## 실행 결과

|항목|상태|실제 결과/근거|
|---|---|---|
|기존 LOL 기준 재현|PASS|별도 보존본 185/185. artifacts/v02/baseline/isolated-tests-final.log|
|최종 타입·build·npm test|PASS|231/231, 실패 0. npm test의 pretest도 실제 실행. artifacts/v02/npm-test.log, typecheck.log|
|공개 소스 전용 테스트|PASS|201/201 및 tsc 통과. artifacts/v02/public-source-tests.log. 전체 아트·브라우저 시험과 별도 검증|
|원본 보존|PASS|원본·소스 파일 365개의 빌드 전후 바이트가 동일함. Git 개행 변환 문제는 .gitattributes/raw blob으로 수정. artifacts/v02/build-source-preservation.json|
|새 설치 복제본|PASS|npm ci로 69개 패키지를 새로 설치함(기존 node_modules 복사 없음). 최종 SHA의 build/health와 자산 50개의 해시가 일치함. 이전 a1454cb에서 실제 2AI의 개막·HIT·Vite 브라우저도 확인함. fresh-install.json에서 검증 시점을 구별함|
|18챔피언·36스킬|부분 PASS|서버 스킬 회귀·native 재생·이미지 누락 복구 PASS. 8개 독립 원화·정밀 손 소켓·전체 시각 조합은 아래 제한 참조|
|모바일·태블릿 UI|PASS|390×844/1024×768에서 실제 퀴즈 4보기·제출 ACK, 가로 잘림, zoom/mute/volume, host 관찰 패널 9/9. artifacts/v02/ui/responsive-report.json|
|사람 1 + AI 29·3연속 재경기|NOT_RUN|최종 연속 4경기 검증 대기. 이전에 다른 부하와 함께 실행한 시험은 첫 경기만 완료했고, 두 번째 경기의 707 게임초 시점에 실제 시간 기준 대기 한도를 초과하여 FAIL로 기록했다.|
|독립 학생 30 + host 1|기능 PASS / 성능 FAIL|개막 답안 600개, 30건 동시 구매, 30건 중복 재전송, 재접속, 1배속 30초 실전. ACK p95 200.21ms; wire 최대 92.72KiB/s. full tick p95/p99 46.68/73.00ms. artifacts/v02/load-30clients-isolated.json|
|실제 1배속 13분|FAIL|호스트 프레임 p95/p99 16.80/33.30ms, 학생 16.70/16.80ms, 답안 응답 p95 383.28ms. 서버 전체 틱(DB·방송 포함)의 샘플별 p95/p99 최댓값 58.19/186.42ms(72개 샘플). 전투 중 실제 경과 시간 781.0초.|
|표준 30AI·40시드|FAIL|38/40 완주, 9/40이 600~780초, 2개는 900초 관찰 시 미종료. artifacts/v02-final2-results.json|
|GitHub 반영|브랜치 PUSH 확인|f4ceb668350389a290be2e09c5ee54bd8e14bc9e / codex/class-clash-0.2-source. 원본 이미지·영상·private 이력 제외. main은 d060b53 그대로, PR 미생성(연결 403)|
|공개 배포|BLOCKED_DEPLOYMENT|publicPlayUrl=null. 권한 있는 지속 실행 Node 호스트와 실제 HTTPS origin 부재. 로컬 교육용 비배포 자산. DEPLOYMENT_REPORT.json|
|학교 실기기 / 외부 학생망|NOT_RUN|개발 노트북의 실제 D3D11 브라우저와 loopback에서 검증. 실제 학교 30기기·무선망·외부 HTTPS/WSS는 미실행|

## 40시드 분포와 후보

최종 운영 설정은 OUTER/GUARD 7,500, INNER/NEXUS 10,000 HP다. seed 1001~1040의 **모든 결과**를 포함했다. 완주한 38경기의 중앙값은 519.025초, 범위는 387.6~754.35초다. 미완주 2경기를 900초 이상 관찰한 결과로 포함하면 전체 40경기의 중앙 순위는 527.375초다. 목표 범위는 9/40(22.5%)로 28/40 기준에 실패했다. 미완주 시드는 1031/1035, 승리는 A 30/B 8이다. 불법 위치 0·음수 재화 0·중복 활성 영웅 0, 정체 진단 12건이다.

900초는 시험 관찰 상한이다. 게임에 시간제 승리나 넥서스 체력 비교를 추가하지 않았다. 고정 스텝 40시드는 같은 실제 전투·퀴즈·경제 코드를 사용하며, 가속 시뮬레이션의 실제 경과 시간이나 틱 시간을 운영 성능으로 사용하지 않는다.

구조물 HP 13,500/18,000을 적용한 후보, 여기에 후반 미니언 HP 1/2/3/4를 조합한 후보, 일반 타워 HP만 높이고 수호 4,500·넥서스 6,000으로 분리한 후보를 기록했다. 마지막 후보는 4/4 완주했으나 목표 범위는 2/4뿐이며, 미완주 시드의 개선과 새로운 40시드 분포가 입증되지 않아 채택하지 않았다. ENGINE_CHANGELOG.md와 BALANCE_CHANGELOG.md를 참조한다. 5명·10명 경기는 900초에 미종료, 20명 경기는 551.35초에 종료했다. 30명 동일 로스터의 진영 교환 1쌍은 366.6/452.15초에 종료했고 모두 A승이었다. 이 한 쌍을 공정성 보증으로 해석하지 않는다.

## 실제로 발견하고 수정한 회귀

- 퀴즈 중 사망 후 새로고침하거나 이어 풀 때 선택 보기를 복구하고, 쿨타임 종료 후 버튼을 갱신했다.
- 길 경계의 샘플 누락과 0.000001px 끝점 허용 오차로 발생한 영구 정체·불법 위치를 수정했다. 고정 회귀와 40시드 재실행 결과를 구별했다.
- Vite dev의 public JSON 직접 import 차단과, 자산 누락 시 숨겨야 할 canvas가 CSS로 다시 보이던 오류를 수정했다.
- Windows 자동 개행으로 fresh clone의 원본 잠금 해시가 달라지던 문제를 수정했다. 원본과 source-lock 모두 raw로 보존한다.
- 모바일 음량 숨김과 toolbar 잘림을 수정했다. document 폭만 보는 시험의 오판도 정정하고 모든 interactive bounds를 검사했다.
- 잘못된 WebSocket 프레임이 전체 프로세스에 영향을 주는 오류와, SQLite의 늦은 쓰기 실패 시 거짓 ACK·중복 거래 위험을 수정했다.
- 30학생 방송에서 같은 전장을 반복 직렬화하던 비용과 과도한 표시 소수점을 줄였다. 서버 권위 계산·스킬 시점·이벤트 빈도는 그대로이며, 양수 HP가 0으로 보이지 않게 했다. 학생별 gold/quiz/epoch 분리의 실제 회귀도 통과했다.

## 시각 증거와 남은 아트 제한

원본/패킹 비교: artifacts/v02/art/02-source-pipeline-comparison.png. 18챔피언: 01-all-native-champions.png. 실제 1배속 호스트 영상: artifacts/v02/art/host-actual-combat-1x.webm. 최신 학생 생존 추적 15.16초: artifacts/v02/ui/student-alive-follow-1x.webm. 후자는 현재 선택 영웅의 실제 위치 이동과 카메라 추적을 프레임별로 검토했다. 이전 학생 영상은 사망 정비 중에도 전투가 지속되는 장면이므로, 생존 추적 증거와 혼동하지 않는다.

각 영상의 빌드 SHA·시각·해시는 capture-report.json과 ui/VISUAL_REVIEW.md에 있다. 먼저 촬영한 39.72초 호스트 영상은 최종 엔진 이전 후보이며, 아트/VFX 관찰에만 사용했다. 모든 자료를 최종 엔진의 전체 경기 증거로 합치지 않았다.

보존한 native 원본은 좌우 2시점이다. 8개 독립 시점 원화는 미구현이다(ART-05 FAIL). 손·활 소켓은 normalized anchor이며, 정밀한 프레임별 수작업 검수·보정은 완료되지 않았다(ART-10/ANIM-03 FAIL). 프레임 수나 색상 차이만으로 아트 품질을 통과시키지 않았다. 18영웅 전체의 레벨 1/2/5·모든 36스킬·8방향 시각 조합은 NOT_RUN이다.

## 인수·공개범위

214개 원문은 docs/class-clash-0.2/tests/ACCEPTANCE.csv에 보존하고, 실제 판정은 ACCEPTANCE.results.csv/json에 별도로 쓴다. 현재 집계: {"PASS":86,"NOT_RUN":108,"NOT_APPLICABLE":3,"FAIL":6,"BLOCKED":11}. 불완전하거나 증거가 없는 항목은 NOT_RUN이며, 앞선 실패 로그도 보존한다.

공개 소스는 이미지·원본 아카이브·영상·DB·비밀 파일을 제외한 별도 main 기반 브랜치다. 공개 소스만 복제하면 승인된 로컬 아트 묶음을 복원해야 하며, test:source는 전체 아트·브라우저 시험의 대체물이 아니다. 저장소 주소는 공개 플레이 주소가 아니다. PR 생성 커넥터의 403과 브라우저 도구 초기화 실패를 기록했다. 인증 정보를 추출하는 우회는 자동 승인 검토에서 거절되어 실행하지 않았다. 일부 로그만으로 완료 PASS 범위를 넓히는 보고서 변경 역시 실행하지 않았다.

## 재현 명령

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm start
npm run test:v02
npm run test:load
npm run test:soak:parallel
npm run test:realtime
node scripts/verify-v02-responsive.mjs
node scripts/report-v02.mjs --check
```

성능 시험은 다른 시뮬레이션·브라우저 부하를 종료한 뒤 실행한다. 실패한 시험은 종료 코드 1을 반환한다. 인수 --check도 FAIL/NOT_RUN/BLOCKED가 있으면 비정상 종료한다. 이미 실행한 231개 통과와 40시드 시뮬레이션의 실패 판정, 시각 미실행을 하나의 '전체 PASS'로 합치지 않는다.

<!-- V02_REPORT_END -->

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
