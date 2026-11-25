'use strict';
// 橋接頁：載入後立刻轉到分潤連結；轉址失敗時頁面上保留「前往」按鈕
(function () {
  var a = document.getElementById('go');
  if (!a) return;
  var href = a.getAttribute('href') || '';
  if (/^https?:\/\//i.test(href)) { try { location.replace(href); } catch (e) { /* 保留按鈕 */ } }
})();
