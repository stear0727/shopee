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
const SOURCES = { ...PLATFORMS, ai_search: 'AI 網路搜尋' };
const SRC_KEYS = Object.keys(SOURCES);
const SRC_SHORT = { reels: 'IG', fb: 'FB', shorts: 'YT', tiktok: 'TikTok', threads: 'Threads', shopee_video: '蝦皮', other: '其他', ai_search: 'AI 搜尋' };
const FORMATS = ['開箱', '前後對比', '教學示範', '情境短劇', '清單推薦', '實測評比'];
const STATUS = { watch: '觀望中', todo: '待拍', copy: '已產文案', done: '已發布', drop: '淘汰' };
const ACTIVE = ['watch', 'todo', 'copy'];
const SORTS = { rec: '綜合推薦', rate: '佣金高低', score: '分數高低', sales: '月銷高低', priceAsc: '價格低到高', new: '最新加入' };
const CATS = ['服飾配件', '美妝保養', '居家生活', '3C 配件', '廚房用品', '母嬰', '寵物', '食品', '運動戶外', '其他'];
// 關鍵字自動分類（依順序比對，先比對較明確的類別）
const CAT_RE = [
  ['寵物', /寵物|貓|狗|犬|飼料|罐罐|牽繩|逗貓/],
  ['母嬰', /嬰|寶寶|兒童|孕|奶瓶|尿布|童裝|奶嘴|學步|玩具|母嬰/],
  ['3C 配件', /手機|充電|行動電源|傳輸線|耳機|藍牙|喇叭|滑鼠|鍵盤|螢幕|保護貼|手機殼|平板|筆電|USB|記憶卡|相機|自拍|手環|智慧|3C|電競/i],
  ['美妝保養', /面膜|精華|乳液|化妝水|防曬|洗面|卸妝|口紅|唇|粉底|眼影|睫毛|眉|香水|保養|乳霜|霜|美白|彩妝|美妝|指甲|洗髮|潤髮|護髮|沐浴|身體乳|髮|膚/],
  ['食品', /零食|餅乾|杏仁|蜂蜜|牛奶|奶酥|肉鬆|蛋捲|起司|蛋糕|麻糬|鳳梨酥|水果|果凍|雞胸|滴雞精|咖啡豆|茶包|茶葉|堅果|泡麵|巧克力|糖|果乾|肉乾|保健|維他命|益生菌|膠原|食品|醬|麵|米|飲品/],
  ['運動戶外', /運動|瑜珈|健身|登山|露營|跑步|自行車|單車|泳|啞鈴|彈力帶|戶外|球拍|護膝/],
  ['廚房用品', /鍋|碗|盤|杯|刀具|菜刀|砧板|保鮮|便當|餐具|筷|湯匙|廚房|烤箱|氣炸|電鍋|果汁機|咖啡機|水壺|保溫/],
  ['居家生活', /收納|置物|掛勾|毛巾|床|枕|被|寢具|窗簾|地墊|清潔|拖把|掃|垃圾|衣架|燈|香氛|擴香|浴室|洗衣|除濕|抽屜|居家|家具|椅|桌/],
  ['服飾配件', /上衣|T恤|背心|襯衫|外套|褲|裙|洋裝|衣|襪|帽|鞋|包|皮夾|錢包|圍巾|手套|項鍊|耳環|戒指|手錶|眼鏡|飾品|服飾/],
];
const autoCat = (name, cat = '') => {
  if (CATS.includes(cat) && cat !== '其他') return cat;
  const s = `${cat || ''} ${name || ''}`;
  for (const [c, re] of CAT_RE) if (re.test(s)) return c;
  return '其他';
};
const EXTRA = ['discount', 'rating', 'sales', 'trend', 'summary', 'url', 'src', 'aiText'];
const numOr = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : Number(v));
const kfmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : fmt(n));
const catClass = (c) => { let h = 0; for (const ch of String(c || '')) h = (h + ch.codePointAt(0)) % 6; return 'k' + h; };
// 把 AI 搜尋回傳的商品統一成同一種格式
const normAI = (list, max = 50) => list.slice(0, max).map((x, i) => ({
  rank: parseInt(x?.rank, 10) || i + 1, productName: String(x?.productName ?? '').trim().slice(0, 120), category: String(x?.category ?? '').split('|')[0].trim().slice(0, 40),
  price: numOr(x?.price), discount: numOr(x?.discount), rating: numOr(x?.rating), sales: numOr(x?.monthlySales), rate: numOr(x?.commissionRate),
  trend: ['上升', '持平', '下降'].includes(x?.trend) ? x.trend : '', note: String(x?.reason ?? '').slice(0, 200), url: safeUrl(x?.sourceUrl),
})).filter((x) => x.productName);
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
  return `<figure><figcaption class="hint">橫軸分數、縱軸單筆期望佣金（元）</figcaption><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="散佈圖：${arr.length} 件商品，橫軸分數、縱軸單筆期望佣金。${esc(arr.map((i) => `${i.name} ${fmt(i.total, 1)} 分 ${fmt(expOf(i), 1)} 元`).join('；'))}">${g}</svg></figure>`;
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
    g += pts.map((p) => `<circle class="${c}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4"><title>${esc(SOURCES[s] || s)} ${p[2]}：#${p[3]}</title></circle>`).join('');
  }
  const legend = srcs.map((s) => `<span class="s${Math.max(0, SRC_KEYS.indexOf(s))}"><i></i>${esc(SOURCES[s] || s)}</span>`).join('');
  const alt = rs2.map((r) => `${r.date} ${SOURCES[r.source] || r.source} 第 ${r.rank} 名`).join('；');
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
const ITEM_COLS = ['id', 'name', 'category', 'price', 'base', 'xtra', 'platform', 'format', ...USER_DIMS.map((d) => d.k), 'total', 'grade', 'status', 'note', 'views', 'clicks', 'orders', 'commission', 'createdAt', ...EXTRA];
const RANK_COLS = ['id', 'date', 'source', 'listName', 'listSize', 'rank', 'productName', 'productKey', 'price', 'url', 'note'];
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
  const it = { id: p.id || uid(), name: String(p.name).trim().slice(0, 120), category: String(p.category || '').slice(0, 40), price: num(p.price), base: num(p.base), xtra: num(p.xtra), rate: num(p.base) + num(p.xtra), platform: PLATFORMS[p.platform] ? p.platform : 'other', format: String(p.format || '').slice(0, 20), scores: { ...p.scores }, total: r.total, grade: r.grade, status: 'todo', note: '', actual: { views: '', clicks: '', orders: '', commission: '' }, createdAt: new Date().toISOString() };
  for (const k of EXTRA) it[k] = p[k] ?? '';
  return it;
}
function rescore(i) { const r = scoreOf(i); i.total = r.total; i.grade = r.grade; i.rate = num(i.base) + num(i.xtra); }
function itemFromAI(x, platform) {
  const trust = num(x.rating) >= 4.7 && num(x.sales) >= 1000 ? 5 : num(x.rating) >= 4.5 ? 4 : 3;
  const it = makeItem({ ...blankDraft(), name: x.productName, category: autoCat(x.productName, x.category), price: x.price, base: x.rate, platform: PLATFORMS[platform] ? platform : 'reels',
    scores: { ...blankDraft().scores, topic: x.trend === '上升' ? 5 : 4, trust }, discount: x.discount, rating: x.rating, sales: x.sales, trend: x.trend, summary: x.note, url: x.url, src: 'ai' });
  it.status = 'watch';
  return it;
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
  $('#pfInfo').textContent = c.length ? `將送出 ${c.length} 件商品（觀望中、待拍、已產文案，依分數取前 20）。` : '商品清單是空的，請先加入商品。';
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
  const pool = items.filter((i) => ACTIVE.includes(i.status));
  return (pool.length ? pool : items.filter((i) => i.status !== 'drop')).sort((a, b) => b.total - a.total).slice(0, 20);
}

/* ========== M7 候選清單 ========== */
let recMap = {};
// 綜合推薦指數 0–100：系統分數 50%、單筆期望佣金 30%（相對最高者）、銷量 20%（對數，相對最高者）
function calcRec() {
  const act = items.filter((i) => i.status !== 'drop');
  const maxE = Math.max(1, ...act.map(expOf)), maxS = Math.max(1, ...act.map((i) => num(i.sales)));
  recMap = Object.fromEntries(items.map((i) => [i.id, Math.round(100 * (0.5 * i.total / 100 + 0.3 * Math.min(1, expOf(i) / maxE) + 0.2 * (num(i.sales) > 0 ? Math.log10(num(i.sales) + 1) / Math.log10(maxS + 1) : 0)))]));
}
const SORT_FN = {
  rec: (a, b) => (recMap[b.id] || 0) - (recMap[a.id] || 0) || b.total - a.total,
  rate: (a, b) => num(b.base) + num(b.xtra) - num(a.base) - num(a.xtra) || b.total - a.total,
  score: (a, b) => b.total - a.total,
  sales: (a, b) => num(b.sales) - num(a.sales) || b.total - a.total,
  priceAsc: (a, b) => num(a.price) - num(b.price),
  new: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
};
function renderList() {
  const cats = [...new Set(items.map((i) => i.category).filter(Boolean))].sort();
  const cs = $('#listCat'), cv = cs.value || 'all';
  cs.innerHTML = opts({ all: '全部類別', ...Object.fromEntries(cats.map((c) => [c, c])) }, cats.includes(cv) ? cv : 'all');
  calcRec();
  const q = norm($('#listQ').value), f = $('#listFilter').value, c = cs.value;
  const arr = items.filter((i) => (f === 'all' || i.status === f) && (c === 'all' || i.category === c) && (!q || norm(`${i.name} ${i.category} ${i.summary} ${i.note}`).includes(q)))
    .sort(SORT_FN[$('#listSort').value] || SORT_FN.rec);
  $('#listCount').textContent = `● 已入選 ${items.filter((i) => i.status !== 'drop').length} 件${arr.length !== items.length ? `（顯示 ${arr.length} 件）` : ''}`;
  $('#scatter').innerHTML = scatter(items.filter((i) => i.status !== 'drop'));
  if (!arr.length) { $('#listBody').innerHTML = `<p class="empty">${items.length ? '沒有符合條件的商品。' : '還沒有商品。用上方「AI 找商品」自動搜尋，或到「<a href="#score">評分</a>」手動加入。'}</p>`; return; }
  if ($('#listView').value === 'cat') {
    const groups = {};
    for (const i of arr) (groups[i.category || '未分類'] ??= []).push(i);
    const order = Object.keys(groups).sort((a, b) => (a === '其他') - (b === '其他') || groups[b].length - groups[a].length);
    $('#listBody').innerHTML = order.map((g) => `<h2 class="cat-h"><span class="cat ${catClass(g)}">${esc(g)}</span> 排行 <span class="muted sm">${groups[g].length} 件</span></h2><div class="cards">${groups[g].map(cardItem).join('')}</div>`).join('');
  } else {
    $('#listBody').innerHTML = `<div class="cards">${arr.map(cardItem).join('')}</div>`;
  }
}
function cardItem(i, idx) {
  const rate = num(i.base) + num(i.xtra), r = num(i.rating), a = i.actual || {}, u = safeUrl(i.url), id = esc(i.id);
  const stars = r ? `<span class="stars" aria-hidden="true">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</span> <span aria-label="評分 ${r}">${r}</span>` : '';
  const trend = i.trend === '上升' ? '<span class="up">↗ 上升</span>' : i.trend === '下降' ? '<span class="down">↘ 下降</span>' : i.trend ? `<span class="muted">→ ${esc(i.trend)}</span>` : '';
  return `<article class="pc">
    <div class="pc-top"><span><span class="rk${idx < 3 ? ' top' : ''}">#${idx + 1}</span> <span class="cat ${catClass(i.category)}">${esc(i.category || '未分類')}</span></span><span class="prate${rate ? '' : ' unk'}">${rate ? `${fmt(rate, 1).replace(/\.0$/, '')}% 分潤` : '分潤未知'}</span></div>
    <h3>${esc(i.name)}</h3>
    <div class="pc-row"><span>${num(i.price) ? `<b class="price">$${fmt(num(i.price))}</b>` : '<span class="muted">價格未知</span>'}${num(i.discount) ? `<span class="disc">-${fmt(num(i.discount))}%</span>` : ''}</span><span class="muted">${num(i.sales) ? `月銷 ${kfmt(num(i.sales))}` : ''}</span></div>
    ${stars || trend ? `<div class="pc-row"><span>${stars}</span>${trend}</div>` : ''}
    ${i.summary ? `<p class="sum">${esc(i.summary)}</p>` : ''}
    <div class="pc-row sm"><span>推薦指數 <b>${recMap[i.id] ?? '—'}</b>｜<span class="grade g${i.grade}">${i.grade}</span> ${fmt(i.total, 1)} 分｜單筆約 ${fmt(expOf(i), 1)} 元</span><span>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">來源</a>` : ''}${i.src === 'ai' ? ' <span class="tag">AI 找到</span>' : ''}</span></div>
    ${a.views !== '' && a.views != null ? `<div class="sm muted">實際：${fmt(num(a.views))} 觀看／${fmt(num(a.orders))} 單／${fmt(num(a.commission))} 元</div>` : ''}
    ${i.note ? `<div class="sm muted">備註：${esc(i.note)}</div>` : ''}
    <select data-act="status" data-id="${id}" aria-label="${esc(i.name)} 狀態">${opts(STATUS, i.status)}</select>
    <div class="acts"><button type="button" data-act="itemAI" data-id="${id}">AI 產文案</button>${i.aiText ? `<button type="button" data-act="viewCopy" data-id="${id}">查看文案</button>` : ''}<button type="button" data-act="itemToScore" data-id="${id}">評分</button><button type="button" data-act="editItem" data-id="${id}">編輯</button><button type="button" class="danger" data-act="delItem" data-id="${id}">刪除</button></div>
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
      ${nf('base', '基本分潤 %', i.base)}${nf('xtra', '加碼分潤 %', i.xtra)}
      ${nf('rating', '評分', i.rating)}${nf('sales', '月銷', i.sales)}
    </div>
    <label>商品網址<input name="url" type="url" maxlength="500" value="${esc(i.url)}"></label>
    <label>備註<textarea name="note" rows="2" maxlength="500">${esc(i.note)}</textarea></label>
    <h3>實際成效回填（復盤）</h3><div class="row2">${nf('views', '觀看', a.views)}${nf('clicks', '點擊', a.clicks)}${nf('orders', '訂單', a.orders)}${nf('commission', '佣金（元）', a.commission)}</div>
    <p class="hint">分潤比例請以蝦皮分潤後台為準；修改後分數會自動重算。</p>
    <div class="btns"><button value="cancel" formnovalidate>取消</button><button value="ok" class="pri">儲存</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const f = new FormData($('#fEdit'));
    i.status = STATUS[f.get('status')] ? f.get('status') : i.status;
    i.note = String(f.get('note')).slice(0, 500); i.category = String(f.get('category')).trim().slice(0, 40); i.url = safeUrl(f.get('url'));
    for (const k of ['price', 'base', 'xtra']) i[k] = num(f.get(k));
    for (const k of ['discount', 'rating', 'sales']) i[k] = numOr(f.get(k));
    i.actual = Object.fromEntries(['views', 'clicks', 'orders', 'commission'].map((k) => [k, f.get(k)]));
    rescore(i); save.i(); renderList(); toast('已儲存');
  };
  d.showModal();
}
let disc = [], discPlat = 'all', discMeta = null;
function renderDisc() {
  const el = $('#discOut');
  if (!disc.length) { el.innerHTML = ''; return; }
  const have = new Set(items.map((i) => keyOf(i.name)));
  el.innerHTML = `<h3>找到 ${disc.length} 件商品（勾選要加入的）</h3><div class="disc-list">${disc.map((x, i) => {
    const dup = have.has(keyOf(x.productName));
    return `<label><input type="checkbox" data-dc="${i}"${dup ? ' disabled' : ' checked'}><span><b>${x.rank}. ${esc(x.productName)}</b>${dup ? ' <span class="tag">已在清單</span>' : ''}<br>
      <span class="sm muted">${esc(x.category || '未分類')}｜${x.price !== '' ? `$${fmt(x.price)}` : '價格未知'}${x.rate !== '' ? `｜${x.rate}% 分潤` : '｜分潤未知'}${x.sales !== '' ? `｜月銷 ${kfmt(x.sales)}` : ''}${x.rating !== '' ? `｜★${x.rating}` : ''}${x.trend ? `｜${esc(x.trend)}` : ''}</span><br>
      <span class="sm">${esc(x.note)}</span>${x.url ? ` <a class="sm" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">來源</a>` : ''}</span></label>`;
  }).join('')}</div>
  ${discMeta?.sources?.length ? `<details><summary>搜尋來源（${discMeta.sources.length}）</summary><ul>${discMeta.sources.filter((s) => safeUrl(s.uri)).map((s) => `<li><a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join('')}</ul></details>` : ''}
  ${discMeta?.meta ? '<div class="checks"><label><input type="checkbox" id="discRank" checked>同時記錄到「商品排行」（追蹤熱度變化）</label></div>' : ''}
  <div class="btns"><button type="button" class="pri" data-act="discAdd">加入勾選的商品</button><button type="button" data-act="discAll" data-v="1">全選</button><button type="button" data-act="discAll" data-v="">全不選</button><button type="button" data-act="discClear">關閉</button></div>`;
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
  $('#rkTabs').innerHTML = [['all', '全部'], ...SRC_KEYS.map((k) => [k, SOURCES[k]])].map(([k, v]) => `<button type="button" role="tab" data-act="rkTab" data-s="${k}" aria-selected="${rk.src === k}">${esc(v)}</button>`).join('');
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
  ['#rkPreview', '#rkSearchOut'].forEach((s) => { if (s !== rk.pvEl) $(s).innerHTML = ''; });
  const el = $(rk.pvEl || '#rkPreview');
  if (!rk.preview.length) { el.innerHTML = ''; return; }
  const m = rk.pvMeta || rankMeta(), auto = !!rk.pvMeta;
  const src = (rk.pvSources || []).filter((s) => safeUrl(s.uri));
  el.innerHTML = `<h3>${auto ? 'AI 搜尋結果' : 'AI 解析預覽'}（確認後才寫入，可修改或刪除）</h3><div class="tw"><table class="pv"><thead><tr><th>名次</th><th>商品名稱</th><th>價格</th>${auto ? '<th>熱門理由／來源</th>' : ''}<th></th></tr></thead><tbody>${rk.preview.map((p, i) => `<tr>
    <td><input aria-label="名次" type="number" min="1" inputmode="numeric" data-pv="${i}" data-f="rank" value="${esc(p.rank)}"></td>
    <td><input aria-label="商品名稱" maxlength="120" data-pv="${i}" data-f="productName" value="${esc(p.productName)}"></td>
    <td><input aria-label="價格" type="number" min="0" inputmode="decimal" data-pv="${i}" data-f="price" value="${esc(p.price)}"></td>
    ${auto ? `<td class="sm">${esc(p.note)}${p.url ? ` <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">來源</a>` : ''}</td>` : ''}
    <td><button type="button" class="danger" data-act="pvDel" data-i="${i}" aria-label="刪除此列">✕</button></td></tr>`).join('')}</tbody></table></div>
  ${src.length ? `<details><summary>搜尋來源（${src.length}）</summary><ul>${src.map((s) => `<li><a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join('')}</ul></details>` : ''}
  <p class="hint">將寫入：${esc(m.date)}｜${esc(SOURCES[m.source])}${m.listName ? '｜' + esc(m.listName) : ''}${auto ? '' : '（可在上方榜單資訊修改）'}</p>
  <div class="btns"><button type="button" class="pri" data-act="pvSave">全部寫入排行（${rk.preview.length} 筆）</button><button type="button" data-act="pvCancel">取消</button></div>`;
}
function setPreview(j, elSel = '#rkPreview', meta = null) {
  rk.pvEl = elSel; rk.pvMeta = meta; rk.pvSources = j.sources || [];
  const list = Array.isArray(j.json?.items) ? j.json.items : null;
  if (!list) { rk.preview = []; renderPreview(); $(elSel).innerHTML = `<p class="err">AI 回傳格式無法解析，原文如下：</p><div class="md">${md(j.text)}</div>`; return; }
  rk.preview = normAI(list);
  renderPreview();
  if (!rk.preview.length) $(elSel).innerHTML = '<p class="muted">AI 沒有找到符合的熱門商品，換個題材或平台再試一次。</p>';
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
  $('#setSrc').innerHTML = SRC_KEYS.map((k) => `<label><input type="checkbox" data-ss="${k}"${S.sources.includes(k) ? ' checked' : ''}>${esc(SOURCES[k])}</label>`).join('');
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
    try {
      const j = await ai('analyze', { name: p.name, category: p.category, price: num(p.price), rate: num(p.base) + num(p.xtra), platform: p.platform, format: p.format, scores: p.scores, total: p.total, grade: p.grade }, b);
      el.innerHTML = renderAnalyze(j, p);
      const it = items.find((x) => x.id === aiSrc);
      if (it) { it.aiText = String(outText.analyze || '').slice(0, 8000); if (['watch', 'todo'].includes(it.status)) it.status = 'copy'; save.i(); }
    } catch (e) { showErr(el, e); }
  },
  itemAI(b) { aiSrc = b.dataset.id; aiTab = 'analyze'; location.hash = '#ai'; renderAI(); ACT.runAnalyze($('#v-ai [data-act="runAnalyze"]')); },
  viewCopy(b) {
    const i = items.find((x) => x.id === b.dataset.id); if (!i) return;
    const d = $('#dlg'); outText.view = i.aiText;
    d.innerHTML = `<h2>${esc(i.name)}｜文案</h2><div class="pre">${esc(i.aiText)}</div><div class="btns"><button type="button" class="pri" data-act="copy" data-k="view">複製</button><button type="button" data-act="closeDlg">關閉</button></div>`;
    d.showModal();
  },
  closeDlg() { $('#dlg').close(); },
  discAdd() {
    const pick = $$('[data-dc]').filter((x) => x.checked && !x.disabled).map((x) => disc[+x.dataset.dc]);
    if (!pick.length) { toast('請先勾選商品'); return; }
    for (const x of pick) { const it = itemFromAI(x, discPlat); if (discMeta?.src) it.src = discMeta.src; items.push(it); }
    if (discMeta?.meta && $('#discRank')?.checked) { for (const x of disc) addRank(x, discMeta.meta); save.r(); }
    save.i(); disc = []; renderDisc(); renderList(); toast(`已加入 ${pick.length} 件商品，狀態為「觀望中」`);
  },
  discClear() { disc = []; renderDisc(); },
  autoCatAll() {
    let n = 0;
    for (const i of items) { const c = autoCat(i.name, i.category); if (c !== i.category && (c !== '其他' || !i.category)) { i.category = c; n++; } }
    save.i(); renderList(); toast(n ? `已自動分類 ${n} 件商品` : '所有商品都已有分類');
  },
  discAll(b) { $$('[data-dc]').forEach((x) => { if (!x.disabled) x.checked = !!b.dataset.v; }); },
  copyBm() { copy(bmCode()); },
  fillPlan() { const t = items.filter((i) => ACTIVE.includes(i.status)).sort((a, b) => b.total - a.total).slice(0, 20); $('#fPlan').elements.products.value = t.map((i) => i.name).join('\n'); if (!t.length) toast('清單沒有可用的商品'); },
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
    const m = rk.pvMeta || rankMeta(); let n = 0;
    for (const p of rk.preview) if (addRank(p, m)) n++;
    save.r(); rk.preview = []; rk.pvMeta = null; renderPreview(); rk.date = m.date; rk.src = 'all'; renderRank(); $('#rkText').value = ''; toast(`已寫入 ${n} 筆`);
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
  else if (['listFilter', 'listCat', 'listSort', 'listView'].includes(t.id)) renderList();
  else if (t.id === 'aiSrc') aiSrc = t.value;
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.closest('#fScore')) readScoreForm();
  else if (t.id === 'listQ') renderList();
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
  } else if (f.id === 'fDiscover') {
    const el = $('#discOut'), platform = f.platform.value, topic = f.topic.value.trim();
    el.innerHTML = '<div class="loading">AI 正在搜尋網路上的熱門商品，約需 10–25 秒…</div>';
    try {
      const j = await ai('rank_search', { platform, topic }, b);
      const list = Array.isArray(j.json?.items) ? normAI(j.json.items) : null;
      if (!list) { el.innerHTML = `<p class="err">AI 回傳格式無法解析，原文如下：</p><div class="md">${md(j.text)}</div>`; return; }
      disc = list; discPlat = platform;
      discMeta = { sources: j.sources || [], meta: { date: today(), source: 'ai_search', listName: `AI 搜尋｜${platform === 'all' ? '全部平台' : PLATFORMS[platform]}${topic ? '｜' + topic.slice(0, 30) : ''}`, listSize: 20 } };
      renderDisc();
      if (!list.length) el.innerHTML = '<p class="muted">AI 沒有找到符合的商品，換個題材或平台再試一次。</p>';
    } catch (err) { showErr(el, err); }
  } else if (f.id === 'fRkSearch') {
    const el = $('#rkSearchOut'), platform = f.platform.value, topic = f.topic.value.trim();
    el.innerHTML = '<div class="loading">AI 正在搜尋網路上的熱門商品，約需 10–25 秒…</div>';
    try {
      const j = await ai('rank_search', { platform, topic }, b);
      setPreview(j, '#rkSearchOut', { date: today(), source: 'ai_search', listName: `AI 搜尋｜${platform === 'all' ? '全部平台' : PLATFORMS[platform]}${topic ? '｜' + topic.slice(0, 30) : ''}`, listSize: 20 });
    } catch (err) { showErr(el, err); }
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

/* ========== 蝦皮擷取書籤（此函式不在本站執行，而是轉成書籤程式碼在蝦皮頁面執行） ========== */
function shopeeGrab(SITE) {
  const VER = '3';
  if (window.__spg && window.__spg.dataset && window.__spg.dataset.v === VER) { window.__spg.style.display = 'block'; return; }
  if (window.__spg) { /* 頁面上是舊版擷取：先停掉再換新版 */ try { if (window.__spgStop) window.__spgStop(); else window.__spg.remove(); } catch (e) { /* 略過 */ } }
  const NAME = ['name', 'item_name', 'product_name', 'productName', 'itemName', 'title'];
  const PRICE = ['price', 'price_min', 'min_price', 'priceMin', 'item_price', 'sale_price', 'product_price', 'price_max'];
  const ID = ['itemid', 'item_id', 'itemId', 'product_id', 'productId'];
  const SHOP = ['shopid', 'shop_id', 'shopId'];
  const RATE = ['commission_rate', 'commissionRate', 'total_commission_rate', 'max_commission_rate', 'default_commission_rate', 'seller_commission_rate', 'sellerCommissionRate', 'shopee_commission_rate', 'commission_rate_str', 'commissionRateStr'];
  const SOLD = ['historical_sold', 'historicalSold', 'sold', 'monthly_sold', 'sales', 'sold_count', 'item_sold', 'sales_volume', 'sold_text'];
  const RATING = ['rating_star', 'ratingStar', 'item_rating_star', 'rating'];
  const DISC = ['raw_discount', 'discount', 'discount_percentage', 'show_discount'];
  const CAT = ['category_name', 'categoryName', 'cat_name', 'category'];
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const pick = (o, ks) => { for (const k of ks) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return undefined; };
  const toNum = (v) => { if (v === undefined || v === null) return NaN; if (typeof v === 'number') return v; const m = String(v).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|K|萬|w|W)?/); return m ? Number(m[1]) * (m[2] === 'k' || m[2] === 'K' ? 1e3 : m[2] ? 1e4 : 1) : NaN; };
  const nPrice = (v) => { let n = toNum(v); if (!(n > 0)) return ''; if (n >= 1e5) n /= 1e5; return Math.round(n); };
  const nRate = (v) => { let n = toNum(v); if (!(n > 0)) return ''; if (n <= 1) n *= 100; else if (n > 100) n /= 1000; return n <= 100 ? Math.round(n * 10) / 10 : ''; };
  const nDisc = (v) => { let n = Math.abs(toNum(v)); if (!(n > 0)) return ''; if (n < 1) n *= 100; return n < 100 ? Math.round(n) : ''; };
  const nRating = (v) => { const n = toNum(isObj(v) ? v.rating_star : v); return n > 0 && n <= 5 ? Math.round(n * 10) / 10 : ''; };
  const view = (o) => { const v = { ...o }; for (const c of Object.values(o)) if (isObj(c)) for (const [k, x] of Object.entries(c)) if (v[k] === undefined && typeof x !== 'object') v[k] = x; if (isObj(o.item_rating) && v.rating_star === undefined) v.rating_star = o.item_rating.rating_star; return v; };
  /* 擷取結果存在蝦皮網站的本機儲存空間：換頁、重新整理、開新分頁後再點書籤即可接續 */
  const KEY = 'spg_items_v1';
  const items = new Map();
  try { JSON.parse(localStorage.getItem(KEY) || '[]').forEach((p) => items.set(p.id, p)); } catch (e) { /* 無法讀取 */ }
  let saveT = 0;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify([...items.values()].slice(-2000))); } catch (e) { /* 空間不足 */ } }, 400); };
  let budget = 0;
  const walk = (node, d, out) => {
    if (budget-- <= 0 || d > 10 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const x of node) walk(x, d + 1, out); return; }
    const v = view(node), name = pick(v, NAME), price = pick(v, PRICE), id = pick(v, ID);
    if (typeof name === 'string' && name.trim().length >= 4 && (price !== undefined || id !== undefined) && pick(v, ['username', 'email', 'phone']) === undefined) {
      const shop = pick(v, SHOP), cat = pick(v, CAT);
      out.push({ id: id !== undefined ? 'sp_' + (shop ?? 0) + '_' + id : name.trim(), productName: name.trim().slice(0, 120), price: nPrice(price), commissionRate: nRate(pick(v, RATE)), monthlySales: Math.round(toNum(pick(v, SOLD))) || '', rating: nRating(pick(v, RATING) ?? v.item_rating), discount: nDisc(pick(v, DISC)), category: typeof cat === 'string' ? cat.slice(0, 40) : '', sourceUrl: id !== undefined && shop !== undefined ? 'https://shopee.tw/product/' + shop + '/' + id : '' });
      return;
    }
    for (const c of Object.values(node)) if (c && typeof c === 'object') walk(c, d + 1, out);
  };
  const box = document.createElement('div');
  const upd = () => {
    const n = box.querySelector('[data-n]'), r = box.querySelector('[data-r]');
    if (n) n.textContent = items.size;
    if (r) r.textContent = [...items.values()].filter((p) => p.commissionRate !== '' && p.commissionRate != null).length;
    persist();
  };
  const feed = (t) => {
    try {
      const j = typeof t === 'string' ? JSON.parse(t) : t, out = []; budget = 50000; walk(j, 0, out);
      for (const p of out) { const o = items.get(p.id); if (!o) items.set(p.id, p); else for (const k in p) if (p[k] !== '' && o[k] === '') o[k] = p[k]; }
      if (out.length) upd();
    } catch (e) { /* 非 JSON */ }
  };
  const of = window.fetch;
  window.fetch = async function (...a) { const r = await of.apply(this, a); try { const c = r.clone(); if ((c.headers.get('content-type') || '').includes('json')) c.text().then(feed); } catch (e) { /* 略過 */ } return r; };
  const os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...a) { this.addEventListener('load', function () { try { if ((this.getResponseHeader('content-type') || '').includes('json')) feed(this.responseType === '' || this.responseType === 'text' ? this.responseText : this.response); } catch (e) { /* 略過 */ } }); return os.apply(this, a); };
  ['__INITIAL_STATE__', '__NEXT_DATA__', '__APOLLO_STATE__'].forEach((k) => { if (window[k]) feed(window[k]); });
  /* 補抓點書籤前已載入的資料（例如第一頁）：依瀏覽器的資源紀錄重新讀取一次（僅限蝦皮網域的 GET 資料網址） */
  try {
    const seen = new Set();
    performance.getEntriesByType('resource')
      .filter((e) => (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') && /(^|\.)shopee\.(tw|com)$/.test(new URL(e.name).hostname))
      .slice(-40)
      .forEach((e) => {
        if (seen.has(e.name)) return; seen.add(e.name);
        of(e.name, { credentials: 'include' }).then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.text() : '')).then((t) => { if (t) feed(t); }).catch(() => {});
      });
  } catch (e) { /* 瀏覽器不支援資源紀錄 */ }
  document.querySelectorAll('script[type="application/json"]').forEach((s) => feed(s.textContent));
  /* 商品推廣詳情頁：分潤比例只顯示在畫面上的「分潤回饋」表格，直接讀取畫面文字 */
  const rateOf = (txt, label) => { const m = txt.match(new RegExp(label + '[^%]{0,40}?(\\d+(?:\\.\\d+)?)\\s*%')); return m ? Number(m[1]) : ''; };
  let lastDetail = '';
  const scanDetail = () => {
    const m = location.pathname.match(/product_offer\/(\d+)/);
    if (!m) return;
    const txt = document.body.innerText || '';
    if (!txt.includes('分潤')) return;
    const social = rateOf(txt, '社群媒體'), video = rateOf(txt, '蝦皮短影音'), live = rateOf(txt, '蝦皮直播');
    if (social === '' && video === '' && live === '') return;
    const sig = m[1] + social + video + live;
    if (sig === lastDetail) return;
    lastDetail = sig;
    const line = txt.split('\n').find((l) => l.includes('查看商品詳情'));
    const name = line ? line.replace('查看商品詳情', '').trim() : '';
    const pm = txt.match(/\$\s?([\d,]+(?:\.\d+)?)/), sm = txt.match(/已售出\s*([\d.]+\s*[萬kK]?)/);
    let key = [...items.keys()].find((k) => k.endsWith('_' + m[1]));
    if (!key) { if (!name) return; key = 'sp_0_' + m[1]; items.set(key, { id: key, productName: name.slice(0, 120), price: pm ? Math.round(toNum(pm[1])) : '', commissionRate: '', monthlySales: sm ? Math.round(toNum(sm[1])) || '' : '', rating: '', discount: '', category: '', sourceUrl: 'https://shopee.tw/product/0/' + m[1] }); }
    const it = items.get(key);
    it.commissionRate = social !== '' ? social : Math.max(video || 0, live || 0);
    it.channelRates = '短影音 ' + (video === '' ? '?' : video) + '%／社群 ' + (social === '' ? '?' : social) + '%／直播 ' + (live === '' ? '?' : live) + '%';
    upd();
    const n = box.querySelector('i'); if (n) n.textContent = '已讀取分潤：' + (it.productName || '').slice(0, 16) + '… ' + it.commissionRate + '%';
  };
  const iv = setInterval(scanDetail, 1500);
  box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#fff;color:#1f1a17;border:2px solid #c2410c;border-radius:14px;padding:12px 14px;font:15px/1.5 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:280px';
  const B = 'border-radius:8px;padding:7px 10px;font:inherit;font-size:14px;cursor:pointer;margin:2px;';
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700"><span>📥 擷取中｜<b data-n>0</b> 件（有分潤 <b data-r>0</b>）</span><button data-min title="縮小／展開" style="' + B + 'background:#fff;border:1px solid #ccc;padding:2px 10px">－</button></div>'
    + '<div data-body><div style="font-size:13px;color:#625a53;margin:6px 0">往下捲動、換頁或搜尋，件數會增加；第一頁沒抓到就切到第 2 頁再回來。<br>分潤比例要點進商品詳情頁才讀得到（可開新分頁，在新分頁再點一次書籤）。<br>資料會自動保存，重新整理後再點書籤即可接續。</div>'
    + '<i style="display:block;font-size:13px;color:#15803d;margin-bottom:6px"></i>'
    + '<button data-s style="' + B + 'background:#c2410c;color:#fff;border:0">送到選品網站</button>'
    + '<button data-clr style="' + B + 'background:#fff;border:1px solid #ccc">清空</button>'
    + '<button data-stop style="' + B + 'background:#fff;color:#b91c1c;border:1px solid #b91c1c">停止擷取</button></div>';
  const body = box.querySelector('[data-body]');
  box.querySelector('[data-min]').onclick = () => { const h = body.style.display === 'none'; body.style.display = h ? 'block' : 'none'; box.querySelector('[data-min]').textContent = h ? '－' : '＋'; };
  box.querySelector('[data-s]').onclick = () => {
    if (!items.size) { alert('還沒擷取到商品：請先往下捲動或換頁再試'); return; }
    const s = btoa(unescape(encodeURIComponent(JSON.stringify([...items.values()].slice(0, 1000)))));
    window.open(SITE + '/#import=' + encodeURIComponent(s), '_blank');
  };
  box.querySelector('[data-clr]').onclick = () => {
    if (!confirm('清空已擷取的 ' + items.size + ' 件商品？（已送到選品網站的不受影響）')) return;
    items.clear(); try { localStorage.removeItem(KEY); } catch (e) { /* 略過 */ } upd();
  };
  const stop = () => {
    window.fetch = of; XMLHttpRequest.prototype.send = os; clearInterval(iv); persist();
    box.remove(); delete window.__spg; delete window.__spgStop;
  };
  box.querySelector('[data-stop]').onclick = stop;
  box.dataset.v = VER;
  document.body.appendChild(box);
  window.__spg = box;
  window.__spgStop = stop;
  upd();
}
const bmCode = () => 'javascript:' + encodeURIComponent(`(${shopeeGrab.toString()})(${JSON.stringify(location.origin)});void 0`);
function checkImport() {
  const m = location.hash.match(/^#import=(.+)$/);
  if (!m) return false;
  history.replaceState(null, '', '#list');
  try {
    const list = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    // 已在清單中的商品：補上分潤率等數字後直接更新，不再列入待加入清單
    const pid = (u) => (String(u || '').match(/(\d+)$/) || [])[1];
    let upd = 0;
    const rest = list.filter((x) => {
      const id = pid(x.sourceUrl);
      const it = items.find((i) => keyOf(i.name) === keyOf(x.productName) || (id && pid(i.url) === id));
      if (!it) return true;
      if (x.commissionRate !== '' && x.commissionRate != null) { it.base = num(x.commissionRate); it.xtra = 0; }
      if (num(x.price)) it.price = num(x.price);
      if (num(x.monthlySales)) it.sales = num(x.monthlySales);
      if (x.channelRates) it.note = it.note && !it.note.startsWith('短影音') ? it.note : x.channelRates;
      rescore(it); upd++;
      return false;
    });
    if (upd) { save.i(); toast(`已更新清單中 ${upd} 件商品的分潤與數字`); }
    disc = normAI(rest.map((x, i) => ({ ...x, rank: i + 1, reason: `蝦皮後台擷取${x.channelRates ? `｜${x.channelRates}` : x.commissionRate ? `｜分潤 ${x.commissionRate}%` : ''}${x.monthlySales ? `｜銷量 ${x.monthlySales}` : ''}` })), 1000);
    discPlat = 'reels'; discMeta = { sources: [], meta: null, src: 'shopee' };
    return true;
  } catch { toast('擷取資料格式錯誤，請重新擷取'); return false; }
}

/* ========== 初始化 ========== */
$$('select[data-opt="platform"]').forEach((s) => { s.innerHTML = opts(PLATFORMS, 'reels'); });
$$('select[data-opt="source"]').forEach((s) => { s.innerHTML = opts(PLATFORMS, 'reels'); });
$$('select[data-opt="platformAll"]').forEach((s) => { s.innerHTML = opts({ all: '全部平台', ...PLATFORMS }, 'all'); });
$('#listFilter').innerHTML = opts({ all: '全部狀態', ...STATUS }, 'all');
$('#listSort').innerHTML = opts(SORTS, 'rec');
$('#listView').innerHTML = opts({ all: '綜合排行', cat: '分類排行' }, 'all');
$$('select[data-opt="format"]').forEach((s) => { s.innerHTML = FORMATS.map((f) => `<option>${esc(f)}</option>`).join(''); });
$('#sliders').innerHTML = USER_DIMS.map((d) => `<fieldset class="seg"><legend>${esc(d.n)} <span class="w" data-w="${d.k}"></span></legend><p class="hint">${esc(d.q)}</p>
  <div class="segs">${[1, 2, 3, 4, 5].map((i) => `<label><input type="radio" name="s_${d.k}" value="${i}" aria-label="${esc(d.n)} ${i} 分"><span>${i}</span></label>`).join('')}</div>
  ${d.k === 'topic' ? '<div id="topicHint" class="hint2" aria-live="polite"></div>' : ''}</fieldset>`).join('');
fillScoreForm();
fillCalcForm();
const bm = $('#bmLink');
bm.href = bmCode();
bm.addEventListener('click', (e) => { e.preventDefault(); toast('請用滑鼠把這個按鈕「拖曳」到書籤列，不是點擊'); });
const imported = checkImport();
window.addEventListener('hashchange', () => { if (checkImport()) { route(); renderDisc(); } else route(); });
route();
if (imported && disc.length) { renderDisc(); $('#discOut').scrollIntoView({ block: 'start' }); toast(`收到 ${disc.length} 件新商品，請勾選要加入的`); }
