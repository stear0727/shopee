# Tomatopick｜蝦皮分潤選品分析

依《蝦皮分潤選品分析網站｜系統規劃書》實作的第一版：原生 HTML/CSS/JS（無建置步驟、無外部套件）＋ 一支 Netlify Function。

## 結構

```
public/               靜態網站（Netlify 發布目錄）
  index.html          版面與表單
  styles.css          RWD、深色模式
  app.js              M1–M10 全部前端邏輯（評分、試算、清單、排行、AI 介面、CSV、自繪 SVG 圖表）
  video.js            🎬 影片製作頁（獨立功能：實拍影片＋提示詞 → AI 分鏡 → Canvas 算圖與錄製）
netlify/functions/
  ai.mjs              /api/ai：任務白名單、伺服器端組裝提示詞、呼叫 Gemini、模型回退
  data.mjs            /api/data：雲端同步（Netlify Blobs）
netlify.toml          發布設定、CSP 與安全標頭
```

## 🎬 影片製作（#video）

獨立功能，不使用、也不修改商品清單。把自己拍的商品實拍影片剪成 9:16、14–19 秒的特色銷售短影音：

1. 新增「影片專案」，選擇實拍影片（只存在這台瀏覽器的 IndexedDB，不上傳、不傳給 AI）
2. 在「提示詞」輸入商品資訊與想要的感覺，AI（`/api/ai` 的 `video_plan` 任務，只送文字）設計風格、5–6 個分鏡、文案、購買引導與 5 個 Reels 推薦標註關鍵字；所有內容都可修改
3. 選用：在畫面上框出價格、日期、促銷吊牌、別家商品等，輸出時全程模糊
4. 關鍵畫面檢查：自動偵測文字重疊、超出範圍與疑似金額／日期／療效用語，確認後才能輸出
5. 瀏覽器用 Canvas 即時算圖並錄製（MediaRecorder），Chrome／Edge 輸出 1080×1920 MP4；30 種風格（氣象播報、迷因、電影預告、新聞快報、料理節目、像素遊戲、美式漫畫、時尚雜誌、拍立得、聊天訊息、舞台聚光等）的字幕、圖示與特效全部程式繪製，配樂與音效用 WebAudio 即時合成
6. 交付說明：風格原因、分鏡劇情、遮蔽項目、文案依據、Reels 關鍵字與需要確認的地方

注意事項：
- 影片分鏡使用專用的模型順序（預設 `gemini-2.5-flash` 起），每個模型最多等 12 秒、卡住就換下一個；Google 忙碌時前端會自動重試最多 4 次
- 輸出是即時錄製，影片多長就要錄多久，錄製中請停留在該分頁；每次開啟頁面第一次輸出 MP4 會先暖機約 4 秒
- 專案資料存在瀏覽器 localStorage（`sp_vproj`），不會雲端同步

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
| `GEMINI_VIDEO_MODEL` | 否 | 影片分鏡優先使用的模型（未設定時依序嘗試 `gemini-2.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.8-flash` → `gemini-flash-latest`） |

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

## 待確認（見規劃書第 14 章）

- Netlify 方案的 Function 逾時與請求大小上限（截圖已在前端壓到 1.5 MB 以內）
- 預設使用的 Gemini 模型名稱
