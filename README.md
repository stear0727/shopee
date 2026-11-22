# Tomatopick｜蝦皮分潤選品分析

依《蝦皮分潤選品分析網站｜系統規劃書》實作的第一版：原生 HTML/CSS/JS（無建置步驟、無外部套件）＋ 一支 Netlify Function。

## 結構

```
public/               靜態網站（Netlify 發布目錄）
  index.html          版面與表單
  styles.css          RWD、深色模式
  app.js              M1–M10 全部前端邏輯（評分、試算、清單、排行、AI 介面、CSV、自繪 SVG 圖表）
netlify/functions/
  ai.mjs              /api/ai：任務白名單、伺服器端組裝提示詞、呼叫 Gemini、模型回退
netlify.toml          發布設定、CSP 與安全標頭
```

## 部署

1. 把此資料夾推到 Git 倉庫，在 Netlify 匯入（build command 留空）。
2. 在 Netlify 後台 → Site configuration → Environment variables 設定：

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | 是 | Google AI Studio 金鑰 |
| `GEMINI_MODEL` | 否 | 預設模型；未設定時依序嘗試 `gemini-3-flash` → `gemini-3-flash-preview` → `gemini-flash-latest` |
| `GEMINI_FALLBACK_MODELS` | 否 | 逗號分隔的備用模型清單 |
| `ACCESS_CODE` | 建議 | 存取碼，使用者在設定頁填入後才能用伺服器金鑰 |
| `AI_TIMEOUT_MS` | 否 | 呼叫 Gemini 的總逾時（預設 25000），請配合 Netlify 方案的 Function 逾時上限 |

3. 在 Google 平台設定 API 用量上限與告警。

## 本機開發

```
npm i -g netlify-cli
netlify dev
```

直接用瀏覽器開 `public/index.html` 也能使用評分、試算、清單、排行，只有 AI 功能需要後端。

## 雲端同步

商品清單、發布狀態、文案與評分設定存在 Netlify Blobs（`/api/data`，免額外設定），電腦與手機打開網站就會自動同步。存取規則與 AI 相同：有設定 `ACCESS_CODE` 時每台裝置需在設定頁填一次存取碼；沒設定則開放使用（知道網址的人都能讀寫）。

## 匯入蝦皮商品

在蝦皮分潤後台用「批量取得商品連結」匯出 CSV（或另存成 Excel .xlsx），到網站「商品」頁選檔匯入即可。

## 內容日曆（M11）

`public/cal.js`。從「商品分析」的全部商品挑出每週要推的商品，再由 AI 排日期與時間；只建議、不發布，跟發布清單（手動加入、手動發布）是獨立功能。
- 由使用者選發文日與每天篇數；依等級 S→A→B 依序排入，同一類別每週不超過 40%
- 排除：低於入選等級、風險標記（價格上漲 10% 以上、分潤率下降、手動標記缺貨）、你刪除的建議；冷卻期（21 天）為優先避開，候選不足時仍會補上並標示「近期排過」
- 排程優先分 P = 0.6×總分 + 0.2×熱度 + 0.2×檔期適配（檔期由使用者在「檔期管理」輸入）
- 選好商品後呼叫一次 `/api/ai`（schedule 任務）排日期與時間，前端會檢查只用選定的發文日、每天不超過設定篇數；手動改過的不會被 AI 移動
- 卡片：確定排定／取消排定、管理時間、產生文案、標記已發布、刪除；每則排程存在商品的 `plans` 陣列，隨商品一起雲端同步

## 待確認（見規劃書第 14 章）

- Netlify 方案的 Function 逾時與請求大小上限（截圖已在前端壓到 1.5 MB 以內）
- 預設使用的 Gemini 模型名稱
