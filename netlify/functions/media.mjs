// /api/media：影片素材存放（商品照片、配音、背景音樂、AI 動態鏡頭與工作狀態），存在 Netlify Blobs。
// GET ?key=  取回檔案；PUT ?key=（原始二進位內容）寫入；DELETE ?key= 或 ?prefix= 刪除
import { getStore } from '@netlify/blobs';
import { dataGate, json, MEDIA_KEY } from '../lib/gate.mjs';

const MAX = 5.5 * 1024 * 1024;
const TYPES = /^(image\/(jpeg|png|webp)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/json)$/;

export default async (req) => {
  const g = dataGate(req.headers);
  if (g.error) return json(g.status, { ok: false, error: g.error });
  const store = getStore({ name: 'shoopee-media', consistency: 'strong' });
  const u = new URL(req.url), key = u.searchParams.get('key') || '', prefix = u.searchParams.get('prefix') || '';

  if (req.method === 'DELETE') {
    if (prefix) {
      if (!MEDIA_KEY.test(prefix) || prefix.length < 6) return json(400, { ok: false, error: 'prefix 不合法' });
      const { blobs } = await store.list({ prefix });
      await Promise.all(blobs.map((b) => store.delete(b.key)));
      return json(200, { ok: true, n: blobs.length });
    }
    if (!MEDIA_KEY.test(key)) return json(400, { ok: false, error: 'key 不合法' });
    await store.delete(key);
    return json(200, { ok: true });
  }
  if (!MEDIA_KEY.test(key)) return json(400, { ok: false, error: 'key 不合法' });

  if (req.method === 'GET') {
    const r = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!r) return json(404, { ok: false, error: '找不到檔案' });
    return new Response(r.data, { status: 200, headers: { 'Content-Type': r.metadata?.ct || 'application/octet-stream', 'Cache-Control': 'no-store' } });
  }
  if (req.method === 'PUT') {
    const ct = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!TYPES.test(ct)) return json(415, { ok: false, error: `不支援的檔案類型：${ct || '未知'}` });
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return json(400, { ok: false, error: '檔案是空的' });
    if (buf.byteLength > MAX) return json(413, { ok: false, error: '檔案過大（上限 5.5 MB）' });
    await store.set(key, buf, { metadata: { ct, at: Date.now() } });
    return json(200, { ok: true, key, size: buf.byteLength });
  }
  return json(405, { ok: false, error: 'Method not allowed' });
};

export const config = { path: '/api/media' };
