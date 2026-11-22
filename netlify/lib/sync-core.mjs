// 雲端同步核心：整個網站共用一份資料（電腦與手機打開網站即可互通）。
// 存取規則與 AI 端點相同：Netlify 有設定 ACCESS_CODE 時需帶 x-access-code；沒設定則開放使用。

export const MAX_BYTES = 5 * 1024 * 1024;
const DATA_KEY = 'shared';
const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export function makeHandler(getStoreFn, env = process.env) {
  return async (req) => {
    const code = env.ACCESS_CODE;
    if (code && req.headers.get('x-access-code') !== code) return json(401, { ok: false, error: '需要存取碼：請到「設定」填入存取碼後再同步' });
    const store = getStoreFn({ name: 'shoopee-sync', consistency: 'strong' });

    if (req.method === 'GET') {
      // ?check=1：只回傳版本時間（讀中繼資料，不下載整份資料），供前端每幾秒輕量檢查
      if (new URL(req.url).searchParams.has('check')) {
        const meta = store.getMetadata ? await store.getMetadata(DATA_KEY) : null;
        if (meta?.metadata?.at) return json(200, { ok: true, at: Number(meta.metadata.at) });
        const old = await store.get(DATA_KEY, { type: 'json' });   // 舊資料沒有中繼資料時退回讀全文
        return json(200, { ok: true, at: old?.at ?? 0 });
      }
      const cur = await store.get(DATA_KEY, { type: 'json' });
      return json(200, { ok: true, data: cur?.data ?? null, at: cur?.at ?? 0 });
    }
    if (req.method === 'PUT') {
      const raw = await req.text();
      if (Buffer.byteLength(raw) > MAX_BYTES) return json(413, { ok: false, error: '資料過大（上限 5 MB），請刪除部分商品或文案後再同步' });
      let body;
      try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: '資料格式錯誤' }); }
      if (!body || typeof body.data !== 'object' || body.data === null || !Array.isArray(body.data.items)) return json(400, { ok: false, error: '資料格式錯誤' });
      // 樂觀鎖：雲端在上次讀取後被其他裝置更新過，就回傳 409，讓前端先合併再寫入
      const cur = await store.get(DATA_KEY, { type: 'json' });
      if (cur && Number.isFinite(body.base) && cur.at > body.base) return json(409, { ok: false, error: 'conflict', data: cur.data, at: cur.at });
      const at = Date.now();
      await store.setJSON(DATA_KEY, { data: body.data, at }, { metadata: { at } });
      return json(200, { ok: true, at });
    }
    return json(405, { ok: false, error: 'Method not allowed' });
  };
}
