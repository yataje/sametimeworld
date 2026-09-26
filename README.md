# SameTimeWorld 0.4.0

같은 시기의 세계 사건을 비교하는 사건 전용 시간축입니다.

## 사용

- `Start_Dev_Server.cmd`: 로컬 화면 실행. 출력된 주소를 브라우저에서 엽니다.
- `Build_Web.cmd`: 검색 테스트와 배포용 빌드.
- `Publish_GitHub.cmd`: 테스트 → 빌드 → 웹 소스 커밋 → GitHub 업로드. 게시 완료는 GitHub Actions에서 확인합니다.
- DB 업로드: `C:\SameTimeWorldTools\SameTimeWorld_FirebaseUpdater.exe`.

## 파일

- `index.html`: 화면 골격
- `src/main.js`: 시간축, 검색, 사건 상세
- `src/style.css`: 화면 스타일
- `src/assets/world-map.png`: 기존 지도 이미지. HTML과 분리하여 캐시합니다.
- `tests/`: 검색 회귀 검사
- `scripts/publish.ps1`: 오류 시 중단하는 게시 절차
- `archive/`: 이전 페이지, 이전 개발 소스, ZIP 및 변경 전 전체 백업. 게시 제외.
- `dist/`: 빌드 결과. 자동 생성.

사건 데이터는 기존 Firebase `/events`에서 읽습니다. `/leaders`는 읽거나 변경하지 않습니다. 설명의 출처 파일명·등록 문구는 검색하지 않습니다. 제목·대상 우선으로 정렬하며 장소와 실제 설명도 검색합니다. 검색 결과에는 최대 100건을 표시하고 총건수를 안내합니다.

사건 클릭은 상세 내용을 표시합니다. Google 검색은 상세 화면의 외부 링크로 제공합니다. 화면 설정은 사건 글자 크기와 지도 투명도로 줄였습니다. 검색 입력과 문서의 맞춤법 빨간줄은 끕니다.

## 개발

Node.js와 npm이 필요합니다. `npm ci`, `npm test`, `npm run build`.
Firebase JS SDK는 사용하지 않으며 기존 REST 조회를 사용합니다. 인증 규칙은 변경하지 않았습니다.

2026-09-26 정리 시 사건 3,378건을 유지했습니다. 연구 이력은 Tools의 archive에 보관합니다. 이 버전은 역사적 사실을 새로 검증하거나 수정한 버전이 아닙니다.
