# 공개 소스 범위

이 브랜치는 Class Clash0.2의 코드·규칙·시험·배포 구성을 공개합니다. 사용자가 지정한 최신 LOL 맵·챔피언·건물·미니언 원본 및 캡처는 학교 교육용 비배포 조건에 따라 포함하지 않습니다. 해당 자산이 있는 로컬 리워크 커밋 이력을 push하지 않고 원격main d060b53에서 만든 별도 브랜치입니다.

## 전체 게임을 로컬에서 실행

사용자 본인의 전체 로컬 프로젝트 ZIP을 별도 폴더에 풀고, 이 공개 소스 폴더에서 실행합니다.

```sh
node scripts/import-local-assets.mjs "승인된-전체-로컬-프로젝트-경로"
npm ci
npm run build
npm start
```

원본잠금 해시가 전부 맞는 경우에만 복사합니다. 기존에 다른 파일이 있으면 .local-asset-backups에 보존합니다. 공개 소스만으로 전체 아트 빌드를 통과했다고 주장하지 않습니다. test:source와CI는 아트가 필요한 시험을 명시적으로 제외하며, 전체본의 실행 결과는 TEST_REPORT.md에 있습니다.

공개 게임 서버는 아직배포되지 않았습니다. DEPLOYMENT_REPORT.json의 실제상태와null URL을 확인하세요.
