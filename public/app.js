'use strict';
/* ========== 工具函式 ========== */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const isShop = (i) => i?.kind === 'shop';
const isHttpUrl = (u) => { if (!/^https?:\/\/\S+$/i.test(String(u || ''))) return false; try { const x = new URL(u); return (x.protocol === 'http:' || x.protocol === 'https:') && !!x.hostname; } catch { return false; } };
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
const EXTRA = ['kind', 'shop', 'aff', 'queuedAt', 'publishedAt', 'aiAt', 'aiFest', 'discount', 'rating', 'sales', 'trend', 'summary', 'url', 'src', 'aiText', 'schedAt'];
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
  <p class="hint">模型：${esc(j.model)}｜AI 內容僅供參考，數字與規則請自行查證。</p></div>`;
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
    const old = items.find((i) => !isShop(i) && ((id && i.id === id) || (pid && (String(i.url).match(/(\d+)$/) || [])[1] === pid) || keyOf(i.name) === keyOf(name)));
    if (old) {
      // 與上次匯入比較：價格上漲 10% 以上、分潤率下降 → 風險標記；銷量變化 → 趨勢
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
const VIEWS = ['list', 'pub', 'stats', 'settings'];
const RENDER = { list: renderList, pub: renderPub, stats: () => renderStats(), settings: renderSettings };
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
function rescore(i) { if (isShop(i)) return; const r = scoreOf(i); i.total = r.total; i.grade = r.grade; i.rate = num(i.base) + num(i.xtra); }
/* ========== AI 文案 ========== */
// AI 回傳的欄位轉成可顯示的文字：空值（null）不顯示，物件／陣列只取裡面的文字
function aiTxt(x) {
  if (x == null) return '';
  if (Array.isArray(x)) return x.map(aiTxt).filter(Boolean).join('、');
  if (typeof x === 'object') return Object.values(x).map(aiTxt).filter(Boolean).join('｜');
  const t = String(x).trim();
  return /^(null|undefined|none|n\/a)*$/i.test(t) ? '' : t;
}
// Threads 版型：開頭一行、空一行、每句一行的內文、空一行、行動呼籲；hashtag 放最後一行
// （AI 已照版型換行時只整理 hashtag；舊文案沒換行時自動分句）。不顯示「含分潤連結」等揭露標籤
const EMO = '(?:\\p{Extended_Pictographic}\\uFE0F?|[\\u{1F3FB}-\\u{1F3FF}]|\\u200D)';
const DISCLOSE = /#?含分潤連結|#分潤連結/g;
function lineify(s, threads = true) {
  s = String(s || '').replace(/\r/g, '').replace(DISCLOSE, '').trim(); if (!s) return s;
  const tags = s.match(/#[^\s#]+/g) || [];
  let body = s.replace(/#[^\s#]+/g, '').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!body.includes('\n')) {
    body = body.replace(new RegExp(`([。！？!?]+[」』）)]*(?:\\s*${EMO})*)\\s*(?=\\S)`, 'gu'), '$1\n');
    // 舊文案補上 Threads 段落：開頭後、行動呼籲前各空一行
    const L = body.split('\n').map((x) => x.trim()).filter(Boolean);
    if (threads && L.length >= 3) body = [L[0], '', ...L.slice(1, -1), '', L[L.length - 1]].join('\n');
    else body = L.join('\n');
  }
  // 每一行結尾不留「。」「，」（後面接的表情符號保留）
  const endP = new RegExp(`[。，,、]+((?:\\s*${EMO})*)\\s*$`, 'u');
  body = body.split('\n').map((x) => x.trim().replace(endP, '$1')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return tags.length ? `${body}\n\n${tags.join(' ')}` : body;
}
function renderAnalyze(j, p) {
  const o = j.json, sub = subId(p);
  const L = (a) => { const v = (Array.isArray(a) ? a : []).map(aiTxt).filter(Boolean); return v.length ? `<ul>${v.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">（無）</p>'; };
  let h, t;
  const aff = safeUrl(p.aff) ? p.aff : '';
  if (aff) outText.aff = aff;
  const brU = brLive(p) ? bridgeUrl(p) : '';
  if (brU) outText.bridge = bridgeShareUrl(p);
  const affH = (aff ? `<h3>分潤連結</h3><div class="post"><p>${esc(aff)}</p><button type="button" data-act="copy" data-k="aff">複製</button></div>` : '')
    + (brU ? `<h3>橋接網址（貼文用，顯示美編預覽卡片）</h3><div class="post"><p>${esc(brU)}</p><button type="button" data-act="copy" data-k="bridge">複製</button></div>` : '');
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    const str = aiTxt;
    // AI 偶爾把每則貼文包成物件（例如 {type, text}），取出文字內容
    const postText = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? String(x.text || x.post || x.content || x.body || '') : '');
    const posts = (Array.isArray(o.posts) ? o.posts : []).map(postText).filter((x) => x.trim()).slice(0, 5).map(lineify);
    posts.forEach((x, n) => { outText['post' + n] = x; });
    const long = typeof o.longPost === 'string' ? lineify(o.longPost, false) : '';
    if (long) outText.postLong = long;
    const car = Array.isArray(o.carousel) ? o.carousel : [];
    const tags = (Array.isArray(o.hashtags) ? o.hashtags : []).map(aiTxt).map((x) => x.replace(DISCLOSE, '').trim()).filter((x) => x && x !== '#').join(' ');
    outText.tags = tags;
    const replies = Array.isArray(o.replies) ? o.replies : [];
    const fp = o.festivalPost && typeof o.festivalPost === 'object' && typeof o.festivalPost.post === 'string' && o.festivalPost.post.trim() ? { ...o.festivalPost, post: lineify(o.festivalPost.post) } : null;
    if (fp) outText.postFest = fp.post;
    h = `<p class="verdict">${esc(aiTxt(o.verdict))}</p>
    ${fp ? `<h3>🎉 節慶活動文案（${esc(fp.festival || '近期節慶')}）</h3><div class="post fest"><p>${esc(fp.post)}</p><button type="button" data-act="copy" data-k="postFest">複製</button></div>` : ''}
    ${posts.length ? `<h3>短貼文（Threads／IG／FB，可直接複製）</h3>${posts.map((x, n) => `<div class="post"><p>${esc(x)}</p><button type="button" data-act="copy" data-k="post${n}">複製</button></div>`).join('')}` : ''}
    ${long ? `<h3>心得長文（FB 社團／Dcard）</h3><div class="post"><p>${esc(long)}</p><button type="button" data-act="copy" data-k="postLong">複製</button></div>` : ''}
    ${tags ? `<h3>Hashtag</h3><div class="post"><p>${esc(tags)}</p><button type="button" data-act="copy" data-k="tags">複製</button></div>` : ''}
    ${affH}
    <h3>吸睛第一句</h3>${L(o.headlines || o.hooks)}
    ${car.length ? `<h3>IG 多圖輪播規劃</h3><div class="tw"><table><thead><tr><th>張數</th><th>圖上大字</th><th>說明</th></tr></thead><tbody>${car.map((s, n) => `<tr><td>${esc(s?.slide || `第 ${n + 1} 張`)}</td><td>${esc(aiTxt(s?.title))}</td><td>${esc(aiTxt(s?.text))}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h3>實拍照片建議</h3>${L(o.imageIdeas)}
    <div class="grid2"><div><h3>優勢</h3>${L(o.strengths)}</div><div><h3>風險</h3>${L(o.risks)}</div></div>
    <h3>CTA 與連結放置</h3><p>${esc(aiTxt(o.cta))}</p>
    ${aiTxt(o.bestTime) ? `<h3>建議發文時段</h3><p>${esc(aiTxt(o.bestTime))}</p>` : ''}
    ${replies.length ? `<h3>預想留言與回覆</h3>${L(replies)}` : ''}
    <h3>A/B 測試建議</h3>${L(o.tests)}<h3>合規提醒</h3>${L(o.compliance)}`;
    const ls = (a) => (Array.isArray(a) ? a.map(aiTxt).filter(Boolean).map((x) => `- ${x}`).join('\n') : '');
    t = `【${p.name}】${aiTxt(o.verdict)}\n\n${fp ? `節慶活動文案（${fp.festival || ''}）\n${fp.post}\n\n` : ''}${posts.length ? `短貼文\n${posts.map((x, n) => `${n + 1}. ${x}`).join('\n\n')}\n\n` : ''}${long ? `心得長文\n${long}\n\n` : ''}${tags ? `Hashtag\n${tags}\n\n` : ''}${aff ? `分潤連結\n${aff}\n\n` : ''}${brU ? `橋接網址\n${bridgeShareUrl(p)}\n\n` : ''}吸睛第一句\n${ls(o.headlines || o.hooks)}\n\n${car.length ? `IG 輪播\n${car.map((s, n) => `${s?.slide || `第 ${n + 1} 張`}｜${s?.title || ''}｜${s?.text || ''}`).join('\n')}\n\n` : ''}實拍照片建議\n${ls(o.imageIdeas)}\n\nCTA：${aiTxt(o.cta)}\n${aiTxt(o.bestTime) ? `發文時段：${aiTxt(o.bestTime)}\n` : ''}\n合規提醒\n${ls(o.compliance)}\n\nSub_id：${sub}`;
  } else { h = `<div class="md">${md(j.text)}</div>${affH}`; t = j.text + (aff ? `\n\n分潤連結：${aff}` : '') + `\n\nSub_id：${sub}`; }
  h += `<h3>建議 Sub_id</h3><p><code>${esc(sub)}</code> <span class="hint">（平台_日期_商品代碼，貼到自定義連結的 Sub_id 欄）</span></p>`;
  return outCard('analyze', h, j, t);
}
// 把 AI 文案結果存到商品上（單件與批次共用），回傳顯示用的 HTML
const copyReq = (i, want, fest) => isShop(i) ? { kind: 'shop', name: i.name, platform: 'fb', wantFest: want && !!fest, festival: fest } : i.manual ? { name: i.name, category: i.category === '未分類' ? '' : i.category, price: num(i.price) || undefined, platform: i.platform, wantFest: want && !!fest, festival: fest } : ({ name: i.name, category: i.category, price: num(i.price), platform: i.platform, format: i.format, scores: scoreOf(i).v, total: i.total, grade: i.grade, wantFest: want && !!fest, festival: fest });
function applyCopy(i, j, want, fest) {
  const html = renderAnalyze(j, i);
  i.aiText = String(outText.analyze || '').slice(0, 8000);
  i.aiData = { json: j.json, text: String(j.text || '').slice(0, 12000), model: j.model };
  i.aiAt = new Date().toISOString(); i.aiFest = want ? fest.slice(0, 200) : '';
  if (i.status === 'todo') setStatus(i, 'copy');
  return html;
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
let batchRunning = false, batchStop = false;   // 批次產生文案進行中／要求停止
const fmtDT = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
// 改狀態時一併處理發布時間：改成「已發布」自動記錄現在時間，改離「已發布」則清除
function setStatus(i, s) {
  if (!STATUS[s]) return;
  if (s === 'done' && i.status !== 'done') i.publishedAt = new Date().toISOString();
  if (s !== 'done') i.publishedAt = '';
  if ((s === 'todo' || s === 'copy') && !i.queuedAt) i.queuedAt = new Date().toISOString();
  if (s === 'watch' || s === 'drop') { i.queuedAt = ''; i.schedAt = ''; }   // 移出清單：排定時間一併清除
  i.status = s;
}
const queue = (i) => { if (!INQ(i) && i.status !== 'done') setStatus(i, i.aiText ? 'copy' : 'todo'); };
function updPickBtn() { const b = $('#pickBtn'); if (b) { b.textContent = `加入發布清單（${picked.size}）`; b.disabled = !picked.size; } }
function updPubBtns() {
  const sel = items.filter((i) => pubPicked.has(i.id)), nd = sel.filter(INQ).length, dn = sel.filter((i) => i.status === 'done').length;
  for (const [id, l, c] of [['pubGenBtn', '批次產生文案', batchRunning ? 0 : nd], ['pubDoneBtn', '標記已發布', nd], ['pubUndoBtn', '取消已發布', dn], ['pubOutBtn', '移出清單', sel.length]]) { const b = document.getElementById(id); if (b) { b.textContent = l + '（' + c + '）'; b.disabled = !c; } }
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
  // 商品清單／賣場清單切換
  const nItem = items.filter((i) => INPUB(i) && !isShop(i)).length, nShop = items.filter((i) => INPUB(i) && isShop(i)).length;
  $('#pubKind').innerHTML = [['item', '商品清單', nItem], ['shop', '賣場清單', nShop]]
    .map(([k, l, n]) => `<button type="button" role="tab" data-act="pubKind" data-k="${k}" aria-selected="${pubKind === k}">${l} <span class="n">${n}</span></button>`).join('');
  const all = items.filter((i) => (INQ(i) || i.status === 'done') && isShop(i) === (pubKind === 'shop')).sort((a, b) => String(a.queuedAt || a.publishedAt || a.createdAt).localeCompare(String(b.queuedAt || b.publishedAt || b.createdAt)));
  $('#pubQueueN').textContent = all.filter(INQ).length; $('#pubDoneN').textContent = all.filter((i) => i.status === 'done').length;
  // 狀態篩選：全部／待發布／已發布
  const nq = all.filter(INQ).length, nd = all.length - nq;
  $('#pubChips').innerHTML = [['all', '全部', all.length], ['todo', '待發布', nq], ['done', '已發布', nd]]
    .map(([k, l, n]) => `<button type="button" role="tab" data-act="pubSel" data-f="${k}" aria-selected="${pubSel === k}">${l} <span class="n">${n}</span></button>`).join('');
  const arr = all.filter((i) => pubSel === 'all' || (pubSel === 'done' ? i.status === 'done' : INQ(i)));
  pubShown = arr.map((i) => i.id);
  $('#pubQueue').innerHTML = arr.length ? arr.map(pubRow).join('')
    : all.length ? `<p class="empty">沒有${pubSel === 'done' ? '已發布' : '待發布'}的${pubKind === 'shop' ? '賣場' : '商品'}。</p>`
    : pubKind === 'shop' ? '<p class="empty">賣場清單是空的。按「＋新增」選擇賣場，填入賣場名稱與分潤連結，AI 會幫你產生文案。</p>'
    : '<p class="empty">發布清單是空的。到「<a href="#list">商品</a>」勾選商品後按「加入發布清單」。</p>';
  updPubBtns();
}
let pubSel = 'all', pubShown = [], pubKind = store.get('pubKind', 'item') === 'shop' ? 'shop' : 'item';

/* ---------- 發布時間：手動排定 ----------
 * i.schedAt：使用者排定的發布時間（本地時間 YYYY-MM-DDTHH:MM）
 */
const PWD = ['日', '一', '二', '三', '四', '五', '六'];
const ld = (s) => { const [d, t = '00:00'] = String(s).split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, (m || 1) - 1, dd || 1, h || 0, mi || 0); };
const lISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const okSlot = (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || '')) && !Number.isNaN(+ld(s));
const fmtSlot = (s) => { const d = ld(s); return `${d.getMonth() + 1}/${d.getDate()}（${PWD[d.getDay()]}）${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const pubRedraw = () => { if (location.hash === '#pub' && !$('#dlg').open) { const y = window.scrollY; renderPub(); window.scrollTo(0, y); } };
// 卡片上的發布時間區塊
function pubTimeHtml(i) {
  if (i.status === 'done' || !okSlot(i.schedAt)) return '';
  return `<div class="ptime set"><b>📅 排定發布</b><span>${esc(fmtSlot(i.schedAt))}${ld(i.schedAt) < new Date() ? '<em class="od">（時間已過）</em>' : ''}</span></div>`;
}
// 排定時間視窗：選日期與時間（預設帶入已排定的時間，並顯示文案建議時段供參考）
function schedDlg(i) {
  const d = $('#dlg'), base = okSlot(i.schedAt) ? i.schedAt : lISO(new Date(Date.now() + 864e5)).slice(0, 11) + '20:00';
  const today = lISO(new Date()).slice(0, 10);
  d.innerHTML = `<div class="dlg-head"><h2>排定發布時間</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>
    <p class="hint">${esc(i.name)}</p>
    ${bestTimeOf(i) ? `<div class="besttime"><b>⏰ 文案建議時段</b><span>${esc(bestTimeOf(i))}</span></div>` : ''}
    <div class="row2"><label>日期<input id="schedD" type="date" min="${today}" value="${esc(base.slice(0, 10))}"></label><label>時間<input id="schedT" type="time" step="300" value="${esc(base.slice(11, 16))}"></label></div>
    <div class="btns"><button type="button" class="pri" data-act="schedSave" data-id="${esc(i.id)}">儲存</button>${i.schedAt ? `<button type="button" class="danger" data-act="schedClear" data-id="${esc(i.id)}">清除排定</button>` : ''}<button type="button" class="ghost" data-act="closeDlg">取消</button></div>`;
  if (!d.open) d.showModal();
}
// AI 文案裡的建議發文時段（舊資料沒有 aiData 時，從文字版「發文時段：」那行取出）
function bestTimeOf(i) {
  const b = aiTxt(i.aiData && i.aiData.json && i.aiData.json.bestTime);
  if (b) return b;
  const m = /發文時段：(.+)/.exec(i.aiText || '');
  return m ? aiTxt(m[1]) : '';
}
function pubRow(i) {
  if (isShop(i)) return shopRow(i);
  const id = esc(i.id), done = i.status === 'done';
  return `<article class="pc pub${done ? ' isdone' : ''}">
    <div class="pc-top"><span><label class="pick"><input type="checkbox" data-ppick="${id}"${pubPicked.has(i.id) ? ' checked' : ''} aria-label="選取 ${esc(i.name)}"></label>${done ? '<span class="tag pubtag">✓ 已發布</span> ' : ''}<span class="cat ${catClass(i.category)}">${esc(i.category || '未分類')}</span></span><span class="muted sm">${esc(i.shop || '')}</span></div>
    <h3>${esc(i.name)}</h3>
    <div class="pc-row"><span>${num(i.price) ? `<b class="price">$${fmt(num(i.price))}</b>` : ''}</span><span class="muted">${num(i.sales) ? `月銷 ${kfmt(num(i.sales))}` : ''}</span></div>
    ${i.manual ? '<div class="pc-row sm"><span class="tag">手動新增</span></div>' : `<div class="pc-row comm"><span>預估社群分潤 <b>$${fmt(commOf(i), 1)}</b></span><span class="muted sm">分潤率 ${fmt(num(i.base) + num(i.xtra), 1)}%＋${bonus()}%</span></div>
    <div class="pc-row sm"><span>評分 <b>${fmt(i.total, 1)}</b> <span class="grade g${i.grade}">${i.grade}</span></span><span>${safeUrl(i.url) ? `<a href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener noreferrer">來源</a>` : ''}</span></div>`}
    <div class="pc-row"><span class="sm ${done ? 'pubok' : 'muted'}">${done ? `✓ 已發布｜${fmtDT(i.publishedAt) || '時間未記錄'}` : `${STATUS[i.status]}｜加入於 ${fmtDT(i.queuedAt || i.createdAt)}`}</span></div>
    ${i.aiAt ? `<div class="sm aiat">📝 文案產生於 ${fmtDT(i.aiAt)}</div>` : ''}
    ${pubTimeHtml(i)}
    ${bestTimeOf(i) ? `<div class="besttime"><b>⏰ 文案建議時段</b><span>${esc(bestTimeOf(i))}</span></div>` : ''}
    ${bridgeHtml(i)}
    <div class="acts">
      ${done ? `<span class="btn btn-done" role="status">✓ 已發布</span><button type="button" class="danger" data-act="unpublish" data-id="${id}">取消已發布</button>` : `<button type="button" data-act="publish" data-id="${id}">標記已發布</button><button type="button" data-act="schedOpen" data-id="${id}">${okSlot(i.schedAt) ? '修改排定時間' : '排定時間'}</button>`}
      ${safeUrl(i.aff) ? `<button type="button" data-act="copyAff" data-id="${id}">複製推廣連結</button>` : ''}
      ${i.aiText ? `<button type="button" data-act="viewCopy" data-id="${id}">查看文案</button>` : ''}${i.aiFest ? `<button type="button" data-act="showFest" data-id="${id}">節慶資訊</button>` : ''}<button type="button" data-act="itemAI" data-id="${id}">${i.aiText ? '重新產文案' : '產生文案'}</button>
      ${done ? '' : `<button type="button" class="ghost" data-act="unqueue" data-id="${id}">移出清單</button>`}
    </div>
  </article>`;
}

// 賣場卡片：流程與商品卡片相同（產生文案、排定時間、標記已發布）；分潤連結只保存與複製，不送 AI
function shopRow(i) {
  const id = esc(i.id), done = i.status === 'done';
  return `<article class="pc pub shopc${done ? ' isdone' : ''}">
    <div class="pc-top"><span><label class="pick"><input type="checkbox" data-ppick="${id}"${pubPicked.has(i.id) ? ' checked' : ''} aria-label="選取 ${esc(i.name)}"></label>${done ? '<span class="tag pubtag">✓ 已發布</span> ' : ''}<span class="tag shoptag">🏪 賣場</span></span></div>
    <h3>${esc(i.name)}</h3>
    <div class="pc-row sm"><span class="muted shopurl" title="${esc(i.aff)}">${esc(i.aff)}</span></div>
    <div class="pc-row"><span class="sm ${done ? 'pubok' : 'muted'}">${done ? `✓ 已發布｜${fmtDT(i.publishedAt) || '時間未記錄'}` : `${STATUS[i.status]}｜加入於 ${fmtDT(i.queuedAt || i.createdAt)}`}</span></div>
    ${i.aiAt ? `<div class="sm aiat">📝 文案產生於 ${fmtDT(i.aiAt)}</div>` : ''}
    ${pubTimeHtml(i)}
    ${bestTimeOf(i) ? `<div class="besttime"><b>⏰ 文案建議時段</b><span>${esc(bestTimeOf(i))}</span></div>` : ''}
    ${bridgeHtml(i)}
    <div class="acts">
      ${done ? `<span class="btn btn-done" role="status">✓ 已發布</span><button type="button" class="danger" data-act="unpublish" data-id="${id}">取消已發布</button>` : `<button type="button" data-act="publish" data-id="${id}">標記已發布</button><button type="button" data-act="schedOpen" data-id="${id}">${okSlot(i.schedAt) ? '修改排定時間' : '排定時間'}</button>`}
      ${isHttpUrl(i.aff) ? `<button type="button" data-act="copyAff" data-id="${id}">複製分潤連結</button>` : ''}
      ${i.aiText ? `<button type="button" data-act="viewCopy" data-id="${id}">查看文案</button>` : ''}${i.aiFest ? `<button type="button" data-act="showFest" data-id="${id}">節慶資訊</button>` : ''}<button type="button" data-act="itemAI" data-id="${id}">${i.aiText ? '重新產文案' : '產生文案'}</button>
      ${done ? '' : `<button type="button" class="ghost" data-act="unqueue" data-id="${id}">移出清單</button>`}
    </div>
  </article>`;
}
// ＋新增（商品／賣場）：和卡片的「產生文案」視窗相同，多了名稱（給 AI 參考）與分潤連結（不會傳給 AI）
function shopDlg(kind) {
  const d = $('#dlg'), k = kind === 'item' ? 'item' : 'shop', isS = k === 'shop';
  d._addKind = k;
  d.innerHTML = `<div class="dlg-head"><h2>＋新增${isS ? '賣場' : '商品'}｜產生文案</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>
    <div class="tabs cat-tabs" role="tablist" aria-label="要新增的種類"><button type="button" role="tab" data-act="addKind" data-k="item" aria-selected="${!isS}">🛍️ 商品</button><button type="button" role="tab" data-act="addKind" data-k="shop" aria-selected="${isS}">🏪 賣場</button></div>
    <form id="shopForm" novalidate>
      <label>${isS ? '賣場' : '商品'}名稱（提供給 AI 參考）<input id="shopName" maxlength="200" autocomplete="off" placeholder="${isS ? '例如：花漾美肌旗艦店' : '例如：多功能玻璃噴油瓶 250ml'}" aria-describedby="shopNameErr"></label>
      <p id="shopNameErr" class="ferr" role="alert" hidden></p>
      ${isS ? '' : `<div class="add-g"><label>價格（選填，提供給 AI 參考）<input id="addPrice" type="number" inputmode="decimal" min="0" step="1" placeholder="例如：299"></label>
      <label>分類（選填，提供給 AI 參考）<input id="addCat" maxlength="40" list="addCatList" autocomplete="off" placeholder="例如：廚房用品"><datalist id="addCatList">${[...new Set(items.filter((x) => !isShop(x) && x.category).map((x) => x.category))].slice(0, 60).map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label></div>
      <p id="addPriceErr" class="ferr" role="alert" hidden></p>`}
      <label>分潤連結<input id="shopUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://" aria-describedby="shopUrlErr"></label>
      <p id="shopUrlErr" class="ferr" role="alert" hidden></p>
      ${festForm()}
      <div class="btns"><button type="submit" class="pri" id="shopGenBtn">開始產生文案</button><button type="button" class="ghost" data-act="closeDlg">取消</button></div>
    </form>
    <div id="dlgOut"></div>`;
  if (!d.open) d.showModal();
  setTimeout(() => $('#shopName')?.focus(), 30);
}
// 刪除賣場（同步時會自動記入刪除紀錄，另一台裝置同步後也會刪除）
function dropShops(ids) { items = items.filter((x) => !ids.has(x.id)); for (const id of ids) pubPicked.delete(id); }


/* ========== 橋接頁（Threads 等平台的預覽卡片；真人點進來立刻轉到蝦皮） ==========
 * i.bridge：{ code, at, title, head, sub, desc, style, photo, photoOnly, fit, slug }；網址為 /<slug> 或 /s/<code>，建立後永久有效（沒有停用）
 */
const SHOPEE_HOST = /(^|\.)shopee\.(tw|com|sg|ph|vn|com\.my|co\.th|co\.id|com\.br|com\.mx|com\.co|cl)$|^(shp\.ee|shope\.ee)$/i;
const okDest = (u) => { try { const x = new URL(String(u)); return (x.protocol === 'https:' || x.protocol === 'http:') && SHOPEE_HOST.test(x.hostname); } catch { return false; } };
// 自訂網址（中文標題）：只留中英文、數字與 -，空白轉 -，最多 30 字；不能跟 8 碼代碼同格式
const slugify = (s) => [...String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]+/gu, '').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '')].slice(0, 30).join('').replace(/-+$/, '');
const bridgeUrl = (i) => (!i?.bridge?.code ? '' : i.bridge.slug ? `${location.origin}/${i.bridge.slug}` : `${location.origin}/s/${i.bridge.code}`);
// 複製用：中文編碼成 %XX（Facebook 等平台碰到中文會把網址截斷，只剩首頁、沒有預覽圖）
// 後面加版本號（每次更新預覽圖都會變）：Facebook 會快取舊預覽約 30 天，換了網址就會重新抓
const bridgeShareUrl = (i) => (!i?.bridge?.code ? '' : (i.bridge.slug ? `${location.origin}/${encodeURIComponent(i.bridge.slug)}` : `${location.origin}/s/${i.bridge.code}`) + (i.bridge.at ? `?v=${Number(i.bridge.at).toString(36)}` : ''));
const brLive = (i) => !!i?.bridge?.code;
async function bridgeApi(body, btn) {
  const h = { 'Content-Type': 'application/json' }; if (S.accessCode) h['x-access-code'] = S.accessCode;
  const label = btn?.textContent; if (btn) { btn.disabled = true; btn.textContent = '處理中…'; }
  try {
    const r = await fetch('/api/bridge', { method: 'POST', headers: h, body: JSON.stringify(body) });
    let j; try { j = await r.json(); } catch { j = { ok: false, error: `伺服器回應格式錯誤（HTTP ${r.status}）` }; }
    if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  } catch (e) { if (e instanceof TypeError) e.message = '無法連線到伺服器（本機直接開檔沒有後端，請用 netlify dev 或部署後使用）'; throw e; }
  finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
}
// 卡片上的橋接頁區塊（只支援蝦皮連結）
function bridgeHtml(i) {
  if (!okDest(i.aff)) return '';
  const id = esc(i.id);
  if (!brLive(i)) return `<div class="bridge"><button type="button" data-act="brOpen" data-id="${id}">🔗 建立橋接頁</button></div>`;
  return `<div class="bridge on"><b>🔗 橋接頁</b><span class="brurl">${esc(bridgeUrl(i).replace(/^https?:\/\//, ''))}</span>
    <div class="acts"><button type="button" data-act="brCopy" data-id="${id}">複製橋接網址</button><button type="button" data-act="brOpen" data-id="${id}">編輯預覽圖</button></div></div>`;
}
// 從 AI 文案取出可用的大字（吸睛第一句）與短貼文
const noTags = (s) => String(s || '').replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim();
function brSrc(i) {
  const o = i.aiData?.json || {}, arr = (a) => (Array.isArray(a) ? a : []).map(aiTxt).map((x) => x.trim()).filter(Boolean);
  // 可選的文案：吸睛第一句、節慶活動文案、短貼文（大字取各貼文的第一行）
  const fp = o.festivalPost && typeof o.festivalPost === 'object' && typeof o.festivalPost.post === 'string' ? o.festivalPost.post.trim() : '';
  const fg = `🎉 節慶活動文案${o.festivalPost?.festival ? `・${aiTxt(o.festivalPost.festival)}` : ''}`;
  const first = (t) => (lineify(t).split('\n').map((x) => noTags(x).trim()).find(Boolean) || '').replace(/[。，,、]+$/, '');
  const posts = arr(o.posts);
  const H = [...arr(o.headlines || o.hooks).map((t) => ['💡 吸睛第一句', noTags(t)]), ...(fp ? [[fg, first(fp)]] : []), ...posts.map((t) => ['📝 短貼文', first(t)])];
  const seen = new Set(), Hd = H.filter(([, t]) => t && !seen.has(t) && seen.add(t));
  const Pp = [...(fp ? [[fg, fp]] : []), ...posts.map((t) => ['📝 短貼文', t])];
  return { heads: Hd.map((x) => x[1]), hg: Hd.map((x) => x[0]), posts: Pp.map((x) => x[1]), pg: Pp.map((x) => x[0]) };
}
// 下拉選單依來源分組
function brOpts(arr, groups, f) {
  let html = '', cur = null;
  arr.forEach((t, k) => {
    if (groups[k] !== cur) { if (cur !== null) html += '</optgroup>'; cur = groups[k]; html += `<optgroup label="${esc(cur)}">`; }
    html += `<option value="${k}">${esc([...f(t)].slice(0, 34).join(''))}</option>`;
  });
  return html + (cur !== null ? '</optgroup>' : '');
}
// 短文案精華：去掉 hashtag，取前面幾句，約 40 字
// 每句話一行：在！？。後斷行（句尾表情跟著前一句），中文後面的空白也視為斷句；行尾不留「。」「，」
function brLines(s) {
  let t = String(s || '').replace(/\r/g, '');
  t = t.replace(new RegExp(`([。！？!?]+(?:${EMO})*)[ \t\u3000]*`, 'gu'), '$1\n');
  t = t.replace(/([^\x00-\x7F])[ \t\u3000]+(?=[^\x00-\x7F\s])/g, '$1\n');
  const out = [];
  for (let l of t.split('\n')) {
    l = l.trim().replace(new RegExp(`[。，,、]+((?:\s*${EMO})*)$`, 'u'), '$1').trim(); if (!l) continue;
    if (out.length && new RegExp(`^(?:${EMO}|\s)+$`, 'u').test(l)) out[out.length - 1] += l; else out.push(l);
  }
  return out.join('\n');
}
// 小字精華：去掉 hashtag，取前面幾句（約 45 字），每句一行
function brShort(s) {
  const L = brLines(noTags(String(s || '').replace(/\n+/g, ' \n'))).split('\n').filter(Boolean), out = []; let n = 0;
  for (const l of L) { const k = [...l].length; if (out.length && n + k > 45) break; out.push(l); n += k; }
  return out.join('\n');
}
// 預覽圖模板（1200×630）
// 圖片以「裁切填滿」方式畫進指定區域
function brCover(x, img, dx, dy, dw, dh) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return;
  const s = Math.max(dw / iw, dh / ih), sw = dw / s, sh = dh / s;
  x.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, dw, dh);
}
const brEdgeC = new WeakMap();
function brEdgeColor(img) {
  if (brEdgeC.has(img)) return brEdgeC.get(img);
  let col = '#f3f4f6';
  try {
    const N = 24, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, N, N);
    const d = x.getImageData(0, 0, N, N).data; let r = 0, g = 0, b = 0, n = 0;
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) if (xx < 2 || yy < 2 || xx >= N - 2 || yy >= N - 2) { const k = (yy * N + xx) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
    col = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  } catch {}
  brEdgeC.set(img, col); return col;
}
function brContain(x, img, dx, dy, dw, dh) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return;
  // 空白處用圖片邊緣的平均色補滿（純色，只看得到一張圖）
  x.save(); x.beginPath(); x.rect(dx, dy, dw, dh); x.clip();
  x.fillStyle = brEdgeColor(img); x.fillRect(dx, dy, dw, dh);
  const s = Math.min(dw / iw, dh / ih), w = iw * s, h = ih * s;
  x.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
  x.restore();
}
// ---- 預覽圖模板（10 種）：圖片放在獨立區塊、不加暗色遮罩，文字放在純色區，兩者都清楚 ----
const BR_STYLES = [
  ['classic', '經典暖色'], ['fresh', '清爽藍白'], ['magazine', '雜誌深色'], ['polaroid', '拍立得'], ['caption', '下方字幕'],
  ['circle', '圓形主圖'], ['pop', '撞色普普'], ['minimal', '極簡黑白'], ['float', '浮起卡片'], ['festive', '節慶紅金'],
  ['headline', '橫式・上字下圖'], ['cinema', '橫式・電影寬螢幕'], ['newspaper', '橫式・報紙頭條'], ['banner', '橫式・漸層橫幅'], ['ticket', '橫式・票券'],
];
const BR_F = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
function brRR(x, a, b, w, h, r) { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function brWrap(x, t, font, maxW, maxLines) {
  x.font = font; const out = []; let cur = '';
  // 標點不放行首（，。！？等）：換行時把前一個字一起帶到下一行
  const noStart = /[，。、！？：；,.!?:;」』）)〉》…～~％%]/;
  for (const ch of [...String(t || '')]) {
    if (ch === '\n') { out.push(cur); cur = ''; continue; }
    if (x.measureText(cur + ch).width > maxW && cur) {
      const cs = [...cur];
      if (noStart.test(ch) && cs.length > 1) { const last = cs.pop(); out.push(cs.join('')); cur = last + ch; } else { out.push(cur); cur = ch; }
    } else cur += ch;
  }
  if (cur) out.push(cur);
  // 避免最後一行只剩 1 個字：從上一行挪 1 個字下來
  const n = out.length; if (n >= 2 && n <= maxLines && [...out[n - 1]].length === 1) { const pv = [...out[n - 2]]; out[n - 1] = pv.pop() + out[n - 1]; out[n - 2] = pv.join(''); }
  if (out.length > maxLines) { out.length = maxLines; let l = out[maxLines - 1]; while (l && x.measureText(l + '…').width > maxW) l = [...l].slice(0, -1).join(''); out[maxLines - 1] = l + '…'; }
  return out;
}
// 把圖片放進區域：自動縮放／填滿為基準，再套用使用者的縮放與位置；去背後的空白用模板底色
function brPlace(x, o, r, ph) {
  const img = o.img, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return;
  const a = o.adj || {}, z = a.z || 1, px = a.px || 0, py = a.py || 0;
  if (a.cut) { const g = x.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); g.addColorStop(0, ph[0]); g.addColorStop(1, ph[1]); x.fillStyle = g; }
  else x.fillStyle = brEdgeColor(img);
  x.fillRect(r.x, r.y, r.w, r.h);
  const s0 = o.fit === 'cover' ? Math.max(r.w / iw, r.h / ih) : Math.min(r.w / iw, r.h / ih), w = iw * s0 * z, h = ih * s0 * z;
  const mx = Math.max(Math.abs(r.w - w) / 2, r.w * 0.25), my = Math.max(Math.abs(r.h - h) / 2, r.h * 0.25);
  x.drawImage(img, r.x + (r.w - w) / 2 + px * mx, r.y + (r.h - h) / 2 + py * my, w, h);
}
// 圖片區：有圖就放進去；沒圖就畫柔和底色＋大圖示當佔位
function brPic(x, o, r, rad, ph) {
  x.save(); brRR(x, r.x, r.y, r.w, r.h, rad); x.clip();
  if (o.img) brPlace(x, o, r, ph);
  else {
    const g = x.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); g.addColorStop(0, ph[0]); g.addColorStop(1, ph[1]); x.fillStyle = g; x.fillRect(r.x, r.y, r.w, r.h);
    x.font = `${Math.round(Math.min(r.w, r.h) * 0.36)}px ${BR_F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.kind === 'shop' ? '🏪' : '🛍️', r.x + r.w / 2, r.y + r.h / 2);
  }
  x.restore();
}
// 文字區：大字＋小字垂直置中，放不下時自動縮小字級；名稱固定在區塊底部
function brTxt(x, o, B, st) {
  st = o.hideName ? { ...st, noName: true } : st;
  const al = st.align || 'left', tx = al === 'center' ? B.x + B.w / 2 : B.x, barH = st.bar && o.head ? 34 : 0;
  // 名稱：完整顯示，太長就縮字、換行
  let nf = 28, nl = [];
  if (!st.noName) for (;; nf -= 2) { nl = brWrap(x, `${o.kind === 'shop' ? '🏪' : '🛍️'} ${o.name || ''}`, `700 ${nf}px ${BR_F}`, B.w, 99); if (nl.length <= (B.h < 200 ? 1 : 2) || nf <= 16) break; }
  const nameH = st.noName ? 0 : nl.length * nf * 1.3 + 12;
  // 大字、小字：全部放進去，放不下就等比例縮小（不截斷）
  const h0 = st.hs || 68, r = (st.ss || 36) / h0;
  let hs = h0, ss, hl, sl, tot;
  for (;;) {
    ss = Math.max(14, Math.round(hs * r));
    hl = brWrap(x, o.head, `900 ${hs}px ${BR_F}`, B.w, 99); sl = brWrap(x, brLines(o.sub), `500 ${ss}px ${BR_F}`, B.w, 99);
    tot = barH + hl.length * hs * 1.22 + (hl.length && sl.length ? 18 : 0) + sl.length * ss * 1.45;
    if (tot <= B.h - nameH || hs <= 16) break;
    hs -= 2;
  }
  let y = B.y + Math.max(0, (B.h - nameH - tot) / 2);
  x.textAlign = al; x.textBaseline = 'top';
  if (barH) { x.fillStyle = st.acc; x.fillRect(al === 'center' ? tx - 36 : tx, y, 72, 10); y += barH; }
  if (st.shadow) { x.shadowColor = st.shadow; x.shadowBlur = 10; }
  x.font = `900 ${hs}px ${BR_F}`; x.fillStyle = st.fg; hl.forEach((l, k) => x.fillText(l, tx, y + k * hs * 1.22)); y += hl.length * hs * 1.22 + (hl.length && sl.length ? 18 : 0);
  x.font = `500 ${ss}px ${BR_F}`; x.fillStyle = st.mut; sl.forEach((l, k) => x.fillText(l, tx, y + k * ss * 1.45));
  x.shadowColor = 'transparent'; x.shadowBlur = 0;
  if (!st.noName) {
    x.font = `700 ${nf}px ${BR_F}`; x.fillStyle = st.nameC || st.mut; x.textBaseline = 'bottom';
    nl.forEach((l, k) => x.fillText(l, tx, B.y + B.h - (nl.length - 1 - k) * nf * 1.3));
  }
}
const brDots = (x, col, step = 34, r = 3) => { x.fillStyle = col; for (let a = step / 2; a < 1200; a += step) for (let b = step / 2; b < 630; b += step) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); } };
const brShadow = (x, c, blur, dx = 0, dy = 10) => { x.shadowColor = c; x.shadowBlur = blur; x.shadowOffsetX = dx; x.shadowOffsetY = dy; };
const brNoShadow = (x) => { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetX = 0; x.shadowOffsetY = 0; };
function drawBridge(c, o) {
  const x = c.getContext('2d'), W = 1200, H = 630;
  x.save(); x.textAlign = 'left'; x.textBaseline = 'top'; brNoShadow(x);
  // 只用圖片：整張就是使用者的圖
  if (o.img && o.photoOnly) { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); brPlace(x, o, { x: 0, y: 0, w: W, h: H }, ['#ffffff', '#f1f5f9']); x.restore(); return; }
  const lin = (a, b, x0 = 0, y0 = 0, x1 = W, y1 = H) => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  switch (o.style) {
    case 'fresh': {
      x.fillStyle = lin('#f5f9ff', '#dcebff'); x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(37,99,235,0.08)'; x.beginPath(); x.arc(1120, 80, 220, 0, 7); x.fill();
      const r = { x: 40, y: 40, w: 560, h: 550 };
      brShadow(x, 'rgba(15,39,71,0.18)', 30); x.fillStyle = '#fff'; brRR(x, r.x - 8, r.y - 8, r.w + 16, r.h + 16, 30); x.fill(); brNoShadow(x);
      brPic(x, o, r, 24, ['#bfdbfe', '#93c5fd']);
      brTxt(x, o, { x: 660, y: 60, w: 490, h: 510 }, { fg: '#0f2747', mut: '#3d5a80', acc: '#2563eb', bar: true });
      break;
    }
    case 'magazine': {
      x.fillStyle = '#171311'; x.fillRect(0, 0, W, H);
      brPic(x, o, { x: 0, y: 0, w: 690, h: H }, 0, ['#3b2f2a', '#5a463c']);
      x.fillStyle = '#ff8a5c'; x.fillRect(690, 0, 8, H);
      brTxt(x, o, { x: 745, y: 60, w: 405, h: 510 }, { fg: '#fff7f0', mut: '#e9d6ca', acc: '#ff8a5c', bar: true, hs: 60, ss: 32 });
      break;
    }
    case 'polaroid': {
      x.fillStyle = '#f4ede4'; x.fillRect(0, 0, W, H); brDots(x, 'rgba(120,90,60,0.10)');
      x.save(); x.translate(880, 310); x.rotate(-0.06);
      brShadow(x, 'rgba(60,40,20,0.28)', 28, 6, 14); x.fillStyle = '#fff'; x.fillRect(-230, -265, 460, 530); brNoShadow(x);
      brPic(x, o, { x: -205, y: -240, w: 410, h: 410 }, 2, ['#fde2c8', '#f6b98a']);
      x.restore();
      brTxt(x, o, { x: 70, y: 60, w: 520, h: 510 }, { fg: '#3b2a20', mut: '#6b5444', acc: '#d9480f', bar: true });
      break;
    }
    case 'caption': {
      x.fillStyle = '#111'; x.fillRect(0, 0, W, H);
      brPic(x, o, { x: 0, y: 0, w: W, h: 400 }, 0, ['#374151', '#6b7280']);
      x.fillStyle = '#ffcc00'; x.fillRect(0, 400, W, 8);
      brTxt(x, o, { x: 60, y: 428, w: 1080, h: 182 }, { fg: '#fff', mut: '#e5e7eb', acc: '#ffcc00', hs: 50, ss: 30, nameC: '#ffcc00' });
      break;
    }
    case 'circle': {
      x.fillStyle = lin('#fff1f7', '#fce7f3'); x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(219,39,119,0.14)'; [[640, 90, 16], [1150, 560, 26], [700, 560, 10], [1160, 70, 12]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
      brShadow(x, 'rgba(120,20,70,0.22)', 30); x.fillStyle = '#fff'; x.beginPath(); x.arc(900, 315, 270, 0, 7); x.fill(); brNoShadow(x);
      x.save(); x.beginPath(); x.arc(900, 315, 255, 0, 7); x.clip(); brPic(x, o, { x: 645, y: 60, w: 510, h: 510 }, 0, ['#fbcfe8', '#f9a8d4']); x.restore();
      brTxt(x, o, { x: 70, y: 60, w: 520, h: 510 }, { fg: '#4a1d3a', mut: '#7a4a68', acc: '#db2777', bar: true });
      break;
    }
    case 'pop': {
      x.fillStyle = '#ffd400'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#111'; brRR(x, 656, 66, 500, 500, 24); x.fill();
      x.fillStyle = '#111'; brRR(x, 630, 40, 510, 510, 26); x.fill();
      brPic(x, o, { x: 640, y: 50, w: 490, h: 490 }, 18, ['#fff3a3', '#ffe14d']);
      brTxt(x, o, { x: 60, y: 60, w: 530, h: 510 }, { fg: '#111', mut: '#2b2b2b', acc: '#111', bar: true, hs: 76, nameC: '#111' });
      break;
    }
    case 'minimal': {
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      brPic(x, o, { x: 640, y: 0, w: 560, h: H }, 0, ['#f3f4f6', '#e5e7eb']);
      x.fillStyle = '#111'; x.fillRect(640, 0, 2, H);
      brTxt(x, o, { x: 70, y: 80, w: 510, h: 480 }, { fg: '#111', mut: '#555', acc: '#e11d48', bar: true });
      break;
    }
    case 'float': {
      x.fillStyle = lin('#e0e7ff', '#fae8ff'); x.fillRect(0, 0, W, H);
      const r = { x: 650, y: 60, w: 500, h: 510 };
      brShadow(x, 'rgba(76,29,149,0.30)', 50, 0, 24); x.fillStyle = '#fff'; brRR(x, r.x, r.y, r.w, r.h, 32); x.fill(); brNoShadow(x);
      brPic(x, o, r, 32, ['#ddd6fe', '#c4b5fd']);
      x.fillStyle = 'rgba(255,255,255,0.82)'; brRR(x, 40, 70, 570, 490, 28); x.fill();
      brTxt(x, o, { x: 80, y: 100, w: 490, h: 430 }, { fg: '#1e1b4b', mut: '#4c4a7a', acc: '#7c3aed', bar: true, hs: 62 });
      break;
    }
    case 'festive': {
      const g = x.createRadialGradient(400, 315, 60, 600, 315, 800); g.addColorStop(0, '#9f1239'); g.addColorStop(1, '#4c0519'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#f5c451'; x.lineWidth = 3; x.strokeRect(20, 20, W - 40, H - 40); x.lineWidth = 1; x.strokeRect(30, 30, W - 60, H - 60);
      const r = { x: 650, y: 70, w: 490, h: 490 };
      x.fillStyle = '#f5c451'; brRR(x, r.x - 8, r.y - 8, r.w + 16, r.h + 16, 26); x.fill();
      brPic(x, o, r, 20, ['#be123c', '#881337']);
      brTxt(x, o, { x: 80, y: 80, w: 520, h: 470 }, { fg: '#fff4d6', mut: '#fcd9a8', acc: '#f5c451', bar: true, nameC: '#f5c451' });
      break;
    }
    case 'headline': { // 上字下圖
      x.fillStyle = lin('#ffffff', '#fff1e6', 0, 0, 0, H); x.fillRect(0, 0, W, H);
      brTxt(x, o, { x: 60, y: 26, w: 1080, h: 222 }, { fg: '#1f1a17', mut: '#5c4a40', acc: '#ea580c', bar: true, align: 'center', hs: 58, ss: 30 });
      const r = { x: 40, y: 264, w: 1120, h: 340 };
      brShadow(x, 'rgba(90,40,20,0.18)', 24); x.fillStyle = '#fff'; brRR(x, r.x, r.y, r.w, r.h, 22); x.fill(); brNoShadow(x);
      brPic(x, o, r, 22, ['#ffe4cc', '#ffc59e']);
      break;
    }
    case 'cinema': { // 電影寬螢幕：上下黑邊放字，中間寬幅圖
      x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, W, H);
      brPic(x, o, { x: 0, y: 150, w: W, h: 330 }, 0, ['#1f2937', '#374151']);
      x.fillStyle = '#e8b04a'; x.fillRect(0, 146, W, 4); x.fillRect(0, 480, W, 4);
      brTxt(x, { ...o, sub: '' }, { x: 60, y: 18, w: 1080, h: 116 }, { fg: '#fff', mut: '#d1d5db', acc: '#e8b04a', align: 'center', hs: 56, noName: true });
      brTxt(x, { ...o, head: '' }, { x: 60, y: 496, w: 1080, h: 120 }, { fg: '#fff', mut: '#e5e7eb', acc: '#e8b04a', align: 'center', hs: 50, ss: 30, nameC: '#e8b04a' });
      break;
    }
    case 'newspaper': { // 報紙頭條：大標、寬幅照片、圖說
      x.fillStyle = '#f5f0e6'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#1c1917'; x.fillRect(50, 20, 1100, 4); x.fillRect(50, 28, 1100, 1);
      brTxt(x, { ...o, sub: '' }, { x: 50, y: 34, w: 1100, h: 140 }, { fg: '#1c1917', mut: '#44403c', acc: '#1c1917', align: 'center', hs: 64, noName: true });
      x.fillStyle = '#1c1917'; x.fillRect(48, 184, 1104, 304);
      brPic(x, o, { x: 50, y: 186, w: 1100, h: 300 }, 0, ['#e7e5e4', '#d6d3d1']);
      brTxt(x, { ...o, head: '' }, { x: 50, y: 500, w: 1100, h: 112 }, { fg: '#1c1917', mut: '#44403c', acc: '#1c1917', align: 'center', hs: 50, ss: 30, nameC: '#78716c' });
      x.fillStyle = '#1c1917'; x.fillRect(50, 616, 1100, 2);
      break;
    }
    case 'banner': { // 漸層橫幅：上大字、中寬圖、下小字
      x.fillStyle = lin('#0ea5e9', '#6366f1'); x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,0.10)'; x.beginPath(); x.arc(80, 60, 160, 0, 7); x.fill(); x.beginPath(); x.arc(1140, 600, 200, 0, 7); x.fill();
      brTxt(x, { ...o, sub: '' }, { x: 60, y: 22, w: 1080, h: 148 }, { fg: '#fff', mut: '#e0f2fe', acc: '#fff', align: 'center', hs: 60, noName: true, shadow: 'rgba(0,0,0,0.25)' });
      const r = { x: 60, y: 180, w: 1080, h: 310 };
      x.fillStyle = '#fff'; brRR(x, r.x - 8, r.y - 8, r.w + 16, r.h + 16, 26); x.fill();
      brPic(x, o, r, 20, ['#bae6fd', '#c7d2fe']);
      brTxt(x, { ...o, head: '' }, { x: 60, y: 508, w: 1080, h: 108 }, { fg: '#fff', mut: '#f0f9ff', acc: '#fff', align: 'center', hs: 50, ss: 30, nameC: '#fff' });
      break;
    }
    case 'ticket': { // 票券：左寬圖、虛線撕口、右側票根放字
      x.fillStyle = '#1f2937'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fdf6e3'; brRR(x, 36, 36, 1128, 558, 24); x.fill();
      x.fillStyle = '#1f2937'; x.beginPath(); x.arc(770, 36, 22, 0, 7); x.fill(); x.beginPath(); x.arc(770, 594, 22, 0, 7); x.fill();
      x.strokeStyle = '#b8a98a'; x.lineWidth = 3; x.setLineDash([10, 10]); x.beginPath(); x.moveTo(770, 70); x.lineTo(770, 560); x.stroke(); x.setLineDash([]);
      brPic(x, o, { x: 60, y: 60, w: 680, h: 510 }, 16, ['#fde68a', '#fcd34d']);
      brTxt(x, o, { x: 800, y: 76, w: 335, h: 478 }, { fg: '#1f2937', mut: '#4b5563', acc: '#dc2626', bar: true, hs: 48, ss: 28, nameC: '#6b7280' });
      break;
    }
    default: { // classic 經典暖色
      x.fillStyle = lin('#fff6ef', '#ffd6c2'); x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(198,41,56,0.08)'; x.beginPath(); x.arc(120, 600, 180, 0, 7); x.fill();
      x.fillStyle = '#c62938'; x.fillRect(0, 0, 14, H);
      const r = { x: 620, y: 40, w: 540, h: 550 };
      brShadow(x, 'rgba(90,40,20,0.20)', 30); x.fillStyle = '#fff'; brRR(x, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 30); x.fill(); brNoShadow(x);
      brPic(x, o, r, 22, ['#ffd9c4', '#ffb899']);
      brTxt(x, o, { x: 70, y: 60, w: 500, h: 510 }, { fg: '#1f1a17', mut: '#5c4a40', acc: '#c62938', bar: true });
    }
  }
  x.restore();
}
// 模板縮圖：用同一支畫圖程式縮小 5 倍畫
function brThumbs(o) {
  $$('#brStyles canvas').forEach((cv) => { const x = cv.getContext('2d'); x.setTransform(0.2, 0, 0, 0.2, 0, 0); drawBridge(cv, { ...o, style: cv.dataset.s, photoOnly: false }); x.setTransform(1, 0, 0, 1, 0, 0); });
}
function brDlg(i) {
  const src = brSrc(i), b = i.bridge || {}, d = $('#dlg');
  const sty = b.style || (b.tpl === 'dark' ? 'magazine' : 'classic'), ba = b.adj || {};
  const head = b.head ?? (src.heads[0] || ''), sub = b.sub ?? brShort(src.posts[0] || ''), desc = b.desc ?? noTags(src.posts[0] || '').replace(/\s+/g, ' ').slice(0, 300);
  d.innerHTML = `<div class="dlg-head"><h2>🔗 橋接頁｜${esc(i.name)}</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>
    <canvas id="brCv" width="1200" height="630" hidden></canvas>
    <div class="tabs cat-tabs" role="tablist" aria-label="預覽樣式"><button type="button" role="tab" data-act="brMock" data-m="threads" aria-selected="true">Threads 預覽</button><button type="button" role="tab" data-act="brMock" data-m="fb" aria-selected="false">Facebook 預覽</button></div>
    <div id="brMock" class="mock threads"></div>
    <div class="br-photo"><label class="btn br-up">🖼️ <span id="brUpTxt">${b.photo ? '更換圖片' : '加入自己的圖片'}</span><input type="file" id="brPhoto" accept="image/*"></label><button type="button" class="ghost" data-act="brPhotoDel" id="brPhotoDel"${b.photo ? '' : ' hidden'}>移除圖片</button><span class="muted sm">選填，建議用商品照或影片截圖</span></div>
    <div class="checks" id="brFitRow"${b.photo ? '' : ' hidden'}><label><input type="radio" name="brFit" value="contain"${b.fit !== 'cover' ? ' checked' : ''}>自動縮放（完整顯示）</label><label><input type="radio" name="brFit" value="cover"${b.fit === 'cover' ? ' checked' : ''}>填滿（裁切邊緣）</label><label><input type="checkbox" id="brPhotoOnly"${b.photoOnly ?? b.lay === 'photo' ? ' checked' : ''}>只用圖片（不加字）</label></div>
    <details class="br-adj" id="brAdj"${b.photo ? '' : ' hidden'} open><summary>🛠️ 調整圖片（縮放、位置、裁切、去背）</summary>
      <div class="br-adj-g">
        <label>縮放 <output id="brZo"></output><input type="range" id="brZ" min="50" max="300" step="5" value="${Math.round((ba.z || 1) * 100)}"></label>
        <label>左右位置 <output id="brPxo"></output><input type="range" id="brPx" min="-100" max="100" step="2" value="${Math.round((ba.px || 0) * 100)}"></label>
        <label>上下位置 <output id="brPyo"></output><input type="range" id="brPy" min="-100" max="100" step="2" value="${Math.round((ba.py || 0) * 100)}"></label>
      </div>
      <p class="muted sm">裁切（從各邊切掉的比例）</p>
      <div class="br-adj-g">
        <label>上 <output id="brCto"></output><input type="range" id="brCt" min="0" max="45" step="1" value="${ba.ct || 0}"></label>
        <label>下 <output id="brCbo"></output><input type="range" id="brCb" min="0" max="45" step="1" value="${ba.cb || 0}"></label>
        <label>左 <output id="brClo"></output><input type="range" id="brCl" min="0" max="45" step="1" value="${ba.cl || 0}"></label>
        <label>右 <output id="brCro"></output><input type="range" id="brCr" min="0" max="45" step="1" value="${ba.cr || 0}"></label>
      </div>
      <div class="br-adj-g">
        <label class="chk"><input type="checkbox" id="brCut"${ba.cut ? ' checked' : ''}> 去除背景</label>
        <label>去背強度 <output id="brTolo"></output><input type="range" id="brTol" min="10" max="120" step="2" value="${ba.tol || 40}"></label>
      </div>
      <p class="muted sm">去背是依背景顏色自動去除，適合白底、單色或簡單背景的商品照；背景複雜時效果有限，可調整強度。</p>
      <button type="button" class="ghost" data-act="brAdjReset">全部重設</button>
    </details>
    <fieldset class="br-styles" id="brStyles"><legend>模板風格</legend>${BR_STYLES.map(([k, n]) => `<label class="br-sty"><input type="radio" name="brSty" value="${k}"${k === sty ? ' checked' : ''}><canvas width="240" height="126" data-s="${k}" aria-hidden="true"></canvas><span>${n}</span></label>`).join('')}</fieldset>
    <label class="chk"><input type="checkbox" id="brShowName"${b.showName ? ' checked' : ''}> 在預覽圖上顯示${i.kind === 'shop' ? '賣場' : '商品'}名稱</label>
    <label>預覽卡片標題<input id="brTitle" maxlength="80" value="${esc(b.title ?? i.name)}"></label>
    <p class="muted sm" id="brSlugHint">橋接網址：${esc(location.host)}/${esc(slugify(head) || '（填入圖上大字後產生）')}</p>
    <label>圖上大字（約 16 字）${src.heads.length ? `<select id="brHeadSel"><option value="">從 AI 文案帶入（吸睛句／節慶／短貼文）…</option>${brOpts(src.heads, src.hg, (t) => t)}</select>` : ''}<input id="brHead" maxlength="40" value="${esc(head)}" placeholder="例如：保養品補貨就趁現在"></label>
    <label>圖上小字（約 40 字）${src.posts.length ? `<select id="brSubSel"><option value="">從 AI 文案帶入（節慶活動文案／短貼文）…</option>${brOpts(src.posts, src.pg, (t) => noTags(t).replace(/\s+/g, ' '))}</select>` : ''}<textarea id="brSub" rows="3" maxlength="120">${esc(sub)}</textarea></label>
    <label>卡片說明文字（顯示在預覽圖下方）<textarea id="brDesc" rows="3" maxlength="300">${esc(desc)}</textarea></label>
    ${src.heads.length || src.posts.length ? '' : '<p class="hint">這件還沒有 AI 文案，可以先手動填寫，或先按「產生文案」再回來帶入。</p>'}
    <p class="hint">真人點進橋接網址會立刻轉到${i.kind === 'shop' ? '賣場' : '商品頁'}。預覽圖與標題請如實反映要去的${i.kind === 'shop' ? '賣場' : '商品'}。</p>
    <p id="brErr" class="ferr" role="alert" hidden></p>
    <div class="btns"><button type="button" class="pri" data-act="brSave" data-id="${esc(i.id)}">${brLive(i) ? '更新橋接頁' : '發布橋接頁'}</button><button type="button" class="ghost" data-act="closeDlg">取消</button></div>`;
  if (!d.open) d.showModal();
  let thT;
  const redraw = () => {
    const only = !!d._brImg && $('#brPhotoOnly').checked;
    $('#brPhotoDel').hidden = !d._brImg; $('#brFitRow').hidden = !d._brImg; $('#brAdj').hidden = !d._brImg; brAdjOut(); $('#brStyles').hidden = only; $('#brUpTxt').textContent = d._brImg ? '更換圖片' : '加入自己的圖片';
    const o = { style: $('input[name="brSty"]:checked')?.value || 'classic', head: $('#brHead').value.trim(), sub: $('#brSub').value.trim(), name: i.name, kind: i.kind, img: d._brImg, fit: $('input[name="brFit"]:checked')?.value, photoOnly: only, hideName: !$('#brShowName').checked, adj: brAdjRead() };
    drawBridge($('#brCv'), o); brMockDraw(i);
    clearTimeout(thT); thT = setTimeout(() => brThumbs(o), 120);
  };
  d._brRedraw = redraw; d._brSrc = src; d._brMock = 'threads'; d._brImg = null; d._brOrig = null; d._brPhoto = undefined; redraw();
  // 再次編輯：載入之前上傳的原圖
  if (b.photo && b.code) { const im = new Image(); im.onload = () => { if (d.open && $('#brCv')) { d._brOrig = im; brProcess(); redraw(); } }; im.src = `/s/${b.code}/src.jpg?v=${b.at || ''}`; }
}
function brAdjOut() {
  const set = (id, t) => { const o = $(`#${id}o`); if (o) o.textContent = t; }, v = (id) => +($(`#${id}`)?.value || 0);
  set('brZ', `${v('brZ')}%`); set('brPx', v('brPx')); set('brPy', v('brPy'));
  ['brCt', 'brCb', 'brCl', 'brCr'].forEach((k) => set(k, `${v(k)}%`)); set('brTol', v('brTol'));
}
function brAdjSet(a) {
  const put = (id, val) => { const el = $(`#${id}`); if (el) el.value = val; };
  put('brZ', Math.round((a.z || 1) * 100)); put('brPx', Math.round((a.px || 0) * 100)); put('brPy', Math.round((a.py || 0) * 100));
  put('brCt', a.ct || 0); put('brCb', a.cb || 0); put('brCl', a.cl || 0); put('brCr', a.cr || 0); put('brTol', a.tol || 40);
  const c = $('#brCut'); if (c) c.checked = !!a.cut;
}
// 讀取圖片調整控制項
function brAdjRead() {
  const v = (id, def = 0) => { const el = $(`#${id}`); return el ? +el.value : def; };
  return { z: v('brZ', 100) / 100, px: v('brPx') / 100, py: v('brPy') / 100, ct: v('brCt'), cb: v('brCb'), cl: v('brCl'), cr: v('brCr'), cut: !!$('#brCut')?.checked, tol: v('brTol', 40) };
}
// 去背：從圖片四邊往內找「接近背景色」的區域變透明（適合單色或簡單背景）
function brCutBg(cv, tol) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, im = x.getImageData(0, 0, W, H), d = im.data;
  let r = 0, g = 0, b = 0, n = 0;
  const edge = (i) => { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; };
  for (let xx = 0; xx < W; xx++) { edge(xx * 4); edge(((H - 1) * W + xx) * 4); }
  for (let yy = 0; yy < H; yy++) { edge(yy * W * 4); edge((yy * W + W - 1) * 4); }
  r /= n; g /= n; b /= n;
  const dist = (i, R, G, B) => Math.hypot(d[i] - R, d[i + 1] - G, d[i + 2] - B);
  const seen = new Uint8Array(W * H), st = new Int32Array(W * H), from = new Int32Array(W * H); let sp = 0;
  const push = (k, f) => { if (seen[k]) return; const i = k * 4; const fi = f * 4;
    if (dist(i, r, g, b) < tol || (dist(i, d[fi], d[fi + 1], d[fi + 2]) < tol * 0.25 && dist(i, r, g, b) < tol * 2.5)) { seen[k] = 1; from[k] = f; st[sp++] = k; } };
  for (let xx = 0; xx < W; xx++) { push(xx, xx); push((H - 1) * W + xx, (H - 1) * W + xx); }
  for (let yy = 0; yy < H; yy++) { push(yy * W, yy * W); push(yy * W + W - 1, yy * W + W - 1); }
  while (sp) { const k = st[--sp], xx = k % W, yy = (k - xx) / W;
    if (xx > 0) push(k - 1, k); if (xx < W - 1) push(k + 1, k); if (yy > 0) push(k - W, k); if (yy < H - 1) push(k + W, k); }
  for (let k = 0; k < W * H; k++) {
    if (seen[k]) { d[k * 4 + 3] = 0; continue; }
    const xx = k % W, yy = (k - xx) / W;   // 邊緣柔化：緊鄰背景的像素半透明
    if ((xx > 0 && seen[k - 1]) || (xx < W - 1 && seen[k + 1]) || (yy > 0 && seen[k - W]) || (yy < H - 1 && seen[k + W])) d[k * 4 + 3] = 170;
  }
  x.putImageData(im, 0, 0); return cv;
}
// 依裁切／去背設定，從原圖產生要畫的圖
function brProcess() {
  const d = $('#dlg'), src = d._brOrig; if (!src) { d._brImg = null; return; }
  const a = brAdjRead(), iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
  const sx = Math.round(iw * a.cl / 100), sy = Math.round(ih * a.ct / 100), sw = Math.max(10, Math.round(iw * (1 - (a.cl + a.cr) / 100))), sh = Math.max(10, Math.round(ih * (1 - (a.ct + a.cb) / 100)));
  if (!a.cut && !sx && !sy && sw === iw && sh === ih) { d._brImg = src; return; }
  const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
  cv.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  d._brImg = a.cut ? brCutBg(cv, a.tol) : cv;
}
// 上傳的圖片縮到長邊 1200 再存（JPEG），避免檔案過大
function brLoadPhoto(file) {
  const d = $('#dlg'), e = $('#brErr');
  if (!file || !/^image\//.test(file.type)) { e.textContent = '請選擇圖片檔'; e.hidden = false; return; }
  if (file.size > 20e6) { e.textContent = '圖片太大（上限 20MB）'; e.hidden = false; return; }
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => {
    const s = Math.min(1, 1200 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
    cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    d._brOrig = cv; d._brPhoto = cv.toDataURL('image/jpeg', 0.85); e.hidden = true; brAdjSet({}); brProcess(); d._brRedraw?.();
  };
  im.onerror = () => { URL.revokeObjectURL(url); e.textContent = '這張圖片讀不出來，請換一張（建議 JPG／PNG）'; e.hidden = false; };
  im.src = url;
}
// 模擬貼文裡的連結卡片外觀（Threads／Facebook）；實際樣子以平台顯示為準
function brMockDraw(i) {
  const d = $('#dlg'), el = $('#brMock'); if (!el) return;
  const img = $('#brCv').toDataURL('image/jpeg', 0.8), title = $('#brTitle').value.trim(), desc = $('#brDesc').value.trim().replace(/\s+/g, ' ');
  const host = (location.host || 'example.com'), m = d._brMock || 'threads';
  el.className = `mock ${m}`;
  el.innerHTML = m === 'fb'
    ? `<div class="mk-post"><div class="mk-user"><span class="mk-av"></span><b>你的粉專</b><span class="mk-mut">· 剛剛</span></div><p class="mk-txt">（貼文內容）</p>
       <div class="mk-card"><img src="${img}" alt=""><div class="mk-meta"><span class="mk-host">${esc(host.toUpperCase())}</span><b class="mk-title">${esc(title)}</b><span class="mk-desc">${esc(desc)}</span></div></div></div>`
    : `<div class="mk-post"><div class="mk-user"><span class="mk-av"></span><b>你的帳號</b><span class="mk-mut">剛剛</span></div><p class="mk-txt">（貼文內容）</p>
       <div class="mk-card"><img src="${img}" alt=""><div class="mk-meta"><span class="mk-host">${esc(host)}</span><b class="mk-title">${esc(title)}</b></div></div></div>`;
}
async function brSave(b) {
  const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
  const d = $('#dlg'), title = $('#brTitle').value.trim(), head = $('#brHead').value.trim(), sub = $('#brSub').value.trim(), desc = $('#brDesc').value.trim();
  const style = $('input[name="brSty"]:checked')?.value || 'classic', photoOnly = !!d._brImg && $('#brPhotoOnly').checked;
  const slug = slugify(head) || slugify(title);   // 橋接網址＝圖上大字（重複時伺服器自動加 -2）
  const err = !title ? '請填寫預覽卡片標題' : !head && !photoOnly ? '請填寫圖上大字' : !okDest(i.aff) ? '橋接頁只支援蝦皮的連結（shopee／shp.ee）' : '';
  const e = $('#brErr'); e.textContent = err; e.hidden = !err; if (err) return;
  const fit = $('input[name="brFit"]:checked')?.value === 'cover' ? 'cover' : 'contain';
  const cv = $('#brCv'); const showName = $('#brShowName').checked;
  const adj = d._brImg ? brAdjRead() : undefined;
  drawBridge(cv, { style, head, sub, name: i.name, kind: i.kind, img: d._brImg, fit, photoOnly, hideName: !showName, adj });
  try {
    const body = { action: 'save', code: i.bridge?.code || '', slug, kind: i.kind === 'shop' ? 'shop' : 'item', title, desc, dest: i.aff, image: cv.toDataURL('image/jpeg', 0.88) };
    if (d._brPhoto !== undefined) body.photo = d._brPhoto;   // 新上傳＝字串、移除＝null、沒動＝不帶
    else if (d._brOrig && !i.bridge?.photo) body.photo = (d._brOrig.toDataURL ? d._brOrig : (() => { const c = document.createElement('canvas'); c.width = d._brOrig.naturalWidth; c.height = d._brOrig.naturalHeight; c.getContext('2d').drawImage(d._brOrig, 0, 0); return c; })()).toDataURL('image/jpeg', 0.85);
    const j = await bridgeApi(body, b);
    i.bridge = { code: j.code, at: j.at, title, head, sub, desc, style, photo: !!d._brImg, photoOnly, fit, showName, adj, slug: j.slug || undefined };
    save.i(); $('#dlg').close(); route(); toast('橋接頁已發布，可按「複製橋接網址」貼到貼文');
  } catch (er) { e.textContent = er.message; e.hidden = false; }
}

/* ========== 點擊統計（只計算經過橋接頁的真人點擊） ========== */
const dayKeys = (today, n) => { const t = Date.parse(today + 'T00:00:00Z'); return Array.from({ length: n }, (_, k) => new Date(t - k * 864e5).toISOString().slice(0, 10)); };
let statsCache = null, statRange = '7';
// 日期範圍 → 判斷某天（台灣日期 YYYY-MM-DD）是否在範圍內
function statInRange(today) {
  if (statRange === 'all') return () => true;
  if (statRange === 'custom') {
    let f = $('#statFrom').value || '0000-00-00', t = $('#statTo').value || '9999-99-99';
    if (f > t) [f, t] = [t, f];
    return (d) => d >= f && d <= t;
  }
  const keys = new Set(dayKeys(today, statRange === 'today' ? 1 : Number(statRange)));
  return (d) => keys.has(d);
}
const statLabel = () => ({ today: '今日', 7: '近 7 天', 30: '近一個月', all: '全部期間' }[statRange] || (() => {
  const f = $('#statFrom').value, t = $('#statTo').value;
  return f || t ? `${f || '最早'} ～ ${t || '今天'}` : '自訂（請選日期）';
})());
// ---- 點擊統計圖表（純 SVG／HTML，不載入外部程式） ----
const dAdd = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const dSpan = (a, b) => { const out = []; for (let d = a; d <= b && out.length < 400; d = dAdd(d, 1)) out.push(d); return out; };
const mdd = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
// 趨勢圖要畫的日期：今日→近 7 天（單日畫不出趨勢）；全部→從第一次點擊到今天；自訂→選的區間（最多 400 天）
function statTrendDays(today, agg) {
  if (statRange === 'today' || statRange === '7') return dSpan(dAdd(today, -6), today);
  if (statRange === '30') return dSpan(dAdd(today, -29), today);
  if (statRange === 'custom') {
    let f = $('#statFrom').value || '', t = $('#statTo').value || today;
    if (f && f > t) [f, t] = [t, f];
    if (!f) f = Object.keys(agg).sort()[0] || dAdd(t, -29);
    return dSpan(f, t).slice(-400);
  }
  const first = Object.keys(agg).sort()[0] || dAdd(today, -29);
  return dSpan(first < dAdd(today, -29) ? first : dAdd(today, -29), today).slice(-400);
}
const niceStep = (v) => { const raw = Math.max(1, v / 4), p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
function trendSvg(days, agg, today) {
  const W = Math.round(Math.max(300, Math.min(1100, ($('#statsBody')?.clientWidth || 640) - 36))), H = W < 520 ? 200 : 240, L = 36, R = 12, T = 12, B = 28, iw = W - L - R, ih = H - T - B;
  const vals = days.map((d) => agg[d] || 0), n = days.length, stp = niceStep(Math.max(...vals, 0)), mx = stp * Math.max(1, Math.ceil(Math.max(...vals, 0) / stp));
  const x = (k) => L + (n === 1 ? iw / 2 : (k * iw) / (n - 1)), y = (v) => T + ih - (v / mx) * ih;
  const grid = Array.from({ length: Math.round(mx / stp) + 1 }, (_, k) => k * stp).map((v) => { const yy = y(v); return `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="ch-grid"/><text x="${L - 6}" y="${yy}" class="ch-ax" text-anchor="end" dominant-baseline="middle">${fmt(v)}</text>`; }).join('');
  const step = Math.max(1, Math.ceil(n / (W < 520 ? 4 : 7)));
  const xl = days.map((d, k) => (k % step === 0 || k === n - 1) && !(k !== n - 1 && n - 1 - k < step / 2) ? `<text x="${x(k)}" y="${H - 8}" class="ch-ax" text-anchor="middle">${d === today ? '今天' : mdd(d)}</text>` : '').join('');
  const pts = vals.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`);
  const area = `M${x(0)},${y(0)} L${pts.join(' L')} L${x(n - 1)},${y(0)} Z`;
  const dots = n <= 45 ? vals.map((v, k) => `<circle cx="${x(k)}" cy="${y(v)}" r="4" class="ch-dot"/>`).join('') : '';
  const hw = n === 1 ? iw : iw / (n - 1);
  const hits = days.map((d, k) => `<g class="ch-hit"><rect x="${x(k) - hw / 2}" y="${T}" width="${hw}" height="${ih}"/><line x1="${x(k)}" x2="${x(k)}" y1="${T}" y2="${T + ih}"/><circle cx="${x(k)}" cy="${y(vals[k])}" r="6"/><title>${mdd(d)}${d === today ? '（今天）' : ''}：${fmt(vals[k])} 次點擊</title></g>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="ch-svg" role="img" aria-label="每日點擊趨勢，${mdd(days[0])} 到 ${mdd(days[n - 1])}，合計 ${fmt(vals.reduce((a, b) => a + b, 0))} 次">${grid}${xl}<path d="${area}" class="ch-area"/><polyline points="${pts.join(' ')}" class="ch-line"/>${dots}${hits}</svg>`;
}
function hbars(list, cls = '') {
  const mx = Math.max(1, ...list.map((r) => r.v));
  return `<ol class="ch-bars ${cls}">${list.map((r) => `<li title="${esc(r.label)}：${fmt(r.v)} 次"><span class="ch-lab">${esc(r.label)}</span><span class="ch-track"><span class="ch-fill" data-w="${r.v ? Math.max(2, (r.v / mx) * 100).toFixed(1) : 0}"></span></span><b>${fmt(r.v)}</b></li>`).join('')}</ol>`;
}
function statCharts(rows, j, inR, lab) {
  const agg = {}; for (const r of rows) for (const [d, n] of Object.entries(r.s.days || {})) agg[d] = (agg[d] || 0) + n;
  const days = statTrendDays(j.today, agg), tsum = days.reduce((t, d) => t + (agg[d] || 0), 0);
  const avg = days.length ? tsum / days.length : 0, peak = days.reduce((b, d) => ((agg[d] || 0) > (agg[b] || 0) ? d : b), days[0]);
  // 排行：區間內點擊最多的前 8 名
  const top = rows.filter((r) => r.range > 0).slice(0, 8).map((r) => ({ label: `${isShop(r.i) ? '🏪' : '🛍️'} ${r.i.name}`, v: r.range }));
  // 商品／賣場占比
  const it = rows.filter((r) => !isShop(r.i)).reduce((t, r) => t + r.range, 0), sh = rows.filter((r) => isShop(r.i)).reduce((t, r) => t + r.range, 0), all = it + sh;
  const pct = (v) => (all ? Math.round((v / all) * 100) : 0);
  // 星期分布（區間內）
  const wk = [0, 0, 0, 0, 0, 0, 0]; for (const [d, n] of Object.entries(agg)) if (inR(d)) wk[new Date(d + 'T00:00:00Z').getUTCDay()] += n;
  const wn = ['日', '一', '二', '三', '四', '五', '六'], wmx = Math.max(1, ...wk);
  const trendNote = statRange === 'today' ? '（今日只有一天，趨勢顯示近 7 天）' : '';
  // 時段：區間內每小時點擊數，以及星期 × 時段熱度
  const hr = new Array(24).fill(0), hm = Array.from({ length: 7 }, () => new Array(24).fill(0)); let hrSum = 0;
  for (const r of rows) for (const [d, a] of Object.entries(r.s.hrs || {})) if (inR(d) && Array.isArray(a)) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); a.forEach((n, k) => { n = +n || 0; if (k < 24 && n) { hr[k] += n; hm[w][k] += n; hrSum += n; } }); }
  const hmx = Math.max(1, ...hr), mmx = Math.max(1, ...hm.flat()), hpk = hr.indexOf(Math.max(...hr));
  const hh = (k) => `${String(k).padStart(2, '0')}:00`;
  const top3 = hr.map((v, k) => [v, k]).filter(([v]) => v).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([v, k]) => `${hh(k)}–${hh((k + 1) % 24)}（${fmt(v)} 次）`);
  const hrNote = '<p class="muted sm">時段資料從 2026/11/25 開始記錄，之前的點擊沒有時間資訊。</p>';
  return `<div class="ch-grid2">
    <section class="card ch ch-wide"><h2 class="ch-h">每日點擊趨勢 <span class="muted sm">${mdd(days[0])} ～ ${mdd(days[days.length - 1])}${trendNote}</span></h2>
      <p class="ch-kpi sm muted">合計 <b>${fmt(tsum)}</b> 次 · 日平均 <b>${avg.toFixed(1)}</b> 次 · 最高 <b>${peak && agg[peak] ? `${mdd(peak)}（${fmt(agg[peak])} 次）` : '—'}</b></p>
      ${trendSvg(days, agg, j.today)}</section>
    <section class="card ch"><h2 class="ch-h">點擊排行 <span class="muted sm">${esc(lab)}</span></h2>
      ${top.length ? hbars(top) : '<p class="muted sm">這段期間還沒有點擊</p>'}</section>
    <section class="card ch"><h2 class="ch-h">商品／賣場占比 <span class="muted sm">${esc(lab)}</span></h2>
      ${all ? `<div class="ch-stack" role="img" aria-label="商品 ${pct(it)}%，賣場 ${pct(sh)}%">${it ? `<span class="c1" data-f="${it}" title="商品：${fmt(it)} 次（${pct(it)}%）"></span>` : ''}${sh ? `<span class="c2" data-f="${sh}" title="賣場：${fmt(sh)} 次（${pct(sh)}%）"></span>` : ''}</div>
      <ul class="ch-leg"><li><i class="c1"></i>🛍️ 商品 <b>${fmt(it)}</b> 次（${pct(it)}%）</li><li><i class="c2"></i>🏪 賣場 <b>${fmt(sh)}</b> 次（${pct(sh)}%）</li></ul>` : '<p class="muted sm">這段期間還沒有點擊</p>'}</section>
    <section class="card ch"><h2 class="ch-h">星期分布 <span class="muted sm">${esc(lab)}</span></h2>
      <div class="ch-cols" role="img" aria-label="${wn.map((w, k) => `星期${w} ${wk[k]} 次`).join('，')}">${wk.map((v, k) => `<div title="星期${wn[k]}：${fmt(v)} 次"><b>${v ? fmt(v) : ''}</b><span class="ch-col"><span data-h="${v ? Math.max(3, (v / wmx) * 100).toFixed(1) : 0}"></span></span><span class="ch-ax2">${wn[k]}</span></div>`).join('')}</div></section>
    <section class="card ch ch-wide"><h2 class="ch-h">點擊時段分布 <span class="muted sm">${esc(lab)}・台灣時間</span></h2>
      ${hrSum ? `<p class="ch-kpi sm muted">最熱門時段 <b>${top3.join('、')}</b></p>
      <div class="ch-cols ch-cols24" role="img" aria-label="${hr.map((v, k) => `${k} 點 ${v} 次`).join('，')}">${hr.map((v, k) => `<div title="${hh(k)}–${hh((k + 1) % 24)}：${fmt(v)} 次"${k === hpk ? ' class="pk"' : ''}><b>${v && v === hr[hpk] ? fmt(v) : ''}</b><span class="ch-col"><span data-h="${v ? Math.max(3, (v / hmx) * 100).toFixed(1) : 0}"></span></span><span class="ch-ax2">${k % 3 === 0 ? k : ''}</span></div>`).join('')}</div>` : '<p class="muted sm">這段期間還沒有時段資料</p>'}${hrNote}</section>
    <section class="card ch ch-wide"><h2 class="ch-h">星期 × 時段熱度 <span class="muted sm">${esc(lab)}・顏色越深點擊越多</span></h2>
      ${hrSum ? `<div class="hm" role="table" aria-label="星期與時段的點擊熱度">
        <div class="hm-r hm-hd" role="row"><span role="columnheader"></span>${hr.map((_, k) => `<span role="columnheader">${k % 3 === 0 ? k : ''}</span>`).join('')}</div>
        ${[1, 2, 3, 4, 5, 6, 0].map((w) => `<div class="hm-r" role="row"><span role="rowheader">${wn[w]}</span>${hm[w].map((v, k) => `<i role="cell" title="星期${wn[w]} ${hh(k)}–${hh((k + 1) % 24)}：${fmt(v)} 次"${v ? ` data-a="${(0.15 + 0.85 * (v / mmx)).toFixed(2)}"` : ' class="z"'}></i>`).join('')}</div>`).join('')}
        <div class="hm-leg sm muted"><span>少</span><i data-a="0.15"></i><i data-a="0.45"></i><i data-a="0.75"></i><i data-a="1"></i><span>多</span></div>
      </div>` : '<p class="muted sm">這段期間還沒有時段資料</p>'}</section>
  </div>`;
}
async function renderStats(refetch = true) {
  const body = $('#statsBody');
  $$('[data-act="statRange"]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.r === statRange)));
  $('#statCustom').hidden = statRange !== 'custom';
  let j = statsCache;
  if (refetch || !j) {
    body.innerHTML = '<p class="loading">讀取點擊統計中…</p>';
    try { j = await bridgeApi({ action: 'stats' }); statsCache = j; }
    catch (e) { body.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  }
  // 以伺服器上的橋接頁為準；對應得到的商品／賣場顯示目前名稱，已刪除的顯示建立時的標題
  const byCode = new Map(items.filter((i) => i.bridge?.code).map((i) => [i.bridge.code, i]));
  const codes = Object.keys(j.stats || {});
  if (!codes.length) { body.innerHTML = '<p class="empty">還沒有橋接頁。到「發布清單」的商品或賣場卡片按「🔗 建立橋接頁」，點擊次數就會顯示在這裡。</p>'; return; }
  const inR = statInRange(j.today), lab = statLabel();
  const cnt = (s, f) => Object.entries(s.days || {}).reduce((t, [d, n]) => t + (f(d) ? n : 0), 0);
  const isToday = (d) => d === j.today, d30 = new Set(dayKeys(j.today, 30)), in30 = (d) => d30.has(d);
  const d7 = new Set(dayKeys(j.today, 7)), in7 = (d) => d7.has(d);
  const rows = codes.map((c) => { const s = j.stats[c], i = (s.codes || [c]).map((k) => byCode.get(k)).find(Boolean) || { id: '', name: s.title || c, kind: s.kind === 'shop' ? 'shop' : '', bridge: { code: c }, gone: true }; if (i.gone) { if (s.slug) i.bridge.slug = s.slug; i.bridge.at = s.at; } return { c, i, s, range: cnt(s, inR), today: cnt(s, isToday), week: cnt(s, in7), month: cnt(s, in30), total: s.total || 0 }; })
    .sort((a, b) => b.range - a.range || b.total - a.total);
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
  const dup = { today: 'today', 7: 'week', 30: 'month', all: 'total' }[statRange];
  const pick = (ks, m) => ks.filter((k) => k !== dup).slice(0, m);
  const NM = { today: '今日', week: '近 7 天', month: '近一個月', total: '累計' };
  const sumKs = pick(['today', 'total', 'week'], 2), cardKs = pick(['today', 'week', 'month', 'total'], 3);
  body.innerHTML = `<div class="stat-sum"><div class="hl"><span>${esc(lab)}</span><b>${fmt(sum('range'))}</b></div>${sumKs.map((k) => `<div><span>${NM[k]}</span><b>${fmt(sum(k))}</b></div>`).join('')}<div><span>橋接頁</span><b>${rows.length}</b></div></div>
    ${statCharts(rows, j, inR, lab)}
    <h2 class="ch-h">各橋接頁</h2>
    <div class="cards">${rows.map((r) => { const { c, i, s, range } = r; return `<article class="pc stat">
      <div class="pc-top"><span>${isShop(i) ? '<span class="tag shoptag">🏪 賣場</span>' : '<span class="tag">🛍️ 商品</span>'}${i.gone ? ' <span class="tag">已從清單刪除</span>' : ''}</span><span class="muted sm">${s.last ? `最後點擊 ${fmtDT(new Date(s.last).toISOString())}` : '尚無點擊'}</span></div>
      <h3>${esc(i.name)}</h3>
      <div class="stat-n"><div class="hl"><span>${esc(lab)}</span><b>${fmt(range)}</b></div>${cardKs.map((k) => `<div><span>${NM[k]}</span><b>${fmt(r[k])}</b></div>`).join('')}</div>
      <div class="pc-row sm"><span class="muted brurl">${esc(bridgeUrl(i).replace(/^https?:\/\//, ''))}</span></div>
      <div class="acts"><button type="button" data-act="brCopyUrl" data-u="${esc(bridgeShareUrl(i))}">複製橋接網址</button><button type="button" class="ghost" data-act="statDel" data-c="${esc(c)}" data-n="${esc(i.name)}">刪除</button></div>
    </article>`; }).join('')}</div>`;
  $$('#statsBody [data-w]').forEach((e) => { e.style.width = `${e.dataset.w}%`; });
  $$('#statsBody [data-h]').forEach((e) => { e.style.height = `${e.dataset.h}%`; });
  $$('#statsBody [data-f]').forEach((e) => { e.style.flex = `${e.dataset.f} 1 0`; });
  $$('#statsBody [data-a]').forEach((e) => { e.style.opacity = e.dataset.a; });
}

let catSel = 'all', gradeSel = 'all', shownIds = [];
function renderList() {
  // 類別按鈕：點選即顯示該類別排行（件數依類別多寡排序，「其他」放最後）
  const cnt = {};
  for (const i of items) if (i.status !== 'drop' && !isShop(i) && !i.manual) cnt[i.category || '未分類'] = (cnt[i.category || '未分類'] || 0) + 1;
  const cats = Object.keys(cnt).sort((a, b) => (a === '其他') - (b === '其他') || cnt[b] - cnt[a]);
  if (catSel !== 'all' && !cnt[catSel]) catSel = 'all';
  const total = Object.values(cnt).reduce((s, n) => s + n, 0);
  $('#catChips').innerHTML = [['all', '全部', total], ...cats.map((c) => [c, c, cnt[c]])]
    .map(([k, l, n]) => `<button type="button" role="tab" data-act="catSel" data-c="${esc(k)}" aria-selected="${catSel === k}">${esc(l)} <span class="n">${n}</span></button>`).join('');
  calcRec();
  const q = norm($('#listQ').value), c = catSel;
  const inCat = items.filter((i) => !isShop(i) && !i.manual && (c === 'all' || (i.category || '未分類') === c) && (!q || norm(`${i.name} ${i.category} ${i.shop} ${i.summary} ${i.note}`).includes(q)));
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
    <div class="checks"><label><input type="checkbox" name="oos"${i.oos ? ' checked' : ''}>缺貨</label>${Array.isArray(i.risk) && i.risk.length ? `<label><input type="checkbox" name="clrRisk">清除警示：${esc(i.risk.join('、'))}</label>` : ''}</div>
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
const SYNC_SETTINGS = ['weights', 'wv', 'thr', 'bonus', 'festOn', 'alias'];
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
      const j = await ai('analyze', copyReq(i, want, fest), b);
      b.textContent = '重新產生';
      const html = applyCopy(i, j, want, fest);
      if (d.open) el.innerHTML = html;
      save.i(); softRefresh();   // 對話框開著時會等關閉後再重繪目前畫面（發布清單）
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
  // 批次產生文案：先設定節慶段落（全部共用），再逐件呼叫 AI
  pubGenSel() {
    if (batchRunning) { toast('批次產生中，請稍候'); return; }
    const list = items.filter((i) => pubPicked.has(i.id) && INQ(i)); if (!list.length) return;
    const has = list.filter((i) => i.aiText).length, d = $('#dlg');
    d.innerHTML = `<div class="dlg-head"><h2>批次產生文案（${list.length} 件）</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>
      <p class="hint">會一件一件請 AI 產生文案，每件約 10–20 秒。產生中可以關閉這個視窗，完成後會通知你。</p>
      ${has ? `<div class="checks"><label><input type="checkbox" id="batchRedo">已有文案的 ${has} 件也重新產生（不勾＝跳過）</label></div>` : ''}
      ${festForm()}
      <div class="btns"><button type="button" class="pri" data-act="batchGo">開始產生</button><button type="button" class="ghost" data-act="closeDlg">取消</button></div>
      <div id="batchOut"></div>`;
    if (!d.open) d.showModal();
  },
  async batchGo(b) {
    if (batchRunning) return;
    const redo = $('#batchRedo')?.checked, want = $('#festOn').checked, fest = want ? ($('#festText').value.trim() || festAuto()) : '';
    const list = items.filter((i) => pubPicked.has(i.id) && INQ(i) && (redo || !i.aiText));
    if (!list.length) { toast('選取的商品都已有文案'); return; }
    batchRunning = true; batchStop = false; b.disabled = true; updPubBtns();
    const st = Object.fromEntries(list.map((i) => [i.id, '等待中']));
    const draw = () => { const el = $('#batchOut'); if (!el) return; const ok = Object.values(st).filter((v) => v === '✓ 完成').length;
      el.innerHTML = `<p><b>進度 ${ok}／${list.length}</b>${batchRunning ? ' <button type="button" class="ghost" data-act="batchStopNow">停止</button>' : ''}</p><ol class="batch-list">${list.map((i) => `<li><span>${esc(i.name.slice(0, 40))}</span><span class="${st[i.id].startsWith('✓') ? 'pubok' : st[i.id].startsWith('✕') ? 'danger' : 'muted'}">${esc(st[i.id])}</span></li>`).join('')}</ol>`; };
    let ok = 0, fail = 0, stopMsg = '';
    for (const i of list) {
      if (batchStop) { stopMsg = '已停止'; break; }
      st[i.id] = '產生中…'; draw();
      try {
        let j;
        try { j = await ai('analyze', copyReq(i, want, fest)); }
        catch (e) {   // 逾時或 Gemini 暫時錯誤：自動重試一次
          if (batchStop || !(e.status === 504 || e.status === 502 || e.name === 'AbortError')) throw e;
          st[i.id] = '逾時，重試中…'; draw();
          j = await ai('analyze', copyReq(i, want, fest));
        }
        applyCopy(i, j, want, fest); save.i(); st[i.id] = '✓ 完成'; ok++;
      } catch (e) {
        st[i.id] = `✕ ${e.message || '失敗'}`; fail++;
        if (e.status === 429 || e.status === 401) { stopMsg = e.status === 429 ? 'Gemini 額度用完或請求太頻繁，已暫停，請稍後再試' : e.message; break; }
      }
      draw();
    }
    list.forEach((i) => { if (st[i.id] === '等待中') st[i.id] = '未產生'; });
    batchRunning = false; draw(); updPubBtns();
    toast(`批次產生完成：成功 ${ok} 件${fail ? `、失敗 ${fail} 件` : ''}${stopMsg ? `（${stopMsg}）` : ''}`);
    softRefresh();
  },
  batchStopNow(b) { batchStop = true; b.disabled = true; b.textContent = '停止中…（等目前這件完成）'; },
  // 發布時間
  schedOpen(b) { const i = items.find((x) => x.id === b.dataset.id); if (i) schedDlg(i); },
  schedSave(b) {
    const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
    const at = `${$('#schedD').value}T${$('#schedT').value}`;
    if (!okSlot(at)) { toast('請選擇日期與時間'); return; }
    i.schedAt = at; save.i(); $('#dlg').close(); pubRedraw(); toast(`已排定 ${fmtSlot(at)}${ld(at) < new Date() ? '（這個時間已經過了）' : ''}`);
  },
  schedClear(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; i.schedAt = ''; save.i(); $('#dlg').close(); pubRedraw(); toast('已清除排定時間'); },
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
    const gone = new Set(list.filter(isShop).map((i) => i.id)); if (gone.size) dropShops(gone);
    list.filter((i) => !isShop(i)).forEach((i) => setStatus(i, 'watch')); pubPicked.clear(); save.i(); renderPub();
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
    const c = calibrate(items.filter((i) => !isShop(i)).map((i) => ({ price: num(i.price), sales: num(i.sales), comm: commOf(i) })));
    if (!c.ok) { toast(`目前只有 ${c.n} 件商品，少於 ${MIN_BATCH} 件，無法重算門檻`); return; }
    items.forEach(rescore); save.i(); renderSettings(); toast(`已用全部 ${c.n} 件商品重算門檻`);
  },
  resetThr() { delete S.thr; save.s(); items.forEach(rescore); save.i(); renderSettings(); toast('已恢復預設門檻'); },
  publish(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; setStatus(i, 'done'); save.i(); route(); toast(`已標記發布：${fmtDT(i.publishedAt)}`); },
  unpublish(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; setStatus(i, i.aiText ? 'copy' : 'todo'); save.i(); route(); },
  unqueue(b) {
    const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
    if (isShop(i)) { if (!confirm(`將賣場「${i.name}」移出發布清單？（會刪除這筆賣場）`)) return; dropShops(new Set([i.id])); save.i(); route(); return; }
    setStatus(i, 'watch'); save.i(); route();
  },
  // 橋接頁
  brOpen(b) { const i = items.find((x) => x.id === b.dataset.id); if (i) brDlg(i); },
  brSave(b) { brSave(b); },
  brAdjReset() { brAdjSet({}); brProcess(); $('#dlg')._brRedraw?.(); },
  brPhotoDel() { const d = $('#dlg'); d._brImg = null; d._brOrig = null; d._brPhoto = null; const f = $('#brPhoto'); if (f) f.value = ''; d._brRedraw?.(); },
  brMock(b) { const d = $('#dlg'); d._brMock = b.dataset.m; $$('[data-act="brMock"]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); const i = items.find((x) => x.id === $('[data-act="brSave"]')?.dataset.id); if (i) brMockDraw(i); },
  brCopyUrl(b) { if (b.dataset.u) copy(b.dataset.u, b); },
  brCopy(b) { const i = items.find((x) => x.id === b.dataset.id); if (i && brLive(i)) copy(bridgeShareUrl(i), b); },
  statsRefresh() { renderStats(); },
  statRange(b) {
    statRange = b.dataset.r;
    if (statRange === 'custom' && !$('#statFrom').value && !$('#statTo').value && statsCache) { $('#statTo').value = statsCache.today; $('#statFrom').value = dayKeys(statsCache.today, 7)[6]; }
    renderStats(false);
  },
  async statDel(b) {
    if (!confirm(`從點擊統計刪除「${b.dataset.n}」？\n\n只會移除這張統計卡片，已經貼出去的橋接網址仍會繼續導向蝦皮。之後在商品或賣場卡片重新按「建立橋接頁」或「編輯預覽圖」，它會再出現在統計裡。`)) return;
    try { await bridgeApi({ action: 'hide', code: b.dataset.c }, b); toast('已從點擊統計刪除'); renderStats(); } catch (e) { toast(e.message); }
  },
  // 新增賣場
  shopNew() { shopDlg(pubKind); },
  addNew() { shopDlg(pubKind); },
  addKind(b) { if (!b.disabled) shopDlg(b.dataset.k); },
  async shopGen() {
    const btn = $('#shopGenBtn'); if (!btn || btn.disabled) return;
    const kind = $('#dlg')._addKind === 'item' ? 'item' : 'shop', label = kind === 'shop' ? '賣場' : '商品', max = kind === 'shop' ? 60 : 120;
    const name = $('#shopName').value.trim(), url = $('#shopUrl').value.trim();
    const n = [...name].length;
    const errN = !name ? `請輸入${label}名稱` : n > max ? `${label}名稱最多 ${max} 字（目前 ${n} 字）` : '';
    const priceRaw = $('#addPrice')?.value.trim() || '', price = priceRaw === '' ? 0 : Number(priceRaw), cat = $('#addCat')?.value.trim() || '';
    const errP = priceRaw !== '' && !(price >= 0 && price < 1e8) ? '價格請填 0 以上的數字' : '';
    { const e = $('#addPriceErr'); if (e) { e.textContent = errP; e.hidden = !errP; } }
    if (errP) { $('#addPrice').focus(); return; }
    const errU = !url ? '請輸入分潤連結' : !isHttpUrl(url) ? '分潤連結必須是 http:// 或 https:// 開頭的完整網址（中間不能有空白）' : url.length > 2000 ? '分潤連結太長（最多 2000 字元）' : '';
    for (const [id, msg] of [['shopNameErr', errN], ['shopUrlErr', errU]]) { const e = document.getElementById(id); e.textContent = msg; e.hidden = !msg; }
    $('#shopName').setAttribute('aria-invalid', String(!!errN)); $('#shopUrl').setAttribute('aria-invalid', String(!!errU));
    if (errN || errU) { (errN ? $('#shopName') : $('#shopUrl')).focus(); return; }
    // 第一次按下時建立賣場（分潤連結原樣保存，只去掉前後空白）；重新產生時沿用同一筆並更新名稱與連結
    let i = items.find((x) => x.id === btn.dataset.id);
    if (!i) {
      const now = new Date().toISOString();
      i = kind === 'shop'
        ? { id: 'shop_' + uid(), kind: 'shop', name, shop: name, aff: url, category: '賣場', platform: 'fb', status: 'todo', queuedAt: now, createdAt: now, note: '' }
        : { id: 'man_' + uid(), manual: true, name, price, category: cat || '未分類', aff: url, shop: '', platform: 'fb', status: 'todo', queuedAt: now, createdAt: now, note: '' };
      items.push(i); btn.dataset.id = i.id;
      $$('[data-act="addKind"]').forEach((x) => { x.disabled = true; });   // 已建立後不能再切換種類
    } else { i.name = name; i.aff = url; if (kind === 'shop') i.shop = name; else { i.price = price; i.category = cat || '未分類'; } }
    pubKind = kind; store.set('pubKind', kind); pubSel = 'all'; save.i();
    const want = $('#festOn').checked, fest = want ? ($('#festText').value.trim() || festAuto()) : '';
    const el = $('#dlgOut'); loading(el);
    try {
      const j = await ai('analyze', copyReq(i, want, fest), btn);
      btn.textContent = '重新產生';
      const html = applyCopy(i, j, want, fest);
      if ($('#dlg').open) el.innerHTML = html;
      save.i();
    } catch (e) { showErr(el, e); }
    softRefresh();
  },
  pubKind(b) { pubKind = b.dataset.k === 'shop' ? 'shop' : 'item'; store.set('pubKind', pubKind); pubPicked.clear(); pubSel = 'all'; renderPub(); },
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

document.addEventListener('submit', (e) => { if (e.target.id === 'shopForm') { e.preventDefault(); ACT.shopGen(); } });
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const f = ACT[b.dataset.act]; if (f) f(b, e);
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.matches('select[data-act="status"]')) { const i = items.find((x) => x.id === t.dataset.id); if (i) { setStatus(i, t.value); save.i(); route(); } }
  else if (t.id === 'festOn') { S.festOn = t.checked; save.s(); }
  else if (t.name === 'brSty' || t.name === 'brFit' || t.id === 'brPhotoOnly' || t.id === 'brShowName') $('#dlg')._brRedraw?.();
  else if (t.id === 'brCut') { brProcess(); $('#dlg')._brRedraw?.(); }
  else if (t.id === 'brPhoto') brLoadPhoto(t.files?.[0]);
  else if (t.id === 'statFrom' || t.id === 'statTo') renderStats(false);
  else if (t.id === 'brHeadSel' && t.value !== '') { $('#brHead').value = [...$('#dlg')._brSrc.heads[+t.value]].slice(0, 40).join(''); $('#brHead').dispatchEvent(new Event('input', { bubbles: true })); }
  else if (t.id === 'brSubSel' && t.value !== '') { const p = $('#dlg')._brSrc.posts[+t.value]; $('#brSub').value = brShort(p); $('#brDesc').value = noTags(p).replace(/\s+/g, ' ').slice(0, 300); $('#dlg')._brRedraw?.(); }
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
let brAdjT;
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'brHead') { const h = $('#brSlugHint'), v = slugify(t.value); if (h) h.textContent = `橋接網址：${location.host}/${v || '（填入圖上大字後產生）'}`; }
  if (/^br(Z|Px|Py)$/.test(t.id)) { $('#dlg')._brRedraw?.(); return; }
  if (/^br(Ct|Cb|Cl|Cr|Tol)$/.test(t.id)) { brAdjOut(); clearTimeout(brAdjT); brAdjT = setTimeout(() => { brProcess(); $('#dlg')._brRedraw?.(); }, 90); return; }
  if (t.closest?.('#dlg') && /^(brHead|brSub|brTitle|brDesc)$/.test(t.id)) { $('#dlg')._brRedraw?.(); return; }
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

// 點擊統計：視窗寬度改變時依新寬度重畫圖表
let statRz; addEventListener('resize', () => { clearTimeout(statRz); statRz = setTimeout(() => { if (statsCache && !$('#v-stats').hidden) renderStats(false); }, 250); });
