'use strict';
/* ========== 🎬 影片製作：照片 → AI 腳本 → 配音 → （選用）AI 動態鏡頭 → 瀏覽器算圖輸出 ==========
 * 與 app.js 共用全域（$、esc、items、save、S、ai、toast、hashStr、ACT、VIEWS、RENDER…），所以必須在 app.js 之後載入。
 * 素材存在 /api/media（Netlify Blobs），腳本與設定存在商品的 i.video（跟著雲端同步）。
 */
const VW = 1080, VH = 1920, PY = 420, PS = 1080;
const VFONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","Heiti TC",sans-serif';
const VC = { cream: '#EFE7DC', card: '#F7F1E8', ink: '#3B2F25', sub: 'rgba(59,47,37,0.78)' };
const EFFECTS = { lift: '拿起', push: '慢慢推近', mist: '噴霧', shine: '光澤掃過', grid: '多圖拼貼', pack: '產品收尾', };
const DIRS = { 180: '往左', 0: '往右', 270: '往上', 90: '往下', 200: '往左下', 160: '往左上', 340: '往右上', 20: '往右下' };
const VOICES = { Kore: 'Kore（女・穩重）', Aoede: 'Aoede（女・輕快）', Leda: 'Leda（女・年輕）', Zephyr: 'Zephyr（女・明亮）', Puck: 'Puck（男・活潑）', Charon: 'Charon（男・沉穩）', Orus: 'Orus（男・堅定）', Fenrir: 'Fenrir（男・興奮）' };
const DEF_STYLE = '台灣華語口音，自然輕鬆，像在跟朋友分享好用小物；不要播音腔，句尾不要拖長。';
const MAX_IMGS = 8, OMNI_EST = 180;

const vsafe = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60);
const V = (i) => {
  if (!i.video || typeof i.video !== 'object') i.video = {};
  const v = i.video;
  v.images ||= []; v.sections ||= []; v.audio ||= {}; v.clips ||= {};
  v.voice ||= { on: true, name: 'Kore', style: DEF_STYLE };
  if (v.musicVol == null) v.musicVol = 0.12;
  v.endTitle ??= ''; v.endSub ??= ''; v.seconds ||= 25;
  return v;
};
let vSel = store.get('vSel', '');
const vItem = () => items.find((x) => x.id === vSel);
let vBusy = '';   // 目前進行中的工作（避免同時跑兩件事）
let vSaveT = 0;
const vSave = () => { clearTimeout(vSaveT); vSaveT = setTimeout(() => save.i(), 400); };

/* ---------- 進度條 ---------- */
function vProg(id, p, label) {
  const el = document.getElementById(id); if (!el) return;
  if (p == null) { el.innerHTML = ''; return; }
  let bar = el.querySelector('progress');
  if (!bar) { el.innerHTML = '<progress max="100" value="0"></progress><div class="vprog-l" aria-live="polite"></div>'; bar = el.querySelector('progress'); }
  if (p < 0) bar.removeAttribute('value'); else bar.value = Math.round(Math.min(1, p) * 1000) / 10;
  el.querySelector('.vprog-l').textContent = label || '';
}
const secs = (n) => (n >= 60 ? `${Math.floor(n / 60)} 分 ${Math.round(n % 60)} 秒` : `${Math.max(0, Math.round(n))} 秒`);

/* ---------- 素材存取 ---------- */
const mHead = (ct) => { const h = {}; if (ct) h['Content-Type'] = ct; if (S.accessCode) h['x-access-code'] = S.accessCode; if (S.ownKey) h['x-gemini-key'] = S.ownKey; return h; };
const mCache = new Map();
async function mFail(r) { const j = await r.json().catch(() => ({})); const e = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
async function mPut(key, blob) {
  const r = await fetch(`/api/media?key=${encodeURIComponent(key)}`, { method: 'PUT', headers: mHead(blob.type || 'application/octet-stream'), body: blob });
  if (!r.ok) await mFail(r);
  mCache.set(key, blob);
}
async function mGet(key, fresh) {
  if (!fresh && mCache.has(key)) return mCache.get(key);
  const r = await fetch(`/api/media?key=${encodeURIComponent(key)}`, { headers: mHead(), cache: 'no-store' });
  if (!r.ok) await mFail(r);
  const b = await r.blob();
  if (!fresh) mCache.set(key, b);
  return b;
}
const mDel = (key) => { mCache.delete(key); return fetch(`/api/media?key=${encodeURIComponent(key)}`, { method: 'DELETE', headers: mHead() }).catch(() => {}); };
const urlCache = new Map();
async function mUrl(key) { if (urlCache.has(key)) return urlCache.get(key); const u = URL.createObjectURL(await mGet(key)); urlCache.set(key, u); return u; }

/* ---------- 圖片處理 ---------- */
async function shrink(file, max, q = 0.88) {
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('圖片轉換失敗'))), 'image/jpeg', q));
}
const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

/* ========== 畫面 ========== */
function renderVideo(force) {
  const ae = document.activeElement;
  if (!force && ae && ae.closest?.('#vidBody') && ae.matches('input,textarea,select')) { pendingRender = true; return; }   // 同步進來時若正在編輯，等編輯完再重繪
  const pool = items.filter((i) => i.status !== 'drop').sort((a, b) => (INQ(b) - INQ(a)) || (b.video ? 1 : 0) - (a.video ? 1 : 0) || b.total - a.total);
  if (vSel && !vItem()) vSel = '';
  const sel = `<div class="card"><h2>1. 選擇商品</h2>
    <select id="vItem" aria-label="選擇要做影片的商品"><option value="">— 請選擇商品（發布清單的商品排在前面）—</option>${pool.map((i) => `<option value="${esc(i.id)}"${i.id === vSel ? ' selected' : ''}>${INQ(i) ? '📝 ' : ''}${i.video?.sections?.length ? '🎬 ' : ''}${esc(i.name.slice(0, 60))}</option>`).join('')}</select>
    <p class="hint">流程：上傳照片 → AI 產生腳本（可修改）→ 產生配音 → 預覽 → 輸出影片。照片、配音與音樂會存在雲端，換裝置也能接著做。</p></div>`;
  const i = vItem();
  if (!i) { $('#vidBody').innerHTML = sel + (items.length ? '' : '<p class="empty">還沒有商品，請先到「<a href="#list">商品分析</a>」匯入。</p>'); return; }
  const v = V(i), id = esc(i.id);
  const imgOpts = (k) => v.images.map((_, n) => `<option value="${n}"${n === k ? ' selected' : ''}>照片 ${n + 1}</option>`).join('');
  const total = estTotal(v);
  $('#vidBody').innerHTML = sel + `
  <div class="card"><h2>2. 商品照片 <span class="tag">${v.images.length}／${MAX_IMGS}</span></h2>
    <div class="vimgs" id="vImgs">${v.images.map((im, n) => `<figure><img data-vimg="${esc(im.key)}" alt="照片 ${n + 1}"><figcaption>照片 ${n + 1}</figcaption>
      <div class="vimg-acts">${n ? `<button type="button" data-act="vImgLeft" data-k="${n}" aria-label="照片 ${n + 1} 往前移">◀</button>` : ''}<button type="button" class="danger" data-act="vImgDel" data-k="${n}" aria-label="刪除照片 ${n + 1}">✕</button></div></figure>`).join('')}</div>
    ${v.images.length < MAX_IMGS ? `<label class="btn">上傳照片（可多選）<input class="vh" type="file" accept="image/jpeg,image/png,image/webp" multiple data-vf="img"></label>` : ''}
    <p class="hint">建議 3–6 張：白底產品照、使用中的照片、細節特寫。會自動壓縮到 1080 px。</p><div id="vImgProg" class="vprog-box"></div></div>

  <div class="card"><h2>3. 腳本</h2>
    <div class="row2"><label>影片長度（秒）<input type="number" min="15" max="45" step="5" data-vg="seconds" value="${esc(v.seconds)}"></label><span></span></div>
    <div class="btns"><button type="button" class="pri" data-act="vScript"${v.images.length ? '' : ' disabled'}>${v.sections.length ? 'AI 重新產生腳本' : 'AI 產生腳本'}</button><button type="button" data-act="vAddSec">新增段落</button></div>
    ${v.images.length ? '' : '<p class="hint">請先上傳照片，AI 會看照片安排每一段畫面。</p>'}
    <div id="vScriptProg" class="vprog-box"></div><div id="vScriptErr"></div>
    <div class="vsecs">${v.sections.map((s, k) => `<div class="vsec">
      <div class="vsec-h"><b>第 ${k + 1} 段</b><span class="muted sm">${v.audio[s.id]?.dur ? `🔊 ${v.audio[s.id].dur.toFixed(1)} 秒` : ''}${s.useClip ? ` ｜🎥 ${clipLabel(v.clips[s.id])}` : ''}</span>
        <span class="grow"></span>${k ? `<button type="button" data-act="vSecUp" data-k="${k}" aria-label="第 ${k + 1} 段上移">↑</button>` : ''}<button type="button" class="danger" data-act="vSecDel" data-k="${k}" aria-label="刪除第 ${k + 1} 段">✕</button></div>
      <label>旁白<textarea rows="2" maxlength="80" data-vs="text" data-k="${k}">${esc(s.text)}</textarea></label>
      <div class="row3"><label>字卡<input maxlength="16" data-vs="card" data-k="${k}" value="${esc(s.card)}"></label>
        <label>效果<select data-vs="effect" data-k="${k}">${opts(EFFECTS, s.effect)}</select></label>
        <label>照片<select data-vs="image" data-k="${k}"${s.effect === 'grid' ? ' disabled' : ''}>${imgOpts(s.image)}</select></label></div>
      ${s.effect === 'mist' || s.effect === 'push' || s.effect === 'shine' ? `<div class="btns"><button type="button" data-act="vPoint" data-k="${k}">${s.point ? '重設' : '設定'}${s.effect === 'mist' ? '噴口位置' : '推近焦點'}</button>${s.effect === 'mist' ? `<label class="inl">噴霧方向<select data-vs="dir" data-k="${k}">${opts(DIRS, String(s.dir ?? 180))}</select></label>` : ''}</div>` : ''}
      <details><summary class="sm">🎥 AI 動態鏡頭（選用，需 Gemini 付費方案）</summary>
        <label class="chk"><input type="checkbox" data-vs="useClip" data-k="${k}"${s.useClip ? ' checked' : ''}> 這一段改用 AI 生成的第一人稱動態影片</label>
        <label>英文提示詞<textarea rows="3" maxlength="1200" data-vs="motion" data-k="${k}">${esc(s.motion)}</textarea></label></details>
    </div>`).join('')}</div>
    ${v.sections.length ? `<div class="row2"><label>收尾大字<input maxlength="20" data-vg="endTitle" value="${esc(v.endTitle)}"></label><label>收尾小字<input maxlength="24" data-vg="endSub" value="${esc(v.endSub)}"></label></div>
    <p class="hint">預估長度約 ${total.toFixed(0)} 秒（產生配音後會依實際語音長度調整）。</p>` : ''}
  </div>

  <div class="card"><h2>4. 配音與背景音樂</h2>
    <label class="chk"><input type="checkbox" data-vg="voiceOn"${v.voice.on ? ' checked' : ''}> AI 旁白配音（Gemini TTS）</label>
    <div class="row2"><label>聲音<select data-vg="voiceName">${opts(VOICES, v.voice.name)}</select></label><label>語氣指示<input maxlength="200" data-vg="voiceStyle" value="${esc(v.voice.style)}"></label></div>
    <div class="btns"><button type="button" class="pri" data-act="vTts"${v.sections.length && v.voice.on ? '' : ' disabled'}>產生配音</button><button type="button" data-act="vTtsTest"${v.sections.length ? '' : ' disabled'}>試聽第一句</button></div>
    <div id="vTtsProg" class="vprog-box"></div><div id="vTtsErr"></div>
    <h3>背景音樂</h3>
    ${v.music ? `<p>🎵 ${esc(v.music.name)} <button type="button" class="ghost" data-act="vMusicDel">移除</button></p>` : '<p class="hint">選填。請使用你有權使用的音樂（例如 YouTube 音訊庫、Pixabay 免費音樂），上限 5 MB。</p>'}
    <label class="btn">${v.music ? '更換音樂' : '上傳音樂（mp3／m4a／wav）'}<input class="vh" type="file" accept="audio/*" data-vf="music"></label>
    <label>音樂音量 <input type="range" min="0" max="0.4" step="0.01" data-vg="musicVol" value="${esc(v.musicVol)}"></label>
    <div id="vMusicProg" class="vprog-box"></div>
  </div>

  <div class="card"><h2>5. AI 動態鏡頭（選用）</h2>
    <p class="hint">在腳本段落展開「🎥 AI 動態鏡頭」並勾選，就會用 Gemini Omni 生成真正的第一人稱動態影片取代照片動畫（每段約 3–10 秒，費用約 US$1 以內，生成約 2–4 分鐘）。需要 Gemini 付費方案；免費方案會顯示額度為 0。</p>
    <div class="btns"><button type="button" data-act="vOmni"${v.sections.some((s) => s.useClip) ? '' : ' disabled'}>生成勾選段落的動態鏡頭（${v.sections.filter((s) => s.useClip).length}）</button></div>
    <div id="vOmniProg" class="vprog-box"></div><div id="vOmniList"></div>
  </div>

  <div class="card"><h2>6. 預覽與輸出</h2>
    <div class="vstage"><canvas id="vCanvas" width="${VW}" height="${VH}" aria-label="影片預覽"></canvas></div>
    <div class="btns"><button type="button" data-act="vPlay"${v.sections.length ? '' : ' disabled'}>▶ 預覽</button><button type="button" class="ghost" data-act="vStop">■ 停止</button><button type="button" class="pri" data-act="vRender"${v.sections.length ? '' : ' disabled'}>輸出影片</button></div>
    <p class="hint">輸出是即時錄製：影片多長就要錄多久，錄製時請停留在這個分頁。Chrome／Edge 會輸出 MP4；其他瀏覽器可能是 WebM，上傳前可再轉檔。</p>
    <div id="vRenderProg" class="vprog-box"></div><div id="vOut"></div>
  </div>`;
  // 照片縮圖
  $$('#vImgs img[data-vimg]').forEach(async (im) => { try { im.src = await mUrl(im.dataset.vimg); } catch { im.alt = '讀取失敗'; } });
  drawStill(i);
  omniResume(i);
}
const clipLabel = (c) => (!c ? '尚未生成' : c.state === 'done' ? '已完成' : c.state === 'error' ? '失敗' : '生成中');
function estTotal(v) { return v.sections.reduce((t, s) => t + secDur(v, s), 0); }
function secDur(v, s) {
  const a = v.voice.on && v.audio[s.id]?.dur ? v.audio[s.id].dur : String(s.text || '').length / 4.4;
  return Math.max(2.6, a + 0.8) + (s.effect === 'pack' ? 0.8 : 0);
}

/* ========== AI 腳本 ========== */
async function genScript(btn) {
  const i = vItem(); if (!i || vBusy) return; const v = V(i);
  if (!v.images.length) { toast('請先上傳照片'); return; }
  if (v.sections.length && !confirm('重新產生會取代目前的腳本，確定？')) return;
  vBusy = 'script'; btn.disabled = true;
  const t0 = Date.now(), tick = setInterval(() => { const e = (Date.now() - t0) / 1000; vProg('vScriptProg', Math.min(0.92, 0.15 + e / 25), `AI 正在看照片寫腳本…已經過 ${secs(e)}（約需 10–25 秒）`); }, 500);
  $('#vScriptErr').innerHTML = '';
  try {
    vProg('vScriptProg', 0.05, '準備照片縮圖…');
    const imgs = [];
    for (const im of v.images.slice(0, 6)) imgs.push({ mime: 'image/jpeg', data: await b64(await shrink(await mGet(im.key), 512, 0.72)) });
    const j = await ai('video_script', { name: i.name, category: i.category, price: num(i.price), imageCount: v.images.length, seconds: v.seconds, images: imgs });
    const o = j.json;
    if (!o || !Array.isArray(o.sections) || !o.sections.length) throw new Error('AI 沒有回傳可用的腳本，請重試');
    const n = v.images.length;
    v.sections = o.sections.slice(0, 8).map((x) => ({
      id: uid(), text: aiTxt(x.text).slice(0, 80), card: aiTxt(x.card).slice(0, 16),
      effect: EFFECTS[x.effect] ? x.effect : 'push', image: Math.min(n - 1, Math.max(0, Math.round(num(x.image)))),
      motion: aiTxt(x.motion).slice(0, 1200), useClip: false,
    }));
    if (v.sections[v.sections.length - 1].effect !== 'pack') v.sections[v.sections.length - 1].effect = 'pack';
    v.endTitle = aiTxt(o.endTitle).slice(0, 20) || i.name.slice(0, 14);
    v.endSub = aiTxt(o.endSub).slice(0, 24);
    v.title = aiTxt(o.title).slice(0, 30);
    v.audio = {};
    save.i();
    vProg('vScriptProg', 1, `✓ 腳本完成（${v.sections.length} 段，模型 ${j.model}）`);
    renderVideo(true);
    vProg('vScriptProg', 1, `✓ 腳本完成（${v.sections.length} 段），可以直接修改文字、效果與照片`);
  } catch (e) { vProg('vScriptProg', null); showErr($('#vScriptErr'), e); }
  finally { clearInterval(tick); vBusy = ''; btn.disabled = false; }
}

/* ========== 配音 ========== */
const ttsKey = (i, s, v) => `vo_${vsafe(i.id)}_${vsafe(s.id)}_${hashStr(`${s.text}|${v.voice.name}|${v.voice.style}`)}`;
async function ttsOne(text, v) {
  const r = await fetch('/api/tts', { method: 'POST', headers: mHead('application/json'), body: JSON.stringify({ text, voice: v.voice.name, style: v.voice.style }) });
  if (!r.ok) await mFail(r);
  return r.blob();
}
let audioCtx = null;
const actx = () => (audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());
const decode = async (blob) => actx().decodeAudioData(await blob.arrayBuffer());
async function genTts(btn) {
  const i = vItem(); if (!i || vBusy) return; const v = V(i);
  const list = v.sections.filter((s) => s.text.trim());
  if (!list.length) { toast('沒有旁白文字'); return; }
  vBusy = 'tts'; btn.disabled = true; $('#vTtsErr').innerHTML = '';
  let done = 0, made = 0;
  try {
    for (const s of list) {
      const key = ttsKey(i, s, v);
      vProg('vTtsProg', done / list.length, `配音中 ${done + 1}／${list.length}：「${s.text.slice(0, 18)}」`);
      if (v.audio[s.id]?.key !== key) {
        const blob = await ttsOne(s.text, v);
        await mPut(key, blob);
        const buf = await decode(blob);
        if (v.audio[s.id]?.key) mDel(v.audio[s.id].key);
        v.audio[s.id] = { key, dur: Math.round(buf.duration * 100) / 100 };
        made++; save.i();
      }
      done++;
    }
    vProg('vTtsProg', 1, `✓ 配音完成：新產生 ${made} 句，沿用 ${done - made} 句（文字沒改的句子不會重新產生）`);
    const y = window.scrollY; renderVideo(true); window.scrollTo(0, y);
    vProg('vTtsProg', 1, `✓ 配音完成：新產生 ${made} 句，沿用 ${done - made} 句`);
  } catch (e) { vProg('vTtsProg', done / list.length, `已完成 ${done}／${list.length} 句後中斷`); showErr($('#vTtsErr'), e); }
  finally { vBusy = ''; btn.disabled = false; }
}
async function ttsTest(btn) {
  const i = vItem(); if (!i) return; const v = V(i), s = v.sections[0]; if (!s) return;
  btn.disabled = true; vProg('vTtsProg', -1, '產生試聽中…');
  try {
    const key = ttsKey(i, s, v);
    const blob = v.audio[s.id]?.key === key ? await mGet(key) : await ttsOne(s.text, v);
    const src = actx().createBufferSource(); src.buffer = await decode(blob); src.connect(actx().destination); await actx().resume(); src.start();
    vProg('vTtsProg', 1, '▶ 試聽中');
  } catch (e) { vProg('vTtsProg', null); showErr($('#vTtsErr'), e); }
  finally { btn.disabled = false; }
}

/* ========== AI 動態鏡頭（Gemini Omni，背景函式） ========== */
const omniPolls = new Map();
async function genOmni(btn) {
  const i = vItem(); if (!i || vBusy) return; const v = V(i);
  const list = v.sections.filter((s) => s.useClip);
  if (!list.length) return;
  if (list.some((s) => !s.motion.trim())) { toast('勾選的段落需要英文提示詞'); return; }
  if (!confirm(`將用 Gemini Omni 生成 ${list.length} 段動態影片，每段費用約 US$1 以內（依你的 Google 帳單計費）。確定？`)) return;
  btn.disabled = true;
  try {
    for (const s of list) {
      const img = v.images[s.image] || v.images[0];
      const keys = [...new Set([img?.key, v.images[0]?.key].filter(Boolean))];
      const prompt = `${keys.length ? 'Reference: <IMAGE_REF_0> is the exact product — keep its shape, colors, logo and proportions identical throughout. ' : ''}${s.motion.trim()} Vertical 9:16 framing. Single continuous shot. No on-screen text. No dialogue, no voice-over.`;
      const jobId = `${vsafe(i.id)}_${vsafe(s.id)}_${Date.now().toString(36)}`;
      const r = await fetch('/.netlify/functions/omni-background', { method: 'POST', headers: mHead('application/json'), body: JSON.stringify({ jobId, prompt, imageKeys: keys }) });
      if (!r.ok && r.status !== 202) throw new Error(`無法啟動生成（HTTP ${r.status}）`);
      if (v.clips[s.id]?.key) mDel(v.clips[s.id].key);
      v.clips[s.id] = { jobId, state: 'running', at: Date.now() };
    }
    save.i(); omniResume(i);
  } catch (e) { toast(e.message); }
  finally { btn.disabled = false; }
}
function omniResume(i) {
  const v = V(i);
  const live = v.sections.filter((s) => s.useClip && v.clips[s.id]);
  if (!live.length) { vProg('vOmniProg', null); const l = $('#vOmniList'); if (l) l.innerHTML = ''; return; }
  const draw = () => {
    const l = $('#vOmniList'); if (!l || vItem() !== i) return;
    const now = Date.now();
    const ps = live.map((s) => { const c = v.clips[s.id]; return c.state === 'done' || c.state === 'error' ? 1 : Math.min(0.95, (now - c.at) / 1000 / OMNI_EST); });
    const run = live.filter((s) => v.clips[s.id].state === 'running').length;
    vProg('vOmniProg', ps.reduce((a, b) => a + b, 0) / ps.length, run ? `生成中 ${live.length - run}／${live.length} 完成（每段約 2–4 分鐘，可以先做其他事）` : `完成 ${live.filter((s) => v.clips[s.id].state === 'done').length}／${live.length}`);
    l.innerHTML = `<ol class="batch-list">${live.map((s) => { const c = v.clips[s.id], k = v.sections.indexOf(s) + 1;
      return `<li><span>第 ${k} 段</span><span class="${c.state === 'done' ? 'pubok' : c.state === 'error' ? 'danger' : 'muted'}">${c.state === 'done' ? '✓ 完成' : c.state === 'error' ? `✕ ${esc(c.error || '失敗')}` : `生成中…${secs((now - c.at) / 1000)}`}</span></li>`; }).join('')}</ol>`;
  };
  draw();
  for (const s of live) {
    const c = v.clips[s.id];
    if (c.state !== 'running' || omniPolls.has(c.jobId)) continue;
    const t = setInterval(async () => {
      try {
        const st = JSON.parse(await (await mGet(`omnijob_${c.jobId}`, true)).text());
        if (st.state === 'done') { c.state = 'done'; c.key = st.videoKey; }
        else if (st.state === 'error') { c.state = 'error'; c.error = st.error; }
      } catch (e) { if (e.status !== 404) { c.state = 'error'; c.error = e.message; } else if (Date.now() - c.at > 16 * 60e3) { c.state = 'error'; c.error = '逾時沒有回應'; } }
      if (c.state !== 'running') { clearInterval(t); omniPolls.delete(c.jobId); save.i(); }
      draw();
    }, 8000);
    omniPolls.set(c.jobId, t);
  }
  clearInterval(omniResume.t); omniResume.t = setInterval(() => { if (location.hash !== '#video') return clearInterval(omniResume.t); draw(); }, 1000);
}

/* ========== 算圖引擎（Canvas） ========== */
// 固定亂數，讓預覽與輸出的噴霧一致
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const springy = (x) => { x = Math.max(0, x); return 1 - Math.exp(-6 * x) * Math.cos(9 * x); };

function blurOf(img) {   // 小圖放大＝便宜又跨瀏覽器的模糊背景
  const c = document.createElement('canvas'); c.width = 27; c.height = 48;
  const x = c.getContext('2d'); const sc = Math.max(27 / img.width, 48 / img.height);
  x.drawImage(img, (27 - img.width * sc) / 2, (48 - img.height * sc) / 2, img.width * sc, img.height * sc);
  return c;
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrapText(ctx, text, maxW) {
  const lines = []; let cur = '';
  for (const ch of String(text)) { if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}
function pill(ctx, text, cy, size, bg, fg, alpha = 1, padX = 46, padY = 22, maxW = 940) {
  if (!text || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `700 ${size}px ${VFONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, text, maxW - padX * 2), lh = size * 1.3;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2), h = lines.length * lh + padY * 2;
  ctx.shadowColor = 'rgba(59,47,37,0.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.fillStyle = bg; rrect(ctx, (VW - w) / 2, cy - h / 2, w, h, Math.min(h / 2, 40)); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = fg;
  lines.forEach((l, n) => ctx.fillText(l, VW / 2, cy - h / 2 + padY + lh * n + lh / 2));
  ctx.restore();
}
// 旁白切成字幕：依標點切段、合併成 16 字內，時間依字數比例分配
function subCues(text, dur) {
  const parts = String(text).split(/(?<=[，。！？、,!?；;])/).map((x) => x.trim()).filter(Boolean);
  const out = []; for (const p of parts) { if (out.length && (out[out.length - 1] + p).length <= 16) out[out.length - 1] += p; else out.push(p); }
  const total = out.reduce((t, x) => t + x.length, 0) || 1; let t = 0;
  return out.map((x) => { const d = dur * x.length / total; const c = { text: x.replace(/[，、,；;]$/, ''), from: t, to: t + d }; t += d; return c; });
}
function timeline(v, A) {
  let t = 0;
  return v.sections.map((s) => {
    const vd = A.vo[s.id]?.duration || 0;
    const speak = vd || String(s.text || '').length / 4.4;
    const d = Math.max(2.6, speak + 0.8) + (s.effect === 'pack' ? 0.8 : 0);
    const seg = { s, t0: t, d, speak, cues: subCues(s.text, speak) };
    t += d; return seg;
  });
}
// 依照片、效果與時間，算出照片在面板中的位置（cover＋以焦點為中心縮放）
function placement(img, s, lt, d) {
  const base = Math.max(PS / img.width, PS / img.height);
  let zoom = 1, dy = 0;
  if (s.effect === 'push' || s.effect === 'shine') zoom = 1 + 0.08 * ease(lt / d);
  if (s.effect === 'mist') zoom = 1.02 + 0.08 * ease(lt / d);
  if (s.effect === 'lift') { const p = springy((lt - 0.25) / 1.1); dy = 70 - 95 * Math.min(1.15, p); zoom = 1 + 0.04 * ease(lt / d); }
  const sc = base * zoom, w = img.width * sc, h = img.height * sc;
  const fx = s.point ? s.point[0] : 0.5, fy = s.point ? s.point[1] : 0.5;
  const x0 = (PS - img.width * base) / 2, y0 = (PS - img.height * base) / 2;   // 未縮放時的位置
  const px = x0 + fx * img.width * base, py = y0 + fy * img.height * base;   // 焦點在面板上的位置（固定不動）
  return { x: px - fx * w, y: py - fy * h + dy, w, h, sc };
}
const MIST_BURSTS = (d) => [0.5, 1.7, 2.9].filter((b) => b < d - 0.6);
function drawMist(ctx, ox, oy, angle, lt, d, seed) {
  for (const [bi, b] of MIST_BURSTS(d).entries()) {
    const age0 = lt - b; if (age0 < 0 || age0 > 1.4) continue;
    const r = rng(seed * 31 + bi);
    // 光暈
    const glow = Math.sin(Math.min(1, age0 / 0.9) * Math.PI);
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(angle * Math.PI / 180); ctx.globalAlpha = 0.45 * glow;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 380); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(220, 0, 300, 90, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.fillStyle = '#FFFDF6';
    for (let k = 0; k < 260; k++) {
      const spawn = r() * 0.22, life = 0.5 + r() * 0.55, a = (angle + (r() - 0.5) * 30) * Math.PI / 180, reach = 380 + r() * 360, rad0 = 0.9 + r() * 1.9, op = 0.35 + r() * 0.55;
      const age = age0 - spawn; if (age < 0 || age > life) continue;
      const t = age / life, dist = reach * (1 - Math.pow(1 - t, 2.4));
      ctx.globalAlpha = Math.pow(1 - t, 1.4) * op;
      ctx.beginPath(); ctx.arc(ox + Math.cos(a) * dist, oy + Math.sin(a) * dist + t * t * 40, rad0 + t * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
function panelFrame(ctx, fn, white) {
  ctx.save(); ctx.shadowColor = 'rgba(59,47,37,0.25)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  ctx.fillStyle = white ? '#fff' : VC.cream; rrect(ctx, 0, PY, PS, PS, 40); ctx.fill(); ctx.restore();
  ctx.save(); rrect(ctx, 0, PY, PS, PS, 40); ctx.clip(); ctx.translate(0, PY); fn(); ctx.restore();
}
function drawFrame(ctx, t, A) {
  const { segs, imgs, blurs, clips, v } = A;
  ctx.fillStyle = VC.cream; ctx.fillRect(0, 0, VW, VH);
  if (!segs.length) return;
  const seg = segs.find((g) => t < g.t0 + g.d) || segs[segs.length - 1];
  const s = seg.s, lt = Math.max(0, t - seg.t0), d = seg.d;
  const img = imgs[s.image] || imgs[0];
  const clip = s.useClip && clips[s.id];

  if (s.effect === 'grid' && imgs.length) {
    const n = Math.min(imgs.length, 6), cols = n <= 2 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 20;
    const cw = (VW - 80 - gap * (cols - 1)) / cols, ch = Math.min(cw * 1.25, (1180 - gap * (rows - 1)) / rows), top = 420 + (1180 - (ch * rows + gap * (rows - 1))) / 2;
    for (let k = 0; k < n; k++) {
      const p = springy((lt - k * 0.12) / 0.7); if (p <= 0) continue;
      const im = imgs[k], cx = 40 + (k % cols) * (cw + gap), cy = top + Math.floor(k / cols) * (ch + gap), sc = 0.6 + 0.4 * Math.min(1.05, p);
      ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.4); ctx.translate(cx + cw / 2, cy + ch / 2); ctx.scale(sc, sc);
      ctx.shadowColor = 'rgba(59,47,37,0.22)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; ctx.fillStyle = '#fff'; rrect(ctx, -cw / 2, -ch / 2, cw, ch, 26); ctx.fill();
      ctx.shadowColor = 'transparent'; rrect(ctx, -cw / 2, -ch / 2, cw, ch, 26); ctx.clip();
      const k2 = Math.max(cw / im.width, ch / im.height); ctx.drawImage(im, -im.width * k2 / 2, -im.height * k2 / 2, im.width * k2, im.height * k2);
      ctx.restore();
    }
  } else if (s.effect === 'pack' && img && !clip) {
    const a = ease(lt / 0.4), sc = (0.97 + 0.03 * a) * (1 + 0.04 * (lt / d));
    ctx.save(); ctx.globalAlpha = a; ctx.translate(VW / 2, PY + PS / 2); ctx.scale(sc, sc); ctx.translate(-VW / 2, -(PY + PS / 2));
    panelFrame(ctx, () => { const k = Math.min(PS / img.width, PS / img.height) * 0.92; ctx.drawImage(img, (PS - img.width * k) / 2, (PS - img.height * k) / 2, img.width * k, img.height * k); }, true);
    ctx.restore();
    const b = ease((lt - 0.2) / 0.5);
    ctx.save(); ctx.globalAlpha = b; ctx.fillStyle = VC.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 80px ${VFONT}`; wrapText(ctx, v.endTitle, 980).slice(0, 2).forEach((l, n, arr) => ctx.fillText(l, VW / 2, 230 - (arr.length - 1) * 48 + n * 96 + (1 - b) * 20));
    ctx.font = `700 44px ${VFONT}`; ctx.globalAlpha = ease((lt - 0.45) / 0.5); ctx.fillText(v.endSub, VW / 2, 1760);
    ctx.restore();
  } else if (img || clip) {
    // 模糊背景
    const bl = clip ? null : blurs[imgs.indexOf(img)];
    if (bl) { ctx.save(); ctx.globalAlpha = 0.55; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bl, -60, -60, VW + 120, VH + 120); ctx.restore(); ctx.fillStyle = 'rgba(239,231,220,0.45)'; ctx.fillRect(0, 0, VW, VH); }
    const press = s.effect === 'mist' ? MIST_BURSTS(d).reduce((acc, b) => { const x = lt - b + 0.05; return acc + (x > 0 && x < 0.27 ? Math.sin(x / 0.27 * Math.PI) * 7 : 0); }, 0) : 0;
    panelFrame(ctx, () => {
      if (clip && clip.readyState >= 2) {
        const k = Math.max(PS / clip.videoWidth, PS / clip.videoHeight); ctx.drawImage(clip, (PS - clip.videoWidth * k) / 2, (PS - clip.videoHeight * k) / 2, clip.videoWidth * k, clip.videoHeight * k);
        return;
      }
      if (!img) return;
      const p = placement(img, s, lt, d);
      ctx.drawImage(img, p.x, p.y + press, p.w, p.h);
      if (s.effect === 'mist') {
        const fx = s.point ? s.point[0] : 0.3, fy = s.point ? s.point[1] : 0.35;
        drawMist(ctx, p.x + fx * p.w, p.y + press + fy * p.h, Number(s.dir ?? 180), lt, d, hashNum(s.id));
      }
      if (s.effect === 'shine') {
        const x = -400 + 1900 * ease((lt - 0.3) / 1.4);
        const g = ctx.createLinearGradient(x - 220, 0, x + 220, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.setTransform(1, 0, -0.35, 1, 0, PY); ctx.fillStyle = g; ctx.fillRect(x - 260, 0, 520, PS); ctx.restore();
      }
    });
  }
  // 字卡
  if (s.card && s.effect !== 'pack') pill(ctx, s.card, 210, 66, VC.card, VC.ink, ease((lt - 0.15) / 0.35));
  // 字幕
  const sl = lt - 0.15, cue = seg.cues.find((c) => sl >= c.from && sl < c.to);
  if (cue) { const a = Math.min(1, (sl - cue.from) / 0.12, (cue.to - sl) / 0.12); pill(ctx, cue.text, s.effect === 'pack' ? 1640 : 1620, 54, VC.sub, '#fff', a, 36, 16); }
}
const hashNum = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) | 0; return h; };

async function loadAssets(i, onStep, light) {
  const v = V(i), A = { v, imgs: [], blurs: [], vo: {}, clips: {}, music: null };
  const steps = v.images.length + (light ? 0 : v.sections.length + (v.music ? 1 : 0)); let n = 0;
  const step = (l) => onStep?.(++n / Math.max(1, steps), l);
  for (const im of v.images) { A.imgs.push(await createImageBitmap(await mGet(im.key))); step('讀取照片'); }
  A.blurs = A.imgs.map(blurOf);
  if (light) { A.segs = timeline(v, A); A.total = A.segs.reduce((t, g) => t + g.d, 0); return A; }
  for (const s of v.sections) {
    const a = v.audio[s.id];
    if (v.voice.on && a?.key && a.key === ttsKey(i, s, v)) { try { A.vo[s.id] = await decode(await mGet(a.key)); } catch { /* 缺檔就不念 */ } }
    const c = v.clips[s.id];
    if (s.useClip && c?.state === 'done' && c.key) {
      try {
        const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.preload = 'auto'; el.src = await mUrl(c.key);
        await new Promise((res) => { el.onloadeddata = res; el.onerror = res; setTimeout(res, 8000); });
        if (el.readyState >= 2) A.clips[s.id] = el;
      } catch { /* 沒有影片就用照片動畫 */ }
    }
    step('讀取配音與動態鏡頭');
  }
  if (v.music) { try { A.music = await decode(await mGet(v.music.key)); } catch { toast('背景音樂讀取失敗，將不放音樂'); } step('讀取音樂'); }
  A.segs = timeline(v, A); A.total = A.segs.reduce((t, g) => t + g.d, 0);
  return A;
}
function sprayBuffer(ac) {
  const len = Math.round(ac.sampleRate * 0.5), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  let last = 0; for (let k = 0; k < len; k++) { const w = Math.random() * 2 - 1; last = 0.6 * last + 0.4 * w; const env = k < len * 0.03 ? k / (len * 0.03) : Math.pow(1 - k / len, 2.2); d[k] = (w - last) * env * 0.9; }
  return b;
}
// 排程所有聲音，回傳開始時間
function scheduleAudio(ac, A, out) {
  const T0 = ac.currentTime + 0.3, nodes = [];
  const play = (buf, at, gain, loop, dur) => { const src = ac.createBufferSource(); src.buffer = buf; src.loop = !!loop; const g = ac.createGain(); g.gain.value = gain; src.connect(g).connect(out); src.start(at, 0, loop ? undefined : dur); nodes.push(src); return g; };
  for (const g of A.segs) if (A.vo[g.s.id]) play(A.vo[g.s.id], T0 + g.t0 + 0.15, 1);
  const sp = sprayBuffer(ac);
  for (const g of A.segs) if (g.s.effect === 'mist' && !(g.s.useClip && A.clips[g.s.id])) for (const b of MIST_BURSTS(g.d)) play(sp, T0 + g.t0 + b, 0.5);
  if (A.music && A.v.musicVol > 0) {
    const g = play(A.music, T0, 0, true), vol = Number(A.v.musicVol);
    g.gain.setValueAtTime(0, T0); g.gain.linearRampToValueAtTime(vol, T0 + 0.6);
    g.gain.setValueAtTime(vol, T0 + Math.max(0.7, A.total - 1.4)); g.gain.linearRampToValueAtTime(0, T0 + A.total);
    nodes[nodes.length - 1].stop(T0 + A.total + 0.05);
  }
  return { T0, stop: () => nodes.forEach((n) => { try { n.stop(); } catch { /* 已停止 */ } }) };
}
function syncClips(A, t, playing) {
  for (const g of A.segs) {
    const el = A.clips[g.s.id]; if (!el) continue;
    const inSeg = t >= g.t0 && t < g.t0 + g.d;
    if (inSeg && playing) { if (el.paused) { el.currentTime = Math.min(t - g.t0, (el.duration || 99) - 0.05); el.play().catch(() => {}); } }
    else if (!el.paused) el.pause();
  }
}

let vRun = null;   // 目前的預覽或輸出工作
function vStopAll() { if (vRun) { vRun.cancel(); vRun = null; } }
async function drawStill(i) {
  const c = $('#vCanvas'); if (!c) return; const ctx = c.getContext('2d'); const v = V(i);
  ctx.fillStyle = VC.cream; ctx.fillRect(0, 0, VW, VH);
  if (!v.sections.length || !v.images.length) { pill(ctx, v.images.length ? '產生腳本後可預覽' : '請先上傳照片', VH / 2, 56, VC.card, VC.ink); return; }
  try { const A = await loadAssets(i, null, true); A.segs.length && drawFrame(ctx, Math.min(1.2, A.total), A); } catch { /* 預覽圖失敗不影響操作 */ }
}
async function runPlayback(record) {
  const i = vItem(); if (!i) return; const v = V(i);
  if (!v.sections.length) return;
  if (vBusy) { toast('目前有其他工作進行中'); return; }
  vStopAll(); vBusy = record ? 'render' : 'play';
  const c = $('#vCanvas'), ctx = c.getContext('2d'), pid = 'vRenderProg';
  let cancelled = false, raf = 0, audio = null, rec = null, A = null;
  const job = { cancel: () => { cancelled = true; cancelAnimationFrame(raf); audio?.stop(); if (rec && rec.state !== 'inactive') rec.stop(); Object.values(A?.clips || {}).forEach((el) => el.pause()); vBusy = ''; } };
  vRun = job;
  try {
    vProg(pid, 0, '載入素材…');
    A = await loadAssets(i, (p, l) => vProg(pid, p * 0.1, `${l}…`));
    if (cancelled) return;
    const missing = v.voice.on ? v.sections.filter((s) => s.text.trim() && !A.vo[s.id]).length : 0;
    if (missing && record && !confirm(`有 ${missing} 段還沒產生配音（或旁白改過還沒重新產生），這幾段會沒有聲音。仍要輸出？`)) { job.cancel(); vProg(pid, null); return; }
    const ac = actx(); await ac.resume();
    let out = ac.destination, dest = null;
    if (record) {
      dest = ac.createMediaStreamDestination(); out = dest;
      const types = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mime = types.find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x));
      if (!mime || !c.captureStream) throw new Error('這個瀏覽器不支援在網頁中錄製影片，請改用電腦版 Chrome 或 Edge');
      const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6, audioBitsPerSecond: 160e3 });
      const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        if (cancelled && !rec._done) return;
        const blob = new Blob(chunks, { type: mime.split(';')[0] }), ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
        const url = URL.createObjectURL(blob), name = `${(v.title || i.name).replace(/[\\/:*?"<>|]+/g, '').slice(0, 30)}_${today()}.${ext}`;
        $('#vOut').innerHTML = `<video class="vout" controls playsinline src="${url}"></video>
          <div class="btns"><a class="btn pri" href="${url}" download="${esc(name)}">下載影片（${ext.toUpperCase()}，${(blob.size / 1048576).toFixed(1)} MB）</a></div>
          ${ext === 'webm' ? '<p class="hint">這個瀏覽器只能輸出 WebM。IG、蝦皮等平台若不接受，可用 CapCut 或線上轉檔工具轉成 MP4。</p>' : ''}`;
        vProg(pid, 1, `✓ 輸出完成：${secs(A.total)}、${ext.toUpperCase()}`);
      };
      // H.264（MP4）編碼器第一次啟動要幾秒，期間錄到的畫面會被丟掉（實測無 GPU 時約 3.5 秒）。
      // 1) 這個頁面第一次輸出 MP4 時，先用一個拋棄式錄影器暖機；之後的錄製就幾乎不會掉格。
      // 2) 正式錄製開始後先停在第一格約 1 秒，吃掉剩下的少量掉格，再開始播放時間軸。
      const hold = (sec, label) => new Promise((res) => {
        const w0 = performance.now();
        const f = () => {
          if (cancelled) return res();
          const el = (performance.now() - w0) / 1000;
          drawFrame(ctx, 0, A); vProg(pid, 0.1 * Math.min(1, el / sec), label);
          if (el >= sec) res(); else raf = requestAnimationFrame(f);
        };
        f();
      });
      if (mime.startsWith('video/mp4') && !runPlayback.warm) {
        const w = new MediaRecorder(stream, { mimeType: mime }); w.ondataavailable = () => {}; w.start(250);
        await hold(4.5, '第一次錄影，編碼器暖機中（約 4 秒）…');
        await new Promise((res) => { w.onstop = res; w.stop(); });
        runPlayback.warm = true;
        if (cancelled) return;
      }
      rec.start(250);
      await hold(mime.startsWith('video/mp4') ? 1 : 0.3, '準備錄影中…');
      if (cancelled) return;
    }
    audio = scheduleAudio(ac, A, out);
    const warnHidden = () => { if (document.hidden && record) toast('錄製中請不要切換分頁，否則畫面會停住'); };
    document.addEventListener('visibilitychange', warnHidden);
    let lastP = 0;
    const loop = () => {
      if (cancelled) return;
      const t = ac.currentTime - audio.T0;
      if (t >= A.total) {
        drawFrame(ctx, A.total - 0.001, A); syncClips(A, A.total, false);
        document.removeEventListener('visibilitychange', warnHidden);
        if (rec) { rec._done = true; setTimeout(() => rec.state !== 'inactive' && rec.stop(), 300); vProg(pid, 0.99, '封裝影片中…'); }
        else vProg(pid, 1, '預覽結束');
        vRun = null; vBusy = '';
        return;
      }
      if (t >= 0) { drawFrame(ctx, t, A); syncClips(A, t, true); }
      const now = performance.now();
      if (now - lastP > 200) { lastP = now; const tt = Math.max(0, t); vProg(pid, 0.1 + 0.89 * tt / A.total, `${record ? '錄製中' : '預覽中'} ${secs(tt)}／${secs(A.total)}${record ? `｜剩約 ${secs(A.total - tt)}` : ''}`); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  } catch (e) { job.cancel(); vProg(pid, null); $('#vOut').innerHTML = `<div class="card err">${esc(e.message || e)}</div>`; }
}

/* ========== 噴口／焦點位置設定 ========== */
async function pointDlg(k) {
  const i = vItem(); if (!i) return; const v = V(i), s = v.sections[k]; if (!s) return;
  const im = v.images[s.image] || v.images[0]; if (!im) return;
  const d = $('#dlg');
  d.innerHTML = `<div class="dlg-head"><h2>第 ${k + 1} 段｜點選${s.effect === 'mist' ? '噴口' : '焦點'}位置</h2><button type="button" data-act="closeDlg" aria-label="關閉">✕</button></div>
    <p class="hint">${s.effect === 'mist' ? '在照片上點一下產品噴出霧的位置（噴嘴）。' : '在照片上點一下要推近的重點位置。'}</p>
    <div class="vpoint"><img id="vPtImg" alt="照片"><span class="vdot" id="vPtDot" hidden></span></div>
    <div class="btns"><button type="button" class="pri" data-act="closeDlg">完成</button>${s.point ? '<button type="button" class="ghost" data-act="vPointClear" data-k="' + k + '">清除（用預設位置）</button>' : ''}</div>`;
  const img = $('#vPtImg'); img.src = await mUrl(im.key);
  const dot = $('#vPtDot');
  const show = () => { if (!s.point) return; dot.hidden = false; dot.style.left = `${s.point[0] * 100}%`; dot.style.top = `${s.point[1] * 100}%`; };
  img.onload = show;
  img.onclick = (e) => { const r = img.getBoundingClientRect(); s.point = [Math.round((e.clientX - r.left) / r.width * 1000) / 1000, Math.round((e.clientY - r.top) / r.height * 1000) / 1000]; show(); save.i(); };
  d.onclose = () => { const y = window.scrollY; renderVideo(true); window.scrollTo(0, y); };
  if (!d.open) d.showModal();
}

/* ========== 事件 ========== */
Object.assign(ACT, {
  vScript(b) { genScript(b); },
  vAddSec() { const i = vItem(); if (!i) return; const v = V(i); v.sections.push({ id: uid(), text: '', card: '', effect: 'push', image: 0, motion: '', useClip: false }); save.i(); renderVideo(true); },
  vSecDel(b) { const i = vItem(); if (!i) return; const v = V(i), k = +b.dataset.k, s = v.sections[k]; if (!s || !confirm(`刪除第 ${k + 1} 段？`)) return; if (v.audio[s.id]?.key) mDel(v.audio[s.id].key); delete v.audio[s.id]; v.sections.splice(k, 1); save.i(); renderVideo(true); },
  vSecUp(b) { const i = vItem(); if (!i) return; const v = V(i), k = +b.dataset.k; if (k < 1) return; [v.sections[k - 1], v.sections[k]] = [v.sections[k], v.sections[k - 1]]; save.i(); renderVideo(true); },
  vImgDel(b) {
    const i = vItem(); if (!i) return; const v = V(i), k = +b.dataset.k, im = v.images[k]; if (!im || !confirm(`刪除照片 ${k + 1}？`)) return;
    mDel(im.key); v.images.splice(k, 1);
    v.sections.forEach((s) => { if (s.image === k) { s.image = 0; s.point = null; } else if (s.image > k) s.image--; });
    save.i(); renderVideo(true);
  },
  vImgLeft(b) {
    const i = vItem(); if (!i) return; const v = V(i), k = +b.dataset.k; if (k < 1) return;
    [v.images[k - 1], v.images[k]] = [v.images[k], v.images[k - 1]];
    v.sections.forEach((s) => { if (s.image === k) s.image = k - 1; else if (s.image === k - 1) s.image = k; });
    save.i(); renderVideo(true);
  },
  vPoint(b) { pointDlg(+b.dataset.k); },
  vPointClear(b) { const i = vItem(); if (!i) return; const s = V(i).sections[+b.dataset.k]; if (s) { s.point = null; save.i(); } $('#dlg').close(); },
  vTts(b) { genTts(b); },
  vTtsTest(b) { ttsTest(b); },
  vMusicDel() { const i = vItem(); if (!i) return; const v = V(i); if (v.music?.key) mDel(v.music.key); v.music = null; save.i(); renderVideo(true); },
  vOmni(b) { genOmni(b); },
  vPlay() { runPlayback(false); },
  vStop() { vStopAll(); vProg('vRenderProg', null); const i = vItem(); if (i) drawStill(i); },
  vRender() { runPlayback(true); },
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'vItem') { vStopAll(); vSel = t.value; store.set('vSel', vSel); renderVideo(true); return; }
  if (!t.closest?.('#v-video')) return;
  const i = vItem(); if (!i) return; const v = V(i);
  if (t.matches('[data-vf="img"]') && t.files.length) {
    const files = [...t.files].slice(0, MAX_IMGS - v.images.length); t.value = '';
    if (!files.length) { toast(`最多 ${MAX_IMGS} 張`); return; }
    let n = 0;
    try {
      for (const f of files) {
        vProg('vImgProg', n / files.length, `上傳中 ${n + 1}／${files.length}：${f.name}`);
        const blob = await shrink(f, 1080), key = `img_${vsafe(i.id)}_${uid()}`;
        await mPut(key, blob); v.images.push({ key }); n++; save.i();
      }
      vProg('vImgProg', 1, `✓ 已上傳 ${n} 張`);
    } catch (err) { vProg('vImgProg', n / files.length, `上傳失敗：${err.message}`); }
    const y = window.scrollY; renderVideo(true); window.scrollTo(0, y);
    return;
  }
  if (t.matches('[data-vf="music"]') && t.files.length) {
    const f = t.files[0]; t.value = '';
    if (f.size > 5.4 * 1048576) { toast('音樂檔超過 5 MB，請先壓縮或剪短'); return; }
    vProg('vMusicProg', -1, `上傳中：${f.name}`);
    try {
      const key = `music_${vsafe(i.id)}_${uid()}`, blob = f.type ? f : new Blob([f], { type: 'audio/mpeg' });
      await decode(blob);   // 先確認瀏覽器能播放
      await mPut(key, blob);
      if (v.music?.key) mDel(v.music.key);
      v.music = { key, name: f.name.slice(0, 80) }; save.i();
      vProg('vMusicProg', 1, '✓ 音樂已上傳'); const y = window.scrollY; renderVideo(true); window.scrollTo(0, y);
    } catch (err) { vProg('vMusicProg', null); toast(`音樂上傳失敗：${err.message || '格式不支援'}`); }
    return;
  }
  // 會影響版面的欄位：改完重繪
  if (t.matches('[data-vs="effect"],[data-vs="image"],[data-vs="useClip"],[data-vg="voiceOn"]')) {
    vField(t, v); save.i(); const y = window.scrollY; renderVideo(true); window.scrollTo(0, y); drawStill(i);
  }
});
document.addEventListener('input', (e) => {
  const t = e.target; if (!t.closest?.('#v-video')) return;
  const i = vItem(); if (!i) return; const v = V(i);
  if (t.matches('[data-vs],[data-vg]')) { vField(t, v); vSave(); }
});
function vField(t, v) {
  const val = t.type === 'checkbox' ? t.checked : t.value;
  if (t.dataset.vs) {
    const s = v.sections[+t.dataset.k]; if (!s) return; const f = t.dataset.vs;
    if (f === 'image') { s.image = +val; s.point = null; }
    else if (f === 'dir') s.dir = +val;
    else if (f === 'effect') { s.effect = EFFECTS[val] ? val : 'push'; }
    else s[f] = val;
  } else {
    const f = t.dataset.vg;
    if (f === 'voiceOn') v.voice.on = !!val;
    else if (f === 'voiceName') v.voice.name = VOICES[val] ? val : 'Kore';
    else if (f === 'voiceStyle') v.voice.style = String(val).slice(0, 200);
    else if (f === 'musicVol') v.musicVol = clamp(num(val), 0, 0.4);
    else if (f === 'seconds') v.seconds = clamp(Math.round(num(val)) || 25, 15, 45);
    else if (f === 'endTitle' || f === 'endSub') v[f] = String(val);
  }
}

/* ========== 掛上路由 ========== */
VIEWS.push('video');
RENDER.video = () => renderVideo(false);
window.addEventListener('hashchange', () => { if (location.hash !== '#video') vStopAll(); });
if (location.hash === '#video') route();
