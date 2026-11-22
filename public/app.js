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
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2800); }
const stat = (label, val, sub = '', cls = '') => `<div class="stat ${cls}"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

/* ========== 常數 ========== */
const PLATFORMS = { fb: 'Facebook（粉專／社團）', ig: 'Instagram', threads: 'Threads', line: 'LINE 社群／官方帳號', dcard: 'Dcard／PTT', other: '其他社群' };
// 舊版資料使用的平台代碼，只用於顯示
const FORMATS = ['圖文貼文', '多圖輪播', '限時動態', '社團分享長文', 'Threads 短文', '清單推薦', '比價懶人包', '開箱心得'];
const STATUS = { watch: '觀望中', todo: '待發文', copy: '已產文案', done: '已發布', drop: '淘汰' };
const ACTIVE = ['watch', 'todo', 'copy'];
const SORTS = { rec: '綜合推薦', score: '分數高低', sales: '月銷高低', priceAsc: '價格低到高', new: '最新加入' };
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
const EXTRA = ['shop', 'aff', 'discount', 'rating', 'sales', 'trend', 'summary', 'url', 'src', 'aiText'];
const numOr = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : Number(v));
const kfmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : fmt(n));
const catClass = (c) => { let h = 0; for (const ch of String(c || '')) h = (h + ch.codePointAt(0)) % 6; return 'k' + h; };
const DIMS = [
  { k: 'visual', n: '圖片吸睛度', s: '吸睛', w: 18, q: '一張實拍照片就能看出賣點或效果嗎？' },
  { k: 'pain', n: '痛點與需求強度', s: '痛點', w: 14, q: '觀眾是否已經在找解決方法？' },
  { k: 'trust', n: '銷量與評價信任度', s: '信任', w: 14, q: '評分、評價數、近期銷量是否足以建立信任？' },
  { k: 'topic', n: '話題性與季節性', s: '話題', w: 10, q: '現在是不是好時機（檔期、天氣、話題）？' },
  { k: 'risk', n: '退貨與客訴風險', s: '低風險', w: 10, q: '越安全分越高：尺寸、色差、功效爭議是否容易造成退貨？' },
  { k: 'fit', n: '社群契合度', s: '契合', w: 10, q: '適不適合你的粉絲／社團受眾與選定的貼文形式？' },
  { k: 'price', n: '價格帶衝動度', s: '價格', w: 12, auto: 1 },
];
const USER_DIMS = DIMS.filter((d) => !d.auto);
const GRADE_ACT = { S: '主打，本週優先發文', A: '正式發文，穩定推薦', B: '小量測試，用不同開頭 A/B 測試', C: '不建議花時間寫文' };

/* ========== 狀態（localStorage） ========== */
const DEF_W = Object.fromEntries(DIMS.map((d) => [d.k, d.w]));
const _s = store.get('settings', {});
const S = { accessCode: '', ownKey: '', ..._s, weights: { ...DEF_W, ..._s.weights }, alias: { ..._s.alias } };
const blankDraft = () => ({ id: '', name: '', category: '', price: '', base: '', xtra: '', platform: 'fb', format: FORMATS[0], scores: Object.fromEntries(USER_DIMS.map((d) => [d.k, 3])) });
let draft = { ...blankDraft(), ...store.get('draft', {}) };
let items = store.get('items', []);
const save = { s: () => store.set('settings', S), i: () => store.set('items', items), d: () => store.set('draft', draft) };

/* ========== 確定性公式 ========== */
const priceScore = (p) => (p <= 299 ? 5 : p <= 599 ? 4 : p <= 999 ? 3 : p <= 1999 ? 2 : 1);
const rateScore = (r) => (r >= 10 ? 5 : r >= 7 ? 4 : r >= 5 ? 3 : r >= 3 ? 2 : 1);
const gradeOf = (t) => (t >= 80 ? 'S' : t >= 65 ? 'A' : t >= 50 ? 'B' : 'C');
function scoreOf(p) {
  const v = { ...p.scores, price: priceScore(num(p.price)), rate: rateScore(num(p.base) + num(p.xtra)) };
  let sw = 0, t = 0;
  for (const d of DIMS) { const w = Math.max(0, num(S.weights[d.k])); sw += w; t += w * (clamp(num(v[d.k]) || 3, 1, 5) - 1) / 4; }
  const total = sw ? Math.round((t / sw) * 1000) / 10 : 0;
  return { v, total, grade: gradeOf(total) };
}
const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
function keyOf(name) { let k = norm(name), g = 0; while (S.alias[k] && g++ < 20) k = S.alias[k]; return k; }
function subId(p) {
  let h = 0; for (const c of String(p.name || '')) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return `${p.platform || 'other'}_${today().slice(2).replace(/-/g, '')}_${h.toString(36).slice(0, 5)}`;
}

/* ========== SVG 圖表 ========== */
function radar(vals, labels) {
  const N = vals.length, cx = 160, cy = 125, R = 88;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / N; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const poly = (f) => vals.map((v, i) => pt(i, f(v)).map((x) => x.toFixed(1)).join(',')).join(' ');
  let g = '';
  for (let l = 1; l <= 4; l++) g += `<polygon class="gl" points="${poly(() => (R * l) / 4)}"/>`;
  vals.forEach((_, i) => { const [x, y] = pt(i, R); g += `<line class="gl" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
  g += `<polygon class="area" points="${poly((v) => (R * (v - 1)) / 4)}"/>`;
  labels.forEach((l, i) => {
    const [x, y] = pt(i, R + 16); const anc = Math.abs(x - cx) < 5 ? 'middle' : x > cx ? 'start' : 'end';
    g += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anc}">${esc(l)} ${vals[i]}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 320 250" role="img" aria-label="雷達圖：${esc(labels.map((l, i) => `${l} ${vals[i]} 分`).join('、'))}">${g}</svg>`;
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
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('已複製'); }
  catch { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); toast('已複製'); }
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
  let added = 0, updated = 0;
  for (const r of rows) {
    const name = String(r['商品名稱'] || '').trim(); if (!name) continue;
    const link = safeUrl(r['商品連結']), m = link.match(/product\/(\d+)\/(\d+)/), pid = String(r['商品編號'] || '').trim() || (m && m[2]);
    const id = m ? `sp_${m[1]}_${m[2]}` : pid ? `sp_0_${pid}` : '';
    const price = num(String(r['商品價格'] || '').replace(/[$,]/g, '')), sales = salesNum(r['銷售量']);
    const shop = String(r['商店名稱'] || '').trim().slice(0, 80), aff = safeUrl(r['推廣連結']), rate = num(String(r['分潤率'] || '').replace('%', ''));
    const old = items.find((i) => (id && i.id === id) || (pid && (String(i.url).match(/(\d+)$/) || [])[1] === pid) || keyOf(i.name) === keyOf(name));
    if (old) {
      Object.assign(old, { price: price || old.price, sales: sales || old.sales, shop: shop || old.shop, aff: aff || old.aff, url: link || old.url, base: rate || old.base });
      rescore(old); updated++; continue;
    }
    const trust = sales >= 10000 ? 5 : sales >= 1000 ? 4 : 3;
    const it = makeItem({ ...blankDraft(), id: id || undefined, name, category: autoCat(name), price, base: rate, scores: { ...blankDraft().scores, trust }, sales, shop, aff, url: link, src: 'shopee' });
    it.status = 'watch'; items.push(it); added++;
  }
  save.i();
  return { added, updated };
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
const VIEWS = ['list', 'score', 'ai', 'settings'];
const RENDER = { score: renderScoreOut, ai: renderAI, list: renderList, settings: renderSettings };
function route() {
  let v = location.hash.slice(1); if (!VIEWS.includes(v)) v = 'list';
  $$('.view').forEach((s) => { s.hidden = s.id !== 'v-' + v; });
  $$('[data-v]').forEach((a) => { const on = a.dataset.v === v; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  RENDER[v]();
  window.scrollTo(0, 0);
  $(`#v-${v} h1`)?.focus({ preventScroll: true });
}

/* ========== M2 選品評分 ========== */
const SCORE_F = ['name', 'category', 'price', 'platform', 'format'];
function fillScoreForm() {
  const f = $('#fScore');
  for (const k of SCORE_F) f.elements[k].value = draft[k] ?? '';
  for (const d of USER_DIMS) { const r = f.querySelector(`input[name="s_${d.k}"][value="${draft.scores[d.k] || 3}"]`); if (r) r.checked = true; }
  renderScoreOut();
}
function readScoreForm() {
  const f = $('#fScore');
  for (const k of SCORE_F) draft[k] = f.elements[k].value;
  for (const d of USER_DIMS) { const r = f.querySelector(`input[name="s_${d.k}"]:checked`); draft.scores[d.k] = r ? +r.value : 3; }
  save.d(); renderScoreOut();
}
function renderScoreOut() {
  const r = scoreOf(draft);
  $('#scoreOut').innerHTML = `<div class="big"><span class="num">${fmt(r.total, 1)}</span><span class="grade g${r.grade}" aria-label="分級 ${r.grade}">${r.grade}</span></div>
  <p class="act">${GRADE_ACT[r.grade]}</p>
  ${radar(DIMS.map((d) => r.v[d.k]), DIMS.map((d) => d.s))}
  <ul class="kv">
    <li><span>價格帶衝動度（自動）</span><b>${r.v.price} 分</b></li>
  </ul>
  ${r.total < 50 ? '<p class="warn">分數低於 50，建議先不投入製作時間。</p>' : ''}`;
  $('#btnAddList').textContent = draft.id && items.some((i) => i.id === draft.id) ? '更新商品評分' : '加入商品清單';
  $$('#sliders [data-w]').forEach((e) => { e.textContent = `權重 ${S.weights[e.dataset.w]}`; });
}
function makeItem(p) {
  const r = scoreOf(p);
  const it = { id: p.id || uid(), name: String(p.name).trim().slice(0, 120), category: String(p.category || '').slice(0, 40), price: num(p.price), base: num(p.base), xtra: num(p.xtra), rate: num(p.base) + num(p.xtra), platform: PLATFORMS[p.platform] ? p.platform : 'other', format: String(p.format || '').slice(0, 20), scores: { ...p.scores }, total: r.total, grade: r.grade, status: 'todo', note: '', actual: { views: '', clicks: '', orders: '', commission: '' }, createdAt: new Date().toISOString() };
  for (const k of EXTRA) it[k] = p[k] ?? '';
  return it;
}
function rescore(i) { const r = scoreOf(i); i.total = r.total; i.grade = r.grade; i.rate = num(i.base) + num(i.xtra); }
/* ========== M4/M5/M6/M8 AI ========== */
let aiSrc = 'draft';
function renderAI() {
  const dn = draft.name ? `目前評分中：${draft.name}` : '目前評分中的商品（尚未輸入）';
  $('#aiSrc').innerHTML = `<option value="draft">${esc(dn)}</option>` + items.map((i) => `<option value="${esc(i.id)}">清單：${esc(i.name)}（${i.grade}）</option>`).join('');
  $('#aiSrc').value = items.some((i) => i.id === aiSrc) ? aiSrc : 'draft';
}
function analyzeTarget() {
  if (aiSrc !== 'draft') { const i = items.find((x) => x.id === aiSrc); if (i) return i; }
  const r = scoreOf(draft);
  return { ...draft, rate: num(draft.base) + num(draft.xtra), total: r.total, grade: r.grade, scores: { ...draft.scores } };
}
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
    h = `<p class="verdict">${esc(o.verdict)}</p>
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
    t = `【${p.name}】${o.verdict || ''}\n\n${posts.length ? `短貼文\n${posts.map((x, n) => `${n + 1}. ${x}`).join('\n\n')}\n\n` : ''}${long ? `心得長文\n${long}\n\n` : ''}吸睛第一句\n${ls(o.headlines || o.hooks)}\n\n${car.length ? `IG 輪播\n${car.map((s, n) => `${s?.slide || `第 ${n + 1} 張`}｜${s?.title || ''}｜${s?.text || ''}`).join('\n')}\n\n` : ''}實拍照片建議\n${ls(o.imageIdeas)}\n\nCTA：${o.cta || ''}\nHashtag：${tags}\n${o.bestTime ? `發文時段：${str(o.bestTime)}\n` : ''}\n合規提醒\n${ls(o.compliance)}\n\nSub_id：${sub}`;
  } else { h = `<div class="md">${md(j.text)}</div>`; t = j.text + `\n\nSub_id：${sub}`; }
  if (safeUrl(p.aff)) { outText.aff = p.aff; h += `<h3>推廣連結</h3><div class="post"><p>${esc(p.aff)}</p><button type="button" data-act="copy" data-k="aff">複製</button></div>`; t += `\n推廣連結：${p.aff}`; }
  h += `<h3>建議 Sub_id</h3><p><code>${esc(sub)}</code> <span class="hint">（平台_日期_商品代碼，貼到自定義連結的 Sub_id 欄）</span></p>`;
  return outCard('analyze', h, j, t);
}
/* ========== M7 候選清單 ========== */
let recMap = {};
// 綜合推薦指數 0–100：系統分數 50%、單筆期望佣金 30%（相對最高者）、銷量 20%（對數，相對最高者）
function calcRec() {
  const act = items.filter((i) => i.status !== 'drop');
  const maxS = Math.max(1, ...act.map((i) => num(i.sales)));
  recMap = Object.fromEntries(items.map((i) => [i.id, Math.round(100 * (0.6 * i.total / 100 + 0.4 * (num(i.sales) > 0 ? Math.log10(num(i.sales) + 1) / Math.log10(maxS + 1) : 0)))]));
}
const SORT_FN = {
  rec: (a, b) => (recMap[b.id] || 0) - (recMap[a.id] || 0) || b.total - a.total,
  rate: (a, b) => num(b.base) + num(b.xtra) - num(a.base) - num(a.xtra) || b.total - a.total,
  score: (a, b) => b.total - a.total,
  sales: (a, b) => num(b.sales) - num(a.sales) || b.total - a.total,
  priceAsc: (a, b) => num(a.price) - num(b.price),
  new: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
};
let catSel = 'all';
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
  const q = norm($('#listQ').value), f = $('#listFilter').value, c = catSel;
  const arr = items.filter((i) => (f === 'all' || i.status === f) && (c === 'all' || (i.category || '未分類') === c) && (!q || norm(`${i.name} ${i.category} ${i.shop} ${i.summary} ${i.note}`).includes(q)))
    .sort(SORT_FN[$('#listSort').value] || SORT_FN.rec);
  $('#listCount').textContent = `${c === 'all' ? '綜合排行' : `${c} 排行`}｜${arr.length} 件`;
  if (!arr.length) { $('#listBody').innerHTML = `<p class="empty">${items.length ? '沒有符合條件的商品。' : '還沒有商品。請在上方匯入蝦皮匯出的商品檔。'}</p>`; return; }
  $('#listBody').innerHTML = `<div class="cards">${arr.map(cardItem).join('')}</div>`;
}
function cardItem(i, idx) {
  const r = num(i.rating), a = i.actual || {}, u = safeUrl(i.url), id = esc(i.id);
  const stars = r ? `<span class="stars" aria-hidden="true">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</span> <span aria-label="評分 ${r}">${r}</span>` : '';
  const trend = i.trend === '上升' ? '<span class="up">↗ 上升</span>' : i.trend === '下降' ? '<span class="down">↘ 下降</span>' : i.trend ? `<span class="muted">→ ${esc(i.trend)}</span>` : '';
  return `<article class="pc">
    <div class="pc-top"><span><span class="rk${idx < 3 ? ' top' : ''}">#${idx + 1}</span> <span class="cat ${catClass(i.category)}">${esc(i.category || '未分類')}</span></span><span class="muted sm">${esc(i.shop || '')}</span></div>
    <h3>${esc(i.name)}</h3>
    <div class="pc-row"><span>${num(i.price) ? `<b class="price">$${fmt(num(i.price))}</b>` : '<span class="muted">價格未知</span>'}${num(i.discount) ? `<span class="disc">-${fmt(num(i.discount))}%</span>` : ''}</span><span class="muted">${num(i.sales) ? `月銷 ${kfmt(num(i.sales))}` : ''}</span></div>
    ${stars || trend ? `<div class="pc-row"><span>${stars}</span>${trend}</div>` : ''}
    ${i.summary ? `<p class="sum">${esc(i.summary)}</p>` : ''}
    <div class="pc-row sm"><span>推薦指數 <b>${recMap[i.id] ?? '—'}</b>｜<span class="grade g${i.grade}">${i.grade}</span> ${fmt(i.total, 1)} 分</span><span>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">來源</a>` : ''}${i.src === 'ai' ? ' <span class="tag">AI 找到</span>' : ''}</span></div>
    ${a.views !== '' && a.views != null ? `<div class="sm muted">實際：${fmt(num(a.views))} 觸及／${fmt(num(a.orders))} 單／${fmt(num(a.commission))} 元</div>` : ''}
    ${i.note ? `<div class="sm muted">備註：${esc(i.note)}</div>` : ''}
    <select data-act="status" data-id="${id}" aria-label="${esc(i.name)} 狀態">${opts(STATUS, i.status)}</select>
    <div class="acts">${safeUrl(i.aff) ? `<button type="button" class="pri" data-act="copyAff" data-id="${id}">複製推廣連結</button>` : ''}<button type="button" data-act="itemAI" data-id="${id}">AI 產文案</button>${i.aiText ? `<button type="button" data-act="viewCopy" data-id="${id}">查看文案</button>` : ''}<button type="button" data-act="itemToScore" data-id="${id}">評分</button><button type="button" data-act="editItem" data-id="${id}">編輯</button><button type="button" class="danger" data-act="delItem" data-id="${id}">刪除</button></div>
  </article>`;
}
function editItem(id) {
  const i = items.find((x) => x.id === id); if (!i) return;
  const a = i.actual || {}, d = $('#dlg');
  const nf = (n, l, v, step = 'any') => `<label>${l}<input name="${n}" type="number" inputmode="decimal" min="0" step="${step}" value="${esc(v)}"></label>`;
  d.innerHTML = `<form method="dialog" id="fEdit"><h2>${esc(i.name)}</h2>
    <div class="row2">
      <label>狀態<select name="status">${opts(STATUS, i.status)}</select></label>
      <label>類別<input name="category" maxlength="40" list="cats" value="${esc(i.category)}"></label>
      ${nf('price', '價格（元）', i.price)}${nf('discount', '折扣 %', i.discount)}
      ${nf('rating', '評分', i.rating)}${nf('sales', '月銷', i.sales)}
    </div>
    <label>商店名稱<input name="shop" maxlength="80" value="${esc(i.shop)}"></label>
    <label>商品網址<input name="url" type="url" maxlength="500" value="${esc(i.url)}"></label>
    <label>推廣連結（分潤短網址）<input name="aff" type="url" maxlength="300" value="${esc(i.aff)}"></label>
    <label>備註<textarea name="note" rows="2" maxlength="500">${esc(i.note)}</textarea></label>
    <h3>實際成效回填（復盤）</h3><div class="row2">${nf('views', '觸及', a.views)}${nf('clicks', '點擊', a.clicks)}${nf('orders', '訂單', a.orders)}${nf('commission', '佣金（元）', a.commission)}</div>
    <p class="hint">分潤比例請以蝦皮分潤後台為準；修改後分數會自動重算。</p>
    <div class="btns"><button value="cancel" formnovalidate>取消</button><button value="ok" class="pri">儲存</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const f = new FormData($('#fEdit'));
    i.status = STATUS[f.get('status')] ? f.get('status') : i.status;
    i.note = String(f.get('note')).slice(0, 500); i.category = String(f.get('category')).trim().slice(0, 40); i.url = safeUrl(f.get('url'));
    i.price = num(f.get('price')); i.shop = String(f.get('shop')).trim().slice(0, 80); i.aff = safeUrl(f.get('aff'));
    for (const k of ['discount', 'rating', 'sales']) i[k] = numOr(f.get(k));
    i.actual = Object.fromEntries(['views', 'clicks', 'orders', 'commission'].map((k) => [k, f.get(k)]));
    rescore(i); save.i(); renderList(); toast('已儲存');
  };
  d.showModal();
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
  wSum(); checkConn();
}
function wSum() { const t = DIMS.reduce((s, d) => s + num(S.weights[d.k]), 0); $('#wSum').textContent = `權重合計 ${fmt(t)}${t === 100 ? '' : '（不是 100 時會自動按比例換算）'}`; }

/* ========== 事件 ========== */
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };
const ACT = {
  // 評分
  toAI() { readScoreForm(); aiSrc = draft.id && items.some((i) => i.id === draft.id) ? draft.id : 'draft'; go('#ai'); },
  addList() {
    readScoreForm();
    if (!draft.name.trim()) { toast('請先輸入商品名稱'); $('#fScore').elements.name.focus(); return; }
    const ix = items.findIndex((i) => i.id === draft.id);
    const it = makeItem(draft);
    if (ix >= 0) { const o = items[ix]; items[ix] = { ...o, ...it, status: o.status, note: o.note, actual: o.actual, aiText: o.aiText, createdAt: o.createdAt }; toast('已更新商品評分'); }
    else { items.push(it); draft.id = it.id; save.d(); toast('已加入商品清單'); }
    save.i(); renderScoreOut();
  },
  resetDraft() { draft = blankDraft(); save.d(); fillScoreForm(); },
  // 文案
  async runAnalyze(b) {
    aiSrc = $('#aiSrc').value; const p = analyzeTarget(), el = $('#out-analyze');
    if (!String(p.name || '').trim()) { toast('請先選擇商品'); return; }
    loading(el);
    try {
      const j = await ai('analyze', { name: p.name, category: p.category, price: num(p.price), platform: p.platform, format: p.format, scores: p.scores, total: p.total, grade: p.grade }, b);
      el.innerHTML = renderAnalyze(j, p);
      const it = items.find((x) => x.id === aiSrc);
      if (it) { it.aiText = String(outText.analyze || '').slice(0, 8000); if (['watch', 'todo'].includes(it.status)) it.status = 'copy'; save.i(); }
    } catch (e) { showErr(el, e); }
  },
  itemAI(b) { aiSrc = b.dataset.id; location.hash = '#ai'; renderAI(); ACT.runAnalyze($('#v-ai [data-act="runAnalyze"]')); },
  viewCopy(b) {
    const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
    const d = $('#dlg'); outText.view = i.aiText;
    d.innerHTML = `<h2>${esc(i.name)}｜文案</h2><div class="pre">${esc(i.aiText)}</div><div class="btns"><button type="button" class="pri" data-act="copy" data-k="view">複製</button><button type="button" data-act="closeDlg">關閉</button></div>`;
    d.showModal();
  },
  closeDlg() { $('#dlg').close(); },
  copy(b) { copy(outText[b.dataset.k] || ''); },
  copyAff(b) { const i = items.find((x) => x.id === b.dataset.id); if (i && safeUrl(i.aff)) copy(i.aff); },
  // 商品
  autoCatAll() {
    let n = 0;
    for (const i of items) { const c = autoCat(i.name, i.category); if (c !== i.category && (c !== '其他' || !i.category)) { i.category = c; n++; } }
    save.i(); renderList(); toast(n ? `已自動分類 ${n} 件商品` : '所有商品都已有分類');
  },
  catSel(b) { catSel = b.dataset.c; renderList(); },
  editItem(b) { editItem(b.dataset.id); },
  itemToScore(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; draft = { ...blankDraft(), ...i, scores: { ...blankDraft().scores, ...i.scores } }; save.d(); fillScoreForm(); go('#score'); },
  delItem(b) { const i = items.find((x) => x.id === b.dataset.id); if (i && confirm(`確定刪除「${i.name}」？`)) { items = items.filter((x) => x !== i); save.i(); renderList(); } },
  delAll() { if (items.length && confirm(`確定刪除全部 ${items.length} 件商品？建議先匯出備份。`)) { items = []; save.i(); renderList(); } },
  expItems() { download(`商品清單_${today()}.csv`, toCSV(items.map(flatItem), ITEM_COLS)); },
  // 設定
  checkConn,
  resetWeights() { S.weights = { ...DEF_W }; save.s(); renderSettings(); },
  clearAll() {
    if (!confirm('確定清除所有本機資料（商品清單與設定）？此動作無法復原，建議先匯出 CSV。')) return;
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
  if (t.matches('select[data-act="status"]')) { const i = items.find((x) => x.id === t.dataset.id); if (i) { i.status = t.value; save.i(); renderList(); } }
  else if (t.matches('[data-imp]') && t.files[0]) {
    try {
      const rows = await readTable(t.files[0]);
      if (isShopeeFile(rows)) { const r = importShopee(rows); toast(`蝦皮商品：新增 ${r.added} 件、更新 ${r.updated} 件`); }
      else toast(`已匯入 ${importItems(rows)} 筆`);
      if (location.hash !== '#list') location.hash = '#list'; else route();
    } catch (err) { toast(err?.message || '檔案讀取失敗'); }
    t.value = '';
  } else if (['listFilter', 'listSort'].includes(t.id)) renderList();
  else if (t.id === 'aiSrc') aiSrc = t.value;
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.closest('#fScore')) readScoreForm();
  else if (t.id === 'listQ') renderList();
  else if (t.id === 'setCode') { S.accessCode = t.value.trim(); save.s(); }
  else if (t.id === 'setKey') { S.ownKey = t.value.trim(); save.s(); }
  else if (t.dataset.sw) { S.weights[t.dataset.sw] = clamp(num(t.value), 0, 100); save.s(); wSum(); }
});

/* ========== 初始化 ========== */
$$('select[data-opt="platform"]').forEach((s) => { s.innerHTML = opts(PLATFORMS, 'fb'); });
$$('select[data-opt="format"]').forEach((s) => { s.innerHTML = FORMATS.map((f) => `<option>${esc(f)}</option>`).join(''); });
$('#listFilter').innerHTML = opts({ all: '全部狀態', ...STATUS }, 'all');
$('#listSort').innerHTML = opts(SORTS, 'rec');
$('#sliders').innerHTML = USER_DIMS.map((d) => `<fieldset class="seg"><legend>${esc(d.n)} <span class="w" data-w="${d.k}"></span></legend><p class="hint">${esc(d.q)}</p>
  <div class="segs">${[1, 2, 3, 4, 5].map((i) => `<label><input type="radio" name="s_${d.k}" value="${i}" aria-label="${esc(d.n)} ${i} 分"><span>${i}</span></label>`).join('')}</div></fieldset>`).join('');
fillScoreForm();
window.addEventListener('hashchange', route);
route();
