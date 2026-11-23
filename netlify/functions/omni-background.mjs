// AI 動態鏡頭（Gemini Omni 1.1 Flash）— Netlify 背景函式（最長 15 分鐘，呼叫後立即回 202）。
// 請求內容：{ jobId, prompt, imageKeys:[已上傳到 /api/media 的照片 key] }
// 進度寫在 Blobs：omnijob_<jobId>（JSON：state = running | done | error），完成的影片存在 clip_<jobId>。
// 前端以 GET /api/media?key=omnijob_<jobId> 輪詢。
import { getStore } from '@netlify/blobs';
import { aiGate, geminiError, GEMINI, MEDIA_KEY } from '../lib/gate.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findVideo(d) {
  for (const k of ['output_video', 'outputVideo']) if (d?.[k]?.data || d?.[k]?.uri) return d[k];
  for (const st of d?.steps || []) {
    if (st?.type !== 'model_output') continue;
    for (const c of st.content || []) if (c?.type === 'video' && (c.data || c.uri)) return c;
  }
  return null;
}
const fileId = (uri) => { const p = String(uri).split('?')[0].replace(/:download$/, ''); const i = p.lastIndexOf('files/'); return i >= 0 ? p.slice(i + 6).split('/')[0] : p; };

export default async (req) => {
  const store = getStore({ name: 'shoopee-media', consistency: 'strong' });
  let body;
  try { body = await req.json(); } catch { return; }
  const jobId = String(body?.jobId || '');
  if (!MEDIA_KEY.test(jobId)) return;
  const put = (o) => store.setJSON(`omnijob_${jobId}`, { ...o, at: Date.now() }, { metadata: { ct: 'application/json', at: Date.now() } });

  const g = aiGate(req.headers);
  if (g.error) { await put({ state: 'error', error: g.error }); return; }
  const prompt = String(body?.prompt || '').slice(0, 3000).trim();
  const keys = (Array.isArray(body?.imageKeys) ? body.imageKeys : []).filter((k) => MEDIA_KEY.test(String(k))).slice(0, 3);
  if (!prompt) { await put({ state: 'error', error: '動態鏡頭提示詞是空的' }); return; }

  const started = Date.now();
  await put({ state: 'running', started });
  try {
    const parts = [];
    for (const k of keys) {
      const r = await store.getWithMetadata(k, { type: 'arrayBuffer' });
      if (r) parts.push({ type: 'image', data: Buffer.from(r.data).toString('base64'), mime_type: r.metadata?.ct || 'image/jpeg' });
    }
    const payload = {
      model: process.env.GEMINI_OMNI_MODEL || 'gemini-omni-1.1-flash',
      input: parts.length ? [...parts, { type: 'text', text: prompt }] : prompt,
      // 以 uri 交付影片時 API 要求 store=true（預設值），所以不能關閉
      response_format: { type: 'video', aspect_ratio: '9:16', resolution: '720p', delivery: 'uri' },
    };
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12 * 60e3);
    let r, d;
    try {
      r = await fetch(`${GEMINI}/interactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': g.key }, body: JSON.stringify(payload), signal: ctl.signal,
      });
      d = await r.json().catch(() => ({}));
    } finally { clearTimeout(t); }
    if (!r.ok) throw new Error(geminiError(r.status, d?.error?.message || '', '動態鏡頭（Gemini Omni）'));

    const v = findVideo(d);
    if (!v) throw new Error('Gemini 沒有回傳影片');
    let bytes;
    if (v.data) bytes = Buffer.from(v.data, 'base64');
    else {
      const id = fileId(v.uri), h = { 'x-goog-api-key': g.key };
      for (let n = 0; n < 60; n++) {   // 等檔案處理完成（最多約 5 分鐘）
        const st = await fetch(`${GEMINI}/files/${id}`, { headers: h }).then((x) => x.json()).catch(() => ({}));
        const s = String(st.state || '').toUpperCase();
        if (s === 'ACTIVE') break;
        if (s === 'FAILED') throw new Error('影片處理失敗');
        await sleep(5000);
      }
      const dl = await fetch(`${GEMINI}/files/${id}:download?alt=media`, { headers: h });
      if (!dl.ok) throw new Error(`影片下載失敗（HTTP ${dl.status}）`);
      bytes = Buffer.from(await dl.arrayBuffer());
    }
    await store.set(`clip_${jobId}`, bytes, { metadata: { ct: 'video/mp4', at: Date.now() } });
    await put({ state: 'done', started, videoKey: `clip_${jobId}` });
  } catch (e) {
    await put({ state: 'error', started, error: e.name === 'AbortError' ? '生成逾時（超過 12 分鐘）' : String(e.message || e).slice(0, 300) });
  }
};
