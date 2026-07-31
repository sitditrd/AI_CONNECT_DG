/* =========================================================
   Connect DG — 9단계 파이프라인 렌더러 (발표자료 16장)
   index.html · process.html 공용
   ========================================================= */
(function () {
  'use strict';

  var GROUPS = [
    {
      title: '① 요청 · 분석',
      items: [
        { no: 1, label: '보관 요청', href: 'process.html#request' },
        { no: 2, label: 'MSDS 등록', href: 'msds.html' },
        { no: 3, label: '정보 추출 (LLM-OCR)', href: 'msds.html#extract' }
      ]
    },
    {
      title: '② 검토 · 매칭',
      items: [
        { no: 4, label: '법규 검토', href: 'compliance.html' },
        { no: 5, label: '창고 매칭', href: 'matching.html' },
        { no: 6, label: '경로 검토', href: 'route.html' }
      ]
    },
    {
      title: '③ 실행 · 관리',
      items: [
        { no: 7, label: '견적 · 계약', href: 'dispatch.html#contract' },
        { no: 8, label: '배차 (운송 실행)', href: 'dispatch.html#dispatch' },
        { no: 9, label: '입고 관리 (TIMS 연계)', href: 'dispatch.html#inbound' }
      ]
    }
  ];

  function render(el, opts) {
    if (!el) return;
    opts = opts || {};
    var states = window.DGCase.steps();
    var html = GROUPS.map(function (g) {
      var rows = g.items.map(function (it) {
        var st = states[it.no - 1];
        var link = opts.links === false ? '' : '<a href="' + it.href + '">열기 ›</a>';
        return '<div class="pipe-item ' + st + '">' +
                 '<span class="n">' + it.no + '</span>' +
                 '<span>' + it.label + '</span>' + link +
               '</div>';
      }).join('');
      return '<div class="pipe-group"><div class="g-t">' + g.title + '</div>' + rows + '</div>';
    }).join('');
    el.innerHTML = html;
  }

  window.DGPipe = { GROUPS: GROUPS, render: render };
})();
