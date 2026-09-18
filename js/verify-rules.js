/* =========================================================
   Connect DG — 신뢰성 검증 규칙 (DGVerify)
   · CAS 체크디짓 · 농도-분류 상충 · 도로법 운행제한 · 위험물 운송기준(별표21)
   · 법령 변경 관리(카탈로그 갱신 · 규칙 재검토)
   · 담당자 확인 전환 기준 — 정보가 부족하거나 상충하면 자동 확정하지 않는다
   msds · compliance · matching · route · dispatch · verify 화면 공용.
   근거 법령 원문은 2026-09-18 국가법령정보(현행)로 확인했다(js/data_dg.js REGULATIONS).
   ========================================================= */
(function () {
  'use strict';

  function D() { return window.DGDATA || {}; }

  /* ---------- CAS 번호 ----------
     추출 과정에서 아래첨자·줄바꿈 때문에 '7722- 84- 1'처럼 공백이 끼거나 하이픈 변형이 섞인다.
     정규화한 뒤 체크디짓을 검사한다: 마지막 자리를 뺀 숫자를 오른쪽부터 1,2,3…을 곱해 더한 값 mod 10. */
  function normCas(s) {
    return String(s == null ? '' : s).replace(/\s+/g, '').replace(/[‐-―]/g, '-');
  }
  function casCheck(s) {
    var c = normCas(s);
    var m = /^(\d{2,7})-(\d{2})-(\d)$/.exec(c);
    if (!m) return { cas: c, format: false, valid: false };
    var digits = (m[1] + m[2]).split('').reverse();
    var sum = 0;
    for (var i = 0; i < digits.length; i++) sum += Number(digits[i]) * (i + 1);
    var expected = sum % 10;
    return { cas: c, format: true, valid: expected === Number(m[3]), expected: expected };
  }
  /* 문자열에서 CAS 형태 후보를 모두 찾는다 (공백 섞인 표기 포함) */
  function findCas(text) {
    return (String(text == null ? '' : text).match(/\d{2,7}\s*[-‐-―]\s*\d{2}\s*[-‐-―]\s*\d/g) || []).map(normCas);
  }
  /* 프로파일·추출값에 등장하는 모든 CAS 를 검사해 체크디짓 불일치만 돌려준다 */
  function casIssues(profile, extraction) {
    var seen = {}, bad = [];
    var push = function (text, where) {
      findCas(text).forEach(function (c) {
        if (seen[c]) return;
        seen[c] = true;
        var r = casCheck(c);
        if (r.format && !r.valid) bad.push({ cas: c, expected: r.expected, where: where });
      });
    };
    if (profile) {
      (profile.casNo || []).forEach(function (x) { push(x, '프로파일'); });
      (profile.components || []).forEach(function (x) { push(x.cas, '구성성분'); });
    }
    (extraction || []).forEach(function (row) { push(row.value, row.field); });
    return bad;
  }

  /* ---------- 농도 ---------- */
  /* '2~6%' · '30-60%' · '90% 이상' · '< 5 %' · '36%' → { min, max } */
  function parsePct(s) {
    var t = String(s == null ? '' : s).replace(/\s+/g, '');
    var nums = (t.match(/\d+(\.\d+)?/g) || []).map(Number);
    if (!nums.length) return null;
    if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
    if (/이상|≥|>=|>/.test(t)) return { min: nums[0], max: 100 };
    if (/이하|미만|≤|<=|</.test(t)) return { min: 0, max: nums[0] };
    return { min: nums[0], max: nums[0] };
  }

  /* 농도에 따라 분류가 달라지는 성분이 있으면 MSDS 기재 분류·국내 유별과 대조한다 */
  function concIssues(profile) {
    var out = [];
    if (!profile) return out;
    (D().CONC_RULES || []).forEach(function (rule) {
      var comp = (profile.components || []).filter(function (c) { return normCas(c.cas).indexOf(rule.cas) >= 0; })[0];
      if (!comp) return;
      var r = parsePct(comp.pct);
      if (!r) return;
      var cls = String(profile.hazardClass || '');
      /* UN 운송규정 규제 하한 미만인데 해당 등급이 기재된 경우 — 분류 근거 확인 */
      if (rule.unMinPct != null && r.max < rule.unMinPct && rule.unClasses.indexOf(cls) >= 0) {
        out.push({ key: 'conc', text: rule.name + ' ' + comp.pct + ' — UN 운송 규제 하한(' + rule.unMinPct + '%) 미만인데 Class ' + cls + ' 기재 · 분류 근거 확인' });
      }
      /* 국내 유별 경계에 걸친 농도 — 유별 판정 유보 */
      if (rule.korMinPct != null && r.min < rule.korMinPct && r.max >= rule.korMinPct) {
        out.push({ key: 'korPending', text: rule.name + ' ' + comp.pct + ' — 국내 제' + rule.korClass + ' 기준(' + rule.korMinPct + '%)에 걸친 농도 범위 · 유별 판정 유보' });
      }
      /* 국내 유별 해당 농도인데 프로파일이 비대상으로 표기한 경우 */
      if (rule.korMinPct != null && r.min >= rule.korMinPct && String(profile.korClass || '').indexOf('제' + rule.korClass) < 0) {
        out.push({ key: 'conc', text: rule.name + ' ' + comp.pct + ' — 국내 제' + rule.korClass + ' 해당 농도인데 유별 미기재' });
      }
    });
    return out;
  }

  /* ---------- 운송 ---------- */
  /* 도로법 시행령 제79조 ② — 차량 제원이 운행제한 기준을 넘으면 제한차량 운행허가 필요 */
  function roadLaw(v) {
    var L = D().ROAD_LIMITS || { axleT: 10, gvwT: 40, heightM: 4.0, heightNoticeM: 4.2 };
    var over = [];
    if (!v) return { ok: true, over: over };
    if (v.axleT > L.axleT) over.push('축하중 ' + v.axleT + 't > ' + L.axleT + 't');
    if (v.gvwT > L.gvwT) over.push('총중량 ' + v.gvwT + 't > ' + L.gvwT + 't');
    if (v.heightM > L.heightM) over.push('높이 ' + v.heightM + 'm > ' + L.heightM.toFixed(1) + 'm(고시 구간 ' + L.heightNoticeM.toFixed(1) + 'm)');
    return {
      ok: over.length === 0, over: over,
      note: over.length ? '도로관리청 제한차량 운행허가 필요 — ' + over.join(' · ') : '도로법 운행제한 기준 이내'
    };
  }

  /* 위험물안전관리법 시행규칙 별표21 2.나 — 이동탱크저장소 장거리 운송 시 운전자 2명 이상 */
  function driverRule(route, vehicle, profile) {
    var R = D().DRIVER_RULE || { highwayKm: 340, otherKm: 200, exemptKor: ['2류', '4류'] };
    var kor = window.DGMatch && profile ? window.DGMatch.requiredPermits(profile).kor : null;
    if (!route || !vehicle) return { applies: false, twoDrivers: false, text: '경로 · 차량 미확정' };
    if (!/탱크로리|이동탱크/.test(vehicle.type || '')) {
      return { applies: false, twoDrivers: false, text: '이동탱크저장소 운송이 아님 — 장거리 2인 기준 비대상' };
    }
    if (!kor) return { applies: false, twoDrivers: false, text: '국내 위험물(유별) 비대상 화물 — 장거리 2인 기준 비대상' };
    var highway = /고속/.test(route.name || '');
    var limit = highway ? R.highwayKm : R.otherKm;
    if (route.distanceKm < limit) {
      return { applies: true, twoDrivers: false, text: '장거리 기준(' + (highway ? '고속국도 ' : '그 밖의 도로 ') + limit + 'km) 미만' };
    }
    if (R.exemptKor.indexOf(kor) >= 0) {
      return { applies: true, twoDrivers: false, text: '장거리이나 제' + kor + ' 운송 — 2인 기준 예외(특수인화물 여부 확인)' };
    }
    return { applies: true, twoDrivers: true, text: '장거리 ' + route.distanceKm + 'km — 운전자 2명 이상 (예외: 운송책임자 동승 · 2시간마다 20분 이상 휴식)' };
  }

  /* ---------- 법령 변경 관리 ---------- */
  /* 카탈로그 기준일(revised)과 현행 시행일(effective)을 비교하고,
     규칙 세트 검토일 이후에 시행되는 개정이 있으면 영향 규칙을 재검토 대상으로 표시한다 */
  function lawStatus() {
    var rs = D().RULESET || {};
    return (D().REGULATIONS || []).map(function (g) {
      var rev = String(g.revised || '').slice(0, 10);
      var eff = String(g.effective || '').slice(0, 10);
      var catalogStale = !!(eff && rev && rev !== eff);
      var ruleReview = !!(eff && rs.reviewedAt && eff > rs.reviewedAt);
      return {
        reg: g, catalogStale: catalogStale, ruleReview: ruleReview,
        state: ruleReview ? '규칙 재검토 필요' : catalogStale ? '카탈로그 갱신 필요' : (g.checkedAt ? '현행 일치' : '수동 확인')
      };
    });
  }

  /* 지정수량 조회 — 국내 유별과 품명으로 찾는다 */
  function designatedQty(kor, item) {
    if (!kor || !item) return null;
    return (D().DESIGNATED_QTY || []).filter(function (x) { return x.kor === kor && String(item).indexOf(x.item) >= 0; })[0] || null;
  }

  /* ---------- 담당자 확인 전환 기준 ----------
     impl: 구현 · 부분 · 미구현 — 화면(구현·검증)에 그대로 노출해 현재 범위를 숨기지 않는다 */
  var TRIGGERS = [
    { key: 'approval', label: '전문가 승인 전', example: '모든 건 — 승인 전에는 최종 판정을 확정하지 않음', impl: '구현' },
    { key: 'missing', label: '필수 필드 누락', example: 'UN No. · Hazard Class 미기재', impl: '구현' },
    { key: 'lowconf', label: '추출 신뢰도 80% 미만', example: '흐린 스캔의 성분 · 함유량', impl: '구현' },
    { key: 'accuracy', label: '인식 적합도 85점 미만 · 실문서', example: '정답지 없는 업로드 문서', impl: '구현' },
    { key: 'cas', label: 'CAS 체크디짓 불일치', example: '12190-79-7 (정답 12190-79-3)', impl: '구현' },
    { key: 'conc', label: '농도 · 분류 상충', example: 'H₂O₂ 2~6%인데 Class 5.1 기재', impl: '구현' },
    { key: 'korPending', label: '국내 유별 판정 유보', example: '농도 범위가 유별 기준에 걸친 물질', impl: '구현' },
    { key: 'docNote', label: '문서 표기 충돌(검토 메모)', example: '문서의 국내 법령 표기와 UN 분류 불일치', impl: '구현' },
    { key: 'dqty', label: '지정수량 환산 불가', example: '국내 위험물인데 품명 · 환산 정보 없음', impl: '구현' },
    { key: 'subrisk', label: '부차위험 허가 미보유 창고', example: 'Class 5.1(8) → Class 8 허가 없음', impl: '구현' },
    { key: 'casPermit', label: '창고 허가 품목(CAS) 미등재', example: 'Class 9 허가는 있으나 코발트 화합물 미등재', impl: '구현' },
    { key: 'law', label: '근거 법령 개정 · 규칙 재검토', example: '규칙 검토일 이후 시행되는 개정', impl: '부분' }
  ];

  /* 케이스 단위로 전환 기준을 평가한다 — hits 가 하나라도 있으면 자동 확정 불가 */
  function evaluate(c) {
    c = c || {};
    var p = c.msds && c.msds.profile;
    var ex = (c.msds && c.msds.extraction) || [];
    var acc = c.msds && c.msds.accuracy;
    var hits = [];
    var hit = function (key, detail) {
      var def = TRIGGERS.filter(function (t) { return t.key === key; })[0] || { label: key };
      hits.push({ key: key, label: def.label, detail: detail });
    };
    if (!p) return hits;

    if (acc && acc.missing && acc.missing.length) hit('missing', acc.missing.join(', '));
    var low = ex.filter(function (e) { return typeof e.conf === 'number' && e.conf < 0.8; });
    if (low.length) hit('lowconf', low.map(function (e) { return e.field + ' ' + Math.round(e.conf * 100) + '%'; }).join(', '));
    if (!acc) hit('accuracy', '적합도 미측정 — MSDS 단계 재확인');
    else if (acc.mode === 'proxy' || Number(acc.score) < 85) hit('accuracy', acc.score + '점 · ' + (acc.mode === 'proxy' ? '실문서 자동 산정' : '기준 미달'));

    casIssues(p, ex).forEach(function (b) { hit('cas', b.cas + ' (체크디짓 ' + b.expected + ' 기대 · ' + b.where + ')'); });
    concIssues(p).forEach(function (x) { hit(x.key, x.text); });
    /* ⚠ 표기는 그대로 둔다 — 다국어 사전이 원문 그대로의 문장을 키로 갖고 있다 */
    if (String(p.korNote || '').indexOf('⚠') === 0) hit('docNote', String(p.korNote));

    var req = window.DGMatch ? window.DGMatch.requiredPermits(p) : { kor: null };
    if (req.kor && !designatedQty(req.kor, p.korItem)) hit('dqty', '제' + req.kor + ' — 품명별 지정수량 확인 필요');

    lawStatus().forEach(function (s) {
      if (s.ruleReview) hit('law', s.reg.name + ' 시행 ' + s.reg.effective + ' — 규칙 재검토 전');
    });

    var approved = !!(c.compliance && c.compliance.approver);
    if (!approved) hit('approval', '위험물 / 법률 담당자 승인 대기');
    return hits;
  }

  window.DGVerify = {
    normCas: normCas,
    casCheck: casCheck,
    findCas: findCas,
    casIssues: casIssues,
    parsePct: parsePct,
    concIssues: concIssues,
    roadLaw: roadLaw,
    driverRule: driverRule,
    lawStatus: lawStatus,
    designatedQty: designatedQty,
    TRIGGERS: TRIGGERS,
    evaluate: evaluate
  };
})();
