// 蝦皮商品擷取器（只在你的電腦執行）
// 1. 開啟一個獨立的 Chrome 視窗，由你自己手動登入蝦皮分潤後台
// 2. 你瀏覽商品頁面時，記錄蝦皮本來就回傳給瀏覽器的商品資料（不點擊、不額外發請求）
// 3. 整理成 CSV，可直接匯入網站「商品」頁
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract, Store, toCSV, worth } from './lib.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, 'output');
fs.mkdirSync(OUT, { recursive: true });
const day = new Date().toLocaleDateString('sv-SE');
const CSV = path.join(OUT, `shopee-products-${day}.csv`);
const RAW = process.argv.includes('--raw') ? path.join(OUT, `raw-${day}.jsonl`) : null;
const PORT = 9333;
const START = process.env.START_URL || 'https://affiliate.shopee.tw/';
const CHROME = [process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && fs.existsSync(p));

if (!CHROME) { console.error('找不到 Chrome 或 Edge，請設定環境變數 CHROME_PATH'); process.exit(1); }

// 用一般方式啟動瀏覽器（非自動化模式），Google 登入才不會被擋；使用獨立的設定檔資料夾
spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(DIR, '.profile')}`, '--no-first-run', '--no-default-browser-check', START], { stdio: 'ignore', detached: true }).unref();

let browser;
for (let i = 0; i < 40 && !browser; i++) {
  try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch { await new Promise((r) => setTimeout(r, 500)); }
}
if (!browser) { console.error('無法連線到瀏覽器。請先關閉所有用 collector 開啟的瀏覽器視窗再試一次。'); process.exit(1); }

const store = new Store();
let dirty = false;
const flush = () => { if (dirty) { fs.writeFileSync(CSV, toCSV(store.list())); dirty = false; } };
setInterval(flush, 3000).unref();

async function onResponse(res) {
  try {
    const url = res.url();
    if (!/(^|\.)(shopee\.tw|shopee\.com|shopeemobile\.com)$/i.test(new URL(url).hostname)) return;
    if (!(res.headers()['content-type'] || '').includes('json')) return;
    const json = await res.json();
    if (RAW) fs.appendFileSync(RAW, JSON.stringify({ t: Date.now(), url: url.split('?')[0], json }) + '\n');
    let added = 0;
    for (const p of extract(json)) if (store.add(p)) added++;
    if (added) { dirty = true; console.log(`  +${added} 件商品（累計 ${store.map.size} 件）  ${new URL(url).pathname}`); }
  } catch { /* 非 JSON 或已關閉的頁面，略過 */ }
}
const attach = (page) => page.on('response', onResponse);
for (const ctx of browser.contexts()) { ctx.pages().forEach(attach); ctx.on('page', attach); }

console.log(`
已開啟瀏覽器：${START}
1. 請在瀏覽器中「自己」登入蝦皮（可用 Google 登入）。
2. 到分潤後台的商品推廣／商品列表，捲動、換頁、搜尋你有興趣的分類。
3. 這裡會即時顯示擷取到的商品數量；資料自動存到：
   ${CSV}
4. 完成後關閉瀏覽器視窗，或在這裡按 Ctrl+C。
${RAW ? `（原始資料模式：另存 ${RAW}，可能含帳號資訊，請勿分享給他人）\n` : ''}`);

function finish() {
  flush();
  const top = store.list().sort((a, b) => worth(b) - worth(a)).slice(0, 10);
  console.log(`\n共擷取 ${store.map.size} 件商品${store.map.size ? `，已存到 ${CSV}` : ''}`);
  if (top.length) {
    console.log('\n初步值得推薦（單筆佣金 × 銷量 × 評分）：');
    top.forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. ${p.name.slice(0, 40)}｜$${p.price || '?'}｜分潤 ${p.rate || '?'}%｜銷量 ${p.sales || '?'}`));
    console.log('\n下一步：到網站「設定 → 匯入候選清單 CSV」或「商品 → 匯入 CSV」匯入上面的檔案。');
  } else {
    console.log('沒有擷取到商品。請改用 `npm run raw` 再瀏覽一次，並告訴 Claude，以便調整擷取規則。');
  }
  process.exit(0);
}
browser.on('disconnected', finish);
process.on('SIGINT', finish);
