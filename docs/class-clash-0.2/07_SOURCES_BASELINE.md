# 07. 조회 근거·출처·검증 경계

확인일: 2026-10-28, Asia/Seoul.

## 1. 직접 확인한 저장소 기준

연결된 GitHub 읽기 도구로 `YEOMT/Classclash`의 브랜치를 조회했다. 조회 시 노출된 브랜치는 main이고 HEAD는 `d060b535c49b63d219f851c431e0294e9dbcb157`이었다. **Codex 로컬 미커밋/미푸시 작업 공간을 본 것은 아니다.** 따라서 이 명세는 로컬 최신 아트 보존과 비교를 첫 단계로 요구한다.

다음은 실제 읽은 파일과 범위다. 파일 일부만 읽은 경우 전체 파일 분석이나 실제 실행 검증을 했다고 표시하지 않는다.

| 근거 | 파일/조회 | 확인 내용 |
|---|---|---|
| R1 | branches API | 원격 main HEAD |
| R2 | package.json 전체 | Node24, PixiJS, build의 build-sprites 호출, pretest build |
| R3 | README.md 전체 | 로컬 Node 실행·동일 origin WS·교실 LAN·공개 배포 필요·퀴즈/정비 규칙 |
| R4 | PROGRESS.md 전체 | 이전 실행 결과와 미완료/실패 보고, 공개 배포 미실행 기록 |
| R5 | src/shared/balance.ts 전체 | 사망20초·구조물HP·후반 미니언 공성 배율 override |
| R6 | docs/specification/balance.defaults.json 전체 | 사용자 규칙 기반 초기 설정·지도·경제·봇·검증 목표 |
| R7 | src/client/renderer.ts 1~65행 | 코드 생성 지형/미니언/구조물, 고정288프레임/64셀 로딩·초기화 |
| R8 | src/server/combat.ts 요청1~160행 중 도구에 표시된 범위 | 초기화·스폰·공성보호·표적 판단 등 기존 구현 존재 |
| R9 | src/shared/heroes.ts 요청1~110행 중 도구에 표시된 범위 | 스킬 타입·조건·타임라인·실제 정의 일부. 18/36 전체 개수는 README/진행보고와 교차 |

고정 커밋 링크:

- R1: https://api.github.com/repos/YEOMT/Classclash/branches
- R2: https://github.com/YEOMT/Classclash/blob/d060b535c49b63d219f851c431e0294e9dbcb157/package.json
- R3: https://github.com/YEOMT/Classclash/blob/d060b535c49b63d219f851c431e0294e9dbcb157/README.md
- R4: https://github.com/YEOMT/Classclash/blob/d060b535c49b63d219f851c431e0294e9dbcb157/PROGRESS.md
- R5: https://github.com/YEOMT/Classclash/blob/d060b535c49b63d219f851c431e0294e9dbcb157/src/shared/balance.ts
- R6: https://github.com/YEOMT/Classclash/blob/d060b535c49b63d219f851c431e0294e9dbcb157/docs/specification/balance.defaults.json
- R7: https://github.com/YEOMT/Classclash/blob/d060b535c49b63d219f851c431e0294e9dbcb157/src/client/renderer.ts
- R8: https://github.com/YEOMT/Classclash/blob/d060b535c49b63d219f851c431e0294e9dbcb157/src/server/combat.ts
- R9: https://github.com/YEOMT/Classclash/blob/d060b535c49b63d219f851c431e0294e9dbcb157/src/shared/heroes.ts

## 2. 외부 1차 자료

### S1. Teamfight Manager 2 공식 Steam 소개

https://store.steampowered.com/app/3009300/Teamfight_Manager_2/

MOBA형 경기·역할 조합·상대 본진 목표물 공략을 공식적으로 설명한다. 이 프로젝트는 원작의 지도와 5포지션을 그대로 복제하지 않고, 기존 2라인·30명 규칙에 맞춰 적용한다.

### S2. 개발사 공식 업데이트

https://steamcommunity.com/app/3009300/allnews/

열람한 0.5.4 설명에는 후퇴 경로·팀 전투 합류·본진 방어·길찾기 개선이 있다. 검색으로 확인한 공식 업데이트에는 포탑 주변 망설임·불필요한 추격 감소·보호 기술 판단 개선도 설명되어 있다. **공식 설명의 문제의식만 참고**했고, 본 명세의 상태기계·점수식·가중치·좌표는 원작에서 추출한 값이 아니다.

페이지의 검색 인덱스와 열람 시 캐시가 다른 업데이트 묶음을 보여줄 수 있으므로, 이번 문서는 특정 베타가 가장 최신이라고 단정하지 않는다. Codex는 구현 시 실제 열람한 공지/공식 이미지/영상 URL·날짜·관찰 내용을 기록한다. 원작 내부 데이터를 다운로드하거나 디컴파일하도록 요구하지 않는다.

### S3. GitHub Pages 공식 설명

https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

Pages는 정적 호스팅이다. 현재 Class Clash Node/WebSocket 서버를 정적 파일만으로 대체할 수 없다는 기술 구분의 근거다.

### S4. Render WebSocket / Web Service 문서

https://render.com/docs/websocket
https://render.com/docs/web-services

Node/WebSocket 공개 서비스의 가능한 배포 예시다. 인터넷 연결에는 WSS와 재접속 처리가 필요하다. 이 프로젝트의 배포 제공자를 확정하거나 서비스가 생성되었다는 뜻은 아니다.

### S5. Render 영구 디스크 문서

https://render.com/docs/disks

기본 파일시스템은 임시이고 영구 디스크는 유료 서비스에 연결된다. 영구 디스크가 연결된 서비스의 인스턴스/배포 제약을 확인해야 한다. 가격·플랜은 구현 시 다시 확인하고 승인받아야 한다.

### S6. Caddy 공식 HTTPS와 reverse proxy

https://caddyserver.com/docs/automatic-https
https://caddyserver.com/docs/caddyfile/directives/reverse_proxy

권한 있는 VPS에서 TLS·WebSocket을 제공하는 배포 선택지다. 실제 DNS·포트·저장 조건이 맞는지 검증해야 한다.

### S7. PixiJS 8 성능 지침

https://pixijs.com/8.x/guides/concepts/performance-tips

스프라이트시트·배칭·텍스트 갱신·Graphics/filter 비용을 참고했다. 구현 목표 FPS와 구체적 수락 한계는 본 명세의 제안이지 PixiJS가 보장하는 수치가 아니다.

### S8. SQLite 백업 API

https://www.sqlite.org/backup.html

실행 중 데이터베이스의 일관된 백업을 위한 근거다. 단순히 메인 파일만 복사하고 복원 시험 없이 안전하다고 보고하지 않는다.

## 3. 이번 작성 과정에서 하지 않은 일

게임 소스 변경, GitHub push/PR/merge, 실제 게임 빌드·브라우저 실행·30명 부하 시험, 아트 신규 제작, 호스팅 생성·결제·공개 배포는 수행하지 않았다. 이 패키지는 **개발 지시·계약·테스트 명세**다.

사용자의 로컬 최신 아트 파일이나 비공개 배포 환경은 조회하지 않았다. 공개 플레이 URL은 확인·생성하지 않았으므로 예시 URL을 제공하지 않는다.

공식 자료와 사용자가 제공한 시각 예시를 참고했지만, 원작 영상을 프레임별로 계측하거나 원본 sprite sheet를 분석한 것은 아니다. 본 명세의 해상도 비교 범위·프레임 수·AI 주기·성능 목표는 설계 제안으로 표시했다.

## 4. 원본 이미지·라이선스

패키지에는 상용 게임의 이미지·스프라이트·사운드를 복제해 넣지 않았다. 사용자가 제공한 이미지도 최종 게임 자산의 배포 권한을 자동으로 부여하는 것으로 취급하지 않는다.

재사용 자산은 자산명, 제작자, 원본 URL, 실제 license text, 수정/재배포 조건, 프로젝트에서의 사용 파일, 확인 날짜를 기록한다. 출처가 불명확한 이미지나 유료 에셋을 승인 없이 구매·배포하지 않는다. 자세한 법률 판단을 대신하는 문서는 아니며, 명확한 권한이 없는 원본을 최종 제품에 포함하지 않도록 하는 개발 정책이다.
