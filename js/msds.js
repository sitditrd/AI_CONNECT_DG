/* =========================================================
   Connect DG — MSDS Document AI
   업로드 → LLM-OCR 분석(재생) → 원문 위치 연결 → 표준 프로파일 확정
   ========================================================= */
(function () {
  'use strict';

  var D = window.DGDATA;
  var selected = null;      // 선택된 MSDS 데이터
  var uploadedName = null;  // 사용자가 올린 파일명
  var uploadedFile = null;  // 실문서 분석용 File 객체 (로그인 시)
  var analyzed = false;

  /* ---------- 설정 (js/config.js — 없으면 기본값) ---------- */
  function cfg() {
    var c = (window.DGCONFIG && DGCONFIG.msds) || {};
    return {
      mode: c.mode || 'auto',
      probeTtlMs: c.probeTtlMs || 600000,
      accept: c.accept || ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      maxBytes: c.maxBytes || 8 * 1024 * 1024
    };
  }

  /* ---------- 엔진 3상태 ----------
     ai   : 서버에 ANTHROPIC_API_KEY 가 있고 로그인 상태 — 실문서를 AI가 분석(유료)
     demo : 사전 추출 결과 재생 — 비용 0, 업로드 문서는 분석되지 않음
     (blocked: AI 모드인데 조건 미충족) */
  var ENGINE_META = {
    ai: { label: 'AI 분석', cls: 'badge-dg',
      note: '업로드한 문서를 문서 AI가 실제로 분석합니다. 원문이 분석 API로 전송됩니다.' },
    demo: { label: '데모 재생', cls: 'badge-neutral',
      note: '사전 검증된 MSDS 3종의 추출 결과를 재생합니다. 업로드한 문서는 분석되지 않습니다.' }
  };

  var serverCaps = null;   /* probe 결과 캐시 */

  /* 서버 능력 조사 — Anthropic API 를 호출하지 않으므로 과금 0 */
  function probe() {
    var C = cfg();
    if (C.mode === 'demo') return Promise.resolve({ ai: false });
    try {
      var raw = sessionStorage.getItem('dg-msds-caps');
      if (raw) {
        var c = JSON.parse(raw);
        if (c && (Date.now() - c.at) < C.probeTtlMs) return Promise.resolve(c.caps);
      }
    } catch (e) { /* 무시 */ }
    if (typeof DGAUTH === 'undefined') return Promise.resolve({ ai: false });
    return DGAUTH.edge('msds-extract', { probe: true }).then(function (r) {
      var caps = { ai: !!(r && r.ok && r.ai) };
      try { sessionStorage.setItem('dg-msds-caps', JSON.stringify({ at: Date.now(), caps: caps })); } catch (e) { /* 무시 */ }
      return caps;
    }).catch(function () { return { ai: false }; });
  }

  /* 현재 선택으로 어떤 엔진이 돌지 — 이유까지 함께 반환 */
  function engineFor(file) {
    var C = cfg();
    if (C.mode === 'demo') return { engine: 'demo', reason: '설정이 데모 고정입니다.' };
    if (!serverCaps || !serverCaps.ai) return { engine: 'demo', reason: '서버에 문서 AI 키가 등록되어 있지 않습니다.' };
    if (typeof DGAUTH === 'undefined' || !DGAUTH.isAuthed()) return { engine: 'demo', reason: '로그인해야 실문서 분석을 사용할 수 있습니다.' };
    if (!file) return { engine: 'demo', reason: '분석할 파일을 업로드하면 AI 분석이 실행됩니다.' };
    if (C.accept.indexOf(file.type) < 0) return { engine: 'demo', reason: '지원하지 않는 형식입니다(PDF·PNG·JPEG·WebP·GIF).' };
    if (file.size > C.maxBytes) return { engine: 'demo', reason: '파일이 ' + Math.round(C.maxBytes / 1048576) + 'MB 를 초과합니다.' };
    return { engine: 'ai', reason: '' };
  }

  function renderEngineBadge() {
    var box = $('engineBadge');
    if (!box) return;
    var e = engineFor(uploadedFile);
    var m = ENGINE_META[e.engine];
    box.innerHTML = '<span class="badge ' + m.cls + '"><i></i>' + m.label + '</span>' +
      '<span class="muted" style="font-size:12px;margin-left:8px;">' + esc(m.note) +
      (e.reason ? ' — ' + esc(e.reason) : '') + '</span>';
  }

  function liveReady() { return engineFor(uploadedFile).engine === 'ai'; }

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }

  var OCR_STEPS = [
    { no: 1, t: '보안 문서 업로드', d: 'PDF · 스캔 · 이미지 형식 인식. 문서는 케이스 단위로 격리 저장.', out: '원본 문서 · 페이지 수' },
    { no: 2, t: 'LLM-OCR 분석', d: '표 · 문장 · 항목 구조를 자동 식별하고 Section 3 · 14를 우선 탐색.', out: '항목 후보 집합' },
    { no: 3, t: '원문 위치 연결', d: '추출값마다 페이지 · 영역 · 신뢰도를 함께 저장해 원문 대조가 가능하게 함.', out: '추출값 – 원문 링크' },
    { no: 4, t: '표준 위험물 프로파일', d: 'UN No.·등급·포장등급·해양오염물질·특별주의사항을 표준 스키마로 정규화.', out: '표준 프로파일' }
  ];

  function renderOcrSteps(activeNo) {
    $('ocrSteps').innerHTML = OCR_STEPS.map(function (s) {
      var on = activeNo != null && s.no <= activeNo;
      return '<div class="step" style="' + (on ? '' : 'opacity:.62;') + '">' +
        '<span class="s-no">' + s.no + '</span>' +
        '<h3 style="margin:12px 0 6px; font-size:15.5px;">' + s.t + '</h3><p>' + s.d + '</p>' +
        '<span class="s-out">→ ' + s.out + '</span></div>';
    }).join('');
  }

  /* ---------- 샘플 칩 ---------- */
  function renderChips() {
    $('sampleChips').innerHTML = D.MSDS.map(function (m) {
      return '<button class="f-chip" data-id="' + m.id + '">' + esc(m.title) + ' · ' + esc(m.profile.unNo) + '</button>';
    }).join('');
    $('sampleChips').querySelectorAll('.f-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        uploadedFile = null; uploadedName = null;   /* 샘플 선택 = 데모 재생 모드 */
        pick(b.dataset.id);
        renderEngineBadge();
      });
    });
  }

  function pick(id) {
    selected = D.MSDS.filter(function (m) { return m.id === id; })[0] || null;
    analyzed = false;
    analyzeGen++;   /* 진행 중이던 분석 재생 체인 중단 */
    $('sampleChips').querySelectorAll('.f-chip').forEach(function (b) {
      b.classList.toggle('on', b.dataset.id === id);
    });
    $('uploadState').innerHTML = selected
      ? '선택 문서 — <b>' + esc(uploadedName || selected.fileName) + '</b> · ' + selected.pages + '쪽'
      : '선택된 문서가 없습니다.';
    $('analyzeBtn').disabled = !selected;
    $('confirmBtn').disabled = true;
    $('extractBody').innerHTML = '<tr><td colspan="5" class="muted center">분석 대기 중</td></tr>';
    $('profileBox').innerHTML = '<p class="muted" style="font-size:13px;">분석을 실행하면 표준 프로파일이 생성됩니다.</p>';
    $('lowConfNote').style.display = 'none';
    renderOcrSteps(1);
  }

  /* ---------- 업로드 (파일명만 사용, 내용은 전송하지 않음) ---------- */
  function handleFile(f) {
    if (!f) return;
    uploadedName = f.name;
    uploadedFile = f;
    var kb = Math.max(1, Math.round(f.size / 1024));
    var e = engineFor(f);
    renderEngineBadge();

    if (e.engine === 'ai') {
      /* 실분석 — 데모 샘플을 미리 고르지 않는다(결과는 문서에서 나온다) */
      selected = null; analyzed = false; analyzeGen++;
      $('sampleChips').querySelectorAll('.f-chip').forEach(function (b) { b.classList.remove('on'); });
      $('extractBody').innerHTML = '<tr><td colspan="5" class="muted center">분석 대기 중</td></tr>';
      $('profileBox').innerHTML = '<p class="muted" style="font-size:13px;">분석을 실행하면 이 문서에서 추출한 표준 프로파일이 표시됩니다.</p>';
      $('lowConfNote').style.display = 'none';
      renderOcrSteps(1);
      $('analyzeBtn').disabled = false;
      $('confirmBtn').disabled = true;
      $('uploadState').innerHTML = '업로드 — <b>' + esc(f.name) + '</b> (' + kb + ' KB) · ' +
        '<b>AI 분석</b> 준비됨 — 분석 실행을 누르면 이 문서를 직접 읽습니다.';
      return;
    }

    /* 데모 모드 — 업로드 문서는 분석되지 않지만, 시연 흐름이 끊기지 않도록
       재생할 샘플을 '무작위'로 하나 자동 선택해 분석 실행을 바로 활성화한다.
       파일명 숫자로 샘플을 찍던 예전 방식과는 다르다 — 그때는 파일 내용과
       관계있는 척했기 때문에 '오인식'으로 보였다. 지금은 무작위임을 화면에 명시하고,
       사용자가 아래 칩으로 언제든 다른 샘플로 바꿀 수 있다. */
    var sample = pickRandomSample();
    if (sample) pick(sample.id);
    $('uploadState').innerHTML = '업로드 — <b>' + esc(f.name) + '</b> (' + kb + ' KB) · ' +
      '<b>데모 재생 모드</b>라 이 문서는 분석되지 않습니다. ' + esc(e.reason) +
      (sample
        ? '<br>재생할 샘플로 <b>' + esc(sample.title) + '</b>(' + esc(sample.profile.unNo) +
          ')이 무작위로 선택되었습니다 — 아래에서 다른 샘플로 바꿀 수 있습니다.'
        : '<br>아래에서 재생할 MSDS 샘플을 직접 선택하세요.');
    $('analyzeBtn').disabled = !selected;
  }

  /* 데모 재생용 샘플 무작위 선택 — 직전에 재생한 샘플은 가능하면 피해
     연속 업로드 시 같은 프로파일만 반복되지 않게 한다. */
  function pickRandomSample() {
    var pool = (D.MSDS || []).filter(function (m) { return !selected || m.id !== selected.id; });
    if (!pool.length) pool = D.MSDS || [];
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function initDrop() {
    var dz = $('dropZone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('hot'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('hot'); });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    $('fileInput').addEventListener('change', function (e) { handleFile(e.target.files[0]); });
  }

  /* ---------- 분석 재생 ----------
     진행 중 다른 샘플을 선택하면 세대 토큰(analyzeGen)이 바뀌어
     이전 타이머 체인이 조용히 중단됨 — 두 체인 교차 갱신 방지 */
  var analyzeGen = 0;

  /* ---------- 실문서 분석 (Edge Function msds-extract → Claude) ----------
     서버 프로파일을 데모 프로파일과 동일한 화면 모델로 정규화 */
  function buildLiveSelected(p, fileName) {
    var extraction = (p.extraction || []).map(function (e) {
      return { field: e.field, value: e.value, section: e.section, page: e.page || 1, conf: (typeof e.confidence === 'number' ? e.confidence : 0.7) };
    });
    var pages = 1;
    extraction.forEach(function (e) { if (e.page > pages) pages = e.page; });
    return {
      id: 'live-' + Date.now(),
      live: true,
      title: p.productName || fileName,
      fileName: fileName,
      pages: pages,
      summary: '실문서 AI 분석 결과',
      profile: {
        productName: p.productName || '—',
        casNo: p.casNo || [],
        components: p.components || [],
        unNo: p.unNo || 'UN 미기재',
        psn: p.psn || '—',
        hazardClass: p.hazardClass || '—',
        subRisk: p.subRisk || '',
        packingGroup: p.packingGroup || '',
        packingNote: p.packingGroup ? '' : '문서에 포장등급 미기재 — 적법성 검토에서 확인',
        marinePollutant: !!p.marinePollutant,
        tunnelCode: p.tunnelCode || '',
        state: p.flashPointC ? ('인화점 ' + p.flashPointC) : '문서 기재 기준',
        packing: '문서 기재 기준',
        storageTemp: p.storageTemp || '—',
        specialProvisions: p.specialProvisions || [],
        korNote: '실문서 분석 — 국내 법령 매핑은 적법성 검토 단계에서 교차 확인',
        chemAct: '적법성 검토 단계에서 확인',
        incompatible: p.incompatible || []
      },
      extraction: extraction.length ? extraction : [
        { field: 'productName', value: p.productName || '—', section: 'Section 1', page: 1, conf: 0.7 }
      ]
    };
  }

  function analyzeReal(gen, btn) {
    var f = uploadedFile;
    var msgs = [
      '보안 업로드 · 문서 인코딩 중…',
      'Claude 문서 AI 호출 중… (수십 초 걸릴 수 있습니다)',
      '추출값 · 원문 위치 정규화 중…'
    ];
    $('progressText').textContent = msgs[0];
    renderOcrSteps(1);
    var reader = new FileReader();
    reader.onerror = function () { if (gen === analyzeGen) fallbackDemo(gen, btn, '파일 읽기 실패'); };
    reader.onload = function () {
      if (gen !== analyzeGen) return;
      var b64 = String(reader.result).split(',')[1] || '';
      $('progressText').textContent = msgs[1];
      renderOcrSteps(2);
      DGAUTH.edge('msds-extract', {
        token: DGAUTH.token(), filename: f.name, media_type: f.type, data: b64
      }).catch(function (err) {
        /* 네트워크·타임아웃 등 — catch 가 없으면 버튼이 영구히 잠긴다 */
        fallbackDemo(gen, btn, String((err && err.message) || err || '네트워크 오류'));
      }).then(function (r) {
        if (gen !== analyzeGen || !r) return;
        if (!r.ok || !r.profile) { fallbackDemo(gen, btn, (r && r.error) || '분석 실패'); return; }
        $('progressText').textContent = msgs[2];
        renderOcrSteps(3);
        selected = buildLiveSelected(r.profile, f.name);
        analyzed = true;
        renderOcrSteps(4);
        renderExtract();
        renderProfile();
        $('confirmBtn').disabled = false;
        btn.disabled = false;
        $('progressText').textContent = '실문서 분석 완료 — 추출 항목 ' + selected.extraction.length + '건';
        if (window.DGKit) DGKit.toast('실문서 AI 분석이 완료되었습니다.', 'ok');
      });
    };
    reader.readAsDataURL(f);
  }
  /* 실분석 실패 — 무관한 샘플로 조용히 바꿔치지 않는다.
     원인을 그대로 알리고 사용자가 재시도하거나 데모 샘플을 직접 고르게 한다. */
  function fallbackDemo(gen, btn, why) {
    if (gen !== analyzeGen) return;
    if (window.DGKit) DGKit.toast('실문서 분석 실패 — ' + why, 'err');
    $('progressText').textContent = '실문서 분석 실패 — ' + why;
    $('uploadState').innerHTML = '<b>분석에 실패했습니다</b> — ' + esc(why) +
      '<br>다시 시도하거나, 아래에서 MSDS 샘플을 선택해 데모로 진행하세요.';
    renderOcrSteps(1);
    btn.disabled = false;
  }

  function analyze() {
    if (!selected) return;
    var gen = ++analyzeGen;
    var btn = $('analyzeBtn');
    btn.disabled = true;
    if (liveReady()) { analyzeReal(gen, btn); return; }
    analyzeDemo(gen, btn);
  }

  function analyzeDemo(gen, btn) {
    var msgs = [
      '문서 업로드 · 페이지 분할 중…',
      'LLM-OCR 표 · 문장 구조 식별 중…',
      'Section 3 · 14 항목 추출 · 원문 위치 연결 중…',
      '표준 위험물 프로파일 정규화 중…'
    ];
    var i = 0;
    (function tick() {
      if (gen !== analyzeGen) return;   /* 다른 문서 선택됨 — 체인 중단 */
      $('progressText').textContent = msgs[i];
      renderOcrSteps(i + 1);
      i++;
      if (i < msgs.length) { setTimeout(tick, 520); return; }
      setTimeout(function () {
        if (gen !== analyzeGen) return;
        $('progressText').textContent = '완료 — 추출 항목 ' + selected.extraction.length + '건';
        analyzed = true;
        renderExtract();
        renderProfile();
        $('confirmBtn').disabled = false;
        btn.disabled = false;
      }, 420);
    })();
  }

  /* ---------- 추출 표 ---------- */
  function confBar(c) {
    var pct = Math.round(c * 100);
    return '<span class="conf' + (c < 0.8 ? ' low' : '') + '">' +
      '<span class="cbar"><span class="cfill" style="width:' + pct + '%"></span></span>' + pct + '%</span>';
  }

  function renderExtract() {
    var rows = selected.extraction.map(function (e) {
      return '<tr>' +
        '<td class="strong">' + esc(e.field) + '</td>' +
        '<td>' + esc(e.value) + '</td>' +
        '<td>' + esc(e.section) + '</td>' +
        '<td class="num">p.' + e.page + '</td>' +
        '<td>' + confBar(e.conf) + '</td>' +
        '</tr>';
    }).join('');
    $('extractBody').innerHTML = rows;

    var low = selected.extraction.filter(function (e) { return e.conf < 0.8; });
    var note = $('lowConfNote');
    if (low.length) {
      note.style.display = '';
      note.className = 'notice warn';
      note.innerHTML = '<b>저신뢰 항목 ' + low.length + '건</b> — ' +
        low.map(function (e) { return esc(e.field) + '(' + Math.round(e.conf * 100) + '%)'; }).join(' · ') +
        ' · 적법성 검토 4단계에서 <b>전문가 확인 대상</b>으로 자동 승계됩니다.';
    } else {
      note.style.display = '';
      note.className = 'notice';
      note.innerHTML = '모든 추출 항목이 신뢰도 80% 이상입니다. 그래도 <b>원문 대조 검증(1단계)</b>은 생략하지 않습니다.';
    }
  }

  /* ---------- 표준 프로파일 ---------- */
  function renderProfile() {
    var p = selected.profile;
    var comp = p.components.map(function (c) {
      return '<tr><td class="strong">' + esc(c.name) + '</td><td class="mono">' + esc(c.cas) + '</td><td class="num">' + esc(c.pct) + '</td></tr>';
    }).join('');

    $('profileBox').innerHTML =
      '<div class="row" style="gap:8px; margin-bottom:12px;">' +
        '<span class="badge badge-dg badge-un"><i></i>' + esc(p.unNo) + '</span>' +
        '<span class="badge badge-neutral"><i></i>Class ' + esc(p.hazardClass) + (p.subRisk ? '(' + esc(p.subRisk) + ')' : '') + '</span>' +
        (p.packingGroup
          ? '<span class="badge badge-neutral"><i></i>PG ' + esc(p.packingGroup) + '</span>'
          : '<span class="badge badge-neutral" data-tip="' + esc(p.packingNote || 'UN 목록상 포장등급 미지정 품목') + '"><i></i>PG 미지정</span>') +
        (p.marinePollutant ? '<span class="badge badge-cond"><i></i>Marine Pollutant</span>' : '') +
        (p.tunnelCode ? '<span class="badge badge-neutral"><i></i>터널코드 ' + esc(p.tunnelCode) + '</span>' : '') +
      '</div>' +
      '<div class="kv">' +
        '<div>제품명</div><div>' + esc(p.productName) + '</div>' +
        '<div>Proper Shipping Name</div><div>' + esc(p.psn) + '</div>' +
        '<div>CAS No.</div><div class="mono">' + esc(p.casNo.join(' / ')) + '</div>' +
        '<div>성상 · 포장</div><div>' + esc(p.state) + ' · ' + esc(p.packing) + '</div>' +
        '<div>보관 온도</div><div>' + esc(p.storageTemp) + '</div>' +
        '<div>특별주의사항</div><div class="mono">' + esc((p.specialProvisions || []).join(' · ')) + '</div>' +
        '<div>국내 법령</div><div>' + esc(p.korNote) + '</div>' +
        '<div>화관법</div><div>' + esc(p.chemAct) + '</div>' +
        '<div>혼재 금지</div><div>' + esc(p.incompatible.join(' · ')) + '</div>' +
      '</div>' +
      '<h4 style="margin:16px 0 6px; font-size:13px;">구성성분 (Section 3)</h4>' +
      '<div class="table-wrap"><table class="dg-table"><thead><tr><th>성분</th><th style="width:130px;">CAS No.</th><th style="width:90px;">함유량</th></tr></thead><tbody>' + comp + '</tbody></table></div>';
  }

  /* ---------- 확정 ---------- */
  function confirmProfile() {
    if (!selected || !analyzed) return;
    window.DGCase.patch({
      msds: {
        id: selected.id,
        fileName: uploadedName || selected.fileName,
        title: selected.title,
        pages: selected.pages,
        profile: selected.profile,
        extraction: selected.extraction,
        analyzedAt: window.DGCase.stamp()
      },
      /* 프로파일이 바뀌면 이후 단계는 재검토 대상 */
      compliance: null, warehouse: null, route: null, contract: null, dispatch: null, inbound: null
    }, 'MSDS 분석 완료 — ' + selected.title + ' (' + selected.profile.unNo + ' · Class ' +
       selected.profile.hazardClass + ' · ' + (selected.profile.packingGroup ? 'PG ' + selected.profile.packingGroup : 'PG 미지정') +
       ') 표준 프로파일 확정', 'MSDS Document AI');
    location.href = 'compliance.html';
  }

  /* ---------- 검증 카드 ---------- */
  function renderValidation() {
    $('validationCards').innerHTML = D.MSDS.map(function (m) {
      var p = m.profile;
      return '<div class="card">' +
        '<div class="row" style="gap:6px;">' +
          '<span class="badge badge-dg badge-un"><i></i>' + esc(p.unNo) + '</span>' +
          '<span class="badge badge-neutral"><i></i>Class ' + esc(p.hazardClass) + (p.subRisk ? '(' + esc(p.subRisk) + ')' : '') +
            ' · ' + (p.packingGroup ? 'PG ' + esc(p.packingGroup) : 'PG 미지정') + '</span>' +
        '</div>' +
        '<h3 style="margin-top:10px;">' + esc(m.title) + '</h3>' +
        '<p>' + esc(m.summary) + '</p>' +
        '<span class="tagline">추출 항목 ' + m.extraction.length + '건 · 최저 신뢰도 ' +
          Math.round(Math.min.apply(null, m.extraction.map(function (e) { return e.conf; })) * 100) + '%</span>' +
        '</div>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var c = window.DGCase.get();
    $('caseBadge').textContent = c.caseNo ? ('케이스 ' + c.caseNo) : '케이스 미생성';

    renderOcrSteps(null);
    renderChips();
    renderEngineBadge();
    /* 서버 능력 조사 → AI 분석 가능 여부에 따라 배지·안내를 자동 갱신(과금 0) */
    probe().then(function (caps) { serverCaps = caps; renderEngineBadge(); });
    renderValidation();
    initDrop();
    $('analyzeBtn').addEventListener('click', analyze);
    $('confirmBtn').addEventListener('click', confirmProfile);

    /* 이미 분석된 케이스가 있으면 복원 — 저장된 id가 현재 목록에 없으면(데이터 개편 등) 안내만 */
    if (c.msds && c.msds.id) {
      var exists = D.MSDS.some(function (m) { return m.id === c.msds.id; });
      if (exists) {
        pick(c.msds.id);
        uploadedName = c.msds.fileName;
        analyzed = true;
        renderOcrSteps(4);
        renderExtract();
        renderProfile();
        $('confirmBtn').disabled = false;
        $('progressText').textContent = '기존 케이스 프로파일 복원 — ' + c.msds.analyzedAt;
      } else if (c.msds.profile && c.msds.extraction) {
        /* 실문서 분석 케이스 — 케이스에 저장된 프로파일로 직접 복원 */
        selected = {
          id: c.msds.id, live: true, title: c.msds.title, fileName: c.msds.fileName,
          pages: c.msds.pages || 1, summary: '실문서 AI 분석 결과',
          profile: c.msds.profile, extraction: c.msds.extraction
        };
        uploadedName = c.msds.fileName;
        analyzed = true;
        $('uploadState').innerHTML = '선택 문서 — <b>' + esc(c.msds.fileName) + '</b> · 실문서 분석 케이스 복원';
        renderOcrSteps(4);
        renderExtract();
        renderProfile();
        $('confirmBtn').disabled = false;
        $('progressText').textContent = '기존 케이스 프로파일 복원(실문서) — ' + c.msds.analyzedAt;
      } else {
        $('uploadState').textContent = '저장된 케이스의 MSDS(' + c.msds.id + ')가 현재 문서 목록에 없습니다 — 문서를 다시 선택해 분석하세요.';
      }
    }
    /* 키보드 접근 — Enter/Space 로 드롭존에서 파일 선택 열기 */
    var dz = $('dropZone');
    dz.setAttribute('tabindex', '0');
    dz.setAttribute('role', 'button');
    dz.setAttribute('aria-label', 'MSDS 파일 선택 — Enter 키로 파일 대화상자 열기');
    dz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); }
    });
    window.DGUI.initReveal();
  });
})();
