'use strict';
/* ========== 工具函式 ========== */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
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
const PLATFORMS = { reels: 'Instagram Reels', fb: 'Facebook Reels', shorts: 'YouTube Shorts', tiktok: 'TikTok', threads: 'Threads', shopee_video: '蝦皮短影音', other: '其他' };
const SRC_KEYS = Object.keys(PLATFORMS);
const SRC_SHORT = { reels: 'IG', fb: 'FB', shorts: 'YT', tiktok: 'TikTok', threads: 'Threads', shopee_video: '蝦皮', other: '其他' };
const FORMATS = ['開箱', '前後對比', '教學示範', '情境短劇', '清單推薦', '實測評比'];
const STATUS = { todo: '待拍', done: '已發布', drop: '淘汰' };
const DIMS = [
  { k: 'visual', n: '視覺展示力', s: '視覺', w: 18, q: '3 秒內能不能用畫面看懂效果？' },
  { k: 'pain', n: '痛點與需求強度', s: '痛點', w: 14, q: '觀眾是否已經在找解決方法？' },
  { k: 'trust', n: '銷量與評價信任度', s: '信任', w: 14, q: '評分、評價數、近期銷量是否足以建立信任？' },
  { k: 'topic', n: '話題性與季節性', s: '話題', w: 10, q: '現在是不是好時機（檔期、天氣、話題）？' },
  { k: 'risk', n: '退貨與客訴風險', s: '低風險', w: 10, q: '越安全分越高：尺寸、色差、功效爭議是否容易造成退貨？' },
  { k: 'fit', n: '平台契合度', s: '契合', w: 10, q: '這個商品適不適合選定的平台與形式？' },
  { k: 'price', n: '價格帶衝動度', s: '價格', w: 12, auto: 1 },
  { k: 'rate', n: '佣金吸引力', s: '佣金', w: 12, auto: 1 },
];
const USER_DIMS = DIMS.filter((d) => !d.auto);
const GRADE_ACT = { S: '主打，本週優先拍攝', A: '正式製作，穩定發片', B: '小量測試，用 A/B 鉤子驗證', C: '不建議投入製作時間' };
const ELIG = ['我是蝦皮用戶', '任一社群平台約有 300 位好友／追蹤', '已申請並通過蝦皮分潤審核', '已備妥收款與勞報單資料', '了解貼文需揭露含分潤連結'];

/* ========== 狀態（localStorage） ========== */
const DEF_W = Object.fromEntries(DIMS.map((d) => [d.k, d.w]));
const DEF_HEAT = { best: 0.5, days: 0.3, cover: 0.2 };
const _s = store.get('settings', {});
const S = { accessCode: '', ownKey: '', sources: ['reels', 'fb', 'shorts', 'tiktok'], ..._s, weights: { ...DEF_W, ..._s.weights }, heat: { ...DEF_HEAT, ..._s.heat }, alias: { ..._s.alias } };
const blankDraft = () => ({ id: '', name: '', category: '', price: '', base: '', xtra: '', platform: 'reels', format: FORMATS[0], scores: Object.fromEntries(USER_DIMS.map((d) => [d.k, 3])) });
let draft = { ...blankDraft(), ...store.get('draft', {}) };
const DEF_CALC = { price: 399, base: 6, xtra: 2, cap: '', valid: 85, views: 5000, videos: 12, ctr: 1.5, cvr: 3, hours: 2.5, target: 10000 };
let calc = { ...DEF_CALC, ...store.get('calc', {}) };
let items = store.get('items', []);
let ranks = store.get('ranks', []);
const save = { s: () => store.set('settings', S), i: () => store.set('items', items), r: () => store.set('ranks', ranks), d: () => store.set('draft', draft), c: () => store.set('calc', calc) };

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
const expOf = (p) => num(p.price) * (num(p.base) + num(p.xtra)) / 100 * num(calc.valid) / 100;
function calcOf(c, o = {}) {
  const r = (num(c.base) + num(c.xtra)) / 100, cap = num(c.cap);
  let per = num(c.price) * r; if (cap > 0) per = Math.min(per, cap);
  const exp = per * num(c.valid) / 100;
  const ctr = (o.ctr ?? num(c.ctr)) / 100, cvr = (o.cvr ?? num(c.cvr)) / 100, n = num(c.videos);
  const mv = num(c.views) * (o.mult ?? 1) * n, orders = mv * ctr * cvr, rev = orders * exp, hrs = n * num(c.hours);
  const need = exp && ctr && cvr ? num(c.target) / (ctr * cvr * exp) : Infinity;
  return { exp, orders, rev, mv, rpm: mv ? (rev / mv) * 1000 : 0, hourly: hrs ? rev / hrs : 0, need, needPer: n ? need / n : Infinity };
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
function scatter(arr) {
  if (!arr.length) return '';
  const W = 600, H = 260, m = { l: 46, r: 14, t: 12, b: 36 };
  const ymax = Math.max(10, ...arr.map(expOf)) * 1.1;
  const X = (v) => m.l + (v / 100) * (W - m.l - m.r), Y = (v) => H - m.b - (v / ymax) * (H - m.t - m.b);
  let g = '';
  for (const x of [0, 25, 50, 75, 100]) g += `<line class="gl" x1="${X(x)}" y1="${m.t}" x2="${X(x)}" y2="${H - m.b}"/><text x="${X(x)}" y="${H - m.b + 16}" text-anchor="middle">${x}</text>`;
  for (const x of [50, 65, 80]) g += `<line class="gd" x1="${X(x)}" y1="${m.t}" x2="${X(x)}" y2="${H - m.b}"/>`;
  for (let i = 0; i <= 4; i++) { const v = (ymax * i) / 4; g += `<line class="gl" x1="${m.l}" y1="${Y(v)}" x2="${W - m.r}" y2="${Y(v)}"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
  g += `<text x="${(W + m.l) / 2}" y="${H - 4}" text-anchor="middle">分數</text>`;
  for (const i of arr) g += `<circle class="pt p${i.grade}" cx="${X(i.total).toFixed(1)}" cy="${Y(expOf(i)).toFixed(1)}" r="7"><title>${esc(i.name)}｜${fmt(i.total, 1)} 分｜單筆 ${fmt(expOf(i), 1)} 元</title></circle>`;
  return `<figure class="card"><figcaption>分數 × 單筆期望佣金（元）</figcaption><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="散佈圖：${arr.length} 件商品，橫軸分數、縱軸單筆期望佣金。${esc(arr.map((i) => `${i.name} ${fmt(i.total, 1)} 分 ${fmt(expOf(i), 1)} 元`).join('；'))}">${g}</svg></figure>`;
}
function rankChart(rs) {
  const dates = [...new Set(rs.map((r) => r.date))].sort().slice(-30);
  const rs2 = rs.filter((r) => dates.includes(r.date));
  const maxR = Math.max(5, ...rs2.map((r) => num(r.rank)));
  const W = 600, H = 220, m = { l: 40, r: 14, t: 14, b: 30 };
  const X = (i) => m.l + (dates.length > 1 ? i / (dates.length - 1) : 0.5) * (W - m.l - m.r), Y = (v) => m.t + ((v - 1) / (maxR - 1)) * (H - m.t - m.b);
  let g = '';
  for (const v of [...new Set([1, Math.round((maxR + 1) / 2), maxR])]) g += `<line class="gl" x1="${m.l}" y1="${Y(v)}" x2="${W - m.r}" y2="${Y(v)}"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">#${v}</text>`;
  const xl = dates.length > 2 ? [0, Math.floor(dates.length / 2), dates.length - 1] : dates.map((_, i) => i);
  for (const i of xl) g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${dates[i].slice(5)}</text>`;
  const srcs = [...new Set(rs2.map((r) => r.source))];
  for (const s of srcs) {
    const c = 's' + Math.max(0, SRC_KEYS.indexOf(s));
    const pts = dates.map((d, j) => { const v = rs2.filter((r) => r.date === d && r.source === s).map((r) => num(r.rank)); return v.length ? [X(j), Y(Math.min(...v)), d, Math.min(...v)] : null; }).filter(Boolean);
    if (pts.length > 1) g += `<polyline class="ln ${c}" points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`;
    g += pts.map((p) => `<circle class="${c}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4"><title>${esc(PLATFORMS[s] || s)} ${p[2]}：#${p[3]}</title></circle>`).join('');
  }
  const legend = srcs.map((s) => `<span class="s${Math.max(0, SRC_KEYS.indexOf(s))}"><i></i>${esc(PLATFORMS[s] || s)}</span>`).join('');
  const alt = rs2.map((r) => `${r.date} ${PLATFORMS[r.source] || r.source} 第 ${r.rank} 名`).join('；');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="名次走勢（越上方名次越前）：${esc(alt)}">${g}</svg><div class="legend">${legend}</div>`;
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
function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  store.set('lastBackup', Date.now());
}
const ITEM_COLS = ['id', 'name', 'category', 'price', 'base', 'xtra', 'platform', 'format', ...USER_DIMS.map((d) => d.k), 'total', 'grade', 'status', 'note', 'views', 'clicks', 'orders', 'commission', 'createdAt'];
const RANK_COLS = ['id', 'date', 'source', 'listName', 'listSize', 'rank', 'productName', 'productKey', 'price', 'url', 'note'];
const flatItem = (i) => ({ ...i, ...i.scores, ...(i.actual || {}) });
function importItems(rows) {
  let n = 0;
  for (const r of rows) {
    if (!r.name) continue;
    const it = makeItem({ ...r, scores: Object.fromEntries(USER_DIMS.map((d) => [d.k, clamp(Math.round(num(r[d.k])) || 3, 1, 5)])) });
    it.id = r.id || it.id; it.status = STATUS[r.status] ? r.status : 'todo'; it.note = String(r.note || '').slice(0, 500);
    it.actual = { views: r.views || '', clicks: r.clicks || '', orders: r.orders || '', commission: r.commission || '' };
    it.createdAt = r.createdAt || it.createdAt;
    const ix = items.findIndex((x) => x.id === it.id); if (ix >= 0) items[ix] = it; else items.push(it); n++;
  }
  save.i(); return n;
}
function importRanks(rows) {
  let n = 0; const ids = new Set(ranks.map((r) => r.id));
  for (const r of rows) {
    const rank = parseInt(r.rank, 10), name = String(r.productName || '').trim().slice(0, 120);
    if (!(rank >= 1) || !name || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const id = r.id || uid(); if (ids.has(id)) continue; ids.add(id);
    ranks.push({ id, date: r.date, source: SRC_KEYS.includes(r.source) ? r.source : 'other', listName: String(r.listName || '').slice(0, 60), listSize: parseInt(r.listSize, 10) || 20, rank, productName: name, productKey: r.productKey ? keyOf(r.productKey) : keyOf(name), price: r.price === '' ? '' : num(r.price), url: safeUrl(r.url), note: String(r.note || '').slice(0, 200) });
    n++;
  }
  save.r(); return n;
}

/* ========== 路由 ========== */
const VIEWS = ['home', 'rank', 'score', 'calc', 'ai', 'list', 'settings'];
const RENDER = { home: renderHome, rank: renderRank, score: renderScoreOut, calc: renderCalc, ai: renderAI, list: renderList, settings: renderSettings };
function route() {
  let v = location.hash.slice(1); if (!VIEWS.includes(v)) v = 'home';
  $$('.view').forEach((s) => { s.hidden = s.id !== 'v-' + v; });
  $$('[data-v]').forEach((a) => { const on = a.dataset.v === v; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  RENDER[v]();
  window.scrollTo(0, 0);
  $(`#v-${v} h1`)?.focus({ preventScroll: true });
}

/* ========== M1 總覽 ========== */
function renderHome() {
  const act = items.filter((i) => i.status !== 'drop');
  const avg = act.length ? act.reduce((s, i) => s + i.total, 0) / act.length : 0;
  const top = [...act].sort((a, b) => b.total - a.total)[0];
  $('#homeStats').innerHTML = stat('候選商品', act.length + ' 件') + stat('平均分數', act.length ? fmt(avg, 1) : '—')
    + stat('最高分商品', top ? esc(top.name) : '—', top ? `${top.grade}・${fmt(top.total, 1)} 分` : '') + stat('排行紀錄', ranks.length + ' 筆');
  const last = store.get('lastBackup', 0);
  $('#backupNote').innerHTML = (items.length || ranks.length) && Date.now() - last > 14 * 864e5
    ? `<div class="card warn">已超過 14 天沒有備份，建議到「<a href="#settings">設定</a>」匯出 CSV。</div>` : '';
  const dates = [...new Set(ranks.map((r) => r.date))].sort(), D = dates.at(-1);
  if (!D) { $('#homeHot').innerHTML = '<p class="muted">尚無排行紀錄。到「<a href="#rank">商品排行</a>」記錄你觀察到的熱門商品。</p>'; }
  else {
    const st = rankStats(D), names = latestNames();
    const hot = Object.entries(st).sort((a, b) => b[1].heat - a[1].heat).slice(0, 5);
    $('#homeHot').innerHTML = `<p class="hint">以 ${D} 為基準</p><ol>${hot.map(([k, s]) => `<li><button type="button" class="link" data-act="rkGo" data-k="${esc(k)}">${esc(names[k])}</button> 熱度 <b>${s.heat}</b>${s.C >= 2 ? ' <span class="tag hot">跨平台熱門</span>' : ''}</li>`).join('')}</ol>`;
  }
  const el = store.get('elig', {});
  $('#elig').innerHTML = ELIG.map((t, i) => `<label><input type="checkbox" data-elig="${i}"${el[i] ? ' checked' : ''}>${esc(t)}</label>`).join('');
  const sv = store.get('survey', null);
  $('#survey').innerHTML = ['是', '普通', '否'].map((a) => `<button type="button" data-act="survey" data-a="${a}"${sv?.a === a ? ' class="pri"' : ''}>${a}</button>`).join('') + (sv ? `<span class="hint">已回答（${new Date(sv.at).toLocaleDateString('zh-TW')}）</span>` : '');
}

/* ========== M2 選品評分 ========== */
const SCORE_F = ['name', 'category', 'price', 'base', 'xtra', 'platform', 'format'];
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
function rankHint(name) {
  if (!name) return null;
  const k = keyOf(name), D = today(), d7 = addDays(D, -6);
  const src = new Set(ranks.filter((r) => r.productKey === k && r.date >= d7 && r.date <= D).map((r) => r.source));
  return src.size ? { n: src.size, suggest: src.size >= 2 ? 5 : 4 } : null;
}
function renderScoreOut() {
  const r = scoreOf(draft);
  $('#scoreOut').innerHTML = `<div class="big"><span class="num">${fmt(r.total, 1)}</span><span class="grade g${r.grade}" aria-label="分級 ${r.grade}">${r.grade}</span></div>
  <p class="act">${GRADE_ACT[r.grade]}</p>
  ${radar(DIMS.map((d) => r.v[d.k]), DIMS.map((d) => d.s))}
  <ul class="kv">
    <li><span>價格帶衝動度（自動）</span><b>${r.v.price} 分</b></li>
    <li><span>佣金吸引力（自動，總佣金率 ${fmt(num(draft.base) + num(draft.xtra), 1)}%）</span><b>${r.v.rate} 分</b></li>
    <li><span>單筆期望佣金（有效訂單率 ${fmt(num(calc.valid))}%）</span><b>${fmt(expOf(draft), 1)} 元</b></li>
  </ul>
  ${r.total < 50 ? '<p class="warn">分數低於 50，建議先不投入製作時間。</p>' : ''}`;
  $('#btnAddList').textContent = draft.id && items.some((i) => i.id === draft.id) ? '更新清單項目' : '加入候選清單';
  const h = rankHint(draft.name);
  $('#topicHint').innerHTML = h ? `近 7 日在 ${h.n} 個榜單來源上榜，建議 ${h.suggest} 分<button type="button" data-act="applyTopic" data-v="${h.suggest}">套用</button>` : '';
  $$('#sliders [data-w]').forEach((e) => { e.textContent = `權重 ${S.weights[e.dataset.w]}`; });
}
function makeItem(p) {
  const r = scoreOf(p);
  return { id: p.id || uid(), name: String(p.name).trim().slice(0, 120), category: String(p.category || '').slice(0, 40), price: num(p.price), base: num(p.base), xtra: num(p.xtra), rate: num(p.base) + num(p.xtra), platform: PLATFORMS[p.platform] ? p.platform : 'other', format: String(p.format || '').slice(0, 20), scores: { ...p.scores }, total: r.total, grade: r.grade, status: 'todo', note: '', actual: { views: '', clicks: '', orders: '', commission: '' }, createdAt: new Date().toISOString() };
}

/* ========== M3 佣金試算 ========== */
const CALC_F = Object.keys(DEF_CALC);
function fillCalcForm() { const f = $('#fCalc'); for (const k of CALC_F) f.elements[k].value = calc[k]; }
function actualRates() {
  let v = 0, c = 0, o = 0, n = 0;
  for (const i of items) { const a = i.actual || {}; if (num(a.views) > 0 && num(a.clicks) > 0) { v += num(a.views); c += num(a.clicks); o += num(a.orders); n++; } }
  return n ? { ctr: (c / v) * 100, cvr: (o / c) * 100, n } : null;
}
function renderCalc() {
  const c = calcOf(calc);
  const now = new Date(), pay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const sc = [['保守', 0.5], ['基準', 1], ['樂觀', 2]].map(([n, m]) => { const x = calcOf(calc, { mult: m }); return `<tr><td>${n}（曝光 ${m}×）</td><td>${fmt(x.mv)}</td><td>${fmt(x.orders)}</td><td><b>${fmt(x.rev)}</b></td><td>${fmt(x.hourly)}</td></tr>`; }).join('');
  const CT = [0.5, 1, 2, 3, 5], CV = [1, 2, 4, 6, 8];
  const grid = CV.map((cv) => CT.map((ct) => calcOf(calc, { ctr: ct, cvr: cv }).rev));
  const mx = Math.max(1, ...grid.flat());
  const heat = `<div class="tw"><table class="heat"><caption class="hint">月收益（元）；列為 CVR、欄為 CTR</caption><thead><tr><th>CVR＼CTR</th>${CT.map((x) => `<th>${x}%</th>`).join('')}</tr></thead><tbody>${grid.map((row, i) => `<tr><th>${CV[i]}%</th>${row.map((v) => `<td class="h${Math.min(4, Math.floor((v / mx) * 4.999))}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#calcOut').innerHTML = `<div class="stats">
    ${stat('單筆期望佣金', fmt(c.exp, 1) + ' 元')}${stat('月訂單', fmt(c.orders) + ' 筆')}${stat('月收益', fmt(c.rev) + ' 元', '', 'hl')}
    ${stat('每千次曝光收益', fmt(c.rpm, 1) + ' 元')}${stat('時薪', fmt(c.hourly) + ' 元')}${stat('達標月曝光', Number.isFinite(c.need) ? fmt(c.need) : '—', Number.isFinite(c.needPer) ? `約每支 ${fmt(c.needPer)} 觀看` : '')}
  </div>
  <div class="card"><h2>情境分析</h2><div class="tw"><table><thead><tr><th>情境</th><th>月曝光</th><th>月訂單</th><th>月收益</th><th>時薪</th></tr></thead><tbody>${sc}</tbody></table></div></div>
  <div class="card"><h2>CTR × CVR 敏感度</h2>${heat}</div>
  <p class="hint">現金流提醒：本月成交的分潤，約於 ${pay.getFullYear()}/${pay.getMonth() + 1}/${pay.getDate()} 前後寄出對帳單，回傳勞報單後才付款；審核前金額僅為估算。</p>`;
  const a = actualRates();
  $('#calib').innerHTML = a ? `<p class="hint">清單實際成效（${a.n} 件）：CTR ${fmt(a.ctr, 2)}%、CVR ${fmt(a.cvr, 2)}% <button type="button" data-act="applyActual">用實際值取代假設</button></p>` : '';
}

/* ========== M4/M5/M6/M8 AI ========== */
let aiTab = 'analyze', aiSrc = 'draft';
function renderAI() {
  $$('#v-ai [data-act="aiTab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === aiTab)));
  $$('#v-ai .panel').forEach((p) => { p.hidden = p.dataset.p !== aiTab; });
  const dn = draft.name ? `目前評分中：${draft.name}` : '目前評分中的商品（尚未輸入）';
  $('#aiSrc').innerHTML = `<option value="draft">${esc(dn)}</option>` + items.map((i) => `<option value="${esc(i.id)}">清單：${esc(i.name)}（${i.grade}）</option>`).join('');
  $('#aiSrc').value = items.some((i) => i.id === aiSrc) ? aiSrc : 'draft';
  const c = pfItems();
  $('#pfInfo').textContent = c.length ? `將送出 ${c.length} 件候選商品（優先「待拍」，依分數取前 20）。` : '候選清單是空的，請先加入商品。';
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
    const script = Array.isArray(o.script) ? o.script : [];
    h = `<p class="verdict">${esc(o.verdict)}</p>
    <div class="grid2"><div><h3>優勢</h3>${L(o.strengths)}</div><div><h3>風險</h3>${L(o.risks)}</div></div>
    <h3>開場鉤子</h3>${L(o.hooks)}
    <h3>分鏡腳本</h3><div class="tw"><table><thead><tr><th>時間</th><th>畫面</th><th>口播</th></tr></thead><tbody>${script.map((s) => `<tr><td>${esc(s?.time)}</td><td>${esc(s?.visual)}</td><td>${esc(s?.voice)}</td></tr>`).join('')}</tbody></table></div>
    <h3>CTA</h3><p>${esc(o.cta)}</p>
    <h3>標籤</h3><p>${esc((Array.isArray(o.hashtags) ? o.hashtags : []).join(' '))}</p>
    <h3>A/B 測試建議</h3>${L(o.tests)}<h3>合規提醒</h3>${L(o.compliance)}`;
    const ls = (a) => (Array.isArray(a) ? a.map((x) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : '');
    t = `【${p.name}】${o.verdict || ''}\n\n優勢\n${ls(o.strengths)}\n\n風險\n${ls(o.risks)}\n\n開場鉤子\n${ls(o.hooks)}\n\n分鏡腳本\n${script.map((s) => `${s?.time}｜${s?.visual}｜${s?.voice}`).join('\n')}\n\nCTA：${o.cta || ''}\n標籤：${(o.hashtags || []).join(' ')}\n\nA/B 測試\n${ls(o.tests)}\n\n合規提醒\n${ls(o.compliance)}\n\nSub_id：${sub}`;
  } else { h = `<div class="md">${md(j.text)}</div>`; t = j.text + `\n\nSub_id：${sub}`; }
  h += `<h3>建議 Sub_id</h3><p><code>${esc(sub)}</code> <span class="hint">（平台_日期_商品代碼，貼到自定義連結的 Sub_id 欄）</span></p>`;
  return outCard('analyze', h, j, t);
}
function pfItems() {
  const pool = items.filter((i) => i.status === 'todo');
  return (pool.length ? pool : items.filter((i) => i.status !== 'drop')).sort((a, b) => b.total - a.total).slice(0, 20);
}

/* ========== M7 候選清單 ========== */
function renderList() {
  const f = $('#listFilter').value;
  const arr = items.filter((i) => f === 'all' || i.status === f).sort((a, b) => b.total - a.total);
  $('#listCount').textContent = `共 ${items.length} 件`;
  $('#scatter').innerHTML = scatter(items.filter((i) => i.status !== 'drop'));
  $('#listBody').innerHTML = arr.length ? `<table class="rt"><thead><tr><th>商品</th><th>分數</th><th>價格</th><th>單筆佣金</th><th>平台</th><th>狀態</th><th>實際成效</th><th>操作</th></tr></thead><tbody>${arr.map((i) => {
    const a = i.actual || {};
    return `<tr><td data-l="商品"><div><b>${esc(i.name)}</b>${i.note ? `<div class="muted sm">${esc(i.note)}</div>` : ''}</div></td>
    <td data-l="分數"><span><span class="grade g${i.grade}">${i.grade}</span> ${fmt(i.total, 1)}</span></td>
    <td data-l="價格">${fmt(num(i.price))} 元</td><td data-l="單筆佣金">${fmt(expOf(i), 1)} 元</td>
    <td data-l="平台">${esc(PLATFORMS[i.platform] || i.platform)}</td>
    <td data-l="狀態"><select data-act="status" data-id="${esc(i.id)}" aria-label="${esc(i.name)} 狀態">${opts(STATUS, i.status)}</select></td>
    <td data-l="實際成效">${a.views !== '' && a.views != null ? `${fmt(num(a.views))} 觀看／${fmt(num(a.orders))} 單／${fmt(num(a.commission))} 元` : '—'}</td>
    <td data-l="操作" class="acts"><button type="button" data-act="editItem" data-id="${esc(i.id)}">編輯／回填</button><button type="button" data-act="itemToScore" data-id="${esc(i.id)}">重新評分</button><button type="button" class="danger" data-act="delItem" data-id="${esc(i.id)}">刪除</button></td></tr>`;
  }).join('')}</tbody></table>` : '<p class="empty">尚無候選商品，先到「<a href="#score">評分</a>」加入。</p>';
}
function editItem(id) {
  const i = items.find((x) => x.id === id); if (!i) return;
  const a = i.actual || {}, d = $('#dlg');
  const nf = (n, l) => `<label>${l}<input name="${n}" type="number" inputmode="decimal" min="0" value="${esc(a[n])}"></label>`;
  d.innerHTML = `<form method="dialog" id="fEdit"><h2>${esc(i.name)}</h2>
    <label>狀態<select name="status">${opts(STATUS, i.status)}</select></label>
    <label>備註<textarea name="note" rows="3" maxlength="500">${esc(i.note)}</textarea></label>
    <h3>實際成效回填（復盤）</h3><div class="row2">${nf('views', '觀看')}${nf('clicks', '點擊')}${nf('orders', '訂單')}${nf('commission', '佣金（元）')}</div>
    <p class="hint">填入觀看與點擊後，試算頁可改用實際 CTR、CVR。</p>
    <div class="btns"><button value="cancel" formnovalidate>取消</button><button value="ok" class="pri">儲存</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const f = new FormData($('#fEdit'));
    i.status = STATUS[f.get('status')] ? f.get('status') : i.status; i.note = String(f.get('note')).slice(0, 500);
    i.actual = Object.fromEntries(['views', 'clicks', 'orders', 'commission'].map((k) => [k, f.get(k)]));
    save.i(); renderList(); toast('已儲存');
  };
  d.showModal();
}

/* ========== M10 商品排行榜 ========== */
const rk = { src: 'all', date: null, sel: null, preview: [] };
const rankScore = (r) => { const N = Math.max(1, num(r.listSize) || 20); return clamp((N + 1 - num(r.rank)) / N, 0, 1); };
function latestNames() { const o = {}; for (const r of [...ranks].sort((a, b) => (a.date < b.date ? -1 : 1))) o[r.productKey] = r.productName; return o; }
function rankStats(D, inSrc = () => true) {
  const d7 = addDays(D, -6), d14 = addDays(D, -13), by = {};
  for (const r of ranks) if (r.date <= D && r.date >= d14) (by[r.productKey] ??= []).push(r);
  const en = S.sources, K = Math.max(1, en.length), hw = S.heat, hs = num(hw.best) + num(hw.days) + num(hw.cover) || 1, out = {};
  for (const [k, rs] of Object.entries(by)) {
    const r7 = rs.filter((r) => r.date >= d7), best = r7.length ? Math.max(...r7.map(rankScore)) : 0;
    const dset = new Set(rs.map((r) => r.date)), src = new Set(r7.map((r) => r.source)), C = [...src].filter((s) => en.includes(s)).length;
    let streak = 0; for (let d = D; dset.has(d); d = addDays(d, -1)) streak++;
    const ser = {}; for (const r of r7) if (inSrc(r)) ser[r.date] = Math.min(ser[r.date] ?? 1e9, num(r.rank));
    const sd = Object.keys(ser).sort();
    out[k] = { days: dset.size, streak, src, C, change: sd.length > 1 ? ser[sd[0]] - ser[sd.at(-1)] : 0,
      heat: Math.round((100 * (num(hw.best) * best + num(hw.days) * dset.size / 14 + num(hw.cover) * Math.min(1, C / K))) / hs) };
  }
  return out;
}
function renderRank() {
  const dates = [...new Set(ranks.map((r) => r.date))].sort();
  if (!rk.date) rk.date = dates.at(-1) || today();
  $('#rkDate').value = rk.date;
  const meta = $('#fRankMeta'); if (!meta.date.value) meta.date.value = today();
  $('#rkTabs').innerHTML = [['all', '全部'], ...SRC_KEYS.map((k) => [k, PLATFORMS[k]])].map(([k, v]) => `<button type="button" role="tab" data-act="rkTab" data-s="${k}" aria-selected="${rk.src === k}">${esc(v)}</button>`).join('');
  $('#rkChips').innerHTML = dates.slice(-6).reverse().map((d) => `<button type="button" data-act="rkDay" data-d="${d}"${d === rk.date ? ' class="pri"' : ''}>${d.slice(5)}</button>`).join('');
  const D = rk.date, inSrc = (r) => rk.src === 'all' || r.source === rk.src;
  const day = ranks.filter((r) => r.date === D && inSrc(r));
  const st = rankStats(D, inSrc);
  const prev = dates.filter((d) => d < D && ranks.some((r) => r.date === d && inSrc(r))).at(-1);
  const prevKeys = new Set(ranks.filter((r) => r.date === prev && inSrc(r)).map((r) => r.productKey));
  const groups = {};
  for (const r of day) { const g = (groups[r.productKey] ??= { r, src: new Set() }); g.src.add(r.source); if (num(r.rank) < num(g.r.rank)) g.r = r; }
  const rows = Object.entries(groups).map(([k, g]) => ({ k, ...g, st: st[k] }))
    .sort((a, b) => (rk.src === 'all' ? b.st.heat - a.st.heat || a.r.rank - b.r.rank : a.r.rank - b.r.rank));
  $('#rkTable').innerHTML = rows.length ? `<table class="rt"><thead><tr><th>名次</th><th>商品</th><th>變動（7 日）</th><th>上榜天數（14 日）</th><th>來源</th><th>熱度</th><th>操作</th></tr></thead><tbody>${rows.map(({ k, r, src, st: s }) => {
    const chg = s.change > 0 ? `<span class="up">▲${s.change}</span>` : s.change < 0 ? `<span class="down">▼${-s.change}</span>` : '–';
    const badges = (s.C >= 2 ? '<span class="tag hot">跨平台熱門</span>' : '') + (prev && !prevKeys.has(k) ? '<span class="tag new">新進榜</span>' : '');
    const u = safeUrl(r.url);
    return `<tr><td data-l="名次">${rk.src === 'all' ? '最佳 ' : ''}#${esc(r.rank)}</td>
    <td data-l="商品"><div><button type="button" class="link" data-act="rkSel" data-k="${esc(k)}">${esc(r.productName)}</button>${r.price !== '' && r.price != null ? ` <span class="muted sm">${fmt(num(r.price))} 元</span>` : ''}${u ? ` <a class="sm" href="${esc(u)}" target="_blank" rel="noopener noreferrer">連結</a>` : ''}<div>${badges}</div></div></td>
    <td data-l="變動">${chg}</td><td data-l="上榜天數">${s.days} 天（連續 ${s.streak}）</td>
    <td data-l="來源"><span>${[...src].map((x) => `<span class="tag" title="${esc(r.listName)}">${esc(SRC_SHORT[x] || x)}</span>`).join('')}</span></td>
    <td data-l="熱度"><b>${s.heat}</b></td>
    <td data-l="操作" class="acts"><button type="button" data-act="rkScore" data-k="${esc(k)}">送去評分</button><button type="button" data-act="rkList" data-k="${esc(k)}">加入清單</button>${rk.src !== 'all' ? `<button type="button" class="danger" data-act="rkDel" data-id="${esc(r.id)}">刪除</button>` : ''}</td></tr>`;
  }).join('')}</tbody></table>` : `<p class="empty">${esc(D)} 在此來源沒有紀錄。${dates.length ? '點上方日期切換，或' : ''}在下方新增。</p>`;
  renderRankDetail();
}
function renderRankDetail() {
  const el = $('#rkDetail'), k = rk.sel;
  const rs = k ? ranks.filter((r) => r.productKey === k).sort((a, b) => (a.date < b.date ? -1 : 1)) : [];
  if (!rs.length) { rk.sel = null; el.innerHTML = ''; return; }
  const names = latestNames();
  const others = Object.keys(names).filter((x) => x !== k).sort((a, b) => names[a].localeCompare(names[b], 'zh-Hant'));
  el.innerHTML = `<div class="card"><div class="toolbar"><h2 class="grow">${esc(rs.at(-1).productName)}｜名次走勢</h2><button type="button" data-act="rkClose">關閉</button></div>
  ${rankChart(rs)}
  <p class="hint">共 ${rs.length} 筆紀錄；寫法：${esc([...new Set(rs.map((r) => r.productName))].join('、'))}</p>
  ${others.length ? `<div class="toolbar"><label class="inline">合併到<select id="rkMerge">${others.map((o) => `<option value="${esc(o)}">${esc(names[o])}</option>`).join('')}</select></label><button type="button" data-act="rkMerge">合併為同一商品</button></div>` : ''}</div>`;
}
function rankMeta() {
  const f = $('#fRankMeta');
  return { date: /^\d{4}-\d{2}-\d{2}$/.test(f.date.value) ? f.date.value : today(), source: f.source.value, listName: f.listName.value.trim().slice(0, 60), listSize: clamp(parseInt(f.listSize.value, 10) || 20, 1, 200) };
}
function addRank(x, m) {
  const name = String(x.productName || '').trim().slice(0, 120), rank = parseInt(x.rank, 10);
  if (!name || !(rank >= 1)) return false;
  ranks.push({ id: uid(), ...m, rank, productName: name, productKey: keyOf(name), price: x.price === '' || x.price == null ? '' : num(x.price), url: safeUrl(x.url), note: String(x.note || '').slice(0, 200) });
  return true;
}
function renderPreview() {
  const el = $('#rkPreview');
  if (!rk.preview.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h3>AI 解析預覽（確認後才寫入）</h3><div class="tw"><table class="pv"><thead><tr><th>名次</th><th>商品名稱</th><th>價格</th><th></th></tr></thead><tbody>${rk.preview.map((p, i) => `<tr>
    <td><input aria-label="名次" type="number" min="1" inputmode="numeric" data-pv="${i}" data-f="rank" value="${esc(p.rank)}"></td>
    <td><input aria-label="商品名稱" maxlength="120" data-pv="${i}" data-f="productName" value="${esc(p.productName)}"></td>
    <td><input aria-label="價格" type="number" min="0" inputmode="decimal" data-pv="${i}" data-f="price" value="${esc(p.price)}"></td>
    <td><button type="button" class="danger" data-act="pvDel" data-i="${i}" aria-label="刪除此列">✕</button></td></tr>`).join('')}</tbody></table></div>
  <p class="hint">將寫入：${esc(rankMeta().date)}｜${esc(PLATFORMS[rankMeta().source])}${rankMeta().listName ? '｜' + esc(rankMeta().listName) : ''}（可在上方榜單資訊修改）</p>
  <div class="btns"><button type="button" class="pri" data-act="pvSave">全部寫入（${rk.preview.length} 筆）</button><button type="button" data-act="pvCancel">取消</button></div>`;
}
function setPreview(j) {
  const list = Array.isArray(j.json?.items) ? j.json.items : null;
  if (!list) { $('#rkPreview').innerHTML = `<p class="err">AI 回傳格式無法解析，原文如下：</p><div class="md">${md(j.text)}</div>`; return; }
  rk.preview = list.slice(0, 50).map((x, i) => ({ rank: parseInt(x?.rank, 10) || i + 1, productName: String(x?.productName ?? '').slice(0, 120), price: Number.isFinite(Number(x?.price)) && x?.price !== null && x?.price !== '' ? Number(x.price) : '' }));
  renderPreview();
  if (!rk.preview.length) $('#rkPreview').innerHTML = '<p class="muted">AI 沒有找到排行資料。</p>';
}
async function compress(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('無法讀取圖片')); i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    let q = 0.85, data;
    do { data = cv.toDataURL('image/jpeg', q).split(',')[1]; q -= 0.15; } while (data.length * 0.75 > 1.5e6 && q > 0.2);
    return { mime: 'image/jpeg', data };
  } finally { URL.revokeObjectURL(url); }
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
  $('#setHeat').innerHTML = [['best', '最佳名次分'], ['days', '上榜天數'], ['cover', '跨平台覆蓋']].map(([k, l]) => `<label>${l}<input type="number" min="0" max="1" step="0.05" inputmode="decimal" data-sh="${k}" value="${esc(S.heat[k])}"></label>`).join('');
  $('#setSrc').innerHTML = SRC_KEYS.map((k) => `<label><input type="checkbox" data-ss="${k}"${S.sources.includes(k) ? ' checked' : ''}>${esc(PLATFORMS[k])}</label>`).join('');
  wSum(); checkConn();
}
function wSum() { const t = DIMS.reduce((s, d) => s + num(S.weights[d.k]), 0); $('#wSum').textContent = `權重合計 ${fmt(t)}${t === 100 ? '' : '（不是 100 時會自動按比例換算）'}`; }

/* ========== 事件 ========== */
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };
const ACT = {
  // 評分
  toCalc() { readScoreForm(); Object.assign(calc, { price: num(draft.price), base: num(draft.base), xtra: num(draft.xtra) }); save.c(); fillCalcForm(); go('#calc'); },
  toAI() { readScoreForm(); aiSrc = 'draft'; aiTab = 'analyze'; go('#ai'); },
  addList() {
    readScoreForm();
    if (!draft.name.trim()) { toast('請先輸入商品名稱'); $('#fScore').elements.name.focus(); return; }
    const ix = items.findIndex((i) => i.id === draft.id);
    const it = makeItem(draft);
    if (ix >= 0) { const o = items[ix]; items[ix] = { ...it, status: o.status, note: o.note, actual: o.actual, createdAt: o.createdAt }; toast('已更新清單項目'); }
    else { items.push(it); draft.id = it.id; save.d(); toast('已加入候選清單'); }
    save.i(); renderScoreOut();
  },
  resetDraft() { draft = blankDraft(); save.d(); fillScoreForm(); },
  applyTopic(b) { draft.scores.topic = +b.dataset.v; save.d(); fillScoreForm(); },
  // 試算
  applyActual() { const a = actualRates(); if (!a) return; calc.ctr = +a.ctr.toFixed(2); calc.cvr = +a.cvr.toFixed(2); save.c(); fillCalcForm(); renderCalc(); toast('已套用實際 CTR、CVR'); },
  // AI
  aiTab(b) { aiTab = b.dataset.t; renderAI(); },
  async runAnalyze(b) {
    aiSrc = $('#aiSrc').value; const p = analyzeTarget(), el = $('#out-analyze');
    if (!String(p.name || '').trim()) { toast('請先在「評分」輸入商品，或選擇清單商品'); return; }
    loading(el);
    try { const j = await ai('analyze', { name: p.name, category: p.category, price: num(p.price), rate: num(p.base) + num(p.xtra), platform: p.platform, format: p.format, scores: p.scores, total: p.total, grade: p.grade }, b); el.innerHTML = renderAnalyze(j, p); }
    catch (e) { showErr(el, e); }
  },
  fillPlan() { const t = items.filter((i) => i.status === 'todo').sort((a, b) => b.total - a.total).slice(0, 20); $('#fPlan').elements.products.value = t.map((i) => i.name).join('\n'); if (!t.length) toast('清單沒有「待拍」商品'); },
  async runPortfolio(b) {
    const c = pfItems(), el = $('#out-portfolio');
    if (!c.length) { toast('候選清單是空的'); return; }
    loading(el);
    try { const j = await ai('portfolio', { items: c.map((i) => ({ name: i.name, price: i.price, rate: i.base + i.xtra, total: i.total, grade: i.grade, exp: +expOf(i).toFixed(1), platform: i.platform })) }, b); el.innerHTML = outCard('portfolio', `<div class="md">${md(j.text)}</div>`, j, j.text); }
    catch (e) { showErr(el, e); }
  },
  copy(b) { copy(outText[b.dataset.k] || ''); },
  // 清單
  editItem(b) { editItem(b.dataset.id); },
  itemToScore(b) { const i = items.find((x) => x.id === b.dataset.id); if (!i) return; draft = { ...blankDraft(), ...i, price: i.price, base: i.base, xtra: i.xtra, scores: { ...blankDraft().scores, ...i.scores } }; save.d(); fillScoreForm(); go('#score'); },
  delItem(b) { const i = items.find((x) => x.id === b.dataset.id); if (i && confirm(`確定刪除「${i.name}」？`)) { items = items.filter((x) => x !== i); save.i(); renderList(); } },
  expItems() { download(`候選清單_${today()}.csv`, toCSV(items.map(flatItem), ITEM_COLS)); },
  expRanks() { download(`商品排行_${today()}.csv`, toCSV(ranks, RANK_COLS)); },
  // 排行
  rkTab(b) { rk.src = b.dataset.s; renderRank(); },
  rkDay(b) { rk.date = b.dataset.d; renderRank(); },
  rkSel(b) { rk.sel = b.dataset.k; renderRankDetail(); $('#rkDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); },
  rkClose() { rk.sel = null; renderRankDetail(); },
  rkGo(b) { rk.sel = b.dataset.k; rk.date = null; go('#rank'); },
  rkScore(b) {
    const r = ranks.filter((x) => x.productKey === b.dataset.k).sort((a, c) => (a.date < c.date ? -1 : 1)).at(-1); if (!r) return;
    draft = { ...blankDraft(), name: r.productName, price: r.price, platform: PLATFORMS[r.source] ? r.source : 'other' };
    const h = rankHint(r.productName); if (h) draft.scores.topic = h.suggest;
    save.d(); fillScoreForm(); go('#score'); toast('已帶入商品名與價格，話題性已依上榜狀況預填（可調整）');
  },
  rkList(b) {
    const r = ranks.filter((x) => x.productKey === b.dataset.k).at(-1); if (!r) return;
    if (items.some((i) => keyOf(i.name) === r.productKey)) { toast('清單已有此商品'); return; }
    const h = rankHint(r.productName);
    items.push(makeItem({ ...blankDraft(), name: r.productName, price: r.price, platform: PLATFORMS[r.source] ? r.source : 'other', scores: { ...blankDraft().scores, topic: h?.suggest || 3 } }));
    save.i(); toast('已加入清單（評分為預設值，建議再到評分頁調整）');
  },
  rkDel(b) { if (confirm('刪除這筆排行紀錄？')) { ranks = ranks.filter((r) => r.id !== b.dataset.id); save.r(); renderRank(); } },
  rkMerge() {
    const from = rk.sel, to = $('#rkMerge').value; if (!from || !to || from === to) return;
    for (const r of ranks) if (r.productKey === from) r.productKey = to;
    S.alias[from] = to; for (const [a, t] of Object.entries(S.alias)) if (t === from) S.alias[a] = to;
    save.r(); save.s(); rk.sel = to; renderRank(); toast('已合併');
  },
  async rkPaste(b) {
    const text = $('#rkText').value.trim(); if (!text) { toast('請貼上排行文字'); return; }
    const el = $('#rkPreview'); loading(el);
    try { setPreview(await ai('rank_extract', { text, source: rankMeta().source, date: rankMeta().date }, b)); } catch (e) { showErr(el, e); }
  },
  pvDel(b) { rk.preview.splice(+b.dataset.i, 1); renderPreview(); },
  pvCancel() { rk.preview = []; renderPreview(); },
  pvSave() {
    const m = rankMeta(); let n = 0;
    for (const p of rk.preview) if (addRank(p, m)) n++;
    save.r(); rk.preview = []; renderPreview(); rk.date = m.date; renderRank(); $('#rkText').value = ''; toast(`已寫入 ${n} 筆`);
  },
  // 總覽／設定
  survey(b) { store.set('survey', { a: b.dataset.a, at: Date.now() }); renderHome(); toast('感謝回饋'); },
  checkConn,
  resetWeights() { S.weights = { ...DEF_W }; save.s(); renderSettings(); },
  clearAll() {
    if (!confirm('確定清除所有本機資料（候選清單、排行、設定）？此動作無法復原，建議先匯出 CSV。')) return;
    Object.keys(localStorage).filter((k) => k.startsWith('sp_')).forEach((k) => localStorage.removeItem(k));
    location.hash = '#home'; location.reload();
  },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const f = ACT[b.dataset.act]; if (f) f(b, e);
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.matches('select[data-act="status"]')) { const i = items.find((x) => x.id === t.dataset.id); if (i) { i.status = t.value; save.i(); renderList(); } }
  else if (t.matches('[data-elig]')) { const el = store.get('elig', {}); el[t.dataset.elig] = t.checked; store.set('elig', el); }
  else if (t.matches('[data-imp]') && t.files[0]) {
    try { const rows = parseCSV(await t.files[0].text()); const n = t.dataset.imp === 'items' ? importItems(rows) : importRanks(rows); toast(`已匯入 ${n} 筆`); route(); }
    catch { toast('CSV 讀取失敗'); }
    t.value = '';
  } else if (t.id === 'rkImg' && t.files[0]) {
    const el = $('#rkPreview'); loading(el);
    try { const image = await compress(t.files[0]); setPreview(await ai('rank_extract', { image, source: rankMeta().source, date: rankMeta().date })); }
    catch (err) { showErr(el, err); }
    t.value = '';
  } else if (t.id === 'rkDate' && t.value) { rk.date = t.value; renderRank(); }
  else if (t.id === 'listFilter') renderList();
  else if (t.id === 'aiSrc') aiSrc = t.value;
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.closest('#fScore')) readScoreForm();
  else if (t.closest('#fCalc')) { for (const k of CALC_F) calc[k] = $('#fCalc').elements[k].value; save.c(); renderCalc(); }
  else if (t.dataset.pv != null) { rk.preview[+t.dataset.pv][t.dataset.f] = t.value; }
  else if (t.id === 'setCode') { S.accessCode = t.value.trim(); save.s(); }
  else if (t.id === 'setKey') { S.ownKey = t.value.trim(); save.s(); }
  else if (t.dataset.sw) { S.weights[t.dataset.sw] = clamp(num(t.value), 0, 100); save.s(); wSum(); }
  else if (t.dataset.sh) { S.heat[t.dataset.sh] = clamp(num(t.value), 0, 1); save.s(); }
  else if (t.dataset.ss) { S.sources = $$('[data-ss]').filter((x) => x.checked).map((x) => x.dataset.ss); save.s(); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (f.method === 'dialog') return;
  e.preventDefault();
  const b = f.querySelector('button:not([type=button])');
  if (f.id === 'fRank') {
    const m = rankMeta(), rank = parseInt(f.rank.value, 10);
    if (!addRank({ rank, productName: f.productName.value, price: f.price.value, url: f.url.value, note: f.note.value }, m)) { toast('請填寫名次與商品名稱'); return; }
    save.r(); rk.date = m.date; f.rank.value = rank + 1; ['productName', 'price', 'url', 'note'].forEach((k) => { f[k].value = ''; }); f.productName.focus(); renderRank(); toast('已新增');
  } else if (f.id === 'fPlan') {
    const el = $('#out-plan'); loading(el);
    const products = f.products.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20);
    try { const j = await ai('plan', { topic: f.topic.value, audience: f.audience.value, platform: f.platform.value, perWeek: num(f.perWeek.value) || 3, days: num(f.days.value), products }, b); el.innerHTML = outCard('plan', `<div class="md">${md(j.text)}</div>`, j, j.text); }
    catch (err) { showErr(el, err); }
  } else if (f.id === 'fTrend') {
    const el = $('#out-trend'); loading(el);
    try { const j = await ai('trend', { topic: f.topic.value, platform: f.platform.value, season: f.season.value }, b); el.innerHTML = outCard('trend', `<div class="md">${md(j.text)}</div>`, j, j.text + ((j.sources || []).length ? '\n\n來源\n' + j.sources.map((s) => `- ${s.title} ${s.uri}`).join('\n') : '')); }
    catch (err) { showErr(el, err); }
  }
});

/* ========== 初始化 ========== */
$$('select[data-opt="platform"]').forEach((s) => { s.innerHTML = opts(PLATFORMS, 'reels'); });
$$('select[data-opt="source"]').forEach((s) => { s.innerHTML = opts(PLATFORMS, 'reels'); });
$$('select[data-opt="format"]').forEach((s) => { s.innerHTML = FORMATS.map((f) => `<option>${esc(f)}</option>`).join(''); });
$('#sliders').innerHTML = USER_DIMS.map((d) => `<fieldset class="seg"><legend>${esc(d.n)} <span class="w" data-w="${d.k}"></span></legend><p class="hint">${esc(d.q)}</p>
  <div class="segs">${[1, 2, 3, 4, 5].map((i) => `<label><input type="radio" name="s_${d.k}" value="${i}" aria-label="${esc(d.n)} ${i} 分"><span>${i}</span></label>`).join('')}</div>
  ${d.k === 'topic' ? '<div id="topicHint" class="hint2" aria-live="polite"></div>' : ''}</fieldset>`).join('');
fillScoreForm();
fillCalcForm();
window.addEventListener('hashchange', route);
route();
