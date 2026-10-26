# 전투·영웅 인수 조건 실행 증거

이 문서는 [02 AI와 전투](specification/02_AI_AND_COMBAT.md)의 COM 50개와 [03 영웅과 도트](specification/03_HEROES_AND_PIXEL_ART.md)의 HERO 19개를 기존 테스트·실제 실행 기록에 연결한다. 구현 존재 여부와 인수 조건의 검증 완료 여부를 구분한다. 2026-10-26 작성 시점의 기록이며, 새로운 테스트를 실행하지 않고 기존 증거를 검토했다.

- **PASS**: 해당 행의 핵심 시나리오에 실행된 자동 검증 또는 직접 확인한 시각 기록이 있다. 측정 표본과 환경을 함께 적었다.
- **FAIL**: 실제 실행한 관련 시나리오에서 실패가 관측되었다. 과거 성공 기록으로 최신 실패를 덮지 않는다.
- **NOT_RUN**: 전체 인수 조건을 아직 검증하지 않았다. 일부 자동 검증이 통과했어도 빠진 조건을 명시한다. 구현 결함이 확인되었다는 뜻은 아니다.

표의 C/H/R/RE/E/D 번호는 문서 끝의 **파일 경로와 정확한 테스트 제목**을 가리킨다. 같은 ID를 이름에 붙인 테스트라도 원문의 모든 조건을 검사한다고 간주하지 않았다.

## 검토한 실행 증거

| 증거 | 실제 결과와 범위 |
|---|---|
| [unit-results.txt](../artifacts/unit-results.txt) | 최신153개 실행, 153 PASS, 0 FAIL, 약10.15초. C 21개(미니언 접선 회귀 포함), H의36개 스킬별 양성 시전과 개별 회귀, 추가E12개·heartbeat·룸·경제·복구 등을 포함한다. |
| [acceptance-unit-results.txt](../artifacts/acceptance-unit-results.txt) | 이전 115개 실행, 115 PASS. 최신153개 기록보다 오래된 증거다. |
| [acceptance-extra-heartbeat-results.txt](../artifacts/acceptance-extra-heartbeat-results.txt) | 추가 회귀 E 12개와 heartbeat 6개를 실제 실행하여 18/18 PASS, 0 skip, 종료코드0. E의 상태 제어 fixture는 서버 검증이며 브라우저 시각 검증을 뜻하지 않는다. |
| [VISUAL_REVIEW.md](../artifacts/VISUAL_REVIEW.md) | 정상 속도 실제 HTTP/WS에서 사람 1+AI 29 로비·퀴즈·출정·전투·재접속 화면을 열어 본 과거 기록. 호스트 전체맵, 학생 추적 화면, 퀴즈 중 전투, 모바일 폭 확인. 36개 모든 스킬의 프레임 동기 검수는 포함하지 않는다. |
| [visual-spot-check-failure.json](../artifacts/visual-spot-check-failure.json) 및 [최신 시각 기록](../artifacts/VISUAL_REVIEW.md) | COUNTDOWN 정체 실패를 보존했다. 픽셀 자산 로더 수정 후 18:38 KST 생산 번들 단독 단축 점검은 PASS: BATTLE 전환·실제 첫 적중·18개 아틀라스·관찰 패널 높이 수정 확인. 시작 퀴즈를 조기 마감한 단축 시험이므로 전체 수업 완주나 36스킬 시간축 전수 검증의 증거는 아니다. |
| [load-results.json](../artifacts/load-results.json) | 30명 학생+호스트 31개 인증 WS, 약 20초, 600개 시작 답안, 중복 뽑기·재접속 검증 PASS. 5분 전체 생존 유닛 증가 부하를 대신하지 않는다. |
| [browser-performance.json](../artifacts/browser-performance.json) | 최신 생산 번들 단독 정상 20Hz 서버·30 STANDARD AI·5분 표본에서 frame p95 116.8ms로 목표20ms FAIL. 장면 갱신CPU p95 1.8ms, WebGL 제출CPU p95 4.7ms이며 실제 전투는 계속 진행했다. Windows/Chromium/SwiftShader 개발 환경이므로 학교 GPU 성능으로 일반화하지 않는다. |
| [후보 7 기록](../artifacts/soak-candidate7-90hp-results.json) | 10개 서로 다른 시드, 완료 7, 600–780초 4, 900초 제한 내 미완료 3. 최종 이동 수정 후 정체/불법 위치 모두 0. 경기 길이 인수는 FAIL. |
| [후보 8 기록](../artifacts/soak-candidate8-siege-results.json) | 8개 기록 후 중단한 탐색 배치. 완료 6, 목표 구간 3, 제한 내 미완료 2. 최종 40경기에 합산하지 않는다. |
| [후보9 합산10경기](../artifacts/soak-final40/summary.json) | 10/10 완료, 목표 구간6/10, 중앙값685.075초, 최소491.20/최대836.95초로 시간 분포 FAIL. 정체1건(시드1010 원거리 미니언), 불법 위치0. 중단한 부분 경기 대신 시드별 완료 기록만 합산했다. |
| [후보10 새40경기 지문](../artifacts/soak-candidate10-final40/manifest.json) | 수호/넥서스 원래HP 복원·후반 배율 조정·미니언 접선 수정 뒤의 코드/수치를 고정했다. 과거10개 결과를 가져오지 않는다. 준비 시점 실행0, 브라우저 성능 검증 후 시드1001–1040을 새로 측정한다. |

### 변경한 초기 수치의 적용 범위

원본 명세 JSON을 수정하지 않았다. [runtime balance](../src/shared/balance.ts)에 사망 후 최소 수동 출정 대기 20초(초기 5초), 미니언의 구조물 상대 배율 0/480/600/720초에서 1/2/8/16(초기1/1.25/1.5/2)을 명시했다. 수호 타워/넥서스 HP는 후보9의8000/10000에서 원래14000/22000으로 복원했고, 외부/내부 타워 HP는9000/12000이다. 따라서 COM-041과 COM-043의 **원본 숫자 그대로 통과했다는 주장과 현재 설정의 검증은 다르다**. 사용자 확정 규칙인 수동 출정, 실제 공격으로 넥서스 파괴, 승패 시간 제한 없음은 유지한다. 최종 40경기 분포가 미완료이므로 이 수치를 최종 검증 완료한 균형으로 간주하지 않는다.

## 02 전투 인수 조건 — 50개

| ID | 판정 | 정확한 자동/수동 증거 | 확인 범위와 남은 검증 |
|---|---|---|---|
| COM-001 | PASS | C01, R06 | 시작 틱에 팀·라인별 근접3/원거리4, 총28기. |
| COM-002 | PASS | C01 | 399/400/401틱 경계에서 20초 웨이브 한 번만 추가. |
| COM-003 | NOT_RUN | R01, C13; 후보9 네 경기 | 정원·지형 도형 및 실전의 불법 위치0은 확인. 30명 전원 동시 출정 직후 10초의 팀별15·활성30·합류 통과를 한 조건으로 고정한 검증은 없다. |
| COM-004 | PASS | R06, E06 | 생존 중 뽑기·성장·선택·출정 거부, 자산·인벤토리·선택 불변 및 동일 초기 상태의 사람/각 봇 프로필 100틱 전투 전체 상태 동등성을 실제 실행 확인. |
| COM-005 | PASS | RE04 | 같은 요청 네 번과 다른 요청 ID 재시도 모두 활성 영웅/출정 하나만 유지. |
| COM-006 | PASS | C18 | 근접8의 서로 다른 링 자리, 실제 피해, 겹침 허용치, 정체0 검사. |
| COM-007 | NOT_RUN | C19, C20, C21; navigation-1010-before/after | 후보9의10경기 중 원거리 미니언 정체1건을 발견했다. 정확한 좌표로 수정 전 실패를 재현하고 실제 시작 좌표/목표 연결 검사를 고쳐 이동 회귀3개와 전체153개 PASS. 현재 코드의 밀집 새40경기 무정체 확인은 남음. |
| COM-008 | NOT_RUN | 스킬 양성 fixture; 과거 호스트 캡처 | 탱커·궁수·사제의 전후열/사제 단독 선두 금지를 수치 또는 연속 영상으로 판정한 기록 없음. |
| COM-009 | NOT_RUN | C08은 잠금 의존성만 검사 | 도주 적을 타워 뒤로 추격하다 포기하는 경로 시나리오 없음. |
| COM-010 | NOT_RUN | 현재 타깃 유지 로직 구현 | 두 후보 거리의 교대 변화에 따른 타깃 전환 횟수 회귀 없음. |
| COM-011 | PASS | C03 | 선딜 중 표적 이탈 시 원거리에서 근접 피해를 주지 않음. |
| COM-012 | NOT_RUN | C04; 과거 전투 캡처 | 서버의 발사 전 피해0·발사체 후 착탄 피해는 PASS. 동일 actionId의 렌더 발사/피격 프레임 시간 캡처는 미실행. |
| COM-013 | NOT_RUN | 36개 스킬 양성 시전 중 관통탄 | 실제 스텝 전체를 가로지르는 고속 sweep와 표적당 한 번 적중을 동시에 고정한 경계 회귀 없음. |
| COM-014 | PASS | C04 | 발사 후 궁수 사망에도 화살 착탄, 원래 플레이어 피해 통계 유지. |
| COM-015 | PASS | C05 | 죽은 표적의 탄환이 다른 적에게 재배정되지 않음. |
| COM-016 | NOT_RUN | C06 | 같은 틱 시작된 상호치명타는 양쪽 사망/각 팀1킬 PASS. 배열 순서 역전과 팀 교환의 동등성 대조는 미실행. |
| COM-017 | PASS | C07 | 시작HP50에 같은 틱 피해70·회복30을 실제 충돌 처리하여 HP10 및 기여 통계 확인. |
| COM-018 | PASS | C09 | 반복 강한 CC의 2초 상한, 상한 후 면역, 짧은 자연 종료에는 새 면역 없음. |
| COM-019 | NOT_RUN | H05, H10 | 속박 중 스킬 허용/정화/면역 미생성 일부 PASS. 감속·속박·침묵 동시 조합과 모든 허용 동작은 미실행. |
| COM-020 | NOT_RUN | C13 | 충돌 반경 포함 지형/도형 함수만 PASS. 실제 넉백을 벽에 충돌시키는 이동 결과 회귀는 없음. |
| COM-021 | NOT_RUN | 사제 2개 양성 시전 fixture | 부상 아군 실제 회복은 PASS. 만피·부상·사망 대상 혼합에서 낭비 없는 재검사 조건은 미실행. |
| COM-022 | PASS | H10 | HP가 충분한 속박 아군을 정화하며 스턴 중 자신은 시전하지 못함. |
| COM-023 | NOT_RUN | 보호막 스킬 양성 fixture | 보호막 생성은 PASS. 동일 출처 재시전 갱신과 총HP35% 상한 반복 검증 없음. |
| COM-024 | NOT_RUN | 36개 스킬 fixture는 유효 대상이 있는 양성 조건 | 적0명에서 AoE 최소 타깃 조건 실패/쿨다운 비소모를 따로 검사하지 않음. |
| COM-025 | NOT_RUN | D01, H07, 36개 Lv5 양성 시전 | 데이터상 2개 상한, Lv1 잠금, Lv5 시전은 PASS. Lv2에서 첫 스킬만 가능한 실제 전투 경계는 미실행. |
| COM-026 | PASS | RE09, R04, D02 | 시전 후 사망/동일 종류 다른 소유 인스턴스로 교체해도 공유 쿨다운 유지; 성장·강화는 각 인스턴스에 독립. |
| COM-027 | NOT_RUN | C08 | 외부 생존 시 내부 잠금 플래그는 PASS. 모든 피해 종류0과 실제 AI 외부 우선 타깃은 전수 검증 없음. |
| COM-028 | PASS | C08 | 한 라인의 외부+내부만 파괴하면 반대 라인 타워 생존 중에도 수호 타워 잠금 해제. |
| COM-029 | NOT_RUN | C08 | 수호 타워 하나 생존 시 넥서스 잠금 플래그 PASS. AoE 피해0와 남은 수호 타워 실제 AI 공격은 미실행. |
| COM-030 | NOT_RUN | 실제 완료 경기의 넥서스 파괴 기록 | 근처 미니언의 유혹에도 열린 넥서스 공성을 유지하는 고정 조건 회귀 없음. |
| COM-031 | NOT_RUN | 타워 어그로 구현 | 미니언 탱킹→수비 영웅 공격자에게 전환하는 전용 시나리오 없음. |
| COM-032 | NOT_RUN | C04는 영웅 발사체 | 타워 발사 후 표적이 사거리 밖으로 나가도 탄환이 유지되는 전용 회귀 없음. |
| COM-033 | PASS | C14, RE02 | 20초/30초 기다려도 사람 자동 부활 없음; 죽은 동안 성장 정비 가능; 명시적 출정 필요. |
| COM-034 | NOT_RUN | RE01, RE07 | 7번째 문제 중 사망·새로고침·중복 답안의 상태/보상 보존 PASS. 해당 순간 학생의 정비 알림 표시까지 보는 브라우저 검증은 미완료. |
| COM-035 | NOT_RUN | VISUAL_REVIEW; 최신 생산 번들 단축 점검 PASS | 과거 같은 경기 호스트/학생 카메라 캡처와 최신 호스트 전체맵 표시 수정은 확인. COUNTDOWN 정체는 수정 후 실제 교전으로 회귀 확인했다. 동일 판정/모든 전장 효과의 호스트·학생 동시 전수 검수는 남음. |
| COM-036 | NOT_RUN | R11 및 재접속 과거 UI 기록 | 체크포인트/재접속은 PASS. 호스트 탭만 백그라운드30초 후 진행/복원하는 브라우저 시나리오 없음. |
| COM-037 | NOT_RUN | C15 | 같은 입력의 700틱 전 상태·이벤트 비교는 2회 PASS. 요구한 3회 완주 승패·파괴 순서·통계 비교는 미실행. |
| COM-038 | NOT_RUN | load-results, browser-performance | 31개 WS 약20초 연결·답안·재접속 PASS. 성장한 실제 유닛 수에 따른 고정 스텝 무누락/미니언 무누락 부하 검증은 미완료. 별도의 5분 렌더 p95 기준은 FAIL. |
| COM-039 | NOT_RUN | C16; E12 구현 | 서버 두 넥서스 HP0의 한 번 DRAW 확정 PASS. 실제 동시 투사체의 DRAW·7개 시상식·종료 후 요청 동결 E12도 추가 실행 PASS. 양측 결과 UI 일치 확인은 미완료. |
| COM-040 | PASS | C16, R10, RE12 | 확정 뒤 추가 step으로 상태 불변; 종료 후 요청/답안은 마감 처리되어 자원·통계·시상 불변. |
| COM-041 | NOT_RUN | RE02; runtime minimumDeadWaitSeconds=20 | 원문5초를 그대로 사용하지 않음. 현 설정의 직전 틱 거부와 충분히 지난 뒤 수동 출정/정비는 PASS. 정확한 20.00초 첫 허용 경계 자체는 미검증. |
| COM-042 | NOT_RUN | R09, R07; E05 구현 | 일시정지 시 공용 틱/요청 정지와 재개 PASS. 퀴즈 무응답 중 1분 실제 공격 진행 E05도 추가 실행 PASS. 전투·퀴즈쿨·사망잠금이 모두 걸린 단일 시나리오의 경계 대조는 남음. |
| COM-043 | PASS | C10, C11 | 현재 명시한 1/2/8/16 런타임 배율 경계와 실제 미니언 구조물 피해만 배율 적용, 영웅/미니언 상대 피해 불변 PASS. 원문1/1.25/1.5/2 통과를 뜻하지 않음. |
| COM-044 | PASS | C12 | 큰 구조물 표면 거리 안의 근접 링에서 실제 공격·피해 시작. |
| COM-045 | PASS | C02, D03, 36개 양성 시전 | 230/300/150ms의 올림 틱5/6/3 및 초기 피해 지연 검사, 모든 스킬 데이터의 틱 정렬 검사. 렌더 프레임 검증은 COM-012/HERO-18 별도. |
| COM-046 | PASS | R09 | 정지된 틱을 기다리지 않는 RESUME 즉시 처리와 다음 틱 진행. |
| COM-047 | NOT_RUN | C01, R06 | 절대틱6000에서 시작해 경기 elapsed0/첫 웨이브 한 번 PASS. 준비 단계에서 보유하던 절대 스킬쿨다운을 전환 후 재검사하는 조건 없음. |
| COM-048 | NOT_RUN | balance 및 전장 구조물 좌표 구현; 과거 전체맵 캡처 | x520/1016·사거리180과 중앙 양타워 범위 비중첩을 한 실행 assertion으로 검사한 기록 없음. |
| COM-049 | PASS | C17 | HP100을 동시90/60으로 공격하여60/40 기여·큰 source 마무리·팀킬1·나머지 도움 기록. 장기3회 결정성은 COM-037 별도. |
| COM-050 | NOT_RUN | H10, C09 | 기존 속박 정화/숨은 신규 면역 없음 일부 PASS. 기존 긍정 면역 보존과 정화한 바로 그 틱 신규CC 허용을 함께 검사하지 않음. |

## 03 영웅 인수 조건 — 19개

| ID | 판정 | 정확한 자동/수동 증거 | 확인 범위와 남은 검증 |
|---|---|---|---|
| HERO-01 | NOT_RUN | H07, D01, D03 | Lv1 스킬 미시전/해금 데이터 PASS. 성전사 대 검사 화면의 두 잠금 표시와 선딜/피해 프레임 동시 확인은 미실행. |
| HERO-02 | NOT_RUN | 격투가 연환권 양성 fixture | 2타 직전 표적 사망 시 3타가 다른 적으로 넘어가지 않는 전용 조건은 미검증. |
| HERO-03 | NOT_RUN | C04, H04; 화염 폭발 양성 fixture | 일반 화살 사후 착탄과 강한CC로 미완성 시전 취소는 PASS. 화염 폭발 발사 직후 사망/발사 직전 사망 두 경계는 미검증. |
| HERO-04 | NOT_RUN | H05, 얼음술사 2스킬 양성 fixture | 속박 중 사거리 내 스킬과 면역 미생성 PASS. 두 시전자 감속 최강50%/속박 만료max 반복 조건은 미검증. |
| HERO-05 | NOT_RUN | 사제 2스킬 양성 fixture | 실제 치유 PASS. 선딜 중 대상 만피 전환에 따른 유효 회복0/타깃 순간 재배정 금지는 미검증. |
| HERO-06 | PASS | H10 | 속박 대상 정화, 스턴 중 수도승 자기 시전 금지. |
| HERO-07 | NOT_RUN | 암살자 양성 fixture | 타워 몸체로 모든 측면 착지점이 막힌 경우 도약 미시전/구조물 뒤 이동 금지를 직접 검사하지 않음. |
| HERO-08 | PASS | H08 | 앞 미니언이 구속 볼트의 피해·속박을 받으며 뒤 선택 영웅에는 확정 명중하지 않음. |
| HERO-09 | PASS | H09 | 다음 적까지100인 경우70 점프 범위를 넘겨 연쇄 종료. |
| HERO-10 | PASS | H12 | 음유시인3의 공격 주기 버프 최댓값15% 한 번, 이미 시작한 공격 hit 시각 불변. |
| HERO-11 | PASS | H01 | 룬 표식의 소유 시전자 분리 및 자기 공명만 자기 표식 소비. |
| HERO-12 | PASS | H02 | 겹친 공명의 대상 하나 총 피해150% 상한. |
| HERO-13 | PASS | H03, H11 | 서로 다른 인스턴스의 인장2+2 합산 금지, 자기3개에서만 한 번 폭발/소비. |
| HERO-14 | NOT_RUN | H06 | 결계 위치 고정과 시전자 사망 시 결계 종료 PASS. 사망 시 남은 개별 보호막의 만료까지 관찰하는 부분은 미검증. |
| HERO-15 | NOT_RUN | D01 및 사제/수호령 양성 fixture | 서로 다른 회복/보호막 정의와 양성 동작은 존재. 동일 부상 아군 조건에서 수호령의 숨은 직접 치유가0임을 확인하는 비교 회귀 없음. |
| HERO-16 | NOT_RUN | C08; 36개 양성 시전 | 구조물 잠금 플래그 PASS. 36개 모든 스킬의 구조물 배율·잠금 피해·CC/치유/표식 면역 조합 전수 검사는 미실행. |
| HERO-17 | NOT_RUN | R04, RE09, D02; E07 구현 | 독립 성장·교체 시 공유쿨 유지 PASS. 실제 A→B→A 출정의 각 인스턴스 레벨·HP·공격력·강화 분리/만피 복귀 E07도 추가 실행 PASS. 고급 영웅의 레벨별 스킬 해금까지 함께 비교하는 절차는 남음. |
| HERO-18 | NOT_RUN | VISUAL_REVIEW; 최신 생산 번들 단축 점검 PASS | 자산 로더 수정 후 최신 호스트 교전·전체맵 표시 확인. 동일 actionId의 호스트/학생 발사→적중 시각 및 양라인 모든 핵심 액션 동시 검수는 미완료. |
| HERO-19 | NOT_RUN | C09, H04, H10 | 공통 강한CC 2초 상한/면역 및 짧은 자연 종료·정화 새면역 없음 PASS. 성전사/격투가/번개술사의 스턴+띄우기 실제 반복 혼합 시나리오는 미검증. |

## 반드시 별도로 남은 시각·분포 검증

02의 수동 필수 7개는 다음과 같이 관리한다. 정적 PNG 픽셀 검사(D04), 콘솔 오류 없음, 과거의 화면 한 장만으로 액션 인수를 대체하지 않는다.

| 수동 항목 | 판정 | 증거/부족한 부분 |
|---|---|---|
| 근접 1대1의 선딜→접촉→피격→후딜 구분 | NOT_RUN | 실제 서버 hit 검증은 있으나 프레임 구간별 육안 기록 없음. |
| 탱커2/딜러3/서포터1 진형·회복·타깃 유지 | NOT_RUN | 이 조합의 연속 영상/판정 기록 없음. |
| 호스트 30명 양라인 모든 실제 액션 | NOT_RUN | 최신 생산 번들 실제 교전/전체맵 표시 수정은 PASS. 전체 액션 누락 없는 시간축 판정은 남음. |
| 광역/전설 중첩 시 캐릭터·HP 가독성 | NOT_RUN | 모든 고밀도 중첩 조합을 직접 검수하지 않음. |
| 타워 공성 시 미니언 선두·후열/서포터 위치 | NOT_RUN | 실제 파괴 기록은 있으나 역할별 위치 시각 판정 없음. |
| 양라인 수호 타워 합류 폭·밀집 통과 | NOT_RUN | 실제 경기 정체0 표본은 있으나 합류부 연속 육안 검수 없음. |
| 사망 정비→수동 재출정 UI | NOT_RUN | 정비 화면/서버 흐름 일부 PASS. 실제 퀴즈 중 사망을 포함한 최종 브라우저 완주 검증은 남음. |

최종 **30 STANDARD AI 40개 서로 다른 시드의 경기 길이 분포는 NOT_RUN**이다. 후보9는10개 중6개만 목표 구간이라 예비 분포 FAIL이었다. 이를 최종40개 결과로 확대해 보고하거나 새 코드에 섞지 않는다. 후보10의 새40개가 끝난 뒤 중앙값600–780초 및28/40 이상600–780초를 판정하며, 예비 결과가 나빠도40개 전체 분포를 수집한다. 후보7·8·9의 실패 기록도 보존했다. 사람1+AI29 완주와 AI30의 연속3회 넥서스 파괴·시상식 E2E 역시 현재 로그로 PASS 처리하지 않는다.

## 테스트 제목 색인

아래 제목은 소스에서 그대로 추출했다. C/H/R/RE/D 중 실행 로그에 있는 제목은 위의153개 실행 기록에 연결된다. E 12개는 추가 18개 실행 로그에서 전부 PASS를 확인했다. 제목에 COM/HERO 번호가 있어도 표에 적힌 실제 assertion 범위만 인정한다.

### C — [tests/combat.test.ts](../tests/combat.test.ts)

- **C01** — COM-001/002/047: exact opening and 20-second waves with a monotonic match clock
- **C02** — COM-045: millisecond timelines ceil to exact integer ticks
- **C03** — COM-011: melee windup misses when the locked target escapes the hit range
- **C04** — COM-012/014: arrows do no pre-release damage and persist after the archer dies
- **C05** — COM-015: homing projectiles never reassign after target death
- **C06** — COM-016: both already-started impacts resolve despite same-tick lethal damage
- **C07** — COM-017: concurrent damage and healing are batched from tick-start HP
- **C08** — COM-027/028/029: lane-specific siege dependency graph and nexus lock
- **C09** — COM-018: hard CC caps at two seconds and supplies only cap immunity
- **C10** — COM-043: late siege multipliers affect only the declared time intervals
- **C11** — COM-043: late minion siege scales real structure hits without scaling hero or minion damage
- **C12** — COM-044: melee surface-gap ring can actually hit a large structure
- **C13** — COM-003/020: corridor and ability shapes include collision radii
- **C14** — COM-033: dead human units remain dead without an explicit deployment command
- **C15** — COM-037: identical seed and input reproduce every event and final unit state
- **C16** — COM-039/040: double nexus destruction is a draw and further steps freeze
- **C17** — COM-049: concurrent 90 and 60 damage is credited 60 and 40 on a 100 HP victim
- **C18** — COM-006: eight melee attackers reserve distinct ring positions instead of the target center
- **C19** — COM-007: a tank adjacent to its own tower navigates around the solid obstacle
- **C20** — COM-007: a mage at the inner tower and corridor corner finds a valid departure edge

- **C21** — COM-007: a nearby ranged-minion goal cannot shortcut the tower tangent from its grid center

### H — [tests/hero-skills.test.ts](../tests/hero-skills.test.ts)

별도로 HEROES의 각 스킬에 대해 정확한 제목 형식 «스킬ID: real AI reserves cooldown, produces impact and applies its mechanic»의 36개 양성 시전 테스트가 있다. 18명×2스킬 모두 실제 AI가 쿨다운을 예약하고 충돌/효과를 적용하는지 검사한다.

- **H01** — rune marks belong to the caster and resonance consumes only its own marks
- **H02** — rune resonance overlap caps one target at 150% damage
- **H03** — ancient sigil stacks do not combine across owned hero instances
- **H04** — strong CC stops unfinished casts; cooldown remains reserved
- **H05** — root allows a started ranged skill; it does not grant hard CC immunity
- **H06** — guardian barrier is fixed in place and ends when its caster dies
- **H07** — two low-level heroes never cast locked skills
- **H08** — binding bolt hits the intercepting minion instead of the chosen hero
- **H09** — chain lightning stops when the next enemy is 100 units away
- **H10** — monk cannot begin cleansing while stunned, then clears root without granting immunity
- **H11** — third own sigil consumes three stacks and applies one extra burst
- **H12** — three bard buffs preserve one 15 percent maximum and a started attack hit time

### R — [tests/room.test.ts](../tests/room.test.ts)

- **R01** — L05-L11: roster atomic capacity, both teams, lock after opening
- **R02** — Q01-Q02: bank validation includes BOM, CRLF, duplicate choices and line errors
- **R03** — Q03-Q07: opening 20 distinct questions, authoritative one-time rewards and zero correct starter
- **R04** — G01-G04 G11-G14 M08-M13: independent growth and replay safe economy
- **R05** — G05-G09: exact boundaries, valid role pools and 100000 sample distributions
- **R06** — M01-M03 C01-C02: first deployment and t0 wave; live mutation rejected
- **R07** — Q08-Q09 Q13: incomplete attempt resume and exactly 30s cooldown after tenth
- **R08** — N10-N11: actors, epochs, stale matches, private snapshot and client-provided gold denied
- **R09** — pause preserves all game clocks, and resume command does not deadlock
- **R10** — R04-R05 R14: cancellation locks input; repeated rematches clear all match state
- **R11** — N15: SQLite command checkpoint, replay and pending quiz survive restore
- **R12** — B03-B04: specified independent seeded RNG golden vectors and learning probabilities
- **R13** — R09-R12: all seven awards, actual contribution, ties, human candidate separation

### RE — [tests/room-edge.test.ts](../tests/room-edge.test.ts)

- **RE01** — F14/Q10/COM-034: seventh-question death preserves attempt; resume and duplicate answer pay once
- **RE02** — COM-033/041: no human automatic respawn after 30s; configured wait boundary and maintenance remain legal
- **RE03** — allowUnready first deployment preserves earned gold and starter without a false death or redeploy wait
- **RE04** — COM-005: four identical deployments replay one entity/deployment; different IDs cannot double summon
- **RE05** — death generation rejects delayed previous-life and missing-generation deployment requests
- **RE06** — death generation guards every maintenance mutation before spending or changing a selected hero
- **RE07** — Q11: redeploying during an unfinished quiz preserves its exact next question and reward ledger
- **RE08** — replaying an old starter ACK returns the original immutable hero result after later growth
- **RE09** — COM-026: same-type duplicate swap retains server skill cooldown and independent growth
- **RE10** — host closing opening quiz cancels bot pending answers without new rewards or ghost bot requests
- **RE11** — B14/Q15: bot reservations, full answer key, future random streams and session hashes stay off both public views
- **RE12** — Q14/R05: late quiz answer after final result cannot change wallet, stats or awards

### E — [tests/acceptance-extra.test.ts](../tests/acceptance-extra.test.ts)

- **E01** — L12: an empty team and a team without READY both block start, including allowUnready
- **E02** — L13: exactly two standard AI complete all 40 graded answers, choose and grow, then READY before host starts
- **E03** — B05: 2000 wrong-intent choices across real shuffled items reach every distractor and never the answer
- **E04** — Q04: 0, 1, 10 and 20 correct answers earn exact assets; every score retains the free starter
- **E05** — Q12: one minute without answering leaves assets and attempt unchanged while real attacks continue
- **E06** — B08/B12: active AI cannot buy or swap, and bot profile never changes identical automatic combat
- **E07** — M07/M09: actual death and A→B→A deployments restore each owned hero growth and full HP
- **E08** — B07: an AI starts its next real quiz no earlier than 600 ticks after answer ten
- **E09** — B09: a zero-asset AI returns with its existing free hero after a real death without shopping forever
- **E10** — R03: 13 minutes of real server ticks with unequal surviving nexus HP never creates a time-limit winner
- **E11** — late unready AI takes its legal first maintenance path without a fabricated death or lost opening assets
- **E12** — R03/R05: simultaneous actual projectile nexus kills make one DRAW ceremony and freeze all late student mutations

### D — [tests/content.test.ts](../tests/content.test.ts)

- **D01** — 18 heroes preserve reference stats, rarity pools and exactly two unlock skills
- **D02** — growth rounds once, remains independent and does not change speed/range/timing
- **D03** — 36 timelines have tick-aligned starts and distinct mechanisms
- **D04** — all original PNGs contain visible 8-direction, 8-state frames and valid sockets

