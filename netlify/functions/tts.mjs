// /api/tts：影片旁白配音（Gemini TTS，Interactions API）。一次一句，回傳 audio/wav。
import { aiGate, json, geminiError, GEMINI } from '../lib/gate.mjs';

const VOICES = new Set(['Kore', 'Aoede', 'Leda', 'Zephyr', 'Callirrhoe', 'Autonoe', 'Puck', 'Charon', 'Fenrir', 'Orus', 'Iapetus', 'Umbriel']);
const s = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);

// 原始 PCM（16-bit、單聲道）包成 WAV
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function findAudio(d) {
  if (d?.output_audio?.data) return d.output_audio;
  for (const st of d?.steps || []) {
    if (st?.type !== 'model_output') continue;
    for (const c of st.content || []) if (c?.type === 'audio' && c.data) return c;
  }
  return null;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const g = aiGate(req.headers);
  if (g.error) return json(g.status, { ok: false, error: g.error });

  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: '請求格式錯誤' }); }
  const text = s(body?.text, 300);
  if (!text) return json(400, { ok: false, error: '旁白文字是空的' });
  const voice = VOICES.has(body?.voice) ? body.voice : 'Kore';
  const style = s(body?.style, 200);

  const payload = {
    model: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts',
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', ...(style ? { style } : {}) }] }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
  };
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), Number(process.env.AI_TIMEOUT_MS) || 25000);
  let r, d;
  try {
    r = await fetch(`${GEMINI}/interactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': g.key }, body: JSON.stringify(payload), signal: ctl.signal,
    });
    d = await r.json().catch(() => ({}));
  } catch (e) {
    return json(e.name === 'AbortError' ? 504 : 502, { ok: false, error: e.name === 'AbortError' ? '配音逾時，請縮短這句旁白或重試' : '無法連線到 Gemini' });
  } finally { clearTimeout(t); }
  if (!r.ok) return json(r.status === 429 ? 429 : r.status === 403 ? 401 : 502, { ok: false, error: geminiError(r.status, d?.error?.message || '', '配音') });

  const a = findAudio(d);
  if (!a) return json(502, { ok: false, error: 'Gemini 沒有回傳音訊' });
  let buf = Buffer.from(a.data, 'base64');
  const mime = String(a.mime_type || a.mimeType || '');
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF') {
    const rate = Number((mime.match(/rate=(\d+)/) || [])[1]) || 24000;
    buf = wav(buf, rate);
  }
  return new Response(buf, { status: 200, headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/tts' };
