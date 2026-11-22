'use strict';
/* ========== 工具函式 ========== */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const opts = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
const safeUrl = (u) => { u = String(u || '').trim(); return /^https?:\/\/\S+$/i.test(u) ? u.slice(0, 500) : ''; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('sp_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sp_' + k, JSON.stringify(v)); } catch { toast('無法寫入本機儲存空間'); } },
};
function toast(m) { const t = $('#toast'), d = document.getElementById('dlg'); (d && d.open ? d : document.body).append(t); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2800); }
const stat = (label, val, sub = '', cls = '') => `<div class="stat ${cls}"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

/* ========== 常數 ========== */
const PLATFORMS = { fb: 'Facebook（粉專／社團）', ig: 'Instagram', threads: 'Threads', line: 'LINE 社群／官方帳號', dcard: 'Dcard／PTT', other: '其他社群' };
// 舊版資料使用的平台代碼，只用於顯示
const FORMATS = ['圖文貼文', '多圖輪播', '限時動態', '社團分享長文', 'Threads 短文', '清單推薦', '比價懶人包', '開箱心得'];
const STATUS = { watch: '觀望中', todo: '待發文', copy: '已產文案', done: '已發布', drop: '淘汰' };
const ACTIVE = ['watch', 'todo', 'copy'];
const SORTS = { rec: '評分高低', comm: '預估分潤高低', sales: '月銷高低', priceAsc: '價格低到高', new: '最新加入' };
const CATS = ['服飾配件', '美妝保養', '居家生活', '3C 配件', '廚房用品', '母嬰', '寵物', '食品', '運動戶外', '其他'];
// 關鍵字自動分類（依順序比對，先比對較明確的類別）
const CAT_RE = [
  ['寵物', /寵物|貓砂|貓窩|貓抓|貓糧|貓咪|貓樹|貓跳台|狗狗|狗糧|犬|飼料|罐罐|牽繩|逗貓|喂食器|餵食器/],
  ['母嬰', /嬰|寶寶|兒童|孕|奶瓶|尿布|童裝|奶嘴|學步|玩具|母嬰/],
  ['3C 配件', /手機|充電|行動電源|傳輸線|耳機|藍牙|喇叭|滑鼠|鍵盤|螢幕|保護貼|手機殼|平板|筆電|USB|記憶卡|相機|自拍|手環|智慧|3C|電競/i],
  ['美妝保養', /面膜|精華|乳液|化妝水|防曬|洗面|卸妝|口紅|唇|粉底|眼影|睫毛|眉|香水|保養|乳霜|霜|美白|彩妝|美妝|指甲|洗髮|潤髮|護髮|沐浴|身體乳|髮|膚|眼罩|熱敷|按摩|刮痧|個人護理/],
  ['食品', /零食|餅乾|杏仁|蜂蜜|牛奶|奶酥|肉鬆|蛋捲|起司|蛋糕|麻糬|鳳梨酥|水果|果凍|雞胸|滴雞精|咖啡豆|茶包|茶葉|堅果|泡麵|巧克力|糖|果乾|肉乾|保健|維他命|益生菌|膠原|食品|醬|麵|米|飲品/],
  ['運動戶外', /運動|瑜珈|健身|登山|露營|跑步|自行車|單車|泳|啞鈴|彈力帶|戶外|球拍|護膝/],
  ['廚房用品', /鍋|碗|盤|杯|刀具|菜刀|砧板|保鮮|便當|餐具|筷|湯匙|廚房|烤箱|氣炸|電鍋|果汁機|咖啡機|水壺|保溫/],
  ['居家生活', /收納|置物|掛勾|毛巾|床|枕|被|寢具|窗簾|地墊|清潔|拖把|掃|垃圾|衣架|燈|香氛|擴香|浴室|洗衣|除濕|抽屜|居家|家具|椅|桌|電熱毯|暖風|電暖|暖氣|除濕機|電扇|風扇|洗衣|清潔刷|家電/],
  ['服飾配件', /上衣|T恤|背心|襯衫|外套|褲|裙|洋裝|衣|襪|帽|鞋|包|皮夾|錢包|圍巾|手套|項鍊|耳環|戒指|手錶|眼鏡|飾品|服飾/],
];
const autoCat = (name, cat = '') => {
  if (CATS.includes(cat) && cat !== '其他') return cat;
  const s = `${cat || ''} ${name || ''}`;
  for (const [c, re] of CAT_RE) if (re.test(s)) return c;
  return '其他';
};
const EXTRA = ['shop', 'aff', 'queuedAt', 'publishedAt', 'aiAt', 'aiFest', 'discount', 'rating', 'sales', 'trend', 'summary', 'url', 'src', 'aiText'];
const numOr = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : Number(v));
const kfmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : fmt(n));
const catClass = (c) => { let h = 0; for (const ch of String(c || '')) h = (h + ch.codePointAt(0)) % 6; return 'k' + h; };
// 評分：銷量、預估社群分潤、價格；門檻依每次上傳的商品批次自動校正（百分位數）
const DIMS = [
  { k: 'sales', n: '銷量', s: '銷量', w: 40, auto: 1, up: 1 },
  { k: 'comm', n: '預估社群分潤', s: '分潤', w: 35, auto: 1, up: 1 },
  { k: 'price', n: '價格', s: '價格', w: 25, auto: 1, up: 0 },
];
// 門檻 [P25, P50, P75, P90]；尚未校正前使用 100 筆樣本驗證得到的預設值
const DEF_THR = { sales: [10000, 20000, 60000, 100000], comm: [1.6, 4.7, 12, 39], price: [95, 170, 300, 690] };
const MIN_BATCH = 30, CAP_TOTAL = 64;
const bonus = () => (Number.isFinite(Number(S.bonus)) ? Number(S.bonus) : 0.5);
// 預估社群分潤 = 價格 ×（分潤率 + 加成）÷ 100，加成預設 0.5（可在設定修改）
const commOf = (p) => num(p.price) * (num(p.base) + num(p.xtra) + bonus()) / 100;
const thr = () => S.thr || DEF_THR;
const sig2 = (x) => (x ? Number(Number(x).toPrecision(2)) : 0);
const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); if (!a.length) return 0; const k = (a.length - 1) * p, f = Math.floor(k), c = Math.ceil(k); return a[f] + (a[c] - a[f]) * (k - f); };
const upScore = (v, t) => (v >= t[3] ? 5 : v >= t[2] ? 4 : v >= t[1] ? 3 : v >= t[0] ? 2 : 1);   // 越高越好
const downScore = (v, t) => (v <= t[0] ? 5 : v <= t[1] ? 4 : v <= t[2] ? 3 : v <= t[3] ? 2 : 1); // 越低越好（價格）
// 依一批商品重算門檻；少於 30 筆時沿用上一次門檻
function calibrate(list) {
  if (list.length < MIN_BATCH) return { ok: false, n: list.length };
  const col = (k) => [0.25, 0.5, 0.75, 0.9].map((p) => sig2(pct(list.map((x) => num(x[k])), p)));
  S.thr = { sales: col('sales'), comm: col('comm'), price: col('price'), n: list.length, at: new Date().toISOString() };
  save.s();
  return { ok: true, n: list.length };
}
const fmtThr = (k, t = thr()[k]) => (k === 'price'
  ? `≤${fmt(t[0])}→5、≤${fmt(t[1])}→4、≤${fmt(t[2])}→3、≤${fmt(t[3])}→2、其他→1`
  : `≥${fmt(t[3], k === 'comm' ? 1 : 0)}→5、≥${fmt(t[2], k === 'comm' ? 1 : 0)}→4、≥${fmt(t[1], k === 'comm' ? 1 : 0)}→3、≥${fmt(t[0], k === 'comm' ? 1 : 0)}→2、其他→1`);
const USER_DIMS = DIMS.filter((d) => !d.auto);
const GRADE_ACT = { S: '主打，本週優先發文', A: '正式發文，穩定推薦', B: '小量測試，用不同開頭 A/B 測試', C: '不建議花時間寫文' };

/* ========== 節慶與電商檔期（預設帶入發布頁的「節慶／活動資訊」，使用者可修改） ========== */
const LUNAR = {
  2026: [['02-16', '除夕'], ['02-17', '春節'], ['03-03', '元宵節'], ['06-19', '端午節'], ['08-19', '七夕情人節'], ['09-25', '中秋節']],
  2027: [['02-05', '除夕'], ['02-06', '春節'], ['02-20', '元宵節'], ['06-09', '端午節'], ['08-08', '七夕情人節'], ['09-15', '中秋節']],
  2028: [['01-25', '除夕'], ['01-26', '春節'], ['02-09', '元宵節'], ['05-28', '端午節'], ['08-26', '七夕情人節'], ['10-03', '中秋節']],
};
const FIXED = [['01-01', '元旦'], ['02-14', '西洋情人節'], ['03-08', '婦女節'], ['03-14', '白色情人節'], ['04-04', '兒童節'], ['04-05', '清明節'],
  ['06-18', '618 購物節'], ['08-08', '父親節'], ['09-09', '99 購物節'], ['10-10', '雙十節'], ['10-31', '萬聖節'], ['11-11', '雙 11 購物節'],
  ['12-12', '雙 12 購物節'], ['12-24', '聖誕夜'], ['12-25', '聖誕節'], ['12-31', '跨年']];
const nthWeekday = (y, m, wd, nth) => { const d = new Date(Date.UTC(y, m - 1, 1)); d.setUTCDate(1 + ((wd - d.getUTCDay() + 7) % 7) + (nth - 1) * 7); return d; };
function festivals(days = 21) {
  const now = new Date(), today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()), out = [];
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    const list = [...FIXED, ...(LUNAR[y] || [])].map(([md, name]) => [Date.UTC(y, +md.slice(0, 2) - 1, +md.slice(3)), name]);
    list.push([+nthWeekday(y, 5, 0, 2), '母親節']);
    list.push([+nthWeekday(y, 11, 4, 4) + 864e5, '黑色星期五']);
    for (const [t, name] of list) { const diff = Math.round((t - today) / 864e5); if (diff >= 0 && diff <= days) out.push({ name, date: new Date(t).toISOString().slice(5, 10).replace('-', '/'), diff }); }
  }
  return out.sort((a, b) => a.diff - b.diff);
}
const festAuto = () => festivals().map((f) => `${f.name}（${f.date}）`).join('、');

/* ========== 狀態（localStorage） ========== */
const DEF_W = Object.fromEntries(DIMS.map((d) => [d.k, d.w]));
const _s = store.get('settings', {});
const S = { accessCode: '', ownKey: '', ..._s, wv: 3, weights: _s.wv === 3 && _s.weights ? { ...DEF_W, ..._s.weights } : { ...DEF_W }, alias: { ..._s.alias } };
const blankDraft = () => ({ id: '', name: '', category: '', price: '', base: '', xtra: '', platform: 'fb', format: FORMATS[0], scores: Object.fromEntries(USER_DIMS.map((d) => [d.k, 3])) });
let items = store.get('items', []);
const save = {
  s: () => { S.setAt = Date.now(); store.set('settings', S); if (typeof markDirty === 'function') markDirty(); },
  i: () => { const changed = typeof stampItems === 'function' ? stampItems() : true; store.set('items', items); if (changed && typeof markDirty === 'function') markDirty(); },
};

/* ========== 確定性公式 ========== */
const priceScore = (p) => (p <= 299 ? 5 : p <= 599 ? 4 : p <= 999 ? 3 : p <= 1999 ? 2 : 1);
const rateScore = (r) => (r >= 10 ? 5 : r >= 7 ? 4 : r >= 5 ? 3 : r >= 3 ? 2 : 1);
const gradeOf = (t) => (t >= 80 ? 'S' : t >= 65 ? 'A' : t >= 50 ? 'B' : 'C');
function scoreOf(p) {
  const t = thr(), price = num(p.price);
  const v = { sales: upScore(num(p.sales), t.sales), comm: upScore(commOf(p), t.comm), price: price > 0 ? downScore(price, t.price) : 1 };
  let sw = 0, tt = 0;
  for (const d of DIMS) { const w = Math.max(0, num(S.weights[d.k])); sw += w; tt += w * (v[d.k] - 1) / 4; }
  let total = sw ? Math.round((tt / sw) * 1000) / 10 : 0;
  // 上限：銷量或預估社群分潤任一項只得 1 分，總分最高 64
  const capped = (v.sales === 1 || v.comm === 1) && total > CAP_TOTAL;
  if (capped) total = CAP_TOTAL;
  return { v, total, grade: gradeOf(total), capped };
}
const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
function keyOf(name) { let k = norm(name), g = 0; while (S.alias[k] && g++ < 20) k = S.alias[k]; return k; }
function subId(p) {
  let h = 0; for (const c of String(p.name || '')) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return `${p.platform || 'other'}_${today().slice(2).replace(/-/g, '')}_${h.toString(36).slice(0, 5)}`;
}

/* ========== 迷你 Markdown（先跳脫再轉換，避免注入） ========== */
const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
function mdTable(rows) {
  const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const body = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
  if (!body.length) return '';
  const [hd, ...rest] = body;
  return `<div class="tw"><table><thead><tr>${cells(hd).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function md(src) {
  let h = '', list = null, tbl = [];
  const endList = () => { if (list) { h += `</${list}>`; list = null; } };
  const endTbl = () => { if (tbl.length) { h += mdTable(tbl); tbl = []; } };
  for (const raw of esc(src).split(/\r?\n/)) {
    const l = raw.trim(); let m;
    if (/^\|.*\|$/.test(l)) { endList(); tbl.push(l); continue; }
    endTbl();
    if (!l) { endList(); continue; }
    if ((m = l.match(/^(#{1,6})\s+(.*)/))) { endList(); const n = Math.min(m[1].length + 2, 6); h += `<h${n}>${inline(m[2])}</h${n}>`; continue; }
    if ((m = l.match(/^[-*•]\s+(.*)/))) { if (list !== 'ul') { endList(); h += '<ul>'; list = 'ul'; } h += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (list !== 'ol') { endList(); h += '<ol>'; list = 'ol'; } h += `<li>${inline(m[1])}</li>`; continue; }
    if (/^(-{3,}|\*{3,})$/.test(l)) { endList(); h += '<hr>'; continue; }
    endList(); h += `<p>${inline(l)}</p>`;
  }
  endTbl(); endList();
  return h;
}

/* ========== AI 呼叫 ========== */
const outText = {};
async function ai(task, payload, btn) {
  const h = { 'Content-Type': 'application/json' };
  if (S.accessCode) h['x-access-code'] = S.accessCode;
  if (S.ownKey) h['x-gemini-key'] = S.ownKey;
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'AI 產生中…'; }
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch('/api/ai', { method: 'POST', headers: h, body: JSON.stringify({ task, payload }), signal: ctl.signal });
    let j; try { j = await r.json(); } catch { j = { ok: false, error: `伺服器回應格式錯誤（HTTP ${r.status}）` }; }
    if (!r.ok || !j.ok) { const e = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; e.retry = j.retryAfter; throw e; }
    return j;
  } catch (e) {
    if (e.name === 'AbortError') e.message = '連線逾時，請縮小輸入或重試';
    else if (e instanceof TypeError) e.message = '無法連線到伺服器，請檢查網路（本機直接開檔沒有後端，請用 netlify dev 或部署後使用）';
    throw e;
  } finally { clearTimeout(to); if (btn) { btn.disabled = false; btn.textContent = label; } }
}
function showErr(el, e) {
  clearInterval(showErr.t);
  if (e.status === 429) {
    let n = e.retry || 30;
    const tick = () => { el.innerHTML = `<div class="card err">${esc(e.message)}（約 ${n} 秒後可重試）</div>`; if (n-- <= 0) { clearInterval(showErr.t); el.innerHTML = '<div class="card">可以重試了。</div>'; } };
    tick(); showErr.t = setInterval(tick, 1000); return;
  }
  const extra = e.status === 401 ? ' <a href="#settings">前往設定</a>' : e.status === 504 ? '（建議縮小輸入或重試）' : e.status === 400 ? '（請檢查欄位）' : '';
  el.innerHTML = `<div class="card err">${esc(e.message)}${extra}</div>`;
  if (e.status === 401) setTimeout(() => { location.hash = '#settings'; }, 1500);
}
const loading = (el) => { el.innerHTML = '<div class="card loading">AI 產生中，約需 5–25 秒…</div>'; };
function outCard(key, html, j, text) {
  outText[key] = text;
  const src = (j.sources || []).filter((s) => safeUrl(s.uri));
  return `<div class="card"><div class="out-head"><button type="button" data-act="copy" data-k="${key}">複製</button></div>${html}
  ${src.length ? `<h3>來源</h3><ul>${src.map((s) => `<li><a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join('')}</ul>` : ''}
  <p class="hint">模型：${esc(j.model)}｜AI 內容僅供參考，數字與規則請自行查證；發文請揭露含分潤連結。</p></div>`;
}
// 複製：成功後按鈕本身短暫顯示「已複製」；對話框開啟時頁面其他區域不可互動，備援的 textarea 要放進對話框
async function copy(text, btn) {
  if (!text) { toast('沒有可複製的內容'); return; }
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; }
  catch {
    const d = document.getElementById('dlg'), t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    (d && d.open ? d : document.body).append(t); t.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
  }
  if (!ok) { toast('複製失敗，請手動選取文字複製'); return; }
  toast('已複製');
  if (btn) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = '✓ 已複製'; btn.classList.add('copied');
    clearTimeout(btn._ct); btn._ct = setTimeout(() => { btn.textContent = btn.dataset.label; btn.classList.remove('copied'); }, 1600);
  }
}

/* ========== CSV ========== */
const csvCell = (v) => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v) && !Number.isFinite(Number(v))) v = "'" + v; return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const toCSV = (rows, cols) => '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
function parseCSV(t) {
  t = t.replace(/^﻿/, ''); const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [h, ...b] = rows.filter((r) => r.some((x) => x !== ''));
  if (!h) return [];
  const un = (v) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), un(r[i] ?? '')])));
}
/* 讀取 Excel .xlsx（不需外部套件：解 zip 後讀第一個工作表） */
async function readXlsx(buf) {
  if (typeof DecompressionStream === 'undefined') throw new Error('此瀏覽器不支援讀取 Excel，請另存成 CSV 再匯入');
  const u8 = new Uint8Array(buf), dv = new DataView(buf), td = new TextDecoder();
  let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('不是有效的 .xlsx 檔');
  const files = {}; let p = dv.getUint32(e + 16, true);
  for (let i = 0, cnt = dv.getUint16(e + 10, true); i < cnt; i++) {
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    files[td.decode(u8.subarray(p + 46, p + 46 + nl))] = { m: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
    p += 46 + nl + xl + cl;
  }
  const get = async (name) => {
    const f = files[name]; if (!f) return '';
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true), data = u8.subarray(start, start + f.size);
    return f.m === 0 ? td.decode(data) : new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  };
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const ssText = await get('xl/sharedStrings.xml');
  const ss = ssText ? [...xml(ssText).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join('')) : [];
  const sheet = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0];
  if (!sheet) throw new Error('Excel 檔裡找不到工作表');
  const col = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const rows = [];
  for (const r of xml(await get(sheet)).getElementsByTagName('row')) {
    const row = [];
    for (const c of r.getElementsByTagName('c')) {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const val = t === 's' ? ss[+v] ?? '' : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent).join('') : v;
      const k = col(c.getAttribute('r') || ''); row[k >= 0 ? k : row.length] = val;
    }
    rows.push(Array.from(row, (x) => x ?? ''));
  }
  const [h, ...b] = rows.filter((r) => r.some((x) => String(x).trim() !== ''));
  return h ? b.map((r) => Object.fromEntries(h.map((k, i) => [String(k).trim(), r[i] ?? '']))) : [];
}
/* 讀取 CSV 或 Excel；CSV 先試 UTF-8，失敗改用 Big5（Excel 另存的 CSV） */
async function readTable(file) {
  const buf = await file.arrayBuffer(), u8 = new Uint8Array(buf);
  if (/\.xlsx$/i.test(file.name) || (u8[0] === 0x50 && u8[1] === 0x4b)) return readXlsx(buf);
  if (/\.xls$/i.test(file.name)) throw new Error('不支援舊版 .xls，請在 Excel 另存成 .xlsx 或 CSV');
  let txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { txt = new TextDecoder('big5').decode(buf); }
  return parseCSV(txt);
}
/* 蝦皮「批量商品連結」匯出檔：商品編號、商品名稱、商品價格、銷售量、商店名稱、分潤率、推廣分潤、商品連結、推廣連結 */
const isShopeeFile = (rows) => rows.length && '商品名稱' in rows[0] && ('推廣連結' in rows[0] || '商品連結' in rows[0]);
const salesNum = (v) => { const m = String(v || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(萬|k|K)?/); return m ? Math.round(Number(m[1]) * (m[2] === '萬' ? 1e4 : m[2] ? 1e3 : 1)) : ''; };
function importShopee(rows) {
  let added = 0, updated = 0; const vals = [];
  for (const r of rows) {
    const name = String(r['商品名稱'] || '').trim(); if (!name) continue;
    const link = safeUrl(r['商品連結']), m = link.match(/product\/(\d+)\/(\d+)/), pid = String(r['商品編號'] || '').trim() || (m && m[2]);
    const id = m ? `sp_${m[1]}_${m[2]}` : pid ? `sp_0_${pid}` : '';
    const price = num(String(r['商品價格'] || '').replace(/[$,s]/g, '')), sales = salesNum(r['銷售量']);
    const shop = String(r['商店名稱'] || '').trim().slice(0, 80), aff = safeUrl(r['推廣連結']), rate = num(String(r['分潤率'] || '').replace('%', ''));
    vals.push({ price, sales: num(sales), comm: commOf({ price, base: rate }) });
    const old = items.find((i) => (id && i.id === id) || (pid && (String(i.url).match(/(\d+)$/) || [])[1] === pid) || keyOf(i.name) === keyOf(name));
    if (old) {
      // 與上次匯入比較：價格上漲 10% 以上、分潤率下降 → 風險標記；銷量變化 → 趨勢（供內容日曆使用）
      const risk = [];
      if (price && num(old.price) && price >= num(old.price) * 1.1) risk.push('價格剛上漲');
      if (rate && num(old.base) && rate < num(old.base)) risk.push('分潤率下降');
      if (sales && num(old.sales)) old.trend = sales > num(old.sales) ? '上升' : sales < num(old.sales) ? '下降' : '持平';
      old.risk = risk; old.updAt = new Date().toISOString();
      Object.assign(old, { price: price || old.price, sales: sales || old.sales, shop: shop || old.shop, aff: aff || old.aff, url: link || old.url, base: rate || old.base });
      rescore(old); updated++; continue;
    }
    const trust = sales >= 10000 ? 5 : sales >= 1000 ? 4 : 3;
    const it = makeItem({ ...blankDraft(), id: id || undefined, name, category: autoCat(name), price, base: rate, scores: { ...blankDraft().scores, trust }, sales, shop, aff, url: link, src: 'shopee' });
    it.status = 'watch'; it.updAt = it.createdAt; it.risk = []; items.push(it); added++;
  }
  save.i();
  return { added, updated, vals };
}
function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  store.set('lastBackup', Date.now());
}
const ITEM_COLS = ['id', 'name', 'category', 'price', 'base', 'xtra', 'platform', 'format', ...USER_DIMS.map((d) => d.k), 'total', 'grade', 'status', 'note', 'views', 'clicks', 'orders', 'commission', 'createdAt', ...EXTRA];
const flatItem = (i) => ({ ...i, ...i.scores, ...(i.actual || {}) });
function importItems(rows) {
  let n = 0;
  for (const r of rows) {
    if (!r.name) continue;
    const it = makeItem({ ...r, url: safeUrl(r.url), category: r.src === 'shopee' ? autoCat(r.name, r.category) : r.category, scores: Object.fromEntries(USER_DIMS.map((d) => [d.k, clamp(Math.round(num(r[d.k])) || 3, 1, 5)])) });
    it.id = r.id || it.id; it.status = STATUS[r.status] ? r.status : 'todo'; it.note = String(r.note || '').slice(0, 500);
    it.actual = { views: r.views || '', clicks: r.clicks || '', orders: r.orders || '', commission: r.commission || '' };
    it.createdAt = r.createdAt || it.createdAt;
    const ix = items.findIndex((x) => x.id === it.id);
    if (ix >= 0 && r.src === 'shopee') {
      // 重新匯入擷取器資料時，只更新商品數字，保留你改過的狀態、評分、備註與文案
      const o = items[ix];
      Object.assign(o, { name: it.name, category: o.category || it.category, price: it.price || o.price, base: it.base || o.base, discount: it.discount, rating: it.rating, sales: it.sales, url: it.url || o.url, summary: it.summary });
      rescore(o);
    } else if (ix >= 0) items[ix] = it; else items.push(it);
    n++;
  }
  save.i(); return n;
}
/* ========== 路由 ========== */
const VIEWS = ['list', 'pub', 'settings'];
const RENDER = { list: renderList, pub: renderPub, settings: renderSettings };
function route() {
  let v = location.hash.slice(1); if (!VIEWS.includes(v)) v = 'list';
  $$('.view').forEach((s) => { s.hidden = s.id !== 'v-' + v; });
  $$('[data-v]').forEach((a) => { const on = a.dataset.v === v; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  RENDER[v]();
  window.scrollTo(0, 0);
  $(`#v-${v} h1`)?.focus({ preventScroll: true });
}

function makeItem(p) {
  const r = scoreOf(p);
  const it = { id: p.id || uid(), name: String(p.name).trim().slice(0, 120), category: String(p.category || '').slice(0, 40), price: num(p.price), base: num(p.base), xtra: num(p.xtra), rate: num(p.base) + num(p.xtra), platform: PLATFORMS[p.platform] ? p.platform : 'other', format: String(p.format || '').slice(0, 20), scores: { ...p.scores }, total: r.total, grade: r.grade, status: 'todo', note: '', actual: { views: '', clicks: '', orders: '', commission: '' }, createdAt: new Date().toISOString() };
  for (const k of EXTRA) it[k] = p[k] ?? '';
  return it;
}
function rescore(i) { const r = scoreOf(i); i.total = r.total; i.grade = r.grade; i.rate = num(i.base) + num(i.xtra); }
/* ========== AI 文案 ========== */
function renderAnalyze(j, p) {
  const o = j.json, sub = subId(p);
  const L = (a) => (Array.isArray(a) && a.length ? `<ul>${a.map((x) => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul>` : '<p class="muted">（無）</p>');
  let h, t;
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    const str = (x) => (typeof x === 'string' ? x : JSON.stringify(x));
    const posts = (Array.isArray(o.posts) ? o.posts : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 5);
    posts.forEach((x, n) => { outText['post' + n] = x; });
    const long = typeof o.longPost === 'string' ? o.longPost.trim() : '';
    if (long) outText.postLong = long;
    const car = Array.isArray(o.carousel) ? o.carousel : [];
    const tags = (Array.isArray(o.hashtags) ? o.hashtags : []).join(' ');
    const replies = Array.isArray(o.replies) ? o.replies : [];
    const fp = o.festivalPost && typeof o.festivalPost === 'object' && typeof o.festivalPost.post === 'string' && o.festivalPost.post.trim() ? o.festivalPost : null;
    if (fp) outText.postFest = fp.post;
    h = `<p class="verdict">${esc(o.verdict)}</p>
    ${fp ? `<h3>🎉 節慶活動文案（${esc(fp.festival || '近期節慶')}）</h3><div class="post fest"><p>${esc(fp.post)}</p><button type="button" data-act="copy" data-k="postFest">複製</button></div>` : ''}
    ${posts.length ? `<h3>短貼文（Threads／IG／FB，可直接複製）</h3>${posts.map((x, n) => `<div class="post"><p>${esc(x)}</p><button type="button" data-act="copy" data-k="post${n}">複製</button></div>`).join('')}` : ''}
    ${long ? `<h3>心得長文（FB 社團／Dcard）</h3><div class="post"><p>${esc(long)}</p><button type="button" data-act="copy" data-k="postLong">複製</button></div>` : ''}
    <h3>吸睛第一句</h3>${L(o.headlines || o.hooks)}
    ${car.length ? `<h3>IG 多圖輪播規劃</h3><div class="tw"><table><thead><tr><th>張數</th><th>圖上大字</th><th>說明</th></tr></thead><tbody>${car.map((s, n) => `<tr><td>${esc(s?.slide || `第 ${n + 1} 張`)}</td><td>${esc(s?.title)}</td><td>${esc(s?.text)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h3>實拍照片建議</h3>${L(o.imageIdeas)}
    <div class="grid2"><div><h3>優勢</h3>${L(o.strengths)}</div><div><h3>風險</h3>${L(o.risks)}</div></div>
    <h3>CTA 與連結放置</h3><p>${esc(o.cta)}</p>
    <h3>Hashtag</h3><p>${esc(tags)}</p>
    ${o.bestTime ? `<h3>建議發文時段</h3><p>${esc(str(o.bestTime))}</p>` : ''}
    ${replies.length ? `<h3>預想留言與回覆</h3>${L(replies)}` : ''}
    <h3>A/B 測試建議</h3>${L(o.tests)}<h3>合規提醒</h3>${L(o.compliance)}`;
    const ls = (a) => (Array.isArray(a) ? a.map((x) => `- ${str(x)}`).join('\n') : '');
    t = `【${p.name}】${o.verdict || ''}\n\n${fp ? `節慶活動文案（${fp.festival || ''}）\n${fp.post}\n\n` : ''}${posts.length ? `短貼文\n${posts.map((x, n) => `${n + 1}. ${x}`).join('\n\n')}\n\n` : ''}${long ? `心得長文\n${long}\n\n` : ''}吸睛第一句\n${ls(o.headlines || o.hooks)}\n\n${car.length ? `IG 輪播\n${car.map((s, n) => `${s?.slide || `第 ${n + 1} 張`}｜${s?.title || ''}｜${s?.text || ''}`).join('\n')}\n\n` : ''}實拍照片建議\n${ls(o.imageIdeas)}\n\nCTA：${o.cta || ''}\nHashtag：${tags}\n${o.bestTime ? `發文時段：${str(o.bestTime)}\n` : ''}\n合規提醒\n${ls(o.compliance)}\n\nSub_id：${sub}`;
  } else { h = `<div class="md">${md(j.text)}</div>`; t = j.text + `\n\nSub_id：${sub}`; }
  if (safeUrl(p.aff)) { outText.aff = p.aff; h += `<h3>推廣連結</h3><div class="post"><p>${esc(p.aff)}</p><button type="button" data-act="copy" data-k="aff">複製</button></div>`; t += `\n推廣連結：${p.aff}`; }
  h += `<h3>建議 Sub_id</h3><p><code>${esc(sub)}</code> <span class="hint">（平台_日期_商品代碼，貼到自定義連結的 Sub_id 欄）</span></p>`;
  return outCard('analyze', h, j, t);
}
/* ========== M7 候選清單 ========== */
let recMap = {};
function calcRec() { recMap = Object.fromEntries(items.map((i) => [i.id, i.total])); }
const SORT_FN = {
  rec: (a, b) => (recMap[b.id] || 0) - (recMap[a.id] || 0) || b.total - a.total,
  rate: (a, b) => num(b.base) + num(b.xtra) - num(a.base) - num(a.xtra) || b.total - a.total,
  score: (a, b) => b.total - a.total,
  sales: (a, b) => num(b.sales) - num(a.sales) || b.total - a.total,
  comm: (a, b) => commOf(b) - commOf(a) || b.total - a.total,
  priceAsc: (a, b) => num(a.price) - num(b.price),
  new: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
};
/* ========== 發布清單 ========== */
const picked = new Set(), pubPicked = new Set();
const INQ = (i) => i.status === 'todo' || i.status === 'copy';   // 待發文、已產文案＝在發布清單中（未發布）
const INPUB = (i) => INQ(i) || i.status === 'done';               // 發布清單中的全部商品（含已發布）
const pad2 = (n) => String(n).padStart(2, '0');
const fmtDT = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
// 改狀態時一併處理發布時間：改成「已發布」自動記錄現在時間，改離「已發布」則清除
function setStatus(i, s) {
  if (!STATUS[s]) return;
  if (s === 'done' && i.status !== 'done') i.publishedAt = new Date().toISOString();
  if (s !== 'done') i.publishedAt = '';
  if ((s === 'todo' || s === 'copy') && !i.queuedAt) i.queuedAt = new Date().toISOString();
  if (s === 'watch' || s === 'drop') i.queuedAt = '';
  i.status = s;
}
const queue = (i) => { if (!INQ(i) && i.status !== 'done') setStatus(i, i.aiText ? 'copy' : 'todo'); };
function updPickBtn() { const b = $('#pickBtn'); if (b) { b.textContent = `加入發布清單（${picked.size}）`; b.disabled = !picked.size; } }
function updPubBtns() {
  const sel = items.filter((i) => pubPicked.has(i.id)), nd = sel.filter(INQ).length, dn = sel.filter((i) => i.status === 'done').length;
  for (const [id, l, c] of [['pubDoneBtn', '標記已發布', nd], ['pubUndoBtn', '取消已發布', dn], ['pubOutBtn', '移出清單', sel.length]]) { const b = document.getElementById(id); if (b) { b.textContent = l + '（' + c + '）'; b.disabled = !c; } }
}
// 產生文案視窗裡的「節慶活動」區塊：預設帶入近三週節慶，可修改或取消
const festForm = () => `<div class="fest-box">
  <div class="checks"><label><input type="checkbox" id="festOn"${S.festOn !== false ? ' checked' : ''}>加一段節慶活動文案</label></div>
  <label>節慶／活動資訊（選填，提供給 AI 參考）<textarea id="festText" rows="2" maxlength="500" placeholder="${festAuto() ? '' : '近三週沒有偵測到節慶，可自行輸入活動資訊（例如：店慶 12/1–12/7 全館 9 折）'}">${esc(festAuto())}</textarea></label>
  <p class="hint">已依現在時間（${fmtDT(new Date().toISOString()).slice(0, 10)}）自動帶入未來三週的節慶與電商檔期，可直接修改（例如補上優惠內容與時間）；AI 只會使用這裡提供的活動細節，商品不適合時不會硬寫。<button type="button" class="link" data-act="festFill">重新帶入近期節慶</button></p>
</div>`;
function renderPub() {
  for (const id of [...pubPicked]) { const i = items.find((x) => x.id === id); if (!i || !INPUB(i)) pubPicked.delete(id); }
  // 待發布與已發布放在同一個清單，標記已發布後留在原位置（依加入時間排序）
  const all = items.filter((i) => INQ(i) || i.status === 'done').sort((a, b) => String(a.queuedAt || a.publishedAt || a.createdAt).localeCompare(String(b.queuedAt || b.publishedAt || b.createdAt)));
  $('#pubQueueN').textContent = all.filter(INQ).length; $('#pubDoneN').textContent = all.filter((i) => i.status === 'done').length;
  // 狀態篩選：全部／待發布／已發布
  const nq = all.filter(INQ).length, nd = all.length - nq;
  $('#pubChips').innerHTML = [['all', '全部', all.length], ['todo', '待發布', nq], ['done', '已發布', nd]]
    .map(([k, l, n]) => `<button type="button" role="tab" data-act="pubSel" data-f="${k}" aria-selected="${pubSel === k}">${l} <span class="n">${n}</span></button>`).join('');
  const arr = all.filter((i) => pubSel === 'all' || (pubSel === 'done' ? i.status === 'done' : INQ(i)));
  pubShown = arr.map((i) => i.id);
  $('#pubQueue').innerHTML = arr.length ? arr.map(pubRow).join('')
    : all.length ? `<p class="empty">沒有${pubSel === 'done' ? '已發布' : '待發布'}的商品。</p>`
    : '<p class="empty">發布清單是空的。到「<a href="#list">商品</a>」勾選商品後按「加入發布清單」。</p>';
  updPubBtns();
}
let pubSel = 'all', pubShown = [];
// AI 文案裡的建議發文時段（舊資料沒有 aiData 時，從文字版「發文時段：」那行取出）
function bestTimeOf(i) {
  const b = i.aiData && i.aiData.json && i.aiData.json.bestTime;
  if (b) return typeof b === 'string' ? b : JSON.stringify(b);
  const m = /發文時段：(.+)/.exec(i.aiText || '');
  return m ? m[1].trim() : '';
}
function pubRow(i) {
  const id = esc(i.id), done = i.status === 'done';
  return `<article class="pc pub${done ? ' isdone' : ''}">
    <div class="pc-top"><span><label class="pick"><input type="checkbox" data-ppick="${id}"${pubPicked.has(i.id) ? ' checked' : ''} aria-label="選取 ${esc(i.name)}"></label>${done ? '<span class="tag pubtag">✓ 已發布</span> ' : ''}<span class="cat ${catClass(i.category)}">${esc(i.category || '未分類')}</span></span><span class="muted sm">${esc(i.shop || '')}</span></div>
    <h3>${esc(i.name)}</h3>
    <div class="pc-row"><span>${num(i.price) ? `<b class="price">$${fmt(num(i.price))}</b>` : ''}</span><span class="muted">${num(i.sales) ? `月銷 ${kfmt(num(i.sales))}` : ''}</span></div>
    <div class="pc-row comm"><span>預估社群分潤 <b>$${fmt(commOf(i), 1)}</b></span><span class="muted sm">分潤率 ${fmt(num(i.base) + num(i.xtra), 1)}%＋${bonus()}%</span></div>
    <div class="pc-row sm"><span>評分 <b>${fmt(i.total, 1)}</b> <span class="grade g${i.grade}">${i.grade}</span></span><span>${safeUrl(i.url) ? `<a href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener noreferrer">來源</a>` : ''}</span></div>
    <div class="pc-row"><span class="sm ${done ? 'pubok' : 'muted'}">${done ? `✓ 已發布｜${fmtDT(i.publishedAt) || '時間未記錄'}` : `${STATUS[i.status]}｜加入於 ${fmtDT(i.queuedAt || i.createdAt)}`}</span></div>
    ${i.aiAt ? `<div class="sm aiat">📝 文案產生於 ${fmtDT(i.aiAt)}</div>` : ''}
    ${bestTimeOf(i) ? `<div class="besttime"><b>⏰ 建議發文時段</b><span>${esc(bestTimeOf(i))}</span></div>` : ''}
    <div class="acts">
      ${done ? `<span class="btn btn-done" role="status">✓ 已發布</span><button type="button" class="danger" data-act="unpublish" data-id="${id}">取消已發布</button>` : `<button type="button" data-act="publish" data-id="${id}">標記已發布</button>`}
      ${safeUrl(i.aff) ? `<button type="button" data-act="copyAff" data-id="${id}">複製推廣連結</button>` : ''}
      ${i.aiText ? `<button type="button" data-act="viewCopy" data-id="${id}">查看文案</button>` : ''}${i.aiFest ? `<button type="button" data-act="showFest" data-id="${id}">節慶資訊</button>` : ''}<button type="button" data-act="itemAI" data-id="${id}">${i.aiText ? '重新產文案' : '產生文案'}</button>
      ${done ? '' : `<button type="button" class="ghost" data-act="unqueue" data-id="${id}">移出清單</button>`}
    </div>
  </article>`;
}

let catSel = 'all', gradeSel = 'all', shownIds = [];
function renderList() {
  // 類別按鈕：點選即顯示該類別排行（件數依類別多寡排序，「其他」放最後）
  const cnt = {};
  for (const i of items) if (i.status !== 'drop') cnt[i.category || '未分類'] = (cnt[i.category || '未分類'] || 0) + 1;
  const cats = Object.keys(cnt).sort((a, b) => (a === '其他') - (b === '其他') || cnt[b] - cnt[a]);
  if (catSel !== 'all' && !cnt[catSel]) catSel = 'all';
  const total = Object.values(cnt).reduce((s, n) => s + n, 0);
  $('#catChips').innerHTML = [['all', '全部', total], ...cats.map((c) => [c, c, cnt[c]])]
    .map(([k, l, n]) => `<button type="button" role="tab" data-act="catSel" data-c="${esc(k)}" aria-selected="${catSel === k}">${esc(l)} <span class="n">${n}</span></button>`).join('');
  calcRec();
  const q = norm($('#listQ').value), c = catSel;
  const inCat = items.filter((i) => (c === 'all' || (i.category || '未分類') === c) && (!q || norm(`${i.name} ${i.category} ${i.shop} ${i.summary} ${i.note}`).includes(q)));
  // 等級篩選：件數依目前類別與搜尋條件計算
  const gc = { S: 0, A: 0, B: 0, C: 0 };
  inCat.forEach((i) => { if (gc[i.grade] != null) gc[i.grade]++; });
  if (gradeSel !== 'all' && !gc[gradeSel]) gradeSel = 'all';
  $('#gradeChips').innerHTML = '<span class="lbl">等級</span>' + [['all', inCat.length], ...['S', 'A', 'B', 'C'].map((g) => [g, gc[g]])]
    .map(([k, n]) => `<button type="button" role="tab" data-act="gradeSel" data-g="${k}" aria-selected="${gradeSel === k}"${k !== 'all' && !n ? ' disabled' : ''} title="${k === 'all' ? '全部等級' : `${k} 級：${GRADE_ACT[k]}`}">${k === 'all' ? '全部' : `<span class="grade g${k}">${k}</span>`} <span class="n">${n}</span></button>`).join('');
  const arr = inCat.filter((i) => gradeSel === 'all' || i.grade === gradeSel).sort(SORT_FN[$('#listSort').value] || SORT_FN.rec);
  shownIds = arr.map((i) => i.id);
  $('#listCount').textContent = `${c === 'all' ? '綜合排行' : `${c} 排行`}${gradeSel === 'all' ? '' : `・${gradeSel} 級`}｜${arr.length} 件`;
  updPickBtn();
  if (!arr.length) { $('#listBody').innerHTML = `<p class="empty">${items.length ? '沒有符合條件的商品。' : '還沒有商品。請在上方匯入蝦皮匯出的商品檔。'}</p>`; return; }
  $('#listBody').innerHTML = `<div class="cards">${arr.map(cardItem).join('')}</div>`;
  updPickBtn();
}
function cardItem(i, idx) {
  const r = num(i.rating), a = i.actual || {}, u = safeUrl(i.url), id = esc(i.id);
  const stars = r ? `<span class="stars" aria-hidden="true">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</span> <span aria-label="評分 ${r}">${r}</span>` : '';
  const trend = i.trend === '上升' ? '<span class="up">↗ 上升</span>' : i.trend === '下降' ? '<span class="down">↘ 下降</span>' : i.trend ? `<span class="muted">→ ${esc(i.trend)}</span>` : '';
  return `<article class="pc">
    <div class="pc-top"><span><label class="pick" title="選取以加入發布清單"><input type="checkbox" data-pick="${id}"${picked.has(i.id) ? ' checked' : ''} aria-label="選取 ${esc(i.name)}"></label><span class="rk${idx < 3 ? ' top' : ''}">#${idx + 1}</span> <span class="cat ${catClass(i.category)}">${esc(i.category || '未分類')}</span></span><span class="muted sm">${esc(i.shop || '')}</span></div>
    <h3>${esc(i.name)}</h3>
    <div class="pc-row"><span>${num(i.price) ? `<b class="price">$${fmt(num(i.price))}</b>` : '<span class="muted">價格未知</span>'}${num(i.discount) ? `<span class="disc">-${fmt(num(i.discount))}%</span>` : ''}</span><span class="muted">${num(i.sales) ? `月銷 ${kfmt(num(i.sales))}` : ''}</span></div>
    ${stars || trend ? `<div class="pc-row"><span>${stars}</span>${trend}</div>` : ''}
    ${i.summary ? `<p class="sum">${esc(i.summary)}</p>` : ''}
    <div class="pc-row comm"><span>預估社群分潤 <b>$${fmt(commOf(i), 1)}</b></span><span class="muted sm">分潤率 ${fmt(num(i.base) + num(i.xtra), 1)}%＋${bonus()}%</span></div>
    <div class="pc-row sm"><span>評分 <b>${fmt(i.total, 1)}</b> <span class="grade g${i.grade}">${i.grade}</span>${scoreOf(i).capped ? ' <span class="tag" title="銷量或預估社群分潤只得 1 分，總分上限 64">上限</span>' : ''}</span><span>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">來源</a>` : ''}${i.src === 'ai' ? ' <span class="tag">AI 找到</span>' : ''}</span></div>
    ${a.views !== '' && a.views != null ? `<div class="sm muted">實際：${fmt(num(a.views))} 觸及／${fmt(num(a.orders))} 單／${fmt(num(a.commission))} 元</div>` : ''}
    ${i.note ? `<div class="sm muted">備註：${esc(i.note)}</div>` : ''}
    <div class="acts"><button type="button" data-act="editItem" data-id="${id}">編輯</button><button type="button" class="danger" data-act="delItem" data-id="${id}">刪除</button></div>
  </article>`;
}
function editItem(id) {
  const i = items.find((x) => x.id === id); if (!i) return;
  const a = i.actual || {}, d = $('#dlg');
  const nf = (n, l, v, step = 'any') => `<label>${l}<input name="${n}" type="number" inputmode="decimal" min="0" step="${step}" value="${esc(v)}"></label>`;
  d.innerHTML = `<form method="dialog" id="fEdit"><h2>${esc(i.name)}</h2>
    <div class="row2">
      <label class="span2">類別<input name="category" maxlength="40" list="cats" value="${esc(i.category)}"></label>
      ${nf('price', '價格（元）', i.price)}${nf('base', '分潤率 %（匯出值）', i.base)}${nf('discount', '折扣 %', i.discount)}
      ${nf('rating', '評分', i.rating)}${nf('sales', '月銷', i.sales)}
    </div>
    <label>商店名稱<input name="shop" maxlength="80" value="${esc(i.shop)}"></label>
    <label>商品網址<input name="url" type="url" maxlength="500" value="${esc(i.url)}"></label>
    <label>推廣連結（分潤短網址）<input name="aff" type="url" maxlength="300" value="${esc(i.aff)}"></label>
    <label>備註<textarea name="note" rows="2" maxlength="500">${esc(i.note)}</textarea></label>
    <div class="checks"><label><input type="checkbox" name="oos"${i.oos ? ' checked' : ''}>缺貨（內容日曆暫不排入）</label>${Array.isArray(i.risk) && i.risk.length ? `<label><input type="checkbox" name="clrRisk">清除警示：${esc(i.risk.join('、'))}</label>` : ''}</div>
    <h3>實際成效回填（復盤）</h3><div class="row2">${nf('views', '觸及', a.views)}${nf('clicks', '點擊', a.clicks)}${nf('orders', '訂單', a.orders)}${nf('commission', '佣金（元）', a.commission)}</div>
    <p class="hint">分潤比例請以蝦皮分潤後台為準；修改後分數會自動重算。</p>
    <div class="btns"><button value="cancel" formnovalidate>取消</button><button value="ok" class="pri">儲存</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const f = new FormData($('#fEdit'));
    i.note = String(f.get('note')).slice(0, 500); i.category = String(f.get('category')).trim().slice(0, 40); i.url = safeUrl(f.get('url'));
    i.price = num(f.get('price')); i.base = num(f.get('base')); i.xtra = 0; i.shop = String(f.get('shop')).trim().slice(0, 80); i.aff = safeUrl(f.get('aff'));
    for (const k of ['discount', 'rating', 'sales']) i[k] = numOr(f.get(k));
    i.actual = Object.fromEntries(['views', 'clicks', 'orders', 'commission'].map((k) => [k, f.get(k)]));
    i.oos = !!f.get('oos'); if (f.get('clrRisk')) i.risk = [];
    rescore(i); save.i(); softRefresh(); toast('已儲存');
  };
  if (!d.open) d.showModal();
}
/* ========== M9 設定 ========== */
async function checkConn() {
  const el = $('#connStatus'); el.textContent = '檢查中…';
  try {
    const r = await fetch('/api/ai', { cache: 'no-store' }); const j = await r.json();
    el.innerHTML = `<b class="${j.hasKey || S.ownKey ? '' : 'err'}">已連線</b>｜伺服器金鑰：${j.hasKey ? '已設定' : '未設定'}｜存取碼：${j.needCode ? (S.accessCode ? '需要（已填）' : '<span class="err">需要（未填）</span>') : '不需要'}｜預設模型：${esc(j.model)}${S.ownKey ? '｜使用自備金鑰' : ''}`;
  } catch { el.innerHTML = '<span class="err">無法連線到 /api/ai</span>。本機直接開啟檔案時沒有後端，請用 <code>netlify dev</code> 或部署後使用。'; }
}
function renderSettings() {
  $('#setCode').value = S.accessCode; $('#setKey').value = S.ownKey;
  $('#setWeights').innerHTML = DIMS.map((d) => `<label>${esc(d.n)}${d.auto ? '（自動）' : ''}<input type="number" min="0" max="100" inputmode="numeric" data-sw="${d.k}" value="${esc(S.weights[d.k])}"></label>`).join('');
  $('#setBonus').value = bonus();
  const T = thr();
  $('#thrInfo').innerHTML = `<p class="hint">${S.thr ? `依 ${fmtDT(S.thr.at)} 的 ${S.thr.n} 筆商品計算` : '尚未校正，使用預設門檻'}</p><ul class="sm"><li>銷量：${fmtThr('sales', T.sales)}</li><li>預估社群分潤：${fmtThr('comm', T.comm)}</li><li>價格：${fmtThr('price', T.price)}</li></ul>`;
  wSum(); checkConn();
}
function wSum() {
  const v = $$('[data-sw]').map((e) => num(e.value)), t = v.reduce((x, y) => x + y, 0);
  $('#wSum').textContent = t ? `合計 ${fmt(t)}；實際比例：${DIMS.map((d, k) => `${d.n} ${fmt(v[k] / t * 100)}%`).join('、')}` : '權重合計不能為 0';
}

/* ========== 雲端同步（電腦與手機共用同一份資料） ========== */
// 每件商品記錄最後修改時間 mt；刪除的商品記在 tomb（墓碑），合併時以較新的版本為準
const SYNC_SETTINGS = ['weights', 'wv', 'thr', 'bonus', 'festOn', 'alias', 'cal', 'events', 'calGen'];
let tomb = store.get('tomb', {}), snap = store.get('snap', null), syncAt = store.get('syncAt', 0);
let syncing = false, syncAgain = false, syncTimer = 0, lastPull = 0, syncDirty = store.get('syncDirty', false);
const hashStr = (str) => { let h = 5381; for (let k = 0; k < str.length; k++) h = ((h << 5) + h + str.charCodeAt(k)) >>> 0; return h.toString(36); };
const hashItem = (i) => { const { mt, ...r } = i; return hashStr(JSON.stringify(r)); };
function stampItems() {
  const now = Date.now(), next = {}; let changed = !snap && items.length > 0;
  for (const i of items) {
    const h = hashItem(i);                       // 雜湊不含 mt，所以標記時間不影響比對
    if (!snap) { if (!i.mt) i.mt = now; }        // 第一次啟用同步：既有商品記為現在
    else if (snap[i.id] !== h) { i.mt = now; changed = true; }   // 新增或內容有變動
    next[i.id] = h;
  }
  if (snap) for (const id in snap) if (!next[id]) { tomb[id] = now; changed = true; }
  snap = next; store.set('snap', snap); store.set('tomb', tomb);
  return changed;
}
const syncPayload = () => ({ items, tomb, settings: { ...Object.fromEntries(SYNC_SETTINGS.map((k) => [k, S[k]])), at: S.setAt || 0 } });
function mergeRemote(remote) {
  if (!remote) return false;
  let changed = false;
  for (const [id, t] of Object.entries(remote.tomb || {})) if (!(tomb[id] >= t)) tomb[id] = t;
  const map = new Map(items.map((i) => [i.id, i]));
  for (const ri of remote.items || []) {
    const li = map.get(ri.id);
    if (!li) { if (!(tomb[ri.id] >= (ri.mt || 0))) { map.set(ri.id, ri); changed = true; } }
    else if ((ri.mt || 0) > (li.mt || 0)) { for (const k of Object.keys(li)) if (!(k in ri)) delete li[k]; Object.assign(li, ri); changed = true; }
  }
  for (const [id, t] of Object.entries(tomb)) { const it = map.get(id); if (it && (it.mt || 0) <= t) { map.delete(id); changed = true; } }
  const old = Date.now() - 90 * 864e5; for (const id in tomb) if (tomb[id] < old) delete tomb[id];
  items = [...map.values()];
  const rs = remote.settings;
  if (rs && (rs.at || 0) > (S.setAt || 0)) { for (const k of SYNC_SETTINGS) if (rs[k] !== undefined) S[k] = rs[k]; S.setAt = rs.at; store.set('settings', S); changed = true; }
  // 合併進來的資料不算本機修改：直接更新快照，保留原本的修改時間
  snap = Object.fromEntries(items.map((i) => [i.id, hashItem(i)]));
  store.set('items', items); store.set('snap', snap); store.set('tomb', tomb);
  return changed;
}
function setSyncStatus(t, bad, warn) {
  for (const el of $$('.sync-status')) { el.textContent = t; el.classList.toggle('err', !!bad); el.classList.toggle('warn', !bad && !!warn); }
}
async function syncNow(retry = 0) {
  if (location.protocol === 'file:') { setSyncStatus('本機檔案模式，未同步'); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; setSyncStatus('☁ 同步中…');
  const h = { 'Content-Type': 'application/json' }; if (S.accessCode) h['x-access-code'] = S.accessCode;
  try {
    const g = await fetch('/api/data', { headers: h, cache: 'no-store' });
    const j = await g.json().catch(() => ({ ok: false, error: `HTTP ${g.status}` }));
    if (!g.ok || !j.ok) throw Object.assign(new Error(j.error || `HTTP ${g.status}`), { status: g.status });
    lastPull = Date.now();
    if (mergeRemote(j.data)) softRefresh();
    // 本機有修改（或雲端還是空的）才上傳；只是收到別台的更新時不重複上傳
    if (syncDirty || (!j.at && items.length)) {
      const sentDirty = syncDirty; syncDirty = false; store.set('syncDirty', false);
      const p = await fetch('/api/data', { method: 'PUT', headers: h, body: JSON.stringify({ data: syncPayload(), base: j.at }) });
      const pj = await p.json().catch(() => ({ ok: false, error: `HTTP ${p.status}` }));
      if (p.status === 409 && retry < 3) { syncDirty = syncDirty || sentDirty; store.set('syncDirty', syncDirty); syncing = false; return syncNow(retry + 1); }
      if (!p.ok || !pj.ok) { syncDirty = syncDirty || sentDirty; store.set('syncDirty', syncDirty); throw Object.assign(new Error(pj.error || `HTTP ${p.status}`), { status: p.status }); }
      syncAt = pj.at;
    } else syncAt = j.at;
    store.set('syncAt', syncAt);
    setSyncStatus(`☁ 已同步 ${fmtDT(new Date().toISOString()).slice(5)}`);
  } catch (e) {
    setSyncStatus(e.status === 401 ? '☁ 未同步：需要存取碼' : e instanceof TypeError ? '☁ 離線，未同步' : `☁ 同步失敗：${e.message}`, true);
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; syncNow(); }
  }
}
// 手動同步：本機有修改時在右上角提醒，按下按鈕才同步
const markDirty = () => { syncDirty = true; store.set('syncDirty', true); setSyncStatus('☁ 有變更未同步', false, true); };
const idleStatus = () => setSyncStatus(syncDirty ? '☁ 有變更未同步' : syncAt ? `☁ 上次同步 ${fmtDT(new Date(syncAt).toISOString()).slice(5)}` : '☁ 點此同步', false, syncDirty);
// 收到別台裝置的更新時，只重繪目前畫面、保留捲動位置；正在編輯時延後到結束後再更新
let pendingRender = false;
function softRefresh() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'list', ae = document.activeElement;
  if ($('#dlg').open || (v === 'settings' && ae?.closest?.('#v-settings') && ae.matches('input,textarea,select'))) { pendingRender = true; return; }
  pendingRender = false;
  const y = window.scrollY; RENDER[v](); window.scrollTo(0, y);
}
$('#dlg').addEventListener('close', () => { if (pendingRender) setTimeout(softRefresh, 50); });
document.addEventListener('focusout', () => { if (pendingRender) setTimeout(softRefresh, 50); });

/* ========== 事件 ========== */
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };
const ACT = {
  // 文案：在彈出視窗產生並顯示
  // 第一步：開啟視窗，先設定節慶活動段落
  itemAI(b) {
    const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
    const d = $('#dlg');
    d.innerHTML = `<div class="dlg-head"><h2>${esc(i.name)}｜產生文案</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>
      ${festForm()}
      <div class="btns"><button type="button" class="pri" data-act="genCopy" data-id="${esc(i.id)}">開始產生文案</button><button type="button" class="ghost" data-act="closeDlg">取消</button></div>
      <div id="dlgOut"></div>`;
    if (!d.open) d.showModal();
  },
  // 第二步：依節慶設定呼叫 AI，結果顯示在同一個視窗
  async genCopy(b) {
    const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
    const d = $('#dlg'), want = $('#festOn').checked, fest = want ? ($('#festText').value.trim() || festAuto()) : '';
    const el = $('#dlgOut'); loading(el);
    try {
      const j = await ai('analyze', { name: i.name, category: i.category, price: num(i.price), platform: i.platform, format: i.format, scores: scoreOf(i).v, total: i.total, grade: i.grade, wantFest: want && !!fest, festival: fest }, b);
      b.textContent = '重新產生';
      if (d.open) el.innerHTML = renderAnalyze(j, i);
      i.aiText = String(outText.analyze || '').slice(0, 8000);
      i.aiData = { json: j.json, text: String(j.text || '').slice(0, 12000), model: j.model };
      i.aiAt = new Date().toISOString(); i.aiFest = want ? fest.slice(0, 200) : '';
      if (i.status === 'todo') setStatus(i, 'copy');
      save.i(); softRefresh();   // 對話框開著時會等關閉後再重繪目前畫面（發布清單或日曆）
    } catch (e) { showErr(el, e); }
  },
  viewCopy(b) {
    const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
    const d = $('#dlg');
    const body = i.aiData ? renderAnalyze({ ...i.aiData, sources: [] }, i) : (outText.view = i.aiText, `<div class="pre">${esc(i.aiText)}</div><div class="btns"><button type="button" class="pri" data-act="copy" data-k="view">複製全部</button></div>`);
    d.innerHTML = `<div class="dlg-head"><h2>${esc(i.name)}｜文案</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>${i.aiAt ? `<p class="hint">產生於 ${fmtDT(i.aiAt)}${i.aiFest ? `｜節慶資訊：${esc(i.aiFest)}` : '｜未加節慶文案'}</p>` : ''}${body}`;
    if (!d.open) d.showModal();
  },
  closeDlg() { $('#dlg').close(); },
  navToggle() { setNavMini(!document.body.classList.contains('nav-mini')); },
  showFest(b) {
    const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
    const fp = i.aiData?.json?.festivalPost, post = fp && typeof fp.post === 'string' ? fp.post.trim() : '';
    if (post) outText.festView = post;
    const d = $('#dlg');
    d.innerHTML = `<div class="dlg-head"><h2>${esc(i.name)}｜節慶資訊</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>
      <p class="hint">文案產生於 ${fmtDT(i.aiAt)}</p>
      <h3>當次使用的節慶／活動資訊</h3><p>${esc(i.aiFest)}</p>
      <h3>節慶活動文案${fp?.festival ? `（${esc(fp.festival)}）` : ''}</h3>
      ${post ? `<div class="post fest"><p>${esc(post)}</p><button type="button" data-act="copy" data-k="festView">複製</button></div>` : '<p class="muted">AI 判斷此商品不適合搭配上述節慶，所以沒有產生節慶文案。</p>'}`;
    if (!d.open) d.showModal();
  },
  copy(b) { copy(outText[b.dataset.k] || '', b); },
  copyAff(b) { const i = items.find((x) => x.id === b.dataset.id); if (i && safeUrl(i.aff)) copy(i.aff, b); },
  // 商品
  autoCatAll() {
    let n = 0;
    for (const i of items) { const c = autoCat(i.name, i.category); if (c !== i.category && (c !== '其他' || !i.category)) { i.category = c; n++; } }
    save.i(); renderList(); toast(n ? `已自動分類 ${n} 件商品` : '所有商品都已有分類');
  },
  catSel(b) { catSel = b.dataset.c; renderList(); },
  gradeSel(b) { gradeSel = b.dataset.g; renderList(); },
  queueOne(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; queue(i); save.i(); renderList(); toast('已加入發布清單'); },
  pickAdd() {
    let n = 0;
    for (const id of picked) { const i = items.find((x) => x.id === id); if (i && !INQ(i) && i.status !== 'done') { queue(i); n++; } }
    picked.clear(); save.i(); renderList(); toast(n ? `已加入發布清單 ${n} 件` : '選取的商品已在清單或已發布');
  },
  pickAll() { shownIds.forEach((id) => picked.add(id)); renderList(); toast(`已選取 ${shownIds.length} 件`); },
  pickNone() { picked.clear(); renderList(); },
  festFill() { $('#festText').value = festAuto(); toast(festAuto() ? '已帶入近三週節慶' : '近三週沒有節慶'); },
  pubAll() { pubShown.forEach((id) => pubPicked.add(id)); renderPub(); },
  pubSel(b) { pubSel = b.dataset.f; renderPub(); },
  pubNone() { pubPicked.clear(); renderPub(); },
  pubDoneSel() {
    const list = items.filter((i) => pubPicked.has(i.id) && INQ(i)); if (!list.length) return;
    list.forEach((i) => setStatus(i, 'done')); pubPicked.clear(); save.i(); renderPub(); toast(`已標記 ${list.length} 件為已發布（${fmtDT(new Date().toISOString())}）`);
  },
  pubUndoSel() {
    const list = items.filter((i) => pubPicked.has(i.id) && i.status === 'done'); if (!list.length) return;
    list.forEach((i) => setStatus(i, i.aiText ? 'copy' : 'todo')); pubPicked.clear(); save.i(); renderPub(); toast(`已取消 ${list.length} 件的已發布`);
  },
  pubOutSel() {
    const list = items.filter((i) => pubPicked.has(i.id) && INPUB(i)); if (!list.length) return;
    if (!confirm(`將 ${list.length} 件移出發布清單？`)) return;
    list.forEach((i) => setStatus(i, 'watch')); pubPicked.clear(); save.i(); renderPub();
  },
  scoreHelp() {
    const sw = DIMS.reduce((t, d) => t + num(S.weights[d.k]), 0) || 1, T = thr();
    const d = $('#dlg');
    d.innerHTML = `<div class="dlg-head"><h2>評分說明</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>
      <h3>1. 解析資料</h3><ul><li>價格：去除逗號轉數字。</li><li>銷量：取區間下限，「3,000+」為 3,000、「4 萬+」為 40,000。</li><li>分潤率：去除 % 轉數字。</li><li>預估社群分潤＝價格 ×（分潤率＋${bonus()}）÷ 100（加成 ${bonus()}% 可在設定修改）。</li></ul>
      <h3>2. 門檻（每次上傳自動校正）</h3><p>三項各自取該批商品的百分位數為切點（取兩位有效數字）。銷量與預估社群分潤：≥P90→5、≥P75→4、≥P50→3、≥P25→2、其他→1；價格越低越高分：≤P25→5、≤P50→4、≤P75→3、≤P90→2、其他→1。一批少於 ${MIN_BATCH} 筆時沿用上一次的門檻。</p>
      <div class="tw"><table><thead><tr><th>項目</th><th>權重</th><th>5 分</th><th>4 分</th><th>3 分</th><th>2 分</th></tr></thead><tbody>
        <tr><td>銷量</td><td>${fmt(num(S.weights.sales) / sw * 100)}%</td><td>≥${fmt(T.sales[3])}</td><td>≥${fmt(T.sales[2])}</td><td>≥${fmt(T.sales[1])}</td><td>≥${fmt(T.sales[0])}</td></tr>
        <tr><td>預估社群分潤（元）</td><td>${fmt(num(S.weights.comm) / sw * 100)}%</td><td>≥${fmt(T.comm[3], 1)}</td><td>≥${fmt(T.comm[2], 1)}</td><td>≥${fmt(T.comm[1], 1)}</td><td>≥${fmt(T.comm[0], 1)}</td></tr>
        <tr><td>價格（元）</td><td>${fmt(num(S.weights.price) / sw * 100)}%</td><td>≤${fmt(T.price[0])}</td><td>≤${fmt(T.price[1])}</td><td>≤${fmt(T.price[2])}</td><td>≤${fmt(T.price[3])}</td></tr>
      </tbody></table></div>
      <p class="hint">${S.thr ? `目前門檻依 ${fmtDT(S.thr.at)} 上傳的 ${S.thr.n} 筆商品計算。` : '尚未校正，使用預設門檻（100 筆樣本驗證值）。'}</p>
      <h3>3. 總分與上限</h3><p>總分＝Σ（權重 ×（得分 − 1）÷ 4）÷ 權重合計 × 100。銷量或預估社群分潤任一項只得 1 分時，總分最高 ${CAP_TOTAL} 分（卡片標示「上限」）。</p>
      <h3>4. 等級</h3><ul><li><b>S</b>：80 分以上</li><li><b>A</b>：65–79 分</li><li><b>B</b>：50–64 分</li><li><b>C</b>：未滿 50 分</li></ul>
      <h3>分類</h3><p>依商品名稱關鍵字自動判斷，分錯可在卡片按「編輯」修改。</p>`;
    if (!d.open) d.showModal();
  },
  recalAll() {
    const c = calibrate(items.map((i) => ({ price: num(i.price), sales: num(i.sales), comm: commOf(i) })));
    if (!c.ok) { toast(`目前只有 ${c.n} 件商品，少於 ${MIN_BATCH} 件，無法重算門檻`); return; }
    items.forEach(rescore); save.i(); renderSettings(); toast(`已用全部 ${c.n} 件商品重算門檻`);
  },
  resetThr() { delete S.thr; save.s(); items.forEach(rescore); save.i(); renderSettings(); toast('已恢復預設門檻'); },
  publish(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; setStatus(i, 'done'); save.i(); route(); toast(`已標記發布：${fmtDT(i.publishedAt)}`); },
  unpublish(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; setStatus(i, i.aiText ? 'copy' : 'todo'); save.i(); route(); },
  unqueue(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; setStatus(i, 'watch'); save.i(); route(); },
  editItem(b) { editItem(b.dataset.id); },
  delItem(b) { const i = items.find((x) => x.id === b.dataset.id); if (i && confirm(`確定刪除「${i.name}」？`)) { items = items.filter((x) => x !== i); save.i(); renderList(); } },
  delAll() { if (items.length && confirm(`確定刪除全部 ${items.length} 件商品？建議先匯出備份。`)) { items = []; save.i(); renderList(); } },
  expItems() { download(`商品清單_${today()}.csv`, toCSV(items.map(flatItem), ITEM_COLS)); },
  // 設定
  checkConn,
  syncNow() { syncNow(); },
  resetWeights() { $$('[data-sw]').forEach((e) => { e.value = DEF_W[e.dataset.sw]; }); wSum(); toast('已填入預設權重，按「儲存設定」生效'); },
  saveSettings() {
    const w = Object.fromEntries($$('[data-sw]').map((e) => [e.dataset.sw, clamp(num(e.value), 0, 100)]));
    if (!Object.values(w).some((x) => x > 0)) { toast('權重合計不能為 0'); return; }
    S.weights = w; S.accessCode = $('#setCode').value.trim(); S.ownKey = $('#setKey').value.trim();
    const bv = $('#setBonus').value.trim(); S.bonus = bv === '' ? 0.5 : clamp(num(bv), 0, 100);
    save.s(); items.forEach(rescore); save.i();
    $('#saveMsg').textContent = `已儲存（${fmtDT(new Date().toISOString())}），商品分數已重新計算`;
    checkConn();
  },
  clearAll() {
    if (!confirm('確定清除這台裝置的本機資料？雲端的資料會在下次同步時重新下載回來；若要刪除所有裝置上的商品，請改用「刪除全部商品」。')) return;
    Object.keys(localStorage).filter((k) => k.startsWith('sp_')).forEach((k) => localStorage.removeItem(k));
    location.hash = '#list'; location.reload();
  },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const f = ACT[b.dataset.act]; if (f) f(b, e);
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.matches('select[data-act="status"]')) { const i = items.find((x) => x.id === t.dataset.id); if (i) { setStatus(i, t.value); save.i(); route(); } }
  else if (t.id === 'festOn') { S.festOn = t.checked; save.s(); }
  else if (t.matches('[data-ppick]')) { if (t.checked) pubPicked.add(t.dataset.ppick); else pubPicked.delete(t.dataset.ppick); updPubBtns(); }
  else if (t.matches('[data-pick]')) { if (t.checked) picked.add(t.dataset.pick); else picked.delete(t.dataset.pick); updPickBtn(); }
  else if (t.matches('[data-imp]') && t.files.length) {
    // 可一次選多個檔案，逐一匯入後彙總結果
    let added = 0, updated = 0, other = 0; const batch = [];
    const bad = [];
    for (const file of t.files) {
      try {
        const rows = await readTable(file);
        if (isShopeeFile(rows)) { const r = importShopee(rows); added += r.added; updated += r.updated; batch.push(...r.vals); }
        else other += importItems(rows);
      } catch (err) { bad.push(`${file.name}（${err?.message || '讀取失敗'}）`); }
    }
    let cal = '';
    if (batch.length) {
      const c = calibrate(batch);
      cal = c.ok ? `；已依本批 ${c.n} 筆重算評分門檻` : `；本批僅 ${c.n} 筆（少於 ${MIN_BATCH} 筆，樣本不足），沿用上一次的評分門檻`;
      items.forEach(rescore); save.i();
    }
    toast(`${t.files.length} 個檔案：新增 ${added} 件、更新 ${updated} 件${other ? `、備份匯入 ${other} 筆` : ''}${cal}${bad.length ? `；失敗：${bad.join('、')}` : ''}`);
    t.value = '';
    if (location.hash !== '#list') location.hash = '#list'; else route();
  } else if (t.id === 'listSort') renderList();
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'listQ') renderList();
  else if (t.dataset.sw) { wSum(); $('#saveMsg').textContent = '尚未儲存'; }
});

/* ========== 初始化 ========== */
$$('select[data-opt="platform"]').forEach((s) => { s.innerHTML = opts(PLATFORMS, 'fb'); });
$$('select[data-opt="format"]').forEach((s) => { s.innerHTML = FORMATS.map((f) => `<option>${esc(f)}</option>`).join(''); });
$('#listSort').innerHTML = opts(SORTS, 'rec');
items.forEach(rescore); save.i();
// 左側選單收合（電腦版），狀態記在本機
function setNavMini(on) {
  document.body.classList.toggle('nav-mini', on);
  const b = $('.nav-toggle'); if (b) { b.setAttribute('aria-expanded', String(!on)); b.title = on ? '展開選單' : '收合選單'; b.setAttribute('aria-label', b.title); b.firstElementChild.textContent = on ? '»' : '«'; }
  store.set('navMini', on);
}
setNavMini(!!store.get('navMini', false));
window.addEventListener('hashchange', route);
route();
// 打開網站時先自動同步一次，之後改由右上角按鈕手動同步
idleStatus();
const firstSync = syncNow();
