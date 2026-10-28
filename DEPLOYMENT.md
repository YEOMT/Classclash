# Class Clash 0.2 운영·배포

현재 상태는 **BLOCKED_DEPLOYMENT**이며 확인된 공개 플레이 URL은 없습니다. 로컬 실행, GitHub 코드 반영, 공개 서버 배포, 학교 실기기 검증은 별도입니다. 사용자가 지정한 최신 그래픽은 학교 교육용 로컬 검토 기준으로 보존합니다. 사용자는 비상업·교육 목적 및 재배포하지 않는 범위를 확인했으며, 이를 원작 자산의 공개 재배포 허가로 기록하지 않습니다.

## 확인된 배포 차단 사유

1. 작업 공간·README·배포 설정·환경 변수 이름·설치 CLI를 조사했으나 접근 가능한 지속 실행 Node 서버, 영구 디스크, 실제 HTTPS origin 또는 해당 호스팅 인증이 발견되지 않았습니다. `ssh.exe`만 존재하며 Docker/Render/Railway/Fly/Heroku CLI와 SSH 대상 설정은 확인되지 않았습니다. 이는 사용자가 서버를 보유하지 않는다는 단정이 아닙니다.
2. 현재 그래픽에는 원작 및 첨부 모드의 파생 이미지가 포함됩니다. 교육용 비공개 사용 범위를 넘어 공개 웹서버나 공개 저장소로 배포하는 권한은 확인되지 않았고, 사용자는 재배포하지 않는다고 지정했습니다. `scripts/check-public-assets.mjs`는 문서화된 공개 배포 권한이 없는 자산을 차단합니다. 로컬 플레이를 차단하는 검사는 아닙니다.

공개 배포에 필요한 것은 **권한 있는 Node 24 호스트·영구 저장소·실제 TLS 도메인/제공자 origin**, 운영 접근 코드, 그리고 공개 배포가 가능한 자산 세트입니다. 신규 서비스 결제·계정·도메인 구매는 수행하지 않았습니다. GitHub Pages·localhost·사설 IP·임시 미리보기를 공개 플레이 URL로 제출하지 않습니다.

## 로컬 실행

```sh
npm ci
npm run build
npm start
```

Node 24가 필요합니다. 기본 주소는 `http://127.0.0.1:3000`, 기본 새 DB는 `data/class-clash-0.2.sqlite`입니다. 이전 DB는 삭제하거나 덮어쓰지 않습니다. `.env`를 자동으로 읽지 않으므로 환경은 실행 셸 또는 컨테이너에 명시적으로 전달합니다. 로컬에서 교사 접근 코드를 설정하면 로컬에도 방 생성 인증이 적용됩니다.

## 운영 설정

| 변수 | 의미 |
|---|---|
| `NODE_ENV=production` | 보안 필수 설정 검사, 시험 배속 1 고정, Vite 개발 미들웨어 금지 |
| `APP_ORIGIN` | 실제 `https://` origin. 경로·끝 슬래시·계정정보 없이 지정 |
| `HOST_ACCESS_CODE_FILE` | 최소 16자 교사 방 생성 접근 코드를 담은 secret 파일. 환경 `HOST_ACCESS_CODE`도 지원 |
| `DATABASE_PATH` | 영구 마운트의 SQLite 파일 절대 경로 |
| `HOST=0.0.0.0`, `PORT` | 컨테이너 내부 바인딩. 직접 외부 공개 대신 TLS 프록시 사용 |
| `MAX_ACTIVE_ROOMS=1` | 기본 운영 상한. 여러 학급 지원은 아직 보증하지 않음 |
| `ROOM_EXPIRY_HOURS=24` | 연결이 없고 종료/취소/로비인 방만 정리. 진행 중 방은 삭제하지 않음 |
| `DRAIN_FILE` | 존재하는 동안 새 방 생성 차단. 기존 수업·재접속은 유지 |

Origin은 `APP_ORIGIN`과 정확히 비교합니다. 임의 Host나 `X-Forwarded-*`를 공개 origin·권한 판정에 사용하지 않습니다. 프록시는 외부 TLS를 종료하고 `/ws`를 같은 앱으로 전달합니다. 방 생성은 교사 코드와 요청 ID를 사용하고, 참가·전투 명령은 각 학생 세션으로 인증합니다. 방 코드만으로 호스트 권한을 얻을 수 없습니다. 학생 30명이 같은 NAT 주소를 사용해도 참가할 수 있도록 생성/참가 예산을 분리하고 전투 명령 제한은 소켓별로 적용합니다.

## 배포 파일과 실행 순서

`Dockerfile`은 Node `24.19.0-bookworm-slim`, lockfile 기반 `npm ci`, 빌드/실행 의존성 분리, 비특권 `node` 사용자를 사용합니다. `deploy/compose.yaml`은 앱 영구 볼륨 하나, Caddy 인증서 볼륨, 재시작 정책, 로그 회전 및 1개 권위 인스턴스를 정의합니다. Caddy는 [공식 reverse_proxy WebSocket 지원](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)에 따라 같은 origin의 HTTPS/WSS를 연결합니다. **현재 PC에는 Docker가 없어 이미지 빌드·Compose·TLS 발급은 미실행**입니다.

권한·자산 문제가 해결된 운영 환경에서만 다음 순서로 진행합니다.

1. `deploy/production.env.example`을 참고해 실제 설정과 별도 secret 파일을 준비합니다. 실제 코드는 저장소에 넣지 않습니다.
2. 검증된 커밋에서 `npm ci`, 타입·자동·브라우저 검사와 빌드를 수행합니다. `node scripts/write-build-info.mjs`가 실행 커밋과 자산 manifest SHA-256을 `dist/build-info.json`에 기록합니다.
3. `node deploy/public-release-check.mjs`로 실제 origin·검증 커밋·공개 자산 허가를 확인합니다. 임의 환경 플래그로 허가 검사를 우회하지 않습니다.
4. 실제 서버에서 `docker compose --env-file 운영설정파일 -f deploy/compose.yaml build` 및 `up -d`를 실행합니다. `PUBLIC_HOST` DNS가 이 서버를 가리키고 80/443이 접근 가능해야 합니다. 구성 파일만으로 배포 성공이나 인증서 발급을 주장하지 않습니다.
5. 외부 네트워크에서 `/api/health`의 `commitSha`, `assetManifestHash`, `buildAssetMatch`, `protocolVersion`을 비교합니다. 호스트 방 생성, 별도 학생의 WSS·퀴즈·출진·재접속·넥서스 파괴·시상·재경기를 실제로 실행합니다.

`.github/workflows/validate.yml`은 설치·타입·빌드·회귀·브라우저 검사를 정의합니다. 공개 권한이 없는 자산은 CI 결과물로 업로드하지 않습니다. 자산이 없는 코드 전용 저장소에서는 해당 자산을 요구하는 빌드가 성공한 것처럼 처리하지 않습니다. CI에서 검증된 SHA와 실제 배포 SHA를 별도로 기록해야 합니다.

## 내구성·백업·복원

정답·구매·성장·출정 성공 ACK는 SQLite WAL `synchronous=FULL` 트랜잭션 이후에만 보냅니다. 동시에 도착한 같은 방의 명령은 수신 순서대로 적용하고 하나의 트랜잭션으로 묶어 저장합니다. 각 요청 결과와 중간 경제 원장 revision을 모두 보존하며, 저장 실패 시 새 변경과 성공 응답을 전부 취소합니다. 앞서 이미 저장된 요청의 재전송 결과는 유지합니다. 전투 체크포인트는 기존 1초 주기이며, 서버 중단 시간만큼 전투를 추가 진행하지 않습니다. 정상 SIGTERM에서는 최종 체크포인트와 WAL checkpoint 후 연결을 닫습니다. 강제 종료는 최근 확정한 거래와 마지막 전투 체크포인트의 차이를 구분해야 합니다.

```sh
node scripts/backup-database.mjs /data/class-clash.sqlite /data/backups/backup-YYYYMMDD-HHMM.sqlite
```

스크립트는 [SQLite 온라인 백업](https://www.sqlite.org/backup.html)을 사용하는 Node `backup()`으로 WAL을 포함한 일관된 사본을 만들고 `PRAGMA integrity_check`를 실행합니다. 기존 백업 파일을 덮어쓰지 않습니다. 백업에는 학생 학습 기록과 세션 secret이 있으므로 공개하거나 Git에 추가하지 않습니다.

복원은 서버를 중지한 뒤 **기존 DB와 WAL/SHM을 보존**하고, 새 경로의 백업 사본을 `DATABASE_PATH`로 지정해 같은 규칙·밸런스 버전의 앱을 시작합니다. `/api/health`와 격리된 시험 방 세션 복원을 확인한 다음 운영 origin을 전환합니다. 진행 중 경기 버전이 다르면 서버는 복원을 거절하고 원본을 보존합니다. 버전 검사를 없애거나 구 DB를 삭제해 오류를 숨기지 않습니다.

## 수업 중 업데이트·롤백

1. `DRAIN_FILE`을 생성해 새 방을 차단합니다. 이미 진행 중인 수업은 종료될 때까지 기다립니다.
2. 호스트에게 업데이트를 알리고, 정상 종료·온라인 백업 후 검증된 새 이미지를 적용합니다.
3. health SHA·자산 해시·기존 학생 재접속을 확인하고 drain 파일을 제거합니다.
4. 롤백 시 이전 이미지와 **그 버전에 맞는 보존 DB**를 함께 사용합니다. SQLite 단일 볼륨에서 무중단 배포를 보장하지 않습니다.

최신 실제 결과는 `DEPLOYMENT_REPORT.json`과 `artifacts/v02/`에 기록합니다. 공개 URL·외부 학교 기기 확인은 현재 미실행입니다.
