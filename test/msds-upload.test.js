/* Connect DG — 데모 재생 모드 업로드 시 무작위 샘플 자동 선택 회귀 검증
   msds.html 을 jsdom 으로 띄우고 실제 이벤트를 발생시켜 관측한다. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

/* 기본 대상은 저장소 루트(이 파일의 상위). 다른 사본을 검사하려면 경로를 인자로 준다 —
   가드를 되돌린 사본에 돌려 테스트의 회귀 감지력을 확인하는 용도(뮤테이션 테스트). */
const ROOT = process.argv[2] || path.join(__dirname, '..');

const LOCAL_SCRIPTS = [
  'js/common.js', 'js/config.js', 'js/i18n-dict.js', 'js/i18n.js',
  'js/auth.js', 'js/auth-gate.js', 'js/ui-kit.js', 'js/case-sync.js',
  'js/data_dg.js', 'js/db.js', 'js/msds.js',
];

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
}

/* AI 분석 모드 하네스 — 로그인 세션과 서버 응답을 주입해 engineFor() 가 'ai' 를 반환하게 만든다.
   probe 는 {ok:true, ai:true}, 실분석은 최소 프로파일을 돌려준다. */
function aiHarness(w) {
  w.localStorage.setItem('dg-auth', JSON.stringify({ token: 'tok-test', role: 'user', login_id: 'tester' }));
  w.fetch = function (url, init) {
    var body = {};
    try { body = JSON.parse((init && init.body) || '{}'); } catch (e) { /* */ }
    var out;
    if (String(url).indexOf('/functions/v1/msds-extract') >= 0) {
      out = body.probe === true
        ? { ok: true, ai: true, maxBytes: 8 * 1024 * 1024 }
        : {
            ok: true,
            profile: {
              productName: 'TEST REAGENT', casNo: ['7722-84-1'],
              components: [{ name: 'Hydrogen peroxide', cas: '7722-84-1', pct: '30-60%' }],
              unNo: 'UN 2014', psn: 'HYDROGEN PEROXIDE, AQUEOUS SOLUTION',
              hazardClass: '5.1', subRisk: '8', packingGroup: 'II',
              marinePollutant: false, tunnelCode: '', flashPointC: '', storageTemp: '2-8C',
              incompatible: ['metals'], specialProvisions: ['SP 300'],
              extraction: [{ field: 'unNo', value: 'UN 2014', section: 'Section 14', page: 7, confidence: 0.93 }],
            },
          };
    } else { out = { ok: true, status: 'approved' }; }
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(out); } });
  };
}

async function boot(setup) {
  let html = fs.readFileSync(path.join(ROOT, 'msds.html'), 'utf8');
  // 외부 CDN(폰트)·네트워크 호출 제거 — 오프라인 결정성 확보
  html = html.replace(/<link[^>]*cdn\.jsdelivr\.net[^>]*>/g, '');
  html = html.replace(/<script src="js\/[^"]*"><\/script>/g, '');

  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});   // 리소스 로딩 잡음 무시

  const dom = new JSDOM(html, {
    url: 'https://sitditrd.github.io/AI_CONNECT_DG/msds.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window;

  // 기본값: fetch 차단 — probe 가 서버에 나가지 않게 해서 데모 모드를 강제(= 실제 배포 기본 상태)
  w.fetch = () => Promise.reject(new Error('offline'));
  if (setup) setup(w);

  for (const rel of LOCAL_SCRIPTS) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const s = w.document.createElement('script');
    s.textContent = code;
    w.document.head.appendChild(s);
  }
  /* DOMContentLoaded 를 수동으로 던지면 안 된다 — jsdom 이 파싱 완료 시 자연 발화시키므로
     수동 dispatch 를 더하면 initDrop() 이 두 번 걸려 change 리스너가 중복 등록되고
     업로드 1회에 handleFile 이 2회 돈다(실제 브라우저에는 없는 하네스 결함). */
  await new Promise((r) => {
    if (w.document.readyState !== 'loading') return r();
    w.document.addEventListener('DOMContentLoaded', () => r());
  });
  await new Promise((r) => setTimeout(r, 120));
  return w;
}

function makeFile(w, name, bytes, type) {
  return new w.File([new Uint8Array(bytes)], name, { type });
}

function fireUpload(w, file) {
  const input = w.document.getElementById('fileInput');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
}

function selectedChipId(w) {
  const on = w.document.querySelector('#sampleChips .f-chip.on');
  return on ? on.dataset.id : null;
}

(async () => {
  console.log('\n=== 1. 초기 상태 ===');
  const w = await boot();
  const chips = w.document.querySelectorAll('#sampleChips .f-chip');
  ok('샘플 칩 3개 렌더', chips.length === 3, '실제 ' + chips.length + '개');
  ok('초기에는 선택 없음', selectedChipId(w) === null, '선택=' + selectedChipId(w));
  ok('초기 분석버튼 비활성', w.document.getElementById('analyzeBtn').disabled === true);
  ok('엔진 배지 = 데모 재생',
    /데모 재생/.test(w.document.getElementById('engineBadge').textContent),
    w.document.getElementById('engineBadge').textContent.slice(0, 90));

  console.log('\n=== 2. PDF 업로드 → 무작위 자동 선택 ===');
  fireUpload(w, makeFile(w, '테스트_MSDS.pdf', 4096, 'application/pdf'));
  const picked = selectedChipId(w);
  ok('업로드 후 샘플이 자동 선택됨', picked !== null, '선택=' + picked);
  ok('분석 실행 버튼 활성화', w.document.getElementById('analyzeBtn').disabled === false);
  const state = w.document.getElementById('uploadState').textContent;
  ok('업로드 파일명 표기', state.includes('테스트_MSDS.pdf'), state.slice(0, 140));
  ok('무작위 선택 사실 명시', state.includes('무작위'), state.slice(0, 200));
  ok('분석되지 않음 명시', state.includes('분석되지 않습니다'), state.slice(0, 200));

  console.log('\n=== 3. 분석 실행 → 프로파일 생성 ===');
  w.document.getElementById('analyzeBtn').click();
  await new Promise((r) => setTimeout(r, 3000));
  const rows = w.document.querySelectorAll('#extractBody tr');
  ok('추출표에 행이 생성됨', rows.length > 0 && !/분석 대기 중/.test(rows[0].textContent),
    '행수=' + rows.length + ' 첫행=' + (rows[0] ? rows[0].textContent.trim().slice(0, 60) : '-'));
  ok('확정 버튼 활성화', w.document.getElementById('confirmBtn').disabled === false);
  ok('프로파일 박스 렌더', /UN/.test(w.document.getElementById('profileBox').textContent),
    w.document.getElementById('profileBox').textContent.trim().slice(0, 80));

  console.log('\n=== 4. 무작위성 — 연속 업로드 시 분포 ===');
  const counts = {};
  let sameAsPrev = 0, prev = picked;
  for (let i = 0; i < 40; i++) {
    const w2 = w;
    fireUpload(w2, makeFile(w2, 'doc' + i + '.pdf', 2048, 'application/pdf'));
    const p = selectedChipId(w2);
    counts[p] = (counts[p] || 0) + 1;
    if (p === prev) sameAsPrev++;
    prev = p;
  }
  const distinct = Object.keys(counts);
  console.log('       분포: ' + JSON.stringify(counts));
  ok('3종이 모두 최소 1회 선택됨', distinct.length === 3, '나온 종류=' + distinct.length + ' ' + distinct.join(','));
  ok('직전과 동일한 샘플이 연속 선택되지 않음', sameAsPrev === 0, '연속 중복 ' + sameAsPrev + '회');

  console.log('\n=== 4b. 결정적 검증 — Math.random 고정 시 직전 샘플이 반드시 제외되는가 ===');
  const w4 = await boot();
  const chipIds = [...w4.document.querySelectorAll('#sampleChips .f-chip')].map((b) => b.dataset.id);
  for (const fix of [0, 0.999]) {
    for (const anchor of chipIds) {
      [...w4.document.querySelectorAll('#sampleChips .f-chip')].find((b) => b.dataset.id === anchor).click();
      w4.Math.random = () => fix;
      fireUpload(w4, makeFile(w4, 'det.pdf', 1024, 'application/pdf'));
      const got = selectedChipId(w4);
      const pool = chipIds.filter((x) => x !== anchor);
      const want = pool[Math.floor(fix * pool.length)];
      ok('random=' + fix + ' 직전=' + anchor + ' → ' + want, got === want, '실제=' + got);
    }
  }

  console.log('\n=== 5. 지원하지 않는 형식 ===');
  fireUpload(w, makeFile(w, 'malware.exe', 512, 'application/x-msdownload'));
  ok('비허용 형식도 데모 재생으로 처리(선택 유지)', selectedChipId(w) !== null);
  ok('비허용 형식에서도 분석버튼 활성', w.document.getElementById('analyzeBtn').disabled === false);

  console.log('\n=== 6. 칩 수동 선택이 업로드 상태를 덮어씀 ===');
  const target = w.document.querySelectorAll('#sampleChips .f-chip')[0];
  target.click();
  ok('수동 선택이 반영됨', selectedChipId(w) === target.dataset.id,
    '기대=' + target.dataset.id + ' 실제=' + selectedChipId(w));
  ok('수동 선택 후에도 분석버튼 활성', w.document.getElementById('analyzeBtn').disabled === false);

  console.log('\n=== 6b. AI 분석 모드 — 죽은 버튼 회귀 ===');
  const wa = await boot(aiHarness);
  await new Promise((r) => setTimeout(r, 200));   // probe 완료 대기
  ok('배지가 AI 분석으로 승격', /AI 분석/.test(wa.document.getElementById('engineBadge').textContent),
    wa.document.getElementById('engineBadge').textContent.slice(0, 80));
  fireUpload(wa, makeFile(wa, '실제MSDS.pdf', 4096, 'application/pdf'));
  ok('AI 모드에서는 샘플을 미리 고르지 않음', selectedChipId(wa) === null, '선택=' + selectedChipId(wa));
  ok('AI 모드 분석버튼 활성', wa.document.getElementById('analyzeBtn').disabled === false);
  wa.document.getElementById('analyzeBtn').click();
  await new Promise((r) => setTimeout(r, 1200));
  const prog = wa.document.getElementById('progressText').textContent;
  ok('분석이 실제로 시작됨(죽은 버튼 아님)', prog.length > 0, 'progressText="' + prog + '"');
  const aiRows = wa.document.querySelectorAll('#extractBody tr');
  ok('실분석 결과가 추출표에 반영', aiRows.length > 0 && /UN 2014/.test(wa.document.getElementById('extractBody').textContent),
    wa.document.getElementById('extractBody').textContent.trim().slice(0, 80));
  ok('실분석 후 확정 버튼 활성', wa.document.getElementById('confirmBtn').disabled === false);

  console.log('\n=== 6c. 다국어 — 신규 문구가 EN/ZH 사전에 걸리는가 ===');
  const hangul = (s) => (String(s).match(/[가-힣]/g) || []).length;
  for (const [lang, probe] of [['en', 'Demo replay'], ['zh', '演示回放']]) {
    const wl = await boot();
    wl.DGI18N.setLang(lang);
    await new Promise((r) => setTimeout(r, 150));
    const dz = wl.document.querySelector('.dz-d').textContent;
    ok(lang + ': 드롭존 문구 번역됨', hangul(dz) === 0 && dz.length > 5, dz.slice(0, 90));
    const notice = wl.document.querySelector('.panel-body .notice').textContent;
    ok(lang + ': 안내문 5문장 전부 번역됨', hangul(notice) === 0, '한글 ' + hangul(notice) + '자 잔존: ' + notice.replace(/\s+/g, ' ').slice(0, 140));

    fireUpload(wl, makeFile(wl, 'sample.pdf', 3072, 'application/pdf'));
    await new Promise((r) => setTimeout(r, 150));
    const st = wl.document.getElementById('uploadState').textContent;
    ok(lang + ': 업로드 상태 문구 번역됨', hangul(st) === 0, '한글 ' + hangul(st) + '자 잔존: ' + st.replace(/\s+/g, ' ').slice(0, 140));
    const badge = wl.document.getElementById('engineBadge').textContent;
    ok(lang + ': 엔진 배지·판정 이유 번역됨 (' + probe + ')', hangul(badge) === 0 && badge.indexOf(probe) >= 0,
      '한글 ' + hangul(badge) + '자 · ' + badge.replace(/\s+/g, ' ').slice(0, 140));
  }

  console.log('\n=== 7. 빈/단일 데이터 방어 ===');
  const w3 = await boot();
  w3.DGDATA.MSDS = [w3.DGDATA.MSDS[0]];
  let threw = null;
  try {
    fireUpload(w3, makeFile(w3, 'single.pdf', 1024, 'application/pdf'));
  } catch (e) { threw = e; }
  ok('MSDS 1종만 있어도 예외 없음', threw === null, threw ? String(threw) : '');

  console.log('\n결과: ' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('테스트 하네스 오류:', e); process.exit(2); });
