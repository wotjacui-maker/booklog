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
  const W = container.clientWidth;
  const H = container.clientHeight;
  const PAD = 40;

  // 화면 너비에 비례해 폰트 크기 조정 (모바일에서 지도가 작아도 글자가 비례하도록)
  const fontScale = Math.min(1, W / 800);
  const GU_BASE   = Math.max(5, 11 * fontScale);
  const DONG_BASE = Math.max(4,  9 * fontScale);

  const svg = d3.select('#map')
    .attr('width', W)
    .attr('height', H);

  const projection = d3.geoMercator()
    .fitExtent([[PAD, PAD], [W - PAD, H - PAD]], dongData);

  const path = d3.geoPath().projection(projection);

  // ── Zoom & Pan ──
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.5, 40])
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

  // ── Gu boundary: draw each gu as a group with a thick outer stroke ──
  // Group features by gu_cd
  const guMap = d3.group(dongData.features, d => d.properties.gu_cd);

  // For each gu, create a synthetic MultiPolygon GeoJSON feature and draw it
  const guLayer = g.append('g').attr('class', 'gu-layer');

  guMap.forEach((features, guCd) => {
    // Collect all coordinate rings from all features in this gu
    const coords = [];
    features.forEach(f => {
      const geom = f.geometry;
      if (!geom) return;
      if (geom.type === 'Polygon') {
        coords.push(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(c => coords.push(c));
      }
    });

    const multiPoly = {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: coords },
      properties: {}
    };

    guLayer.append('path')
      .attr('class', 'gu')
      .attr('d', path(multiPoly));
  });

  // ── Gu name labels (centroid of projected bounding box per gu) ──
  const guLabels = g.append('g').attr('class', 'gu-labels');

  guMap.forEach((features, guCd) => {
    // Build a synthetic FeatureCollection to fit
    const fc = { type: 'FeatureCollection', features };
    const [[x0, y0], [x1, y1]] = path.bounds(fc);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const guNm = features[0]?.properties.gu_nm || '';

    guLabels.append('text')
      .attr('class', 'gu-label')
      .attr('x', cx)
      .attr('y', cy)
      .attr('font-size', `${GU_BASE}px`)
      .text(getGuEn(guNm));
  });

  // ── Dong name labels (shown when zoomed in) ──
  const dongLabels = g.append('g').attr('class', 'dong-labels');

  dongLabels.selectAll('.dong-label')
    .data(dongData.features)
    .join('text')
    .attr('class', 'dong-label')
    .attr('x', d => path.centroid(d)[0])
    .attr('y', d => path.centroid(d)[1])
    .attr('font-size', `${DONG_BASE}px`)
    .text(d => d.properties.dong_nm)
    .style('opacity', 0);

  function onZoom(event) {
    const t = event.transform;
    g.attr('transform', t);

    // 줌 아웃 시 베이스 이상으로 커지지 않도록 캡 적용
    const guFontSize   = Math.min(GU_BASE,   Math.max(4, GU_BASE   / t.k));
    const dongFontSize = Math.min(DONG_BASE, Math.max(3, DONG_BASE / t.k));

    guLabels.selectAll('.gu-label')
      .attr('font-size', `${guFontSize}px`)
      .style('opacity', t.k > 12 ? 0 : 1);

    dongLabels.selectAll('.dong-label')
      .attr('font-size', `${dongFontSize}px`)
      .style('opacity', t.k > 4 ? Math.min(1, (t.k - 4) / 3) : 0);

    if (dots) dots.attr('r', BASE_R / t.k);
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
    infoPanelEl.classList.add('hidden');
  }

  // ── Bookstore dots ──
  const BASE_R = 4;
  const dotLayer = g.append('g').attr('class', 'bookstore-layer');

  const dots = dotLayer.selectAll('.bookstore-dot')
    .data(BOOKSTORES)
    .join('circle')
    .attr('class', 'bookstore-dot')
    .classed('has-archive', d => !!d.archiveId)
    .attr('cx', d => projection([d.lng, d.lat])[0])
    .attr('cy', d => projection([d.lng, d.lat])[1])
    .attr('r', BASE_R)
    .on('mouseover', function(event, d) {
      tooltipEl.textContent = d.archiveId ? `${d.name}  →` : d.name;
      tooltipEl.classList.remove('hidden');
    })
    .on('mousemove', function(event) {
      tooltipEl.style.left = `${event.clientX + 14}px`;
      tooltipEl.style.top  = `${event.clientY - 38}px`;
    })
    .on('mouseout', function() {
      tooltipEl.classList.add('hidden');
    })
    .on('click', function(event, d) {
      if (d.archiveId) {
        event.stopPropagation();
        window.location.href = `../archive/index.html#${d.archiveId}`;
      }
    });

  // ── Resize ──
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    svg.attr('width', w).attr('height', h);
  });
}
