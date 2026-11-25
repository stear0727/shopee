// 橋接頁：/s/<代碼> 顯示預覽標籤（給 Threads 等平台產生美編卡片），真人載入後立刻轉到蝦皮分潤連結。
// /s/<代碼>/og.jpg：預覽圖。/api/bridge：建立／更新橋接頁與讀取點擊統計（存取規則同 /api/ai）。橋接頁建立後永久有效，沒有停用功能。
// 機器人與真人看到的是同一個頁面；轉址由 /bridge.js 執行（爬蟲不執行 JS，所以會讀到預覽標籤）。
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

// /:slug＝自訂網址（例如 /噴油不再一倒就太多）；preferStatic 讓首頁與 app.js 等靜態檔案優先
export const config = { path: ['/s/*', '/api/bridge', '/:slug'], preferStatic: true };
const RESERVED = new Set(['api', 's', 'index', 'admin', 'netlify']);

const CODE_RE = /^[A-Za-z0-9]{8}$/;
const MAX_IMG = 1_500_000;   // 預覽圖上限（base64 解碼後）
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-external|whatsapp|telegram|discord|slack|line-poker|linkedin|embedly|preview|curl|wget|python|okhttp|headless/i;
// 只允許轉到蝦皮網域，避免被拿來做任意轉址
const SHOPEE_RE = /(^|\.)shopee\.(tw|com|sg|ph|vn|com\.my|co\.th|co\.id|com\.br|com\.mx|com\.co|cl)$|^(shp\.ee|shope\.ee)$/i;
export const okDest = (u) => { try { const x = new URL(String(u)); return (x.protocol === 'https:' || x.protocol === 'http:') && SHOPEE_RE.test(x.hostname); } catch { return false; } };

const store = () => getStore({ name: 'shoopee-bridge', consistency: 'strong' });
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 自訂網址（中文標題）：只留中英文、數字與 -，空白轉 -，最多 30 字；不能跟 8 碼代碼同格式
const slugify = (s) => [...String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]+/gu, '').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '')].slice(0, 30).join('').replace(/-+$/, '');
// 自訂網址的儲存鍵：用雜湊（中文網址直接當鍵太長，本機 Windows 檔名會超過上限）
const aliasKey = (slug) => `a/${createHash('sha256').update(slug).digest('hex').slice(0, 32)}`;
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f]+/g, ' ').trim().slice(0, n);
const twDay = (t = Date.now()) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);
const newCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map((x) => a[x % a.length]).join(''); };
const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer-when-downgrade',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
};

// 點擊計數（只算真人：排除爬蟲與預覽抓取）
async function countClick(st, code) {
  const key = `c/${code}`, cur = (await st.get(key, { type: 'json' })) || { total: 0, days: {} }, d = twDay();
  cur.total = (cur.total || 0) + 1; cur.days = cur.days || {}; cur.days[d] = (cur.days[d] || 0) + 1; cur.last = Date.now();
  const keep = Object.keys(cur.days).sort().slice(-120); cur.days = Object.fromEntries(keep.map((k) => [k, cur.days[k]]));
  await st.setJSON(key, cur);
}

// Android 上的 Threads／Instagram 內建瀏覽器不會把蝦皮連結交給 APP：改用 intent 連結指定蝦皮 APP 開啟（沒裝 APP 就開網頁）
const SHOPEE_PKG = 'com.shopee.tw';
const IN_APP_ANDROID = (ua) => /Android/i.test(ua) && /Barcelona|Instagram/i.test(ua);
function intentUrl(dest) {
  try { const d = new URL(dest); return `intent://${d.host}${d.pathname}${d.search}#Intent;scheme=${d.protocol.slice(0, -1)};package=${SHOPEE_PKG};S.browser_fallback_url=${encodeURIComponent(dest)};end`; }
  catch { return ''; }
}
function page(rec, origin, ver, intent = '') {
  // ver：分享網址上的版本號（每次更新預覽圖都不同，讓 Facebook 當成新網址重新抓預覽）
  const url = (rec.slug ? `${origin}/${encodeURIComponent(rec.slug)}` : `${origin}/s/${rec.code}`) + (ver ? `?v=${ver}` : ''), img = `${origin}/s/${rec.code}/og.jpg?v=${rec.at}`;
  return `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(rec.title)}</title>
<meta name="description" content="${esc(rec.desc)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(rec.title)}">
<meta property="og:description" content="${esc(rec.desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(rec.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(rec.title)}">
<meta name="twitter:description" content="${esc(rec.desc)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="stylesheet" href="/bridge.css">
<script src="/bridge.js" defer></script>
</head><body>
<main class="bx">
<img src="/s/${esc(rec.code)}/og.jpg?v=${rec.at}" alt="" width="1200" height="630">
<h1>${esc(rec.title)}</h1>
<p class="go-msg">正在前往蝦皮…</p>
<a id="go" class="go" href="${esc(rec.dest)}"${intent ? ` data-intent="${esc(intent)}"` : ''} rel="nofollow sponsored noopener">前往${rec.kind === 'shop' ? '賣場' : '商品頁'}</a>
</main>
</body></html>`;
}

async function handle(req, context) {
  const u = new URL(req.url), st = store();
  // ---------- 公開：橋接頁與預覽圖 ----------
  const rootSlug = u.pathname !== '/api/bridge' && !u.pathname.startsWith('/s/') && /^\/[^/]+$/.test(u.pathname);
  if (u.pathname.startsWith('/s/') || rootSlug) {
    let [, , code, sub] = rootSlug ? ['', 's', u.pathname.slice(1)] : u.pathname.split('/');
    // 不是 8 碼代碼時，當作自訂網址（中文標題）查對應的代碼
    if (!CODE_RE.test(code || '') && !sub) {
      let s = ''; try { s = slugify(decodeURIComponent(code || '')); } catch {}
      const a = s && (await st.get(aliasKey(s), { type: 'json' }));
      if (a && CODE_RE.test(a.code)) code = a.code;
    }
    if (!CODE_RE.test(code || '')) return new Response('<!doctype html><meta charset="utf-8"><title>找不到連結</title><p>這個連結不存在。</p>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (sub === 'og.jpg' || sub === 'src.jpg') {
      // og.jpg：合成後的預覽圖；src.jpg：使用者上傳的原圖（再次編輯時載入）
      const buf = await st.get(`${sub === 'og.jpg' ? 'img' : 'src'}/${code}`, { type: 'arrayBuffer' });
      if (!buf) return new Response('Not found', { status: 404 });
      return new Response(buf, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (sub) return new Response('Not found', { status: 404 });
    const rec = await st.get(`b/${code}`, { type: 'json' });
    if (!rec || !okDest(rec.dest)) return new Response('<!doctype html><meta charset="utf-8"><title>找不到連結</title><p>這個連結不存在。</p>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (req.method === 'GET' && !BOT_RE.test(req.headers.get('user-agent') || '')) {
      const p = countClick(st, code).catch(() => {});
      if (context?.waitUntil) context.waitUntil(p); else await p;
      // Android 的 Threads／Instagram：回傳頁面，由 bridge.js 以 intent 開啟蝦皮 APP
      const it = IN_APP_ANDROID(req.headers.get('user-agent') || '') ? intentUrl(rec.dest) : '';
      if (it) return new Response(page(rec, u.origin, '', it), { headers: { ...PAGE_HEADERS, 'Cache-Control': 'no-store' } });
      // 其他真人：伺服器直接轉址到分潤連結，不先顯示本站頁面
      return new Response(null, { status: 302, headers: { Location: rec.dest, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
    }
    // 平台預覽抓取（機器人）：給預覽圖與標題的頁面（頁面裡仍有轉址備援）
    return new Response(page(rec, u.origin, /^[a-z0-9]{1,12}$/.test(u.searchParams.get('v') || '') ? u.searchParams.get('v') : ''), { headers: PAGE_HEADERS });
  }

  // ---------- 管理：/api/bridge ----------
  if (u.pathname !== '/api/bridge') return new Response('<!doctype html><meta charset="utf-8"><title>找不到頁面</title><p>這個頁面不存在。</p>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get('x-access-code') !== code) return json(401, { ok: false, error: '存取碼錯誤或未填寫' });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const raw = await req.text();
  if (raw.length > MAX_IMG * 2 * 1.4 + 20000) return json(413, { ok: false, error: '資料過大' });
  let b; try { b = JSON.parse(raw); } catch { return json(400, { ok: false, error: '請求格式錯誤' }); }

  if (b.action === 'save') {
    const dest = clean(b.dest, 2000), title = clean(b.title, 80), desc = clean(b.desc, 300);
    if (!okDest(dest)) return json(400, { ok: false, error: '橋接頁只支援蝦皮的連結（shopee／shp.ee）' });
    if (!title) return json(400, { ok: false, error: '請填寫標題' });
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
    if (!m) return json(400, { ok: false, error: '預覽圖格式不符' });
    const img = Buffer.from(m[1], 'base64');
    if (img.length > MAX_IMG || img[0] !== 0xff || img[1] !== 0xd8) return json(400, { ok: false, error: '預覽圖格式或大小不符' });
    // 上傳的原圖：字串＝更新、null＝移除、未帶＝不變
    let photo;
    if (typeof b.photo === 'string') {
      const pm = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(b.photo);
      photo = pm && Buffer.from(pm[1], 'base64');
      if (!photo || photo.length > MAX_IMG || photo[0] !== 0xff || photo[1] !== 0xd8) return json(400, { ok: false, error: '上傳的圖片格式或大小不符' });
    }
    let c = CODE_RE.test(b.code || '') ? b.code : '';
    // 同一個連結只建立一個橋接頁：已存在就沿用原本的代碼（避免清單重建或換裝置後重複建立）
    if (!c) {
      const { blobs } = await st.list({ prefix: 'b/' });
      const old = (await Promise.all(blobs.slice(0, 1000).map((x) => st.get(x.key, { type: 'json' })))).filter((r) => r && r.dest === dest && CODE_RE.test(r.code)).sort((x, y) => (y.at || 0) - (x.at || 0))[0];
      if (old) c = old.code;
    }
    if (!c) { for (let k = 0; k < 5 && !c; k++) { const t = newCode(); if (!(await st.get(`b/${t}`, { type: 'json' }))) c = t; } }
    if (!c) return json(500, { ok: false, error: '無法產生代碼，請重試' });
    // 網址用圖上大字：被其他橋接頁用過時自動加上 -2、-3…（舊網址保留，已貼出去的連結不會壞）
    let slug = '';
    const base = slugify(b.slug);
    if (base && !RESERVED.has(base)) {
      for (let k = 1; k <= 30 && !slug; k++) {
        const t = k === 1 ? base : `${[...base].slice(0, 26).join('')}-${k}`;
        if (CODE_RE.test(t)) continue;
        const own = await st.get(aliasKey(t), { type: 'json' });
        if (!own || own.code === c) slug = t;
      }
    }
    const at = Date.now();
    await st.set(`img/${c}`, img);
    if (photo) await st.set(`src/${c}`, photo); else if (b.photo === null) await st.delete(`src/${c}`);
    if (slug) await st.setJSON(aliasKey(slug), { code: c, at, slug });
    await st.setJSON(`b/${c}`, { code: c, kind: b.kind === 'shop' ? 'shop' : 'item', title, desc, dest, at, ...(slug ? { slug } : {}) });
    return json(200, { ok: true, code: c, at, slug });
  }
  if (b.action === 'hide') {
    // 從點擊統計移除（只隱藏統計卡片；橋接頁本身永久有效，連結照常導向蝦皮）
    if (!CODE_RE.test(b.code || '')) return json(400, { ok: false, error: '代碼不正確' });
    const rec = await st.get(`b/${b.code}`, { type: 'json' });
    if (!rec) return json(404, { ok: false, error: '找不到這個橋接頁' });
    const { blobs } = await st.list({ prefix: 'b/' });
    const same = (await Promise.all(blobs.slice(0, 1000).map((x) => st.get(x.key, { type: 'json' })))).filter((r) => r && r.kind === rec.kind && r.dest === rec.dest);
    await Promise.all(same.map((r) => st.setJSON(`b/${r.code}`, { ...r, hidden: true })));
    return json(200, { ok: true });
  }
  if (b.action === 'stats') {
    // 列出所有橋接頁（商品或賣場刪除後橋接頁仍永久有效，統計也照樣列出）
    const { blobs } = await st.list({ prefix: 'b/' });
    const recs = (await Promise.all(blobs.slice(0, 1000).map((x) => st.get(x.key, { type: 'json' })))).filter((r) => r && CODE_RE.test(r.code) && !r.hidden);
    // 同一個連結有多個代碼（舊資料重複建立）時合併成一筆，點擊數加總
    const groups = new Map();
    for (const r of recs) { const k = `${r.kind}|${r.dest}`; (groups.get(k) || groups.set(k, []).get(k)).push(r); }
    const out = {};
    await Promise.all([...groups.values()].map(async (g) => {
      g.sort((x, y) => (y.at || 0) - (x.at || 0));
      const cs = await Promise.all(g.map((r) => st.get(`c/${r.code}`, { type: 'json' })));
      const days = {}; let total = 0, last = 0;
      for (const s of cs) { if (!s) continue; total += s.total || 0; last = Math.max(last, s.last || 0); for (const [d, n] of Object.entries(s.days || {})) days[d] = (days[d] || 0) + n; }
      out[g[0].code] = { total, days, last, title: g[0].title, kind: g[0].kind, at: g[0].at, slug: g[0].slug, codes: g.map((r) => r.code) };
    }));
    return json(200, { ok: true, stats: out, today: twDay() });
  }
  return json(400, { ok: false, error: '不支援的動作' });
}
// 任何未預期的錯誤都回傳 JSON（前端才能顯示看得懂的訊息）
export default async (req, context) => {
  try { return await handle(req, context); }
  catch (e) {
    console.error('bridge error', e);
    const api = new URL(req.url).pathname === '/api/bridge';
    return api ? json(500, { ok: false, error: '伺服器暫時無法存取橋接頁資料，請稍後再試' })
      : new Response('<!doctype html><meta charset="utf-8"><title>暫時無法開啟</title><p>連結暫時無法開啟，請稍後再試。</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '30' } });
  }
};
