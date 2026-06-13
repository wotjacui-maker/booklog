// ── 공유 커스텀 커서 (archive와 동일) ──
(function () {
  if (window.__bookroomCursor) return;
  window.__bookroomCursor = true;

  // 스타일 주입
  var style = document.createElement('style');
  style.textContent = [
    '* { cursor: none !important; }',
    'input, textarea, select, [contenteditable="true"] { cursor: text !important; }',
    '#bookroom-cursor { position: fixed; pointer-events: none; color: #e05b8a; font-size: 14px; transform: translate(-50%, -50%); z-index: 99999; }',
    '.bookroom-cursor-trail { position: fixed; pointer-events: none; color: #e05b8a; font-size: 11px; transform: translate(-50%, -50%); z-index: 99998; animation: bookroom-trail-fade 0.6s ease forwards; }',
    '@keyframes bookroom-trail-fade { 0% { opacity: 0.6; } 100% { opacity: 0; } }'
  ].join('\n');
  (document.head || document.documentElement).appendChild(style);

  function init() {
    var cursor = document.createElement('div');
    cursor.id = 'bookroom-cursor';
    cursor.textContent = '⊹';
    document.body.appendChild(cursor);

    var trail = ['⋆', '˚', '₊', '⊹', '˚', '⋆'];
    var trailIndex = 0;

    document.addEventListener('mousemove', function (e) {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
      var dot = document.createElement('div');
      dot.className = 'bookroom-cursor-trail';
      dot.textContent = trail[trailIndex++ % trail.length];
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      document.body.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 600);
    });

    document.addEventListener('mouseover', function (e) {
      var clickable = e.target.closest(
        'a, button, img, input, textarea, select, label, summary, [onclick], [role="button"], .clickable'
      );
      cursor.textContent = clickable ? '✶' : '⊹';
    });
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
