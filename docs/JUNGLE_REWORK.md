# LOL 맵·포지션 리워크 (2026-10-27)

사용자 확인: LOL 폴더 맵, 탑·미드·바텀 3라인과 정글, 첨부 챔피언 외형·애니메이션 적용. 이 변경은 기존 specification의 2라인 지형·좌우 본진 부분을 대체합니다. 원문은 보존합니다.

## 실제 경기

- 청팀 남서 / 홍팀 북동 본진. 팀당 3라인 × 외부·내부 타워, 수호 타워 2개, 넥서스 1개.
- 출진 전 탑·미드·바텀·정글 선택. 출진 후 제어·교체·성장·뽑기 금지, 퀴즈만 가능. 사망 후 포지션을 다시 선택하고 직접 출진합니다.
- 정글 6캠프: 각 팀 늑대, 숲의 정령, 바위 수호자. 몬스터도 HP·사거리·추격·기본 공격·피격·사망을 갖습니다. 타워는 중립 몬스터를 공격하지 않습니다.
- 아군 캠프를 먼저 정리합니다. 같은 팀 정글러의 목표가 겹치면 가까운 다른 캠프를 선호합니다. 남은 아군 캠프가 없으면 라인 부족 인원, 현지 적/아군, 체력에 따라 지원 또는 침투합니다. 캠프를 도는 정글러는 미드 수비 인원으로 세지 않습니다.
- 지원 12초 / 침투 20초 판단 유지로 입구 왕복을 줄입니다. HP 28% 미만이면 본진 회복, 85% 이상이면 복귀합니다. 몬스터는 캠프에서 135 이상 벗어나면 복귀·회복합니다.
- 처치 60초 후 캠프 재생성. 실제 처치자에게 최대 HP 18% 회복과 25초 이동 속도 12% 증가. 골드·영웅 레벨은 캠프로 지급하지 않습니다.
- 미니언은 각 팀·라인 근접 3 + 원거리 4, 첫 웨이브는 시작 즉시. 후반 수치는 src/shared/balance.ts에 있습니다. 승리는 항상 실제 적 넥서스 파괴입니다.

## 자산 적용

LOL/background_5v5.png와 챔피언 PNG는 픽셀 수정 없이 가져왔습니다. 프레임 크기·프레임별 시간을 읽고, 시전 클립은 실제 서버 impactTick에 맞춥니다. 좌우 반전은 원본의 측면 캐릭터 표현을 따릅니다. 기존 18종 역할과 36개 스킬 정의는 유지했습니다. 첨부 패키지의 모든 LoL 고유 능력을 이식한 것은 아닙니다.

원본에 두 번째 시전이 없는 애니·리산드라·아이번 등의 외형은 시전 클립을 공유합니다. 게임 스킬별 판정과 투사체·영역 효과는 별도입니다. 일부 피격·대기 클립은 원본부터 단일 프레임이며 임의 동작 프레임을 만들어 넣지 않았습니다.

| 클래스 클래시 | 첨부 외형 | 패키지 |
|---|---|---|
| paladin | 레오나 | leona_mod |
| brawler | 바이 | cf_vi |
| swordsman | 아트록스 | cf_aatrox |
| archer | 애쉬 | cf_ashe |
| pyromancer | 애니 | cf_annie |
| priest | 소라카 | wythm_soraka |
| barbarian | 올라프 | cf_olaf |
| crossbowman | 케이틀린 | cf_caitlyn |
| cryomancer | 리산드라 | cf_lissandra |
| monk | 오공 | cf_wukong |
| iron_knight | 세주아니 | cf_sejuani |
| assassin | 파이크 | cf_pyke |
| stormcaller | 케넨 | wythm_kennen |
| guardian_golem | 람머스 | wythm_rammus |
| bard | 소나 | cf_sona |
| rune_mage | 라이즈 | cf_ryze |
| ancient_one | 초가스 | cf_cho_gath |
| guardian_spirit | 아이번 | cf_ivern |

패키지 작성자·원본 체크섬: assets/source/jungle-rework/provenance.json. 배경의 별도 제작자/배포 라이선스는 첨부 자료에서 확인되지 않았습니다. 현재 외형은 첨부 모드 제작물이며 자체 제작 또는 CC0라고 표기하지 않습니다. 중립 몬스터 3종은 src/client/monster-art.ts의 원본 픽셀 도형입니다. 기존 미니언·건물·스킬 효과의 출처는 assets/source/world-assets/provenance.json에 보존했습니다.

## 검수

npm run build / npm run typecheck / npm test / npm run test:jungle. champion-review.html은 18종의 연결 동작을 원본 속도로 검수합니다. 실제 전장 검증은 artifacts/jungle-rework에 기록합니다. 이전 버전 보고서를 새 버전 PASS로 인용하지 않습니다.
