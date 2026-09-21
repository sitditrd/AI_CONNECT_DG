/* =========================================================
   Connect DG — MSDS 추출 정확도 채점 (정답지 기반)
   정답지: test/eval/gold/<id>.json — 원본 PDF 를 사람이 대조해 옮긴 값(원문 표기 · 쪽수 · 원문 오기 포함)

   사용법
     node msds-eval.js                 시연 데이터(js/data_dg.js MSDS)를 정답지로 채점
     node msds-eval.js --pred <폴더>    분석 엔진 출력(<id>.json: { profile, extraction })을 채점
     node msds-eval.js --json          결과를 JSON 으로 출력

   채점 항목(문서당 10칸): 제품명 · UN No. · 운송명 · 등급 · 부차위험 · 포장등급 · 해양오염물질 · 터널코드 · CAS No. · 성분·함유량
   쪽수 항목: 추출표의 원문 위치(page)가 정답지 쪽수와 같은지
   ========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GOLD_DIR = path.join(__dirname, 'eval', 'gold');

function up(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function empty(v) { return v == null || v === '' || v === '—' || v === '-'; }
function roman(v) {
  const s = String(v == null ? '' : v).trim().toUpperCase().replace(/^PG\s*/, '');
  return ({ '1': 'I', '2': 'II', '3': 'III' })[s] || s;
}
function normCas(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
function casList(arr) {
  const out = [];
  (arr || []).forEach((x) => {
    const m = String(x == null ? '' : x).match(/\d{2,7}\s*-\s*\d{2}\s*-\s*\d/g);
    (m || []).forEach((c) => { const n = normCas(c); if (out.indexOf(n) < 0) out.push(n); });
  });
  return out.sort();
}
/* '10-20%' · 'Less than 2~6%' · '<5 %' · '2~6%' → '10-20' · '2-6' · '<5' */
function pct(s) {
  return String(s == null ? '' : s).replace(/less\s*than/ig, '').replace(/\s+/g, '').replace(/%/g, '').replace(/~/g, '-');
}

/* ---------- 필드 채점기 ---------- */
const FIELDS = [
  ['productName', '제품명', (p, g) => up(p.productName).indexOf(up(g.key)) >= 0],
  ['unNo', 'UN No.', (p, g) => String(p.unNo || '').replace(/\D/g, '') === String(g.v).replace(/\D/g, '')],
  ['psn', '운송명', (p, g) => up(p.psn).indexOf(up(g.v)) === 0],
  ['hazardClass', '등급', (p, g) => String(p.hazardClass || '').trim() === g.v],
  ['subRisk', '부차위험', (p, g) => (empty(g.v) ? empty(p.subRisk) : String(p.subRisk || '').trim() === g.v)],
  ['packingGroup', '포장등급', (p, g) => (empty(g.v) ? empty(p.packingGroup) : roman(p.packingGroup) === g.v)],
  ['marinePollutant', '해양오염물질', (p, g) => (g.v == null ? p.marinePollutant == null : p.marinePollutant === g.v)],
  ['tunnelCode', '터널코드', (p, g) => (empty(g.v) ? empty(p.tunnelCode) : String(p.tunnelCode || '').trim() === g.v)],
  ['casNo', 'CAS No.', (p, g) => {
    const pred = casList((p.casNo || []).concat((p.components || []).map((c) => c.cas)));
    return JSON.stringify(pred) === JSON.stringify(g.v.slice().sort());
  }],
  ['components', '성분 · 함유량', (p, g) => {
    const byCas = {};
    (p.components || []).forEach((c) => casList([c.cas]).forEach((k) => { byCas[k] = c; }));
    const want = g.v.filter((c) => c.cas);
    const extra = Object.keys(byCas).filter((k) => !want.some((c) => c.cas === k));
    return !extra.length && want.every((c) => byCas[c.cas] && pct(byCas[c.cas].pct) === pct(c.pct));
  }]
];

/* 추출표 행 → 정답지 필드(쪽수 채점용) */
const ROW_FIELD = {
  '제품명': 'productName', 'CAS No.': 'casNo', '구성성분 · 함유량': 'components', 'UN Number': 'unNo',
  'Proper Shipping Name': 'psn', 'Hazard Class': 'hazardClass', 'Packing Group': 'packingGroup',
  'Marine Pollutant': 'marinePollutant', '터널 제한코드': 'tunnelCode'
};

function score(pred, gold) {
  const p = pred.profile || {};
  const fields = FIELDS.map(([key, label, fn]) => {
    const g = gold.fields[key];
    const ok = !!(g && fn(p, g));
    return { key, label, ok, expected: g ? (g.v !== undefined ? g.v : g.key) : null, actual: key === 'components' ? (p.components || []).map((c) => c.cas + ' ' + c.pct) : p[key] };
  });
  const pages = (pred.extraction || []).filter((r) => ROW_FIELD[r.field] && gold.fields[ROW_FIELD[r.field]] && gold.fields[ROW_FIELD[r.field]].page)
    .map((r) => {
      const g = gold.fields[ROW_FIELD[r.field]];
      return { field: r.field, ok: Number(r.page) === g.page, expected: g.page, actual: r.page };
    });
  const pagesOk = pred.pages === gold.pages;
  return {
    id: gold.id,
    fieldCorrect: fields.filter((f) => f.ok).length, fieldTotal: fields.length,
    pageCorrect: pages.filter((x) => x.ok).length, pageTotal: pages.length,
    pageCountOk: pagesOk, pageCount: { expected: gold.pages, actual: pred.pages },
    misses: fields.filter((f) => !f.ok), pageMisses: pages.filter((x) => !x.ok)
  };
}

function loadGold() {
  return fs.readdirSync(GOLD_DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(GOLD_DIR, f), 'utf8')));
}
function loadDemo() {
  const sandbox = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'js', 'data_dg.js'), 'utf8'))(sandbox);
  const out = {};
  sandbox.DGDATA.MSDS.forEach((m) => { out[m.id] = { profile: m.profile, extraction: m.extraction, pages: m.pages }; });
  return out;
}

function run(opts) {
  const gold = loadGold();
  let preds;
  if (opts.pred) {
    preds = {};
    gold.forEach((g) => {
      const f = path.join(opts.pred, g.id + '.json');
      if (fs.existsSync(f)) preds[g.id] = JSON.parse(fs.readFileSync(f, 'utf8'));
    });
  } else preds = loadDemo();
  const results = gold.filter((g) => preds[g.id]).map((g) => score(preds[g.id], g));
  const sum = (k) => results.reduce((a, r) => a + r[k], 0);
  return {
    source: opts.pred ? 'engine:' + opts.pred : 'demo:js/data_dg.js',
    results,
    total: { fieldCorrect: sum('fieldCorrect'), fieldTotal: sum('fieldTotal'), pageCorrect: sum('pageCorrect'), pageTotal: sum('pageTotal'),
             pageCountOk: results.filter((r) => r.pageCountOk).length, docs: results.length }
  };
}

module.exports = { score, run, loadGold, pct, casList, roman };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = { pred: argv.indexOf('--pred') >= 0 ? argv[argv.indexOf('--pred') + 1] : null, json: argv.indexOf('--json') >= 0 };
  const out = run(opts);
  if (opts.json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
  console.log('채점 대상: ' + out.source);
  out.results.forEach((r) => {
    console.log('\n' + r.id + ' — 필드 ' + r.fieldCorrect + '/' + r.fieldTotal + ' · 쪽수 ' + r.pageCorrect + '/' + r.pageTotal +
      ' · 총 쪽수 ' + (r.pageCountOk ? '일치' : '불일치(' + r.pageCount.actual + ' → 원본 ' + r.pageCount.expected + ')'));
    r.misses.forEach((m) => console.log('   ✕ ' + m.label + ' — 정답 ' + JSON.stringify(m.expected) + ' / 입력 ' + JSON.stringify(m.actual)));
    r.pageMisses.forEach((m) => console.log('   ✕ 쪽수 ' + m.field + ' — 원본 p.' + m.expected + ' / 입력 p.' + m.actual));
  });
  const t = out.total;
  console.log('\n합계 — 필드 ' + t.fieldCorrect + '/' + t.fieldTotal + ' (' + Math.round(t.fieldCorrect / t.fieldTotal * 100) + '%) · 쪽수 ' +
    t.pageCorrect + '/' + t.pageTotal + ' · 총 쪽수 일치 ' + t.pageCountOk + '/' + t.docs);
  /* 시연 데이터 채점은 회귀 테스트 — 원본과 한 칸이라도 어긋나면 실패로 끝낸다(분석 엔진 실측은 점수만 보고) */
  if (!opts.pred && (t.fieldCorrect < t.fieldTotal || t.pageCorrect < t.pageTotal || t.pageCountOk < t.docs)) process.exitCode = 1;
}
