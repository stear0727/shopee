// /api/ai — 唯一的後端端點：任務白名單、伺服器端組裝提示詞、呼叫 Gemini。
// 金鑰只來自環境變數 GEMINI_API_KEY，或使用者以 x-gemini-key 標頭自備（不記錄、不寫日誌）。

const TASKS = new Set(['analyze', 'plan', 'trend', 'portfolio', 'rank_extract', 'rank_search']);
const MAX_PAYLOAD = 12 * 1024;          // 結構化欄位上限 12 KB
const MAX_IMAGE = 2_200_000;            // 壓縮後截圖 base64 上限（約 1.6 MB 原始）
const DEFAULT_MODELS = ['gemini-3-flash', 'gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
const PLAT = { reels: 'Instagram Reels', fb: 'Facebook Reels', shorts: 'YouTube Shorts', tiktok: 'TikTok', threads: 'Threads', shopee_video: '蝦皮短影音', other: '其他' };

const SYS = `你是電商聯盟行銷分析師，專精蝦皮分潤計畫與短影音帶貨（Instagram Reels、Facebook Reels、YouTube Shorts、TikTok、Threads）。
規則：
1. 一律使用繁體中文（台灣用語）。
2. 禁止捏造銷量、評價數、佣金率、價格等數字；資料不足時必須明確標示「假設」。
3. 開場鉤子必須在前 2–3 秒產生效果，並依平台調整長度與語氣。
4. 一律提醒：貼文需揭露含分潤連結或合作關係、避免誇大或不實功效、價格與活動標註時效、錄製實際使用畫面、不使用蝦皮商標造成官方誤認。
5. 精簡，不寫開場白與客套話。`;

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const s = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const plat = (v) => PLAT[v] || s(v, 30) || '未指定';
const models = () => [...new Set([process.env.GEMINI_MODEL, ...(process.env.GEMINI_FALLBACK_MODELS || '').split(','), ...DEFAULT_MODELS]
  .map((m) => (m || '').trim()).filter(Boolean))];

function scores(o) {
  const names = { visual: '視覺展示力', pain: '痛點與需求', trust: '信任度', topic: '話題季節性', risk: '低退貨風險', fit: '平台契合', price: '價格衝動度', rate: '佣金吸引力' };
  const out = {};
  for (const [k, label] of Object.entries(names)) if (n(o?.[k]) != null) out[label] = n(o[k]);
  return out;
}

function build(task, p, hasImage) {
  switch (task) {
    case 'analyze':
      return { json: true, text: `請分析以下候選商品是否值得拍成分潤短影音，並產出企劃。
商品資料（使用者輸入，未經查證）：
${JSON.stringify({ 名稱: s(p.name, 120), 分類: s(p.category, 40), 價格: n(p.price), 總佣金率百分比: n(p.rate), 平台: plat(p.platform), 形式: s(p.format, 20), 系統總分: n(p.total), 分級: s(p.grade, 2), 構面評分1到5: scores(p.scores) })}
只輸出 JSON，結構如下：
{"verdict":"一句話判斷","strengths":["優勢"],"risks":["風險"],"hooks":["3–5 個開場鉤子"],"script":[{"time":"0–3s","visual":"畫面","voice":"口播"}],"cta":"行動呼籲","hashtags":["#標籤"],"tests":["A/B 測試建議"],"compliance":["合規提醒"]}
script 5–8 段，總長符合 ${plat(p.platform)} 常見長度。` };
    case 'plan': {
      const days = [7, 14, 30].includes(n(p.days)) ? n(p.days) : 7;
      const prods = (Array.isArray(p.products) ? p.products : []).slice(0, 20).map((x) => s(typeof x === 'string' ? x : x?.name, 80)).filter(Boolean);
      return { text: `請規劃 ${days} 天的分潤短影音發片行事曆。
題材：${s(p.topic, 100) || '未指定'}
受眾：${s(p.audience, 150) || '未指定'}
平台：${plat(p.platform)}
每週發片數：${n(p.perWeek) ?? 3}
候選商品：${prods.length ? prods.join('、') : '未提供（請以商品類型代替）'}
輸出 Markdown：
1. 一張行事曆表格，欄位：日 | 平台 | 商品 | 角色（主打/引流/話題） | 主題 | 開場鉤子
2. 每週 KPI（觀看、CTR、訂單），標示為「假設目標」。
不要寫開場白。` };
    }
    case 'trend':
      return { search: true, text: `請用 Google 搜尋，找出台灣近期與「${s(p.topic, 100) || '生活好物'}」相關、適合在 ${plat(p.platform)} 拍分潤短影音的選題。
檔期或時間：${s(p.season, 60) || '近期'}（今天：${new Date().toISOString().slice(0, 10)}）
輸出 Markdown：5–8 個選題，每個包含「選題、為什麼是現在、建議商品類型、鉤子範例」；最後列出風險。
只根據搜尋結果，沒有來源支持的趨勢要標示「推測」。` };
    case 'portfolio': {
      const list = (Array.isArray(p.items) ? p.items : []).slice(0, 20).map((x) => ({
        名稱: s(x?.name, 80), 價格: n(x?.price), 總佣金率: n(x?.rate), 分數: n(x?.total), 分級: s(x?.grade, 2), 單筆期望佣金: n(x?.exp), 平台: plat(x?.platform),
      }));
      return { text: `以下是候選清單（分數與單筆期望佣金由系統公式計算）：
${JSON.stringify(list)}
請做組合審查，輸出 Markdown：
1. 組合配置：每項標為「引流款／利潤款／話題款」並說明理由
2. 本週發片順序表格：順序 | 商品 | 角色 | 理由
3. 組合風險（題材重複、價格帶集中等）與調整建議` };
    }
    case 'rank_search': {
      const where = PLAT[p.platform] ? PLAT[p.platform] : '社群短影音（Instagram Reels、Facebook Reels、YouTube Shorts、TikTok、Threads）與蝦皮';
      const topic = s(p.topic, 100);
      return { search: true, extract: true, low: true, text: `請用 Google 搜尋，找出台灣近 14 天內在 ${where} 上爆紅或熱銷的商品${topic ? `，題材限定「${topic}」` : ''}。今天：${new Date().toISOString().slice(0, 10)}。
可參考：蝦皮熱銷或熱搜相關報導、TikTok／Reels 熱門帶貨商品、開箱爆紅新聞、團購熱賣文章、比較評測。
依「被多少來源提到、熱度多高」排序，最多 20 筆。只列搜尋結果中確實出現的具體商品（要有品牌或明確品名），不要編造；price 只有來源明確寫出時才填數字，否則 null。
只輸出 JSON，不要任何其他文字：
{"items":[{"rank":1,"productName":"品牌＋品名","price":null,"reason":"為什麼熱門（25 字內）","sourceUrl":"來源網址或 null"}]}` };
    }
    case 'rank_extract':
      return { json: true, low: true, text: `從以下${hasImage ? '截圖' : '文字'}擷取商品排行。榜單來源：${plat(p.source)}。
只輸出 JSON：{"items":[{"rank":1,"productName":"商品名","price":null}]}
規則：rank 為整數，原文沒有名次就依出現順序編號；price 只有原文明確出現時才填數字，否則 null；不要猜測或補全商品名，看不清楚的字保留原樣；最多 50 筆。
${hasImage ? '' : `\n文字內容：\n${s(p.text, 8000)}`}` };
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
  const rest = { ...payload }; delete rest.image;
  if (Buffer.byteLength(JSON.stringify(rest)) > MAX_PAYLOAD) return json(400, { ok: false, error: '資料過大（上限 12 KB），請縮小輸入' });

  const pr = build(task, rest, !!image);
  const reqBody = {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: 'user', parts: [{ text: pr.text }, ...(image ? [{ inline_data: { mime_type: image.mime, data: image.data } }] : [])] }],
    generationConfig: { temperature: pr.low ? 0.1 : 0.7, maxOutputTokens: 8192, ...(pr.json ? { responseMimeType: 'application/json' } : {}) },
    ...(pr.search ? { tools: [{ google_search: {} }] } : {}),
  };

  const deadline = Date.now() + (Number(process.env.AI_TIMEOUT_MS) || 25000);
  let last = null;
  for (const m of models()) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), left);
    let r, j;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(reqBody), signal: ctl.signal,
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
