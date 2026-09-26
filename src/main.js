import './style.css';
import { get, ref } from 'firebase/database';
import { database } from './firebase.js';

const REGION_ORDER = [
  '유럽/아프리카',
  '중동',
  '동아시아/오세아니아',
  '아메리카',
];

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <h1>The World at the Same Time</h1>
      <p>같은 날짜, 세계에서는 무슨 일이 있었나</p>
    </div>
    <div class="connection" id="connection">Firebase 연결 확인 중…</div>
  </header>

  <main>
    <section class="controls panel">
      <label>
        날짜
        <input id="dateInput" type="date" min="1830-01-01" max="1960-12-31" value="1900-01-01" />
      </label>
      <button id="showDate" type="button">이 날짜 보기</button>
      <button id="showAll" class="secondary" type="button">전체 사건 보기</button>
    </section>

    <section class="summary-grid">
      <article class="panel stat"><span>사건</span><strong id="eventCount">-</strong></article>
      <article class="panel stat"><span>지도자 재임기록</span><strong id="leaderCount">-</strong></article>
      <article class="panel stat"><span>현재 표시</span><strong id="visibleCount">-</strong></article>
    </section>

    <section class="panel content-panel">
      <div class="section-title-row">
        <div>
          <h2 id="resultTitle">1900-01-01</h2>
          <p id="resultSubtitle">데이터를 불러오는 중입니다.</p>
        </div>
      </div>
      <div id="events" class="region-grid"></div>
    </section>
  </main>
`;

const connection = document.querySelector('#connection');
const eventCount = document.querySelector('#eventCount');
const leaderCount = document.querySelector('#leaderCount');
const visibleCount = document.querySelector('#visibleCount');
const dateInput = document.querySelector('#dateInput');
const resultTitle = document.querySelector('#resultTitle');
const resultSubtitle = document.querySelector('#resultSubtitle');
const eventsRoot = document.querySelector('#events');

let events = [];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function regionSort(a, b) {
  const ai = REGION_ORDER.indexOf(a.region);
  const bi = REGION_ORDER.indexOf(b.region);
  if (ai !== bi) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  if ((b.importance ?? 0) !== (a.importance ?? 0)) return (b.importance ?? 0) - (a.importance ?? 0);
  return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'ko');
}

function eventCard(item) {
  const importance = Number(item.importance ?? 0);
  return `
    <article class="event-card">
      <div class="event-meta">
        <span>${escapeHtml(item.country || '국가 미상')}</span>
        <span>${escapeHtml(item.category || '분류 없음')}</span>
        <span>중요도 ${Number.isFinite(importance) ? importance : '-'}</span>
      </div>
      <h3>${escapeHtml(item.title || '제목 없음')}</h3>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
    </article>
  `;
}

function render(list, title, subtitle) {
  const sorted = [...list].sort(regionSort);
  visibleCount.textContent = sorted.length.toLocaleString('ko-KR');
  resultTitle.textContent = title;
  resultSubtitle.textContent = subtitle;

  if (!sorted.length) {
    eventsRoot.innerHTML = '<div class="empty">해당 조건의 사건이 없습니다.</div>';
    return;
  }

  const grouped = new Map();
  for (const item of sorted) {
    const region = item.region || '지역 미상';
    if (!grouped.has(region)) grouped.set(region, []);
    grouped.get(region).push(item);
  }

  const regions = [...REGION_ORDER, ...[...grouped.keys()].filter((x) => !REGION_ORDER.includes(x))];
  eventsRoot.innerHTML = regions
    .filter((region) => grouped.has(region))
    .map((region) => `
      <section class="region-column">
        <h3>${escapeHtml(region)} <small>${grouped.get(region).length}</small></h3>
        <div class="event-list">${grouped.get(region).map(eventCard).join('')}</div>
      </section>
    `)
    .join('');
}

function showDate() {
  const date = dateInput.value;
  const list = events.filter((item) => item.date === date);
  render(list, date || '날짜 미선택', `${date || '선택한 날짜'}의 사건을 지역별로 표시합니다.`);
}

document.querySelector('#showDate').addEventListener('click', showDate);
document.querySelector('#showAll').addEventListener('click', () => {
  render(events, '전체 사건', 'Firebase에 저장된 사건 전체를 날짜와 중요도 기준으로 확인하는 개발용 보기입니다.');
});
dateInput.addEventListener('change', showDate);

async function boot() {
  try {
    const [metaSnap, eventsSnap] = await Promise.all([
      get(ref(database, 'meta')),
      get(ref(database, 'events')),
    ]);

    const meta = metaSnap.val() || {};
    const raw = eventsSnap.val() || {};
    events = Object.values(raw).filter(Boolean);

    eventCount.textContent = Number(meta.event_count ?? events.length).toLocaleString('ko-KR');
    leaderCount.textContent = Number(meta.leader_tenure_count ?? 0).toLocaleString('ko-KR');
    connection.textContent = 'Firebase 연결됨';
    connection.dataset.state = 'ok';

    showDate();
  } catch (error) {
    console.error(error);
    connection.textContent = 'Firebase 연결 실패';
    connection.dataset.state = 'error';
    resultSubtitle.textContent = 'Realtime Database 규칙과 인터넷 연결을 확인하세요.';
    eventsRoot.innerHTML = `<div class="empty error">${escapeHtml(error?.message || error)}</div>`;
  }
}

boot();
