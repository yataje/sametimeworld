# v0.4.6 — Shared event map integration

Local review package: see `README_KO.txt`. Existing timeline/detail tabs and Firebase event/leader loaders are retained. `SameTimeWorld_v0.4.6_Local.html` is an offline snapshot preview only; `dist/` is the live-loader build. No deployment was performed.

---

# SameTimeWorld

같은 시기의 세계 사건과 국가별 지도자를 비교하는 시간축입니다.

## 실행과 업데이트

- `Start_Dev_Server.cmd`: 로컬 화면 실행
- `Build_Web.cmd`: 테스트와 배포용 빌드
- `Publish_GitHub.cmd`: 웹 검사 → 두 DB Firebase 업로드·검증 → 웹 GitHub 전송
- `C:\SameTimeWorldTools\SameTimeWorld_AutoPublisher.exe`: 전체 업데이트 또는 변경 감지 자동 업데이트 창

원본 DB는 `C:\SameTimeWorldTools\sametimeworld.db`, `C:\SameTimeWorldTools\world_leaders.db`입니다. 통합 프로그램은 두 DB를 읽기 전용으로 조회하여 Firebase `/events`, `/leaders`에 JSON으로 저장합니다. 기존 서버 데이터는 Tools의 backups에 보존하고 업로드 후 재조회로 비교합니다.

웹은 `https://sametimeworld-default-rtdb.asia-southeast1.firebasedatabase.app`의 `/events`, `/leaders`를 조회합니다. 지도자 JSON을 웹에 함께 넣는 방식은 사용하지 않습니다. DB만 갱신한 경우 페이지를 새로고침하면 반영됩니다. 웹 코드 변경은 GitHub Actions 배포 완료 후 반영됩니다.

## 구성

- `index.html`: 화면 골격
- `src/main.js`: Firebase 조회, 시간축, 검색, 사건 상세
- `src/leaders.js`: Firebase 지도자 자료 변환 및 화면 중앙 날짜에 맞는 국가별 지도자 표시
- `src/style.css`: 화면 스타일
- `src/assets/world-map.png`: 지도 이미지
- `tests/`: 검색 및 지도자 표시 검사
- `scripts/publish.ps1`: 검사·빌드·웹 커밋·GitHub 전송 (웹만 실행하는 내부 단계)
- `dist/`: 자동 생성되는 배포 결과
- `archive/`: 이전 자료, 게시 제외

대륙별 주요 국가에 최대 2명의 지도자를 표시합니다. 해당 날짜의 자료가 없으면 `—`를 표시합니다. 날짜 정밀도와 기존 이름 표기를 보존합니다. 역사 자료를 새로 검증하거나 수정한 것은 아닙니다.

검색은 출처 파일명과 등록 문구를 제외하고 제목·대상을 우선합니다. 결과 최대 100건과 총건수를 표시합니다. 검색 입력과 문서의 맞춤법 빨간줄은 끕니다.

날짜 검색 결과가 없으면 `[해당 날짜의 기록된 자료가 없음]`을 표시합니다. 검색 날짜(또는 월·연도 기간) 전후 1년 안의 사건을 중요도 내림차순, 같은 중요도에서는 가까운 날짜 순으로 각각 최대 5건 추천합니다. 추천은 검색 결과 건수와 구분되며 클릭하면 해당 사건으로 이동합니다. 월·연도만 알려진 사건은 기록된 기간 전체가 검색 기간 이전이나 이후임이 확실할 때만 추천합니다.

## 개발

Node.js와 npm을 사용합니다: `npm ci`, `npm test`, `npm run build`.
Firebase REST를 사용하며 인증 규칙은 변경하지 않았습니다. GitHub 빌드에는 로컬 DB나 Python이 필요하지 않습니다.

통합 프로그램의 자세한 사용법은 `C:\SameTimeWorldTools\README.md`에 있습니다.
