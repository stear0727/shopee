// 從蝦皮網頁回傳的 JSON 中找出「看起來像商品」的物件，並整理成網站可匯入的 CSV。
// 欄位名稱是依蝦皮常見命名推測的；若擷取不到，用 `npm run raw` 收集原始資料再調整這裡。

const NAME = ['name', 'item_name', 'product_name', 'productName', 'itemName', 'title'];
const PRICE = ['price', 'price_min', 'min_price', 'priceMin', 'item_price', 'sale_price', 'product_price', 'price_max'];
const ID = ['itemid', 'item_id', 'itemId', 'product_id', 'productId'];
const SHOP = ['shopid', 'shop_id', 'shopId'];
const RATE = ['commission_rate', 'commissionRate', 'total_commission_rate', 'max_commission_rate', 'default_commission_rate',
  'seller_commission_rate', 'sellerCommissionRate', 'shopee_commission_rate', 'commission_rate_str', 'commissionRateStr'];
const SOLD = ['historical_sold', 'historicalSold', 'sold', 'monthly_sold', 'sales', 'sold_count', 'item_sold', 'sales_volume', 'sold_text'];
const RATING = ['rating_star', 'ratingStar', 'item_rating_star', 'rating'];
const DISC = ['raw_discount', 'discount', 'discount_percentage', 'show_discount'];
const CAT = ['category_name', 'categoryName', 'cat_name', 'category'];

const pick = (o, keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return undefined; };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const toNum = (v) => {
  if (v === undefined || v === null) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/,/g, '');
  const m = s.match(/(\d+(?:\.\d+)?)\s*(k|K|萬|w|W)?/);
  if (!m) return NaN;
  return Number(m[1]) * (m[2] === 'k' || m[2] === 'K' ? 1e3 : m[2] ? 1e4 : 1);
};
const normPrice = (v) => { let n = toNum(v); if (!(n > 0)) return ''; if (n >= 1e5) n /= 1e5; return Math.round(n); };
const normRate = (v) => {
  let n = toNum(v); if (!(n > 0)) return '';
  if (n <= 1) n *= 100; else if (n > 100) n /= 1000;
  return n > 0 && n <= 100 ? Math.round(n * 10) / 10 : '';
};
const normDisc = (v) => { let n = Math.abs(toNum(v)); if (!(n > 0)) return ''; if (n < 1) n *= 100; return n < 100 ? Math.round(n) : ''; };
const normRating = (v) => { const n = toNum(isObj(v) ? v.rating_star : v); return n > 0 && n <= 5 ? Math.round(n * 10) / 10 : ''; };

// 把一層子物件的欄位攤平合併（蝦皮常把商品資料包在 item_basic 之類的子物件裡）
function view(o) {
  const v = { ...o };
  for (const [k, c] of Object.entries(o)) if (isObj(c)) for (const [k2, x] of Object.entries(c)) if (v[k2] === undefined && (typeof x !== 'object' || k2 === 'item_rating')) v[k2] = x;
  if (isObj(o.item_rating) && v.rating_star === undefined) v.rating_star = o.item_rating.rating_star;
  return v;
}

export function extract(json) {
  const out = []; let budget = 50000;
  const walk = (node, depth) => {
    if (budget-- <= 0 || depth > 10 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const x of node) walk(x, depth + 1); return; }
    const v = view(node);
    const name = pick(v, NAME), price = pick(v, PRICE), id = pick(v, ID);
    if (typeof name === 'string' && name.trim().length >= 4 && (price !== undefined || id !== undefined) && pick(v, ['username', 'email', 'phone']) === undefined) {
      const shop = pick(v, SHOP);
      out.push({
        id: id !== undefined ? `sp_${shop ?? 0}_${id}` : '',
        name: name.trim().slice(0, 120),
        price: normPrice(price), rate: normRate(pick(v, RATE)), sales: Math.round(toNum(pick(v, SOLD))) || '',
        rating: normRating(pick(v, RATING) ?? v.item_rating), discount: normDisc(pick(v, DISC)),
        category: typeof pick(v, CAT) === 'string' ? pick(v, CAT).slice(0, 40) : '',
        url: id !== undefined && shop !== undefined ? `https://shopee.tw/product/${shop}/${id}` : '',
      });
      return; // 已視為商品，不再往下找，避免重複
    }
    for (const c of Object.values(node)) if (c && typeof c === 'object') walk(c, depth + 1);
  };
  walk(json, 0);
  return out;
}

const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) >>> 0; return h.toString(36); };

export class Store {
  constructor() { this.map = new Map(); }
  add(p) {
    const key = p.id || 'sp_n_' + hash(p.name.toLowerCase().replace(/\s+/g, ''));
    const old = this.map.get(key);
    if (!old) { this.map.set(key, { ...p, id: key }); return true; }
    for (const [k, v] of Object.entries(p)) if (v !== '' && v !== undefined && (old[k] === '' || old[k] === undefined || (k === 'rate' && v > old[k]))) old[k] = v;
    return false;
  }
  list() { return [...this.map.values()]; }
}

// 「值得推薦」初步排序：單筆佣金 × 銷量熱度 × 評分（只是排序用，正式分數由網站計算）
export const worth = (p) => (Number(p.price) || 0) * (Number(p.rate) || 0) / 100 * Math.log10((Number(p.sales) || 0) + 10) * ((Number(p.rating) || 4) / 5);

const COLS = ['id', 'name', 'category', 'price', 'base', 'xtra', 'platform', 'format', 'visual', 'pain', 'trust', 'topic', 'risk', 'fit', 'status', 'note', 'discount', 'rating', 'sales', 'trend', 'summary', 'url', 'src', 'createdAt'];
const cell = (v) => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v) && !Number.isFinite(Number(v))) v = "'" + v; return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };

export function toCSV(products) {
  const now = new Date().toISOString();
  const rows = products.sort((a, b) => worth(b) - worth(a)).map((p) => {
    const trust = Number(p.rating) >= 4.7 && Number(p.sales) >= 1000 ? 5 : Number(p.rating) >= 4.5 ? 4 : 3;
    return { ...p, base: p.rate, xtra: 0, platform: 'fb', format: '圖文貼文', visual: 3, pain: 3, trust, topic: 3, risk: 3, fit: 3, status: 'watch', note: '',
      trend: '', summary: `蝦皮後台擷取${p.rate !== '' ? `｜分潤 ${p.rate}%` : ''}${p.sales !== '' ? `｜銷量 ${p.sales}` : ''}`, src: 'shopee', createdAt: now };
  });
  return '﻿' + [COLS.join(','), ...rows.map((r) => COLS.map((c) => cell(r[c])).join(','))].join('\r\n');
}
