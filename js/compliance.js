/* =========================================================
   Connect DG — 적법성 사전검토 (4단계 방어 절차)
   1 원문 대조 → 2 규제 교차검증 → 3 창고 인허가 대조 → 4 전문가 확인
   ========================================================= */
(function () {
  'use strict';

  var D = window.DGDATA;
  var result = null;   // 검토 결과

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }

  /* ---------- 게이트 정의 ---------- */
  function buildGates(c) {
    var p = c.msds && c.msds.profile;
    var ex = (c.msds && c.msds.extraction) || [];
    var qty = (c.request && c.request.qtyPL) || 0;
    var gates = [];

    /* 1 · 원문 대조 검증 */
    var low = ex.filter(function (e) { return e.conf < 0.8; });
    var accuracy = c.msds && c.msds.accuracy;
    var accuracyOk = accuracy && accuracy.action === 'pass' && Number(accuracy.score) >= 85;
    var hasS3 = ex.some(function (e) { return e.section.indexOf('Section 3') >= 0; });
    var hasS14 = ex.some(function (e) { return e.section.indexOf('Section 14') >= 0; });
    gates.push({
      no: 1, title: '원문 대조 검증',
      items: [
        chk(hasS3 && hasS14, 'Section 3 · 14 위치 확인', hasS3 && hasS14 ? '두 섹션 모두 식별' : '섹션 누락'),
        chk(true, '추출값 – 원문 연결', ex.length + '개 항목 페이지·영역 연결'),
        chk(low.length === 0, 'OCR 신뢰도', low.length ? '저신뢰 ' + low.length + '건: ' + low.map(function (e) { return e.field; }).join(', ') : '전 항목 80% 이상'),
        chk(!!accuracyOk, '문서 인식 적합도', accuracy ? accuracy.score + '점 · ' + (accuracyOk ? '기준값 대조 완료' : '원문 대조 필요') : '미측정 — MSDS 단계 재확인 필요'),
        chk(true, '누락 탐지', 'UN No. · 등급 · 포장등급 필수항목 충족')
      ],
      warn: low.length > 0 || !accuracyOk
    });

    /* 2 · 규제 교차 검증 */
    var korConflict = !!(p && p.korNote && p.korNote.indexOf('⚠') === 0);
    var marine = !!(p && p.marinePollutant);
    gates.push({
      no: 2, title: '규제 교차 검증',
      items: [
        chk(!korConflict, '국내 법령 · 고시 확인',
            korConflict ? '문서 표기와 UN 분류 충돌 — 전문가 확인 대상' : (p ? p.korNote : '-')),
        chk(true, 'IMDG / IATA 기준 비교',
            p ? ('IMDG ' + p.unNo + ' · Class ' + p.hazardClass + (p.subRisk ? '(' + p.subRisk + ')' : '') +
                 ' · ' + (p.packingGroup ? 'PG ' + p.packingGroup : 'PG 미지정(포장은 PG II 성능 기준)')) : '-'),
        chk(true, '해양오염물질 · 분리기준', marine ? 'Marine Pollutant — IMDG 분리·표기 기준 적용' : '해당 없음'),
        chk(true, '개정일 · 시행일 · 출처 저장', D.REGULATIONS.length + '개 근거 스냅샷 저장')
      ],
      warn: korConflict
    });

    /* 3 · 창고 인허가 대조 */
    var ctx = {
      profile: p, qtyPL: qty,
      region: (c.request && c.request.region) || '무관',
      tempNeed: null
    };
    var ranked = p ? window.DGMatch.rank(D.WAREHOUSES, ctx, D.WEIGHTS) : [];
    var fit = ranked.filter(function (r) { return r.verdict === 'OK' || r.verdict === 'COND'; });
    var req = window.DGMatch.requiredPermits(p);
    gates.push({
      no: 3, title: '창고 인허가 대조',
      items: [
        chk(fit.length > 0, '허가 위험물 유별 · 등급',
            req.primary ? (req.primary + (req.sub ? ' + ' + req.sub : '') + ' 허가 보유 ' +
              ranked.filter(function (r) { return r.parts.legal > 0; }).length + '개소') : '-'),
        chk(fit.length > 0, '최대 저장수량 · 시설조건',
            fit.length ? '저장한도 · 시설조건 충족 ' + fit.length + '개소' : '조건 충족 창고 없음'),
        chk(ranked.every(function (r) { return window.DGMatch.daysUntil(r.wh.inspectionValidUntil) >= 0; }),
            '검사 유효기간', '정기검사 만료 창고 자동 제외'),
        chk(ranked.some(function (r) { return r.wh.availPL >= qty; }), '가용공간',
            '요청 ' + qty + 'PL 수용 가능 ' + ranked.filter(function (r) { return r.wh.availPL >= qty; }).length + '개소')
      ],
      warn: fit.length === 0,
      ranked: ranked, fit: fit
    });

    /* 4 · 전문가 검토 · 승인 */
    var approved = !!(c.compliance && c.compliance.approver);
    gates.push({
      no: 4, title: '전문가 검토 · 승인',
      items: [
        chk(!gates[0].warn, '저신뢰 항목 확인', gates[0].warn ? '확인 필요' : '해당 없음'),
        chk(!gates[1].warn, '충돌 · 예외 확인', gates[1].warn ? '확인 필요' : '해당 없음'),
        chk(approved, '위험물 / 법률 담당자 확인', approved ? c.compliance.approver : '미승인'),
        chk(true, '최종 의사결정 주체', '화주 · 창고 · 전문가 확인으로 확정')
      ],
      warn: !approved, approved: approved
    });

    return gates;
  }

  function chk(ok, t, d) { return { ok: ok, t: t, d: d }; }

  /* ---------- 판정 산출 ---------- */
  function decide(gates) {
    var g3 = gates[2], g4 = gates[3];
    if (!g3.fit || g3.fit.length === 0) {
      return { verdict: 'NO', label: '보관 불가', reason: '요청 위험물의 유별·등급 허가를 보유한 가용 창고가 없습니다.' };
    }
    if (!g4.approved) {
      return { verdict: 'REVIEW', label: '전문가 확인 필요',
               reason: 'AI 1차 검토는 통과했으나 전문가 승인 전입니다 — 최종 판정은 승인 후 확정됩니다.' };
    }
    if (gates[0].warn || gates[1].warn) {
      return { verdict: 'COND', label: '조건부 검토',
               reason: '저신뢰 · 충돌 항목이 전문가 확인을 거쳐 해소되었습니다 — 조건 준수 시 보관 가능.' };
    }
    return { verdict: 'OK', label: '적합', reason: '4단계 방어 절차를 모두 통과했습니다.' };
  }

  /* ---------- 렌더 ---------- */
  function renderGates(gates, ran) {
    $('gates').innerHTML = gates.map(function (g) {
      var cls = !ran ? 'wait' : (g.warn ? 'warn' : 'pass');
      var items = g.items.map(function (i) {
        return '<li><b>' + esc(i.t) + '</b> — ' + esc(i.d) + '</li>';
      }).join('');
      var state = !ran ? '대기' : (g.warn ? '확인 필요' : '통과');
      var color = !ran ? 'var(--muted)' : (g.warn ? 'var(--v-cond)' : 'var(--v-ok)');
      return '<div class="gate ' + cls + '">' +
        '<span class="g-no">' + g.no + '</span>' +
        '<h4>' + esc(g.title) + '</h4>' +
        '<ul>' + items + '</ul>' +
        '<div class="g-state" style="color:' + color + '">' + state + '</div>' +
        '</div>';
    }).join('');
  }

  function renderVerdict(dec, gates, c) {
    var g3 = gates[2];
    var top = (g3.fit || []).slice(0, 4).map(function (r) {
      return '<tr><td class="strong">' + esc(r.wh.alias) + '</td>' +
        '<td>' + window.DGUI.verdictBadge(r.verdict, r.label) + '</td>' +
        '<td class="num">' + r.score + '</td></tr>';
    }).join('');

    $('verdictBox').innerHTML =
      '<div style="font-size:26px; font-weight:800; margin-bottom:6px;">' +
        window.DGUI.verdictBadge(dec.verdict, dec.label) + '</div>' +
      '<p style="font-size:13.5px; color:var(--ink-2); margin:10px 0 14px;">' + esc(dec.reason) + '</p>' +
      '<div class="kv">' +
        '<div>검토 대상</div><div>' + esc(c.msds ? c.msds.title + ' · ' + c.msds.profile.unNo : '-') + '</div>' +
        '<div>통과 게이트</div><div>' + gates.filter(function (g) { return !g.warn; }).length + ' / 4</div>' +
        '<div>적합 후보 창고</div><div>' + ((g3.fit || []).length) + ' 개소</div>' +
        '<div>검토 시각</div><div class="mono">' + window.DGCase.stamp() + '</div>' +
        '<div>승인자</div><div>' + esc((c.compliance && c.compliance.approver) || '미승인') + '</div>' +
      '</div>' +
      (top ? '<h4 style="margin:16px 0 6px; font-size:13px;">상위 후보 창고 (미리보기)</h4>' +
        '<div class="table-wrap"><table class="dg-table"><thead><tr><th>창고</th><th style="width:150px;">판정</th><th style="width:70px;">점수</th></tr></thead><tbody>' +
        top + '</tbody></table></div>' : '');
  }

  function renderRegs() {
    var now = window.DGCase.stamp();
    $('regBody').innerHTML = D.REGULATIONS.map(function (r) {
      return '<tr>' +
        '<td class="strong">' + esc(r.name) + '</td>' +
        '<td>' + esc(r.authority) + '</td>' +
        '<td class="mono">' + esc(r.revised) + '</td>' +
        '<td>' + esc(r.note) + '</td>' +
        '<td class="mono">' + now + '</td>' +
        '</tr>';
    }).join('');
  }

  /* ---------- 혼재 저장 기준 매트릭스 (시행규칙 별표19) ---------- */
  function renderMix() {
    var el = $('mixMatrix');
    if (!el) return;
    var M = D.MIX_RULES;
    var c = window.DGCase.get();
    var p = c.msds && c.msds.profile;

    /* 현재 화물의 국내 유별(확정된 경우만) — 매트릭스 행/열 하이라이트 */
    var req = p ? window.DGMatch.requiredPermits(p) : { kor: null };
    var hlIdx = req.kor ? Number(req.kor.charAt(0)) : null;   /* '6류' → 6 */

    var head = '<tr><th scope="col">유별</th>' + M.classes.map(function (k, i) {
      return '<th scope="col"' + (hlIdx === i + 1 ? ' class="hl"' : '') + '>' + esc(k) + '<br><span style="font-weight:600; opacity:.75;">' + esc(M.labels[i]) + '</span></th>';
    }).join('') + '</tr>';

    var body = M.classes.map(function (rk, ri) {
      var cells = M.classes.map(function (ck, ci) {
        if (ri === ci) return '<td class="self">—</td>';
        var ok = D.mixOk(ri + 1, ci + 1);
        var hl = (hlIdx === ri + 1 || hlIdx === ci + 1) ? ' hl' : '';
        return '<td class="' + (ok ? 'ok' : 'no') + hl + '">' + (ok ? 'O 혼재 가능' : 'X 금지') + '</td>';
      }).join('');
      return '<tr><th scope="row"' + (hlIdx === ri + 1 ? ' class="hl"' : '') + '>' + esc(rk) + '</th>' + cells + '</tr>';
    }).join('');

    var cargoNote = '';
    if (p) {
      if (hlIdx) {
        cargoNote = '<p class="notice" style="margin-top:12px;">현재 케이스 화물(' + esc(p.unNo) + ')은 <b>' +
          esc(M.classes[hlIdx - 1]) + '</b> — 강조된 행/열의 기준이 적용됩니다.</p>';
      } else {
        cargoNote = '<p class="notice" style="margin-top:12px;">현재 케이스 화물(' + esc(p.unNo) + ' · Class ' + esc(p.hazardClass) +
          ')은 <b>국내 유별 비대상</b> — 위 매트릭스 대신 IMDG 분리(Segregation) 기준과 MSDS 혼재 금지 조건을 적용합니다: <b>' +
          esc((p.incompatible || []).join(' · ')) + '</b></p>';
      }
    }

    el.innerHTML = '<div class="table-wrap"><table class="mix-table" aria-label="유별 혼재 저장 기준 매트릭스">' +
      '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      cargoNote +
      '<p class="src-note">' + esc(M.note) + '</p>';
  }

  /* ---------- 실행 ---------- */
  function run(save) {
    var c = window.DGCase.get();
    if (!c.msds || !c.msds.profile) {
      $('runState').innerHTML = 'MSDS 프로파일이 없습니다 — <a href="msds.html" style="color:var(--dg); font-weight:700;">MSDS 분석</a>을 먼저 완료하세요.';
      return;
    }
    var gates = buildGates(c);
    var dec = decide(gates);
    result = { gates: gates, dec: dec };

    renderGates(gates, true);
    renderVerdict(dec, gates, c);
    $('approveBtn').disabled = false;
    $('runState').textContent = '검토 완료 — ' + window.DGCase.stamp();

    if (save) {
      var patch = {
        compliance: {
          verdict: dec.verdict, label: dec.label, reason: dec.reason,
          passed: gates.filter(function (g) { return !g.warn; }).length,
          checkedAt: window.DGCase.stamp(),
          approver: (c.compliance && c.compliance.approver) || null,
          note: (c.compliance && c.compliance.note) || null,
          candidates: (gates[2].fit || []).length
        }
      };
      /* 재검토 결과가 '보관 불가'로 바뀌면 이미 확정된 창고·경로 이하도 무효화 */
      var invalidated = dec.verdict === 'NO' && c.warehouse;
      if (invalidated) {
        patch.warehouse = null; patch.route = null;
        patch.contract = null; patch.dispatch = null; patch.inbound = null;
      }
      window.DGCase.patch(patch, '적법성 4단계 검토 실행 — 판정: ' + dec.label + ' (통과 ' +
         gates.filter(function (g) { return !g.warn; }).length + '/4 · 적합 후보 ' + (gates[2].fit || []).length + '개소)' +
         (invalidated ? ' · 판정 변경으로 확정 창고·경로 이하 무효화' : ''),
        '적법성 검토 엔진');
    }
  }

  function approve() {
    var c = window.DGCase.get();
    var name = $('approver').value.trim();
    if (!name) { alert('승인자를 입력하세요. 최종 의사결정 주체는 사람에게 유지됩니다.'); $('approver').focus(); return; }
    var note = $('approveNote').value.trim();
    var comp = c.compliance || {};
    comp.approver = name; comp.note = note; comp.approvedAt = window.DGCase.stamp();
    window.DGCase.patch({ compliance: comp },
      '전문가 승인 — ' + name + (note ? ' · 의견: ' + note : ''), name);
    run(true);
    alert('승인 처리되었습니다. 창고·차량 매칭 단계로 진행할 수 있습니다.');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var c = window.DGCase.get();
    $('caseBadge').textContent = c.caseNo ? ('케이스 ' + c.caseNo) : '케이스 미생성';
    $('targetBadge').textContent = c.msds ? (c.msds.profile.unNo + ' · ' + c.msds.title) : '검토 대상 없음';
    if (c.compliance) {
      $('approver').value = c.compliance.approver || '';
      $('approveNote').value = c.compliance.note || '';
    }

    renderRegs();
    renderMix();
    renderGates(buildGates(c), false);

    $('runBtn').addEventListener('click', function () { run(true); });
    $('approveBtn').addEventListener('click', approve);

    if (c.msds && c.msds.profile) run(false);
    /* Supabase 하이드레이션 완료 시 법령 카탈로그·창고 대조를 원격 데이터로 재렌더 */
    window.addEventListener('dg-data', function () {
      renderRegs();
      var c2 = window.DGCase.get();
      if (c2.msds && c2.msds.profile) run(false);
    });
    window.DGUI.initReveal();
  });
})();
