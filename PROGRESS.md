# Class Clash 0.2 진행 기록 · 2026-10-29

현재 브랜치: codex/class-clash-0.2. 검증 런타임 커밋: 9f8601ec31ee1b84a670f52467855a2ca08da8a8. 문서와 검증 증거는 후속 커밋으로 보존한다. 사용자 확정 기준은 이 채팅의 LOL 3라인+정글, 18종 챔피언 native 외형·애니메이션이다. 기존 작업과 취소한 시도는 별도 ZIP에 보존했다.

완료: 원본 365개 해시를 보존하는 검증·패킹 빌드, 18영웅·36스킬 통합, 전투 이동·표적·슬롯·정글 정체 수정, 퀴즈 선택/쿨타임 복구, 모바일 UI, Node 권위 판정·SQLite 원자적 저장·복구·버전 확인, 운영 인증/origin/배포 구성. 자동 테스트 231/231, 새 설치·빌드, 공개 소스 검사 201/201 통과.

실제 측정: 30개 독립 학생 WS의 기능·ACK·전송량 통과, 서버 틱 성능 실패. 정상 1배속 전투 781.024초에서 호스트/학생 프레임·답안 응답·오류 검사 통과, 서버 틱 성능 실패. 표준 AI 40시드 중 38완주·목표 시간 9개로 분포 실패. 원본은 2시점이며 8개 독립 원화와 정밀 프레임별 소켓은 미완성이다. 상세 수치·실패·미실행은 TEST_REPORT.md와 인수 CSV에 보존한다.

진행 중: 최종 첫 경기+3연속 재경기 브라우저 검증, 전체 개인 보존 ZIP/번들, 최종 공개 소스 브랜치 갱신. 공개 소스만 분리한 codex/class-clash-0.2-source의 실제 SHA는 artifacts/v02/publishing.json에 기록한다. 원격 main d060b535c49b63d219f851c431e0294e9dbcb157은 변경하지 않았다. PR 생성 연결은403으로 미생성.

공개 배포: BLOCKED_DEPLOYMENT. 권한 있는 지속 Node 호스트와 실제 HTTPS origin이 없고 선택 자산은 학교 내 비배포 용도다. 공개 플레이 URL은 null. 실제 학교 기기·외부 학생 네트워크 검증은 NOT_RUN.

다음 실행 명령: npm run test:v02; node scripts/report-v02.mjs --check. 성능 또는 밸런스를 수정한 뒤에만 npm run test:load, npm run test:realtime, npm run test:soak:parallel을 다시 실행한다. 서로 동시에 실행하지 않는다. 13분 강제 승리나 테스트 임계값 완화로 실패를 감추지 않는다.

---

# 현재 진행 상태 · 2026-10-27 LOL 리워크

현재 구현 커밋: 05dd1223950539e4c0dc1efe057bcbd022cdb10d. 브랜치 codex/positions-jungle-rework. 이후 커밋은 검증 증거와 문서 정리입니다.

완료: LOL 1280×1280 3라인 맵, 남서/북동 본진·타워, 출진 포지션 4개, 서버 권위 정글 몬스터와 아군 사냥→지원/침투→회복, AI 포지션 선택, 18종 첨부 챔피언 원본 애니메이션, 기존 퀴즈/자원/독립 성장/수동 재출진/넥서스 승리/시상·재경기 기능 연결.

검증: 타입·빌드 성공, 자동 185/185. 30 AI 두 경기 완주(743.2 / 358.2초), 사람1+AI29 실제 Chromium 396.45초 종료, 답안30·실제출진2·새로고침·시상7·JS오류0. TEST_REPORT.md와 artifacts/jungle-rework 참조.

남은 실패: 목표 10~13분 1/2 충족으로 분포 시험 FAIL(정상적으로 exit1). 혼잡 구간 정체 진단28/9건 추가 분류. 미실행: 40시드, 3회 연속 전체 재경기, 모든 스킬 시각 조합, 공개 배포·학교 기기. 사용자 지시에 따라 후속 폴리싱으로 남김.

보존: Class_Clash_Before_Jungle_Rework_20261027.zip은 리워크 전 미커밋 아트를 포함한 전체 소스. Class_Clash_Jungle_Rework_20261027.bundle과 ZIP은 이번 전체 프로젝트 보존본. 기존 원본 자료·아트·이전 보고서는 삭제하지 않음. 새 로컬 게임 DB는 data/class-clash-jungle.sqlite.

현재 최종 게임 서버: http://127.0.0.1:3001 (정상1배속). 이전3000프로세스는 건드리지 않음. 새로 시작하려면 start-local.cmd 또는 npm ci / npm run build / npm start (기본3000, 필요하면 PORT=3001).

다음 명령: npm run typecheck; npm test; npm run test:jungle. 분포 확인: SEEDS=40으로 npm run test:soak. 첫 원격 main은 d060b535c49b63d219f851c431e0294e9dbcb157이며 이번 리워크 브랜치는 아직 원격에 push하지 않음.

---

# 이전 작업 기록

# 진행 기록

2026-10-26 KST. 브랜치 codex/first-playable. 검증 대상 구현 커밋 **94f16bb**. 문서·실행 증거는 후속 커밋으로 저장하며 최종 커밋은 git log -1로 확인한다. 원격 YEOMT/Classclash는 처음 빈 저장소였고 AGENTS.md·소스·패키지·테스트가 없었다. 사용자 ZIP과 docs/specification 원문을 보존했다.

## 완료 기능

Node 권위 서버/SQLite WAL FULL, 최대30명 호스트·학생·AI 로비, 시작20/전투10문제·30초 쿨타임, 서버 채점/재화/확률, 독립 영웅 성장·강화·뽑기, 사망 후 수동 재출정, 재접속/중복 요청 방지, 실제 자동 전투·넥서스 파괴 승리,18영웅/36스킬/5,184 도트 프레임, HTML/Pixi 화면·7개 시상·재경기를 연결했다. 문항 ACK/스냅샷 경합, 단절 중 요청 보관·재전송, 과다 스냅샷으로 인한 소켓 끊김도 수정했다.

최신 사용자 요청에 따라 첫 플레이 가능 버전을 제출한다. 세심한 장기 검증·밸런스/성능 개선은 후속 폴리싱으로 이관한다. 미실행을 PASS로 쓰지 않는다.

## 실제 실행 결과

- 최종 소스94f16bb: 자동시험157 PASS / 0 FAIL / 0 SKIP,9.915초, 종료코드0. 타입·운영 빌드 PASS.
- 실제 Chromium 사람1+AI29 전체 경기 PASS:30답,7번 문제 중 사망,새로고침·이어 풀기,수동 출정2회,688.65게임초에 적 넥서스 파괴·청팀 승리,7개 시상,학생 결과 재접속 동등성,JS오류0. 표시된4배속, 벽시계3.5분. artifacts/browser-human29.json.
- 독립 학생30+호스트 WS:600답/30동시뽑기/30재전송/재접속/20초 실제 전투 PASS. 로비 오류·AI팀 이동·호스트 새로고침 브라우저2 PASS.
- 이전 동일 렌더러의 실제 Iris Xe D3D11 정상1배속5분: RAF p95/p99=16.8ms,19,629수신=소비=표시,오류0. 최종 소스 전체를 다시5분 측정한 결과는 아님.
- 새 체크아웃5df4f7e에서 npm ci/dev/typecheck/build/start/PNG/실제 방·2AI 퀴즈 PASS. 빌드 전 시험의 distPNG 누락을 pretest 자동 빌드로 수정 후153/153 PASS. 정확한 수정 범위는 artifacts/fresh-checkout-results.json.

## 남은 실패·미실행

- 서버 고정 스텝 전체 비용 p95=57.1ms/p99=132.07ms: 목표 초과(P02 FAIL). SQLite FULL 체크포인트/방송 포함; 평균20Hz 유지.
- 최종 후보11: 외부9000/내부12000/수호9000/넥서스12000, 사망 최소 대기20초, 실제 미니언 공성480/600/720초2/8/16배. 양 팀 동일 규칙. 시드1001=818.95초 종료,1002=612.85초 종료,1003=900초에도 전투 중. 목표1/3. 이동/봇 정체·불법 위치·음수 재화·중복 영웅 관측0.
- 최종40시드 나머지37개, 첫 경기+3연속 실제 넥서스 파괴 재경기, 장기 메모리, 모든 스킬 시각 조합·네트워크 장애 주입은 폴리싱으로 이관. 이전 실패 자료를 보존하며 최종 통과로 합치지 않는다.
- 공개 배포·학교 실기기/무선망 미실행.
- 원격 쓰기 실패: git push 인증 없음, 연결 GitHub API403 Resource not accessible by integration. 원격 게시 없이 로컬 커밋·ZIP·git bundle로 보존한다.

## 실행과 다음 명령

사용자 로컬 서버: http://127.0.0.1:3000 (기본1배속). Windows에서는 start-local.cmd를 실행한다. 종료하면 같은 파일로 다시 시작할 수 있다. 다른 작업의 포트 점유 프로세스를 임의 종료하지 않는다.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm start
npm run test:e2e
npm run test:load
npm run test:soak
npm run test:render-perf
```

호스트·학생·LAN 안내는 README.md. 상세 PASS/FAIL/NOT_RUN은 TEST_REPORT.md 및 docs/ACCEPTANCE_MATRIX.md. 분포 재개는 docs/SOAK_RUNBOOK.md. 이 환경은 npm이 PATH에 없어 node .tools/package/bin/npm-cli.js를 사용했으며, 일반 설치에서는 Node24+의 npm을 사용한다. Windows GPU 브라우저 시험은 CLASH_TEST_GPU=d3d11, trace는 필요할 때만 CLASH_E2E_TRACE=1. 장기 시험은 서로 겹치지 않게 실행한다.
