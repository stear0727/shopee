# 分潤選品分析網站

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

## 蝦皮商品擷取器（collector/，只在自己電腦執行）

從你登入後的蝦皮分潤後台擷取真實的商品、分潤比例、價格與銷量，輸出成可匯入「商品」頁的 CSV。

```
cd collector
npm install      # 第一次才需要
npm start
```

1. 會開啟一個獨立的 Chrome 視窗，請自己手動登入蝦皮（程式不碰帳號密碼）。
2. 到分潤後台的商品列表捲動、換頁、搜尋；終端機會即時顯示擷取數量。
3. 關閉瀏覽器後，CSV 會存在 `collector/output/`，到網站「商品 → 匯入 CSV」匯入。

程式只記錄瀏覽器本來就收到的資料，不會自動點擊或額外發送請求；但仍無法保證符合蝦皮使用條款，請自行評估。
擷取不到商品時，改用 `npm run raw` 收集原始資料以調整擷取規則（原始檔可能含帳號資訊，勿分享）。

## 待確認（見規劃書第 14 章）

- Netlify 方案的 Function 逾時與請求大小上限（截圖已在前端壓到 1.5 MB 以內）
- 預設使用的 Gemini 模型名稱
