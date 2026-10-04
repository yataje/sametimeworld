# SameTimeWorld · v0.5.2

같은 시간의 세계 사건과 국가별 지도자를 비교하는 역사 탐색기입니다.

## Release
- Page: v0.5.2
- DB: v19
- Events: 10,101
- Leader tenures: 6,338
- Timeline data: 1610까지 확장

## Public data transport
브라우저는 공개 저장소의 Base64 텍스트 조각을 순서대로 읽어 원래 암호화 바이트를 복원한 뒤 SHA-256과 AES-256-GCM 검증을 수행합니다.
원본 SQLite DB는 공개 저장소에 포함하지 않습니다.

큰 개발 소스 변경분은 source-pack의 gzip+Base64 캡슐로 보관하며, 테스트/빌드 직전에 scripts/restore-source.mjs가 SHA-256을 확인한 뒤 복원합니다.

## Build
`npm test`
`npm run build`

GitHub Actions가 테스트와 빌드를 수행한 뒤 GitHub Pages에 배포합니다.
