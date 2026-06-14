// ── Firebase 설정 ──
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAEqBSiNTrNLFbwYU8ASN8m88S1Ho-RlwU",
  authDomain: "booklog-2b5d0.firebaseapp.com",
  projectId: "booklog-2b5d0",
  storageBucket: "booklog-2b5d0.firebasestorage.app",
  messagingSenderId: "188307139074",
  appId: "1:188307139074:web:9c52728d1232db35f9551b",
  databaseURL: "https://booklog-2b5d0-default-rtdb.asia-southeast1.firebasedatabase.app"
};
firebase.initializeApp(FIREBASE_CONFIG);
const booksRef = firebase.database().ref('bookshelf_v1');

// ── 스토리지 ──
const STORAGE_KEY = 'bookshelf_v1';

function loadBooksLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveLocal(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
function saveBooks(arr) {
  saveLocal(arr);
  booksRef.set(JSON.stringify(arr));
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 완독 처리 — status가 done이 되는 순간 completedAt 기록
function markDoneIfNeeded(book) {
  if (book.status === 'done' && !book.completedAt) {
    book.completedAt = new Date().toISOString();
  }
  if (book.status !== 'done') {
    book.completedAt = null;
  }
}

// ── 상태 ──
let books = loadBooksLocal();
let currentSearch = '';
let activeBookId = null;

// ── DOM ──
const bookList    = document.getElementById('bookList');
const emptyState  = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

const addModal    = document.getElementById('addModal');
const detailModal = document.getElementById('detailModal');
const editModal   = document.getElementById('editModal');

function openModal(m)  { m.classList.remove('hidden'); }
function closeModal(m) { m.classList.add('hidden'); }

[addModal, detailModal, editModal].forEach(m =>
  m.addEventListener('click', e => { if (e.target === m) closeModal(m); })
);

document.getElementById('openAddModal').addEventListener('click', () => openModal(addModal));
document.getElementById('closeDetailModal').addEventListener('click', () => {
  closeModal(detailModal);
  document.getElementById('lookupResult').classList.add('hidden');
  document.getElementById('lookupBtn').textContent = '↗ 검색';
});
document.getElementById('closeEditModal').addEventListener('click',  () => closeModal(editModal));
document.getElementById('closeEditModal2').addEventListener('click', () => closeModal(editModal));

searchInput.addEventListener('input', () => {
  currentSearch = searchInput.value.trim().toLowerCase();
  renderList();
});

// ── 책 추가 ──
document.getElementById('addBookForm').addEventListener('submit', e => {
  e.preventDefault();
  const book = {
    id:          generateId(),
    title:       document.getElementById('inputTitle').value.trim(),
    author:      document.getElementById('inputAuthor').value.trim(),
    publisher:   document.getElementById('inputPublisher').value.trim(),
    totalPages:  parseInt(document.getElementById('inputPages').value) || 0,
    currentPage: parseInt(document.getElementById('inputCurrentPage').value) || 0,
    status:      document.getElementById('inputStatus').value,
    note:        document.getElementById('inputNote').value.trim(),
    completedAt: null,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
  markDoneIfNeeded(book);
  books.unshift(book);
  saveBooks(books);
  document.getElementById('addBookForm').reset();
  closeModal(addModal);
  renderList();
});

// ── 렌더링 ──
const SECTIONS = [
  { status: 'reading', label: 'reading' },
  { status: 'wish',    label: 'to read' },
  { status: 'done',    label: 'done' },
];

function renderList() {
  bookList.innerHTML = '';
  let total = 0;

  SECTIONS.forEach(({ status, label }) => {
    const filtered = books.filter(b => {
      const matchStatus = b.status === status;
      const matchSearch = !currentSearch ||
        b.title.toLowerCase().includes(currentSearch) ||
        b.author.toLowerCase().includes(currentSearch);
      return matchStatus && matchSearch;
    });
    if (filtered.length === 0) return;
    total += filtered.length;

    const section = document.createElement('section');
    section.className = 'book-section';

    const hdr = document.createElement('div');
    hdr.className = 'section-label';
    hdr.textContent = label;
    section.appendChild(hdr);

    filtered.forEach(book => section.appendChild(createRow(book)));
    bookList.appendChild(section);
  });

  emptyState.classList.toggle('hidden', total > 0);
}

function createRow(book) {
  const pct = book.totalPages > 0
    ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
    : (book.status === 'done' ? 100 : 0);

  const row = document.createElement('div');
  row.className = 'book-row';

  // ── 거북이 트랙 ──
  const barRow = document.createElement('div');
  barRow.className = 'bar-row';

  const trackWrap = document.createElement('div');
  trackWrap.className = 'turtle-track-wrap';

  // 바닥 선
  const trackLine = document.createElement('div');
  trackLine.className = 'turtle-track-line';
  trackWrap.appendChild(trackLine);

  // 발자국: 22px 타일을 끊김 없이 반복, 거북이 직전까지
  if (pct > 0) {
    const fillEl = document.createElement('div');
    fillEl.style.position         = 'absolute';
    fillEl.style.left             = '0';
    fillEl.style.bottom           = '0';
    fillEl.style.width            = `calc(${pct}% - ${(pct * 0.16).toFixed(1)}px)`;
    fillEl.style.height           = '6px';
    fillEl.style.backgroundImage  = `url(${getFootprintBg()})`;
    fillEl.style.backgroundRepeat = 'repeat-x';
    fillEl.style.backgroundSize   = '36px 6px';
    fillEl.style.backgroundPosition = 'left bottom';
    fillEl.style.imageRendering   = 'pixelated';
    trackWrap.appendChild(fillEl);
  }

  // 거북이
  const turtleEl = makePxGrid(isStale(book) ? TURTLE_PIXELS_FLIPPED : TURTLE_PIXELS, 0.2);
  turtleEl.style.position  = 'absolute';
  turtleEl.style.left      = pct + '%';
  turtleEl.style.bottom    = '0';
  turtleEl.style.transform = `translateX(-${pct}%)`;
  trackWrap.appendChild(turtleEl);

  const pctEl = document.createElement('span');
  pctEl.className   = 'bar-pct';
  pctEl.textContent = pct + '%';

  barRow.appendChild(trackWrap);
  barRow.appendChild(pctEl);
  row.appendChild(barRow);

  const nameEl = document.createElement('div');
  nameEl.className   = 'book-name';
  nameEl.textContent = book.title;
  row.appendChild(nameEl);

  if (book.status !== 'wish' && book.createdAt) {
    const dateEl = document.createElement('div');
    dateEl.className = 'book-completed';
    dateEl.textContent = book.completedAt
      ? `${fmtDate(book.createdAt)} ~ ${fmtDate(book.completedAt)}`
      : fmtDate(book.createdAt);
    row.appendChild(dateEl);
  }

  row.addEventListener('click', () => openDetail(book.id));
  return row;
}

// ── 상세 모달 ──
function openDetail(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  activeBookId = id;

  document.getElementById('detailTitle').textContent  = book.title;
  document.getElementById('detailAuthor').textContent = book.author || '저자 미입력';

  const pct = book.totalPages > 0
    ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
    : (book.status === 'done' ? 100 : 0);

  document.getElementById('progressText').textContent = `${book.currentPage} / ${book.totalPages || '?'} 페이지`;
  document.getElementById('progressPct').textContent  = `${pct}%`;
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('currentPageInput').value   = book.currentPage || '';
  document.getElementById('currentPageInput').max     = book.totalPages || '';

  const dateEl = document.getElementById('completedDate');
  if (book.completedAt) {
    dateEl.textContent = `완독일 · ${fmtDate(book.completedAt)}`;
    dateEl.classList.remove('hidden');
  } else {
    dateEl.classList.add('hidden');
  }

  openModal(detailModal);
}

// 진행률 업데이트
document.getElementById('updateProgressBtn').addEventListener('click', () => {
  const book = books.find(b => b.id === activeBookId);
  if (!book) return;
  const val = parseInt(document.getElementById('currentPageInput').value);
  if (isNaN(val) || val < 0) return;
  book.currentPage = val;
  book.updatedAt = new Date().toISOString();
  if (book.totalPages > 0 && val >= book.totalPages) {
    book.status = 'done';
  }
  markDoneIfNeeded(book);
  saveBooks(books);
  openDetail(activeBookId);
  renderList();
});

// 삭제
document.getElementById('deleteBookBtn').addEventListener('click', () => {
  const book = books.find(b => b.id === activeBookId);
  if (!book || !confirm(`"${book.title}" 을 삭제할까요?`)) return;
  books = books.filter(b => b.id !== activeBookId);
  saveBooks(books);
  closeModal(detailModal);
  renderList();
});

// 편집 열기
document.getElementById('editBookBtn').addEventListener('click', () => {
  const book = books.find(b => b.id === activeBookId);
  if (!book) return;
  document.getElementById('editId').value        = book.id;
  document.getElementById('editTitle').value     = book.title;
  document.getElementById('editAuthor').value    = book.author;
  document.getElementById('editPublisher').value = book.publisher || '';
  document.getElementById('editPages').value     = book.totalPages || '';
  document.getElementById('editStatus').value = book.status;
  document.getElementById('editNote').value   = book.note;
  closeModal(detailModal);
  openModal(editModal);
});

// 편집 저장
document.getElementById('editBookForm').addEventListener('submit', e => {
  e.preventDefault();
  const book = books.find(b => b.id === document.getElementById('editId').value);
  if (!book) return;
  book.title      = document.getElementById('editTitle').value.trim();
  book.author     = document.getElementById('editAuthor').value.trim();
  book.publisher  = document.getElementById('editPublisher').value.trim();
  book.totalPages = parseInt(document.getElementById('editPages').value) || 0;
  book.status     = document.getElementById('editStatus').value;
  book.note       = document.getElementById('editNote').value.trim();
  markDoneIfNeeded(book);
  saveBooks(books);
  closeModal(editModal);
  renderList();
});

// ── 픽셀 아트 ──
const STALE_DAYS = 7;
function isStale(book) {
  if (book.status !== 'reading') return false;
  const last = book.updatedAt || book.createdAt;
  if (!last) return false;
  return (Date.now() - new Date(last).getTime()) / 86400000 > STALE_DAYS;
}

const TURTLE_FACE_PIXELS = [
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', 'K', 'K', 'K', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', 'K', '_', '_', '_', 'K', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', '_', '_', '_', '_', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', 'K', '_', 'K', '_', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', '_', '_', '_', '_', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', 'K', 'K', 'K', '_', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', '_', '_', '_', '_', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', '_', 'K', '_', '_', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', 'K', '_', '_', '_', 'K', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', 'K', '_', '_', '_', 'K', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
];

const TURTLE_PIXELS_FLIPPED = [
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', 'K', 'K', 'K', 'K', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', 'K', '_', 'K', 'K', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', 'K', '_', 'K', '_', '_', '_', 'K', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', 'K', '_', 'K', '_', 'K', '_', 'K', '_', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', 'K', 'K', '_', '_', '_', 'K', '_', 'K', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', 'K', '_', 'K', '_', 'K', '_', '_', '_', 'K', 'K', '_', '_', '_', '_'],
  ['_', 'K', '_', 'K', '_', 'K', '_', 'K', '_', 'K', '_', '_', 'K', '_', '_', '_'],
  ['_', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', 'K', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
];

const TURTLE_PIXELS = [
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', 'K', 'K', 'K', '_', '_'],
  ['_', '_', '_', '_', '_', 'K', 'K', 'K', '_', '_', 'K', '_', '_', '_', 'K', '_'],
  ['_', '_', '_', '_', 'K', '_', 'K', '_', 'K', '_', 'K', '_', 'K', '_', 'K', '_'],
  ['_', '_', '_', 'K', '_', 'K', '_', '_', '_', 'K', '_', '_', '_', '_', 'K', '_'],
  ['_', '_', 'K', '_', 'K', '_', 'K', '_', 'K', '_', 'K', '_', '_', 'K', 'K', '_'],
  ['_', '_', 'K', 'K', '_', '_', '_', 'K', '_', 'K', '_', 'K', 'K', 'K', '_', '_'],
  ['_', '_', 'K', '_', 'K', '_', 'K', '_', '_', '_', 'K', 'K', '_', '_', '_', '_'],
  ['_', '_', 'K', 'K', '_', 'K', '_', 'K', '_', 'K', '_', 'K', 'K', '_', '_', '_'],
  ['_', '_', 'K', '_', 'K', '_', 'K', 'K', 'K', '_', 'K', '_', 'K', '_', '_', '_'],
  ['_', 'K', '_', '_', '_', '_', 'K', '_', 'K', '_', '_', '_', '_', 'K', '_', '_'],
  ['_', '_', 'K', 'K', 'K', 'K', '_', '_', '_', 'K', 'K', 'K', 'K', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
];

const FOOTPRINT_PIXELS = [
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','K','K','_','_','_','_','K','K','_','_','_'],
  ['_','_','K','K','_','_','_','_','K','K','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
  ['_','_','_','_','_','_','_','_','_','_','_','_','_','_','_','_'],
];

// ... 점 3개 타일 (간격 넓게)
let _fpBg = null;
function getFootprintBg() {
  if (_fpBg) return _fpBg;
  const W = 36, H = 6, D = 2; // 타일 너비 36px, 점 크기 2×2
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111111';
  [6, 18, 30].forEach(x => ctx.fillRect(x, 2, D, D));
  _fpBg = canvas.toDataURL();
  return _fpBg;
}

function makePxGrid(pixels, zoom) {
  const cols = pixels[0].length;
  const rows = pixels.length;
  const el = document.createElement('div');
  el.style.display = 'grid';
  el.style.gridTemplateColumns = `repeat(${cols}, 5px)`;
  el.style.gridTemplateRows    = `repeat(${rows}, 5px)`;
  el.style.zoom = zoom;
  el.style.imageRendering = 'pixelated';
  el.style.gap = '0';
  el.style.flexShrink = '0';
  pixels.forEach(row => row.forEach(c => {
    const px = document.createElement('div');
    px.style.width  = '5px';
    px.style.height = '5px';
    if (c === 'K') px.style.background = '#111';
    el.appendChild(px);
  }));
  return el;
}

// ── 헬퍼 ──
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

// ── 알라딘 검색 (CORS 프록시 순차 시도) ──
const ALADIN_TTB = 'ttbwotjacui1421001';

async function googleSearch(query, size = 5) {
  const apiUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx` +
    `?TTBKey=${ALADIN_TTB}&Query=${encodeURIComponent(query)}` +
    `&QueryType=Title&MaxResults=${size}&SearchTarget=Book&output=js&Version=20131101`;

  const proxies = [
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];

  let books;
  for (const makeUrl of proxies) {
    try {
      const res = await fetch(makeUrl(apiUrl));
      if (!res.ok) continue;
      books = await res.json();
      if (books) break;
    } catch {}
  }
  if (!books) throw new Error('검색 서비스 연결 실패');
  return (books.item || []).map(item => ({
    title:     item.title || '',
    authors:   [item.author || ''],
    publisher: item.publisher || '',
    pages:     item.itemPage || 0,
  }));
}

function fillForm(item) {
  document.getElementById('inputTitle').value     = item.title || '';
  document.getElementById('inputAuthor').value    = (item.authors || []).join(', ');
  document.getElementById('inputPublisher').value = item.publisher || '';
  document.getElementById('inputPages').value     = item.pages || '';
  document.getElementById('bookSearchResults').classList.add('hidden');
}

// 키 관련 UI 요소 — 숨김 처리
(function() {
  const row  = document.getElementById('ttbKeyRow');
  const edit = document.getElementById('ttbKeyEdit');
  if (row)  row.style.display  = 'none';
  if (edit) edit.style.display = 'none';
})();

const bookSearchBtn     = document.getElementById('bookSearchBtn');
const bookSearchInput   = document.getElementById('bookSearchInput');
const bookSearchResults = document.getElementById('bookSearchResults');

async function runBookSearch() {
  const query = bookSearchInput.value.trim();
  if (!query) return;

  if (!navigator.onLine) {
    bookSearchResults.innerHTML = '<li class="bsr-empty">오프라인 상태예요.</li>';
    bookSearchResults.classList.remove('hidden');
    return;
  }

  bookSearchBtn.textContent = '…';
  bookSearchBtn.disabled = true;

  try {
    const items = await googleSearch(query, 5);
    if (!items.length) {
      bookSearchResults.innerHTML = '<li class="bsr-empty">결과가 없어요.</li>';
    } else {
      bookSearchResults.innerHTML = '';
      items.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="bsr-title">${esc(item.title || '—')}</span>
          <span class="bsr-author">${esc((item.authors || []).join(', ') || '—')}</span>
        `;
        li.addEventListener('click', () => fillForm(item));
        bookSearchResults.appendChild(li);
      });
    }
    bookSearchResults.classList.remove('hidden');
  } catch(err) {
    bookSearchResults.innerHTML = `<li class="bsr-empty">오류: ${err.message}</li>`;
    bookSearchResults.classList.remove('hidden');
  } finally {
    bookSearchBtn.textContent = '검색';
    bookSearchBtn.disabled = false;
  }
}

bookSearchBtn.addEventListener('click', runBookSearch);
bookSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runBookSearch(); } });

function resetAddModal() {
  bookSearchInput.value = '';
  bookSearchResults.classList.add('hidden');
  bookSearchResults.innerHTML = '';
}
document.getElementById('closeAddModal').addEventListener('click',  () => { closeModal(addModal); resetAddModal(); });
document.getElementById('closeAddModal2').addEventListener('click', () => { closeModal(addModal); resetAddModal(); });

// ── 책 정보 검색 (Kakao Books API) ──
document.getElementById('lookupBtn').addEventListener('click', async () => {
  const book = books.find(b => b.id === activeBookId);
  if (!book) return;

  const resultEl = document.getElementById('lookupResult');
  const btn      = document.getElementById('lookupBtn');

  if (!navigator.onLine) {
    resultEl.innerHTML = '<div class="lr-item"><span class="lr-val" style="color:#999">오프라인 상태예요.</span></div>';
    resultEl.classList.remove('hidden');
    return;
  }

  btn.textContent = '...';
  btn.disabled = true;
  resultEl.classList.add('hidden');

  try {
    const items = await googleSearch(book.title, 3);

    if (!items.length) {
      resultEl.innerHTML = '<div class="lr-item"><span class="lr-val" style="color:#999">검색 결과가 없어요.</span></div>';
      resultEl.classList.remove('hidden');
      return;
    }

    resultEl.innerHTML = items.map((item, i) => {
      const authors = (item.authors || []).join(', ') || '—';
      const pub     = '';
      const date    = '';
      const pubLine = [pub, date].filter(Boolean).join(' · ');
      const sep     = i < items.length - 1 ? '<hr class="lr-sep">' : '';
      return `
        <div class="lr-item"><span class="lr-key">제목</span><span class="lr-val">${esc(item.title || '—')}</span></div>
        <div class="lr-item"><span class="lr-key">저자</span><span class="lr-val">${esc(authors)}</span></div>
        ${pubLine ? `<div class="lr-item"><span class="lr-key">출판</span><span class="lr-val">${esc(pubLine)}</span></div>` : ''}
        ${sep}
      `;
    }).join('');
    resultEl.classList.remove('hidden');
  } catch {
    resultEl.innerHTML = '<div class="lr-item"><span class="lr-val" style="color:#999">검색 중 오류가 발생했어요.</span></div>';
    resultEl.classList.remove('hidden');
  } finally {
    btn.textContent = '↗ 검색';
    btn.disabled = false;
  }
});

const NOTEPAD_PIXELS = [
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', 'K', 'K', 'K', 'K', 'K', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', '_', '_', '_', '_', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', 'K', 'K', '_', 'K', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', '_', '_', '_', '_', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', 'K', '_', 'K', 'K', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', '_', '_', '_', '_', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', 'K', 'K', 'K', '_', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', '_', '_', 'K', '_', '_', '_', '_', '_', '_', 'K', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', 'K', 'K', 'K', 'K', 'K', 'K', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
  ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'],
];

// ── 시작 ──
const _turtleFaceEl = document.getElementById('turtleFace');
if (_turtleFaceEl) _turtleFaceEl.appendChild(makePxGrid(TURTLE_FACE_PIXELS, 0.2));
const _notepadIconEl = document.getElementById('notepadIcon');
if (_notepadIconEl) _notepadIconEl.appendChild(makePxGrid(NOTEPAD_PIXELS, 0.2));

// Firebase 동기화
booksRef.on('value', snapshot => {
  const raw = snapshot.val();
  if (raw !== null) {
    // Firebase에 데이터 있음 → 로컬 덮어쓰기
    books = JSON.parse(raw);
    saveLocal(books);
  } else if (books.length) {
    // Firebase 비어있고 로컬에 데이터 있음 → Firebase로 마이그레이션
    booksRef.set(JSON.stringify(books));
    return;
  }
  renderList();
});
