/* =========================================================
   Connect DG — 매칭 · 적합성 평가 엔진 (발표자료 18·19장)
   compliance.html · matching.html 공용
   · '종합 추천점수'는 후보 간 우선순위 지표이며,
     법적 적합성을 확률로 보증하는 수치가 아닙니다.
   ========================================================= */
(function () {
  'use strict';

  /* 프로파일이 요구하는 허가 토큰 */
  function requiredPermits(profile) {
    if (!profile) return { primary: null, sub: null, kor: null };
    return {
      primary: 'Class ' + profile.hazardClass,
      sub: profile.subRisk ? 'Class ' + profile.subRisk : null,
      kor: (profile.korClass && profile.korClass.indexOf('제') === 0) ? profile.korClass.slice(0, 3) : null
    };
  }

  function daysUntil(dateStr) {
    if (!dateStr) return 0;
    return Math.round((new Date(dateStr) - new Date()) / 86400000);
  }

  /* ---------- 개별 지표 (0~100) ---------- */
  function scoreLegal(w, req) {
    var has = function (t) { return t && w.permitClasses.indexOf(t) >= 0; };
    if (!has(req.primary)) return 0;                  /* 주 등급 허가 없음 → 제외 */
    if (req.sub && !has(req.sub)) return 62;          /* 부차위험성 허가 미보유 → 조건부 */
    return 100;
  }

  function scorePermit(w, qtyPL) {
    var s = 100;
    var d = daysUntil(w.inspectionValidUntil);
    if (d < 0) s -= 55;                               /* 정기검사 유효기간 경과 */
    else if (d < 60) s -= 18;                         /* 만료 임박 */
    else if (d < 120) s -= 8;
    if (w.designatedMultiple < qtyPL * 8) s -= 10;    /* 지정수량 배수 여유 부족 */
    if (w.safetyManagers < 2) s -= 8;
    s += Math.min(10, (w.certs.length - 3) * 3);      /* 시설조건 가점 */
    return Math.max(0, Math.min(100, s));
  }

  function scoreCapacity(w, qtyPL, tempNeed) {
    if (!w.availPL) return 0;
    var r = w.availPL / Math.max(1, qtyPL);
    var s = r >= 1.5 ? 100 : r >= 1 ? 88 : r >= 0.6 ? 58 : 34;
    if (tempNeed && w.tempZones.indexOf(tempNeed) < 0) s -= 20;
    return Math.max(0, s);
  }

  function scoreSafety(w) {
    var s = w.incidents3y === 0 ? 100 : w.incidents3y === 1 ? 72 : 46;
    s += Math.min(8, (w.safetyManagers - 2) * 4);
    return Math.max(0, Math.min(100, s));
  }

  function scoreAccess(w, region) {
    var s = 100;
    s -= Math.min(35, w.portKm * 0.6);
    s -= Math.min(12, w.icKm * 1.2);
    if (w.ops.indexOf('24시간') >= 0) s += 10;
    if (region && region !== '무관' && w.region === region) s += 12;
    return Math.max(0, Math.min(100, s));
  }

  function scoreCost(w, all) {
    var min = Math.min.apply(null, all.map(function (x) { return x.ratePLDay; }));
    var max = Math.max.apply(null, all.map(function (x) { return x.ratePLDay; }));
    if (max === min) return 100;
    return Math.round(100 - ((w.ratePLDay - min) / (max - min)) * 100);
  }

  /* ---------- 종합 평가 ---------- */
  function evaluate(w, ctx, weights, all) {
    var req = requiredPermits(ctx.profile);
    var parts = {
      legal: scoreLegal(w, req),
      permit: scorePermit(w, ctx.qtyPL),
      capacity: scoreCapacity(w, ctx.qtyPL, ctx.tempNeed),
      safety: scoreSafety(w),
      access: scoreAccess(w, ctx.region),
      cost: scoreCost(w, all)
    };

    var total = 0, wsum = 0;
    weights.forEach(function (k) { total += (parts[k.key] || 0) * k.w; wsum += k.w; });
    var score = Math.round(total / Math.max(1, wsum));

    /* 판정 */
    var verdict, label, reason;
    var expired = daysUntil(w.inspectionValidUntil) < 0;

    if (parts.legal === 0) {
      verdict = 'NO'; label = '보관 불가';
      reason = '해당 위험물 유별(' + req.primary + ') 허가 없음 · 포장등급/최대 저장수량 조건 불충족';
    } else if (expired) {
      verdict = 'NO'; label = '보관 불가';
      reason = '정기검사 유효기간 경과(' + w.inspectionValidUntil + ') — 재검사 완료 전 입고 불가';
    } else if (w.availPL === 0) {
      verdict = 'REVIEW'; label = '후보 보류';
      reason = '허가조건은 충족하나 현재 가동률 100% — 공간 확보 시 재검토 가능';
    } else if (w.availPL < ctx.qtyPL) {
      verdict = 'COND'; label = '조건부 검토';
      reason = '허가는 충족하나 입고 예정일 가용공간 부족(' + w.availPL + 'PL / 요청 ' + ctx.qtyPL + 'PL) — 일정 조정 또는 분할 입고 필요';
    } else if (parts.legal < 100) {
      verdict = 'COND'; label = '조건부 검토';
      reason = '부차위험성(' + req.sub + ') 허가 미보유 — 분리보관 조건·전문가 확인 필요';
    } else if (score >= 90) {
      verdict = 'OK'; label = '적합 후보';
      reason = '허가 범위 · 저장한도 · 가용공간 충족, 최근 안전검사 · 보험 조건 확인';
    } else if (score >= 75) {
      verdict = 'COND'; label = '조건부 검토';
      reason = '허가는 충족하나 접근성·안전이력 등 일부 지표가 기준 미만 — 조건 확인 후 진행';
    } else {
      verdict = 'REVIEW'; label = '전문가 확인 필요';
      reason = '복수 지표가 기준 미만 — 위험물/법률 담당자 확인 후 결정';
    }

    return { wh: w, parts: parts, score: score, verdict: verdict, label: label, reason: reason };
  }

  function rank(list, ctx, weights) {
    var all = list.slice();
    var out = all.map(function (w) { return evaluate(w, ctx, weights, all); });
    var order = { OK: 0, COND: 1, REVIEW: 2, NO: 3 };
    out.sort(function (a, b) {
      if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
      return b.score - a.score;
    });
    return out;
  }

  /* ---------- 차량 적합성 ---------- */
  function rankVehicles(list, ctx) {
    var req = requiredPermits(ctx.profile);
    return list.map(function (v) {
      var ok = v.classes.indexOf(req.primary) >= 0;
      var cap = v.capacityPL > 0 ? Math.ceil(ctx.qtyPL / v.capacityPL) : null;  /* 필요 회차 */
      var note = !ok ? '해당 등급 운송 자격·차량 구조 미충족'
        : (cap && cap > 12 ? '적재 가능하나 ' + cap + '회 분할 운송 필요' : '적재 · 자격 요건 충족');
      return { v: v, ok: ok, trips: cap, note: note };
    }).sort(function (a, b) {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return (a.trips || 99) - (b.trips || 99);
    });
  }

  window.DGMatch = {
    requiredPermits: requiredPermits,
    daysUntil: daysUntil,
    evaluate: evaluate,
    rank: rank,
    rankVehicles: rankVehicles
  };
})();
