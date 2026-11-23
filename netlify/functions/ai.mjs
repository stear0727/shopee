// /api/ai — 唯一的後端端點：任務白名單、伺服器端組裝提示詞、呼叫 Gemini。
// 金鑰只來自環境變數 GEMINI_API_KEY，或使用者以 x-gemini-key 標頭自備（不記錄、不寫日誌）。

const TASKS = new Set(['analyze', 'video_script']);
const VIDEO_EFFECTS = 'lift|push|mist|shine|grid|pack';
const MAX_PAYLOAD = 12 * 1024;          // 結構化欄位上限 12 KB
const MAX_IMAGE = 2_200_000;            // 壓縮後截圖 base64 上限（約 1.6 MB 原始）
const DEFAULT_MODELS = ['gemini-3-flash', 'gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
const PLAT = { fb: 'Facebook（粉專／社團）', ig: 'Instagram（貼文／限動）', threads: 'Threads', line: 'LINE 社群／官方帳號', dcard: 'Dcard／PTT', other: '其他社群',
  reels: 'Instagram', shorts: 'YouTube', tiktok: 'TikTok', shopee_video: '蝦皮' };
const SOCIAL = 'Facebook 粉專與社團、Instagram、Threads、LINE 社群、Dcard／PTT';

const SYS = `你是電商聯盟行銷分析師，專精蝦皮分潤計畫與社群媒體圖文帶貨（${SOCIAL}）。
規則：
1. 一律使用繁體中文（台灣用語），語氣像真人分享，不要像廣告。
2. 禁止捏造銷量、評價數、佣金率、價格等數字；資料不足時必須明確標示「假設」。
3. 貼文第一句就要抓住注意力（痛點、反差、驚喜或數字），並依平台調整長度與語氣：Threads 短而口語、Facebook 社團可較長且重實用資訊、Instagram 搭配圖片與 hashtag、LINE 社群重優惠與限時感。
4. 分潤連結通常放在留言、限動連結或個人頁，請依平台建議。
5. 一律提醒：貼文需揭露含分潤連結或合作關係、避免誇大或不實功效、價格與活動標註時效、使用實拍照片、不使用蝦皮商標造成官方誤認、遵守社團版規。
6. 精簡，不寫開場白與客套話。`;

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const s = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const plat = (v) => PLAT[v] || s(v, 30) || '未指定';
const models = () => [...new Set([process.env.GEMINI_MODEL, ...(process.env.GEMINI_FALLBACK_MODELS || '').split(','), ...DEFAULT_MODELS]
  .map((m) => (m || '').trim()).filter(Boolean))];

function scores(o) {
  const names = { sales: '銷量分', price: '價格衝動度' };
  const out = {};
  for (const [k, label] of Object.entries(names)) if (n(o?.[k]) != null) out[label] = n(o[k]);
  return out;
}

function build(task, p, hasImage) {
  switch (task) {
    case 'analyze': {
      // 節慶／活動資訊由使用者提供（前端預設帶入近三週節慶，可修改或關閉）
      const fest = p.wantFest ? s(p.festival, 500) : '';
      const festText = fest
        ? `
使用者提供的近期節慶／活動資訊：${fest}（今天：${new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)}）。
若此商品適合搭配其中某個節慶或活動（例如送禮、應景、檔期優惠），請在 festivalPost 寫一則 60–120 字的節慶活動貼文（點出節慶與時效、帶 emoji、CTA 與「#含分潤連結」、2–3 個相關 hashtag）；活動細節只能使用上述資訊，不要自行編造優惠；若都不適合，festivalPost 設為 null，不要硬套。`
        : '\nfestivalPost 設為 null。';
      return { json: true, text: `請分析以下候選商品是否值得在社群媒體發分潤貼文，並產出可直接使用的貼文素材。
商品資料（使用者輸入，未經查證）：
${JSON.stringify({ 名稱: s(p.name, 120), 分類: s(p.category, 40), 價格: n(p.price), 總佣金率百分比: n(p.rate), 平台: plat(p.platform), 形式: s(p.format, 20), 系統總分: n(p.total), 分級: s(p.grade, 2), 構面評分1到5: scores(p.scores) })}
只輸出 JSON，結構如下：
{"verdict":"一句話判斷","festivalPost":{"festival":"節慶名稱","post":"節慶活動貼文"},"posts":["3 則可直接發布的短貼文：每則 40–80 字、口語自然、第一句就抓住注意力（痛點、反差或驚喜）、帶 1–2 個 emoji、結尾有行動呼籲（例如「連結在留言／個人頁」）並加上「#含分潤連結」與 2–3 個相關 hashtag；三則風格不同（痛點型、開箱驚喜型、限時優惠型）"],"longPost":"一則 150–300 字的使用心得長文，適合 Facebook 社團或 Dcard：真實情境開頭、3 個重點、優缺點都提、結尾 CTA 與揭露","headlines":["3–5 個吸睛的第一句／標題"],"carousel":[{"slide":"第 1 張","title":"圖上大字","text":"說明"}],"imageIdeas":["3–4 個實拍照片建議（拍什麼、怎麼構圖）"],"strengths":["優勢"],"risks":["風險"],"cta":"行動呼籲（含連結放哪裡）","hashtags":["#標籤"],"bestTime":"建議發文時段與理由","replies":["2–3 個預想留言提問與建議回覆"],"tests":["A/B 測試建議"],"compliance":["合規提醒"]}
carousel 為 Instagram 多圖輪播 5–6 張的內容規劃。主要平台：${plat(p.platform)}，貼文形式：${s(p.format, 20) || '圖文貼文'}。${festText}` };
    }
    case 'video_script': {
      const k = Math.max(1, Math.min(8, n(p.imageCount) || 1));
      const dur = Math.max(15, Math.min(45, n(p.seconds) || 25));
      return { json: true, text: `請為以下商品寫一支 9:16 直式、約 ${dur} 秒的「第一人稱使用說明」短影音腳本。旁白會用語音合成念出；畫面由使用者提供的 ${k} 張商品照片做成動態（${hasImage ? '照片已依序附上，編號 0 到 ' + (k - 1) : '未附照片，請依常見商品照推想'}）。
商品資料（使用者輸入，未經查證）：${JSON.stringify({ 名稱: s(p.name, 120), 分類: s(p.category, 40), 價格: n(p.price) })}
只輸出 JSON：
{"title":"影片標題（15 字內）","sections":[{"text":"旁白：第一人稱、口語，像在跟朋友示範怎麼用，12–26 字","card":"畫面上方字卡大字，2–10 字（可為空字串）","image":照片編號,"effect":"${VIDEO_EFFECTS} 其中之一","motion":"英文提示詞，40–80 words"}],"endTitle":"收尾大字：品牌＋品名，14 字內","endSub":"收尾小字：規格或一個賣點，16 字內"}
規則：
1. 5–6 段，總旁白約 ${Math.round(dur * 3.6)} 字。第 1 段用痛點或好奇開場；中間段落依實際使用步驟示範（拿起、準備、使用、成果）；最後一段 effect 必須是 pack，旁白做收尾。
2. effect 意義：lift＝產品被手拿起；push＝鏡頭慢慢推近；mist＝從產品噴出霧狀或氣體（只在噴霧、噴油、加濕、香氛等會噴出東西的商品使用）；shine＝光澤掃過強調質感；grid＝多張照片拼貼（展示多用途、多款式或多情境）；pack＝產品收尾畫面。同一種 effect 不要連續出現。
3. image 選最符合該段內容的照片；pack 段優先選白底或乾淨背景、上面沒有大量文字的產品照。
4. 只能使用商品名稱與照片中看得到的資訊；不要捏造功效、數據、認證或價格以外的數字；不要寫「最」「第一」等誇大用語。
5. card 不要和旁白逐字重複，要更短、更像重點標語。
6. motion 是這一段若改用 AI 生成第一人稱動態影片時的英文提示詞：first-person POV from the user's own eyes, only hands visible, no face, describe the hand action on the product, setting, lighting and camera; single continuous shot; no on-screen text; no dialogue.` };
    }
  }
}

function retrySecs(j) {
  const d = (j?.error?.details || []).find((x) => String(x['@type'] || '').includes('RetryInfo'));
  const v = parseInt(d?.retryDelay, 10);
  return Number.isFinite(v) ? v : 30;
}

export default async (req) => {
  const envKey = process.env.GEMINI_API_KEY;
  const code = process.env.ACCESS_CODE;

  if (req.method === 'GET') return json(200, { ok: true, hasKey: !!envKey, needCode: !!code, model: models()[0] });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const userKey = (req.headers.get('x-gemini-key') || '').trim();
  if (!userKey && code && req.headers.get('x-access-code') !== code) return json(401, { ok: false, error: '存取碼錯誤或未填寫' });
  const key = userKey || envKey;
  if (!key) return json(401, { ok: false, error: '伺服器未設定 GEMINI_API_KEY，請在設定頁填入自備金鑰' });

  const raw = await req.text();
  if (raw.length > MAX_IMAGE + MAX_PAYLOAD * 2) return json(400, { ok: false, error: '資料過大' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: '請求格式錯誤' }); }
  const { task, payload } = body || {};
  if (!TASKS.has(task) || !payload || typeof payload !== 'object') return json(400, { ok: false, error: '任務名稱不合法' });

  let image = null;
  if (task === 'rank_extract' && payload.image) {
    const im = payload.image;
    if (!/^image\/(jpeg|png|webp)$/.test(im?.mime) || typeof im.data !== 'string' || im.data.length > MAX_IMAGE || !/^[A-Za-z0-9+/=]+$/.test(im.data)) {
      return json(400, { ok: false, error: '圖片格式或大小不符' });
    }
    image = im;
  }
  // 影片腳本：最多 6 張壓縮過的商品照片縮圖
  let images = [];
  if (task === 'video_script' && Array.isArray(payload.images)) {
    images = payload.images.slice(0, 6);
    const total = images.reduce((t, im) => t + String(im?.data || '').length, 0);
    if (total > MAX_IMAGE || images.some((im) => !/^image\/(jpeg|png|webp)$/.test(im?.mime) || typeof im.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(im.data))) {
      return json(400, { ok: false, error: '照片格式或大小不符' });
    }
  }
  const rest = { ...payload }; delete rest.image; delete rest.images;
  if (Buffer.byteLength(JSON.stringify(rest)) > MAX_PAYLOAD) return json(400, { ok: false, error: '資料過大（上限 12 KB），請縮小輸入' });

  const pr = build(task, rest, !!image || images.length > 0);
  const media = [...(image ? [image] : []), ...images].map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } }));
  const reqBody = {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: 'user', parts: [{ text: pr.text }, ...media] }],
    generationConfig: { temperature: pr.low ? 0.1 : 0.7, maxOutputTokens: 8192, ...(pr.json ? { responseMimeType: 'application/json' } : {}) },
    ...(pr.search ? { tools: [{ google_search: {} }] } : {}),
  };

  // Gemini 3 預設思考程度高、回應慢（長文案常超過 25 秒），改用低思考程度加快速度；模型不支援時自動拿掉再試
  let thinkOff = false;
  const bodyFor = (m) => (!thinkOff && /^gemini-3/.test(m)
    ? { ...reqBody, generationConfig: { ...reqBody.generationConfig, thinkingConfig: { thinkingLevel: 'low' } } } : reqBody);
  const deadline = Date.now() + (Number(process.env.AI_TIMEOUT_MS) || 25000);
  let last = null;
  const list = models();
  for (let k = 0; k < list.length; k++) {
    const m = list[k];
    const left = deadline - Date.now();
    if (left < 1500) break;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), left);
    let r, j;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(bodyFor(m)), signal: ctl.signal,
      });
      j = await r.json().catch(() => ({}));
    } catch (e) {
      if (e.name === 'AbortError') return json(504, { ok: false, error: 'AI 回應逾時，請縮小輸入或稍後重試' });
      last = { status: 502, msg: '無法連線到 Gemini' };
      continue;
    } finally { clearTimeout(t); }

    if (r.status === 200) {
      const c = j.candidates?.[0];
      const text = (c?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
      if (!text) return json(502, { ok: false, error: `模型未回傳內容（${c?.finishReason || j.promptFeedback?.blockReason || 'unknown'}）` });
      let parsed = null;
      if (pr.json || pr.extract) {
        // 搜尋接地時無法強制 JSON 模式，所以從文字中擷取第一個 {...} 區塊
        const m = text.replace(/```(?:json)?/g, '').match(/\{[\s\S]*\}/);
        try { parsed = JSON.parse(m ? m[0] : text); } catch { /* 前端退回顯示原文 */ }
      }
      const seen = new Set();
      const sources = (c.groundingMetadata?.groundingChunks || []).map((g) => g.web)
        .filter((w) => w?.uri && !seen.has(w.uri) && seen.add(w.uri)).map((w) => ({ title: w.title || w.uri, uri: w.uri }));
      return json(200, { ok: true, task, model: m, text, json: parsed, sources });
    }

    const msg = j.error?.message || `HTTP ${r.status}`;
    if (r.status === 400 && !thinkOff && /thinking/i.test(msg)) { thinkOff = true; k--; continue; }   // 不支援 thinkingLevel：同一個模型拿掉後重試
    if (r.status === 429) {
      // 各模型額度分開計算，先換下一個模型；全部都被限制才回 429
      const zero = /limit:\s*0\b/.test(msg);
      last = { status: 429, retry: retrySecs(j), msg: zero
        ? `模型 ${m} 在你目前的方案下沒有可用額度（limit: 0），可能需要啟用付費方案，或用 GEMINI_MODEL 改用其他模型`
        : `Gemini 額度或頻率限制（${m}）：${msg.slice(0, 200)}` };
      continue;
    }
    if (r.status === 404 || (r.status === 400 && /not found|not supported|unknown model|is not available/i.test(msg))) {
      last = { status: 502, msg: `模型無法使用（已嘗試 ${m}）` };
      continue;
    }
    if (r.status === 403 || (r.status === 400 && /api key/i.test(msg))) return json(401, { ok: false, error: 'Gemini 金鑰無效或沒有權限' });
    if (r.status >= 500) { last = { status: 502, msg: `Gemini 錯誤：${msg}` }; continue; }
    return json(502, { ok: false, error: `Gemini 錯誤：${msg}` });
  }
  return json(last?.status || 504, { ok: false, error: last?.msg || 'AI 回應逾時，請稍後重試', ...(last?.retry ? { retryAfter: last.retry } : {}) });
};

export const config = { path: '/api/ai' };
