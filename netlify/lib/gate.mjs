// 新端點（影片製作）共用的存取檢查：規則與 /api/ai、/api/data 相同。
// - AI 類端點：自備金鑰（x-gemini-key）可略過存取碼；否則有設定 ACCESS_CODE 時需帶 x-access-code
// - 資料類端點：有設定 ACCESS_CODE 時一律需要存取碼

export const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export function aiGate(headers, env = process.env) {
  const userKey = (headers.get('x-gemini-key') || '').trim();
  const code = env.ACCESS_CODE;
  if (!userKey && code && headers.get('x-access-code') !== code) return { error: '存取碼錯誤或未填寫', status: 401 };
  const key = userKey || env.GEMINI_API_KEY;
  if (!key) return { error: '伺服器未設定 GEMINI_API_KEY，請在設定頁填入自備金鑰', status: 401 };
  return { key };
}

export function dataGate(headers, env = process.env) {
  const code = env.ACCESS_CODE;
  if (code && headers.get('x-access-code') !== code) return { error: '需要存取碼：請到「設定」填入存取碼', status: 401 };
  return {};
}

// Gemini 錯誤轉成給使用者看的中文訊息
export function geminiError(status, msg, what) {
  if (status === 429) {
    return /limit:\s*0\b/.test(msg)
      ? `${what}在你目前的 Gemini 方案下沒有可用額度（limit: 0），需要到 Google AI Studio 啟用付費方案`
      : `Gemini 額度或頻率限制：${String(msg).slice(0, 160)}`;
  }
  if (status === 403 || (status === 400 && /api key/i.test(msg))) return 'Gemini 金鑰無效或沒有權限';
  if (status === 404) return `${what}模型無法使用（${String(msg).slice(0, 120)}）`;
  return `Gemini 錯誤（HTTP ${status}）：${String(msg).slice(0, 200)}`;
}

export const MEDIA_KEY = /^[A-Za-z0-9_.-]{1,160}$/;
export const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
