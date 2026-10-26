# 클래스 클래시 서버와 클라이언트 구현 규격

## 1 실행 가능한 기본 구조

빈 프로젝트의 기본 기술 선택은 TypeScript, Node.js 24 LTS 계열, Vite, PixiJS 8 계열, WebSocket, SQLite다. 라이브러리의 실제 패치 버전은 Codex가 구현 시점의 공식 문서와 설치 환경을 확인해 선택하고 lockfile에 고정한다. 최소 버전을 추측하여 최신 패치라고 표기하지 않는다. Node.js와 PixiJS 선정은 구현을 위한 선택이며 사용자 지정 프레임워크는 아니다.

단일 Node 프로세스가 웹 정적 파일과 방 API, WebSocket을 제공한다. 게임 엔진은 DOM·Pixi·네트워크 라이브러리를 직접 참조하지 않는 순수 모듈이다. 화면은 전투 렌더러와 일반 HTML UI를 분리한다. 학생 목록·퀴즈·지갑을 매 렌더 프레임 재생성하지 않는다. 외부 DB 가입·Firebase 키·유료 CDN이 없어도 로컬에서 방을 열고 여러 탭/기기로 접속할 수 있어야 한다.

디렉터리 책임의 기본안:

| 경로 | 책임 |
| --- | --- |
| apps/server | HTTP, 세션·권한, 방 저장소, WebSocket, 경기 스케줄러 |
| apps/client | 호스트/학생 화면, 퀴즈 UI, 연결·재접속, Pixi 전장 |
| packages/engine | tick, 이동, 충돌, 표적, 행동, 스킬, 투사체, 공성, 결과 |
| packages/shared | 공개 자료형, 명령 schema, 상태 enum, 안전한 공개 영웅 정의 |
| packages/content | 영웅 정의, balance 설정, 서버 전용 기본 문제 은행 |
| assets | 오리지널 sprite atlas, 애니메이션 metadata, 픽셀 맵·효과음 |
| tests/unit | 순수 규칙과 수치 경계 |
| tests/integration | 명령·경제·세션·저장·통신 |
| tests/e2e | 실제 브라우저 전체 수업 흐름 |
| tests/load | 30개 소켓, 스냅샷, 봇·오래 돌리기 |
| docs | 명세, 실행 설명, 진행 기록, 테스트 결과, 변경 이유 |

공용 패키지 이름 때문에 서버 문제 은행을 학생 번들에 넣지 않는다. 실제 문제 은행 파일은 server-only import 경계로 검사한다.

## 2 시간과 처리 주기

| 처리 | 초기 주기 | 설명 |
| --- | ---: | --- |
| 시뮬레이션 | 20Hz, 50ms 고정 틱 | 이동·공격·투사체·피해·승패 |
| 전술 의사결정 | 영웅별 5Hz | 표적·공격자리·스킬 조건 재평가 |
| 네트워크 스냅샷 | 10Hz | 서버 권위 상태와 이벤트 전달 |
| 화면 렌더링 | 가능한 60fps | 스냅샷 보간과 애니메이션 |
| UI 값 갱신 | 변경 때/최대 10Hz | 타이머 텍스트는 4~10Hz면 충분 |
| 연결 heartbeat | 5초 | 15초 무응답이면 OFFLINE |
| 저장 체크포인트 | 최대 1초 간격 | 중요 명령 확정 시 추가 저장 |

서버는 단조 시간으로 고정 틱 누산기를 운용한다. 브라우저 requestAnimationFrame이나 호스트 탭 활성 여부가 전투 시간의 원천이 아니다. 일시적으로 느려졌다고 dt를 갑자기 0.5초로 확대하지 않는다. 한 이벤트 루프에서 catch-up은 최대 5틱으로 제한하고 나머지 지연을 계측한다. 지연을 숨기기 위해 전투 틱이나 웨이브를 몰래 삭제하지 않는다. 지속적으로 따라잡지 못하면 호스트에 과부하 상태를 보이고 검증 실패로 기록한다.

MatchState.tick은 OPENING_QUIZ에서 matchId를 만든 시점부터 단조 증가한다. BATTLE 진입 때 battleStartTick을 저장하고 전투 경과 초는 (tick-battleStartTick)/20으로 계산한다. 퀴즈·봇 응답·카운트다운·스킬 readyAt·재출정 시각은 이 절대 match tick을 쓰고, 웨이브 0/20/40초와 후반 공성 배율만 전투 상대 시간을 쓴다. 전투 진입 때 tick을 0으로 리셋하여 이전 준비시간에 예약한 스킬·봇 타이머를 깨뜨리지 않는다.

수업 일시정지는 명시적 roomPaused로 처리한다. 전투·퀴즈 쿨타임·봇 답변 예약·사망 대기·초기 카운트다운의 게임 시간이 모두 멈춘다. heartbeat와 재접속 시간은 실제 시간으로 계속 흐른다. 서버 프로세스 장애에서 복구되는 동안도 경기 시간은 정지한 것으로 처리하며 오프라인 시간을 한꺼번에 전투로 계산하지 않는다.

## 3 상태 모델

아래는 필수 필드 계약이다. 구현상 세부 자료형은 확장할 수 있으나 책임을 합쳐 숨기지 않는다.

### 3.1 Room과 Match

~~~ts
type Team = 'A' | 'B';
type Lane = 'TOP' | 'BOTTOM';
type RoomPhase = 'LOBBY' | 'OPENING_QUIZ' | 'INITIAL_MAINTENANCE'
  | 'COUNTDOWN' | 'BATTLE' | 'RESULT' | 'CANCELLED';
interface Room {
  roomId: string;
  roomCode: string;
  phase: RoomPhase;
  phaseRevision: number;
  lobbyEpoch: number;
  hostSessionHash: string;
  paused: boolean;
  players: Map<string, PlayerState>;
  quizBankId: string;
  match: MatchState | null;
  createdAt: string;
}
interface MatchState {
  matchId: string;
  seed: number;
  rulesVersion: string;
  balanceVersion: string;
  tick: number;
  battleStartTick: number | null;
  nextWaveTick: number;
  result: MatchResult | null;
  units: Map<string, UnitState>;
  structures: Map<string, StructureState>;
  projectiles: Map<string, ProjectileState>;
  effects: Map<string, PersistentEffect>;
  nextEntitySerial: number;
  eventSeq: number;
}
~~~

roomCode는 암호학적으로 임의 생성한 6자리 영숫자다. 생성 충돌은 저장소 유일성 제약으로 다시 시도한다. 방 코드는 학생 초대 수단이며 호스트 권한 비밀번호로 쓰지 않는다. 공개 URL에 host 권한 토큰을 넣지 않는다.

### 3.2 Player와 영웅 소유권

~~~ts
interface PlayerState {
  playerId: string;
  displayName: string;
  team: Team;
  isBot: boolean;
  botProfileId?: string;
  sessionHash: string;
  connectionEpoch: number;
  state: 'WAITING' | 'INITIAL_MAINTENANCE' | 'READY' | 'DEPLOYING'
    | 'ACTIVE' | 'DEAD_MAINTENANCE' | 'FINISHED';
  gold: number;
  starterChoiceUsed: boolean;
  inventory: OwnedHero[];
  selectedOwnedHeroId: string | null;
  selectedLane: Lane;
  activeEntityId: string | null;
  hasDeployedThisMatch: boolean;
  deathId: string | null;
  redeployNotBeforeTick: number;
  sharedSkillReadyAt: Record<string, number>;
  quizAttempt: QuizAttempt | null;
  quizAvailableAtTick: number;
  ledgerRevision: number;
  stats: PlayerMatchStats;
}
interface OwnedHero {
  ownedHeroInstanceId: string;
  heroDefinitionId: string;
  rarity: 'COMMON' | 'ADVANCED' | 'LEGENDARY';
  level: 1 | 2 | 3 | 4 | 5;
  powerEnhancements: number;
  vitalityEnhancements: number;
  skillReadyAt: Record<string, number>;
  obtainedFrom: 'STARTER' | 'NORMAL_DRAW' | 'PREMIUM_DRAW';
}
~~~

同一 heroDefinitionId를 가진 OwnedHero가 여럿일 수 있다. 구매 대상과 출정 대상은 이름이나 배열 index 대신 ownedHeroInstanceId로 지정한다. activeEntityId가 살아 있으면 다른 출정 생성 요청을 거절한다. 사망 이벤트와 출정 명령이 경합해도 동시에 2개가 살아나지 않게 하나의 룸 명령 큐에서 처리한다.

### 3.3 전투 단위와 애니메이션 계약

~~~ts
interface UnitState {
  entityId: string;
  deploymentId: string;
  ownerPlayerId: string | null;
  ownedHeroInstanceId: string | null;
  kind: 'HERO' | 'MELEE_MINION' | 'RANGED_MINION';
  team: Team;
  lane: Lane;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  hp: number; maxHP: number;
  shieldLayers: ShieldLayer[];
  armor: number;
  attackPower: number;
  facingX: number; facingY: number;
  state: UnitActionState;
  actionId: string | null;
  actionStartTick: number;
  impactTick: number | null;
  recoveryEndTick: number;
  targetEntityId: string | null;
  targetPoint: { x: number; y: number } | null;
  slotReservationId: string | null;
  statusEffects: StatusEffect[];
}
~~~

UnitActionState는 02의 상태 머신을 따른다. 화면이 애니메이션을 끝냈다고 피해를 발생시키지 않는다. 서버 impactTick이 피해의 원천이고, 렌더러는 actionId·시간·속도·위치·기술 종류를 받아 선딜→타격→후딜을 표현한다. 치유·실드·CC는 소유자 및 실제 적용량을 포함해 기록한다.

모든 공격에 actionId가 있어야 한다. 공격 범위 안에 있는 동안 매 틱 피해를 반복하는 구현은 금지한다. 다단히트는 actionId+hitIndex로 중복을 구별한다. 투사체는 시작점·발사 틱·속도·대상/방향·반경·유효 기간을 보유한다. 순간 효과는 event, 지속 장판과 살아 있는 투사체는 현재 상태에도 포함한다.

## 4 API와 명령 권한

### 4.1 HTTP와 첫 연결

- POST /api/rooms: 호스트 방 생성. roomCode, hostSessionToken, joinUrl 반환.
- POST /api/rooms/:code/join: 학생 닉네임 참가. playerId, playerSessionToken 반환.
- GET /api/health: 프로세스·저장소 상태. 정답·세션 토큰 없음.
- GET /: 웹 애플리케이션.
- WebSocket /ws: 연결 직후 HELLO로 인증. token을 URL query에 붙이지 않는다.

로컬 개발은 기본 localhost에 바인딩한다. 교실 LAN 시험은 README의 명시적 HOST=0.0.0.0 옵션으로 켠다. 학생은 localhost가 아닌 교사 컴퓨터의 LAN 주소를 사용한다. 인터넷 운영은 HTTPS/WSS와 같은 출처를 기본으로 한다. 설정 예제에 실제 토큰이나 다른 게임의 Firebase 설정을 넣지 않는다.

### 4.2 명령 봉투

~~~ts
interface ClientCommand<T> {
  protocolVersion: 1;
  roomId: string;
  matchId: string | null;
  commandId: string;
  connectionEpoch: number;
  expectedPhaseRevision: number;
  type: string;
  payload: T;
}
interface CommandReply {
  commandId: string;
  status: 'APPLIED' | 'REPLAYED' | 'REJECTED';
  serverTick: number;
  phaseRevision: number;
  ledgerRevision?: number;
  errorCode?: string;
  publicResult?: unknown;
}
~~~

expectedPhaseRevision은 공통 단계가 달라진 오래된 요청을 거절하기 위한 것이다. 다른 사람이 문제 한 개를 푼 것만으로 모든 학생의 요청이 무효가 되는 전역 경제 revision은 사용하지 않는다. 성장·뽑기는 해당 학생 ledgerRevision도 검증한다. 중복 commandId는 입력 payload와의 해시가 일치할 때만 기존 결과를 재전송한다. 같은 ID에 다른 payload는 BAD_REPLAY다.

중복 방지 키의 scopeId는 로비에서 roomId+lobbyEpoch, 경기에서 matchId다. actorId는 호스트도 포함한 NOT NULL 값이며 호스트는 host:roomId, 학생은 playerId를 사용한다. 서버가 인증 세션으로 두 값을 결정한다. UNIQUE(scopeId,actorId,commandId)를 사용해 null matchId/playerId 때문에 호스트 로비 명령이 여러 번 적용되는 구멍을 막는다. 방 만들기 HTTP 요청도 최초 생성 requestId를 저장하고 동일 요청 재시도에 동일 생성 결과를 반환한다. 생성 requestId는 충분히 긴 임의 토큰으로 만들고 로그·학생 링크에 공개하지 않는다.

### 4.3 필수 명령

| 명령 | 발신 권한 | 허용 상태 | 핵심 검사 |
| --- | --- | --- | --- |
| UPDATE_QUIZ_BANK | host | LOBBY | 형식·수량·텍스트 길이 |
| ADD_BOTS / REMOVE_BOT | host | LOBBY | 합계 30·팀 15 제한 |
| ASSIGN_TEAM / AUTO_BALANCE | host | LOBBY | 참가자 존재·팀 제한 |
| START_OPENING_QUIZ | host | LOBBY | 각 팀 1명 이상·유효 은행 |
| CLOSE_OPENING_QUIZ | host | OPENING_QUIZ | 현재 시도만 마감 |
| CLAIM_STARTER | 해당 student 또는 bot manager | 초기 정비 / 아직 한번도 출정하지 않은 BATTLE 정비 | 일반 영웅·미사용 선택권·hasDeployedThisMatch=false |
| DRAW_HERO | 해당 player | INITIAL_MAINTENANCE / DEAD_MAINTENANCE | 티켓·풀·잔액·공간·살아 있는 영웅 부재 |
| LEVEL_UP / ENHANCE_HERO | 해당 player | 초기/사망 정비 | 소유권·상한·잔액·활성 상태 |
| SELECT_HERO_AND_LANE | 해당 player | 초기/사망 정비 | 소유 영웅·TOP/BOTTOM |
| SET_READY(true) | 해당 player | INITIAL_MAINTENANCE | 무료 선택 또는 보유 영웅·라인 |
| SET_READY(false) | 해당 player | READY, 공통 단계 INITIAL_MAINTENANCE | 카운트다운 전 준비 취소 |
| START_COUNTDOWN | host | INITIAL_MAINTENANCE | 기본 전원 준비. allowUnready=true는 명단 확인·각 팀 최소1명 READY |
| DEPLOY_HERO | 해당 player | DEAD_MAINTENANCE | 사망자는5초 경과·기존 활성 영웅 없음. 첫출정 대기자는5초면제 |
| START_QUIZ / RESUME_QUIZ | 해당 player | BATTLE | 쿨타임·기존 시도 |
| SUBMIT_ANSWER | 해당 player | 퀴즈 가능 단계 | attempt·문항·보기·제출 중복 |
| PAUSE_ROOM / RESUME_ROOM | host | 초기 퀴즈/준비/카운트다운/전투 | 일관된 게임 시간 정지 |
| CANCEL_MATCH | host | 종료 전 | 결과를 취소로 확정 |
| REMATCH_TO_LOBBY | host | RESULT / CANCELLED | 새 경기 상태 분리 |

UI에서 숨긴 명령도 서버에서 차단한다. command의 playerId를 신뢰하지 말고 인증 세션에서 actor를 결정한다. 봇 manager는 서버 내부 권한을 갖지만 동일 규칙 함수를 호출한다. 일반 클라이언트가 isBot=true를 보내 우회할 수 없게 한다.

allowUnready 경로는 01의 첫 출정 대기 정책을 따른다. 서버가 실제로 한 번 출정시킨 순간 hasDeployedThisMatch=true를 저장하며 클라이언트가 이 값을 false로 되돌릴 수 없다. 준비 대기자는 경기 시작 직후 자동으로 죽음 기록이나 1패를 받지 않는다. 초기 퀴즈는 이미 완료 또는 호스트 마감된 상태이며 이 경로로 첫20문제를 새로 지급하지 않는다.

## 5 경제와 정답의 원자성

### 5.1 답안 처리 순서

1. actor의 현재 room·match·quizAttempt와 요청 ID를 조회한다.
2. replay라면 기존 정오답·지갑 revision을 반환한다. 재채점하지 않는다.
3. 단계와 일시정지, attempt 유효성, 현재 문항 번호, 보기 ID를 확인한다.
4. 학생에게 보냈던 해당 보기 순서에서 선택 ID를 서버 원본 정답과 비교한다.
5. 제출 기록·정답 수·골드 +0/+1·다음 문항 또는 쿨타임을 같은 트랜잭션에 기록한다.
6. 저장 성공 후 APPLIED를 반환하고 학생 UI를 갱신한다.

시작 퀴즈도 각 문항 보상을 확정 기록하되 준비 단계가 되기 전에는 사용할 수 없다. 초기 준비 진입에서 정답 수를 다시 더하지 않는다. 01의 ‘초기 자산 반영’은 사용 가능 상태와 합계 표시를 뜻하며 두 번째 지급이 아니다.

### 5.2 뽑기 처리 순서

규칙 검증→정확한 비용 확인→서버 난수 한 번으로 등급→유효 등급/역할 풀에서 영웅 추첨→Lv.1 인스턴스 생성→차감·인벤토리·requestId 결과를 함께 저장→응답 순서다. 풀 빈 상태를 런타임에서 다른 등급으로 보정하지 않는다. 콘텐츠 검증 단계에서 모든 활성 풀의 등급 후보가 존재하는지 확인하고 부적합 빌드를 실패시킨다.

실서비스 추첨은 서버 CSPRNG의 균등 정수 표본으로 [0,1) 값을 만든다. 테스트에서는 동일 인터페이스에 고정 seed RNG를 주입한다. 일반 경계는 u<0.8 일반, 그 외 고급이다. 고급은 u<0.3 일반, 0.3<=u<0.9 고급, 0.9<=u<1 전설이다. 정확히 0.9는 전설이다. 통계 시험 외에 경계값 시험도 필요하다.

### 5.3 처리 큐와 실패

한 방의 상태 변경은 순서가 정해진 큐로 처리한다. 전투 틱 입력, 퀴즈, 구매, 출정이 서로 다른 비동기 코드에서 같은 객체를 덮어쓰지 않는다. 틱 시작 시 대기 명령을 serverReceivedSerial 순으로 적용하고 검증이 통과한 명령만 이번 틱 상태에 반영한다. 경제 변경의 성공 ACK는 durable commit 이후 보낸다.

명령 펌프 자체는 실제 시간의 이벤트 루프에서 계속 돈다. 일시정지 중에는 match tick과 게임 상태 진행을 멈추되 RESUME_ROOM, CANCEL_MATCH, 세션 복구와 현재 상태 조회는 처리한다. 정지된 다음 틱을 기다리느라 재개 명령도 실행하지 못하는 교착을 만들지 않는다. 일시정지 중 제출·구매·출정은 ROOM_PAUSED로 거절하고 재개 뒤 새로운 commandId로 다시 시도하게 한다. 이미 적용된 ID를 replay하는 조회는 기존 결과를 반환한다.

같은 틱 명령 중 답안이 CANCEL_MATCH보다 먼저 확정되면 그 보상을 포함하고, 취소가 먼저면 답안을 거절한다. 명령 처리 뒤 그 틱의 전투 피해가 넥서스를 파괴하면 앞서 확정한 답안 보상은 유지한다. ‘동시에’라는 표현에 맡기지 않고 serverReceivedSerial과 시뮬레이션 단계로 결과가 한 가지가 되게 한다.

저장 실패 시 UI에 ‘저장하지 못했습니다. 다시 연결하면 결과를 확인합니다’ 상태와 재시도 동작이 있어야 한다. 먼저 돈을 뺀 화면을 띄운 뒤 실패해 복구되지 않는 optimistic 갱신은 금지한다. 요청이 적용됐는지 불명확하면 새 commandId로 다시 뽑지 않고 기존 ID를 조회한다.

## 6 스냅샷과 전투 이펙트 전달

### 6.1 공개와 개인 상태

공개 상태: 방 단계, 참가자 이름·팀·AI·연결 상태, 현재 출정 영웅·레벨, 모든 전투 유닛/구조물/투사체/장판, 점수판, 확정 전투 이벤트. 개인 상태: 본인 지갑·창고·퀴즈 시도·제출 결과·스킬 대기·성장 구매 결과. 호스트의 퀴즈 진행 집계와 정답률 정보는 호스트 채널에만 보낼 수 있다.

정답 key, 세션 token, 다른 학생의 개인 창고 전체, 다른 학생이 현재 보고 있는 문제의 정답은 공개 snapshot에 포함하지 않는다. 호스트의 전체 전투 관찰 요구는 학습 정답 공개 요구가 아니다.

### 6.2 패킷 기본 규격

~~~ts
interface BattleSnapshot {
  protocolVersion: 1;
  roomId: string;
  matchId: string;
  snapshotSeq: number;
  serverTick: number;
  baselineSeq: number | null;
  full: boolean;
  units: PublicUnit[];
  structures: PublicStructure[];
  projectiles: PublicProjectile[];
  persistentEffects: PublicEffect[];
  removedEntityIds: string[];
  events: CombatEvent[];
  lastEventSeq: number;
}
interface CombatEvent {
  matchId: string;
  eventSeq: number;
  actionId: string;
  type: 'ATTACK_START' | 'PROJECTILE_SPAWN' | 'HIT' | 'SKILL_CAST'
    | 'HEAL' | 'SHIELD' | 'CC' | 'DEATH' | 'STRUCTURE_DESTROYED';
  tick: number;
  sourceEntityId: string | null;
  targetEntityIds: string[];
  effectId: string;
  x: number; y: number;
  params: Record<string, number | string>;
}
~~~

full snapshot은 접속 직후·재접속·기준 손실·주기적 2초 간격에 보낸다. delta만 전송하다가 유실된 baseline을 계속 믿지 않는다. 오래된 matchId 또는 snapshotSeq는 폐기한다. 엔티티 제거와 사망 이벤트는 구분하여 사망 애니메이션을 한 번 재생할 수 있게 한다.

### 6.3 보간과 이벤트

초기 interpolation delay는 100ms, 허용 범위 100~200ms다. renderTime에 대응하는 두 서버 상태 사이에서 위치·방향을 보간한다. 화면만 움직이고 서버 표적/피해를 다시 시뮬레이션하지 않는다. 외삽은 최대 150ms이며 그 이후에는 위치를 멈추고 연결 상태를 알린다. 지연이 끝났다고 몇 초의 위치를 한 프레임에 자연스럽게 이동한 것처럼 숨기지 않는다.

공격 actionStartTick, impactTick, recoveryEndTick을 보간 시계로 맞춘다. 짧은 80ms 타격 이펙트가 snapshot 100ms보다 짧다는 이유로 사라지지 않도록 별도 event stream을 유지한다. eventSeq 기준으로 중복을 제거하되 미수신 이벤트는 요청한다. 최근 10초 이벤트 ring buffer를 서버에 보관하고 클라이언트는 마지막 연속 eventSeq를 ACK한다.

늦게 도착한 핵심 타격 이벤트는 현재 위치와 해당 공격 기록이 모순되지 않는 범위에서 최소 식별 시간으로 한 번 재생한다. 10초보다 오래 연결이 끊겼다면 과거 전투를 모두 폭발시키지 않고 full snapshot의 현재 장판·발사체·진행 행동을 복원한다. 호스트와 학생은 같은 effectId·기술 종류·판정 결과를 사용한다. 카메라 밖 그리기는 학생에서 생략할 수 있지만 호스트의 전체맵 안 이벤트를 거리나 역할 이유로 생략하면 안 된다.

### 6.4 부하와 backpressure

최신 위치 snapshot은 오래된 전송 대기분을 대체할 수 있다. 경제 응답·상태 전환·결과·핵심 전투 이벤트를 같은 방식으로 버리지 않는다. 느린 연결에 무한 큐를 쌓지 말고 기준 손실을 표시한 뒤 full resync로 복구한다. socket buffer 길이·직렬화 시간·송신 bytes를 계측한다.

초기 목표: 정상 30명 방에서 클라이언트 평균 수신 100KiB/s 이하, 1초 p95 200KiB/s 이하를 지향한다. 실측이 초과하면 상태 키 단축·고정 배열·변경분 전송·좌표 양자화부터 검토한다. 이 수치는 아직 성능 측정 결과가 아니다. 모든 효과를 빼서 목표를 맞추는 것은 불합격이다.

## 7 저장과 복구

SQLite WAL 사용을 기본으로 하고 DB 파일은 저장소에 커밋하지 않는다. 최소 테이블은 rooms, participants, quiz_banks, matches, command_results, economy_ledger, match_checkpoints, match_results다. 명령에는 UNIQUE(scopeId, actorId, commandId), 경제 거래에는 같은 명령 키와 거래 종류별 유일성 제약을 둔다. scopeId와 actorId는 NOT NULL이며 로비·호스트 명령도 예외가 아니다.

정비 구매·퀴즈 보상·출정·공통 단계 변경은 durable 명령 결과와 상태 갱신을 원자적으로 저장한 뒤 ACK한다. 단순히 1초 체크포인트만 있고 성공 응답한 자원이 프로세스 장애로 사라져서는 안 된다. 구현은 동일 방의 틱 경계에서 체크포인트와 경제 데이터를 일관되게 커밋하거나, 체크포인트 이후 입력 로그를 같은 결정적 엔진으로 재생하는 방식을 택한다. 어느 방법인지 ARCHITECTURE.md에 명시하고 장애 재현으로 증명한다.

저장 데이터에는 엔진 버전, 콘텐츠 버전, 룸 단계, 경기 틱, 웨이브 시각, 생존 유닛, 투사체, 지속 효과, PRNG 상태, 각 학생 지갑·인벤토리·퀴즈·쿨타임, command replay 결과, eventSeq를 포함한다. 버전이 다른 코드를 읽는다고 낡은 구조를 무리하게 진행하지 말고 명시적 복구 오류를 낸다.

서버 재시작은 최근 일관된 상태를 복원한 뒤 RECOVERING 표시와 full snapshot을 보낸다. 복원 시 오프라인 경과시간을 전투에 적용하지 않는다. command ledger가 확인된 ACK를 중복 지급하지 않고, 복구 결과와 클라이언트가 알고 있던 ledgerRevision이 일치해야 한다. 체크포인트 이전의 전투 애니메이션을 약간 되돌려야 한다면 무음으로 숨기지 말고 ‘서버 복구’ 상태를 표시한다. 결과 확정은 다시 계산해서 뒤집지 않는다.

방 정리는 기본 24시간 비활성 이후다. 진행 중 방은 호스트 탭이 끊겼다는 이유만으로 삭제하지 않는다. 닉네임 외 실명·학번·개인 계정은 필수 수집하지 않는다. 결과 보관·다운로드는 교사에게 기능과 범위를 알리고 제공한다.

## 8 재접속과 다중 탭

세션 token은 브라우저의 해당 출처 저장소에 저장하고 로그에 남기지 않는다. 서버에는 해시를 저장한다. WebSocket 재연결은 1·2·4·8초 간격, 최대 10초 간격에 작은 지터를 적용한다. 화면은 마지막 전장을 유지하고 연결 상태·재시도 버튼을 표시한다. 실패 시 배경만 남기지 않는다.

HELLO에서 같은 participant의 유효 token을 검증하면 동일 playerId에 복귀한다. 새로운 학생을 자동 추가하지 않는다. 새 connectionEpoch를 발급하고 이전 연결의 명령을 거절한다. 이전 탭에는 ‘다른 창에서 연결되었습니다’를 표시한다. 호스트도 같은 방식으로 복구하고 교사만 방 제어를 되찾는다.

host 접속이 끊겨도 서버 전투는 계속된다. 학생이 끊겨도 이미 출정한 영웅은 같은 AI로 싸운다. 그 영웅이 사망하면 정비 상태로 기다리며 접속 장애를 이유로 자동 교체·자동 퀴즈·무료 돈을 지급하지 않는다. 재접속하면 죽었는지·어떤 문제를 풀었는지·잔액이 얼마인지 정확히 복원된다.

한 상태 전환 메시지가 먼저 오고 개인 데이터가 늦게 와도 로딩 중인 목표 화면과 재동기화 버튼을 표시한다. 화면 컴포넌트는 한 matchId의 공개·개인 상태를 함께 받을 때 원자적으로 교체한다. 새 경기 시작 순간 이전 죽음 overlay나 이전 전설 카드가 잠깐 보이지 않아야 한다.

## 9 결과와 시상 통계

피해는 실제 감소한 hp와 흡수된 shield를 구별한다. 과잉 피해는 통계에서 빼고 영웅 대상/미니언 대상/구조물 대상을 분리한다. 영웅 킬은 마지막 유효 피해를 가한 주체의 ownerPlayerId에 기록하며, 타워·미니언의 마무리는 팀 킬로만 올리고 개인 킬은 주지 않는다. 같은 틱 여러 공격이 동시 마무리한 경우 02의 유효 피해 귀속 기준을 따른다. 킬 전 5초 안에 유효 피해·디버프·해당 공격자를 도운 실제 치유/실드를 제공한 플레이어에게 어시스트를 한 번 부여한다. 미니언 킬을 영웅 킬 점수판에 합산하지 않는다.

MVP 초기 계산은 역할 기여를 포함한다. 사람 참가자가 있다면 사람만 비교 모집단으로 삼고, AI 전용 시험에서는 전체 AI를 비교한다. 각 차원에서 모든 후보가 0이면 차원 점수는 0이다.

~~~text
normalize(x, xs) = max(xs) > 0 ? x / max(xs) : 0
damage = normalize(enemyHeroHpDamage)
siege = normalize(structureHpDamage)
support = normalize(effectiveAllyHeroHealing + absorbedAllyHeroShield)
defense = normalize(enemyHeroHpDamageTaken + absorbedAllyHeroShield)
control = normalize(uniqueEffectiveEnemyHeroCcSeconds)
learning = normalize(correctAnswers)
roleContribution = max(damage, support, defense)
mvp = 0.40*roleContribution + 0.25*siege + 0.15*control + 0.20*learning
~~~

고의 피격으로 defense가 부풀 수 있으므로 적 영웅 전투 중 유효 피해만 포함하고, 넥서스 뒤에서 반복 자해·아군 장판 피해는 없다. 수치를 조정할 때 데이터 근거를 남긴다. 이 공식은 v1 초기안이며 사용자가 승인한 기존 DS사커 평점 공식을 그대로 가져왔다는 의미는 아니다. 동점은 공동 수상으로 처리하여 내부 ID 순서로 몰래 승자를 고르지 않는다.

## 10 입력 검증과 운영 안전

닉네임 길이 2~12자, 제어문자 제거, HTML escape. 같은 표시 이름은 허용하되 UI에 짧은 참가 번호를 덧붙여 구분한다. 학생당 일반 명령은 1초 10회 이하, 뽑기/성장은 한 번의 결과 확정 전 동일 종류 요청 중복 잠금. 규칙은 정상 학생을 계속 쫓아내는 강한 속도 제한이 아니라 폭주 보호를 위한 초기값이다.

요청 몸체 크기와 문자열 길이를 제한한다. WebSocket Origin은 허용된 앱 출처를 검사한다. 클라이언트가 보낸 난수·현재 체력·정답 수·골드·킬 수·기술 readyAt을 채택하지 않는다. 개발용 강제 사망·배속·무한 돈·좌표 이동은 개발 프로필에서만 서버가 허용하고 운영 빌드에선 호출해도 거절한다.

에러 코드 최소 목록: ROOM_NOT_FOUND, ROOM_FULL, TEAM_FULL, ROOM_PAUSED, INVALID_PHASE, STALE_MATCH, STALE_CONNECTION, NOT_AUTHORIZED, INSUFFICIENT_GOLD, HERO_NOT_OWNED, HERO_ALREADY_ACTIVE, REDEPLOY_WAIT, QUIZ_COOLDOWN, QUIZ_ALREADY_ANSWERED, INVALID_DRAW_POOL, INVENTORY_FULL, LEVEL_MAX, ENHANCEMENT_MAX, STORAGE_UNAVAILABLE, BAD_REPLAY. 모든 오류에는 학생 또는 교사가 이해할 수 있는 한국어 안내와 다음 행동이 있다.

## 11 빌드와 완료 산출물

~~~text
npm ci
npm run dev
npm run typecheck
npm test
npm run test:e2e
npm run test:load
npm run test:soak
npm run build
npm start
~~~

정확한 실행 명령과 포트는 구현에서 고정한 값으로 README에 갱신한다. dev 한 번으로 서버와 클라이언트가 함께 시작되고 프록시가 연결돼야 한다. start는 빌드된 클라이언트를 같은 서버에서 제공한다. .env.example은 비밀 없는 PORT, HOST, DATABASE_PATH, APP_ORIGIN, LOG_LEVEL 등을 포함한다.

Dockerfile·docker-compose.yml은 로컬 검증 후 제공할 수 있다. 게임 서버 배포 환경이 지정되지 않았다면 호스팅을 자동 구입하거나 다른 운영 게임 서버에 덮어쓰지 않는다. GitHub Pages용 정적 사이트가 열리는 것과 실제 여러 학생이 같은 전장에 연결되는 것은 별개 검증 항목이다.

TEST_REPORT.md에는 실제 사용 Node·OS·CPU·메모리·브라우저·화면 해상도·서버 위치·동시 클라이언트 수·시드·실행 시간·측정 방식·성공/실패/미실행을 기록한다. test runner의 통과 수만 보여주고 아직 없는 학교 실기기 결과를 섞지 않는다.
