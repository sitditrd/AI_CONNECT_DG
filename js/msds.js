/* =========================================================
   Connect DG — MSDS Document AI
   업로드 → LLM-OCR 분석(재생) → 원문 위치 연결 → 표준 프로파일 확정
   ========================================================= */
(function () {
  'use strict';

  var D = window.DGDATA;
  var selected = null;      // 선택된 MSDS 데이터
  var uploadedName = null;  // 사용자가 올린 파일명
  var analyzed = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]; }); }

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
        '<h4>' + s.t + '</h4><p>' + s.d + '</p>' +
        '<span class="s-out">→ ' + s.out + '</span></div>';
    }).join('');
  }

  /* ---------- 샘플 칩 ---------- */
  function renderChips() {
    $('sampleChips').innerHTML = D.MSDS.map(function (m) {
      return '<button class="f-chip" data-id="' + m.id + '">' + esc(m.title) + ' · ' + esc(m.profile.unNo) + '</button>';
    }).join('');
    $('sampleChips').querySelectorAll('.f-chip').forEach(function (b) {
      b.addEventListener('click', function () { pick(b.dataset.id); });
    });
  }

  function pick(id) {
    selected = D.MSDS.filter(function (m) { return m.id === id; })[0] || null;
    analyzed = false;
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
    /* 파일명으로 UN 번호 추정 → 없으면 첫 샘플로 재생 */
    var guess = D.MSDS.filter(function (m) {
      return f.name.replace(/[^0-9]/g, '').indexOf(m.profile.unNo.replace(/[^0-9]/g, '')) >= 0;
    })[0] || D.MSDS[1];
    pick(guess.id);
    $('uploadState').innerHTML = '업로드 — <b>' + esc(f.name) + '</b> (' + Math.max(1, Math.round(f.size / 1024)) + ' KB) · ' +
      '데모 모드이므로 <b>' + esc(guess.title) + '</b> 사전 추출 결과로 처리 과정을 재생합니다.';
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

  /* ---------- 분석 재생 ---------- */
  function analyze() {
    if (!selected) return;
    var btn = $('analyzeBtn');
    btn.disabled = true;
    var msgs = [
      '문서 업로드 · 페이지 분할 중…',
      'LLM-OCR 표 · 문장 구조 식별 중…',
      'Section 3 · 14 항목 추출 · 원문 위치 연결 중…',
      '표준 위험물 프로파일 정규화 중…'
    ];
    var i = 0;
    (function tick() {
      $('progressText').textContent = msgs[i];
      renderOcrSteps(i + 1);
      i++;
      if (i < msgs.length) { setTimeout(tick, 520); return; }
      setTimeout(function () {
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
        '<span class="badge badge-neutral"><i></i>PG ' + esc(p.packingGroup) + '</span>' +
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
       selected.profile.hazardClass + ' · PG ' + selected.profile.packingGroup + ') 표준 프로파일 확정', 'MSDS Document AI');
    location.href = 'compliance.html';
  }

  /* ---------- 검증 카드 ---------- */
  function renderValidation() {
    $('validationCards').innerHTML = D.MSDS.map(function (m) {
      var p = m.profile;
      return '<div class="card">' +
        '<div class="row" style="gap:6px;">' +
          '<span class="badge badge-dg badge-un"><i></i>' + esc(p.unNo) + '</span>' +
          '<span class="badge badge-neutral"><i></i>Class ' + esc(p.hazardClass) + (p.subRisk ? '(' + esc(p.subRisk) + ')' : '') + ' · PG ' + esc(p.packingGroup) + '</span>' +
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
    renderValidation();
    initDrop();
    $('analyzeBtn').addEventListener('click', analyze);
    $('confirmBtn').addEventListener('click', confirmProfile);

    /* 이미 분석된 케이스가 있으면 복원 */
    if (c.msds && c.msds.id) {
      pick(c.msds.id);
      uploadedName = c.msds.fileName;
      analyzed = true;
      renderOcrSteps(4);
      renderExtract();
      renderProfile();
      $('confirmBtn').disabled = false;
      $('progressText').textContent = '기존 케이스 프로파일 복원 — ' + c.msds.analyzedAt;
    }
    window.DGUI.initReveal();
  });
})();
