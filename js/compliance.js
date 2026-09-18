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
    var V = window.DGVerify;
    var casBad = V ? V.casIssues(p, ex) : [];
    var casCount = V && p ? (p.casNo || []).concat((p.components || []).map(function (x) { return x.cas; }))
      .reduce(function (n, s) { return n + V.findCas(s).length; }, 0) : 0;
    /* 필수 필드 — 적합도 산정 결과가 있으면 그것을, 없으면 프로파일로 직접 판단 */
    var missing = (accuracy && accuracy.missing) || [];
    if (!accuracy && p) {
      if (!p.unNo) missing.push('UN Number');
      if (!p.hazardClass) missing.push('Hazard Class');
    }
    var hasS3 = ex.some(function (e) { return e.section.indexOf('Section 3') >= 0; });
    var hasS14 = ex.some(function (e) { return e.section.indexOf('Section 14') >= 0; });
    gates.push({
      no: 1, title: '원문 대조 검증',
      items: [
        chk(hasS3 && hasS14, 'Section 3 · 14 위치 확인', hasS3 && hasS14 ? '두 섹션 모두 식별' : '섹션 누락'),
        chk(true, '추출값 – 원문 연결', ex.length + '개 항목 페이지·영역 연결'),
        chk(low.length === 0, 'OCR 신뢰도', low.length ? '저신뢰 ' + low.length + '건: ' + low.map(function (e) { return e.field; }).join(', ') : '전 항목 80% 이상'),
        chk(!!accuracyOk, '문서 인식 적합도', accuracy ? accuracy.score + '점 · ' + (accuracyOk ? '기준값 대조 완료' : '원문 대조 필요') : '미측정 — MSDS 단계 재확인 필요'),
        chk(!missing.length, '누락 탐지', missing.length ? '필수 필드 누락: ' + missing.join(', ') : 'UN No. · 등급 · 포장등급 필수항목 충족'),
        chk(!casBad.length, 'CAS 체크디짓',
            casBad.length ? casBad.map(function (b) { return b.cas + '(기대 ' + b.expected + ')'; }).join(', ') + ' — 원문 대조 필요'
                          : (casCount ? casCount + '개 CAS 번호 체크디짓 일치' : 'CAS 표기 없음(물품 · 혼합물)'))
      ],
      warn: low.length > 0 || !accuracyOk || missing.length > 0 || casBad.length > 0
    });

    /* 2 · 규제 교차 검증 */
    var korConflict = !!(p && p.korNote && p.korNote.indexOf('⚠') === 0);
    var marine = !!(p && p.marinePollutant);
    /* IMDG 형식 검사 — UN 번호 4자리, 등급 1~9(소분류 포함), 포장등급 I~III 또는 미지정 사유 */
    var unOk = !!(p && /^UN\s?\d{4}$/i.test(String(p.unNo || '').trim()));
    var clsOk = !!(p && /^[1-9](\.[1-6])?$/.test(String(p.hazardClass || '').trim()));
    var pgOk = !!(p && (/^(I|II|III)$/.test(String(p.packingGroup || '')) || (!p.packingGroup && p.packingNote)));
    var imdgOk = unOk && clsOk && pgOk;
    var conc = V ? V.concIssues(p) : [];
    var laws = V ? V.lawStatus() : [];
    var lawReview = laws.filter(function (s) { return s.ruleReview; });
    var lawStale = laws.filter(function (s) { return s.catalogStale; });
    var RS = D.RULESET || {};
    gates.push({
      no: 2, title: '규제 교차 검증',
      items: [
        chk(!korConflict, '국내 법령 · 고시 확인',
            korConflict ? '문서 표기와 UN 분류 충돌 — 전문가 확인 대상' : (p ? p.korNote : '-')),
        chk(imdgOk, 'IMDG / IATA 기준 비교',
            p ? ('IMDG ' + p.unNo + ' · Class ' + p.hazardClass + (p.subRisk ? '(' + p.subRisk + ')' : '') +
                 ' · ' + (p.packingGroup ? 'PG ' + p.packingGroup : 'PG 미지정(포장은 PG II 성능 기준)') +
                 (imdgOk ? '' : ' — 형식 확인 필요(' + [!unOk && 'UN 번호', !clsOk && '등급', !pgOk && '포장등급'].filter(Boolean).join(' · ') + ')')) : '-'),
        chk(!conc.length, '농도 · 분류 교차검증',
            conc.length ? conc.map(function (x) { return x.text; }).join(' / ') : '농도 기준 대상 성분 없음 또는 분류와 일치'),
        chk(true, '해양오염물질 · 분리기준', marine ? 'Marine Pollutant — IMDG 분리·표기 기준 적용' : '해당 없음'),
        chk(!lawReview.length, '근거 법령 현행 대조',
            RS.version + ' (검토 ' + RS.reviewedAt + ') · ' +
            (lawReview.length ? '재검토 필요 ' + lawReview.length + '건' : '규칙 재검토 대상 없음') +
            (lawStale.length ? ' · 카탈로그 갱신 필요 ' + lawStale.length + '건' : ''))
      ],
      warn: korConflict || !imdgOk || conc.length > 0 || lawReview.length > 0
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
            '요청 ' + qty + 'PL 수용 가능 ' + ranked.filter(function (r) { return r.wh.availPL >= qty; }).length + '개소'),
        (function () {
          var need = ranked.length ? ranked[0].cas.regulated : [];
          if (!need.length) return chk(true, 'CAS 단위 허가 품목', '화관법 관리 대상 성분 없음 — 유별 · 등급 단위 대조로 충분');
          var listed = ranked.filter(function (r) { return r.cas.status !== 'unknown'; });
          var okN = listed.filter(function (r) { return r.cas.status === 'match'; }).length;
          return chk(okN > 0, 'CAS 단위 허가 품목',
            need.map(function (x) { return x.name; }).join(' · ') + ' — 허가 품목 등록 ' + listed.length + '개소 중 일치 ' + okN + '개소' +
            (ranked.length - listed.length ? ' · 목록 미등록 ' + (ranked.length - listed.length) + '개소(인허가 원본 확인)' : ''));
        })()
      ],
      warn: fit.length === 0,
      ranked: ranked, fit: fit
    });

    /* 4 · 전문가 검토 · 승인 */
    var approved = !!(c.compliance && c.compliance.approver);
    var triggers = (V ? V.evaluate(c) : []).filter(function (h) { return h.key !== 'approval'; });
    gates.push({
      no: 4, title: '전문가 검토 · 승인',
      items: [
        chk(!gates[0].warn, '저신뢰 항목 확인', gates[0].warn ? '확인 필요' : '해당 없음'),
        chk(!gates[1].warn, '충돌 · 예외 확인', gates[1].warn ? '확인 필요' : '해당 없음'),
        chk(!triggers.length, '담당자 확인 전환 사유', triggers.length ? triggers.length + '건 — 아래 목록 참조' : '없음'),
        chk(approved, '위험물 / 법률 담당자 확인', approved ? c.compliance.approver : '미승인'),
        chk(true, '최종 의사결정 주체', '화주 · 창고 · 전문가 확인으로 확정')
      ],
      warn: !approved, approved: approved, triggers: triggers
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
    if (gates[0].warn || gates[1].warn || (g4.triggers && g4.triggers.length)) {
      return { verdict: 'COND', label: '조건부 검토',
               reason: '저신뢰 · 충돌 · 전환 사유 항목을 전문가가 확인했습니다 — 확인 의견의 조건 준수 시 보관 가능.' };
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
    var st = window.DGVerify ? window.DGVerify.lawStatus() : D.REGULATIONS.map(function (r) { return { reg: r, state: '' }; });
    var cls = { '현행 일치': 'badge-ok', '카탈로그 갱신 필요': 'badge-cond', '규칙 재검토 필요': 'badge-no', '수동 확인': 'badge-neutral' };
    $('regBody').innerHTML = st.map(function (s) {
      var r = s.reg;
      return '<tr>' +
        '<td class="strong">' + esc(r.name) + '</td>' +
        '<td>' + esc(r.authority) + '</td>' +
        '<td class="mono">' + esc(r.revised) + '</td>' +
        '<td><span class="mono">' + esc(r.effective || '-') + '</span>' +
          (s.state ? '<br><span class="badge ' + (cls[s.state] || 'badge-neutral') + '"><i></i>' + esc(s.state) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.note) + '</td>' +
        '</tr>';
    }).join('');
    var RS = D.RULESET || {};
    if ($('rulesetLine')) {
      $('rulesetLine').textContent = '판정 규칙 세트 ' + (RS.version || '-') + ' · 법령 대조 기준일 ' + (RS.reviewedAt || '-') + ' · ' + (RS.note || '');
    }
  }

  /* 담당자 확인 전환 사유 — 자동 확정하지 않는 이유를 목록으로 보여준다 */
  function renderTriggers(gates) {
    var box = $('triggerBox');
    if (!box) return;
    var list = (gates && gates[3] && gates[3].triggers) || [];
    box.innerHTML = list.length
      ? '<ul class="trigger-list">' + list.map(function (h) {
          return '<li><span class="badge badge-cond"><i></i>' + esc(h.label) + '</span> <span>' + esc(h.detail || '') + '</span></li>';
        }).join('') + '</ul>' +
        '<p class="src-note">위 사유가 하나라도 있으면 전문가 승인 후에도 판정은 \'적합\'이 아닌 \'조건부 검토\'로 남습니다.</p>'
      : '<p class="muted" style="font-size:13px;">전환 사유가 없습니다 — 전문가 승인 후 \'적합\'으로 확정될 수 있습니다.</p>';
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
    renderTriggers(gates);
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
          candidates: (gates[2].fit || []).length,
          /* 어떤 규칙 버전 · 어떤 시행일의 법령으로 판정했는지 남긴다 — 법령 개정 후 재검토 대상 식별용 */
          ruleset: (D.RULESET || {}).version || null,
          regs: D.REGULATIONS.map(function (r) { return { id: r.id, effective: r.effective || r.revised }; }),
          triggers: (gates[3].triggers || []).map(function (h) { return h.label + (h.detail ? ' — ' + h.detail : ''); })
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
