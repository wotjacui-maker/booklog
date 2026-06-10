'use strict';

const GEOJSON_URL = 'https://raw.githubusercontent.com/vuski/admdongkor/master/ver20230701/HangJeongDong_ver20230701.geojson';

const GU_EN = {
  '종로구': 'Jongno',    '중구':   'Jung',       '용산구': 'Yongsan',
  '성동구': 'Seongdong', '광진구': 'Gwangjin',   '동대문구': 'Dongdaemun',
  '중랑구': 'Jungnang',  '성북구': 'Seongbuk',   '강북구': 'Gangbuk',
  '도봉구': 'Dobong',    '노원구': 'Nowon',       '은평구': 'Eunpyeong',
  '서대문구': 'Seodaemun','마포구': 'Mapo',       '양천구': 'Yangcheon',
  '강서구': 'Gangseo',   '구로구': 'Guro',        '금천구': 'Geumcheon',
  '영등포구': 'Yeongdeungpo','동작구':'Dongjak',  '관악구': 'Gwanak',
  '서초구': 'Seocho',    '강남구': 'Gangnam',     '송파구': 'Songpa',
  '강동구': 'Gangdong',
};

const tooltipEl   = document.getElementById('tooltip');
const infoPanelEl = document.getElementById('info-panel');
const infoNameEl  = document.getElementById('info-name');
const infoGuEl    = document.getElementById('info-gu');

let selectedEl = null;

function getDongName(admNm) {
  if (!admNm) return '';
  const parts = admNm.trim().split(' ');
  return parts[parts.length - 1];
}

function getGuName(admNm) {
  if (!admNm) return '';
  const parts = admNm.trim().split(' ');
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

function getGuEn(guNm) {
  return GU_EN[guNm] || guNm;
}


fetch(GEOJSON_URL)
  .then(res => {
    if (!res.ok) throw new Error(`데이터 로드 실패 (HTTP ${res.status})`);
    return res.json();
  })
  .then(data => {
    const seoulFeatures = data.features.filter(f => {
      const code = String(f.properties.adm_cd || f.properties.adm_cd8 || '');
      return code.startsWith('11');
    });

    if (seoulFeatures.length === 0) throw new Error('서울 데이터를 찾을 수 없습니다.');

    seoulFeatures.forEach(f => {
      const code = String(f.properties.adm_cd || '');
      f.properties.gu_cd   = code.substring(0, 5);
      f.properties.dong_nm = getDongName(f.properties.adm_nm);
      f.properties.gu_nm   = getGuName(f.properties.adm_nm);
    });

    const seoulData = { type: 'FeatureCollection', features: seoulFeatures };

    document.getElementById('loading').classList.add('hidden');
    renderMap(seoulData);
  })
  .catch(err => {
    console.error(err);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('map-error').classList.remove('hidden');
    document.getElementById('error-msg').textContent = err.message;
  });

function renderMap(dongData) {
  const container = document.getElementById('map-container');
  const W = container.clientWidth  || window.innerWidth  || 1280;
  const H = container.clientHeight || window.innerHeight || 720;
  const PAD = 40;

  const svg = d3.select('#map')
    .attr('width', W)
    .attr('height', H);

  const projection = d3.geoMercator()
    .fitExtent([[PAD, PAD], [W - PAD, H - PAD]], dongData);

  const path = d3.geoPath().projection(projection);

  // ── Zoom & Pan ──
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.5, 120])
    .on('zoom', onZoom);

  svg.call(zoomBehavior);

  const g = svg.append('g');

  // ── Dong paths ──
  const dongs = g.selectAll('.dong')
    .data(dongData.features)
    .join('path')
    .attr('class', 'dong')
    .attr('d', path)
    .on('mouseover', onDongOver)
    .on('mousemove', onDongMove)
    .on('mouseout',  onDongOut)
    .on('click',     onDongClick);

  // ── Gu boundary: 공유 내부 에지 제거, 외곽선만 렌더링 ──
  // 같은 구 내 두 동이 공유하는 에지는 2회 등장 → 제거
  // 외곽 에지는 1회만 등장 → 남김
  const guMap = d3.group(dongData.features, d => d.properties.gu_cd);
  const guLayer = g.append('g').attr('class', 'gu-layer');

  guMap.forEach((features) => {
    const edgeCnt = new Map();

    const r6 = v => Math.round(v * 1e6) / 1e6;
    features.forEach(f => {
      const geom = f.geometry;
      if (!geom) return;
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      polys.forEach(poly =>
        poly.forEach(ring => {
          for (let i = 0; i < ring.length - 1; i++) {
            const ax = r6(ring[i][0]),  ay = r6(ring[i][1]);
            const bx = r6(ring[i+1][0]), by = r6(ring[i+1][1]);
            const key = (ax < bx || (ax === bx && ay <= by))
              ? `${ax},${ay}|${bx},${by}`
              : `${bx},${by}|${ax},${ay}`;
            edgeCnt.set(key, (edgeCnt.get(key) || 0) + 1);
          }
        })
      );
    });

    let d = '';
    edgeCnt.forEach((cnt, key) => {
      if (cnt !== 1) return;
      const [a, b] = key.split('|').map(s => s.split(',').map(Number));
      const [px1, py1] = projection(a);
      const [px2, py2] = projection(b);
      d += `M${px1},${py1}L${px2},${py2}`;
    });

    if (d) guLayer.append('path').attr('class', 'gu').attr('d', d);
  });

  function onZoom(event) {
    const t = event.transform;
    g.attr('transform', t);
    // t.k^0.75 감쇠: 줌인할수록 마커가 조금씩 커지되 압도적으로 크지 않음
    // 1x→11px, 4x→15px, 8x→18px, 16x→22px 시각 크기
    const sz = Math.max(0.5, BASE_SIZE / Math.pow(t.k, 0.75));
    if (dots)  dots.attr('font-size', `${sz}px`);
    if (hits)  hits.attr('r', sz * 0.85);
    if (birds) birds.attr('font-size', `${sz}px`);
  }

  // Deselect on SVG background click
  svg.on('click', deselectAll);

  // ── Event handlers ──
  function onDongOver(event, d) {
    if (this !== selectedEl) d3.select(this).classed('dong-hover', true);
    tooltipEl.textContent = `${getGuEn(d.properties.gu_nm)}  ${d.properties.dong_nm}`;
    tooltipEl.classList.remove('hidden');
  }

  function onDongMove(event) {
    tooltipEl.style.left = `${event.clientX + 14}px`;
    tooltipEl.style.top  = `${event.clientY - 38}px`;
  }

  function onDongOut() {
    if (this !== selectedEl) d3.select(this).classed('dong-hover', false);
    tooltipEl.classList.add('hidden');
  }

  function onDongClick(event, d) {
    event.stopPropagation();
    deselectAll();
    selectedEl = this;
    d3.select(this).classed('dong-hover', false).classed('dong-selected', true);

    infoNameEl.textContent = d.properties.dong_nm;
    infoGuEl.textContent   = `${getGuEn(d.properties.gu_nm)} · ${d.properties.adm_cd}`;
    infoPanelEl.classList.remove('hidden');
  }

  function deselectAll() {
    if (selectedEl) {
      d3.select(selectedEl).classed('dong-selected', false);
      selectedEl = null;
    }
    activeTapId = null;
    infoPanelEl.classList.add('hidden');
  }

  // ── Bookstore symbols ──
  const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
  const BASE_SIZE = isMobile ? 12 : 9;
  let activeTapId = null; // 모바일 두 번 탭 이동용
  const dotLayer = g.append('g').attr('class', 'bookstore-layer');

  // 심볼 텍스트 (pointer-events 없음 — 이벤트는 hit 원이 처리)
  const dots = dotLayer.selectAll('.bookstore-dot')
    .data(BOOKSTORES)
    .join('text')
    .attr('class', 'bookstore-dot')
    .classed('has-archive', d => !!d.archiveId)
    .attr('x', d => projection([d.lng, d.lat])[0])
    .attr('y', d => projection([d.lng, d.lat])[1])
    .attr('font-size', `${BASE_SIZE}px`)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('pointer-events', 'none')
    .text(d => d.archiveId ? '✶' : '⊹');

  // 투명 hit 원 — 탭/클릭 영역을 심볼보다 넓게
  const hits = dotLayer.selectAll('.bookstore-hit')
    .data(BOOKSTORES)
    .join('circle')
    .attr('class', 'bookstore-hit')
    .attr('cx', d => projection([d.lng, d.lat])[0])
    .attr('cy', d => projection([d.lng, d.lat])[1])
    .attr('r', BASE_SIZE * 0.85)
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      dots.filter(dd => dd === d).classed('dot-hover', true);
      tooltipEl.textContent = d.name;
      tooltipEl.classList.remove('hidden');
    })
    .on('mousemove', function(event) {
      tooltipEl.style.left = `${event.clientX + 14}px`;
      tooltipEl.style.top  = `${event.clientY - 38}px`;
    })
    .on('mouseout', function(event, d) {
      dots.filter(dd => dd === d).classed('dot-hover', false);
      tooltipEl.classList.add('hidden');
    })
    .on('touchstart', function(event, d) {
      event.stopPropagation();
      if (isMobile && d.archiveId && activeTapId === d.archiveId) {
        // 두 번째 탭 → archive 이동
        window.location.href = `../archive/index.html#${d.archiveId}`;
        return;
      }
      // 첫 번째 탭 → 패널 표시
      activeTapId = d.archiveId || null;
      infoNameEl.textContent = d.name;
      infoGuEl.textContent   = (isMobile && d.archiveId) ? '한 번 더 탭하면 아카이브로 →' : '';
      infoPanelEl.classList.remove('hidden');
    }, { passive: true })
    .on('click', function(event, d) {
      event.stopPropagation(); // 항상 막아서 deselectAll 방지
      if (!isMobile && d.archiveId) {
        window.location.href = `../archive/index.html#${d.archiveId}`;
      }
    });

  // ── Special places (𓅼 마커) ──
  const birds = g.append('g').attr('class', 'bird-layer')
    .selectAll('.bird-dot')
    .data(SPECIAL_PLACES)
    .join('text')
    .attr('class', 'bird-dot')
    .attr('x', d => projection([d.lng, d.lat])[0])
    .attr('y', d => projection([d.lng, d.lat])[1])
    .attr('font-size', `${BASE_SIZE}px`)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .style('cursor', 'pointer')
    .text('𓅼')
    .on('mouseover', function(event, d) {
      d3.select(this).classed('dot-hover', true);
      tooltipEl.textContent = d.name;
      tooltipEl.classList.remove('hidden');
    })
    .on('mousemove', function(event) {
      tooltipEl.style.left = `${event.clientX + 14}px`;
      tooltipEl.style.top  = `${event.clientY - 38}px`;
    })
    .on('mouseout', function() {
      d3.select(this).classed('dot-hover', false);
      tooltipEl.classList.add('hidden');
    })
    .on('touchstart', function(event, d) {
      event.stopPropagation();
      infoNameEl.textContent = d.name;
      infoGuEl.textContent = '';
      infoPanelEl.classList.remove('hidden');
    }, { passive: true })
    .on('click', function(event) {
      event.stopPropagation();
    });

  // ── Resize ──
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    svg.attr('width', w).attr('height', h);
  });
}
