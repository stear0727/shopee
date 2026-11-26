// /api/trends：Threads 熱門話題（資料來源：福音協進會「Threads 熱門話題統計」tools.ccea.tw/threadscount）
// 使用者按下「載入熱門話題」時才讀取，同一個時間範圍 30 分鐘內共用快取，不重複抓取。
// 只回傳話題標題與熱度（不回傳摘要），並標記政治、災難、傷亡、犯罪、八卦等不適合拿來行銷的話題。
import { getStore } from '@netlify/blobs';

export const config = { path: '/api/trends' };

const SRC = 'https://tools.ccea.tw/threadscount/';
const WINDOWS = new Set(['24h', '7d', '30d']);
const TTL = 30 * 60 * 1000;
// 不適合結合商品的話題（關鍵字判斷，僅供提示；AI 端也會再把關）
const SENSITIVE = /選舉|選戰|選前|大選|市長|立委|議員|總統|政黨|政府|政治|投票|造勢|藍營|綠營|國民黨|民進黨|民眾黨|罷免|公投|死亡|致死|身亡|喪命|\d+死|傷亡|死傷|重傷|受傷|\d+傷|車禍|墜機|墜落|撞車|追撞|颱風|地震|火災|火警|水災|淹水|災情|災害|天災|判決|判刑|判賠|命案|刑案|血案|案件|起訴|羈押|逮捕|警方|警察|槍|殺|割頸|霸凌|性侵|猥褻|詐騙|毒品|爆料|私生活|外流|偷吃|婚外|小三|出軌|醜聞|指控|影射|間諜|戰爭|開戰|軍事|軍演|飛彈|共機|中共|疫情|病毒|自殺|罷工|抗議|股災|重挫|崩盤|大火|爆炸|氣爆|政論|遭指|境外|基金會|之夜|路權|交鋒|黨團|候選人|輔選|拜票|掃街|宣講|車隊|競選|封鎖/;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export default async (req) => {
  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get('x-access-code') !== code) return json(401, { ok: false, error: '存取碼錯誤或未填寫' });
  const u = new URL(req.url), w = WINDOWS.has(u.searchParams.get('w')) ? u.searchParams.get('w') : '24h';
  const st = getStore({ name: 'shoopee-trends', consistency: 'strong' });
  let cached = null;
  try { cached = await st.get(`live_${w}`, { type: 'json' }); } catch {}
  if (cached && Date.now() - cached.fetchedAt < TTL) return json(200, { ok: true, ...cached, cached: true });
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(`${SRC}data/live_${w}.json`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TomatopickTrends/1.0; personal use, cached 30 min)', Accept: 'application/json' }, signal: ctl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const topics = (Array.isArray(j.topics) ? j.topics : []).slice().sort((a, b) => (Number(b.weighted) || 0) - (Number(a.weighted) || 0)).slice(0, 40).map((t) => {
      const title = String(t.title || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return { title, heat: Number(t.weighted) || 0, appears: Number(t.appears) || 0, peak: Number(t.peak_posts) || 0, isNew: t.tr === 'new', sensitive: SENSITIVE.test(title) };
    }).filter((t) => t.title);
    const out = { window: w, generatedAt: String(j.generated_at || ''), fetchedAt: Date.now(), source: SRC, topics };
    try { await st.setJSON(`live_${w}`, out); } catch {}
    return json(200, { ok: true, ...out, cached: false });
  } catch (e) {
    if (cached) return json(200, { ok: true, ...cached, cached: true, stale: true });
    return json(502, { ok: false, error: '暫時讀不到熱門話題，請稍後再試，或直接手動輸入話題' });
  }
};
