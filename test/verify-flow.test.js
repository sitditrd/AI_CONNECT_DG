/* Connect DG — 신뢰성 검증 기능 통합 회귀
   각 화면 HTML 을 실제 <script> 순서 그대로 jsdom 에 띄우고, 케이스 상태를 주입해 관측한다.
   · 검증 규칙 단위(CAS · 농도 · 도로법 · 운송기준 · 법령 대조)
   · MSDS 원문 대조 수정 · 적법성 게이트 · 전환 사유 · CAS 허가 품목 · 경로 운송 기준 · 구현·검증 페이지 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = process.argv[2] || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 페이지를 띄운다 — setup(w) 는 스크립트 실행 전에 localStorage · 스텁을 주입한다 */
async function boot(page, setup) {
  let html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const scripts = [...html.matchAll(/<script src="(js\/[^"?]+)(?:\?[^"]*)?"><\/script>/g)].map((m) => m[1]);
  html = html.replace(/<link[^>]*cdn\.jsdelivr\.net[^>]*>/g, '').replace(/<script src="js\/[^"]*"><\/script>/g, '');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Could not load|Not implemented/.test(String(e && e.message))) errors.push(String(e && e.message)); });
  const dom = new JSDOM(html, { url: 'https://x.test/' + page, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.fetch = () => Promise.reject(new Error('offline'));   /* 원격 없이 시드 데이터로 동작 */
  /* jsdom 에는 matchMedia 가 없다(브라우저에는 있음) — 테마 · 모션 감지용 최소 스텁 */
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  w.addEventListener('error', (e) => errors.push(String(e.message)));
  if (setup) setup(w);
  for (const rel of scripts) {
    const s = w.document.createElement('script');
    s.textContent = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    w.document.head.appendChild(s);
  }
  /* DOMContentLoaded 는 jsdom 이 자연 발화시킨다 — 수동 dispatch 하면 리스너가 중복 실행된다 */
  await new Promise((r) => { if (w.document.readyState !== 'loading') r(); else w.document.addEventListener('DOMContentLoaded', () => r()); });
  await sleep(150);
  return { w, errors };
}

function sampleCase(w, id, extra) {
  global.window = global.window || {};
  const D = loadData();
  const m = D.MSDS.find((x) => x.id === id);
  const c = Object.assign({
    caseNo: 'DG-TEST-01',
    request: { qtyPL: 40, region: '무관', from: '평택항' },
    msds: { id: m.id, title: m.title, fileName: m.fileName, pages: m.pages, profile: m.profile, extraction: m.extraction,
            accuracy: { score: 92, grade: 'A', mode: 'reference', action: 'pass', missing: [], lowConfidence: [], conflicts: [] },
            analyzedAt: '2026-09-18 10:00' },
    logs: []
  }, extra || {});
  w.localStorage.setItem('dg-case', JSON.stringify(c));
  return c;
}

let _data = null;
function loadData() {
  if (_data) return _data;
  const sandbox = {};
  const code = fs.readFileSync(path.join(ROOT, 'js/data_dg.js'), 'utf8');
  new Function('window', code)(sandbox);
  _data = sandbox.DGDATA;
  return _data;
}

(async () => {
  console.log('\n=== 1. 검증 규칙 단위 ===');
  {
    const { w, errors } = await boot('verify.html');
    const V = w.DGVerify;
    ok('CAS 정상 12190-79-3', V.casCheck('12190-79-3').valid);
    ok('CAS 오타 12190-79-7 검출', !V.casCheck('12190-79-7').valid && V.casCheck('12190-79-7').expected === 3);
    ok('공백 섞인 CAS 정규화', V.casCheck('7722- 84- 1').valid);
    const D = w.DGDATA;
    ok('샘플 3종 CAS 전부 유효', D.MSDS.every((m) => V.casIssues(m.profile, m.extraction).length === 0));
    const c3098 = V.concIssues(D.MSDS.find((m) => m.id === 'MSDS-3098').profile);
    ok('3098 농도-분류 상충 검출', c3098.some((x) => x.key === 'conc'), JSON.stringify(c3098));
    ok('3077 농도 규칙 비대상', V.concIssues(D.MSDS[0].profile).length === 0);
    const h2o2Border = { hazardClass: '5.1', korClass: null, components: [{ cas: '7722-84-1', pct: '30~40%' }] };
    ok('과산화수소 30~40% → 유별 판정 유보', V.concIssues(h2o2Border).some((x) => x.key === 'korPending'));
    const h2o2Kor = { hazardClass: '5.1', korClass: null, components: [{ cas: '7722-84-1', pct: '50%' }] };
    ok('과산화수소 50%인데 유별 미기재 → 상충', V.concIssues(h2o2Kor).some((x) => x.key === 'conc'));
    ok('도로법 — V-01 기준 이내', V.roadLaw(D.VEHICLES[0]).ok);
    ok('도로법 — V-02 축하중 초과', !V.roadLaw(D.VEHICLES[1]).ok && /축하중 11.5t/.test(V.roadLaw(D.VEHICLES[1]).note));
    ok('도로법 — V-03 높이 초과', /높이 4.1m > 4.0m/.test(V.roadLaw(D.VEHICLES[2]).note), V.roadLaw(D.VEHICLES[2]).note);
    const longHwy = D.ROUTES['W-03'][0];   /* 고속 402km */
    const lorry = D.VEHICLES[1];
    ok('운송기준 — 국내 비대상 화물은 미적용', !V.driverRule(longHwy, lorry, D.MSDS[2].profile).applies);
    const kor6 = Object.assign({}, D.MSDS[2].profile, { korClass: '제6류 과산화수소' });
    ok('운송기준 — 제6류 · 탱크로리 · 고속 402km → 2인', V.driverRule(longHwy, lorry, kor6).twoDrivers);
    const kor4 = Object.assign({}, D.MSDS[2].profile, { korClass: '제4류 제1석유류' });
    ok('운송기준 — 제4류는 예외', !V.driverRule(longHwy, lorry, kor4).twoDrivers);
    ok('운송기준 — 박스 차량은 비대상', !V.driverRule(longHwy, D.VEHICLES[0], kor6).applies);
    const short = { name: '국도 우회', distanceKm: 199 };
    ok('운송기준 — 국도 199km 는 장거리 미만', !V.driverRule(short, lorry, kor6).twoDrivers);
    const st = V.lawStatus();
    ok('법령 9건 대조', st.length === 9, 'len=' + st.length);
    ok('카탈로그 갱신 필요 4건 탐지', st.filter((s) => s.catalogStale).length === 4, st.map((s) => s.reg.id + ':' + s.state).join(', '));
    ok('규칙 재검토 대상 0건(검토일 기준)', st.filter((s) => s.ruleReview).length === 0);
    ok('지정수량 조회 — 제4류 제1석유류(비수용성) 200L', (V.designatedQty('4류', '제1석유류(비수용성)') || {}).qty === 200);

    console.log('\n=== 2. 구현·검증 페이지 ===');
    ok('구현 범위 17행', w.document.querySelectorAll('#scopeBody tr').length === 17, w.document.querySelectorAll('#scopeBody tr').length);
    ok('전환 기준 13행', w.document.querySelectorAll('#triggerBody tr').length === 13);
    ok('법령 대조 9행', w.document.querySelectorAll('#lawBody tr').length === 9);
    ok('문서 처리 절차 4단계', w.document.querySelectorAll('#docSteps .step').length === 4);
    ok('법령 관리 절차 5단계', w.document.querySelectorAll('#lawSteps .step').length === 5);
    ok('규칙 세트 배지', /DG-RULES 2026\.09/.test(w.document.getElementById('rulesetBadge').textContent));
    ok('검증 페이지 런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 3. 적법성 검토 — 3098 (상충 · 저신뢰) ===');
  {
    const { w, errors } = await boot('compliance.html', (w) => sampleCase(w, 'MSDS-3098'));
    w.document.getElementById('runBtn').click();
    await sleep(60);
    const gates = w.document.getElementById('gates').textContent;
    ok('게이트에 CAS 체크디짓 항목', /CAS 체크디짓/.test(gates));
    ok('게이트에 농도 · 분류 교차검증 위반', /농도 · 분류 교차검증 — 과산화수소 (Less than )?2~6%/.test(gates), gates.slice(0, 300));
    ok('게이트에 근거 법령 현행 대조', /근거 법령 현행 대조 — DG-RULES 2026\.09/.test(gates));
    ok('게이트에 CAS 단위 허가 품목', /CAS 단위 허가 품목/.test(gates));
    const trig = w.document.getElementById('triggerBox').textContent;
    ok('전환 사유 — 농도 상충', /농도 · 분류 상충/.test(trig), trig.slice(0, 200));
    ok('전환 사유 — 저신뢰', /추출 신뢰도 80% 미만/.test(trig));
    const c = JSON.parse(w.localStorage.getItem('dg-case'));
    ok('승인 전 판정 = 전문가 확인 필요', c.compliance.verdict === 'REVIEW', c.compliance.verdict);
    ok('판정에 규칙 세트 기록', c.compliance.ruleset === 'DG-RULES 2026.09');
    ok('판정에 근거 법령 시행일 기록', Array.isArray(c.compliance.regs) && c.compliance.regs.length === 9);
    ok('판정에 전환 사유 기록', (c.compliance.triggers || []).length >= 2);
    w.alert = () => {};
    w.document.getElementById('approver').value = '김안전';
    w.document.getElementById('approveBtn').click();
    await sleep(60);
    const c2 = JSON.parse(w.localStorage.getItem('dg-case'));
    ok('승인 후에도 전환 사유가 있으면 조건부', c2.compliance.verdict === 'COND', c2.compliance.verdict);
    ok('법령 표 현행 시행일 · 상태', /카탈로그 갱신 필요/.test(w.document.getElementById('regBody').textContent));
    ok('적법성 화면 런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 4. 적법성 검토 — 3077 (전환 사유 없음) ===');
  {
    const { w, errors } = await boot('compliance.html', (w) => sampleCase(w, 'MSDS-3077', { compliance: { approver: '김안전' } }));
    w.alert = () => {};
    w.document.getElementById('runBtn').click();
    await sleep(60);
    const c = JSON.parse(w.localStorage.getItem('dg-case'));
    ok('승인 + 전환 사유 없음 → 적합', c.compliance.verdict === 'OK', c.compliance.verdict + ' / ' + (c.compliance.triggers || []).join(','));
    ok('CAS 단위 허가 품목 — 코발트 화합물 대조 표시', /산화코발트\(코발트 화합물\)/.test(w.document.getElementById('gates').textContent));
    ok('런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 4b. 게이트 경고 없이 전환 사유만 남은 경우 ===');
  {
    /* 국내 유별이 확정됐는데 품명(지정수량) 정보가 없는 화물 — 게이트 1·2 는 통과하지만 전환 사유가 남는다.
       '전환 사유가 있으면 승인 후에도 조건부' 규칙만 단독으로 검증하는 케이스 */
    const D = loadData();
    const base = D.MSDS.find((x) => x.id === 'MSDS-3077');
    const profile = Object.assign({}, base.profile, { korClass: '제4류 인화성 액체', korNote: '제4류 해당' });
    const { w, errors } = await boot('compliance.html', (w) => {
      const c = sampleCase(w, 'MSDS-3077', { compliance: { approver: '김안전' } });
      c.msds.profile = profile;
      w.localStorage.setItem('dg-case', JSON.stringify(c));
    });
    w.alert = () => {};
    w.document.getElementById('runBtn').click();
    await sleep(60);
    const c = JSON.parse(w.localStorage.getItem('dg-case'));
    const gates = w.document.querySelectorAll('#gates .gate');
    ok('게이트 1 · 2 는 경고 없음', gates[0].classList.contains('pass') && gates[1].classList.contains('pass'),
       [...gates].map((g) => g.className).join(' | '));
    ok('전환 사유 — 지정수량 환산 불가', (c.compliance.triggers || []).some((t) => /지정수량 환산 불가/.test(t)), (c.compliance.triggers || []).join(' / '));
    ok('승인됐어도 전환 사유만으로 조건부', c.compliance.verdict === 'COND', c.compliance.verdict);
    ok('런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 5. 창고 매칭 — CAS 허가 품목 ===');
  {
    const { w, errors } = await boot('matching.html', (w) => sampleCase(w, 'MSDS-3077'));
    const list = w.document.getElementById('whList').textContent;
    ok('W-08 은 허가 품목(CAS) 미등재로 조건부', /허가 품목\(CAS\) 미등재/.test(list), list.slice(0, 200));
    const r = w.DGMatch.rank(w.DGDATA.WAREHOUSES, { profile: w.DGDATA.MSDS[0].profile, qtyPL: 40, region: '무관' }, w.DGDATA.WEIGHTS);
    const w08 = r.find((x) => x.wh.id === 'W-08'), w01 = r.find((x) => x.wh.id === 'W-01'), w06 = r.find((x) => x.wh.id === 'W-06');
    ok('W-08 COND · cas=missing', w08.verdict === 'COND' && w08.cas.status === 'missing');
    ok('W-01 OK · cas=match', w01.verdict === 'OK' && w01.cas.status === 'match');
    ok('W-06 목록 미등록은 판정 영향 없음', w06.verdict === 'OK' && w06.cas.status === 'unknown');
    ok('3480 배터리(물품)는 CAS 허가 대조 비대상', w.DGMatch.casPermit(w.DGDATA.WAREHOUSES[7], w.DGDATA.MSDS[1].profile).status === 'article');
    ok('관리 대상 성분이 없으면 CAS 대조 비대상', w.DGMatch.casPermit(w.DGDATA.WAREHOUSES[7], { components: [{ cas: '7732-18-5' }] }).status === 'na');
    const vl = w.document.getElementById('vehList').textContent;
    ok('차량 목록에 도로법 운행제한 표시', /도로관리청 제한차량 운행허가 필요/.test(vl));
    ok('런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 6. 안전경로 — 구분 · 운송 기준 ===');
  {
    const wh = loadData().WAREHOUSES.find((x) => x.id === 'W-03');
    const { w, errors } = await boot('route.html', (w) => sampleCase(w, 'MSDS-3098', { warehouse: { id: wh.id, alias: wh.alias }, route: { id: 'R-A', vehicleId: 'V-02' } }));
    const body = w.document.body.textContent;
    ok('단순 배차 vs 경로 검증 구분 표시', /단순 차량 배차/.test(body) && /위험물 운송 경로 검증/.test(body));
    ok('경로 데이터 한계 고지', /실제 도로망 경로탐색 · 실시간 통제 정보는 미연동/.test(body));
    const rc = w.document.getElementById('routeChecks').textContent;
    ok('운송 기준(별표21) 표시', /운송 기준 \(위험물안전관리법 시행규칙 별표21\)/.test(rc), rc.slice(0, 160));
    ok('탱크로리 도로법 운행허가 필요 표시', /축하중 11.5t > 10t/.test(rc));
    ok('차량 제원에 도로법 행', /도로법 운행제한/.test(w.document.getElementById('vehSpec').textContent));
    ok('런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 7. MSDS — 원문 대조 수정 ===');
  {
    const { w, errors } = await boot('msds.html');
    w.document.querySelector('#sampleChips .f-chip[data-id="MSDS-3098"]').click();
    w.document.getElementById('analyzeBtn').click();
    await sleep(3000);
    const trail = w.document.getElementById('extractBody').textContent;
    ok('수정 버튼 열 렌더', w.document.querySelectorAll('#extractBody .edit-btn').length === 9);
    const answers = ['UN 3082', '원문 p.11 대조 — 오인식 교정'];
    w.prompt = () => answers.shift();
    const idx = [...w.document.querySelectorAll('#extractBody tr')].findIndex((tr) => /UN Number/.test(tr.textContent));
    w.document.querySelectorAll('#extractBody .edit-btn')[idx].click();
    await sleep(50);
    const row = w.document.querySelectorAll('#extractBody tr')[idx].textContent;
    ok('수정값 반영', /UN 3082/.test(row), row.slice(0, 120));
    ok('수정 이력(전 → 후 · 사유) 표시', /원문 대조 수정/.test(row) && /UN 3098/.test(row) && /오인식 교정/.test(row));
    ok('프로파일에도 반영', /UN 3082/.test(w.document.getElementById('profileBox').textContent));
    ok('샘플 원본은 그대로', w.DGDATA.MSDS.find((m) => m.id === 'MSDS-3098').profile.unNo === 'UN 3098');
    ok('적합도 재산정 — 농도 상충 표시', /농도 · 분류 상충/.test(w.document.getElementById('accuracyIssues').textContent),
       w.document.getElementById('accuracyIssues').textContent);
    w.document.querySelector('#sampleChips .f-chip[data-id="MSDS-3077"]').click();
    w.document.getElementById('analyzeBtn').click();
    await sleep(3000);
    ok('3077 CAS 원문 오타 교정 이력 표시', /12190-79-7/.test(w.document.getElementById('extractBody').textContent));
    ok('MSDS 화면 런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 8. 배차 — 운송 기준 전달 ===');
  {
    const wh = loadData().WAREHOUSES.find((x) => x.id === 'W-01');
    const { w, errors } = await boot('dispatch.html', (w) => sampleCase(w, 'MSDS-3077', {
      warehouse: { id: wh.id, alias: wh.alias, ratePLDay: wh.ratePLDay },
      route: { id: 'R-A', name: '고속 최단', distanceKm: 78, minutes: 71, tolls: 8600, vehicleId: 'V-01',
               driverRule: '이동탱크저장소 운송이 아님 — 장거리 2인 기준 비대상', roadLaw: '도로법 운행제한 기준 이내' }
    }));
    const info = w.document.getElementById('dispatchInfo').textContent;
    ok('배차 정보에 운송 기준 · 운행제한', /운송 기준/.test(info) && /도로법 운행제한 기준 이내/.test(info), info.slice(0, 200));
    ok('런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 9. 다국어 — 숫자 자리표시자 어순 ===');
  for (const [lang, probe] of [['en', 'Out of 39 cells, 12 correct (about 30%)'], ['zh', '39 格中命中 12 格(约 30%)']]) {
    const { w, errors } = await boot('verify.html', (w) => w.localStorage.setItem('dg-lang', lang));
    await sleep(200);
    const body = w.document.getElementById('doc').textContent.replace(/\s+/g, ' ');
    ok(lang + ': 파서 실측 문장 숫자 순서 유지', body.indexOf(probe) >= 0, body.slice(body.indexOf('39') - 40, body.indexOf('39') + 80));
    const scope = w.document.getElementById('scopeBody').textContent;
    ok(lang + ': 구현 범위 표 한글 잔존 0자', (scope.match(/[가-힣]/g) || []).length === 0, scope.match(/[가-힣]+/g));
    ok(lang + ': 런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 10. 적합성 리포트 — 판정 근거 기록 ===');
  {
    const c = { caseNo: 'DG-TEST-01', request: { qtyPL: 40 },
      compliance: { verdict: 'COND', label: '조건부 검토', reason: 'x', passed: 2, candidates: 3, checkedAt: '2026-09-18 10:00',
        approver: '김안전', ruleset: 'DG-RULES 2026.09', regs: [{ id: 'REG-DGS', effective: '2026-07-01' }],
        triggers: ['농도 · 분류 상충 — 과산화수소 2~6%'] } };
    const { w, errors } = await boot('report.html', (w) => w.localStorage.setItem('dg-case', JSON.stringify(c)));
    const rb = w.document.getElementById('reportBody').textContent;
    ok('리포트에 규칙 세트', /판정 규칙 세트\s*DG-RULES 2026\.09/.test(rb));
    ok('리포트에 전환 사유', /담당자 확인 전환 사유\s*농도 · 분류 상충/.test(rb));
    ok('리포트에 판정 당시 시행일', /판정 당시 시행일/.test(rb) && /2026-07-01/.test(rb));
    ok('런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n=== 11. 정답지 채점 — 시연 데이터가 원본과 일치하는가 ===');
  {
    const ev = require('./msds-eval.js');
    const out = ev.run({});
    ok('정답지 3종 로드', out.results.length === 3);
    ok('필드 30/30 원본 일치', out.total.fieldCorrect === 30 && out.total.fieldTotal === 30,
       out.results.map((r) => r.id + ':' + r.misses.map((m) => m.label).join('/')).join(' '));
    ok('원문 위치(쪽수) 전부 일치', out.total.pageCorrect === out.total.pageTotal && out.total.pageTotal >= 25,
       out.total.pageCorrect + '/' + out.total.pageTotal);
    ok('총 쪽수 3/3 일치', out.total.pageCountOk === 3);
    /* 채점기가 틀린 값을 실제로 잡는지 — 3480 을 옛 데이터처럼 바꿔 넣으면 감점돼야 한다 */
    const gold = ev.loadGold().find((g) => g.id === 'MSDS-3480');
    const bad = { pages: 10, profile: { productName: 'Lithium-ion battery cell (INR21700)', unNo: 'UN 3480', psn: 'LITHIUM ION BATTERIES',
      hazardClass: '9', packingGroup: null, marinePollutant: false, tunnelCode: 'E', casNo: [], components: [] },
      extraction: [{ field: 'UN Number', page: 8 }] };
    const s = ev.score(bad, gold);
    ok('채점기 — 틀린 제품명 · 포장등급 · CAS · 쪽수 감점', s.fieldCorrect === 6 && s.pageCorrect === 0 && !s.pageCountOk,
       s.fieldCorrect + '/' + s.fieldTotal + ' 쪽수 ' + s.pageCorrect);
    ok('포장등급 표기 정규화(2 → II)', ev.roman('2') === 'II' && ev.roman('PG III') === 'III');
    ok('함량 표기 정규화', ev.pct('Less than 2~6%') === '2-6' && ev.pct('<5 %') === '<5');
  }

  console.log('\n=== 12. 문서 특성 · 보관 조건 ===');
  {
    const { w, errors } = await boot('compliance.html', (w) => {
      const c = sampleCase(w, 'MSDS-3480');
      c.msds.docMeta = loadData().MSDS.find((m) => m.id === 'MSDS-3480').docMeta;
      w.localStorage.setItem('dg-case', JSON.stringify(c));
    });
    const V = w.DGVerify;
    ok('영문 텍스트 PDF · 고품질 → 전환 없음', V.docIssues({ language: 'en', layout: 'text-pdf', scanQuality: 'high' }).length === 0);
    ok('저품질 스캔 → 전환', V.docIssues({ language: 'en', layout: 'scanned', scanQuality: 'low' }).length === 1);
    ok('사진 촬영본 → 전환', V.docIssues({ language: 'en', layout: 'photo', scanQuality: 'medium' }).some((t) => /사진/.test(t)));
    ok('정답지 미확보 언어(국문) → 전환', V.docIssues({ language: 'ko', layout: 'text-pdf', scanQuality: 'high' }).some((t) => /한국어/.test(t)));
    const ko = V.evaluate({ msds: { profile: loadData().MSDS[1].profile, extraction: [], docMeta: { language: 'ko', layout: 'scanned', scanQuality: 'low' },
      accuracy: { score: 95, mode: 'reference', missing: [] } } });
    ok('케이스 평가에 문서 품질 전환 사유', ko.filter((h) => h.key === 'docQuality').length === 2, ko.map((h) => h.key).join(','));
    ok('보관 온도 도출 — 3480 실온 → 상온', V.tempNeedFrom(loadData().MSDS[1].profile) === '상온');
    ok('보관 온도 도출 — 온도 기재 없음 → 요구 없음', V.tempNeedFrom(loadData().MSDS[0].profile) === null);
    ok('보관 온도 도출 — 냉장', V.tempNeedFrom({ storageTemp: '냉장(2~8℃)' }) === '냉장');
    w.document.getElementById('runBtn').click();
    await sleep(60);
    const gates = w.document.getElementById('gates').textContent;
    ok('게이트에 보관 조건(온도) — 상온 구역 대조', /보관 조건\(온도\) — MSDS 보관 온도 → 상온 구역 보유/.test(gates));
    ok('게이트에 물품 CAS 대조 비대상', /물품\(Article\) — 화관법 허가 품목 대조 비대상/.test(gates));
    ok('런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }
  {
    const { w, errors } = await boot('msds.html');
    w.document.querySelector('#sampleChips .f-chip[data-id="MSDS-3098"]').click();
    w.document.getElementById('analyzeBtn').click();
    await sleep(3000);
    const box = w.document.getElementById('profileBox').textContent;
    ok('프로파일에 문서 특성 표시(원본 실측)', /문서 특성/.test(box) && /영어/.test(box) && /텍스트 PDF/.test(box), box.slice(box.indexOf('문서 특성'), box.indexOf('문서 특성') + 80));
    ok('원문대로 함량 표기(Water 87~95%)', /87~95%/.test(box));
    ok('런타임 오류 없음', errors.length === 0, errors.join(' | '));
  }

  console.log('\n결과: ' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('하네스 오류:', e); process.exit(2); });
