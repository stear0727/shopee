/* ========== M11 內容日曆 ==========
 * 只建議、不發布：依商品評分、熱度與檔期排出每週建議發文清單，發布一律由使用者手動完成。
 * 每則排程存在商品的 plans 陣列裡，跟著商品一起雲端同步。
 * plan = { id, d: 排定日期, st: sug|set|make|done|perf|skip, p: 排程優先分, g: 入選等級, r: 入選原因, fill: 補位,
 *          m: 手動改過, sk: 略過原因, pf: 平台, at: 發布時間, url: 貼文連結, sub: Sub_id, cv: 文案版本, perf: {views, orders, commission} }
 */
const CAL_DEF = { minG: 'A', fill: 'auto', perWeek: 10, fresh: 14, cool: 21, catCap: 40, pre: 7, days: [1, 3, 5], w: { s: 0.6, h: 0.2, c: 0.2 } };
const CS = () => ({ ...CAL_DEF, ...(S.cal || {}), w: { ...CAL_DEF.w, ...((S.cal || {}).w || {}) } });
const GEN_V = 2;   // 排程規則版本：改版後，本週與之後的週會自動重排一次（保留已確認與改過的卡片）
const GR = { S: 0, A: 1, B: 2, C: 3 }, GL = ['S', 'A', 'B', 'C'];
const PST = { sug: '建議', set: '已排定', make: '製作中', done: '已發布', perf: '已回填成效', skip: '略過' };
const SKIPS = ['缺貨', '不適合', '沒時間', '價格變動', '其他'];
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const pd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addD = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffD = (a, b) => Math.round((pd(a) - pd(b)) / 864e5);
const wkStart = (s) => addD(s, -((pd(s).getDay() + 6) % 7));   // 週一為一週的開始
const fmtMD = (s) => { const d = pd(s); return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`; };
const isOpen = (p) => p.st === 'sug' || p.st === 'set' || p.st === 'make';
const overdue = (p) => isOpen(p) && p.d < today();
const plansOf = (i) => (Array.isArray(i.plans) ? i.plans : (i.plans = []));
const allPlans = () => items.flatMap((i) => (Array.isArray(i.plans) ? i.plans.map((p) => ({ p, i })) : []));
const findPlan = (pid) => allPlans().find(({ p }) => p.id === pid);
const dataAge = (i) => { const t = new Date(i.updAt || i.createdAt); return Number.isNaN(+t) ? 999 : Math.floor((Date.now() - t) / 864e5); };
const risks = (i) => [...(Array.isArray(i.risk) ? i.risk : []), ...(i.oos ? ['缺貨'] : [])];
const byGrade = (a, b) => (GR[a.p.g] ?? 9) - (GR[b.p.g] ?? 9) || num(b.p.p) - num(a.p.p);   // 卡片依等級（S→A→B）再依優先分排序
const calSub = (i, p) => { let h = 0; for (const ch of String(i.name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0; return `${p.pf || i.platform || 'fb'}_${String(p.d).slice(2).replace(/-/g, '')}_${h.toString(36).slice(0, 5)}`; };
const toLocalDT = (iso) => { const d = iso ? new Date(iso) : new Date(); return Number.isNaN(+d) ? '' : `${ymd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

let calWeek = '', calTab = 'week', calFilter = 'all', calReady = false;
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
function weekSlots(ws, c) {
  const all = [...Array(7)].map((_, k) => addD(ws, k));
  let s = all.filter((d) => c.days.includes(pd(d).getDay()));
  if (!s.length) s = all;
  return s.filter((d) => d >= today());   // 不排到已經過去的日子
}
// 候選商品＋排程優先分 P = (wS×總分 + wH×熱度 + wC×檔期) ÷ 權重合計
function scoreCands(ws, slots, grades, c, H, except = new Set()) {
  const coolFrom = addD(ws, -c.cool), W = c.w, wsum = (W.s + W.h + W.c) || 1;
  const busy = (i) => plansOf(i).some((p) => p.st !== 'skip' && p.d > coolFrom) || (i.publishedAt && ymd(new Date(i.publishedAt)) > coolFrom);
  return items.filter((i) => !except.has(i.id) && i.status !== 'drop' && grades.includes(i.grade) && dataAge(i) <= c.fresh && !risks(i).length && !busy(i))
    .map((i) => {
      let ev = null, evD = '';
      for (const d of slots) { const e = evOf(i, d, c); if (e) { ev = e; evD = d; break; } }   // 檔期商品排在最早可預熱的發文日
      const P = Math.round(((W.s * num(i.total) + W.h * (H[i.id] ?? 0) + W.c * (ev ? 100 : 0)) / wsum) * 10) / 10;
      return { i, P, ev, evD };
    }).sort((a, b) => GR[a.i.grade] - GR[b.i.grade] || b.P - a.P || num(b.i.total) - num(a.i.total));   // 依等級順序（S→A→B），同等級再比排程優先分
}
function reasonOf(s, fill, H) {
  const i = s.i, a = [`總分 ${fmt(num(i.total), 1)}（${i.grade} 級）`];
  if (num(i.sales)) a.push(`月銷 ${kfmt(num(i.sales))}${(H[i.id] ?? 0) >= 80 ? '（排名前 20%）' : ''}`);
  if (i.trend === '上升') a.push('銷量比上次匯入上升');
  if (s.ev) a.push(`符合檔期「${s.ev.name}」`);
  a.push(`預估社群分潤 $${fmt(commOf(i), 1)}`);
  if (fill) a.push(`${fill} 級補位`);
  return a.join('、');
}
// 產生一週建議：fill＝補入指定等級（補位）
function genWeek(ws, fill = '') {
  const c = CS(), we = addD(ws, 6), slots = weekSlots(ws, c);
  if (!slots.length) return { added: 0, short: 0 };
  if (!fill) for (const i of items) if (Array.isArray(i.plans)) i.plans = i.plans.filter((p) => !(p.st === 'sug' && !p.m && p.d >= ws && p.d <= we && p.d >= today()));
  const inWeek = allPlans().filter(({ p }) => p.d >= ws && p.d <= we && p.st !== 'skip');
  const need = c.perWeek - inWeek.length;
  if (need <= 0) return { added: 0, short: 0 };
  const H = heatMap(), grades = fill ? [fill] : GL.slice(0, GR[c.minG] + 1);
  const sc = scoreCands(ws, slots, grades, c, H);
  // 同一類別一週不超過上限；候選不夠時才放寬
  const cap = Math.max(1, Math.floor(c.perWeek * c.catCap / 100)), catN = {}, pick = [];
  inWeek.forEach(({ i }) => { const k = i.category || '未分類'; catN[k] = (catN[k] || 0) + 1; });
  for (const s of sc) { if (pick.length >= need) break; const k = s.i.category || '未分類'; if ((catN[k] || 0) >= cap) continue; catN[k] = (catN[k] || 0) + 1; pick.push(s); }
  for (const s of sc) { if (pick.length >= need) break; if (!pick.includes(s)) pick.push(s); }
  // 分配到發文日：檔期商品排在預熱日，其他平均分到排得最少的發文日
  const perDay = Object.fromEntries(slots.map((d) => [d, 0]));
  inWeek.forEach(({ p }) => { if (p.d in perDay) perDay[p.d]++; });
  for (const s of pick) {
    const d = s.evD || slots.reduce((a, b) => (perDay[b] < perDay[a] ? b : a));
    perDay[d] = (perDay[d] || 0) + 1;
    plansOf(s.i).push({ id: uid(), d, st: 'sug', p: s.P, g: s.i.grade, r: reasonOf(s, fill, H), fill: !!fill });
  }
  return { added: pick.length, short: Math.max(0, need - pick.length) };
}
function planWeek(ws) {
  const c = CS(); let r = genWeek(ws), added = r.added;
  if (r.short && c.fill === 'auto') for (let g = GR[c.minG] + 1; g <= GR.B && r.short; g++) { r = genWeek(ws, GL[g]); added += r.added; }
  return { added, short: r.short };
}
// 下一個可補位的等級（C 級永遠不入選）
function nextFill(ws, we, c) {
  const used = allPlans().filter(({ p }) => p.fill && p.d >= ws && p.d <= we).map(({ p }) => GR[p.g]);
  const g = Math.max(GR[c.minG], ...used) + 1;
  return g <= GR.B ? GL[g] : '';
}
// 與發布清單連動
function calOnPublish(i) {
  const p = plansOf(i).filter(isOpen).sort((a, b) => Math.abs(diffD(a.d, today())) - Math.abs(diffD(b.d, today())))[0];
  if (p) Object.assign(p, { st: 'done', at: i.publishedAt || new Date().toISOString(), m: 1, pf: p.pf || i.platform || 'fb', sub: p.sub || calSub(i, p), cv: i.aiAt || '' });
}
function calOnUnpublish(i) {
  const p = plansOf(i).filter((x) => x.st === 'done').sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (p) Object.assign(p, { st: 'make', at: '' });
}
// 卡片狀態改變時同步商品本身的狀態（已排定→加入發布清單；已發布→標記已發布）
function syncItemStatus(i, p, prev) {
  if (p.st === 'set' || p.st === 'make') queue(i);
  // 直接改欄位、不經過 setStatus，避免又回頭觸發 calOnPublish／calOnUnpublish
  if ((p.st === 'done' || p.st === 'perf') && i.status !== 'done') { i.status = 'done'; i.publishedAt = p.at || new Date().toISOString(); if (!i.queuedAt) i.queuedAt = i.publishedAt; }
  if ((prev === 'done' || prev === 'perf') && isOpen(p) && i.status === 'done') { i.status = i.aiText ? 'copy' : 'todo'; i.publishedAt = ''; }
}

/* ---------- 畫面 ---------- */
function renderCal() {
  if (!calWeek) calWeek = curWeek();
  const c = CS(), ws = calWeek, we = addD(ws, 6);
  // 第一次打開某一週（且雲端同步已完成）時自動產生建議
  if (calReady && weekSlots(ws, c).length && (S.calGen || {})[ws] !== GEN_V && items.length) {
    planWeek(ws);
    const keep = addD(today(), -120);
    S.calGen = Object.fromEntries(Object.entries({ ...(S.calGen || {}), [ws]: GEN_V }).filter(([k]) => k >= keep));
    save.s(); save.i();
  }
  $$('#calTabs [data-t]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === calTab)));
  const wk = calTab === 'week' || calTab === 'list';
  $('#calWeekBar').hidden = !wk; $('#calAlerts').hidden = !wk;
  $('#calRange').textContent = `${fmtMD(ws)} – ${fmtMD(we)}${ws === wkStart(today()) ? '｜本週' : ws === addD(wkStart(today()), 7) ? '｜下週' : ''}`;
  if (wk) $('#calAlerts').innerHTML = alertsHtml(ws, we, c);
  $('#calBody').innerHTML = calTab === 'week' ? weekHtml(ws) : calTab === 'list' ? listHtml(ws, we) : calTab === 'events' ? eventsHtml() : setHtml(c);
  if (calTab === 'list') updCalBatch();
}
const jumpBtn = ({ p, i }) => `<button type="button" class="link" data-act="calJump" data-pid="${esc(p.id)}">${esc(fmtMD(p.d))} ${esc(i.name.slice(0, 18))}</button>`;
function alertsHtml(ws, we, c) {
  const all = allPlans(), wk = all.filter(({ p }) => p.d >= ws && p.d <= we);
  const pend = wk.filter(({ p }) => isOpen(p)), od = all.filter(({ p }) => overdue(p));
  const stale = all.filter(({ p, i }) => isOpen(p) && dataAge(i) > c.fresh), rk = all.filter(({ p, i }) => isOpen(p) && risks(i).length);
  const cnt = wk.filter(({ p }) => p.st !== 'skip').length, li = [];
  const list = (a) => a.slice(0, 6).map(jumpBtn).join('、') + (a.length > 6 ? ` 等 ${a.length} 則` : '');
  li.push(`<li>本週待發布 <b>${pend.length}</b> 則${pend.length ? `：${list(pend)}` : ''}</li>`);
  if (od.length) li.push(`<li class="bad">逾期 <b>${od.length}</b> 則（日期已過但未標記已發布）：${list(od)}</li>`);
  if (stale.length) li.push(`<li class="warn">資料過期 <b>${stale.length}</b> 則（商品資料超過 ${c.fresh} 天未更新，請重新匯入蝦皮檔）：${list(stale)}</li>`);
  if (rk.length) li.push(`<li class="warn">風險標記 <b>${rk.length}</b> 則：${list(rk)}</li>`);
  if (!items.length) li.push('<li class="warn">還沒有商品，請先到「商品分析」匯入蝦皮商品檔。</li>');
  else if (weekSlots(ws, c).length && cnt < c.perWeek) {
    const g = nextFill(ws, we, c);
    li.push(`<li class="warn">本週只排入 ${cnt} 則，少於目標 ${c.perWeek} 則（${c.minG} 級以上、資料 ${c.fresh} 天內、無風險標記、不在冷卻期的商品不足）。${g ? `<button type="button" data-act="calFill" data-g="${g}">本週補入 ${g} 級商品</button>` : ''}</li>`);
  }
  return `<ul class="cal-alerts">${li.join('')}</ul>`;
}
function nextBtn(p) {
  const pid = esc(p.id);
  if (p.st === 'sug') return `<button type="button" class="pri" data-act="calSt" data-st="set" data-pid="${pid}">確認排定</button>`;
  if (p.st === 'set') return `<button type="button" data-act="calSt" data-st="make" data-pid="${pid}">開始製作</button><button type="button" data-act="calManage" data-pre="done" data-pid="${pid}">已發布</button>`;
  if (p.st === 'make') return `<button type="button" data-act="calManage" data-pre="done" data-pid="${pid}">已發布</button>`;
  if (p.st === 'done') return `<button type="button" data-act="calManage" data-pid="${pid}">回填成效</button>`;
  return '';
}
function calCard({ p, i }, pick = false) {
  const od = overdue(p), rk = risks(i), c = CS(), pid = esc(p.id);
  return `<article class="ccard st-${esc(p.st)}${od ? ' od' : ''}" draggable="true" data-pid="${pid}" id="cp-${pid}">
    <div class="cc-top">${pick ? `<label class="pick"><input type="checkbox" data-cpick="${pid}"${calPicked.has(p.id) ? ' checked' : ''} aria-label="選取 ${esc(i.name)}"></label>` : ''}<span class="grade g${esc(p.g)}">${esc(p.g)}</span><span class="cc-st">${od ? '逾期' : PST[p.st] || ''}</span>${p.fill ? `<span class="tag">${esc(p.g)} 級補位</span>` : ''}<span class="grow"></span><span class="cc-p" title="排程優先分（滿分 100）">${fmt(num(p.p), 1)}</span></div>
    <h4>${esc(i.name)}</h4>
    ${pick ? `<p class="cc-d">📅 ${esc(fmtMD(p.d))}</p>` : ''}
    <p class="cc-r">${esc(p.r || '手動新增')}</p>
    ${rk.length ? `<p class="cc-warn">⚠ ${esc(rk.join('、'))}</p>` : ''}${isOpen(p) && dataAge(i) > c.fresh ? `<p class="cc-warn">⚠ 商品資料 ${dataAge(i)} 天未更新</p>` : ''}
    ${p.st === 'skip' && p.sk ? `<p class="cc-r">略過原因：${esc(p.sk)}</p>` : ''}${(p.st === 'done' || p.st === 'perf') && p.at ? `<p class="cc-r">發布於 ${esc(fmtDT(p.at))}${p.pf ? `｜${esc(PLATFORMS[p.pf] || p.pf)}` : ''}</p>` : ''}
    <div class="cc-acts">${nextBtn(p)}<button type="button" class="ghost" data-act="calManage" data-pid="${pid}">管理</button></div>
  </article>`;
}
function weekHtml(ws) {
  const all = allPlans(), td = today(), c = CS();
  return `<p class="hint">電腦版可拖曳卡片到其他日期；手機版請按「管理」改日期。灰底日期不是預設發文日。</p><div class="cal-week">${[...Array(7)].map((_, k) => {
    const d = addD(ws, k), list = all.filter(({ p }) => p.d === d).sort(byGrade);
    return `<section class="cal-day${d === td ? ' today' : ''}${c.days.includes(pd(d).getDay()) ? '' : ' off'}${d < td ? ' past' : ''}" data-day="${d}">
      <h3>${esc(fmtMD(d))}${d === td ? ' <span class="tag">今天</span>' : ''}</h3>
      ${list.map((x) => calCard(x)).join('')}
      <button type="button" class="ghost add" data-act="calAdd" data-d="${d}">＋ 新增</button></section>`;
  }).join('')}</div>`;
}
function listHtml(ws, we) {
  const wk = allPlans().filter(({ p }) => p.d >= ws && p.d <= we);
  const F = { all: ['全部', () => true], sug: ['建議', (p) => p.st === 'sug' && !overdue(p)], set: ['已排定', (p) => p.st === 'set' && !overdue(p)], make: ['製作中', (p) => p.st === 'make' && !overdue(p)], od: ['逾期', overdue], done: ['已發布', (p) => p.st === 'done'], perf: ['已回填成效', (p) => p.st === 'perf'], skip: ['略過', (p) => p.st === 'skip'] };
  if (!F[calFilter]) calFilter = 'all';
  const arr = wk.filter(({ p }) => F[calFilter][1](p)).sort(byGrade);
  for (const id of [...calPicked]) if (!arr.some(({ p }) => p.id === id)) calPicked.delete(id);
  return `<div class="tabs cat-tabs" role="tablist" aria-label="篩選狀態">${Object.entries(F).map(([k, [l, f]]) => `<button type="button" role="tab" data-act="calF" data-f="${k}" aria-selected="${calFilter === k}">${l} <span class="n">${wk.filter(({ p }) => f(p)).length}</span></button>`).join('')}</div>
    <div class="toolbar"><button type="button" data-act="calPickAll">全選</button><button type="button" class="ghost" data-act="calPickNone">取消選取</button>
      <button type="button" class="pri" id="cbSet" data-act="calBatch" data-op="set">確認排定</button><button type="button" id="cbSkip" data-act="calBatch" data-op="skip">略過</button><button type="button" class="danger" id="cbDel" data-act="calBatch" data-op="del">刪除</button></div>
    ${arr.length ? `<div class="cards">${arr.map((x) => calCard(x, true)).join('')}</div>` : '<p class="empty">這一週沒有符合的項目。</p>'}`;
}
function updCalBatch() {
  const sel = allPlans().filter(({ p }) => calPicked.has(p.id));
  for (const [id, l, n] of [['cbSet', '確認排定', sel.filter(({ p }) => p.st === 'sug').length], ['cbSkip', '略過', sel.filter(({ p }) => isOpen(p)).length], ['cbDel', '刪除', sel.length]]) { const b = document.getElementById(id); if (b) { b.textContent = `${l}（${n}）`; b.disabled = !n; } }
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
  const n = (k, l, min, max, unit = '') => `<label>${l}<input type="number" data-cs="${k}" min="${min}" max="${max}" step="1" inputmode="numeric" value="${esc(c[k])}">${unit ? `<small class="hint">${min}–${max}${unit}</small>` : ''}</label>`;
  return `<div class="card"><h2>排程設定</h2><div class="row2">
    <label>最低入選等級<select data-cs="minG">${['S', 'A', 'B'].map((g) => `<option value="${g}"${c.minG === g ? ' selected' : ''}>${g} 級以上</option>`).join('')}</select></label>
    <label>候選不足時<select data-cs="fill"><option value="remind"${c.fill === 'remind' ? ' selected' : ''}>提醒我，不自動降級</option><option value="auto"${c.fill === 'auto' ? ' selected' : ''}>自動依序補入下一等級（S→A→B）</option></select></label>
    ${n('perWeek', '每週發文則數', 1, 30, ' 則')}${n('fresh', '商品資料新鮮度上限', 7, 30, ' 天')}
    ${n('cool', '冷卻期', 7, 60, ' 天')}${n('catCap', '同一類別週上限 %', 20, 100, '%')}
    ${n('pre', '檔期提前預熱天數', 3, 14, ' 天')}</div>
    <fieldset class="days"><legend>每週發文日</legend>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="chk"><input type="checkbox" data-csday="${d}"${c.days.includes(d) ? ' checked' : ''}>週${WD[d]}</label>`).join('')}</fieldset>
    <fieldset><legend>排程優先分權重（商品總分／熱度／檔期，會自動換算成合計 1）</legend><div class="row3">
      <label>商品總分<input type="number" data-csw="s" min="0" max="1" step="0.05" value="${esc(c.w.s)}"></label>
      <label>熱度<input type="number" data-csw="h" min="0" max="1" step="0.05" value="${esc(c.w.h)}"></label>
      <label>檔期<input type="number" data-csw="c" min="0" max="1" step="0.05" value="${esc(c.w.c)}"></label></div></fieldset>
    <p class="hint">熱度分＝月銷在全部商品中的排名（0–100），與上次匯入相比銷量上升加 15、下降減 15。排程優先分是選品依據，不是成交預測。</p>
    <div class="btns"><button type="button" class="pri" data-act="calSaveSet">儲存排程設定</button><button type="button" class="ghost" data-act="calResetSet">恢復預設</button><span id="calSetMsg" class="hint"></span></div></div>`;
}

/* ---------- 對話框 ---------- */
function calManage(pid, pre = '') {
  const f0 = findPlan(pid); if (!f0) return;
  const { p, i } = f0, d = $('#dlg'), perf = p.perf || {}, st = pre || p.st;
  const nf = (n, l, v) => `<label>${l}<input name="${n}" type="number" inputmode="decimal" min="0" step="any" value="${esc(v ?? '')}"></label>`;
  d.innerHTML = `<form method="dialog" id="fPlan"><div class="dlg-head"><h2>${esc(i.name)}</h2><button type="button" class="ghost" data-act="closeDlg" aria-label="關閉">✕</button></div>
    <p class="hint"><span class="grade g${esc(p.g)}">${esc(p.g)}</span> 排程優先分 ${fmt(num(p.p), 1)}｜${esc(p.r || '手動新增')}</p>
    <div class="btns"><button type="button" data-act="editItem" data-id="${esc(i.id)}">商品詳情</button>${i.aiText ? `<button type="button" data-act="viewCopy" data-id="${esc(i.id)}">查看 AI 文案</button>` : ''}<button type="button" data-act="itemAI" data-id="${esc(i.id)}">${i.aiText ? '重新產文案' : '產生 AI 文案'}</button>${safeUrl(i.url) ? `<a class="btn" href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener noreferrer">蝦皮商品頁</a>` : ''}</div>
    <div class="row2">
      <label>排定日期<input name="d" type="date" required value="${esc(p.d)}"></label>
      <label>狀態<select name="st">${Object.entries(PST).map(([k, v]) => `<option value="${k}"${k === st ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>略過原因（狀態為略過時）<select name="sk">${['', ...SKIPS].map((s) => `<option${s === (p.sk || '') ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
    </div>
    <h3>發布紀錄（標記已發布時填寫）</h3>
    <p class="hint">發文當天請再確認一次價格、庫存與活動；系統不會幫你發文。</p>
    <div class="row2">
      <label>發布平台<select name="pf">${opts(PLATFORMS, p.pf || (PLATFORMS[i.platform] ? i.platform : 'fb'))}</select></label>
      <label>發布時間<input name="at" type="datetime-local" value="${esc(toLocalDT(p.at))}"></label>
      <label class="span2">貼文連結（選填）<input name="url" type="url" maxlength="500" value="${esc(p.url || '')}" placeholder="https://"></label>
      <label class="span2">Sub_id（追蹤用代碼，貼到自定義連結的 Sub_id 欄）<input name="sub" maxlength="60" value="${esc(p.sub || calSub(i, p))}"></label>
    </div>
    <h3>實際成效回填（分潤結算後）</h3>
    <div class="row3">${nf('views', '觸及／觀看', perf.views)}${nf('orders', '訂單', perf.orders)}${nf('commission', '實際分潤（元）', perf.commission)}</div>
    <div class="btns"><button value="cancel" formnovalidate class="ghost">取消</button><button value="swap" formnovalidate>換商品</button><button value="del" formnovalidate class="danger">刪除此項</button><span class="grow"></span><button value="ok" class="pri">儲存</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    const rv = d.returnValue; d.onclose = null;
    if (rv === 'del') { if (confirm('確定刪除這則排程？')) { i.plans = plansOf(i).filter((x) => x.id !== p.id); save.i(); renderCal(); } return; }
    if (rv === 'swap') { calSwap(pid); return; }
    if (rv !== 'ok') return;
    const f = new FormData($('#fPlan')), prev = p.st;
    let ns = String(f.get('st'));
    const pf = { views: String(f.get('views') || ''), orders: String(f.get('orders') || ''), commission: String(f.get('commission') || '') };
    const hasPerf = Object.values(pf).some((v) => v !== '');
    if (ns === 'done' && hasPerf) ns = 'perf';   // 填了成效就變成「已回填成效」
    if (ns === 'skip' && !f.get('sk')) { toast('略過請選擇原因'); calManage(pid, 'skip'); return; }
    const atV = String(f.get('at') || '');
    Object.assign(p, { d: String(f.get('d')) || p.d, st: ns, sk: ns === 'skip' ? String(f.get('sk')) : '', pf: String(f.get('pf')), url: safeUrl(f.get('url')), sub: String(f.get('sub') || '').trim().slice(0, 60), perf: pf, m: 1 });
    if (ns === 'done' || ns === 'perf') { p.at = atV ? new Date(atV).toISOString() : (p.at || new Date().toISOString()); p.cv = p.cv || i.aiAt || ''; } else p.at = '';
    if (hasPerf) i.actual = { ...(i.actual || {}), views: pf.views, orders: pf.orders, commission: pf.commission };
    syncItemStatus(i, p, prev);
    save.i(); renderCal(); toast('已儲存');
  };
  if (!d.open) d.showModal();
}
// 換商品：用同一天、目前不在本週的下一個最佳候選取代
function calSwap(pid) {
  const f0 = findPlan(pid); if (!f0) return;
  const { p, i } = f0, c = CS(), ws = wkStart(p.d), we = addD(ws, 6), H = heatMap();
  const inWeek = new Set(allPlans().filter(({ p: x }) => x.d >= ws && x.d <= we).map(({ i: x }) => x.id));
  const s = scoreCands(ws, [p.d], GL.slice(0, Math.max(GR[c.minG], GR[p.g]) + 1), c, H, inWeek)[0];
  if (!s) { toast('沒有其他符合條件的候選商品'); return; }
  i.plans = plansOf(i).filter((x) => x.id !== p.id);
  plansOf(s.i).push({ id: uid(), d: p.d, st: 'sug', p: s.P, g: s.i.grade, r: reasonOf(s, GR[s.i.grade] > GR[c.minG] ? s.i.grade : '', H), fill: GR[s.i.grade] > GR[c.minG], m: 1 });
  save.i(); renderCal(); toast(`已換成「${s.i.name.slice(0, 20)}」`);
}
function calAdd(day) {
  const d = $('#dlg'), list = items.filter((i) => i.status !== 'drop').sort((a, b) => num(b.total) - num(a.total));
  if (!list.length) { toast('還沒有商品，請先匯入'); return; }
  d.innerHTML = `<form method="dialog" id="fAdd"><h2>新增 ${esc(fmtMD(day))} 的發文</h2>
    <label>商品<select name="id">${list.map((i) => `<option value="${esc(i.id)}">${esc(i.grade)}｜${esc(i.name.slice(0, 50))}${risks(i).length ? '（⚠ 有風險標記）' : ''}</option>`).join('')}</select></label>
    <p class="hint">手動新增不受等級、冷卻期限制，會直接設為「已排定」並加入發布清單。</p>
    <div class="btns"><button value="cancel" formnovalidate class="ghost">取消</button><button value="ok" class="pri">新增</button></div></form>`;
  d.returnValue = '';
  d.onclose = () => {
    d.onclose = null; if (d.returnValue !== 'ok') return;
    const i = items.find((x) => x.id === new FormData($('#fAdd')).get('id')); if (!i) return;
    const c = CS(), H = heatMap(), ev = evOf(i, day, c), W = c.w, ws = (W.s + W.h + W.c) || 1;
    const P = Math.round(((W.s * num(i.total) + W.h * (H[i.id] ?? 0) + W.c * (ev ? 100 : 0)) / ws) * 10) / 10;
    const p = { id: uid(), d: day, st: 'set', p: P, g: i.grade, r: `手動新增｜${reasonOf({ i, ev }, '', H)}`, fill: false, m: 1 };
    plansOf(i).push(p); queue(i); save.i(); renderCal(); toast('已新增並加入發布清單');
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
function calJump(pid) {
  const f0 = findPlan(pid); if (!f0) return;
  calWeek = wkStart(f0.p.d); if (calTab !== 'list') calTab = 'week'; else calFilter = 'all';
  renderCal();
  const el = document.getElementById('cp-' + pid);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); }
}

/* ---------- 事件 ---------- */
Object.assign(ACT, {
  calTab(b) { calTab = b.dataset.t; renderCal(); },
  calPrev() { calWeek = addD(calWeek, -7); renderCal(); },
  calNext() { calWeek = addD(calWeek, 7); renderCal(); },
  calToday() { calWeek = curWeek(); renderCal(); },
  calRegen() {
    if (!confirm('重新產生會換掉本週還沒動過的「建議」卡片（已確認、製作中、已發布與你改過的卡片會保留），確定嗎？')) return;
    const r = planWeek(calWeek); S.calGen = { ...(S.calGen || {}), [calWeek]: GEN_V }; save.s(); save.i(); renderCal();
    toast(`已產生 ${r.added} 則建議${r.short ? `，還少 ${r.short} 則` : ''}`);
  },
  calFill(b) { const r = genWeek(calWeek, b.dataset.g); save.i(); renderCal(); toast(r.added ? `已補入 ${r.added} 件 ${b.dataset.g} 級商品` : `沒有可補入的 ${b.dataset.g} 級商品`); },
  calSt(b) { const f0 = findPlan(b.dataset.pid); if (!f0) return; const prev = f0.p.st; f0.p.st = b.dataset.st; f0.p.m = 1; syncItemStatus(f0.i, f0.p, prev); save.i(); renderCal(); toast(`已改為「${PST[f0.p.st]}」${f0.p.st === 'set' ? '，並加入發布清單' : ''}`); },
  calManage(b) { calManage(b.dataset.pid, b.dataset.pre || ''); },
  calAdd(b) { calAdd(b.dataset.d); },
  calJump(b) { calJump(b.dataset.pid); },
  calF(b) { calFilter = b.dataset.f; renderCal(); },
  calPickAll() { $$('[data-cpick]').forEach((e) => calPicked.add(e.dataset.cpick)); renderCal(); },
  calPickNone() { calPicked.clear(); renderCal(); },
  calBatch(b) {
    const sel = allPlans().filter(({ p }) => calPicked.has(p.id)), op = b.dataset.op;
    if (op === 'del') { if (!confirm(`確定刪除 ${sel.length} 則排程？`)) return; sel.forEach(({ p, i }) => { i.plans = plansOf(i).filter((x) => x.id !== p.id); }); }
    else if (op === 'set') sel.filter(({ p }) => p.st === 'sug').forEach(({ p, i }) => { p.st = 'set'; p.m = 1; queue(i); });
    else if (op === 'skip') {
      const r = prompt(`略過原因（${SKIPS.join('／')}）`, '沒時間'); if (r === null) return;
      const sk = SKIPS.includes(r.trim()) ? r.trim() : '其他';
      sel.filter(({ p }) => isOpen(p)).forEach(({ p }) => { Object.assign(p, { st: 'skip', sk, m: 1 }); });
    }
    calPicked.clear(); save.i(); renderCal(); toast('已更新');
  },
  evEdit(b) { evEdit(b.dataset.id || ''); },
  evDel(b) { const e = (S.events || []).find((x) => x.id === b.dataset.id); if (e && confirm(`確定刪除檔期「${e.name}」？`)) { S.events = S.events.filter((x) => x.id !== e.id); save.s(); renderCal(); } },
  calSaveSet() {
    const v = (k) => num($(`[data-cs="${k}"]`).value), w = Object.fromEntries(['s', 'h', 'c'].map((k) => [k, clamp(num($(`[data-csw="${k}"]`).value), 0, 1)]));
    const ws = w.s + w.h + w.c; if (!ws) { toast('三項權重不能都是 0'); return; }
    const days = $$('[data-csday]').filter((e) => e.checked).map((e) => Number(e.dataset.csday));
    if (!days.length) { toast('至少選一個發文日'); return; }
    S.cal = { minG: $('[data-cs="minG"]').value, fill: $('[data-cs="fill"]').value, perWeek: clamp(Math.round(v('perWeek')), 1, 30), fresh: clamp(Math.round(v('fresh')), 7, 30), cool: clamp(Math.round(v('cool')), 7, 60), catCap: clamp(Math.round(v('catCap')), 20, 100), pre: clamp(Math.round(v('pre')), 3, 14), days, w: { s: Math.round(w.s / ws * 100) / 100, h: Math.round(w.h / ws * 100) / 100, c: Math.round(w.c / ws * 100) / 100 } };
    save.s(); renderCal(); $('#calSetMsg').textContent = `已儲存（${fmtDT(new Date().toISOString())}）。要套用到本週，請回週視圖按「重新產生建議」。`;
  },
  calResetSet() { delete S.cal; save.s(); renderCal(); toast('已恢復預設排程設定'); },
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-cpick]')) { if (t.checked) calPicked.add(t.dataset.cpick); else calPicked.delete(t.dataset.cpick); updCalBatch(); }
});
// 拖曳卡片改日期（電腦版）
document.addEventListener('dragstart', (e) => { const c = e.target.closest?.('.ccard'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.pid); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', (e) => { const d = e.target.closest?.('.cal-day'); if (d) { e.preventDefault(); d.classList.add('drop'); } });
document.addEventListener('dragleave', (e) => { const d = e.target.closest?.('.cal-day'); if (d && !d.contains(e.relatedTarget)) d.classList.remove('drop'); });
document.addEventListener('drop', (e) => {
  const d = e.target.closest?.('.cal-day'); if (!d) return; e.preventDefault(); d.classList.remove('drop');
  const f0 = findPlan(e.dataTransfer.getData('text/plain')); if (!f0 || f0.p.d === d.dataset.day) return;
  f0.p.d = d.dataset.day; f0.p.m = 1; save.i(); renderCal(); toast(`已改到 ${fmtMD(d.dataset.day)}`);
});

VIEWS.push('cal'); RENDER.cal = renderCal;
if (location.hash === '#cal') route();
// 等第一次雲端同步完成後再自動產生建議，避免兩台裝置各自排出不同的清單
Promise.resolve(typeof firstSync !== 'undefined' ? firstSync : null).finally(() => { calReady = true; if (location.hash === '#cal' && !$('#dlg').open) renderCal(); });
