/* =========================================================
   Connect DG — 내보내기 유틸 (CSV · UTF-8 BOM)
   Excel 호환: BOM + CRLF + 셀 이스케이프
   ========================================================= */
(function () {
  'use strict';

  function cell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  /* rows: 2차원 배열. 첫 행을 헤더로 사용 */
  function csv(filename, rows) {
    var body = rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    var blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 400);
  }

  /* 감사 로그 → CSV */
  function auditCsv(c) {
    if (!c || !c.logs || !c.logs.length) { alert('내보낼 감사 로그가 없습니다.'); return; }
    var rows = [['순번', '시각', '행위자', '내용']];
    c.logs.forEach(function (l, i) { rows.push([i + 1, l.at, l.actor, l.text]); });
    csv('ConnectDG_감사로그_' + (c.caseNo || 'case') + '.csv', rows);
  }

  window.DGExport = { csv: csv, auditCsv: auditCsv };
})();
