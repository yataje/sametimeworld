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

## MeloTTS (0.24)
설정에서 Melo 음성의 합성 속도, 재생 속도와 음량을 조절할 수 있습니다. 사건 상세의 자동 TTS도 Melo를 사용합니다. 모델은 GitHub Pages에서 실행되지 않으므로 PC의 Melo 프로그램을 먼저 실행해야 합니다. 페이지가 열리면 해당 프로그램에 연결하여 모델을 미리 준비합니다. 브라우저가 로컬 네트워크 접근을 요청하면 사용자가 허용해야 연결됩니다. 연결되지 않으면 설정에서 안내를 표시하며 다른 음성 엔진으로 바꾸지 않습니다. 음성 모델 및 Python 환경은 웹사이트/Windows 뷰어 저장 EXE에 포함하지 않습니다.

### MeloTTS 다운로드 (0.25)
설정의 다운로드 버튼에서 Windows 64비트 CPU용 ZIP을 받을 수 있습니다. 한국어 모델과 전용 Python 실행환경이 포함되어 있습니다. 전체 압축을 푼 뒤 `실행.cmd`를 실행하고 공개 사이트를 새로고침하세요. 다운로드 용량과 압축 해제 후 용량은 실제 배포 파일에서 측정하여 설정에 표시합니다. CPU용 다운로드에는 NVIDIA GPU 가속이 포함되지 않습니다.
