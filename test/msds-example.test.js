const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const scripts = ['common', 'config', 'i18n-dict', 'i18n', 'auth', 'auth-gate', 'ui-kit', 'case-sync', 'data_dg', 'verify-rules', 'db', 'msds'];
let passed = 0;
function check(name, operation) { operation(); passed++; console.log('  PASS ' + name); }
async function until(condition) { const end = Date.now() + 5000; while (!condition()) { if (Date.now() > end) throw new Error('Timed out waiting for sample analysis'); await new Promise(resolve => setTimeout(resolve, 30)); } }
async function boot(language, saved, ai) {
  const html = fs.readFileSync(path.join(root, 'msds.html'), 'utf8').replace(/<script src="js\/[^"]*"><\/script>/g, '');
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, { url: 'https://sitditrd.github.io/AI_CONNECT_DG/msds.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  const errors = [], calls = [];
  w.addEventListener('error', event => errors.push(event.message));
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLDialogElement.prototype.showModal = undefined;
  w.HTMLDialogElement.prototype.close = undefined;
  w.localStorage.setItem('dg-lang', language);
  if (saved) w.localStorage.setItem('dg-case', saved);
  if (ai) w.localStorage.setItem('dg-auth', JSON.stringify({ token: 'example-test-token', role: 'user', login_id: 'example-test' }));
  w.fetch = (url, init) => {
    let body = {};
    try { body = JSON.parse((init && init.body) || '{}'); } catch (_) {}
    calls.push({ url: String(url), body });
    if (!ai) return Promise.reject(new Error('offline test'));
    const output = String(url).includes('/functions/v1/msds-extract') ? { ok: true, ai: true } : { ok: true, status: 'approved' };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(output) });
  };
  for (const name of scripts) { const script = w.document.createElement('script'); script.textContent = fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'); w.document.head.appendChild(script); }
  await new Promise(resolve => { if (w.document.readyState !== 'loading') resolve(); else w.document.addEventListener('DOMContentLoaded', resolve, { once: true }); });
  await new Promise(resolve => setTimeout(resolve, 160));
  return { w, errors, calls };
}
(async () => {
  for (const language of ['ko', 'en', 'zh']) {
    const { w, errors } = await boot(language);
    const get = id => w.document.getElementById(id);
    let fileSelections = 0;
    get('fileInput').addEventListener('click', () => { fileSelections++; });
    try {
      check(language + ' initial prompt and focus', () => { assert.equal(get('msdsExampleDialog').open, true); assert.equal(w.document.activeElement, get('msdsExampleYes')); assert.equal(w.document.body.style.overflow, 'hidden'); });
      check(language + ' prompt language', () => { const text = get('msdsExampleDialog').textContent; if (language !== 'ko') assert.equal(/[가-힣]/.test(text), false); assert.ok(get('msdsExampleTitle').textContent.length > 10); });
      get('msdsExampleNo').click();
      check(language + ' no opens only file picker', () => { assert.equal(fileSelections, 1); assert.equal(get('msdsExampleDialog').open, false); assert.equal(get('analyzeBtn').disabled, true); assert.equal(w.document.querySelector('#sampleChips .on'), null); assert.equal(w.document.body.style.overflow, ''); });
      get('exampleBtn').focus();
      get('exampleBtn').click();
      get('msdsExampleYes').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      check(language + ' keyboard focus stays in prompt', () => assert.equal(w.document.activeElement, get('msdsExampleNo')));
      get('msdsExampleNo').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      check(language + ' escape returns focus', () => { assert.equal(get('msdsExampleDialog').open, false); assert.equal(w.document.activeElement, get('exampleBtn')); assert.equal(fileSelections, 1); });
      get('fileSelectBtn').click();
      check(language + ' upload button reopens prompt', () => assert.equal(get('msdsExampleDialog').open, true));
      get('msdsExampleYes').click();
      check(language + ' yes starts sample without file picker', () => { assert.equal(get('msdsExampleDialog').open, false); assert.equal(w.document.querySelector('#sampleChips .on').dataset.id, 'MSDS-3480'); assert.equal(get('analyzeBtn').disabled, true); assert.equal(fileSelections, 1); });
      await until(() => !get('confirmBtn').disabled);
      check(language + ' automatic analysis completed', () => { assert.ok(get('extractBody').children.length > 1); assert.ok(get('profileBox').textContent.includes('3480')); assert.equal(w.DGAUTH.isAuthed(), false); });
      get('confirmBtn').click();
      const saved = w.localStorage.getItem('dg-case');
      check(language + ' confirmation stores sample profile', () => { assert.equal(w.DGCase.get().msds.id, 'MSDS-3480'); assert.ok(w.DGCase.get().msds.profile); });
      check(language + ' no unhandled runtime errors', () => assert.deepEqual(errors, []));
      const restored = await boot(language, saved);
      try { check(language + ' existing profile skips prompt', () => { assert.equal(restored.w.document.getElementById('msdsExampleDialog').open, false); assert.equal(restored.w.document.getElementById('confirmBtn').disabled, false); assert.deepEqual(restored.errors, []); }); } finally { restored.w.close(); }
    } finally { w.close(); }
  }
  const ai = await boot('ko', null, true);
  try {
    check('authenticated AI-capable user sees prompt', () => { assert.equal(ai.w.DGAUTH.isAuthed(), true); assert.equal(ai.w.document.getElementById('msdsExampleDialog').open, true); });
    ai.w.document.getElementById('msdsExampleYes').click();
    await until(() => !ai.w.document.getElementById('confirmBtn').disabled);
    check('example never invokes paid extraction', () => { assert.equal(ai.calls.filter(call => call.url.includes('/functions/v1/msds-extract') && call.body.probe !== true).length, 0); assert.ok(ai.w.document.getElementById('engineBadge').textContent.includes('데모 재생')); assert.deepEqual(ai.errors, []); });
  } finally { ai.w.close(); }
  console.log('MSDS example prompt: ' + passed + ' PASS / 0 FAIL');
})().catch(error => { console.error(error); process.exitCode = 1; });
