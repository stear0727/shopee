/* ========== M11 內容日曆 ==========
 * 只建議、不發布：依商品評分、熱度與檔期排出每週建議發文清單，發布一律由使用者手動完成。
 * 每則排程存在商品的 plans 陣列裡，跟著商品一起雲端同步。
 * 日曆與發布清單完全獨立：日曆從「商品分析」的全部商品挑選並由 AI 排日期時間，不看發布清單；發布清單是手動加入、手動發布的功能。
 * 在日曆上確定排定、產生文案、標記已發布。
 * plan = { id, d: 排定日期, t: 發文時間 HH:MM, tw: 時間來源, st: sug|set|done, p: 排程優先分, g: 入選等級, r: 入選原因, fill: 補位, m: 手動改過, man: 手動新增, at: 發布時間 }
 */
const CAL_DEF = { minG: 'A', fill: 'auto', perDay: 3, cool: 21, catCap: 40, pre: 7, days: [1, 3, 5], w: { s: 0.6, h: 0.2, c: 0.2 } };
// 由使用者選發文日與每天篇數；每週則數＝發文日數 × 每天篇數（舊設定的每週則數換算成每天篇數）
const CS = () => {
  const o = { ...CAL_DEF, ...(S.cal || {}), w: { ...CAL_DEF.w, ...((S.cal || {}).w || {}) } };
  o.days = [0, 1, 2, 3, 4, 5, 6];   // 發文日＝尋找商品時選的日期範圍內每一天
  for (const k of ['cool', 'catCap', 'pre', 'w']) o[k] = CAL_DEF[k];   // 這些固定用預設值，不提供設定
  if (!(S.cal && S.cal.perDay) && S.cal && S.cal.perWeek) o.perDay = Math.ceil(S.cal.perWeek / o.days.length);
  o.perDay = clamp(Math.round(num(o.perDay)) || 3, 1, 10);
  o.perWeek = o.perDay * o.days.length;
  return o;
};
const GR = { S: 0, A: 1, B: 2, C: 3 }, GL = ['S', 'A', 'B', 'C'];
const PST = { sug: '建議', set: '已排定', done: '已發布' };
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const pd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addD = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffD = (a, b) => Math.round((pd(a) - pd(b)) / 864e5);
const wkStart = (s) => addD(s, -((pd(s).getDay() + 6) % 7));   // 週一為一週的開始
const fmtMD = (s) => { const d = pd(s); return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`; };
const isOpen = (p) => p.st === 'sug' || p.st === 'set';
const overdue = (p) => p.st === 'set' && p.d < today();   // 已排定但日期已過、還沒標記已發布
const plansOf = (i) => (Array.isArray(i.plans) ? i.plans : (i.plans = []));
const allPlans = () => items.flatMap((i) => (Array.isArray(i.plans) ? i.plans.map((p) => ({ p, i })) : []));
const findPlan = (pid) => allPlans().find(({ p }) => p.id === pid);
// 畫面上只顯示已由 AI 排好日期的排程；pend＝系統已選好商品、等待 AI 排日期時間
const shownPlans = () => allPlans().filter(({ p }) => !p.pend);
const risks = (i) => [...(Array.isArray(i.risk) ? i.risk : []), ...(i.oos ? ['缺貨'] : [])];
const byGrade = (a, b) => (GR[a.p.g] ?? 9) - (GR[b.p.g] ?? 9) || num(b.p.p) - num(a.p.p);   // 卡片依等級（S→A→B）再依優先分排序

let calWeek = '', calTab = 'month', calFilter = 'all', calReady = false, calSel = '', calMonth = '';
const calPicked = new Set();
// 預設顯示本週；本週的發文日都已過去時（例如週日），改顯示下週
const curWeek = () => { const w = wkStart(today()); return weekSlots(w, CS()).length ? w : addD(w, 7); };

// 熱度分：目前沒有外部排行榜，用月銷在全部商品中的排名（0–100）＋與上次匯入相比的銷量趨勢（±15）
function heatMap() {
  const arr = items.filter((i) => i.status !== 'drop').map((i) => num(i.sales)).sort((a, b) => a - b), n = arr.length, m = {};
  for (const i of items) {
    const below = arr.filter((v) => v < num(i.sales)).length;
    let h = n > 1 ? (below / (n - 1)) * 100 : 50;
    if (i.trend === '上升') h += 15; else if (i.trend === '下降') h -= 15;
    m[i.id] = clamp(Math.round(h), 0, 100);
  }
  return m;
}
// 檔期適配：商品類別符合檔期主推類別（沒指定類別＝全部類別），且日期落在「檔期開始前 N 天至檔期結束」
const evOf = (i, d, c) => (Array.isArray(S.events) ? S.events : []).find((e) => e.start && e.end && (!e.cats || !e.cats.length || e.cats.includes(i.category || '未分類')) && d >= addD(e.start, -c.pre) && d <= e.end);
function weekSlots(ws, c, rng = null) {
  const all = [...Array(7)].map((_, k) => addD(ws, k));
  let s = all.filter((d) => c.days.includes(pd(d).getDay()));
  if (!s.length) s = all;
  if (rng) s = s.filter((d) => d >= rng[0] && d <= rng[1]);
  return s.filter((d) => d >= today());   // 只排你選的發文日，且不排到已經過去的日子
}
// 候選商品＋排程優先分 P = (wS×總分 + wH×熱度 + wC×檔期) ÷ 權重合計
// 冷卻期：近 N 天內排過、發過，或已經排在之後的週
const isBusy = (i, ws, c) => { const coolFrom = addD(ws, -c.cool); return (Array.isArray(i.plans) ? i.plans : []).some((p) => PST[p.st] && p.d > coolFrom); };   // 只看日曆自己的排程，不看發布清單
const skipped = (i, ws) => !!(i.calSkip && i.calSkip >= ws);   // 在日曆刪除的建議，那一週不再排入
// 這週的目標則數：剩下的發文日 × 每天篇數
// 每個發文日還能排幾篇（每天上限－已排的）
const capLeft = (slots, c) => { const cnt = {}; allPlans().forEach(({ p }) => { cnt[p.d] = (cnt[p.d] || 0) + 1; }); return slots.reduce((n, d) => n + Math.max(0, c.perDay - (cnt[d] || 0)), 0); };
const inWeekOf = (i, ws) => { const we = addD(ws, 6); return (Array.isArray(i.plans) ? i.plans : []).some((p) => PST[p.st] && p.d >= ws && p.d <= we); };
function scoreCands(ws, slots, grades, c, H, except = new Set(), cool = false) {
  const W = c.w, wsum = (W.s + W.h + W.c) || 1;
  const busy = (i) => (cool ? inWeekOf(i, ws) : isBusy(i, ws, c)) || skipped(i, ws);
  return items.filter((i) => !except.has(i.id) && i.status !== 'drop' && grades.includes(i.grade) && !risks(i).length && !busy(i))
    .map((i) => {
      let ev = null, evD = '';
      for (const d of slots) { const e = evOf(i, d, c); if (e) { ev = e; evD = d; break; } }   // 檔期商品排在最早可預熱的發文日
      const P = Math.round(((W.s * num(i.total) + W.h * (H[i.id] ?? 0) + W.c * (ev ? 100 : 0)) / wsum) * 10) / 10;
      return { i, P, ev, evD };
    }).sort((a, b) => GR[a.i.grade] - GR[b.i.grade] || b.P - a.P || num(b.i.total) - num(a.i.total));   // 依等級順序（S→A→B），同等級再比排程優先分
}
function reasonOf(s, fill, H, cool = false) {
  const i = s.i, a = [`總分 ${fmt(num(i.total), 1)}（${i.grade} 級）`];
  if (num(i.sales)) a.push(`月銷 ${kfmt(num(i.sales))}${(H[i.id] ?? 0) >= 80 ? '（排名前 20%）' : ''}`);
  if (i.trend === '上升') a.push('銷量比上次匯入上升');
  if (s.ev) a.push(`符合檔期「${s.ev.name}」`);
  a.push(`預估社群分潤 $${fmt(commOf(i), 1)}`);
  if (fill) a.push(`${fill} 級補位`);
  if (cool) a.push(`近 ${CS().cool} 天內排過，候選不足時補上`);
  return a.join('、');
}
// 產生一週建議：fill＝補入指定等級（補位）
function genWeek(ws, fill = '', cool = false, rng = null) {
  const c = CS(), we = addD(ws, 6), slots = weekSlots(ws, c, rng);
  if (!slots.length) return { added: 0, short: 0 };
  const lo = [ws, today(), rng ? rng[0] : ws].sort().pop(), hi = [we, rng ? rng[1] : we].sort()[0];
  if (!fill && !cool) for (const i of items) if (Array.isArray(i.plans)) i.plans = i.plans.filter((p) => !(p.st === 'sug' && p.d >= lo && p.d <= hi));   // 重新尋找：換掉範圍內還沒確定的建議
  const inWeek = allPlans().filter(({ p }) => p.d >= ws && p.d <= we && p.st !== 'skip');
  const need = capLeft(slots, c);
  if (need <= 0) return { added: 0, short: 0 };
  const H = heatMap(), grades = fill ? [fill] : cool ? GL.slice(0, (c.fill === 'auto' ? GR.B : GR[c.minG]) + 1) : GL.slice(0, GR[c.minG] + 1);
  const sc = scoreCands(ws, slots, grades, c, H, new Set(), cool);
  // 同一類別一週不超過上限；候選不夠時才放寬
  const cap = Math.max(1, Math.floor(c.perWeek * c.catCap / 100)), catN = {}, pick = [];
  inWeek.forEach(({ i }) => { const k = i.category || '未分類'; catN[k] = (catN[k] || 0) + 1; });
  for (const s of sc) { if (pick.length >= need) break; const k = s.i.category || '未分類'; if ((catN[k] || 0) >= cap) continue; catN[k] = (catN[k] || 0) + 1; pick.push(s); }
  for (const s of sc) { if (pick.length >= need) break; if (!pick.includes(s)) pick.push(s); }
  // 分配到發文日：檔期商品排在預熱日，其他平均分到排得最少的發文日
  const perDay = Object.fromEntries(slots.map((d) => [d, 0]));
  inWeek.forEach(({ p }) => { if (p.d in perDay) perDay[p.d]++; });
  for (const s of pick) {
    const d = s.evD && (perDay[s.evD] || 0) < c.perDay ? s.evD : slots.reduce((a, b) => (perDay[b] < perDay[a] ? b : a));
    perDay[d] = (perDay[d] || 0) + 1;
    plansOf(s.i).push({ id: uid(), d, st: 'sug', pend: 1, p: s.P, g: s.i.grade, r: reasonOf(s, fill, H, cool), fill: !!fill, ...(cool ? { cd: 1 } : {}) });
  }
  return { added: pick.length, short: Math.max(0, need - pick.length) };
}
function planWeek(ws, rng = null) {
  const c = CS(); let r = genWeek(ws, '', false, rng), added = r.added;
  if (r.short && c.fill === 'auto') for (let g = GR[c.minG] + 1; g <= GR.B && r.short; g++) { r = genWeek(ws, GL[g], false, rng); added += r.added; }
  // 還是不夠：用冷卻期內的商品補滿（同一週不重複），卡片標示「近期排過」
  if (r.short) { r = genWeek(ws, '', true, rng); added += r.added; }
  return { added, short: r.short };
}
// 下一個可補位的等級（C 級永遠不入選）
function nextFill(ws, we, c) {
  const used = allPlans().filter(({ p }) => p.fill && p.d >= ws && p.d <= we).map(({ p }) => GR[p.g]);
  const g = Math.max(GR[c.minG], ...used) + 1;
  return g <= GR.B ? GL[g] : '';
}
const prioOf = (i, d, H = heatMap()) => { const c = CS(), ev = evOf(i, d, c), W = c.w, ws = (W.s + W.h + W.c) || 1; return { P: Math.round(((W.s * num(i.total) + W.h * (H[i.id] ?? 0) + W.c * (ev ? 100 : 0)) / ws) * 10) / 10, ev }; };
// 整理日曆上的排程（舊資料轉換＋自動帶入時間），回傳是否有變動
const AUTO_R = /^(從發布清單加入|已發布)$/;   // 舊版跟發布清單連動時自動建立、現已不需要的排程
function calReconcile() {
  let ch = false;
  for (const i of items) {
    if (!Array.isArray(i.plans) || !i.plans.length) continue;
    for (const p of i.plans) {                        // 舊版狀態轉換
      if (p.st === 'make') { p.st = 'set'; ch = true; } else if (p.st === 'perf') { p.st = 'done'; ch = true; }
    }
    const n0 = i.plans.length; i.plans = i.plans.filter((p) => PST[p.st] && !(p.man && AUTO_R.test(p.r || ''))); if (i.plans.length !== n0) ch = true;
  }
  return ch;
}
// AI 排程：系統選好這週要推的商品後，由 AI 依商品類別的目標族群，從你選的發文日挑日期與時間（一週一次呼叫）。
// 只排「建議」卡片，且不動你手動改過日期或時間的；AI 無法使用時保留系統排的日期。
const calAIBusy = new Set();
const rangeSlots = (from, to, c) => { const out = []; for (let d = from; d <= to; d = addD(d, 1)) if (c.days.includes(pd(d).getDay()) && d >= today()) out.push(d); return out; };
// 每次送 5 件給 AI（一次送太多會超過伺服器約 10 秒的處理上限）；排好一批就先顯示一批
const AI_BATCH = 5;
let calAIErr = '', calAIProg = '';
async function calAIPlan(from, to, btn = null, auto = false) {
  const key = `${from}~${to}`; if (calAIBusy.has(key)) return;
  const c = CS(), slots = rangeSlots(from, to, c);
  const list = allPlans().filter(({ p }) => p.st === 'sug' && p.d >= from && p.d <= to && p.d >= today() && !p.md && p.tw !== '手動');
  if (!slots.length || !list.length) { if (!auto) toast('這段日期沒有需要 AI 排程的建議（手動改過的會保留）'); return; }
  const ids = new Set(list.map(({ p }) => p.id)), cnt = {};
  allPlans().forEach(({ p }) => { if (p.d >= from && p.d <= to && !ids.has(p.id)) cnt[p.d] = (cnt[p.d] || 0) + 1; });
  calAIBusy.add(key); calAIErr = '';
  const label = btn ? btn.textContent : '', redraw = () => { if (location.hash === '#cal' && !$('#dlg').open) renderCal(); };
  if (btn) btn.disabled = true;
  let n = 0;
  try {
    for (let k = 0; k < list.length; k += AI_BATCH) {
      const part = list.slice(k, k + AI_BATCH);
      calAIProg = `${Math.min(k + AI_BATCH, list.length)}／${list.length}`; if (btn) btn.textContent = `AI 排程中 ${calAIProg}`;
      redraw();
      const items_ = part.map(({ p, i }) => { const e = slots.map((d) => evOf(i, d, c)).find(Boolean); return { id: p.id, name: i.name, category: i.category, price: num(i.price), event: e ? e.name : '', evFrom: e ? addD(e.start, -c.pre) : '' }; });
      const j = await ai('schedule', { items: items_, perDay: c.perDay, dates: slots.map((d) => ({ date: d, weekday: WD[pd(d).getDay()], used: cnt[d] || 0 })) });
      for (const r of (j.json && Array.isArray(j.json.plans) ? j.json.plans : [])) {
        const f0 = part.find(({ p }) => p.id === r.id), m = /^(\d{1,2}):(\d{2})$/.exec(String(r.time || '').trim());
        if (!f0) continue;
        // 日期必須在你選的範圍內，且那天還沒排滿；不符合就排到最少的那天
        const d = slots.includes(String(r.date)) && (cnt[r.date] || 0) < c.perDay ? String(r.date) : slots.reduce((a, b) => ((cnt[b] || 0) < (cnt[a] || 0) ? b : a));
        cnt[d] = (cnt[d] || 0) + 1;
        Object.assign(f0.p, { d, ai: 1, tw: `AI：${String(r.why || '').slice(0, 30)}` }); delete f0.p.pend;
        if (m && Number(m[1]) < 24 && Number(m[2]) < 60) f0.p.t = `${pad2(Number(m[1]))}:${m[2]}`;
        n++;
      }
      save.i();
    }
    toast(n ? `AI 已排好 ${n} 則的日期與時間` : 'AI 沒有回傳可用的排程，請稍後按「AI 重新排程」');
  } catch (e) {
    calAIErr = e.status === 429 ? 'Gemini 額度用完或請求太頻繁，請稍後再試' : e.status === 502 || e.status === 504 ? 'AI 回應太慢（逾時），請再按一次「AI 重新排程」' : e.message || 'AI 排程失敗';
    save.i();
    toast(`${n ? `已排好 ${n} 則；` : ''}其餘失敗：${calAIErr}`);
  } finally {
    calAIBusy.delete(key); calAIProg = '';
    if (btn) { btn.disabled = false; btn.textContent = label; }
    redraw();
  }
}

/* ---------- 畫面 ---------- */
function initSel() {
  calWeek = curWeek();
  const ws = weekSlots(calWeek, CS());
  calSel = calWeek === wkStart(today()) ? today() : ws[0] || calWeek;
  calMonth = calSel.slice(0, 7);
}
function renderCal() {
  if (!calSel) initSel();
  calWeek = wkStart(calSel);
  if (calReconcile()) save.i();
  const c = CS(), ws = calWeek, we = addD(ws, 6);
  $$('#calTabs [data-t]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === calTab)));
  const wk = calTab === 'month' || calTab === 'list';
  $('#calWeekBar').hidden = !wk; $('#calAlerts').hidden = !wk;
  const [y, m] = calMonth.split('-').map(Number);
  $('#calRange').textContent = calTab === 'month' ? `${y} 年 ${m} 月` : `${fmtMD(ws)} – ${fmtMD(we)}`;
  if (wk) $('#calAlerts').innerHTML = alertsHtml(ws, we, c);
  $('#calBody').innerHTML = calTab === 'month' ? monthHtml() : calTab === 'list' ? listHtml(ws, we) : calTab === 'events' ? eventsHtml() : setHtml(c);
  if (calTab === 'list') updCalBatch();
}
const weekName = (ws) => (ws === wkStart(today()) ? '本週' : ws === addD(wkStart(today()), 7) ? '下週' : `${fmtMD(ws)} 那週`);
const jumpBtn = ({ p, i }) => `<button type="button" class="link" data-act="calJump" data-pid="${esc(p.id)}">${esc(fmtMD(p.d))} ${esc(i.name.slice(0, 18))}</button>`;
// 為什麼建議不夠：逐件說明被排除的原因
function shortWhy(ws, c) {
  const we = addD(ws, 6), gs = GL.slice(0, (c.fill === 'auto' ? GR.B : GR[c.minG]) + 1);
  const inWeek = new Set(allPlans().filter(({ p }) => p.d >= ws && p.d <= we).map(({ i }) => i.id));
  const n = { low: 0, cool: 0, rk: 0, skip: 0, list: 0 };
  for (const i of items) {
    if (i.status === 'drop' || inWeek.has(i.id)) continue;
    if (!gs.includes(i.grade)) n.low++; else if (skipped(i, ws)) n.skip++; else if (risks(i).length) n.rk++; 
  }
  const t = [[n.low, `等級低於 ${gs[gs.length - 1]} 級 ${n.low} 件`], [n.rk, `有風險標記 ${n.rk} 件`], [n.skip, `你刪除的建議 ${n.skip} 件`]].filter(([k]) => k).map(([, v]) => v);
  return t.length ? t.join('、') : '符合條件的商品都已經排進這週了';
}
function alertsHtml(ws, we, c) {
  const waiting = allPlans().filter(({ p }) => p.pend && p.d >= today()).length;   // 所有等待 AI 排程的（不限這週）
  const all = shownPlans(), wk = all.filter(({ p }) => p.d >= ws && p.d <= we);
  const pend = wk.filter(({ p }) => p.st === 'set'), sugs = wk.filter(({ p }) => p.st === 'sug' && p.d >= today()), od = all.filter(({ p }) => overdue(p));
  const rk = all.filter(({ p, i }) => isOpen(p) && risks(i).length);
  const cnt = wk.length, li = [], wn = weekName(ws);
  const list = (a) => a.slice(0, 6).map(jumpBtn).join('、') + (a.length > 6 ? ` 等 ${a.length} 則` : '');
  if (calAIBusy.size) li.push(`<li>🤖 已找到商品，AI 正在排定日期與時間（${calAIProg}）…排好的會先出現在日曆。</li>`);
  else if (waiting) li.push(`<li class="warn">有 <b>${waiting}</b> 件商品等待 AI 排定日期與時間${calAIErr ? `（原因：${esc(calAIErr)}）` : ''}。<button type="button" data-act="calAITime">AI 重新排程</button></li>`);
  if (od.length) li.push(`<li class="bad">逾期 <b>${od.length}</b> 則（日期已過但還沒標記已發布）：${list(od)}</li>`);
  if (rk.length) li.push(`<li class="warn">風險標記 <b>${rk.length}</b> 則：${list(rk)}</li>`);
  if (!items.length) li.push('<li class="warn">還沒有商品，請先到「商品分析」匯入蝦皮商品檔。</li>');
  else if (!weekSlots(ws, c).length && we >= wkStart(today())) li.push(`<li class="muted">${wn}的發文日都已經過了，請點下週的日期查看建議。</li>`);
  else if (!wk.length && !waiting && !calAIBusy.size && weekSlots(ws, c).length) li.push(`<li>${wn}還沒有排程。按上方「🔍 尋找商品」選擇日期，系統會從商品分析挑出要推的商品，再由 AI 排好日期與時間放進日曆。</li>`);
  else if (wk.length && !waiting && !calAIBusy.size && capLeft(weekSlots(ws, c), c) > 0) {
    const g = c.fill === 'auto' ? '' : nextFill(ws, we, c);
    li.push(`<li class="warn">${wn}還有 ${capLeft(weekSlots(ws, c), c)} 個空位沒排到商品。原因：${esc(shortWhy(ws, c))}。${g ? `<button type="button" data-act="calFill" data-g="${g}">補入 ${g} 級商品</button>` : ''}</li>`);
  }
  return `<div class="cal-sum"><span>${wn}：</span><span class="pill st-set">已排定 ${pend.length}</span><span class="pill st-sug">建議 ${sugs.length}</span><span class="pill st-done">已發布 ${wk.filter(({ p }) => p.st === 'done').length}</span>${od.length ? `<span class="pill od">逾期 ${od.length}</span>` : ''}</div>${li.length ? `<ul class="cal-alerts">${li.join('')}</ul>` : ''}`;
}
function planBtns(p, i, pid) {
  if (p.st === 'sug') return `<button type="button" class="pri" data-act="calSet" data-pid="${pid}">確定排定</button>`;
  const copyB = i.aiText ? `<button type="button" data-act="viewCopy" data-id="${esc(i.id)}">查看文案</button>` : `<button type="button" data-act="itemAI" data-id="${esc(i.id)}">產生文案</button>`;
  if (p.st === 'set') return `<button type="button" class="pri" data-act="calDone" data-pid="${pid}">標記已發布</button>${copyB}<button type="button" data-act="calUnset" data-pid="${pid}">取消排定</button>`;
  return `${copyB}<button type="button" data-act="calUndone" data-pid="${pid}">取消已發布</button>`;
}
const delBtn = (pid) => `<button type="button" class="ghost del" data-act="calDel" data-pid="${pid}" aria-label="刪除">刪除</button>`;
function calCard({ p, i }, pick = false) {
  const od = overdue(p), rk = risks(i), c = CS(), pid = esc(p.id), open = isOpen(p);
  return `<article class="ccard st-${esc(p.st)}${od ? ' od' : ''}"${open ? ' draggable="true"' : ''} data-pid="${pid}" id="cp-${pid}">
    <div class="cc-top">${pick ? `<label class="pick"><input type="checkbox" data-cpick="${pid}"${calPicked.has(p.id) ? ' checked' : ''} aria-label="選取 ${esc(i.name)}"></label>` : ''}<span class="grade g${esc(p.g)}">${esc(p.g)}</span><span class="cc-st">${od ? '逾期' : PST[p.st] || ''}</span>${p.fill ? `<span class="tag">${esc(p.g)} 級補位</span>` : ''}${p.cd ? '<span class="tag">近期排過</span>' : ''}<span class="grow"></span><span class="cc-p" title="排程優先分（滿分 100）">${fmt(num(p.p), 1)}</span></div>
    <h4>${esc(i.name)}</h4>
    <p class="cc-d">${pick ? `📅 ${esc(fmtMD(p.d))} ` : ''}${p.st === 'done' ? `✓ 發布於 ${esc(fmtDT(p.at))}` : p.t ? `⏰ ${esc(p.t)} <span class="cc-tw">${esc(p.tw || '')}</span>` : '<span class="muted">⏰ 未排時間</span>'}</p>
    <p class="cc-r">${esc(p.r || '')}</p>
    ${open && rk.length ? `<p class="cc-warn">⚠ ${esc(rk.join('、'))}</p>` : ''}
    <div class="cc-acts">${planBtns(p, i, pid)}${open ? `<button type="button" class="ghost" data-act="calTime" data-pid="${pid}">管理時間</button>` : ''}${delBtn(pid)}</div>
  </article>`;
}
// 同一天依時間排序（沒有時間的放後面），再依等級
const byTime = (a, b) => String(a.p.st === 'done' ? fmtDT(a.p.at).slice(11) : a.p.t || '99').localeCompare(String(b.p.st === 'done' ? fmtDT(b.p.at).slice(11) : b.p.t || '99')) || byGrade(a, b);
// 月曆（像手機的日曆）：上方整個月、每天用小圓點表示排程，點一天在下方看當天清單
function monthHtml() {
  const c = CS(), td = today(), m0 = `${calMonth}-01`, d0 = pd(m0), start = wkStart(m0);
  const mEnd = ymd(new Date(d0.getFullYear(), d0.getMonth() + 1, 0)), rows = Math.ceil((diffD(mEnd, start) + 1) / 7), by = {};
  shownPlans().forEach((x) => { (by[x.p.d] = by[x.p.d] || []).push(x); });
  const cell = (d) => {
    const list = (by[d] || []).sort(byTime), cls = `${d.slice(0, 7) !== calMonth ? ' oth' : ''}${d === td ? ' td' : ''}${d === calSel ? ' sel' : ''}${c.days.includes(pd(d).getDay()) ? '' : ' off'}`;
    return `<button type="button" class="mc${cls}" data-act="calPick" data-d="${d}" data-day="${d}" aria-label="${esc(fmtMD(d))}，${list.length} 則" aria-pressed="${d === calSel}">
      <span class="mn">${pd(d).getDate()}</span>
      <span class="mdots">${list.slice(0, 4).map(({ p }) => `<i class="dot st-${esc(p.st)}${overdue(p) ? ' od' : ''}"></i>`).join('')}${list.length > 4 ? '<b>+</b>' : ''}</span>
      <span class="mt">${list.slice(0, 3).map(({ p, i }) => `<span class="mi st-${esc(p.st)}${overdue(p) ? ' od' : ''}">${p.t && p.st !== 'done' ? `${esc(p.t)} ` : ''}${esc(i.name.slice(0, 14))}</span>`).join('')}${list.length > 3 ? `<span class="more">還有 ${list.length - 3} 則</span>` : ''}</span></button>`;
  };
  return `<div class="month">
    <div class="mh">${['一', '二', '三', '四', '五', '六', '日'].map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="mg">${[...Array(rows * 7)].map((_, k) => cell(addD(start, k))).join('')}</div>
    <p class="legend"><span><i class="dot st-sug"></i>建議</span><span><i class="dot st-set"></i>已排定</span><span><i class="dot st-done"></i>已發布</span><span><i class="dot od"></i>逾期</span></p>
  </div>${agendaHtml(calSel)}`;
}
function agendaHtml(d) {
  const list = shownPlans().filter(({ p }) => p.d === d).sort(byTime), dd = pd(d);
  return `<section class="agenda" aria-label="當天排程">
    <div class="ag-head"><h2>${dd.getMonth() + 1} 月 ${dd.getDate()} 日（${WD[dd.getDay()]}）${d === today() ? ' <span class="tag">今天</span>' : ''}</h2><button type="button" data-act="calAdd" data-d="${d}">＋ 新增</button></div>
    ${list.length ? list.map(agItem).join('') : `<p class="empty">這天沒有排程。</p>`}
    <p class="hint">日曆從「商品分析」的全部商品挑選，跟發布清單無關。先排好時間、確定排定後，再在這裡產生文案，發文後按「標記已發布」。建議的日期與時間由 AI 排定，手動改過的不會再被 AI 移動；電腦版可把下方項目拖到月曆上的其他日期。</p>
  </section>`;
}
function agItem({ p, i }) {
  const od = overdue(p), open = isOpen(p), pid = esc(p.id), rk = risks(i), c = CS();
  const t = p.st === 'done' ? fmtDT(p.at).slice(11) || '✓' : p.t || '--:--';
  return `<article class="ag st-${esc(p.st)}${od ? ' od' : ''}"${open ? ' draggable="true"' : ''} data-pid="${pid}" id="cp-${pid}">
    <div class="ag-t">${esc(t)}</div>
    <div class="ag-b">
      <div class="ag-n">${esc(i.name)}</div>
      <div class="ag-m"><span class="pill st-${esc(p.st)}${od ? ' od' : ''}">${od ? '逾期' : PST[p.st]}</span><span class="grade g${esc(p.g)}">${esc(p.g)}</span>${p.fill ? '<span class="tag">補位</span>' : ''}${p.cd ? '<span class="tag">近期排過</span>' : ''}<span class="muted">${esc(p.st === 'done' ? '已發布' : p.tw || '未排時間')}</span></div>
      <p class="cc-r">${esc(p.r || '')}</p>
      ${open && rk.length ? `<p class="cc-warn">⚠ ${esc(rk.join('、'))}</p>` : ''}
      <div class="cc-acts">${planBtns(p, i, pid)}${open ? `<button type="button" class="ghost" data-act="calTime" data-pid="${pid}">管理時間</button>` : ''}${delBtn(pid)}</div>
    </div>
  </article>`;
}
function listHtml(ws, we) {
  const wk = shownPlans().filter(({ p }) => p.d >= ws && p.d <= we);
  const F = { all: ['全部', () => true], sug: ['建議', (p) => p.st === 'sug'], set: ['已排定', (p) => p.st === 'set' && !overdue(p)], od: ['逾期', overdue], done: ['已發布', (p) => p.st === 'done'] };
  if (!F[calFilter]) calFilter = 'all';
  const arr = wk.filter(({ p }) => F[calFilter][1](p)).sort(byGrade);
  for (const id of [...calPicked]) if (!arr.some(({ p }) => p.id === id)) calPicked.delete(id);
  return `<div class="tabs cat-tabs" role="tablist" aria-label="篩選狀態">${Object.entries(F).map(([k, [l, f]]) => `<button type="button" role="tab" data-act="calF" data-f="${k}" aria-selected="${calFilter === k}">${l} <span class="n">${wk.filter(({ p }) => f(p)).length}</span></button>`).join('')}</div>
    <div class="toolbar"><button type="button" data-act="calPickAll">全選</button><button type="button" class="ghost" data-act="calPickNone">取消選取</button>
      <button type="button" class="pri" id="cbSet" data-act="calBatch" data-op="set">確定排定</button><button type="button" id="cbUnset" data-act="calBatch" data-op="unset">取消排定</button></div>
    ${arr.length ? `<div class="cards">${arr.map((x) => calCard(x, true)).join('')}</div>` : '<p class="empty">這一週沒有符合的項目。</p>'}`;
}
function updCalBatch() {
  const sel = allPlans().filter(({ p }) => calPicked.has(p.id));
  for (const [id, l, n] of [['cbSet', '確定排定', sel.filter(({ p }) => p.st === 'sug').length], ['cbUnset', '取消排定', sel.filter(({ p }) => p.st === 'set').length]]) { const b = document.getElementById(id); if (b) { b.textContent = `${l}（${n}）`; b.disabled = !n; } }
}
const catList = () => [...new Set([...CATS, ...items.map((i) => i.category).filter(Boolean)])];
function eventsHtml() {
  const ev = (Array.isArray(S.events) ? S.events : []).slice().sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return `<div class="card"><h2>檔期清單</h2>
    <p class="hint">系統不內建檔期日期，請自己輸入（例如：雙 12、年貨節、店慶）。發文日落在「檔期開始前 ${CS().pre} 天至檔期結束」且商品類別符合主推類別時，檔期適配分為 100。修改檔期後，可回週視圖按「重新產生建議」。</p>
    ${ev.length ? `<div class="tw"><table><thead><tr><th>名稱</th><th>期間</th><th>主推類別</th><th></th></tr></thead><tbody>${ev.map((e) => `<tr class="${e.end < today() ? 'muted' : ''}"><td>${esc(e.name)}</td><td>${esc(e.start)} ~ ${esc(e.end)}</td><td>${esc((e.cats || []).join('、') || '全部類別')}</td><td class="nowrap"><button type="button" data-act="evEdit" data-id="${esc(e.id)}">修改</button><button type="button" class="danger" data-act="evDel" data-id="${esc(e.id)}">刪除</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">還沒有檔期。</p>'}
    <div class="btns"><button type="button" class="pri" data-act="evEdit">＋ 新增檔期</button></div></div>`;
}
function setHtml(c) {
  return `    <div class="card"><h2>排程設定</h2><div class="row2">
    <label>最低入選等級<select data-cs="minG">${['S', 'A', 'B'].map((g) => `<option value="${g}"${c.minG === g ? ' selected' : ''}>${g} 級以上</option>`).join('')}</select></label>
    <label>候選不足時<select data-cs="fill"><option value="remind"${c.fill === 'remind' ? ' selected' : ''}>提醒我，不自動降級</option><option value="auto"${c.fill === 'auto' ? ' selected' : ''}>自動依序補入下一等級（S→A→B）</option></select></label>
    </div>
    <p class="hint">候選不足時選「自動依序補入」：入選等級的商品不夠，會依序補入下一等級（最多到 B 級），卡片標示「補位」。</p>
    <div class="btns"><button type="button" class="pri" data-act="calSaveSet">儲存排程設定</button><button type="button" class="ghost" data-act="calResetSet">恢復預設</button><span id="calSetMsg" class="hint"></span></div></div>`;
}

/* ---------- 對話框 ---------- */
// 管理時間：只改排定日期與發文時間
function calTime(pid) {
  const f0 = findPlan(pid); if (!f0) return;
  const { p, i } = f0, d = $('#dlg');
  d.innerHTML = `<form method="dialog" id="fTime"><h2>${esc(i.name)}</h2>
    <div class="row2"><label>發文日期<input name="d" type="date" required value="${esc(p.d)}"></label><label>發文時間<input name="t" type="time" value="${esc(p.t || '')}"></label></div>
    <p class="hint">改了日期或時間後，「AI 重新排程」不會再移動這則。</p>
    <div class="btns"><button value="cancel" formnovalidate class="ghost">取消</button><button value="ok" class="pri">儲存</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    d.onclose = null; if (d.returnValue !== 'ok') return;
    const f = new FormData($('#fTime')), nd = String(f.get('d') || p.d), nt = String(f.get('t') || '');
    if (nt !== (p.t || '')) p.tw = nt ? '手動' : '';
    if (nd !== p.d) p.md = 1;
    Object.assign(p, { d: nd, t: nt, m: 1 }); save.i(); softRefresh(); toast('已更新時間');
  };
  if (!d.open) d.showModal();
}
function calAdd(day) {
  const d = $('#dlg'), list = items.filter((i) => i.status !== 'drop').sort((a, b) => num(b.total) - num(a.total));
  if (!list.length) { toast('還沒有商品，請先匯入'); return; }
  d.innerHTML = `<form method="dialog" id="fAdd"><h2>新增 ${esc(fmtMD(day))} 的發文</h2>
    <label>商品<select name="id">${list.map((i) => `<option value="${esc(i.id)}">${esc(i.grade)}｜${esc(i.name.slice(0, 50))}${risks(i).length ? '（⚠ 有風險標記）' : ''}</option>`).join('')}</select></label>
    <p class="hint">手動新增不受等級、冷卻期限制，會直接「確定排定」（不會加入發布清單）。</p>
    <div class="btns"><button value="cancel" formnovalidate class="ghost">取消</button><button value="ok" class="pri">新增</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    d.onclose = null; if (d.returnValue !== 'ok') return;
    const i = items.find((x) => x.id === new FormData($('#fAdd')).get('id')); if (!i) return;
    const H = heatMap(), { P, ev } = prioOf(i, day, H);
    const p = { id: uid(), d: day, st: 'set', p: P, g: i.grade, r: `手動新增｜${reasonOf({ i, ev }, '', H)}`, fill: false, m: 1, man: 1 };
    plansOf(i).push(p); save.i(); renderCal(); toast('已新增到日曆');
  };
  if (!d.open) d.showModal();
}
function evEdit(id) {
  const e = (S.events || []).find((x) => x.id === id) || { id: '', name: '', start: today(), end: addD(today(), 7), cats: [] }, d = $('#dlg');
  d.innerHTML = `<form method="dialog" id="fEv"><h2>${e.id ? '修改檔期' : '新增檔期'}</h2>
    <label>名稱<input name="name" required maxlength="40" value="${esc(e.name)}" placeholder="例如：雙 12 購物節"></label>
    <div class="row2"><label>開始日<input name="start" type="date" required value="${esc(e.start)}"></label><label>結束日<input name="end" type="date" required value="${esc(e.end)}"></label></div>
    <fieldset class="days"><legend>主推類別（都不勾＝全部類別）</legend>${catList().map((c) => `<label class="chk"><input type="checkbox" name="cats" value="${esc(c)}"${(e.cats || []).includes(c) ? ' checked' : ''}>${esc(c)}</label>`).join('')}</fieldset>
    <div class="btns"><button value="cancel" formnovalidate class="ghost">取消</button><button value="ok" class="pri">儲存</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    d.onclose = null; if (d.returnValue !== 'ok') return;
    const f = new FormData($('#fEv')); let start = String(f.get('start')), end = String(f.get('end'));
    if (end < start) [start, end] = [end, start];
    const ne = { id: e.id || uid(), name: String(f.get('name')).trim().slice(0, 40), start, end, cats: f.getAll('cats').map(String) };
    S.events = [...(S.events || []).filter((x) => x.id !== ne.id), ne]; save.s(); renderCal(); toast('已儲存檔期');
  };
  if (!d.open) d.showModal();
}
function updFindInfo() {
  const f = $('#fFind'); if (!f) return;
  const perDay = clamp(Math.round(num(f.perDay.value)) || 0, 0, 10);
  const c = { ...CS(), perDay }, from = f.from.value, to = f.to.value, el = $('#findInfo');
  if (!from || !to || to < from) { el.textContent = '請選擇開始與結束日期'; return; }
  const sl = rangeSlots(from, to, c);
  el.textContent = sl.length ? `共 ${sl.length} 天，每天 ${perDay} 篇，最多 ${sl.length * perDay} 篇；已有的排程會算進每天的篇數。` : '請選擇今天以後的日期。';
}
function calFindDlg() {
  if (!items.length) { toast('還沒有商品，請先到「商品分析」匯入蝦皮商品檔'); return; }
  const d = $('#dlg'), td = today(), nw = addD(wkStart(td), 7), from0 = calSel > td ? calSel : td;
  const q = [['未來 7 天', td, addD(td, 6)], ['本週', td, addD(wkStart(td), 6)], ['下週', nw, addD(nw, 6)], ['未來 14 天', td, addD(td, 13)], ['未來 30 天', td, addD(td, 29)]];
  d.innerHTML = `<form method="dialog" id="fFind"><h2>🔍 尋找商品</h2>
    <p class="hint">選擇要排哪幾天的商品。系統會從「商品分析」挑出要推的商品，再由 AI 排好日期與時間放進日曆。</p>
    <div class="btns">${q.map(([l, a, b]) => `<button type="button" class="ghost" data-act="calQ" data-from="${a}" data-to="${b}">${l}</button>`).join('')}</div>
    <div class="row2"><label>開始日期<input name="from" type="date" required min="${td}" value="${from0}"></label><label>結束日期<input name="to" type="date" required min="${td}" value="${addD(from0, 6)}"></label></div>
    <label>每天發幾篇<input name="perDay" type="number" min="1" max="10" step="1" inputmode="numeric" value="${CS().perDay}"></label>
    <p class="hint" id="findInfo"></p>
    <div class="btns"><button value="cancel" formnovalidate class="ghost">取消</button><button value="ok" class="pri">開始尋找</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    d.onclose = null; if (d.returnValue !== 'ok') return;
    const f = new FormData($('#fFind')); let from = String(f.get('from')), to = String(f.get('to'));
    S.cal = { ...(S.cal || {}), perDay: clamp(Math.round(num(f.get('perDay'))) || 3, 1, 10) }; save.s();   // 記住這次的選擇
    if (to < from) [from, to] = [to, from];
    if (from < td) from = td;
    if (diffD(to, from) > 30) { to = addD(from, 30); toast('一次最多 31 天，已調整結束日期'); }
    const c = CS();
    if (!rangeSlots(from, to, c).length) { toast('請選擇今天以後的日期'); return; }
    const old = allPlans().filter(({ p }) => p.st === 'sug' && p.d >= from && p.d <= to).length;
    if (old && !confirm(`這段日期已有 ${old} 則還沒確定的建議，要重新尋找嗎？（已確定排定與已發布的會保留）`)) return;
    let short = 0;
    for (let ws = wkStart(from); ws <= to; ws = addD(ws, 7)) short += planWeek(ws, [from, to]).short;
    save.i();
    pickDay(rangeSlots(from, to, c)[0] || from); calTab = 'month';
    if (!allPlans().some(({ p }) => p.pend && p.d >= from && p.d <= to)) { renderCal(); toast('這段日期沒有找到可推薦的商品（原因見上方提醒）'); return; }
    toast(`已找到商品，AI 正在排定 ${fmtMD(from)}–${fmtMD(to)} 的日期與時間…${short ? `（還有 ${short} 個空位沒找到商品）` : ''}`);
    calAIPlan(from, to, $('#calFind'), true);
  };
  if (!d.open) d.showModal();
  updFindInfo();
}
function calJump(pid) {
  const f0 = findPlan(pid); if (!f0) return;
  calSel = f0.p.d; calMonth = calSel.slice(0, 7); if (calTab === 'list') calFilter = 'all'; else calTab = 'month';
  renderCal();
  const el = document.getElementById('cp-' + pid);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); }
}
const pickDay = (d) => { calSel = d; calMonth = d.slice(0, 7); };

/* ---------- 事件 ---------- */
Object.assign(ACT, {
  calTab(b) { calTab = b.dataset.t; renderCal(); },
  calPrev() { if (calTab === 'month') { const d = pd(`${calMonth}-01`); d.setMonth(d.getMonth() - 1); pickDay(ymd(d)); } else pickDay(addD(calSel, -7)); renderCal(); },
  calNext() { if (calTab === 'month') { const d = pd(`${calMonth}-01`); d.setMonth(d.getMonth() + 1); pickDay(ymd(d)); } else pickDay(addD(calSel, 7)); renderCal(); },
  calToday() { initSel(); renderCal(); },
  calPick(b) { pickDay(b.dataset.d); renderCal(); if (matchMedia('(max-width:760px)').matches) document.querySelector('.agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  calDel(b) {
    const f0 = findPlan(b.dataset.pid); if (!f0) return;
    const { p, i } = f0;
    const msg = p.st === 'set' ? `刪除「${i.name.slice(0, 20)}」這則排程？` : p.st === 'done' ? '刪除這筆已發布紀錄？' : `刪除「${i.name.slice(0, 20)}」這則建議？這一週不會再排入這件商品。`;
    if (!confirm(msg)) return;
    i.plans = plansOf(i).filter((x) => x !== p);
    if (p.st !== 'done') i.calSkip = addD(wkStart(p.d), 6) > (i.calSkip || '') ? addD(wkStart(p.d), 6) : i.calSkip;
    save.i(); renderCal(); toast('已刪除');
  },
  // 尋找商品：選日期範圍 → 依規則從商品分析挑商品 → AI 排日期與時間 → 進日曆
  calFind() { calFindDlg(); },
  calQ(b) { $('#fFind [name=from]').value = b.dataset.from; $('#fFind [name=to]').value = b.dataset.to; updFindInfo(); },
  calFill(b) { const r = genWeek(calWeek, b.dataset.g); save.i(); renderCal(); if (r.added) calAIPlan(calWeek, addD(calWeek, 6), null, true); else toast(`沒有可補入的 ${b.dataset.g} 級商品`); },
  calSet(b) { const f0 = findPlan(b.dataset.pid); if (!f0) return; Object.assign(f0.p, { st: 'set', m: 1 }); save.i(); renderCal(); toast('已確定排定'); },
  calUnset(b) { const f0 = findPlan(b.dataset.pid); if (!f0) return; unsetPlan(f0.i, f0.p); save.i(); renderCal(); toast('已取消排定'); },
  calDone(b) { const f0 = findPlan(b.dataset.pid); if (!f0) return; Object.assign(f0.p, { st: 'done', at: new Date().toISOString(), m: 1 }); save.i(); renderCal(); toast(`已標記發布（${fmtDT(f0.p.at)}）`); },
  calUndone(b) { const f0 = findPlan(b.dataset.pid); if (!f0) return; Object.assign(f0.p, { st: 'set', at: '', m: 1 }); save.i(); renderCal(); toast('已取消已發布'); },
  calTime(b) { calTime(b.dataset.pid); },
  calAITime(b) { const ds = allPlans().filter(({ p }) => p.pend && p.d >= today()).map(({ p }) => p.d).sort(); if (ds.length) calAIPlan(ds[0], ds[ds.length - 1], b, false); else calAIPlan(calWeek, addD(calWeek, 6), b, false); },
  calAdd(b) { calAdd(b.dataset.d); },
  calJump(b) { calJump(b.dataset.pid); },
  calF(b) { calFilter = b.dataset.f; renderCal(); },
  calPickAll() { $$('[data-cpick]').forEach((e) => calPicked.add(e.dataset.cpick)); renderCal(); },
  calPickNone() { calPicked.clear(); renderCal(); },
  calBatch(b) {
    const sel = allPlans().filter(({ p }) => calPicked.has(p.id)), op = b.dataset.op;
    if (op === 'set') sel.filter(({ p }) => p.st === 'sug').forEach(({ p }) => { Object.assign(p, { st: 'set', m: 1 }); });
    else if (op === 'unset') sel.filter(({ p }) => p.st === 'set').forEach(({ p, i }) => { unsetPlan(i, p); });
    calPicked.clear(); save.i(); renderCal(); toast('已更新');
  },
  evEdit(b) { evEdit(b.dataset.id || ''); },
  evDel(b) { const e = (S.events || []).find((x) => x.id === b.dataset.id); if (e && confirm(`確定刪除檔期「${e.name}」？`)) { S.events = S.events.filter((x) => x.id !== e.id); save.s(); renderCal(); } },
  calSaveSet() {
    S.cal = { ...(S.cal || {}), minG: $('[data-cs="minG"]').value, fill: $('[data-cs="fill"]').value };
    save.s(); renderCal(); $('#calSetMsg').textContent = `已儲存（${fmtDT(new Date().toISOString())}），下次按「尋找商品」時套用。`;
  },
  calResetSet() { S.cal = { days: CS().days, perDay: CS().perDay }; save.s(); renderCal(); toast('已恢復預設排程設定'); },
});

document.addEventListener('input', (e) => { if (e.target.closest('#fFind')) updFindInfo(); });
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.closest && t.closest('#fFind')) updFindInfo();
  if (t.matches('[data-cpick]')) { if (t.checked) calPicked.add(t.dataset.cpick); else calPicked.delete(t.dataset.cpick); updCalBatch(); }
});
// 拖曳卡片改日期（電腦版）
document.addEventListener('dragstart', (e) => { const c = e.target.closest?.('.ccard'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.pid); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', (e) => { const d = e.target.closest?.('[data-day]'); if (d) { e.preventDefault(); d.classList.add('drop'); } });
document.addEventListener('dragleave', (e) => { const d = e.target.closest?.('[data-day]'); if (d && !d.contains(e.relatedTarget)) d.classList.remove('drop'); });
document.addEventListener('drop', (e) => {
  const d = e.target.closest?.('[data-day]'); if (!d) return; e.preventDefault(); d.classList.remove('drop');
  const f0 = findPlan(e.dataTransfer.getData('text/plain')); if (!f0 || !isOpen(f0.p) || f0.p.d === d.dataset.day) return;
  f0.p.d = d.dataset.day; f0.p.m = 1; f0.p.md = 1; save.i(); renderCal(); toast(`已改到 ${fmtMD(d.dataset.day)}`);
});

VIEWS.push('cal'); RENDER.cal = renderCal;
if (location.hash === '#cal') route();
// 等第一次雲端同步完成後再自動產生建議，避免兩台裝置各自排出不同的清單
Promise.resolve(typeof firstSync !== 'undefined' ? firstSync : null).finally(() => { calReady = true; if (location.hash === '#cal' && !$('#dlg').open) renderCal(); });
