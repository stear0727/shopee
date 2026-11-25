'use strict';
// 橋接頁：載入後立刻轉到分潤連結；轉址失敗時頁面上保留「前往」按鈕
// Android 的 Threads／Instagram：先用 intent 請系統以蝦皮 APP 開啟，1.8 秒後若還停在本頁就改開網頁版
(function () {
  var a = document.getElementById('go');
  if (!a) return;
  var href = a.getAttribute('href') || '', intent = a.getAttribute('data-intent') || '';
  if (!/^https?:\/\//i.test(href)) return;
  if (/^intent:\/\//i.test(intent)) {
    try { location.href = intent; } catch (e) { /* 改開網頁 */ }
    setTimeout(function () { if (!document.hidden) { try { location.replace(href); } catch (e) { /* 保留按鈕 */ } } }, 1800);
    return;
  }
  try { location.replace(href); } catch (e) { /* 保留按鈕 */ }
})();
