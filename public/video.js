'use strict';
/* ========== 🎬 影片製作：商品實拍影片 → AI 拆格分析 → 風格分鏡 → 關鍵畫面檢查 → 瀏覽器算圖輸出 ==========
 * 與 app.js 共用全域（$、esc、store、S、ai、toast、opts、copy…），所以必須在 app.js 之後載入。
 * 這是獨立功能：不使用、也不修改「商品分析」的商品清單。每支影片是一個「影片專案」，
 * 專案資料存在這台瀏覽器的 localStorage（sp_vproj），實拍影片存在 IndexedDB，都不會上傳或雲端同步。
 * 畫面上的字幕、圖示、插畫、特效全部用 Canvas 自行繪製；配樂與音效用 WebAudio 即時合成，不使用外部素材。
 */
const VW = 1080, VH = 1920;
const VFONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","Heiti TC",sans-serif';
const N_FRAMES = 6, MAX_SRC_MB = 500, PROC_MAX = 1280;
const DEMO_NOTE = '※ 示意動畫，使用方式請依包裝說明';
const ROLES = { hook: '痛點開場', intro: '商品登場', point: '賣點', cta: '購買引導' };
const TRANS = { auto: '自動', whip: '快速甩鏡', zoom: '推進放大', wipe: '斜向擦除', circle: '圓形展開', heart: '愛心展開', glitch: '故障雜訊', flash: '白光閃切', fade: '淡入淡出' };
// 各風格適合的轉場：[商品登場用（最強烈）, …賣點之間輪流…, 結尾購買引導用]
const STYLE_TRANS = {
  weather: ['wipe', 'whip', 'zoom', 'wipe'], meme: ['zoom', 'whip', 'circle', 'flash'], trailer: ['flash', 'fade', 'zoom', 'fade'],
  neon: ['glitch', 'zoom', 'whip', 'glitch'], fighter: ['flash', 'whip', 'zoom', 'flash'], kraft: ['wipe', 'whip', 'wipe', 'circle'],
  thermal: ['glitch', 'zoom', 'glitch', 'flash'], dating: ['heart', 'whip', 'zoom', 'heart'],
};
const TR_DUR = 0.42;
const MOVES = { push: '推近', pull: '拉遠', panL: '向左平移', panR: '向右平移', panU: '向上平移', panD: '向下平移', static: '固定' };
const FXS = { bounce: '彈跳', flash: '閃光', shake: '震動', fade: '淡入', zoom: '衝擊放大' };
const BLUR_KIND = { price: '價格', date: '日期／有效期限', promo: '促銷吊牌', other_brand: '別家商品', character: '他人角色', person: '人臉／個資', other: '其他' };

/* ---------- 共用小工具 ---------- */
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const springy = (x) => { x = Math.max(0, x); return 1 - Math.exp(-6 * x) * Math.cos(10 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const secs = (n) => (n >= 60 ? `${Math.floor(n / 60)} 分 ${Math.round(n % 60)} 秒` : `${Math.max(0, Math.round(n))} 秒`);
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
function vProg(id, p, label) {
  const el = document.getElementById(id); if (!el) return;
  if (p == null) { el.innerHTML = ''; return; }
  let bar = el.querySelector('progress');
  if (!bar) { el.innerHTML = '<progress max="100" value="0"></progress><div class="vprog-l" aria-live="polite"></div>'; bar = el.querySelector('progress'); }
  if (p < 0) bar.removeAttribute('value'); else bar.value = Math.round(Math.min(1, p) * 1000) / 10;
  el.querySelector('.vprog-l').textContent = label || '';
}
function rrect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/* ---------- 實拍影片存在瀏覽器本機（IndexedDB） ---------- */
const IDB = {
  db: null,
  open() { return (this.db ||= new Promise((res, rej) => { const r = indexedDB.open('shoopee-video', 1); r.onupgradeneeded = () => r.result.createObjectStore('src'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async run(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const q = fn(db.transaction('src', mode).objectStore('src')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  get(k) { return this.run('readonly', (s) => s.get(k)); },
  set(k, v) { return this.run('readwrite', (s) => s.put(v, k)); },
  del(k) { return this.run('readwrite', (s) => s.delete(k)); },
};

/* ---------- 狀態 ---------- */
const V = (i) => {
  if (!i.video || i.video.ver !== 2) i.video = { ver: 2 };   // 舊版（照片模式）資料直接換新
  const v = i.video;
  v.blurOff ||= []; v.manualBlur ||= []; v.seconds ||= 17; v.style ??= '';
  v.manualBlur = v.manualBlur.map((m) => { const n = m.keys ? m : { id: m.id, label: m.label, keys: [{ t: 0, box: m.box }], track: null }; delete n.tracking; return n; });
  return v;
};
let vProjects = store.get('vproj', []);   // [{ id, name, createdAt, video }]
let vSel = store.get('vProjSel', '');
const vItem = () => vProjects.find((x) => x.id === vSel);
const newProject = () => ({ id: `vp${Date.now().toString(36)}`, name: '未命名影片', createdAt: new Date().toISOString(), video: { ver: 2 } });
const vSaveNow = () => store.set('vproj', vProjects);
let vBusy = '', vSaveT = 0;
const vSave = () => { clearTimeout(vSaveT); vSaveT = setTimeout(vSaveNow, 400); };
const vDirty = (v) => { v.checked = false; };   // 分鏡、文案、模糊有改動 → 需要重新檢查關鍵畫面
function vPick(id) { vStopAll(); vSel = id; store.set('vProjSel', vSel); thumbCache = { id: '', list: [] }; renderVideo(true); }

/* ---------- 影片元素 ---------- */
let srcUrl = '', srcFor = '';
async function srcURL(i) {
  if (srcFor === i.id && srcUrl) return srcUrl;
  if (srcUrl) URL.revokeObjectURL(srcUrl);
  srcUrl = ''; srcFor = i.id;
  const b = await IDB.get(i.id).catch(() => null);
  if (b) srcUrl = URL.createObjectURL(b);
  return srcUrl;
}
// 原始影片一律靜音：即使使用者在預覽播放器上把聲音打開，也會立刻再關掉
function forceMute(el) { el.muted = true; el.defaultMuted = true; el.volume = 0; el.addEventListener('volumechange', () => { if (!el.muted || el.volume) { el.muted = true; el.volume = 0; } }); return el; }
const UA = navigator.userAgent;
const IS_IOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const IS_MOBILE = IS_IOS || /Android|Mobile/i.test(UA);
// 電腦版 Chrome／Edge 的 H.264 編碼器第一次啟動較慢，才需要暖機（iOS 上的 Chrome 也是 Safari 核心，不需要）
const NEEDS_WARMUP = /Chrome\/|Edg\//.test(UA) && !IS_MOBILE;
function mkVideo(url) {
  const el = forceMute(document.createElement('video'));
  el.playsInline = true; el.setAttribute('playsinline', ''); el.setAttribute('muted', ''); el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = url;
  return el;
}
const waitEv = (el, ev, ms) => new Promise((res) => { const f = () => { el.removeEventListener(ev, f); clearTimeout(tm); res(); }; const tm = setTimeout(f, ms); el.addEventListener(ev, f); });
// iPhone（Safari）在影片真正播放之前不會解出任何畫面，畫到畫布上會是黑的：先靜音播放一下再暫停
const vidHolder = () => { let h = document.getElementById('vVidHolder'); if (!h) { h = document.createElement('div'); h.id = 'vVidHolder'; h.setAttribute('aria-hidden', 'true'); Object.assign(h.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', overflow: 'hidden', opacity: '0', pointerEvents: 'none' }); document.body.append(h); } return h; };
async function primeVideo(el) {
  if (el._primed) return; el._primed = true;
  if (!el.isConnected) { Object.assign(el.style, { width: '2px', height: '2px' }); vidHolder().append(el); }
  try { await el.play(); } catch { /* 不能播放時改用預設流程 */ }
  el.pause();
}
const vidReady = async (el) => {
  if (el.readyState < 1) await new Promise((res, rej) => {
    const ok = () => { el.removeEventListener('loadedmetadata', ok); res(); };
    el.addEventListener('loadedmetadata', ok);
    el.onerror = () => rej(new Error('這支影片在瀏覽器裡無法播放，請轉成 MP4（H.264）後再上傳'));
    setTimeout(res, 15000);
  });
  if (el.readyState < 2) { el.load?.(); }
  await primeVideo(el);
  if (el.readyState < 2) await waitEv(el, 'loadeddata', 8000);
};
// 等到新位置的畫面真的解出來（有 requestVideoFrameCallback 的瀏覽器會等到那一格畫面送出）
const frameReady = (el) => new Promise((res) => {
  if (!el.requestVideoFrameCallback) return setTimeout(res, IS_IOS ? 120 : 0);
  const tm = setTimeout(res, 600); el.requestVideoFrameCallback(() => { clearTimeout(tm); res(); });
});
function seekTo(el, t) {
  return new Promise((res) => {
    const target = Math.max(0, Math.min(t, (el.duration || 0) - 0.05));
    if (Math.abs(el.currentTime - target) < 0.01 && el.readyState >= 2) return res();
    const done = () => { el.removeEventListener('seeked', done); clearTimeout(tm); frameReady(el).then(res); };
    const tm = setTimeout(done, 4000);
    el.addEventListener('seeked', done); el.currentTime = target;
  });
}

/* ---------- 畫面縮圖（分析與檢查用） ---------- */
function grabSnap(el, max, q = 0.75) {
  const sc = Math.min(1, max / Math.max(el.videoWidth, el.videoHeight));
  const c = document.createElement('canvas'); c.width = Math.round(el.videoWidth * sc); c.height = Math.round(el.videoHeight * sc);
  c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
  return { canvas: c, data: c.toDataURL('image/jpeg', q) };
}
const frameTimes = (dur, n) => Array.from({ length: n }, (_, k) => Math.round((0.25 + (dur - 0.5) * (k + 0.5) / n) * 10) / 10);
let thumbCache = { id: '', list: [] };   // 分析用的畫面縮圖（只在記憶體，重新整理後會從本機影片重新擷取）
async function grabFrames(i, times, onStep) {
  const url = await srcURL(i); if (!url) throw new Error('這台裝置上找不到這支商品的實拍影片，請重新選擇影片檔');
  const el = mkVideo(url); await vidReady(el);
  const out = [];
  for (const [k, t] of times.entries()) { await seekTo(el, t); out.push(grabSnap(el, 512, 0.7)); onStep?.((k + 1) / times.length); }
  el.removeAttribute('src'); el.load(); el.remove();
  thumbCache = { id: i.id, list: out };
  return out;
}

/* ========== 風格 ==========
 * frame：實拍畫面在 1080×1920 中的位置；filter：調色（支援 canvas filter 的瀏覽器）；tint：不支援時用疊色近似
 * music：合成配樂參數；draw：自繪的字幕、圖示、介面與特效
 */
const STYLES = {
  weather: { name: '氣象播報', bg: '#0b2f5c', filter: 'saturate(1.12) brightness(1.05)', tint: ['#4aa3ff', 0.12, 'soft-light'],
    music: { bpm: 112, minor: false, root: 60, drums: 'pop', bass: 'roots', lead: 'arp8', bassWave: 'triangle', leadWave: 'triangle', amb: 'wind' } },
  meme: { name: '迷因爆笑', bg: '#111', filter: 'saturate(1.4) contrast(1.12)', tint: ['#ffd400', 0.12, 'overlay'],
    music: { bpm: 128, minor: false, root: 62, drums: 'pop', bass: 'bounce', lead: 'arp16', bassWave: 'square', leadWave: 'square', amb: '' } },
  trailer: { name: '電影預告', bg: '#000', filter: 'contrast(1.18) saturate(0.85) sepia(0.12)', tint: ['#0a4d5c', 0.28, 'soft-light'],
    music: { bpm: 84, minor: true, root: 50, drums: 'trailer', bass: 'drone', lead: 'none', bassWave: 'sawtooth', leadWave: 'triangle', amb: '' } },
  neon: { name: '深夜霓虹', bg: '#0a0614', filter: 'brightness(0.8) contrast(1.22) saturate(1.35) hue-rotate(-12deg)', tint: ['#7a2cff', 0.3, 'soft-light'],
    music: { bpm: 100, minor: true, root: 57, drums: 'halftime', bass: '8ths', lead: 'pad', bassWave: 'sawtooth', leadWave: 'sawtooth', amb: 'rain' } },
  fighter: { name: '格鬥遊戲對決', bg: '#120400', filter: 'saturate(1.3) contrast(1.16)', tint: ['#ff5a00', 0.15, 'overlay'],
    music: { bpm: 150, minor: true, root: 52, drums: '4floor', bass: '16ths', lead: 'arp16', bassWave: 'sawtooth', leadWave: 'square', amb: '' } },
  kraft: { name: '牛皮紙手繪', bg: '#c9a46b', filter: 'sepia(0.28) saturate(0.95) contrast(1.05)', tint: ['#b07a3a', 0.2, 'soft-light'], frame: [70, 150, 940, 1500],
    music: { bpm: 96, minor: false, root: 64, drums: 'claps', bass: 'roots', lead: 'arp8', bassWave: 'triangle', leadWave: 'triangle', amb: '' } },
  thermal: { name: '熱感應鏡頭', bg: '#000', thermal: true,
    music: { bpm: 120, minor: true, root: 55, drums: '4floor', bass: '8ths', lead: 'beep', bassWave: 'square', leadWave: 'sine', amb: 'hum' } },
  dating: { name: '交友配對', bg: '#ffe9f1', filter: 'saturate(1.12) brightness(1.06)', tint: ['#ff7aa8', 0.12, 'soft-light'], frame: [60, 190, 960, 1290], round: 44,
    music: { bpm: 116, minor: false, root: 65, drums: 'pop', bass: 'roots', lead: 'pad', bassWave: 'triangle', leadWave: 'triangle', amb: '' } },
};
const STYLE_OPTS = { '': '🤖 由 AI 依商品挑選', ...Object.fromEntries(Object.entries(STYLES).map(([k, s]) => [k, s.name])) };
const canFilter = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch { return false; } })();

/* ---------- 文字繪製（記錄版面位置，供關鍵畫面檢查重疊與超出範圍） ---------- */
function wrapLines(ctx, text, maxW, maxLines) {
  const lines = []; let cur = '';
  for (const ch of String(text)) { if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; }
  if (cur) lines.push(cur);
  return { lines: lines.slice(0, maxLines), cut: lines.length > maxLines };
}
function txt(ctx, S, tag, text, x, y, o = {}) {
  if (!text) return null;
  const size = o.size || 60, lh = size * (o.lh || 1.22);
  ctx.save();
  ctx.font = `${o.weight || 800} ${size}px ${o.font || VFONT}`;
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
  const { lines, cut } = wrapLines(ctx, text, o.maxW || 940, o.lines || 2);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)), h = lines.length * lh;
  const left = ctx.textAlign === 'center' ? x - w / 2 : ctx.textAlign === 'right' ? x - w : x;
  const top = y - h / 2;
  const padX = o.padX ?? 28, padY = o.padY ?? 14;
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (o.scale && o.scale !== 1) { ctx.translate(x, y); ctx.scale(o.scale, o.scale); ctx.translate(-x, -y); }
  if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); ctx.translate(-x, -y); }
  if (o.bg) { ctx.fillStyle = o.bg; rrect(ctx, left - padX, top - padY, w + padX * 2, h + padY * 2, o.radius ?? 18); ctx.fill(); }
  lines.forEach((l, n) => {
    const ly = top + lh * n + lh / 2;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 28; }
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW || size * 0.16; ctx.strokeText(l, x, ly); }
    ctx.fillStyle = o.color || '#fff'; ctx.fillText(l, x, ly);
    if (o.glow) { ctx.shadowBlur = (o.glowBlur || 28) / 2; ctx.fillText(l, x, ly); }
  });
  ctx.restore();
  const r = { tag, text, x: left - (o.bg ? padX : 0), y: top - (o.bg ? padY : 0), w: w + (o.bg ? padX * 2 : 0), h: h + (o.bg ? padY * 2 : 0), cut };
  S.layout.push(r);
  return r;
}
const box = (S, tag, x, y, w, h) => S.layout.push({ tag, x, y, w, h, ui: true });

/* ---------- 自繪圖示 ---------- */
function drawSun(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.8); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
  for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(r * 1.25, 0); ctx.lineTo(r * 1.65, 0); ctx.stroke(); }
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function drawCloud(ctx, x, y, r, rain, t) {
  ctx.save(); ctx.fillStyle = '#eef4ff';
  [[0, 0, 1], [-0.9, 0.25, 0.7], [0.9, 0.25, 0.75], [0.35, -0.35, 0.8]].forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * k, 0, Math.PI * 2); ctx.fill(); });
  if (rain) { ctx.strokeStyle = '#6fb6ff'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; for (let k = 0; k < 4; k++) { const ox = x - r * 0.9 + k * r * 0.6, oy = y + r * 1.05 + ((t * 2 + k * 0.3) % 1) * r * 0.6; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - r * 0.12, oy + r * 0.35); ctx.stroke(); } }
  ctx.restore();
}
function drawHeart(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -40, -60, 0, -30); ctx.bezierCurveTo(40, -60, 60, -10, 0, 30); ctx.fill(); ctx.restore();
}
function drawStar(ctx, x, y, r, n, color, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
  for (let k = 0; k < n * 2; k++) { const rr = k % 2 ? r * 0.5 : r, a = (k / (n * 2)) * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function wobblyLine(ctx, pts, seed, w, color) {
  const r = rng(seed); ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  pts.forEach(([x, y], k) => { const jx = (r() - 0.5) * 5, jy = (r() - 0.5) * 5; if (k) ctx.lineTo(x + jx, y + jy); else ctx.moveTo(x + jx, y + jy); });
  ctx.stroke(); ctx.restore();
}
function drawArrow(ctx, x1, y1, x2, y2, seed, color, w = 10) {
  wobblyLine(ctx, Array.from({ length: 9 }, (_, k) => [lerp(x1, x2, k / 8), lerp(y1, y2, k / 8) + Math.sin(k / 8 * Math.PI) * -30]), seed, w, color);
  const a = Math.atan2(y2 - y1, x2 - x1);
  wobblyLine(ctx, [[x2 - Math.cos(a - 0.5) * 50, y2 - Math.sin(a - 0.5) * 50], [x2, y2], [x2 - Math.cos(a + 0.5) * 50, y2 - Math.sin(a + 0.5) * 50]], seed + 1, w, color);
}

/* ---------- 各風格的自繪介面 ---------- */
const STYLE_DRAW = {
  weather(ctx, S) {
    const { t, lt, shot } = S;
    // 左上角台標（自創，不模仿真實電視台）
    ctx.save(); ctx.fillStyle = 'rgba(8,40,90,0.85)'; rrect(ctx, 40, 70, 410, 86, 16); ctx.fill();
    ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ff3b3b' : '#ff8a8a'; ctx.beginPath(); ctx.arc(84, 113, 14, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    box(S, '台標', 40, 70, 410, 86);
    txt(ctx, S, '台標文字', '商品氣象台 LIVE', 270, 113, { size: 40, weight: 800, color: '#fff' });
    // 右上天氣圖示：開場陰雨 → 之後放晴
    if (shot.role === 'hook') drawCloud(ctx, 900, 140, 52, true, t); else drawSun(ctx, 900, 135, 46, t);
    box(S, '天氣圖示', 820, 60, 160, 160);
    // 下方字幕條
    const slide = ease(lt / 0.35), y0 = 1430;
    ctx.save(); ctx.translate((1 - slide) * -1080, 0);
    const g = ctx.createLinearGradient(0, y0, 1080, y0); g.addColorStop(0, '#0b5cad'); g.addColorStop(1, '#1d8fe8');
    ctx.fillStyle = g; ctx.fillRect(0, y0, 1080, 190); ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, y0, 18, 190);
    ctx.fillStyle = 'rgba(232,241,255,0.95)'; ctx.fillRect(0, y0 + 190, 1080, 86);
    ctx.restore();
    box(S, '字幕條', 0, y0, 1080, 276);
    txt(ctx, S, '大字', S.caption, 560, y0 + 95, { size: 76, color: '#fff', maxW: 960, lines: 1, scale: S.pop });
    txt(ctx, S, '小字', S.sub, 560, y0 + 233, { size: 40, weight: 700, color: '#0b3f7a', maxW: 960, lines: 1 });
    // 跑馬燈
    ctx.save(); ctx.fillStyle = '#082a52'; ctx.fillRect(0, 1730, 1080, 70); ctx.beginPath(); ctx.rect(0, 1730, 1080, 70); ctx.clip();
    ctx.font = `700 36px ${VFONT}`; ctx.fillStyle = '#cfe6ff'; ctx.textBaseline = 'middle';
    const tk = `　◆　${S.ticker}`, tw = ctx.measureText(tk).width || 1, off = (t * 160) % tw;
    for (let x = -off; x < 1080; x += tw) ctx.fillText(tk, x, 1765);
    ctx.restore(); box(S, '跑馬燈', 0, 1730, 1080, 70);
  },
  meme(ctx, S) {
    const { lt, shot } = S;
    txt(ctx, S, '大字', S.caption, 540, 300, { size: 104, weight: 900, color: '#fff', stroke: '#000', strokeW: 16, maxW: 980, scale: S.pop, rot: Math.sin(lt * 9) * 0.015 });
    txt(ctx, S, '小字', S.sub, 540, 1600, { size: 62, weight: 900, color: '#ffe600', stroke: '#000', strokeW: 12, maxW: 980 });
    if (shot.role === 'point' || shot.role === 'cta') {
      const p = springy((lt - 0.25) / 0.5);
      if (p > 0) { drawStar(ctx, 880, 560, 120 * p, 12, '#ff2d55', lt); txt(ctx, S, '爆炸貼紙', shot.role === 'cta' ? '衝！' : '讚！', 880, 560, { size: 64 * Math.max(0.01, p), weight: 900, color: '#fff', stroke: '#000', strokeW: 8, maxW: 220, lines: 1 }); }
    }
    if (shot.role === 'hook') { const p = ease((lt - 0.3) / 0.3); if (p > 0) txt(ctx, S, '爆炸貼紙', '？？？', 200, 600, { size: 90, weight: 900, color: '#fff', stroke: '#000', strokeW: 12, alpha: p, rot: -0.2, lines: 1 }); }
  },
  trailer(ctx, S) {
    const { lt, d } = S;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 250); ctx.fillRect(0, 1670, 1080, 250);
    box(S, '黑邊', 0, 0, 1080, 250); box(S, '黑邊', 0, 1670, 1080, 250);
    const a = Math.min(ease(lt / 0.5), 1 - ease((lt - d + 0.35) / 0.35));
    txt(ctx, S, '大字', S.caption, 540, 960, { size: 92, weight: 900, color: '#f6e7c8', maxW: 940, alpha: a, glow: 'rgba(255,200,120,0.55)', glowBlur: 24, scale: 1 + 0.04 * (lt / d) });
    txt(ctx, S, '小字', S.sub, 540, 1110, { size: 44, weight: 600, color: '#e8e1d6', maxW: 900, alpha: a * 0.95, lines: 1 });
    txt(ctx, S, '片頭', S.k === 0 ? '本 季 生 活 必 備' : '', 540, 125, { size: 38, weight: 700, color: '#bfb6a8', alpha: a, lines: 1 });
  },
  neon(ctx, S) {
    const { t, lt } = S;
    const r = rng(7);
    ctx.save(); ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 70; k++) { const x = r() * 1080, sp = 900 + r() * 600, y = ((r() * 1920 + t * sp) % 2000) - 80; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 40); ctx.stroke(); }
    ctx.restore();
    const fl = (Math.floor(t * 12) % 17 === 0) ? 0.55 : 1;
    ctx.save(); ctx.strokeStyle = '#ff3ea5'; ctx.lineWidth = 8; ctx.shadowColor = '#ff3ea5'; ctx.shadowBlur = 30; ctx.globalAlpha = fl; rrect(ctx, 46, 60, 988, 1800, 40); ctx.stroke(); ctx.restore();
    txt(ctx, S, '大字', S.caption, 540, 1420, { size: 92, weight: 900, color: '#fff2fb', glow: '#ff3ea5', glowBlur: 40, maxW: 920, alpha: fl * ease(lt / 0.3), scale: S.pop });
    txt(ctx, S, '小字', S.sub, 540, 1590, { size: 48, weight: 800, color: '#e8fdff', glow: '#3ef2ff', glowBlur: 26, maxW: 900, lines: 1, alpha: ease((lt - 0.2) / 0.3) });
  },
  fighter(ctx, S) {
    const { lt, shot, k, n } = S;
    // 上方血條（自創對戰介面）：左＝生活困擾，右＝商品
    const hitsBefore = S.shots.slice(0, k).filter((s) => s.role === 'point').length + (shot.role === 'point' ? ease((lt - 0.3) / 0.3) : 0);
    const pts = Math.max(1, S.shots.filter((s) => s.role === 'point').length);
    const foe = shot.role === 'cta' ? 0 : Math.max(0.06, 1 - hitsBefore / (pts + 0.6));
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(30, 70, 1020, 110);
    const bar = (x, w, v, col, right) => { ctx.fillStyle = '#3a0000'; ctx.fillRect(x, 120, w, 36); ctx.fillStyle = col; const vw = w * v; ctx.fillRect(right ? x + w - vw : x, 120, vw, 36); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x, 120, w, 36); };
    bar(50, 420, foe, '#ff3b30', false); bar(610, 420, 1, '#ffd60a', true); ctx.restore();
    box(S, '血條', 30, 70, 1020, 110);
    txt(ctx, S, '血條文字', '生活困擾', 60, 96, { size: 30, weight: 900, color: '#fff', align: 'left', lines: 1, maxW: 300 });
    txt(ctx, S, '血條文字', S.short, 1020, 96, { size: 30, weight: 900, color: '#fff', align: 'right', lines: 1, maxW: 330 });
    txt(ctx, S, 'VS', 'VS', 540, 138, { size: 52, weight: 900, color: '#ffd60a', stroke: '#b00000', strokeW: 8, lines: 1 });
    // 大標語
    const call = shot.role === 'hook' ? 'ROUND 1' : shot.role === 'intro' ? 'FIGHT!' : shot.role === 'cta' ? 'K.O.!' : `COMBO ×${k}`;
    const p = springy((lt - 0.05) / 0.45), fade = 1 - ease((lt - 1.1) / 0.3);
    if (fade > 0 && p > 0) txt(ctx, S, '對戰標語', call, 540, 760, { size: 150, weight: 900, color: '#ffd60a', stroke: '#8b0000', strokeW: 18, scale: 0.4 + 0.6 * p, alpha: fade, lines: 1 });
    txt(ctx, S, '大字', S.caption, 540, 1500, { size: 84, weight: 900, color: '#fff', stroke: '#c1121f', strokeW: 14, maxW: 960, scale: S.pop, rot: -0.03 });
    txt(ctx, S, '小字', S.sub, 540, 1650, { size: 46, weight: 800, color: '#ffd60a', stroke: '#000', strokeW: 8, maxW: 940, lines: 1 });
    void n;
  },
  kraft(ctx, S) {
    const { lt, shot, k } = S;
    // 膠帶
    ctx.save(); ctx.fillStyle = 'rgba(255,245,210,0.7)';
    [[150, 160, -0.3], [930, 160, 0.3]].forEach(([x, y, a]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillRect(-90, -24, 180, 48); ctx.restore(); });
    ctx.restore();
    // 標題卡（手寫風）
    const p = ease(lt / 0.35);
    ctx.save(); ctx.translate(540, 1500); ctx.rotate(-0.025 + (k % 2) * 0.05); ctx.globalAlpha = p;
    ctx.fillStyle = '#fbf3e2'; ctx.shadowColor = 'rgba(60,40,10,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; ctx.fillRect(-460, -110, 920, 220); ctx.restore();
    box(S, '紙卡', 80, 1390, 920, 220);
    txt(ctx, S, '大字', S.caption, 540, 1470, { size: 76, weight: 900, color: '#4a2f12', maxW: 840, lines: 1, scale: S.pop });
    txt(ctx, S, '小字', S.sub, 540, 1555, { size: 42, weight: 700, color: '#7a5326', maxW: 840, lines: 1 });
    wobblyLine(ctx, Array.from({ length: 12 }, (_, q) => [180 + q * 65 * Math.min(1, p * 1.2), 1515]), 30 + k, 7, '#d9480f');
    // 手繪箭頭與星星（示意）
    if (shot.role === 'point' || shot.role === 'intro') { const a = ease((lt - 0.4) / 0.4); if (a > 0) { ctx.save(); ctx.globalAlpha = a; drawArrow(ctx, 860, 1360, 700, 1100, 50 + k, '#d9480f'); ctx.restore(); } }
    if (shot.role === 'cta') { const a = springy((lt - 0.3) / 0.6); if (a > 0) { drawStar(ctx, 200, 1300, 60 * a, 5, '#f59f00', 0.2); drawStar(ctx, 880, 1300, 48 * a, 5, '#f59f00', -0.3); } }
    txt(ctx, S, '頁碼', `${k + 1}／${S.n}`, 960, 1720, { size: 34, weight: 800, color: '#4a2f12', lines: 1 });
  },
  thermal(ctx, S) {
    const { t, lt } = S;
    ctx.save(); ctx.strokeStyle = '#e8fffb'; ctx.lineWidth = 6;
    [[60, 60, 1, 1], [1020, 60, -1, 1], [60, 1860, 1, -1], [1020, 1860, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * 90); ctx.lineTo(x, y); ctx.lineTo(x + sx * 90, y); ctx.stroke(); });
    const pr = 70 + Math.sin(t * 6) * 8; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(540, 820, pr, 0, Math.PI * 2); ctx.stroke();
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(540 + dx * (pr + 10), 820 + dy * (pr + 10)); ctx.lineTo(540 + dx * (pr + 50), 820 + dy * (pr + 50)); ctx.stroke(); });
    // 右側色階（無數字）
    const g = ctx.createLinearGradient(0, 300, 0, 1100); THERMAL_STOPS.slice().reverse().forEach(([p, c]) => g.addColorStop(p, c));
    ctx.fillStyle = g; ctx.fillRect(990, 300, 34, 800); ctx.strokeRect(990, 300, 34, 800); ctx.restore();
    box(S, '色階', 980, 290, 54, 820);
    txt(ctx, S, '介面', '熱感應模式', 110, 118, { size: 36, weight: 800, color: '#e8fffb', align: 'left', lines: 1 });
    if (Math.floor(t * 2) % 2) txt(ctx, S, '介面', '● 偵測中', 970, 118, { size: 36, weight: 800, color: '#ff5d5d', align: 'right', lines: 1 });
    txt(ctx, S, '大字', S.caption, 540, 1470, { size: 84, weight: 900, color: '#fff', bg: 'rgba(0,0,0,0.6)', maxW: 900, scale: S.pop, alpha: ease(lt / 0.25) });
    txt(ctx, S, '小字', S.sub, 540, 1630, { size: 44, weight: 700, color: '#ffe08a', bg: 'rgba(0,0,0,0.5)', maxW: 900, lines: 1 });
  },
  dating(ctx, S) {
    const { lt, shot, t } = S;
    // 上方自創介面（不模仿真實 App）
    drawHeart(ctx, 120, 112, 70, '#ff3d7f');
    txt(ctx, S, '介面', '好物配對中', 190, 112, { size: 44, weight: 900, color: '#ff3d7f', align: 'left', lines: 1 });
    // 卡片底部漸層＋文字
    const [fx, fy, fw, fh] = STYLES.dating.frame;
    ctx.save(); rrect(ctx, fx, fy, fw, fh, 44); ctx.clip();
    const g = ctx.createLinearGradient(0, fy + fh - 420, 0, fy + fh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)'); ctx.fillStyle = g; ctx.fillRect(fx, fy + fh - 420, fw, 420); ctx.restore();
    txt(ctx, S, '大字', S.caption, fx + 50, fy + fh - 170, { size: 74, weight: 900, color: '#fff', align: 'left', maxW: fw - 100, lines: 1, scale: S.pop });
    txt(ctx, S, '小字', S.sub, fx + 50, fy + fh - 80, { size: 42, weight: 700, color: '#ffe3ee', align: 'left', maxW: fw - 100, lines: 1 });
    // 下方按鈕（自繪）
    const btn = (x, col, icon, s) => { ctx.save(); ctx.translate(x, 1660); ctx.scale(s, s); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(200,60,110,0.3)'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (icon === 'x') { ctx.strokeStyle = col; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-28, -28); ctx.lineTo(28, 28); ctx.moveTo(28, -28); ctx.lineTo(-28, 28); ctx.stroke(); } else drawHeart(ctx, 0, 4, 80, col);
      ctx.restore(); };
    const like = shot.role === 'cta' || shot.role === 'point' ? 1 + 0.15 * Math.max(0, Math.sin(Math.min(1, (lt - 0.4) / 0.4) * Math.PI)) : 1;
    btn(360, '#9aa0a6', 'x', 1); btn(720, '#ff3d7f', 'h', like);
    box(S, '按鈕', 270, 1570, 540, 180);
    if (shot.role === 'cta') {
      const p = springy((lt - 0.2) / 0.6);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + t, rr = 160 + 220 * ease(lt / 1.2); drawHeart(ctx, 540 + Math.cos(a) * rr, 820 + Math.sin(a) * rr, 40 * Math.max(0, p), '#ff7aa8'); }
      if (p > 0) txt(ctx, S, '配對標語', '配對成功！', 540, 820, { size: 110, weight: 900, color: '#fff', stroke: '#ff3d7f', strokeW: 16, scale: 0.5 + 0.5 * p, lines: 1 });
    }
  },
};
const THERMAL_STOPS = [[0, '#000010'], [0.22, '#3a0a7a'], [0.45, '#c2185b'], [0.65, '#ff6d00'], [0.85, '#ffd600'], [1, '#ffffff']];
const THERMAL_LUT = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 0); THERMAL_STOPS.forEach(([p, col]) => g.addColorStop(p, col)); x.fillStyle = g; x.fillRect(0, 0, 256, 1);
  return x.getImageData(0, 0, 256, 1).data;
})();

/* ========== 追加的 22 種風格（全部自繪，不模仿真實節目、App 或品牌） ========== */
const SERIF = '"Noto Serif TC","PMingLiU","Songti TC",serif';
const MONO = `"Courier New",${VFONT}`;
const HAND = `"Segoe Print","Comic Sans MS",${VFONT}`;
const LAYERS = {};
// 不會變動的背景圖層只畫一次
function layer(key, draw) { if (!LAYERS[key]) { const c = document.createElement('canvas'); c.width = VW; c.height = VH; draw(c.getContext('2d')); LAYERS[key] = c; } return LAYERS[key]; }
const pointNo = (S) => S.shots.slice(0, S.k + 1).filter((s) => s.role === 'point').length;
const pointTotal = (S) => Math.max(1, S.shots.filter((s) => s.role === 'point').length);
function corners(ctx, x, y, w, h, L) { [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([a, b, sx, sy]) => { ctx.beginPath(); ctx.moveTo(a, b + sy * L); ctx.lineTo(a, b); ctx.lineTo(a + sx * L, b); ctx.stroke(); }); }
function leaf(ctx, x, y, s, a, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke(); ctx.restore(); }
function tickerBar(ctx, S, y, bg, color) {
  ctx.save(); ctx.fillStyle = bg; ctx.fillRect(0, y, VW, 70); ctx.beginPath(); ctx.rect(0, y, VW, 70); ctx.clip();
  ctx.font = `700 36px ${VFONT}`; ctx.fillStyle = color; ctx.textBaseline = 'middle';
  const tk = `　◆　${S.ticker || S.short}`, tw = ctx.measureText(tk).width || 1, off = (S.t * 160) % tw;
  for (let x = -off; x < VW; x += tw) ctx.fillText(tk, x, y + 35);
  ctx.restore(); box(S, '跑馬燈', 0, y, VW, 70);
}
// 共用字幕區：底色＋大字＋小字
function capBlock(ctx, S, o = {}) {
  const { y = 1460, h = 250, x = 0, w = VW, bg = '', radius = 0, cap = {}, sub = {} } = o, cx = o.cx ?? x + w / 2;
  const p = ease(S.lt / 0.3);
  if (bg) { ctx.save(); ctx.globalAlpha *= p; ctx.fillStyle = bg; rrect(ctx, x, y, w, h, radius); ctx.fill(); ctx.restore(); box(S, '字幕條', x, y, w, h); }
  txt(ctx, S, '大字', S.caption, cx, y + h * (S.sub ? 0.37 : 0.5), { size: 78, weight: 900, color: '#fff', maxW: w - 90, lines: 1, scale: S.pop, alpha: p, ...cap });
  txt(ctx, S, '小字', S.sub, cx, y + h * 0.77, { size: 42, weight: 700, color: '#fff', maxW: w - 90, lines: 1, alpha: p, ...sub });
}
const mkMusic = (bpm, minor, root, drums, bass, lead, bassWave, leadWave, amb = '') => ({ bpm, minor, root, drums, bass, lead, bassWave, leadWave, amb });

Object.assign(STYLES, {
  news: { name: '新聞快報', bg: '#0d1b2a', filter: 'contrast(1.08) saturate(1.05)', tint: ['#1d3557', 0.1, 'soft-light'], music: mkMusic(118, true, 57, '4floor', '8ths', 'beep', 'square', 'sine') },
  cooking: { name: '料理節目', bg: '#fff4e6', filter: 'saturate(1.18) brightness(1.05) sepia(0.08)', tint: ['#ff9f43', 0.12, 'soft-light'], frame: [60, 170, 960, 1180], round: 36, music: mkMusic(104, false, 62, 'claps', 'roots', 'arp8', 'triangle', 'triangle') },
  sports: { name: '體育轉播', bg: '#06240f', filter: 'saturate(1.25) contrast(1.1)', tint: ['#22c55e', 0.1, 'overlay'], music: mkMusic(132, false, 60, '4floor', 'bounce', 'arp16', 'square', 'square') },
  scifi: { name: '科幻全息', bg: '#020b14', filter: 'contrast(1.12) saturate(0.9) brightness(0.95)', tint: ['#00e5ff', 0.18, 'soft-light'], music: mkMusic(110, true, 57, 'halftime', 'drone', 'pad', 'sawtooth', 'sawtooth', 'hum') },
  retro: { name: '復古錄影帶', bg: '#000', filter: 'saturate(0.85) contrast(1.1) sepia(0.2)', tint: ['#ff9e7a', 0.12, 'soft-light'], music: mkMusic(96, false, 60, 'pop', 'roots', 'pad', 'sawtooth', 'sawtooth') },
  pixel: { name: '像素遊戲', bg: '#1b1b3a', filter: 'saturate(1.3) contrast(1.1)', tint: ['#7b2cbf', 0.1, 'overlay'], frame: [90, 260, 900, 1100], music: mkMusic(140, false, 72, 'pop', 'bounce', 'arp16', 'square', 'square') },
  comic: { name: '美式漫畫', bg: '#ffd60a', filter: 'saturate(1.35) contrast(1.2)', tint: ['#ff3b30', 0.1, 'overlay'], frame: [50, 120, 980, 1240], music: mkMusic(124, false, 62, 'pop', 'bounce', 'arp8', 'square', 'square') },
  magazine: { name: '時尚雜誌', bg: '#f4efe9', filter: 'contrast(1.05) saturate(0.95) brightness(1.04)', tint: ['#f4efe9', 0.08, 'soft-light'], music: mkMusic(98, false, 64, 'claps', 'roots', 'pad', 'triangle', 'sine') },
  minimal: { name: '極簡質感', bg: '#f7f7f5', filter: 'saturate(0.95) brightness(1.03)', tint: ['#ffffff', 0.06, 'soft-light'], frame: [90, 220, 900, 1180], round: 8, music: mkMusic(90, false, 65, '', 'drone', 'pad', 'sine', 'sine') },
  unbox: { name: '開箱實驗室', bg: '#e9f1f7', filter: 'brightness(1.05) contrast(1.05)', tint: ['#a8dadc', 0.1, 'soft-light'], music: mkMusic(112, false, 60, 'pop', '8ths', 'beep', 'triangle', 'sine') },
  detective: { name: '偵探辦案', bg: '#1a1410', filter: 'sepia(0.35) contrast(1.15) saturate(0.8)', tint: ['#7f5539', 0.2, 'soft-light'], music: mkMusic(88, true, 50, 'halftime', 'roots', 'pad', 'triangle', 'triangle') },
  space: { name: '太空任務', bg: '#03030f', filter: 'contrast(1.1) saturate(1.1)', tint: ['#4361ee', 0.12, 'soft-light'], frame: [60, 220, 960, 1150], round: 40, music: mkMusic(120, true, 55, 'halftime', 'drone', 'arp8', 'sawtooth', 'sine', 'hum') },
  cute: { name: '粉嫩可愛', bg: '#fff0f6', filter: 'saturate(1.1) brightness(1.08)', tint: ['#ffc2d9', 0.15, 'soft-light'], frame: [80, 220, 920, 1160], round: 60, music: mkMusic(120, false, 72, 'claps', 'bounce', 'arp8', 'triangle', 'sine') },
  guochao: { name: '國潮紅金', bg: '#8b0000', filter: 'saturate(1.15) contrast(1.08)', tint: ['#ff4d4d', 0.1, 'soft-light'], frame: [70, 230, 940, 1150], music: mkMusic(100, false, 62, 'claps', 'roots', 'arp8', 'triangle', 'triangle') },
  ocean: { name: '清新海洋', bg: '#d9f3ff', filter: 'saturate(1.08) brightness(1.06)', tint: ['#4cc9f0', 0.12, 'soft-light'], music: mkMusic(100, false, 64, 'pop', 'roots', 'pad', 'triangle', 'sine', 'rain') },
  forest: { name: '綠意自然', bg: '#e8f0e0', filter: 'saturate(1.05) sepia(0.08)', tint: ['#95d5b2', 0.12, 'soft-light'], frame: [70, 190, 940, 1180], round: 30, music: mkMusic(92, false, 62, 'claps', 'roots', 'arp8', 'triangle', 'triangle', 'wind') },
  polaroid: { name: '拍立得相簿', bg: '#efe6d8', filter: 'saturate(1.05) sepia(0.12) brightness(1.04)', tint: ['#f4a261', 0.1, 'soft-light'], frame: [130, 170, 820, 1080], music: mkMusic(100, false, 65, 'claps', 'roots', 'arp8', 'triangle', 'triangle') },
  chat: { name: '聊天訊息', bg: '#eef1f6', filter: 'saturate(1.05) brightness(1.03)', tint: ['#7c9cff', 0.08, 'soft-light'], frame: [70, 250, 780, 1040], round: 36, music: mkMusic(108, false, 67, 'pop', 'roots', 'beep', 'triangle', 'sine') },
  countdown: { name: '重點倒數', bg: '#0f0f0f', filter: 'contrast(1.12) saturate(1.15)', tint: ['#facc15', 0.1, 'overlay'], music: mkMusic(126, true, 57, '4floor', '16ths', 'arp16', 'sawtooth', 'square') },
  museum: { name: '展品鑑賞', bg: '#121212', filter: 'contrast(1.08) brightness(1.02)', tint: ['#ffe8c2', 0.1, 'soft-light'], frame: [140, 260, 800, 1050], music: mkMusic(76, false, 60, '', 'drone', 'pad', 'sine', 'triangle') },
  travel: { name: '旅行日誌', bg: '#f3e9d2', filter: 'saturate(1.1) sepia(0.1)', tint: ['#e9c46a', 0.1, 'soft-light'], frame: [70, 180, 940, 1160], round: 18, music: mkMusic(108, false, 64, 'pop', 'roots', 'arp8', 'triangle', 'triangle', 'wind') },
  stage: { name: '舞台聚光', bg: '#14000a', filter: 'contrast(1.12) saturate(1.1)', tint: ['#ffb703', 0.12, 'soft-light'], frame: [170, 260, 740, 1000], round: 20, music: mkMusic(118, false, 60, 'claps', 'roots', 'arp8', 'square', 'triangle') },
});
Object.assign(STYLE_TRANS, {
  news: ['flash', 'wipe', 'whip', 'flash'], cooking: ['circle', 'whip', 'wipe', 'circle'], sports: ['whip', 'zoom', 'whip', 'flash'], scifi: ['glitch', 'zoom', 'glitch', 'circle'],
  retro: ['glitch', 'fade', 'glitch', 'flash'], pixel: ['circle', 'whip', 'flash', 'circle'], comic: ['zoom', 'whip', 'circle', 'flash'], magazine: ['fade', 'wipe', 'fade', 'fade'],
  minimal: ['fade', 'fade', 'wipe', 'fade'], unbox: ['zoom', 'wipe', 'whip', 'circle'], detective: ['fade', 'wipe', 'zoom', 'flash'], space: ['zoom', 'circle', 'whip', 'flash'],
  cute: ['heart', 'circle', 'zoom', 'heart'], guochao: ['wipe', 'whip', 'circle', 'flash'], ocean: ['wipe', 'fade', 'circle', 'wipe'], forest: ['fade', 'wipe', 'circle', 'fade'],
  polaroid: ['whip', 'wipe', 'whip', 'circle'], chat: ['whip', 'wipe', 'whip', 'zoom'], countdown: ['flash', 'zoom', 'whip', 'flash'], museum: ['fade', 'fade', 'zoom', 'fade'],
  travel: ['whip', 'wipe', 'zoom', 'circle'], stage: ['circle', 'flash', 'zoom', 'flash'],
});
// 底層背景（畫在實拍畫面之下）
STYLES.comic.under = (ctx) => ctx.drawImage(layer('comic', (c) => { c.fillStyle = 'rgba(230,57,70,0.35)'; for (let y = 0; y < VH; y += 36) for (let x = ((y / 36) % 2) * 18; x < VW; x += 36) { c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); } }), 0, 0);
STYLES.space.under = (ctx) => ctx.drawImage(layer('space', (c) => { const r = rng(11); for (let q = 0; q < 260; q++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; c.beginPath(); c.arc(r() * VW, r() * VH, r() * 2.6 + 0.4, 0, Math.PI * 2); c.fill(); } }), 0, 0);
STYLES.polaroid.under = (ctx) => ctx.drawImage(layer('polaroid', (c) => {
  const r = rng(21); c.fillStyle = 'rgba(120,90,50,0.12)'; for (let q = 0; q < 900; q++) c.fillRect(r() * VW, r() * VH, 2 + r() * 4, 2 + r() * 4);
  c.save(); c.shadowColor = 'rgba(60,40,20,0.35)'; c.shadowBlur = 30; c.shadowOffsetY = 12; c.fillStyle = '#fffdf8'; c.fillRect(100, 140, 880, 1500); c.restore();
}), 0, 0);
STYLES.museum.under = (ctx) => ctx.drawImage(layer('museum', (c) => { const g = c.createRadialGradient(540, 700, 80, 540, 800, 900); g.addColorStop(0, 'rgba(255,236,200,0.35)'); g.addColorStop(1, 'rgba(255,236,200,0)'); c.fillStyle = g; c.fillRect(0, 0, VW, VH); }), 0, 0);
STYLES.stage.under = (ctx) => ctx.drawImage(layer('stage', (c) => {
  [[0, 1], [VW, -1]].forEach(([x0, dir]) => { for (let q = 0; q < 6; q++) { const x = x0 + dir * q * 26, l = Math.min(x, x + dir * 26); const g = c.createLinearGradient(l, 0, l + 26, 0); g.addColorStop(0, '#5c0011'); g.addColorStop(0.5, '#c1121f'); g.addColorStop(1, '#5c0011'); c.fillStyle = g; c.fillRect(l, 0, 26, VH); } });
  c.fillStyle = '#7a0019'; c.fillRect(0, 0, VW, 80); for (let x = 0; x < VW; x += 90) { c.beginPath(); c.arc(x + 45, 80, 45, 0, Math.PI); c.fill(); }
  const g = c.createRadialGradient(540, 700, 60, 540, 760, 820); g.addColorStop(0, 'rgba(255,230,170,0.3)'); g.addColorStop(1, 'rgba(255,230,170,0)'); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
}), 0, 0);

Object.assign(STYLE_DRAW, {
  news(ctx, S) {
    const { t, lt } = S;
    ctx.save(); ctx.fillStyle = '#d62828'; ctx.fillRect(40, 70, 170, 76); ctx.fillStyle = 'rgba(10,20,40,0.82)'; ctx.fillRect(210, 70, 330, 76); ctx.restore();
    box(S, '台標', 40, 70, 500, 76);
    txt(ctx, S, '台標文字', Math.floor(t * 2) % 2 ? '快報' : 'LIVE', 125, 108, { size: 40, weight: 900, lines: 1, maxW: 150 });
    txt(ctx, S, '台標文字', '好物新聞台', 375, 108, { size: 38, weight: 800, lines: 1, maxW: 300 });
    const sl = ease(lt / 0.3);
    ctx.save(); ctx.translate((1 - sl) * -1100, 0);
    ctx.fillStyle = '#d62828'; ctx.fillRect(40, 1390, 280, 66); ctx.fillStyle = '#fff'; ctx.fillRect(40, 1456, 1000, 150); ctx.fillStyle = '#102a43'; ctx.fillRect(40, 1606, 1000, 84);
    ctx.restore();
    box(S, '字幕條', 40, 1390, 1000, 300);
    txt(ctx, S, '標籤', '即時好物快報', 180, 1423, { size: 34, weight: 900, lines: 1, maxW: 250, alpha: sl });
    txt(ctx, S, '大字', S.caption, 540, 1531, { size: 76, weight: 900, color: '#0d1b2a', maxW: 930, lines: 1, scale: S.pop, alpha: sl });
    txt(ctx, S, '小字', S.sub, 540, 1648, { size: 40, weight: 700, color: '#fff', maxW: 930, lines: 1, alpha: sl });
    tickerBar(ctx, S, 1720, '#d62828', '#fff');
  },
  cooking(ctx, S) {
    const { t, lt, shot } = S;
    ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8590c'; ctx.lineWidth = 5;
    [[-26, 0], [0, -14], [26, 0]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(110 + dx, 96 + dy, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    ctx.fillRect(84, 100, 52, 34); ctx.strokeRect(84, 100, 52, 34); ctx.restore();
    txt(ctx, S, '介面', '今日好物廚房', 170, 108, { size: 46, weight: 900, color: '#c2410c', align: 'left', lines: 1 });
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (let q = 0; q < 3; q++) { const x = 820 + q * 70, ph = (t * 0.6 + q * 0.33) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8; ctx.beginPath(); for (let y = 0; y <= 120; y += 10) { const yy = 330 - ph * 80 - y, xx = x + Math.sin((y + t * 120) / 22) * 12; if (y) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); }
    ctx.restore();
    const p = ease(lt / 0.3);
    ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(160,80,20,0.25)'; ctx.shadowBlur = 24; rrect(ctx, 60, 1400, 960, 330, 30); ctx.fill(); ctx.shadowBlur = 0;
    ctx.setLineDash([16, 12]); ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 5; rrect(ctx, 80, 1420, 920, 290, 22); ctx.stroke(); ctx.restore();
    box(S, '紙卡', 60, 1400, 960, 330);
    const tag = shot.role === 'hook' ? '今天的煩惱' : shot.role === 'intro' ? '主角登場' : shot.role === 'cta' ? '完成上桌' : `STEP ${pointNo(S)}`;
    txt(ctx, S, '標籤', tag, 540, 1462, { size: 34, weight: 900, color: '#fff', bg: '#ff7a1a', padX: 22, padY: 6, radius: 30, lines: 1, alpha: p });
    txt(ctx, S, '大字', S.caption, 540, 1562, { size: 74, weight: 900, color: '#7c2d12', maxW: 860, lines: 1, scale: S.pop, alpha: p });
    txt(ctx, S, '小字', S.sub, 540, 1662, { size: 40, weight: 700, color: '#9a3412', maxW: 860, lines: 1, alpha: p });
  },
  sports(ctx, S) {
    const { lt, shot } = S;
    const got = S.shots.slice(0, S.k).filter((s) => s.role === 'point' || s.role === 'cta').length + ((shot.role === 'point' || shot.role === 'cta') && lt > 0.5 ? 1 : 0);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.78)'; rrect(ctx, 40, 70, 600, 96, 14); ctx.fill(); ctx.fillStyle = '#16a34a'; ctx.fillRect(40, 70, 14, 96); ctx.restore();
    box(S, '記分板', 40, 70, 600, 96);
    txt(ctx, S, '標籤', '生活困擾', 170, 118, { size: 34, weight: 900, lines: 1, maxW: 200 });
    txt(ctx, S, '標籤', `0 : ${got}`, 340, 118, { size: 50, weight: 900, color: '#facc15', lines: 1, maxW: 140 });
    txt(ctx, S, '標籤', S.short.slice(0, 5), 520, 118, { size: 34, weight: 900, lines: 1, maxW: 200 });
    txt(ctx, S, '介面', Math.floor(S.t * 2) % 2 ? '● LIVE' : '○ LIVE', 1030, 118, { size: 36, weight: 900, color: '#ef4444', align: 'right', lines: 1 });
    const call = { hook: '開賽！', intro: '上場！', point: '得分！', cta: '勝利！' }[shot.role] || '';
    const pp = springy((lt - 0.05) / 0.45), fd = 1 - ease((lt - 1.1) / 0.3);
    if (pp > 0 && fd > 0) txt(ctx, S, '對戰標語', call, 540, 720, { size: 140, weight: 900, color: '#fff', stroke: '#15803d', strokeW: 18, scale: 0.4 + 0.6 * pp, alpha: fd, lines: 1 });
    capBlock(ctx, S, { y: 1440, h: 260, bg: 'rgba(20,83,45,0.92)', sub: { color: '#facc15' } });
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 1440, VW, 8); ctx.restore();
  },
  scifi(ctx, S) {
    const { t, lt, shot } = S;
    ctx.save(); ctx.strokeStyle = '#5ef2ff'; ctx.lineWidth = 5; ctx.shadowColor = '#5ef2ff'; ctx.shadowBlur = 16;
    corners(ctx, 50, 50, 980, 1820, 80);
    const sy = 220 + ((t * 420) % 1100); ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(60, sy); ctx.lineTo(1020, sy); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.translate(540, 760); ctx.rotate(t * 0.8);
    for (let q = 0; q < 4; q++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.arc(0, 0, 170, 0.15, Math.PI / 2 - 0.15); ctx.stroke(); }
    ctx.restore();
    txt(ctx, S, '介面', 'HOLO SCAN', 110, 120, { size: 36, weight: 800, color: '#5ef2ff', align: 'left', lines: 1, font: MONO });
    txt(ctx, S, '介面', shot.role === 'hook' ? '搜尋中…' : shot.role === 'cta' ? '任務達成' : '目標鎖定', 970, 120, { size: 36, weight: 800, color: Math.floor(t * 3) % 2 ? '#5ef2ff' : '#b8fbff', align: 'right', lines: 1 });
    const prog = (S.k + Math.min(1, lt / S.d)) / S.n;
    ctx.save(); ctx.strokeStyle = '#5ef2ff'; ctx.lineWidth = 3; ctx.strokeRect(110, 170, 860, 18); ctx.fillStyle = 'rgba(94,242,255,0.7)'; ctx.fillRect(112, 172, 856 * prog, 14); ctx.restore();
    box(S, '進度條', 110, 170, 860, 18);
    txt(ctx, S, '大字', S.caption, 540, 1460, { size: 86, weight: 900, color: '#e6fdff', glow: '#00e5ff', glowBlur: 34, maxW: 920, lines: 1, scale: S.pop, alpha: ease(lt / 0.3) });
    txt(ctx, S, '小字', S.sub, 540, 1600, { size: 44, weight: 700, color: '#bdf6ff', bg: 'rgba(0,30,45,0.6)', maxW: 900, lines: 1, alpha: ease((lt - 0.15) / 0.3) });
  },
  retro(ctx, S) {
    const { t, lt } = S;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < VH; y += 6) ctx.fillRect(0, y, VW, 2);
    const by = (t * 260) % 2200 - 140, g = ctx.createLinearGradient(0, by, 0, by + 120); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, by, VW, 120);
    ctx.restore();
    if (Math.floor(t * 1.5) % 2 === 0) txt(ctx, S, '介面', '▶ PLAY', 80, 120, { size: 54, weight: 900, color: '#fff', align: 'left', lines: 1, font: MONO, glow: 'rgba(255,255,255,0.6)', glowBlur: 8 });
    txt(ctx, S, '介面', 'SP', 1000, 120, { size: 54, weight: 900, color: '#fff', align: 'right', lines: 1, font: MONO });
    const a = ease(lt / 0.25), jx = Math.sin(t * 40) * 2, o = { size: 88, weight: 900, maxW: 940, lines: 1, scale: S.pop, font: MONO };
    txt(ctx, S, '大字', S.caption, 535 + jx, 1480, { ...o, color: '#ff2a6d', alpha: a * 0.8 });
    txt(ctx, S, '大字', S.caption, 545 + jx, 1480, { ...o, color: '#05d9e8', alpha: a * 0.8 });
    txt(ctx, S, '大字', S.caption, 540 + jx, 1480, { ...o, color: '#fff7d6', alpha: a });
    txt(ctx, S, '小字', S.sub, 540, 1620, { size: 46, weight: 800, color: '#ffe066', bg: 'rgba(0,0,0,0.55)', maxW: 900, lines: 1, alpha: a, font: MONO });
  },
  pixel(ctx, S) {
    const { t, lt, shot } = S, [fx, fy, fw, fh] = STYLES.pixel.frame;
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 14; ctx.strokeRect(fx - 7, fy - 7, fw + 14, fh + 14); ctx.strokeStyle = '#000'; ctx.lineWidth = 8; ctx.strokeRect(fx - 18, fy - 18, fw + 36, fh + 36);
    ctx.fillStyle = '#1b1b3a'; [[fx - 22, fy - 22], [fx + fw + 8, fy - 22], [fx - 22, fy + fh + 8], [fx + fw + 8, fy + fh + 8]].forEach(([x, y]) => ctx.fillRect(x, y, 14, 14)); ctx.restore();
    txt(ctx, S, '介面', '1P', 100, 140, { size: 52, weight: 900, color: '#ffd60a', align: 'left', lines: 1, font: MONO });
    for (let q = 0; q < 3; q++) drawHeart(ctx, 210 + q * 66, 146, 56, '#ff4d6d');
    txt(ctx, S, '介面', `★×${String(pointNo(S)).padStart(2, '0')}`, 990, 140, { size: 52, weight: 900, color: '#ffd60a', align: 'right', lines: 1, font: MONO });
    if (shot.role === 'point' && lt > 0.3 && lt < 1.3) txt(ctx, S, '爆炸貼紙', '+1 UP', 800, 520 - (lt - 0.3) * 120, { size: 60, weight: 900, color: '#7CFC00', stroke: '#000', strokeW: 8, lines: 1, font: MONO, alpha: 1 - ease((lt - 1) / 0.3) });
    const p = ease(lt / 0.25);
    ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = '#000'; ctx.fillRect(60, 1420, 960, 300); ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.strokeRect(74, 1434, 932, 272); ctx.restore();
    box(S, '字幕條', 60, 1420, 960, 300);
    const chars = [...(S.caption || '')], n = Math.floor(lt / 0.05);
    txt(ctx, S, '大字', chars.slice(0, n).join(''), 110, 1520, { size: 70, weight: 900, color: '#fff', align: 'left', maxW: 860, lines: 1, font: MONO });
    txt(ctx, S, '小字', S.sub, 110, 1630, { size: 40, weight: 700, color: '#9be7ff', align: 'left', maxW: 860, lines: 1, font: MONO, alpha: n > chars.length ? 1 : 0 });
    if (Math.floor(t * 3) % 2) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(950, 1672); ctx.lineTo(980, 1672); ctx.lineTo(965, 1692); ctx.fill(); }
  },
  comic(ctx, S) {
    const { lt, shot, k } = S, [fx, fy, fw, fh] = STYLES.comic.frame;
    ctx.save(); ctx.strokeStyle = '#111'; ctx.lineWidth = 14; ctx.strokeRect(fx, fy, fw, fh); ctx.restore();
    txt(ctx, S, '介面', shot.role === 'hook' ? '某天……' : shot.role === 'cta' ? '下一格，換你！' : `第 ${k + 1} 格`, fx + 24, fy + 52, { size: 40, weight: 900, color: '#111', bg: '#fff59d', padX: 18, padY: 8, radius: 0, align: 'left', lines: 1 });
    if (shot.role !== 'hook') {
      const p = springy((lt - 0.2) / 0.5);
      if (p > 0) { drawStar(ctx, 840, 420, 150 * p, 14, '#ff3b30', 0.2); drawStar(ctx, 840, 420, 120 * p, 14, '#ffd60a', 0.4); txt(ctx, S, '爆炸貼紙', ['POW!', 'WOW!', 'BAM!', 'YES!'][k % 4], 840, 420, { size: 70 * Math.max(0.01, p), weight: 900, color: '#111', lines: 1, rot: -0.15, font: `Impact,${VFONT}` }); }
    }
    const p = ease(lt / 0.25);
    ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 8;
    const ell = () => { ctx.beginPath(); ctx.ellipse(540, 1560, 500, 150, 0, 0, Math.PI * 2); }, tail = () => { ctx.beginPath(); ctx.moveTo(300, 1440); ctx.lineTo(240, 1340); ctx.lineTo(390, 1430); ctx.closePath(); };
    ell(); ctx.stroke(); tail(); ctx.stroke(); ell(); ctx.fill(); tail(); ctx.fill(); ctx.restore();
    box(S, '紙卡', 40, 1410, 1000, 300);
    txt(ctx, S, '大字', S.caption, 540, 1530, { size: 76, weight: 900, color: '#111', maxW: 820, lines: 1, scale: S.pop, alpha: p });
    txt(ctx, S, '小字', S.sub, 540, 1625, { size: 40, weight: 800, color: '#c1121f', maxW: 760, lines: 1, alpha: p });
  },
  magazine(ctx, S) {
    const { lt, k } = S;
    let g = ctx.createLinearGradient(0, 1150, 0, VH); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = g; ctx.fillRect(0, 1150, VW, 770);
    g = ctx.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 420);
    txt(ctx, S, '介面', '好物誌', 540, 190, { size: 170, weight: 900, color: '#fff', lines: 1, font: SERIF, glow: 'rgba(0,0,0,0.35)', glowBlur: 20 });
    txt(ctx, S, '介面', `ISSUE ${String(k + 1).padStart(2, '0')}　|　本期封面特輯`, 540, 330, { size: 34, weight: 700, color: '#fff', lines: 1 });
    const a = ease(lt / 0.4);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(80, 1430, 120 * a, 6); ctx.restore();
    txt(ctx, S, '大字', S.caption, 80, 1530, { size: 84, weight: 900, color: '#fff', align: 'left', maxW: 920, lines: 1, font: SERIF, alpha: a, scale: S.pop });
    txt(ctx, S, '小字', S.sub, 80, 1640, { size: 42, weight: 600, color: '#f1e4d3', align: 'left', maxW: 900, lines: 1, alpha: a });
  },
  minimal(ctx, S) {
    const { lt, k, n } = S, a = ease(lt / 0.5);
    txt(ctx, S, '介面', `${String(k + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`, 90, 140, { size: 34, weight: 500, color: '#555', align: 'left', lines: 1 });
    txt(ctx, S, '介面', S.short, 990, 140, { size: 34, weight: 500, color: '#555', align: 'right', lines: 1, maxW: 500 });
    ctx.save(); ctx.fillStyle = '#222'; ctx.fillRect(90, 1490, 60 * a, 3); ctx.restore();
    txt(ctx, S, '大字', S.caption, 90, 1570, { size: 66, weight: 700, color: '#1a1a1a', align: 'left', maxW: 900, lines: 1, alpha: a });
    txt(ctx, S, '小字', S.sub, 90, 1660, { size: 38, weight: 400, color: '#666', align: 'left', maxW: 900, lines: 1, alpha: ease((lt - 0.2) / 0.5) });
  },
  unbox(ctx, S) {
    const { lt, shot } = S;
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.92)'; rrect(ctx, 40, 60, 1000, 110, 24); ctx.fill();
    ctx.strokeStyle = '#0f4c81'; ctx.lineWidth = 6; ctx.fillStyle = '#7ed6c4'; ctx.beginPath(); ctx.moveTo(92, 82); ctx.lineTo(92, 106); ctx.lineTo(72, 146); ctx.lineTo(128, 146); ctx.lineTo(108, 106); ctx.lineTo(108, 82); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    box(S, '台標', 40, 60, 1000, 110);
    txt(ctx, S, '台標文字', '好物開箱實驗室', 150, 115, { size: 44, weight: 900, color: '#0f4c81', align: 'left', lines: 1 });
    txt(ctx, S, '台標文字', `檢查 ${Math.min(pointTotal(S), pointNo(S))}/${pointTotal(S)}`, 1010, 115, { size: 38, weight: 800, color: '#2a9d8f', align: 'right', lines: 1 });
    if (shot.role === 'point' || shot.role === 'cta') {
      const p = springy((lt - 0.3) / 0.5);
      if (p > 0) { const s = Math.max(0, Math.min(1.1, p)); ctx.save(); ctx.translate(900, 380); ctx.scale(s, s); ctx.fillStyle = '#2a9d8f'; ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-10, 32); ctx.lineTo(44, -30); ctx.stroke(); ctx.restore(); }
    }
    capBlock(ctx, S, { y: 1430, h: 260, x: 40, w: 1000, bg: 'rgba(255,255,255,0.94)', radius: 28, cap: { color: '#0f4c81' }, sub: { color: '#2a9d8f' } });
  },
  detective(ctx, S) {
    const { t, lt, shot } = S;
    const g = ctx.createRadialGradient(540, 900, 300, 540, 900, 1150); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    const mx = 540 + Math.sin(t * 0.9) * 180, my = 780 + Math.cos(t * 0.7) * 140;
    ctx.save(); ctx.strokeStyle = '#d4a373'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(mx, my, 120, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx + 90, my + 90); ctx.lineTo(mx + 190, my + 190); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.1)'; ctx.beginPath(); ctx.arc(mx, my, 112, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.fillStyle = '#e9d8a6'; ctx.fillRect(40, 70, 460, 90); ctx.restore(); box(S, '台標', 40, 70, 460, 90);
    txt(ctx, S, '台標文字', `CASE ${String(S.k + 1).padStart(2, '0')}　案件檔案`, 270, 115, { size: 38, weight: 900, color: '#3d2b1f', lines: 1, maxW: 420, font: MONO });
    ctx.save(); ctx.fillStyle = 'rgba(233,216,166,0.95)'; ctx.fillRect(60, 1420, 960, 290); ctx.restore(); box(S, '紙卡', 60, 1420, 960, 290);
    const chars = [...(S.caption || '')], n = Math.floor(lt / 0.06);
    txt(ctx, S, '大字', chars.slice(0, n).join(''), 100, 1520, { size: 70, weight: 900, color: '#3d2b1f', align: 'left', maxW: 880, lines: 1, font: MONO });
    txt(ctx, S, '小字', S.sub, 100, 1630, { size: 40, weight: 700, color: '#6b4f3a', align: 'left', maxW: 880, lines: 1, alpha: ease((lt - 0.6) / 0.3) });
    if (shot.role === 'cta') {
      const p = springy((lt - 0.4) / 0.5);
      if (p > 0) { const s = 1.6 - 0.6 * Math.min(1, p); ctx.save(); ctx.globalAlpha = Math.min(1, p) * 0.9; ctx.translate(820, 430); ctx.rotate(-0.2); ctx.scale(s, s); ctx.strokeStyle = '#c1121f'; ctx.lineWidth = 10; ctx.strokeRect(-140, -70, 280, 140); ctx.fillStyle = '#c1121f'; ctx.font = `900 96px ${VFONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('結案', 0, 4); ctx.restore(); }
    }
  },
  space(ctx, S) {
    const { t, lt, shot } = S;
    txt(ctx, S, '介面', '🚀 好物太空任務', 90, 130, { size: 42, weight: 900, color: '#e0e7ff', align: 'left', lines: 1 });
    txt(ctx, S, '介面', `MISSION ${S.k + 1}/${S.n}`, 990, 130, { size: 36, weight: 800, color: '#a5b4fc', align: 'right', lines: 1, font: MONO });
    if (shot.role !== 'point') {
      const seg = S.d / 3, hook = shot.role === 'hook';
      const word = hook ? String(3 - Math.min(2, Math.floor(lt / seg))) : shot.role === 'intro' ? '發射！' : '任務完成';
      const local = hook ? (lt % seg) / seg : lt, p = springy((hook ? local * seg : lt) / 0.4), fd = hook ? 1 - ease((local - 0.7) / 0.3) : 1 - ease((lt - 1.2) / 0.3);
      if (p > 0 && fd > 0) txt(ctx, S, '對戰標語', word, 540, 760, { size: hook ? 260 : 130, weight: 900, color: '#fff', glow: '#818cf8', glowBlur: 40, scale: 0.5 + 0.5 * p, alpha: fd, lines: 1 });
    }
    ctx.save(); ctx.strokeStyle = 'rgba(165,180,252,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([10, 14]); ctx.beginPath(); ctx.ellipse(540, 1450, 500, 60, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const ang = t * 1.4; ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(540 + Math.cos(ang) * 500, 1450 + Math.sin(ang) * 60, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    txt(ctx, S, '大字', S.caption, 540, 1550, { size: 80, weight: 900, color: '#fff', glow: '#6366f1', glowBlur: 30, maxW: 940, lines: 1, scale: S.pop, alpha: ease(lt / 0.3) });
    txt(ctx, S, '小字', S.sub, 540, 1670, { size: 42, weight: 700, color: '#c7d2fe', maxW: 920, lines: 1, alpha: ease((lt - 0.15) / 0.3) });
  },
  cute(ctx, S) {
    const { t, lt } = S;
    for (let q = 0; q < 9; q++) { const r = rng(q * 13 + 5), x = r() * 1000 + 40, y = r() * 1800 + 60, s = 18 + r() * 26; ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + q * 1.7); drawStar(ctx, x, y, s, 4, q % 2 ? '#ffd6e7' : '#fff59d', t * 0.5); ctx.restore(); }
    txt(ctx, S, '介面', '♡ 今日小確幸 ♡', 540, 130, { size: 48, weight: 900, color: '#ff5c8a', lines: 1 });
    const p = Math.max(0, Math.min(1.1, springy(lt / 0.5))), sc = 0.7 + 0.3 * p;
    ctx.save(); ctx.translate(540, 1570); ctx.scale(sc, sc); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(255,92,138,0.25)'; ctx.shadowBlur = 30;
    [[-330, 10, 120], [-150, -60, 140], [60, -70, 150], [270, -10, 130], [-240, 80, 110], [200, 80, 120], [0, 70, 150]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore(); box(S, '紙卡', 80, 1420, 920, 330);
    drawHeart(ctx, 150, 1450, 50, '#ff8fab'); drawHeart(ctx, 930, 1700, 40, '#ffb3c6');
    txt(ctx, S, '大字', S.caption, 540, 1530, { size: 72, weight: 900, color: '#ff4f81', maxW: 760, lines: 1, scale: S.pop });
    txt(ctx, S, '小字', S.sub, 540, 1635, { size: 40, weight: 700, color: '#a2678a', maxW: 740, lines: 1 });
  },
  guochao(ctx, S) {
    const { lt, shot } = S, [fx, fy, fw, fh] = STYLES.guochao.frame;
    ctx.save(); ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 8; ctx.strokeRect(fx - 16, fy - 16, fw + 32, fh + 32); ctx.lineWidth = 3; ctx.strokeRect(fx - 30, fy - 30, fw + 60, fh + 60);
    [[fx - 30, fy - 30], [fx + fw - 16, fy - 30], [fx - 30, fy + fh - 16], [fx + fw - 16, fy + fh - 16]].forEach(([x, y]) => { ctx.fillStyle = '#f5c542'; ctx.fillRect(x, y, 46, 46); ctx.fillStyle = '#8b0000'; ctx.fillRect(x + 12, y + 12, 22, 22); ctx.fillStyle = '#f5c542'; ctx.fillRect(x + 19, y + 19, 8, 8); });
    ctx.restore();
    txt(ctx, S, '介面', '好 物 上 新', 540, 140, { size: 60, weight: 900, color: '#f5c542', lines: 1, font: SERIF });
    if (shot.role === 'point' || shot.role === 'cta') { const p = springy((lt - 0.3) / 0.5); if (p > 0) txt(ctx, S, '印章', '好物', 900, 340, { size: 54, weight: 900, color: '#fff', bg: '#c1121f', padX: 18, padY: 14, radius: 8, rot: -0.12, scale: 1.6 - 0.6 * Math.min(1, p), alpha: Math.min(1, p), lines: 1, font: SERIF }); }
    const a = ease(lt / 0.35);
    txt(ctx, S, '大字', S.caption, 540, 1530, { size: 84, weight: 900, color: '#ffe9a8', stroke: '#5c0000', strokeW: 10, maxW: 940, lines: 1, font: SERIF, scale: S.pop, alpha: a });
    txt(ctx, S, '小字', S.sub, 540, 1650, { size: 42, weight: 700, color: '#ffd166', maxW: 920, lines: 1, alpha: a });
  },
  ocean(ctx, S) {
    const { t } = S;
    for (let q = 0; q < 14; q++) { const r = rng(q * 7 + 3), x = r() * VW, sp = 120 + r() * 160, y = 1900 - ((t * sp + r() * 1900) % 1900), rr = 8 + r() * 22; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + Math.sin(t * 2 + q) * 12, y, rr, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    const wave = (y0, amp, sp, col) => { ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, y0 + Math.sin(x / 140 + t * sp) * amp); ctx.lineTo(VW, VH); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    wave(1390, 22, 1.6, 'rgba(76,201,240,0.75)'); wave(1420, 18, -1.2, 'rgba(14,116,184,0.92)');
    box(S, '字幕條', 0, 1400, VW, 380);
    txt(ctx, S, '介面', '〜 清爽好物 〜', 540, 130, { size: 44, weight: 900, color: '#fff', bg: 'rgba(14,116,184,0.6)', radius: 40, lines: 1 });
    txt(ctx, S, '大字', S.caption, 540, 1545, { size: 80, weight: 900, color: '#fff', maxW: 940, lines: 1, scale: S.pop, alpha: ease(S.lt / 0.3) });
    txt(ctx, S, '小字', S.sub, 540, 1665, { size: 42, weight: 700, color: '#d0f4ff', maxW: 920, lines: 1, alpha: ease(S.lt / 0.3) });
  },
  forest(ctx, S) {
    const { t, lt } = S;
    for (let q = 0; q < 10; q++) { const r = rng(q * 31 + 9), x = r() * VW + Math.sin(t * 0.8 + q) * 60, y = ((t * (90 + r() * 80) + r() * 1920) % 2000) - 60; leaf(ctx, x, y, 22 + r() * 16, t * (0.8 + r()) + q, q % 3 ? '#74a957' : '#b5c99a'); }
    txt(ctx, S, '介面', '🌿 自然好生活', 540, 120, { size: 46, weight: 900, color: '#3a5a40', lines: 1 });
    const p = ease(lt / 0.35);
    ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = '#8b5e34'; rrect(ctx, 60, 1420, 960, 300, 26); ctx.fill(); ctx.strokeStyle = 'rgba(60,35,15,0.35)'; ctx.lineWidth = 3;
    for (let y = 1452; y < 1700; y += 34) { ctx.beginPath(); ctx.moveTo(90, y); ctx.bezierCurveTo(400, y + 8, 700, y - 8, 990, y); ctx.stroke(); }
    ctx.restore(); box(S, '紙卡', 60, 1420, 960, 300);
    txt(ctx, S, '大字', S.caption, 540, 1530, { size: 76, weight: 900, color: '#fff8e7', stroke: '#5a3a1a', strokeW: 8, maxW: 880, lines: 1, scale: S.pop, alpha: p });
    txt(ctx, S, '小字', S.sub, 540, 1645, { size: 42, weight: 700, color: '#f1dca7', maxW: 880, lines: 1, alpha: p });
  },
  polaroid(ctx, S) {
    const { lt, shot, k } = S;
    ctx.save(); ctx.fillStyle = 'rgba(255,228,150,0.75)'; [[220, 150, -0.35], [860, 150, 0.3]].forEach(([x, y, a]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillRect(-100, -26, 200, 52); ctx.restore(); }); ctx.restore();
    const a = ease(lt / 0.5);
    txt(ctx, S, '大字', S.caption, 540, 1400, { size: 72, weight: 800, color: '#2b2b2b', maxW: 800, lines: 1, font: HAND, alpha: a, scale: S.pop });
    ctx.save(); ctx.globalAlpha = a; wobblyLine(ctx, Array.from({ length: 10 }, (_, q) => [260 + q * 62 * a, 1455]), 70 + k, 6, '#e76f51'); ctx.restore();
    txt(ctx, S, '小字', S.sub, 540, 1515, { size: 40, weight: 700, color: '#7a5c3e', maxW: 800, lines: 1, alpha: ease((lt - 0.2) / 0.4) });
    if (shot.role === 'point') drawStar(ctx, 175, 1585, 30, 5, '#f59f00', 0.2);
    if (shot.role === 'cta') drawHeart(ctx, 175, 1585, 60, '#ff5c8a');
    txt(ctx, S, '介面', `No.${k + 1}`, 940, 1600, { size: 30, weight: 700, color: '#a08060', align: 'right', lines: 1 });
  },
  chat(ctx, S) {
    const { lt, t } = S;
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, 200); ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 198, VW, 2); ctx.fillStyle = '#7c9cff'; ctx.beginPath(); ctx.arc(110, 120, 44, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    box(S, '台標', 0, 0, VW, 200);
    txt(ctx, S, '台標文字', '好物分享群', 180, 105, { size: 44, weight: 900, color: '#1e293b', align: 'left', lines: 1 });
    txt(ctx, S, '台標文字', '● 線上', 180, 155, { size: 28, weight: 700, color: '#22c55e', align: 'left', lines: 1 });
    const p1 = springy((lt - 0.25) / 0.4), p2 = springy((lt - 0.65) / 0.4);
    if (p1 <= 0.02) { ctx.save(); ctx.fillStyle = '#4f7cff'; rrect(ctx, 850, 1380, 170, 84, 40); ctx.fill(); ctx.fillStyle = '#fff'; for (let q = 0; q < 3; q++) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + q)); ctx.beginPath(); ctx.arc(895 + q * 40, 1422, 10, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    txt(ctx, S, '大字', S.caption, 1020, 1420, { size: 64, weight: 800, color: '#fff', bg: '#4f7cff', padX: 34, padY: 22, radius: 40, align: 'right', maxW: 760, lines: 1, alpha: Math.max(0, Math.min(1, p1 * 2)), scale: Math.max(0.6, Math.min(1, 0.6 + 0.4 * p1)) });
    txt(ctx, S, '小字', S.sub, 60, 1590, { size: 42, weight: 700, color: '#1e293b', bg: '#fff', padX: 30, padY: 20, radius: 36, align: 'left', maxW: 760, lines: 1, alpha: Math.max(0, Math.min(1, p2 * 2)) });
  },
  countdown(ctx, S) {
    const { lt, shot } = S, no = pointTotal(S) - pointNo(S) + 1;
    const big = shot.role === 'point' ? String(no) : shot.role === 'hook' ? '?' : shot.role === 'intro' ? 'GO' : '!';
    const label = shot.role === 'point' ? `重點 ${no}` : shot.role === 'hook' ? '準備倒數' : shot.role === 'intro' ? '開始倒數' : '倒數完成';
    const p = Math.max(0, Math.min(1.1, springy((lt - 0.05) / 0.5)));
    ctx.save(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(170, 230, 120 * p, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    box(S, '標籤框', 50, 110, 240, 240);
    txt(ctx, S, '標籤', big, 170, 235, { size: 140, weight: 900, color: '#111', lines: 1, maxW: 200, scale: Math.max(0.01, Math.min(1, p)), font: `Impact,${VFONT}` });
    txt(ctx, S, '介面', label, 330, 230, { size: 56, weight: 900, color: '#fff', stroke: '#000', strokeW: 10, align: 'left', lines: 1 });
    capBlock(ctx, S, { y: 1440, h: 260, x: 40, w: 1000, bg: 'rgba(0,0,0,0.82)', radius: 20, sub: { color: '#facc15' } });
    ctx.save(); ctx.fillStyle = '#facc15'; ctx.fillRect(40, 1440, 16, 260); ctx.restore();
  },
  museum(ctx, S) {
    const { lt } = S, [fx, fy, fw, fh] = STYLES.museum.frame;
    ctx.save(); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 10; ctx.strokeRect(fx - 12, fy - 12, fw + 24, fh + 24); ctx.lineWidth = 2; ctx.strokeRect(fx - 28, fy - 28, fw + 56, fh + 56); ctx.restore();
    txt(ctx, S, '介面', '好 物 特 展', 540, 150, { size: 50, weight: 700, color: '#c9a227', lines: 1, font: SERIF });
    const a = ease(lt / 0.6);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#f5f1e8'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.fillRect(160, 1420, 760, 270); ctx.shadowBlur = 0; ctx.fillStyle = '#c9a227'; ctx.fillRect(470, 1566, 140, 3); ctx.restore();
    box(S, '紙卡', 160, 1420, 760, 270);
    txt(ctx, S, '大字', S.caption, 540, 1512, { size: 66, weight: 900, color: '#1f1a17', maxW: 680, lines: 1, font: SERIF, alpha: a });
    txt(ctx, S, '小字', S.sub, 540, 1620, { size: 36, weight: 600, color: '#6b625b', maxW: 680, lines: 1, alpha: a });
  },
  travel(ctx, S) {
    const { lt, shot } = S;
    const P = [[80, 120], [360, 40], [720, 200], [1000, 110]], u = Math.min(1, (S.k + Math.min(1, lt / S.d)) / S.n);
    const bz = (i) => (1 - u) ** 3 * P[0][i] + 3 * (1 - u) ** 2 * u * P[1][i] + 3 * (1 - u) * u * u * P[2][i] + u ** 3 * P[3][i];
    ctx.save(); ctx.strokeStyle = '#c8553d'; ctx.lineWidth = 5; ctx.setLineDash([18, 14]); ctx.beginPath(); ctx.moveTo(...P[0]); ctx.bezierCurveTo(...P[1], ...P[2], ...P[3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#2a6f97'; ctx.font = `64px ${VFONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✈', bz(0), bz(1)); ctx.restore();
    if (shot.role === 'point' || shot.role === 'cta') {
      const p = springy((lt - 0.3) / 0.5);
      if (p > 0) { const s = 1.5 - 0.5 * Math.min(1, p); ctx.save(); ctx.globalAlpha = Math.min(1, p) * 0.9; ctx.translate(880, 360); ctx.rotate(-0.25); ctx.scale(s, s); ctx.strokeStyle = '#2a6f97'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 84, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#2a6f97'; ctx.font = `900 44px ${VFONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(shot.role === 'cta' ? '出發！' : `STOP ${pointNo(S)}`, 0, 0); ctx.restore(); }
    }
    const a = ease(lt / 0.3);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#f6bd60'; rrect(ctx, 60, 1420, 960, 290, 30); ctx.fill(); ctx.fillStyle = '#f3e9d2'; ctx.beginPath(); ctx.arc(120, 1565, 22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#7a4f2a'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    box(S, '紙卡', 60, 1420, 960, 290);
    txt(ctx, S, '大字', S.caption, 580, 1522, { size: 74, weight: 900, color: '#3d2c1e', maxW: 800, lines: 1, scale: S.pop, alpha: a });
    txt(ctx, S, '小字', S.sub, 580, 1635, { size: 40, weight: 700, color: '#7a4f2a', maxW: 800, lines: 1, alpha: a });
  },
  stage(ctx, S) {
    const { t, lt, shot } = S;
    txt(ctx, S, '介面', '★ 好物登台 ★', 540, 180, { size: 54, weight: 900, color: '#ffe08a', glow: '#ffb703', glowBlur: 26, lines: 1 });
    const x0 = 120, y0 = 1390, w = 840, h = 310, p = ease(lt / 0.3), ph = Math.floor(t * 4) % 2;
    ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = '#2b0a12'; rrect(ctx, x0, y0, w, h, 26); ctx.fill(); ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 6; rrect(ctx, x0 + 18, y0 + 18, w - 36, h - 36, 18); ctx.stroke();
    let n = 0; const bulb = (x, y) => { ctx.fillStyle = n++ % 2 === ph ? '#fff3b0' : '#b8860b'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); };
    for (let x = x0 + 30; x <= x0 + w - 30; x += 40) { bulb(x, y0 + 6); bulb(x, y0 + h - 6); }
    for (let y = y0 + 40; y <= y0 + h - 40; y += 40) { bulb(x0 + 6, y); bulb(x0 + w - 6, y); }
    ctx.restore(); box(S, '紙卡', x0, y0, w, h);
    txt(ctx, S, '大字', S.caption, 540, 1505, { size: 72, weight: 900, color: '#fff6d5', glow: '#ffb703', glowBlur: 22, maxW: 740, lines: 1, scale: S.pop, alpha: p });
    txt(ctx, S, '小字', S.sub, 540, 1620, { size: 40, weight: 700, color: '#ffd166', maxW: 740, lines: 1, alpha: p });
    if (shot.role === 'cta') { const r = rng(99), cols = ['#ffb703', '#fb5607', '#ff006e', '#8338ec', '#3a86ff']; for (let q = 0; q < 46; q++) { const x = r() * VW, sp = 300 + r() * 300, y = -40 + ((lt * sp + r() * 300) % 1400), a = lt * 6 + q; ctx.save(); ctx.translate(x + Math.sin(a) * 20, y); ctx.rotate(a); ctx.fillStyle = cols[q % 5]; ctx.fillRect(-9, -5, 18, 10); ctx.restore(); } }
  },
});
for (const [k, s] of Object.entries(STYLES)) STYLE_OPTS[k] = s.name;

/* ========== 算圖 ========== */
const SHOT_MIN = 2.5, SHOT_MAX = 3.5;
function buildRender(i, srcEls) {
  const v = V(i), plan = v.plan, a = v.analysis;
  const st = STYLES[plan.style] || STYLES.weather;
  const dur = v.src?.duration || 10;
  let t = 0;
  const shots = plan.shots.map((s, k) => {
    const d = Math.min(SHOT_MAX, Math.max(SHOT_MIN, Number(s.dur) || 3));
    let start = Math.max(0, Math.min(Number(s.start) || 0, dur - 0.2)), rate = 1;
    if (start + d > dur) { if (dur >= d) start = dur - d; else { start = 0; rate = Math.max(0.4, dur / d); } }
    const o = { ...s, k, t0: t, d, srcStart: start, rate };
    t += d; return o;
  });
  const keep = a?.screen?.isRecording ? a.screen.keep : [0, 0, 1000, 1000];
  return { i, v, plan, st, shots, total: t, keep, boxesAt: (ts) => frameBoxesAt(v, ts), times: a?.times || [], els: srcEls || [], proc: null };
}
// 某個時間點的模糊框（在 AI 有標記的格子之間線性追蹤；超出範圍就沿用最近的位置，確保全程遮住）
function boxAt(tr, ts, times) {
  if (tr.fixed) return tr.boxes[0].box;
  const pts = tr.pts ? tr.pts.map((p) => ({ t: p.t, b: p.box })) : tr.boxes.map((b) => ({ t: times[b.f] ?? 0, b: b.box })).sort((x, y) => x.t - y.t);
  if (!pts.length) return null;
  if (ts <= pts[0].t) return pts[0].b;
  const last = pts[pts.length - 1]; if (ts >= last.t) return last.b;
  for (let k = 0; k < pts.length - 1; k++) {
    if (ts >= pts[k].t && ts <= pts[k + 1].t) { const q = (ts - pts[k].t) / Math.max(0.001, pts[k + 1].t - pts[k].t); return pts[k].b.map((n, m) => lerp(n, pts[k + 1].b[m], q)); }
  }
  return last.b;
}
function ensureProc(R, el) {
  const sw = el.videoWidth || 720, sh = el.videoHeight || 1280, sc = Math.min(1, PROC_MAX / Math.max(sw, sh));
  const pw = Math.round(sw * sc), ph = Math.round(sh * sc);
  if (!R.proc || R.proc.width !== pw || R.proc.height !== ph) {
    R.proc = document.createElement('canvas'); R.proc.width = pw; R.proc.height = ph;
    R.pctx = R.proc.getContext('2d', { willReadFrequently: !!R.st.thermal });
    R.small = document.createElement('canvas');
    R.therm = document.createElement('canvas'); R.therm.width = Math.round(pw / 5); R.therm.height = Math.round(ph / 5);
  }
}
// 把實拍畫面畫進處理畫布：調色 → 全程模糊 → （熱感應）
function processFrame(R, el, ts) {
  ensureProc(R, el);
  const { proc, pctx: c, st } = R, pw = proc.width, ph = proc.height;
  c.save(); if (canFilter && st.filter) c.filter = st.filter; c.drawImage(el, 0, 0, pw, ph); c.restore();
  if (!canFilter && st.tint) { c.save(); c.globalCompositeOperation = st.tint[2]; c.globalAlpha = st.tint[1]; c.fillStyle = st.tint[0]; c.fillRect(0, 0, pw, ph); c.restore(); }
  for (const b of R.boxesAt(ts)) {
    const pad = 0.04;
    let [y1, x1, y2, x2] = b; const bw = x2 - x1, bh = y2 - y1;
    x1 -= bw * pad; x2 += bw * pad; y1 -= bh * pad; y2 += bh * pad;
    const x = Math.max(0, x1 / 1000 * pw), y = Math.max(0, y1 / 1000 * ph), w = Math.min(pw, x2 / 1000 * pw) - x, h = Math.min(ph, y2 / 1000 * ph) - y;
    if (w < 2 || h < 2) continue;
    const s = R.small; s.width = Math.max(3, Math.round(w / 16)); s.height = Math.max(3, Math.round(h / 16));
    const sc = s.getContext('2d'); sc.imageSmoothingEnabled = true; sc.drawImage(proc, x, y, w, h, 0, 0, s.width, s.height);
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low'; c.drawImage(s, 0, 0, s.width, s.height, x, y, w, h); c.restore();
  }
  if (st.thermal) {
    const tc = R.therm, tx = tc.getContext('2d', { willReadFrequently: true });
    tx.drawImage(proc, 0, 0, tc.width, tc.height);
    const im = tx.getImageData(0, 0, tc.width, tc.height), d = im.data;
    for (let k = 0; k < d.length; k += 4) { const l = Math.min(255, Math.round((d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) * 1.1)) * 4; d[k] = THERMAL_LUT[l]; d[k + 1] = THERMAL_LUT[l + 1]; d[k + 2] = THERMAL_LUT[l + 2]; }
    tx.putImageData(im, 0, 0);
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(tc, 0, 0, pw, ph); c.restore();
  }
}
// 運鏡：在實拍畫面中取出符合版面比例的範圍，依推近／拉遠／平移移動
function camera(R, shot, lt, fr) {
  const pw = R.proc.width, ph = R.proc.height, [ky1, kx1, ky2, kx2] = R.keep;
  const kx = kx1 / 1000 * pw, ky = ky1 / 1000 * ph, kw = (kx2 - kx1) / 1000 * pw, kh = (ky2 - ky1) / 1000 * ph;
  const ar = fr[2] / fr[3];
  let cw, ch; if (kw / kh > ar) { ch = kh; cw = kh * ar; } else { cw = kw; ch = kw / ar; }
  const q = ease(lt / shot.d);
  let z = 1.04, ox = 0, oy = 0;
  switch (shot.move) {
    case 'push': z = lerp(1, 1.18, q); break;
    case 'pull': z = lerp(1.18, 1, q); break;
    case 'panL': z = 1.16; ox = lerp(0.9, -0.9, q); break;
    case 'panR': z = 1.16; ox = lerp(-0.9, 0.9, q); break;
    case 'panU': z = 1.16; oy = lerp(0.9, -0.9, q); break;
    case 'panD': z = 1.16; oy = lerp(-0.9, 0.9, q); break;
    default: break;
  }
  if (shot.fx === 'zoom') z *= 1 + 0.25 * (1 - ease(lt / 0.35));
  const vw = cw / z, vh = ch / z;
  let cx = kx + kw / 2 + ox * (cw - vw) / 2, cy = ky + kh / 2 + oy * (ch - vh) / 2;
  cx = Math.max(kx + vw / 2, Math.min(kx + kw - vw / 2, cx)); cy = Math.max(ky + vh / 2, Math.min(ky + kh - vh / 2, cy));
  return [cx - vw / 2, cy - vh / 2, vw, vh];
}
// 進入第 k 個分鏡時用的轉場（第 0 個沒有）
function trFor(R, k) {
  if (k < 1) return '';
  const s = R.shots[k]; if (s.tr && TRANS[s.tr] && s.tr !== 'auto') return s.tr;
  const list = STYLE_TRANS[R.plan.style] || STYLE_TRANS.weather;
  if (s.role === 'intro' || k === 1) return list[0];
  if (s.role === 'cta' || k === R.shots.length - 1) return list[list.length - 1];
  return list[1 + ((k - 2) % (list.length - 2))];
}
function heartPath(ctx, cx, cy, s) {
  ctx.moveTo(cx, cy + 0.3 * s); ctx.bezierCurveTo(cx - 0.6 * s, cy - 0.1 * s, cx - 0.4 * s, cy - 0.6 * s, cx, cy - 0.3 * s);
  ctx.bezierCurveTo(cx + 0.4 * s, cy - 0.6 * s, cx + 0.6 * s, cy - 0.1 * s, cx, cy + 0.3 * s); ctx.closePath();
}
// 把「上一個分鏡的最後畫面」依轉場方式疊在新分鏡上，q：0（全是舊畫面）→ 1（全是新畫面）
function applyTransition(ctx, out, type, q, seed) {
  const p = ease(q);
  ctx.save();
  switch (type) {
    case 'fade': ctx.globalAlpha = 1 - p; ctx.drawImage(out, 0, 0); break;
    case 'zoom': { const sc = 1 + 0.45 * p; ctx.globalAlpha = 1 - p; ctx.translate(VW / 2, VH / 2); ctx.scale(sc, sc); ctx.translate(-VW / 2, -VH / 2); ctx.drawImage(out, 0, 0); break; }
    case 'whip': { const x = -VW * p * 1.1; for (let n = 0; n < 5; n++) { ctx.globalAlpha = (1 - p) * (n === 0 ? 1 : 0.22); ctx.drawImage(out, x - n * 60 * p * 3, 0); } break; }
    case 'wipe': { const edge = -500 + (VW + 1000) * p; ctx.beginPath(); ctx.moveTo(edge, 0); ctx.lineTo(VW + 600, 0); ctx.lineTo(VW + 600, VH); ctx.lineTo(edge - 500, VH); ctx.closePath(); ctx.clip(); ctx.drawImage(out, 0, 0);
      ctx.restore(); ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(edge, 0); ctx.lineTo(edge - 500, VH); ctx.stroke(); break; }
    case 'circle': case 'heart': {
      const r = 2300 * p; ctx.beginPath(); ctx.rect(0, 0, VW, VH);
      if (type === 'circle') { ctx.moveTo(VW / 2 + r, VH / 2); ctx.arc(VW / 2, VH / 2, r, 0, Math.PI * 2, true); } else heartPath(ctx, VW / 2, VH / 2, r * 1.4);
      ctx.clip('evenodd'); ctx.drawImage(out, 0, 0); break; }
    case 'glitch': {
      const r = rng(seed + Math.floor(q * 12)); const a = 1 - p;
      for (let y = 0; y < VH; y += 60) { const h = 30 + r() * 90, dx = (r() - 0.5) * 220 * (0.4 + q); ctx.globalAlpha = a; ctx.drawImage(out, 0, y, VW, h, dx, y, VW, h); }
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * Math.sin(q * Math.PI);
      ctx.fillStyle = '#ff00aa'; ctx.fillRect(0, r() * VH, VW, 40); ctx.fillStyle = '#00e5ff'; ctx.fillRect(0, r() * VH, VW, 30); break; }
    case 'flash': default: {
      if (q < 0.5) { ctx.globalAlpha = 1 - q * 2; ctx.drawImage(out, 0, 0); }
      ctx.globalAlpha = 0.95 * Math.sin(Math.min(1, q) * Math.PI); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH); break; }
  }
  ctx.restore();
}
// 畫一格完整畫面：分鏡開頭的 TR_DUR 秒內，把上一個分鏡的最後畫面依轉場疊上去
function drawComposite(ctx, t, R, els) {
  const idx0 = R.shots.findIndex((s) => t < s.t0 + s.d), idx = idx0 === -1 ? R.shots.length - 1 : idx0;
  const s = R.shots[idx], lt = t - s.t0;
  if (idx > 0 && lt >= 0 && lt < TR_DUR) {
    const prev = R.shots[idx - 1];
    if (!R.buf) { R.buf = document.createElement('canvas'); R.buf.width = VW; R.buf.height = VH; }
    drawFrame(R.buf.getContext('2d'), prev.t0 + prev.d - 0.001, R, els ? els[(idx - 1) % 2] : undefined);   // 上一個分鏡的最後畫面
    drawFrame(ctx, t, R, els ? els[idx % 2] : undefined);
    applyTransition(ctx, R.buf, trFor(R, idx), lt / TR_DUR, idx * 97);
  } else drawFrame(ctx, t, R, els ? els[idx % 2] : undefined);
}
function drawFrame(ctx, t, R, elFor) {
  const { st, shots, v } = R;
  const idx = shots.findIndex((s) => t < s.t0 + s.d), shot = shots[idx === -1 ? shots.length - 1 : idx];
  const lt = Math.max(0, t - shot.t0);
  const el = elFor || R.els[shot.k % 2];
  ctx.save();
  ctx.fillStyle = st.bg; ctx.fillRect(0, 0, VW, VH);
  if (st === STYLES.kraft) {   // 牛皮紙紋理
    const r = rng(3); ctx.fillStyle = 'rgba(90,60,20,0.08)'; for (let q = 0; q < 500; q++) ctx.fillRect(r() * VW, r() * VH, 2 + r() * 3, 2 + r() * 3);
  }
  if (st.under) st.under(ctx, t);   // 部分風格的底層背景（星空、布幕、相紙…）
  // 震動
  if (!R.holding && shot.fx === 'shake' && lt < 0.45) { const a = (1 - lt / 0.45) * 16; ctx.translate(Math.sin(lt * 90) * a, Math.cos(lt * 70) * a); }
  const fr = st.frame || [0, 0, VW, VH];
  if (el && el.readyState >= 2) {
    processFrame(R, el, el.currentTime);
    const [sx, sy, sw, sh] = camera(R, shot, lt, fr);
    ctx.save();
    if (st.round) { ctx.shadowColor = 'rgba(200,60,110,0.3)'; ctx.shadowBlur = 40; ctx.fillStyle = '#fff'; rrect(ctx, fr[0], fr[1], fr[2], fr[3], st.round); ctx.fill(); ctx.shadowBlur = 0; rrect(ctx, fr[0], fr[1], fr[2], fr[3], st.round); ctx.clip(); }
    if (st === STYLES.kraft) { ctx.fillStyle = '#fbf3e2'; ctx.fillRect(fr[0] - 18, fr[1] - 18, fr[2] + 36, fr[3] + 36); }
    ctx.drawImage(R.proc, sx, sy, sw, sh, fr[0], fr[1], fr[2], fr[3]);
    ctx.restore();
  }
  // 自繪介面、字幕、特效
  const S = {
    t, lt, d: shot.d, k: shot.k, n: shots.length, shot, shots, layout: [],
    caption: shot.role === 'cta' && !shot.caption ? (R.plan.cta || '現在就入手！') : shot.caption,
    // 畫面上只用提示詞裡的資訊，不使用上傳的影片檔名
    sub: shot.sub, short: (R.plan.product || '本商品').slice(0, 10),
    ticker: (v.desc || R.plan.product || '').replace(/\s+/g, ' ').slice(0, 90),
    pop: shot.fx === 'bounce' ? 0.6 + 0.4 * springy((lt - 0.08) / 0.5) : 1,
  };
  STYLE_DRAW[R.plan.style] ? STYLE_DRAW[R.plan.style](ctx, S) : STYLE_DRAW.weather(ctx, S);
  // 結尾購買引導：統一加上醒目的按鈕字（若字幕本身不是引導語）
  if (shot.role === 'cta' && R.plan.cta && S.caption !== R.plan.cta) {
    const p = springy((lt - 0.5) / 0.5);
    if (p > 0) txt(ctx, S, '購買引導', R.plan.cta, 540, 1260, { size: 68, weight: 900, color: '#fff', bg: '#e8590c', padX: 44, padY: 20, radius: 50, maxW: 900, lines: 1, scale: 0.5 + 0.5 * p });
  }
  // 示意動畫與安全提醒（小字）
  if (shot.demo) txt(ctx, S, '示意註記', DEMO_NOTE, 540, 1862, { size: 28, weight: 600, color: '#fff', bg: 'rgba(0,0,0,0.55)', padX: 16, padY: 6, radius: 10, maxW: 1000, lines: 1 });
  if (shot.role === 'cta' && R.plan.safety) txt(ctx, S, '安全提醒', `⚠ ${R.plan.safety}`, 540, shot.demo ? 1810 : 1862, { size: 30, weight: 700, color: '#fff', bg: 'rgba(0,0,0,0.6)', padX: 16, padY: 6, radius: 10, maxW: 1000, lines: 1 });
  ctx.restore();
  // 轉場特效
  if (!R.holding && shot.fx === 'flash' && lt < 0.28) { ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - lt / 0.28)})`; ctx.fillRect(0, 0, VW, VH); }
  if (!R.holding && shot.fx === 'fade' && shot.k === 0 && lt < 0.35) { ctx.fillStyle = `rgba(0,0,0,${1 - lt / 0.35})`; ctx.fillRect(0, 0, VW, VH); }
  if (t > R.total - 0.35) { ctx.fillStyle = `rgba(0,0,0,${(t - (R.total - 0.35)) / 0.35})`; ctx.fillRect(0, 0, VW, VH); }
  return S;
}

/* ========== 合成配樂與音效（WebAudio，不使用現成音樂） ========== */
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let audioCtx = null;
const actx = () => (audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());
function synth(ac, R, out) {
  const M = R.st.music, T0 = ac.currentTime + 0.3, total = R.total, beat = 60 / M.bpm, s16 = beat / 4;
  const master = ac.createGain(); master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(out);
  const mus = ac.createGain(); mus.connect(master);
  mus.gain.setValueAtTime(0.0001, T0); mus.gain.exponentialRampToValueAtTime(0.5, T0 + 0.25);
  mus.gain.setValueAtTime(0.5, T0 + total - 0.7); mus.gain.linearRampToValueAtTime(0.0001, T0 + total);
  const fx = ac.createGain(); fx.gain.value = 0.85; fx.connect(master);
  const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const nd = nb.getChannelData(0); for (let k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
  const end = T0 + total + 0.1;
  const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  const osc = (type, f, t, dur, peak, dest, a = 0.005) => { if (t > end) return null; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); env(g, t, a, peak, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + a + dur + 0.05); return o; };
  const noise = (t, dur, peak, dest, type, f, q = 1) => { if (t > end) return null; const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nb; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; env(g, t, 0.003, peak, dur); s.connect(fl).connect(g).connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); return fl; };
  const kick = (t, v = 1) => { const o = osc('sine', 150, t, 0.3, 0.9 * v, mus, 0.002); o?.frequency.exponentialRampToValueAtTime(42, t + 0.12); };
  const snare = (t, v = 1) => { noise(t, 0.16, 0.45 * v, mus, 'highpass', 1400); osc('triangle', 190, t, 0.08, 0.25 * v, mus, 0.002); };
  const hat = (t, v = 1, open) => noise(t, open ? 0.16 : 0.04, 0.16 * v, mus, 'highpass', 7500);
  const clap = (t) => { [0, 0.012, 0.024].forEach((d) => noise(t + d, 0.09, 0.3, mus, 'bandpass', 1500, 1.4)); };
  const prog = M.minor ? [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]] : [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
  const bars = Math.ceil(total / (beat * 4)) + 1;
  for (let b = 0; b < bars; b++) {
    const bt = T0 + b * beat * 4, ch = prog[b % 4], root = M.root + ch[0] - 12;
    // 鼓
    for (let st = 0; st < 16; st++) {
      const t = bt + st * s16; if (t > end) break;
      const onBeat = st % 4 === 0, beatN = st / 4;
      if (M.drums === '4floor') { if (onBeat) kick(t); if (st === 4 || st === 12) snare(t); if (st % 2 === 0) hat(t, 0.8, st % 4 === 2); }
      else if (M.drums === 'pop') { if (st === 0 || st === 6 || st === 8) kick(t); if (st === 4 || st === 12) snare(t, 0.8); if (st % 2 === 0) hat(t, 0.6); }
      else if (M.drums === 'halftime') { if (st === 0 || st === 10) kick(t); if (st === 8) snare(t); if (st % 2 === 0) hat(t, 0.5, st === 14); }
      else if (M.drums === 'claps') { if (st === 0 || st === 8) kick(t, 0.7); if (st === 4 || st === 12) clap(t); if (st % 4 === 2) hat(t, 0.4); }
      else if (M.drums === 'trailer') { if (st === 0 && b % 2 === 0) { kick(t, 1.2); noise(t, 1.2, 0.25, mus, 'lowpass', 300); } if (st === 12 && b % 2 === 1) { const f = noise(t - beat * 2, beat * 2.4, 0.18, mus, 'bandpass', 300, 2); f?.frequency.exponentialRampToValueAtTime(5000, t + beat * 0.4); } }
      void beatN;
    }
    // 低音
    const bw = M.bassWave;
    if (M.bass === 'roots') { osc(bw, hz(root), bt, beat * 1.6, 0.3, mus); osc(bw, hz(root + 7), bt + beat * 2, beat * 1.6, 0.25, mus); }
    else if (M.bass === '8ths') for (let q = 0; q < 8; q++) osc(bw, hz(root), bt + q * beat / 2, beat * 0.4, 0.18, mus);
    else if (M.bass === '16ths') for (let q = 0; q < 16; q++) osc(bw, hz(root + (q % 4 === 3 ? 12 : 0)), bt + q * s16, s16 * 0.8, 0.14, mus);
    else if (M.bass === 'bounce') for (let q = 0; q < 8; q++) osc(bw, hz(root + (q % 2 ? 12 : 0)), bt + q * beat / 2, beat * 0.3, 0.15, mus);
    else if (M.bass === 'drone') osc(bw, hz(root - 12), bt, beat * 4, 0.22, mus, 0.4);
    // 旋律／和弦
    const notes = ch.map((n) => M.root + n + 12);
    if (M.lead === 'arp8') for (let q = 0; q < 8; q++) osc(M.leadWave, hz(notes[q % 3] + (q >= 4 ? 12 : 0)), bt + q * beat / 2, beat * 0.45, 0.09, mus);
    else if (M.lead === 'arp16') for (let q = 0; q < 16; q++) osc(M.leadWave, hz(notes[(q * 2) % 3] + 12), bt + q * s16, s16 * 0.7, 0.05, mus);
    else if (M.lead === 'pad') notes.forEach((n) => osc(M.leadWave, hz(n), bt, beat * 3.8, 0.045, mus, 0.4));
    else if (M.lead === 'beep') for (let q = 0; q < 4; q++) osc('sine', hz(notes[0] + 24), bt + q * beat, 0.06, 0.06, mus);
  }
  // 環境音
  if (M.amb) {
    const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
    const fl = ac.createBiquadFilter(), g = ac.createGain();
    if (M.amb === 'rain') { fl.type = 'highpass'; fl.frequency.value = 2500; g.gain.value = 0.05; }
    else if (M.amb === 'wind') { fl.type = 'bandpass'; fl.frequency.value = 500; fl.Q.value = 0.6; g.gain.value = 0.05; }
    else { fl.type = 'lowpass'; fl.frequency.value = 180; g.gain.value = 0.06; }
    s.connect(fl).connect(g).connect(mus); s.start(T0); s.stop(end);
  }
  // 音效：轉場、點擊、叮聲、衝擊
  const whoosh = (t) => { const f = noise(t, 0.35, 0.35, fx, 'bandpass', 400, 1.2); f?.frequency.exponentialRampToValueAtTime(4500, t + 0.3); };
  const pop = (t) => { const o = osc('sine', 620, t, 0.07, 0.35, fx, 0.002); o?.frequency.exponentialRampToValueAtTime(980, t + 0.05); };
  const ding = (t) => { osc('sine', 1318.5, t, 0.9, 0.22, fx); osc('sine', 1975.5, t, 0.6, 0.1, fx); };
  const impact = (t) => { const o = osc('sine', 90, t, 0.6, 0.8, fx, 0.003); o?.frequency.exponentialRampToValueAtTime(38, t + 0.4); noise(t, 0.25, 0.3, fx, 'lowpass', 900); };
  const heavy = R.plan.style === 'fighter' || R.plan.style === 'trailer';
  for (const s of R.shots) {
    const t = T0 + s.t0;
    if (s.k > 0) {
      const tr = trFor(R, s.k);
      if (tr === 'glitch') { for (let n = 0; n < 4; n++) osc('square', 180 + n * 260, t + n * 0.05, 0.04, 0.12, fx, 0.002); noise(t, 0.25, 0.2, fx, 'highpass', 3000); }
      else if (tr === 'flash') { impact(t); osc('sine', 2093, t, 0.4, 0.08, fx); }
      else if (tr === 'heart' || tr === 'circle') { whoosh(t - 0.08); osc('sine', 1568, t + 0.15, 0.5, 0.12, fx); }
      else if (tr === 'fade') { const f = noise(t - 0.1, 0.6, 0.12, fx, 'lowpass', 600); f?.frequency.exponentialRampToValueAtTime(200, t + 0.5); }
      else whoosh(t - 0.12);
    }
    if (s.caption || s.role === 'cta') pop(t + 0.12);
    if (s.role === 'point' || s.role === 'cta') ding(t + (heavy ? 0.35 : 0.3));
    if (s.fx === 'flash' || s.fx === 'shake' || (heavy && (s.role === 'intro' || s.role === 'cta'))) impact(t + 0.02);
  }
  return { T0, stop: () => { try { mus.gain.cancelScheduledValues(0); master.disconnect(); } catch { /* 已停止 */ } } };
}

/* ========== 檢查：版面、文案 ========== */
const RE_MONEY = /(NT\$|\$\s*\d|\d+\s*(元|塊)|折扣?\s*\d|\d+\s*折|特價|免運)/;
const RE_DATE = /(\d{2,4}\s*[\/.\-年]\s*\d{1,2}\s*[\/.\-月]\s*\d{1,2}|有效期|保存期限|到期|製造日)/;
const RE_CLAIM = /(治療|療效|根治|治癒|醫療|保證|第一|唯一|最有效|最好|100\s*%|百分之百|比.{0,6}(更|還)(好|強|有效))/;
// AI 常自行加上的形容詞：畫面文字有、但提示詞沒寫，就提醒使用者確認
const PUFF = ['大容量', '超大', '超好用', '好用', '超輕', '輕巧', '超值', '划算', '神器', '必備', '爆款', '熱銷', '人氣', '頂級', '高級', '神級', '超強', '強效', '快速', '耐用', '安全', '健康', '環保', '天然', '無毒', '專業', '最'];
function copyIssues(text) {
  const out = [];
  if (RE_MONEY.test(text)) out.push('疑似金額或優惠字樣（不要放價格）');
  if (RE_DATE.test(text)) out.push('疑似日期或期限字樣（不要放日期）');
  if (RE_CLAIM.test(text)) out.push('疑似療效、保證或比較性用語，請確認包裝上確實有寫');
  const prompt = String(vItem()?.video?.desc || '');
  const extra = PUFF.filter((w) => text.includes(w) && !prompt.includes(w));
  if (extra.length) out.push(`提示詞沒有寫到「${extra.join('、')}」，請確認是否正確或刪除`);
  return out;
}
function layoutIssues(S) {
  const out = [], L = S.layout.filter((r) => r.w > 0);
  for (const r of L) {
    if (r.cut) out.push(`「${r.text}」太長，超過可顯示的行數`);
    if (!r.ui && (r.x < 24 || r.x + r.w > VW - 24 || r.y < 40 || r.y + r.h > VH - 30)) out.push(`「${r.text || r.tag}」超出畫面安全範圍`);
  }
  const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  // 只檢查「文字」之間、或文字壓到別的介面元件；同一組介面本身的文字（例如字幕條上的字）不算
  const host = { 大字: ['字幕條', '紙卡'], 小字: ['字幕條', '紙卡'], 標籤: ['字幕條', '紙卡', '記分板', '標籤框', '台標'], 台標文字: ['台標'], 血條文字: ['血條'], VS: ['血條'], 片頭: ['黑邊'], 介面: [], 跑馬燈: [] };
  for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
    const A = L[a], B = L[b]; if (A.ui && B.ui) continue;
    const [T, U] = A.ui ? [B, A] : [A, B];
    if (U.ui && (host[T.tag] || []).includes(U.tag)) continue;
    if (!U.ui && T.tag === U.tag) continue;
    const ov = inter(A, B); if (ov > Math.min(A.w * A.h, B.w * B.h) * 0.08) out.push(`「${T.text || T.tag}」與「${U.text || U.tag}」重疊`);
  }
  return [...new Set(out)];
}

/* ========== 畫面 ========== */
function renderVideo(force) {
  const ae = document.activeElement;
  if (!force && ae && ae.closest?.('#vidBody') && ae.matches('input,textarea,select')) { pendingRender = true; return; }
  // 永遠只有一個目前的專案：沒有就自動建立（專案名稱自動用影片檔名）
  if (!vItem()) {
    if (!vProjects.length) vProjects.push(newProject());
    vSel = vProjects[vProjects.length - 1].id; store.set('vProjSel', vSel); vSaveNow();
  }
  const i = vItem();
  const v = V(i), plan = v.plan;
  if (v.src) ensurePrep(v);
  const a = v.analysis;
  const blocked = plan?.prohibited?.blocked;
  const ready = v.src && v.own && (v.desc || '').trim();
  const dur = plan ? plan.shots.reduce((t, s) => t + Math.min(SHOT_MAX, Math.max(SHOT_MIN, Number(s.dur) || 3)), 0) : 0;

  const srcCard = `<div class="card"><h2>1. 上傳商品實拍影片</h2>
    ${v.src ? `<p>🎞 ${esc(v.src.name)}｜${f1(v.src.duration)} 秒｜${v.src.w}×${v.src.h}｜${(v.src.size / 1048576).toFixed(1)} MB <span id="vSrcState" class="muted sm"></span></p><div class="vsrc"><video id="vSrcPrev" controls playsinline muted></video></div><p class="hint">🔇 原始影片的聲音已自動靜音，輸出只使用程式合成的配樂與音效。</p>` : ''}
    <div class="btns"><label class="btn${v.src ? '' : ' pri'}">${v.src ? '更換影片' : '選擇影片檔（MP4／MOV）'}<input class="vh" type="file" accept="video/*" data-vf="src"></label>${v.src ? '<button type="button" class="ghost" data-act="vNewProj">清除，重新開始</button>' : ''}</div>
    <p class="hint">影片只存在這台裝置的瀏覽器，不會上傳，也不會傳給 AI。</p>
    <label class="chk"><input type="checkbox" data-vg="own"${v.own ? ' checked' : ''}> 這支影片是我自己拍攝的，或已取得授權</label>
    <div id="vSrcProg" class="vprog-box"></div></div>`;

  const pCard = !v.src ? '' : `<div class="card"><h2>2. 提示詞與分鏡</h2>
    <label>提示詞（AI 會分析這段文字來設計風格、分鏡與文案）<textarea rows="5" maxlength="1500" data-vg="desc" placeholder="例如：ecoco 意可可 噴油壺 250ml，高硼硅玻璃瓶身，按壓就噴出細霧，不滴油不掛油，可裝橄欖油、醬油、醋。想要輕鬆有趣的感覺。">${esc(v.desc || '')}</textarea></label>
    <div class="row2"><label>風格<select data-vg="style">${opts(STYLE_OPTS, v.style)}</select></label><label>影片長度（14–19 秒）<input type="number" min="14" max="19" step="1" data-vg="seconds" value="${esc(v.seconds)}"></label></div>
    <div class="btns"><button type="button" class="pri" data-act="vPlan" id="vPlanBtn"${ready ? '' : ' disabled'}>${plan ? 'AI 重新設計分鏡' : 'AI 設計分鏡'}</button>${plan ? '<button type="button" data-act="vAddShot">新增分鏡</button>' : ''}</div>
    ${!v.own ? '<p class="hint warn">請先勾選上方的素材授權確認。</p>' : ''}
    <div id="vPlanProg" class="vprog-box"></div><div id="vPlanErr"></div>
    ${blocked ? `<div class="valert bad">⛔ 依台灣法規，這類商品不能製作廣告影片：${esc(plan.prohibited.reason)}</div>` : ''}
    ${plan ? planHtml(v, plan, dur) : ''}</div>`;

  const bCard = !v.src ? '' : `<div class="card"><h2>3. 遮蔽（選用） <span class="tag" id="vBlurCount">未框選</span></h2>
    <p class="hint">每張畫面各自框選：哪一張有價格標籤、日期／有效期限、促銷吊牌、別家商品或卡通角色，就在那一張上<b>拖曳</b>框起來。只有你框的地方會模糊，沒框的時間點不模糊；相鄰兩張在相近位置都有框時，框會在兩張之間平滑移動。</p>
    <p class="sm muted" id="vBCur"></p>
    <div class="vbstage" id="vBStage"><canvas id="vBCanvas" width="360" height="640" aria-label="在畫面上拖曳框出要模糊的範圍"></canvas></div>
    <div class="vframes vbthumbs" id="vFrames">${(a?.times || []).map((t, k) => `<button type="button" class="vbthumb${k === bSel ? ' on' : ''}" data-act="vBSel" data-k="${k}" aria-label="切換到 ${f1(t)} 秒的畫面"><canvas data-fr="${k}" width="120" height="213"></canvas><span>${f1(t)} 秒</span></button>`).join('')}</div>
    <div class="btns"><button type="button" data-act="vBCopyPrev">沿用上一張的框</button><button type="button" class="ghost" data-act="vBClear">清除這一張的框</button></div>
    <p class="hint">拖曳空白處＝新增框｜拖曳框內＝移動｜點框右上角的 ✕＝刪除｜點下方縮圖＝切換畫面。白色虛線是上一張框的位置（只是參考，不會模糊）。</p>
    <div id="vBlurProg" class="vprog-box"></div></div>`;

  const kCard = !plan ? '' : `<div class="card"><h2>4. 關鍵畫面檢查</h2>
    <p class="hint">先輸出每個分鏡的關鍵畫面，檢查文字重疊、超出範圍與模糊有沒有遮到；確認沒問題才能輸出完整影片。</p>
    <div class="btns"><button type="button" class="pri" data-act="vKeys"${blocked ? ' disabled' : ''}>產生關鍵畫面</button></div>
    <div id="vKeyProg" class="vprog-box"></div><div id="vKeys" class="vkeys"></div>
    <div class="btns"><button type="button" data-act="vKeysOk" id="vKeysOk"${v.checked ? '' : ' hidden'} disabled>✓ 已確認</button></div></div>`;

  const oCard = !plan ? '' : `<div class="card"><h2>5. 預覽與輸出</h2>
    <div class="vstage"><canvas id="vCanvas" width="${VW}" height="${VH}" aria-label="影片預覽"></canvas></div>
    <div class="btns"><button type="button" data-act="vPlay"${blocked ? ' disabled' : ''}>▶ 預覽</button><button type="button" class="ghost" data-act="vStop">■ 停止</button><button type="button" class="pri" data-act="vRender"${v.checked && !blocked ? '' : ' disabled'}>輸出 MP4</button></div>
    ${v.checked ? '' : '<p class="hint warn">請先完成「4. 關鍵畫面檢查」並確認版面。</p>'}
    <p class="hint">輸出 1080×1920、30fps。電腦版會先問你要存在哪裡，錄完直接存檔；手機版錄完點「儲存到相簿」。輸出是即時錄製，影片多長就要錄多久，錄製時請停留在這個頁面、不要鎖定螢幕。</p>
    <div id="vRenderProg" class="vprog-box"></div><div id="vOut"></div>
    <h3>交付說明</h3><div class="pre vreport" id="vReport">${esc(reportText(i, v))}</div>
    <div class="btns"><button type="button" data-act="vCopyReport">複製交付說明</button></div></div>`;

  $('#vidBody').innerHTML = srcCard + pCard + bCard + kCard + oCard;
  if (v.src) srcURL(i).then((u) => { const p = $('#vSrcPrev'), s = $('#vSrcState'); if (u && p) { forceMute(p); p.src = u; } else if (s) s.textContent = '（這台裝置上沒有這支影片，請按「更換影片」重新選擇同一支影片）'; });
  if (a) drawBlurEditor(i, v);
  if (plan) drawStill(i);
}
// 不分析影片：只在本機準備遮蔽用的畫面時間點，分鏡與文案完全依使用者的提示詞
function ensurePrep(v) {
  const key = `${v.src.at}|f2`;
  if (v.analysis?.times?.length && v.analysis.prepFor === key && Array.isArray(v.frameBlur) && v.frameBlur.length === v.analysis.times.length) return;
  const times = frameTimes(v.src.duration, thumbCount(v.src.duration));
  v.analysis = { prepFor: key, times, blur: [], screen: { isRecording: false, keep: [0, 0, 1000, 1000] } };
  v.frameBlur = times.map(() => []);
  for (const m of v.manualBlur || []) for (const k of m.keys || (m.box ? [{ t: 0, box: m.box }] : [])) v.frameBlur[nearestIdx(times, k.t)].push({ id: uid(), box: k.box });
  v.manualBlur = [];
}
function planHtml(v, plan, dur) {
  const st = STYLES[plan.style];
  return `<div class="valert ok">🎨 風格：<b>${esc(st?.name || plan.style)}</b>｜${esc(plan.styleReason || '')}<br>📖 劇情：${esc(plan.story || '')}</div>
    <p class="${dur < 14 || dur > 19 ? 'warn' : 'hint'}">總長 ${f1(dur)} 秒（需 14–19 秒）｜${plan.shots.length} 個分鏡（需 5–6 個）</p>
    <label>結尾購買引導<input maxlength="16" data-vg="cta" value="${esc(plan.cta || '')}"></label>
    <label>Reels 推薦標註關鍵字（5 個，空白分隔，可修改）<input maxlength="200" data-vg="tags" value="${esc((plan.hashtags || []).join(' '))}"></label>
    <div class="btns"><button type="button" data-act="vCopyTags"${(plan.hashtags || []).length ? '' : ' disabled'}>複製 5 個關鍵字</button></div>
    <div class="vsecs">${plan.shots.map((s, k) => `<div class="vsec">
      <div class="vsec-h"><b>分鏡 ${k + 1}</b><select data-vs="role" data-k="${k}" aria-label="分鏡 ${k + 1} 角色">${opts(ROLES, s.role)}</select><span class="grow"></span>${k ? `<button type="button" data-act="vShotUp" data-k="${k}" aria-label="分鏡 ${k + 1} 上移">↑</button>` : ''}<button type="button" class="danger" data-act="vShotDel" data-k="${k}" aria-label="刪除分鏡 ${k + 1}">✕</button></div>
      <div class="row2"><label>大字<input maxlength="16" data-vs="caption" data-k="${k}" value="${esc(s.caption)}"></label><label>小字<input maxlength="22" data-vs="sub" data-k="${k}" value="${esc(s.sub)}"></label></div>
      <div class="row3"><label>素材起點（秒）<input type="number" min="0" max="${esc(f1(v.src?.duration || 0))}" step="0.1" data-vs="start" data-k="${k}" value="${esc(f1(s.start))}"></label>
        <label>長度（秒）<input type="number" min="2.5" max="3.5" step="0.1" data-vs="dur" data-k="${k}" value="${esc(f1(s.dur))}"></label>
        <label>運鏡<select data-vs="move" data-k="${k}">${opts(MOVES, s.move)}</select></label></div>
      <div class="row3"><label>特效<select data-vs="fx" data-k="${k}">${opts(FXS, s.fx)}</select></label>${k ? `<label>進場轉場<select data-vs="tr" data-k="${k}">${opts(TRANS, s.tr || 'auto')}</select></label>` : '<span></span>'}<label class="chk"><input type="checkbox" data-vs="demo" data-k="${k}"${s.demo ? ' checked' : ''}> 示意動畫（自動加註記小字）</label></div>
      <p class="sm muted">文案依據：${esc(s.source || '—')}</p>
      ${[...copyIssues(`${s.caption} ${s.sub}`)].map((x) => `<p class="sm warn">⚠ ${esc(x)}</p>`).join('')}
    </div>`).join('')}</div>`;
}
/* ========== AI：分析與分鏡 ========== */
function tick(id, from, to, est, label) {
  const t0 = Date.now();
  const h = setInterval(() => { const e = (Date.now() - t0) / 1000; vProg(id, Math.min(to, from + (to - from) * e / est), `${label}…已經過 ${secs(e)}（約需 ${est} 秒）`); }, 400);
  return () => clearInterval(h);
}
async function runPlan(btn) {
  const i = vItem(); if (!i || vBusy) return; const v = V(i);
  if (!(v.desc || '').trim()) { toast('請先輸入提示詞'); return; }
  if (v.plan && !confirm('重新設計會取代目前的分鏡，確定？')) return;
  vBusy = 'plan'; btn.disabled = true; $('#vPlanErr').innerHTML = '';
  let stop = tick('vPlanProg', 0.05, 0.95, 15, 'AI 正在挑選風格、設計分鏡');
  try {
    const payload = { prompt: (v.desc || '').slice(0, 1500), seconds: v.seconds, style: v.style, duration: v.src?.duration || 0 };   // 不送出影片檔名
    // Google 忙碌（high demand／overloaded）或逾時時自動重試，等待時間逐次拉長
    const WAITS = [5, 10, 15, 20];
    let j;
    for (let n = 0; ; n++) {
      try {
        j = await ai('video_plan', payload);
        if (!j.json || !Array.isArray(j.json.shots) || !j.json.shots.length) throw Object.assign(new Error('AI 回傳的分鏡格式不完整'), { status: 502, badJson: true });
        break;
      } catch (e) {
        const busy = e.badJson || ([502, 503, 504].includes(e.status) && /high demand|overload|unavailable|逾時|太慢|無法連線|Gemini 錯誤/i.test(e.message || ''));
        if (!busy || n >= WAITS.length) throw e;
        stop();
        for (let w = WAITS[n]; w > 0; w--) { vProg('vPlanProg', -1, `Google 目前忙碌中，${w} 秒後自動重試（第 ${n + 1}／${WAITS.length} 次）…`); await new Promise((r) => setTimeout(r, 1000)); }
        stop = tick('vPlanProg', 0.05, 0.95, 15, `AI 正在挑選風格、設計分鏡（重試第 ${n + 1} 次）`);
      }
    }
    stop();
    const o = j.json; if (!o || !Array.isArray(o.shots) || !o.shots.length) throw new Error('AI 沒有回傳可用的分鏡，請重試');
    v.plan = normPlan(o, v); v.checked = false;
    vSaveNow(); renderVideo(true);
    vProg('vPlanProg', 1, `✓ 分鏡完成：${STYLES[v.plan.style].name}、${v.plan.shots.length} 個分鏡`);
  } catch (e) { stop(); vProg('vPlanProg', null); showErr($('#vPlanErr'), e); }
  finally { vBusy = ''; btn.disabled = false; }
}
// AI 偶爾會把「情境描述」「文案依據」這類說明文字放進畫面文字，這裡擋掉
const cleanCopy = (x) => { const t = aiTxt(x).trim(); return /^(情境描述|文案依據|無|N\/A|—|-)/i.test(t) ? '' : t; };
function normPlan(o, v) {
  const style = STYLES[o.style] ? o.style : (STYLES[v.style] ? v.style : 'weather');
  let shots = o.shots.slice(0, 6).map((s) => ({
    role: ROLES[s?.role] ? s.role : 'point', caption: cleanCopy(s?.caption).slice(0, 16), sub: cleanCopy(s?.sub).slice(0, 22),
    start: Math.max(0, Number(s?.start) || 0), dur: 3, move: MOVES[s?.move] ? s.move : 'push', fx: FXS[s?.fx] ? s.fx : 'bounce',
    demo: !!s?.demo, source: aiTxt(s?.source).slice(0, 80),
  }));
  while (shots.length < 5) shots.push({ role: 'point', caption: '', sub: '', start: 0, dur: 3, move: 'push', fx: 'bounce', demo: false, source: '' });
  shots[0].role = 'hook'; shots[shots.length - 1].role = 'cta';
  // 依目標長度平均分配（每個 2.5–3.5 秒）
  const each = Math.min(SHOT_MAX, Math.max(SHOT_MIN, v.seconds / shots.length));
  shots = shots.map((s) => ({ ...s, dur: Math.round(each * 10) / 10 }));
  const tags = [...new Set((Array.isArray(o.hashtags) ? o.hashtags : []).map((x) => `#${aiTxt(x).replace(/^#+/, '').replace(/[\s#,，、]+/g, '')}`).filter((x) => x.length > 1))].slice(0, 5);
  return { style, styleReason: aiTxt(o.styleReason).slice(0, 60), story: aiTxt(o.story).slice(0, 80), cta: aiTxt(o.cta).slice(0, 16) || '現在就入手！', hashtags: tags, shots,
    product: aiTxt(o.product).slice(0, 10), safety: aiTxt(o.safety).slice(0, 30), prohibited: { blocked: !!o.prohibited?.blocked, reason: aiTxt(o.prohibited?.reason).slice(0, 200) } };
}

/* ========== 關鍵畫面檢查 ========== */
async function runKeys(btn) {
  const i = vItem(); if (!i || vBusy) return; const v = V(i);
  vBusy = 'keys'; btn.disabled = true; const out = $('#vKeys'); out.innerHTML = '';
  try {
    const url = await srcURL(i); if (!url) throw new Error('這台裝置上沒有這支影片，請在「2.」重新選擇同一支影片');
    const el = mkVideo(url); await vidReady(el);
    const R = buildRender(i, []), c = document.createElement('canvas'); c.width = VW; c.height = VH; const ctx = c.getContext('2d');
    const res = [];
    for (const s of R.shots) {
      vProg('vKeyProg', s.k / R.shots.length, `產生關鍵畫面 ${s.k + 1}／${R.shots.length}`);
      const lt = Math.min(s.d - 0.25, 1.4);
      await seekTo(el, s.srcStart + lt * s.rate);
      const S = drawFrame(ctx, s.t0 + lt, R, el);
      const issues = [...layoutIssues(S), ...copyIssues(`${S.caption} ${S.sub}`)];
      const nb = R.boxesAt(el.currentTime).length, active = nb ? [`${nb} 處`] : [];
      const th = document.createElement('canvas'); th.width = 270; th.height = 480; th.getContext('2d').drawImage(c, 0, 0, 270, 480);
      res.push({ s, url: th.toDataURL('image/jpeg', 0.82), issues, active });
    }
    el.removeAttribute('src'); el.load(); el.remove();
    const total = res.reduce((n, r) => n + r.issues.length, 0);
    out.innerHTML = res.map((r) => `<figure class="vkey${r.issues.length ? ' bad' : ''}"><img src="${r.url}" alt="分鏡 ${r.s.k + 1} 關鍵畫面"><figcaption><b>分鏡 ${r.s.k + 1}｜${esc(ROLES[r.s.role])}</b>
      ${r.issues.length ? r.issues.map((x) => `<span class="warn">⚠ ${esc(x)}</span>`).join('') : '<span class="pubok">✓ 版面沒有偵測到問題</span>'}
      <span class="muted">模糊中：${r.active.length ? esc([...new Set(r.active)].join('、')) : '無'}</span></figcaption></figure>`).join('');
    vProg('vKeyProg', 1, total ? `⚠ 偵測到 ${total} 個可能的問題，請修改分鏡後重新產生；確認沒問題也可以直接按「已確認」` : '✓ 關鍵畫面完成，請逐張目視確認文字與模糊後按「已確認」');
    v.keyShots = true;
    const b = $('#vKeysOk'); b.hidden = false; b.disabled = false; b.textContent = total ? `我已檢查，接受目前版面（${total} 個提醒）` : '✓ 版面確認無誤';
  } catch (e) { vProg('vKeyProg', null); out.innerHTML = `<div class="card err">${esc(e.message || e)}</div>`; }
  finally { vBusy = ''; btn.disabled = false; }
}

/* ========== 預覽與輸出 ========== */
let vRun = null;
function vStopAll() { if (vRun) { vRun.cancel(); vRun = null; } }
async function drawStill(i) {
  const c = $('#vCanvas'); if (!c) return; const ctx = c.getContext('2d'); const v = V(i);
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, VW, VH);
  try {
    const url = await srcURL(i); if (!url || !v.plan) return;
    const el = mkVideo(url); await vidReady(el);
    const R = buildRender(i, []); const s = R.shots[Math.min(1, R.shots.length - 1)]; const lt = Math.min(1.3, s.d - 0.3);
    await seekTo(el, s.srcStart + lt * s.rate); drawFrame(ctx, s.t0 + lt, R, el);
    el.removeAttribute('src'); el.load(); el.remove();
  } catch { /* 預覽圖失敗不影響操作 */ }
}
const recMime = () => ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
  .find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
const outName = (i, v, ext) => `${String(i.name).replace(/[\\/:*?"<>|]+/g, '').slice(0, 24)}_${STYLES[v.plan.style].name}_${today()}.${ext}`;
let lastOut = null;   // 最後一次輸出的影片（手機版存到相簿要再點一下時使用）
// 存檔：電腦版寫進輸出前選好的位置（或直接下載）；手機版跳出分享選單，選「儲存影片」就會存進相簿
async function deliver(blob, name, ext, handle, total) {
  const pid = 'vRenderProg', size = `${(blob.size / 1048576).toFixed(1)} MB`, done = `✓ 輸出完成：${f1(total)} 秒、1080×1920、${ext.toUpperCase()}、${size}`;
  const webmNote = ext === 'webm' ? '<p class="hint warn">這個瀏覽器只能輸出 WebM，請改用 Chrome、Edge 或 iPhone 的 Safari 輸出 MP4。</p>' : '';
  lastOut = { blob, name, ext };
  if (handle) {
    try { const w = await handle.createWritable(); await w.write(blob); await w.close(); vProg(pid, 1, `${done}，已存到你選的位置`); $('#vOut').innerHTML = `<p class="pubok">✓ 已儲存「${esc(handle.name || name)}」</p>${webmNote}`; return; }
    catch (e) { toast(`無法寫入選擇的位置（${e.message || e.name}），改用下載`); }
  }
  if (IS_MOBILE) {
    vProg(pid, 1, done);
    $('#vOut').innerHTML = `<div class="btns"><button type="button" class="pri vsave" data-act="vSaveOut">📥 儲存到相簿</button></div>
      <p class="hint">${IS_IOS ? '點一下後在分享選單選「儲存影片」，就會存進相簿。' : '點一下後選擇要存放的位置或 App。'}（瀏覽器規定存檔前需要點一下）</p>${webmNote}`;
    return;
  }
  downloadBlob(blob, name);
  vProg(pid, 1, `${done}，已下載`);
  $('#vOut').innerHTML = `<p class="pubok">✓ 已下載「${esc(name)}」</p><div class="btns"><button type="button" class="ghost" data-act="vSaveOut">再下載一次</button></div>${webmNote}`;
}
function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
}
async function saveLastOut() {
  if (!lastOut) return;
  const { blob, name, ext } = lastOut;
  const file = new File([blob], name, { type: ext === 'mp4' ? 'video/mp4' : 'video/webm' });
  if (IS_MOBILE && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }   // 使用者關閉分享選單
  }
  downloadBlob(blob, name);
}
async function runPlayback(record, saveHandle) {
  const i = vItem(); if (!i) return; const v = V(i);
  if (!v.plan) return;
  if (vBusy) { toast('目前有其他工作進行中'); return; }
  if (v.plan?.prohibited?.blocked) { toast('這類商品依法規不能製作廣告影片'); return; }
  vStopAll(); vBusy = record ? 'render' : 'play';
  const c = $('#vCanvas'), ctx = c.getContext('2d'), pid = 'vRenderProg';
  let cancelled = false, raf = 0, audio = null, rec = null, els = [];
  const job = { cancel: () => { cancelled = true; cancelAnimationFrame(raf); audio?.stop(); if (rec && rec.state !== 'inactive') rec.stop(); els.forEach((e) => { e.pause(); e.remove(); }); vBusy = ''; } };
  vRun = job;
  try {
    vProg(pid, 0, '載入實拍影片…');
    const url = await srcURL(i); if (!url) throw new Error('這台裝置上沒有這支影片，請在「2.」重新選擇同一支影片');
    els = [mkVideo(url), mkVideo(url)]; await Promise.all(els.map(vidReady));
    const R = buildRender(i, els);
    await seekTo(els[0], R.shots[0].srcStart); els[0].playbackRate = R.shots[0].rate;
    if (R.shots[1]) seekTo(els[1], R.shots[1].srcStart);
    if (cancelled) return;
    const ac = actx(); await ac.resume();
    let out = ac.destination, mime = '';
    if (record) {
      const dest = ac.createMediaStreamDestination(); out = dest;
      mime = recMime();
      if (!mime || !c.captureStream) throw new Error('這個瀏覽器不支援在網頁中錄製影片，請改用電腦版 Chrome 或 Edge');
      const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10e6, audioBitsPerSecond: 192e3 });
      const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        if (cancelled && !rec._done) return;
        const blob = new Blob(chunks, { type: mime.split(';')[0] }), ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
        const name = outName(i, v, ext);
        v.exportedAt = new Date().toISOString(); vSaveNow(); $('#vReport').textContent = reportText(i, v);
        await deliver(blob, name, ext, saveHandle, R.total);
      };
      // H.264 編碼器第一次啟動要幾秒、期間的畫面會被丟掉：先用拋棄式錄影器暖機，正式錄製開始後再停在第一格約 1 秒
      const hold = (sec, label) => new Promise((res) => {
        const w0 = performance.now();
        const f = () => { if (cancelled) return res(); const e = (performance.now() - w0) / 1000; drawFrame(ctx, 0, R); vProg(pid, 0.05 * Math.min(1, e / sec), label); if (e >= sec) res(); else raf = requestAnimationFrame(f); };
        f();
      });
      R.holding = true; drawFrame(ctx, 0, R);   // 先把第一格畫好，錄影器一開始抓到的就不會是之前的預覽畫面
      if (NEEDS_WARMUP && mime.startsWith('video/mp4') && !runPlayback.warm) {
        const w = new MediaRecorder(stream, { mimeType: mime }); w.ondataavailable = () => {}; w.start(250);
        await hold(4.5, '第一次錄影，編碼器暖機中（約 4 秒）…');
        // 有些瀏覽器停止錄影器後不會觸發 onstop：最多等 1.5 秒就繼續
        await Promise.race([new Promise((res) => { w.onstop = res; try { w.stop(); } catch { res(); } }), new Promise((res) => setTimeout(res, 1500))]);
        runPlayback.warm = true; if (cancelled) return;
      }
      drawFrame(ctx, 0, R); rec.start(250);
      await hold(NEEDS_WARMUP && mime.startsWith('video/mp4') ? 1 : 0.3, '準備錄影中…');
      R.holding = false;
      if (cancelled) return;
    }
    audio = synth(ac, R, out);
    const warnHidden = () => { if (document.hidden && record) toast('錄製中請不要切換分頁，否則畫面會停住'); };
    document.addEventListener('visibilitychange', warnHidden);
    let cur = -1, lastP = 0, pendingSeek = -1;
    const loop = () => {
      if (cancelled) return;
      const t = ac.currentTime - audio.T0;
      if (t >= R.total) {
        drawFrame(ctx, R.total - 0.001, R); els.forEach((e) => e.pause()); setTimeout(() => els.forEach((e) => e.remove()), 1000);
        document.removeEventListener('visibilitychange', warnHidden);
        if (rec) { rec._done = true; setTimeout(() => rec.state !== 'inactive' && rec.stop(), 300); vProg(pid, 0.99, '封裝影片中…'); } else vProg(pid, 1, '預覽結束');
        vRun = null; vBusy = ''; return;
      }
      if (t >= 0) {
        const k0 = R.shots.findIndex((s) => t < s.t0 + s.d), k = k0 === -1 ? R.shots.length - 1 : k0;
        if (k !== cur) {   // 換分鏡：播放已預先跳到位置的影片；上一個影片元素停在最後畫面給轉場用
          cur = k; const s = R.shots[k], el = els[k % 2];
          els[(k + 1) % 2].pause(); el.playbackRate = s.rate; el.play().catch(() => {});
          pendingSeek = k + 1 < R.shots.length ? k + 1 : -1;
        }
        const s = R.shots[cur], el = els[cur % 2], want = s.srcStart + (t - s.t0) * s.rate;
        if (pendingSeek > 0 && t - s.t0 > TR_DUR + 0.05) {   // 轉場結束後，另一個影片元素預先跳到下一個分鏡
          const nx = R.shots[pendingSeek], o = els[pendingSeek % 2]; o.playbackRate = nx.rate; seekTo(o, nx.srcStart); pendingSeek = -1;
        }
        if (Math.abs(el.currentTime - want) > 0.3 && !el.seeking) el.currentTime = want;
        drawComposite(ctx, t, R, els);
      }
      const now = performance.now();
      if (now - lastP > 200) { lastP = now; const tt = Math.max(0, t); vProg(pid, 0.05 + 0.94 * tt / R.total, `${record ? '錄製中' : '預覽中'} ${secs(tt)}／${secs(R.total)}${record ? `｜剩約 ${secs(R.total - tt)}` : ''}`); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  } catch (e) { job.cancel(); vProg(pid, null); $('#vOut').innerHTML = `<div class="card err">${esc(e.message || e)}</div>`; }
}

/* ========== 交付說明 ========== */
function reportText(i, v) {
  const p = v.plan; if (!p) return '完成分鏡後會產生交付說明。';
  const st = STYLES[p.style];
  let t = 0;
  const RR = { plan: p, shots: p.shots };
  const shots = p.shots.map((s, k) => { const d = Math.min(SHOT_MAX, Math.max(SHOT_MIN, Number(s.dur) || 3)); const line = `${k + 1}. ${f1(t)}–${f1(t + d)} 秒｜${ROLES[s.role]}｜${s.role === 'cta' && !s.caption ? p.cta : s.caption}${s.sub ? `／${s.sub}` : ''}｜${MOVES[s.move]}＋${FXS[s.fx]}${k ? `｜轉場：${TRANS[trFor(RR, k)]}${s.tr && s.tr !== 'auto' ? '（手動）' : ''}` : ''}${s.demo ? '｜含示意註記' : ''}`; t += d; return line; });
  const bs = blurStats(v), blurs = bs.n ? [`在 ${bs.f} 個時間點框選了 ${bs.n} 個模糊框（只在框選的時間點附近模糊）`] : [];
  const sources = p.shots.map((s, k) => `分鏡 ${k + 1}：${s.source || '（未提供）'}`);
  const confirmList = [
    ...p.shots.flatMap((s, k) => copyIssues(`${s.caption} ${s.sub}`).map((x) => `分鏡 ${k + 1}：${x}`)),
    ...(blurs.length ? [] : ['影片沒有加任何模糊框：請確認畫面中沒有價格、日期、促銷吊牌、別家商品或他人角色']),
    '請對照實物確認品名、規格與賣點文字正確（AI 沒有看影片，文案只依提示詞）',
  ];
  return [
    `【影片】${i.name}`,
    `【風格】${st.name}：${p.styleReason || '—'}`,
    `【劇情】${p.story || '—'}`,
    `【分鏡】（總長 ${f1(t)} 秒，1080×1920、30fps）`, ...shots,
    `【遮蔽】${blurs.length ? blurs.join('、') : '無'}`,
    `【文案依據】（只使用你輸入的提示詞）`, ...sources,
    ...(v.desc ? [`【提示詞】${v.desc}`] : []),
    `【配樂與音效】程式即時合成（${st.music.bpm} BPM${st.music.minor ? '、小調' : '、大調'}），含轉場、點擊、叮聲${st.music.amb ? '、環境音' : ''}，未使用現成音樂；原始影片聲音已靜音`,
    `【Reels 推薦標註】${(p.hashtags || []).join(' ') || '（未產生）'}`,
    `【需要你確認】`, ...confirmList.map((x) => `・${x}`),
    v.exportedAt ? `【輸出時間】${fmtDT(v.exportedAt)}` : '',
  ].filter(Boolean).join('\n');
}

/* ========== 遮蔽：每張畫面各自框選 ==========
 * 縮圖約每秒一張；每一張有自己的模糊框（v.frameBlur[張數] = [{ id, box }]）。
 * 影片中的模糊只依使用者框的位置：
 *  - 相鄰兩張在相近位置都有框 → 框從前一張的位置平滑移到後一張的位置
 *  - 只有一邊有框 → 只在那一張前後各一半的時間模糊
 *  - 沒有框的時間點完全不模糊
 */
let bSel = 0, bDrag = null;
const thumbCount = (dur) => Math.max(6, Math.min(30, Math.round(dur)));
const nearestIdx = (times, t) => { let b = 0; for (let k = 1; k < times.length; k++) if (Math.abs(times[k] - t) < Math.abs(times[b] - t)) b = k; return b; };
const ctr = (b) => [(b[1] + b[3]) / 2, (b[0] + b[2]) / 2];
// 某個時間點要模糊的位置（0–1000 比例座標）
function frameBoxesAt(v, t) {
  const T = v.analysis?.times || [], F = v.frameBlur || []; if (!T.length) return [];
  const n = T.length;
  if (t <= T[0]) return (F[0] || []).map((b) => b.box);
  if (t >= T[n - 1]) return (F[n - 1] || []).map((b) => b.box);
  let a = 0; while (a < n - 2 && T[a + 1] <= t) a++;
  const b = a + 1, A = F[a] || [], B = F[b] || [], q = (t - T[a]) / Math.max(0.001, T[b] - T[a]), out = [], used = new Set();
  for (const x of A) {
    let best = -1, bd = 300;   // 前後兩張相近位置（畫面的 30% 以內）的框視為同一個東西
    B.forEach((y, j) => { if (used.has(j)) return; const [ax, ay] = ctr(x.box), [bx, by] = ctr(y.box), d = Math.hypot(ax - bx, ay - by); if (d < bd) { bd = d; best = j; } });
    if (best >= 0) { used.add(best); out.push(x.box.map((m, k) => lerp(m, B[best].box[k], q))); }
    else if (q < 0.5) out.push(x.box);
  }
  if (q >= 0.5) B.forEach((y, j) => { if (!used.has(j)) out.push(y.box); });
  return out;
}
const curBoxes = (v) => (v.frameBlur[bSel] ||= []);
const blurStats = (v) => { const f = (v.frameBlur || []).filter((l) => l.length).length, n = (v.frameBlur || []).reduce((s, l) => s + l.length, 0); return { f, n }; };

function drawBlurEditor(i, v) {
  const a = v.analysis, cv = $('#vBCanvas'); if (!cv || !a) return;
  bSel = Math.min(bSel, a.times.length - 1);
  paintBlur(i, v);
  if (!(thumbCache.id === i.id && thumbCache.list.length === a.times.length)) grabFrames(i, a.times, (p) => vProg('vBlurProg', p, `讀取畫面 ${Math.round(p * a.times.length)}／${a.times.length}`)).then(() => { vProg('vBlurProg', null); paintBlur(i, v); }).catch(() => vProg('vBlurProg', null));
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1000, (e.clientY - r.top) / r.height * 1000)), Math.max(0, Math.min(1000, (e.clientX - r.left) / r.width * 1000))]; };
  cv.onpointerdown = (e) => {
    if (!thumbCache.list.length) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const p = pos(e), list = curBoxes(v);
    const hit = list.slice().reverse().find((b) => p[0] >= b.box[0] && p[0] <= b.box[2] && p[1] >= b.box[1] && p[1] <= b.box[3]);
    bDrag = hit ? { mode: 'move', b: hit, start: p, orig: hit.box.slice(), box: hit.box.slice() } : { mode: 'draw', start: p, box: [p[0], p[1], p[0], p[1]] };
  };
  cv.onpointermove = (e) => {
    if (!bDrag) return; const p = pos(e);
    if (bDrag.mode === 'draw') bDrag.box = [Math.min(bDrag.start[0], p[0]), Math.min(bDrag.start[1], p[1]), Math.max(bDrag.start[0], p[0]), Math.max(bDrag.start[1], p[1])];
    else { const o = bDrag.orig, dy = Math.max(-o[0], Math.min(1000 - o[2], p[0] - bDrag.start[0])), dx = Math.max(-o[1], Math.min(1000 - o[3], p[1] - bDrag.start[1])); bDrag.box = [o[0] + dy, o[1] + dx, o[2] + dy, o[3] + dx]; }
    paintBlur(i, v);
  };
  const end = () => {
    if (!bDrag) return; const d = bDrag; bDrag = null;
    const box = d.box.map((n) => Math.round(n));
    if (d.mode === 'draw') { if (box[2] - box[0] >= 15 && box[3] - box[1] >= 15) curBoxes(v).push({ id: uid(), box }); }   // 太小多半是誤觸
    else d.b.box = box;
    vDirty(v); vSaveNow(); paintBlur(i, v);
  };
  cv.onpointerup = end; cv.onpointercancel = end;
}
function paintBlur(i, v) {
  const a = v.analysis, cv = $('#vBCanvas'); if (!cv || !a) return;
  const frames = thumbCache.id === i.id ? thumbCache.list : [], fr = frames[bSel];
  if (fr && (cv.width !== 360 || cv.height !== Math.round(360 * fr.canvas.height / fr.canvas.width))) { cv.width = 360; cv.height = Math.round(360 * fr.canvas.height / fr.canvas.width); }
  const x = cv.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, cv.width, cv.height);
  if (!fr) { x.fillStyle = '#aaa'; x.font = `16px ${VFONT}`; x.textAlign = 'center'; x.fillText('讀取畫面中…', cv.width / 2, cv.height / 2); }
  else x.drawImage(fr.canvas, 0, 0, cv.width, cv.height);
  const W = cv.width, H = cv.height, rect = (b) => [b[1] / 1000 * W, b[0] / 1000 * H, (b[3] - b[1]) / 1000 * W, (b[2] - b[0]) / 1000 * H];
  // 上一張有框的位置（淡淡的虛線，方便對齊；不會模糊）
  for (let k = bSel - 1; k >= 0; k--) {
    const prev = v.frameBlur[k] || []; if (!prev.length) continue;
    x.save(); x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 2; x.setLineDash([5, 5]); prev.forEach((b) => { const [rx, ry, rw, rh] = rect(b.box); x.strokeRect(rx, ry, rw, rh); }); x.restore();
    break;
  }
  const stage = $('#vBStage'); stage?.querySelectorAll('.vbx').forEach((b) => b.remove());
  curBoxes(v).forEach((b, n) => {
    const box = bDrag?.mode === 'move' && bDrag.b === b ? bDrag.box : b.box, [rx, ry, rw, rh] = rect(box);
    x.save(); x.fillStyle = 'rgba(255,149,0,0.3)'; x.fillRect(rx, ry, rw, rh); x.strokeStyle = '#ff9500'; x.lineWidth = 3; x.strokeRect(rx, ry, rw, rh);
    x.font = `700 13px ${VFONT}`; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 3; x.strokeText(`框 ${n + 1}`, rx + 4, ry + 16); x.fillText(`框 ${n + 1}`, rx + 4, ry + 16); x.restore();
    if (stage) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'vbx'; btn.textContent = '✕';
      btn.setAttribute('aria-label', `刪除這一張的框 ${n + 1}`); btn.title = `刪除框 ${n + 1}`;
      btn.style.left = `${box[3] / 10}%`; btn.style.top = `${box[0] / 10}%`;
      btn.onclick = (e) => { e.stopPropagation(); const l = curBoxes(v); l.splice(l.indexOf(b), 1); vDirty(v); vSaveNow(); paintBlur(i, v); };
      stage.append(btn);
    }
  });
  if (bDrag?.mode === 'draw') { const [rx, ry, rw, rh] = rect(bDrag.box); x.save(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.setLineDash([6, 4]); x.strokeRect(rx, ry, rw, rh); x.restore(); }
  // 縮圖：每張只顯示自己的框
  $$('#vFrames canvas').forEach((c) => {
    const k = +c.dataset.fr, f = frames[k], cx = c.getContext('2d'); cx.fillStyle = '#222'; cx.fillRect(0, 0, c.width, c.height);
    if (!f) return; cx.drawImage(f.canvas, 0, 0, c.width, c.height);
    for (const b of v.frameBlur[k] || []) { const bb = b.box; cx.save(); cx.strokeStyle = '#ff9500'; cx.lineWidth = 2; cx.fillStyle = 'rgba(255,149,0,0.35)'; cx.fillRect(bb[1] / 1000 * c.width, bb[0] / 1000 * c.height, (bb[3] - bb[1]) / 1000 * c.width, (bb[2] - bb[0]) / 1000 * c.height); cx.strokeRect(bb[1] / 1000 * c.width, bb[0] / 1000 * c.height, (bb[3] - bb[1]) / 1000 * c.width, (bb[2] - bb[0]) / 1000 * c.height); cx.restore(); }
  });
  $$('#vFrames .vbthumb').forEach((b) => { const k = +b.dataset.k, n = (v.frameBlur[k] || []).length; b.classList.toggle('on', k === bSel); b.querySelector('span').textContent = `${f1(a.times[k])} 秒${n ? `・${n} 框` : ''}`; });
  const st = blurStats(v), cnt = $('#vBlurCount'); if (cnt) cnt.textContent = st.n ? `${st.f} 張、${st.n} 個框` : '未框選';
  const cur = $('#vBCur'); if (cur) cur.textContent = `目前：${f1(a.times[bSel])} 秒（第 ${bSel + 1}／${a.times.length} 張）`;
  const copyBtn = $('[data-act="vBCopyPrev"]'); if (copyBtn) copyBtn.disabled = !v.frameBlur.slice(0, bSel).some((l) => l.length);
  const clrBtn = $('[data-act="vBClear"]'); if (clrBtn) clrBtn.disabled = !curBoxes(v).length;
}

/* ========== 事件 ========== */
Object.assign(ACT, {
  async vNewProj() {
    if (vBusy) { toast('目前有其他工作進行中'); return; }
    const cur = vItem();
    if (cur?.video?.src && !confirm('重新開始會清除目前的影片、提示詞與分鏡，確定？')) return;
    vStopAll();
    // 只保留一個專案：舊專案與存在這台裝置的影片一併清除
    for (const p of vProjects) await IDB.del(p.id).catch(() => {});
    if (srcUrl) URL.revokeObjectURL(srcUrl); srcUrl = ''; srcFor = '';
    vProjects = [newProject()]; vSaveNow(); vPick(vProjects[0].id);
  },
  vPlan(b) { runPlan(b); },
  vKeys(b) { runKeys(b); },
  vKeysOk() { const i = vItem(); if (!i) return; const v = V(i); v.checked = true; vSaveNow(); const y = window.scrollY; renderVideo(true); window.scrollTo(0, y); toast('已確認版面，可以輸出影片'); },
  vAddShot() { const i = vItem(); if (!i) return; const v = V(i); if (v.plan.shots.length >= 6) { toast('最多 6 個分鏡'); return; } v.plan.shots.splice(v.plan.shots.length - 1, 0, { role: 'point', caption: '', sub: '', start: 0, dur: 3, move: 'push', fx: 'bounce', demo: false, source: '' }); vDirty(v); vSaveNow(); renderVideo(true); },
  vShotDel(b) { const i = vItem(); if (!i) return; const v = V(i); if (v.plan.shots.length <= 5) { toast('至少要 5 個分鏡'); return; } v.plan.shots.splice(+b.dataset.k, 1); vDirty(v); vSaveNow(); renderVideo(true); },
  vShotUp(b) { const i = vItem(); if (!i) return; const s = V(i).plan.shots, k = +b.dataset.k; if (k < 1) return; [s[k - 1], s[k]] = [s[k], s[k - 1]]; vDirty(V(i)); vSaveNow(); renderVideo(true); },
  vBSel(b) { const i = vItem(); if (!i) return; bSel = +b.dataset.k; paintBlur(i, V(i)); },
  vBCopyPrev() {
    const i = vItem(); if (!i) return; const v = V(i);
    for (let k = bSel - 1; k >= 0; k--) { const prev = v.frameBlur[k] || []; if (!prev.length) continue; curBoxes(v).push(...prev.map((b) => ({ id: uid(), box: b.box.slice() }))); vDirty(v); vSaveNow(); paintBlur(i, v); toast(`已沿用 ${f1(v.analysis.times[k])} 秒的 ${prev.length} 個框，可再拖曳調整位置`); return; }
  },
  vBClear() { const i = vItem(); if (!i) return; const v = V(i); v.frameBlur[bSel] = []; vDirty(v); vSaveNow(); paintBlur(i, v); },
  vStop() { vStopAll(); vProg('vRenderProg', null); const i = vItem(); if (i) drawStill(i); },
  async vRender() {
    const i = vItem(); if (!i || !V(i).plan) return;
    try { actx().resume(); } catch { /* 之後再試 */ }
    let handle = null;
    const mime = recMime(), ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    if (!IS_MOBILE && window.showSaveFilePicker && mime) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: outName(i, V(i), ext), types: [{ description: ext === 'mp4' ? 'MP4 影片' : 'WebM 影片', accept: { [ext === 'mp4' ? 'video/mp4' : 'video/webm']: [`.${ext}`] } }] });
      } catch (e) { if (e.name === 'AbortError') return; handle = null; }   // 取消就不輸出
    }
    runPlayback(true, handle);
  },
  vSaveOut() { saveLastOut(); },
  vPlay() { try { actx().resume(); } catch { /* 之後再試 */ } runPlayback(false); },
  vCopyReport(b) { copy($('#vReport')?.textContent || '', b); },
  vCopyTags(b) { const i = vItem(); if (i) copy((V(i).plan?.hashtags || []).join(' '), b); },
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (!t.closest?.('#v-video')) return;
  const i = vItem(); if (!i) return; const v = V(i);
  if (t.matches('[data-vf="src"]') && t.files.length) {
    const f = t.files[0]; t.value = '';
    if (f.size > MAX_SRC_MB * 1048576) { toast(`影片超過 ${MAX_SRC_MB} MB，請先剪短或壓縮`); return; }
    vProg('vSrcProg', -1, `讀取影片：${f.name}`);
    try {
      const u = URL.createObjectURL(f), el = mkVideo(u); await vidReady(el);
      if (!el.duration || !isFinite(el.duration)) throw new Error('讀不到影片長度，請轉成 MP4 後再上傳');
      if (el.duration < 3) throw new Error('影片太短（至少 3 秒）');
      const meta = { name: f.name.slice(0, 80), size: f.size, duration: Math.round(el.duration * 100) / 100, w: el.videoWidth, h: el.videoHeight, at: new Date().toISOString() };
      URL.revokeObjectURL(u);
      await IDB.set(i.id, f); navigator.storage?.persist?.();
      const same = v.src && v.src.name === meta.name && v.src.size === meta.size;
      v.src = meta; srcFor = '';
      if (!same || i.name === '未命名影片') i.name = meta.name.replace(/\.[^.]+$/, '').slice(0, 60) || '未命名影片';
      if (!same) { v.analysis = null; v.plan = null; v.checked = false; v.blurOff = []; v.manualBlur = []; v.ownRecheck = false; }
      thumbCache = { id: '', list: [] };
      vSaveNow(); vProg('vSrcProg', 1, same ? '✓ 已重新連結同一支影片，分析與分鏡沿用' : '✓ 影片已存到這台裝置'); renderVideo(true);
    } catch (err) { vProg('vSrcProg', null); toast(err.message || '影片讀取失敗'); }
    return;
  }
  if (t.matches('[data-vs="role"],[data-vs="move"],[data-vs="fx"],[data-vs="tr"],[data-vs="demo"],[data-vg="style"],[data-vg="own"],[data-vg="ownRecheck"]')) {
    vField(t, v); vSaveNow(); const y = window.scrollY; renderVideo(true); window.scrollTo(0, y);
  }
});
document.addEventListener('input', (e) => {
  const t = e.target; if (!t.closest?.('#v-video')) return;
  const i = vItem(); if (!i) return; const v = V(i);
  if (t.matches('[data-vs],[data-vg],[data-vp]')) { vField(t, v); vSave(); }
});
function vField(t, v) {
  const val = t.type === 'checkbox' ? t.checked : t.value;
  if (t.dataset.vs) {
    const s = v.plan?.shots[+t.dataset.k]; if (!s) return; const f = t.dataset.vs;
    if (f === 'start') s.start = Math.max(0, num(val));
    else if (f === 'dur') s.dur = clamp(num(val) || 3, SHOT_MIN, SHOT_MAX);
    else if (f === 'demo') s.demo = !!val;
    else if (f === 'role') s.role = ROLES[val] ? val : 'point';
    else if (f === 'move') s.move = MOVES[val] ? val : 'push';
    else if (f === 'fx') s.fx = FXS[val] ? val : 'bounce';
    else if (f === 'tr') s.tr = TRANS[val] ? val : 'auto';
    else s[f] = String(val);
    vDirty(v);
  } else {
    const f = t.dataset.vg;
    if (f === 'pname') { vItem().name = String(val).slice(0, 60) || '未命名影片'; }
    else if (f === 'own') v.own = !!val;
    else if (f === 'desc') { v.desc = String(val).slice(0, 1500); const b = $('#vPlanBtn'); if (b) b.disabled = !(v.src && v.own && v.desc.trim()); }
    else if (f === 'style') v.style = STYLES[val] ? val : '';
    else if (f === 'seconds') v.seconds = clamp(Math.round(num(val)) || 17, 14, 19);
    else if (f === 'cta' && v.plan) { v.plan.cta = String(val).slice(0, 16); vDirty(v); }
    else if (f === 'tags' && v.plan) { v.plan.hashtags = [...new Set(String(val).split(/[\s,，、]+/).map((x) => x.replace(/^#+/, '')).filter(Boolean).map((x) => `#${x}`))].slice(0, 5); const r = $('#vReport'); if (r) r.textContent = reportText(vItem(), v); }
  }
}

/* ========== 多行輸入框依內容自動長高（不出現捲軸） ==========
 * 支援 CSS field-sizing 的瀏覽器（Chrome／Edge）由 CSS 處理；其他瀏覽器（Safari、Firefox）用 JS 調整高度，全站的 textarea 都適用。 */
const FIELD_SIZING = CSS.supports?.('field-sizing', 'content');
function autoGrow(t) {
  if (FIELD_SIZING || !t || t.tagName !== 'TEXTAREA' || !t.isConnected) return;
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight + (t.offsetHeight - t.clientHeight)}px`;
}
const growAll = (root = document) => { if (!FIELD_SIZING) root.querySelectorAll('textarea').forEach(autoGrow); };
document.addEventListener('input', (e) => autoGrow(e.target));
document.addEventListener('focusin', (e) => autoGrow(e.target));
if (!FIELD_SIZING) {
  new MutationObserver(() => { clearTimeout(growAll.t); growAll.t = setTimeout(() => growAll(), 30); })
    .observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', () => growAll());
}

/* ========== 掛上路由 ========== */
VIEWS.push('video');
RENDER.video = () => renderVideo(false);
window.addEventListener('hashchange', () => { if (location.hash !== '#video') vStopAll(); });
if (location.hash === '#video') route();
