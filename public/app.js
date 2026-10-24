const $ = (s, root = document) => root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
let state = { words: [], plan: null, records: [], active: null, schema: 1 };
const BUILTIN_BOOKS = [
  { id:'ngsl', name:'NGSL 高频词', count:2851, icon:'🌐' },
  { id:'gaokao', name:'高考英语 3500', count:3285, icon:'🎓' },
  { id:'cet4', name:'四级词汇', count:5223, icon:'4️⃣' },
  { id:'cet6', name:'六级词汇', count:3777, icon:'6️⃣' },
  { id:'ielts', name:'雅思词汇真经', count:3631, icon:'🗣️' },
  { id:'test', name:'测试词本', count:10, icon:'🧪', note:'用于测试' }
];
let todayTasks = [];
let selected = 'today';
let marketBookId = null;
let marketBookWords = [];
let calendarMonthKey = null;
let timer = null;
let currentSpeech = null;
let lookupBusy = false;

function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function nextDate() { const date = new Date(); date.setDate(date.getDate() + 1); return localDateKey(date); }

async function load() {
  const response = await fetch('/api/state');
  const data = await response.json();
  state = data.state; todayTasks = data.todayTasks;
  const currentBook=BUILTIN_BOOKS.find(book=>book.id===state.bookId);
  if(currentBook&&state.bookName!==currentBook.name){state.bookName=currentBook.name;await save();}
  if(state.words.length&&state.words.some(w=>w.ukPhonetic===undefined||w.usPhonetic===undefined)){
    try{const [phoneRes,dictRes]=await Promise.all([fetch('/data/ngsl-phonetics.json'),fetch('/data/ngsl-dictionary.json')]);const phones=phoneRes.ok?await phoneRes.json():{},dict=dictRes.ok?await dictRes.json():{};for(const w of state.words){const key=w.text.trim().toLowerCase();w.ukPhonetic??=phones[key]?.ukPhonetic||'';w.usPhonetic??=phones[key]?.usPhonetic||'';if(!w.meaning&&dict[key]?.translation)w.meaning=dict[key].translation;}await save();}catch{}
  }
  render();
}
async function save() {
  await fetch('/api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) });
  refreshHeader();
}
function totalDays() { return state.plan ? 3 * state.plan.parts + 3 : 0; }
function completeRecords() { return (state.records || []).filter(r => r.completedAt); }
function wrongEntries() {
  const map = new Map();
  for (const record of completeRecords()) for (const answer of record.answers) if (!answer.correct) {
    if (!map.has(answer.wordId)) map.set(answer.wordId, []);
    map.get(answer.wordId).push(answer);
  }
  return map;
}
function currentTasks() {
  if (!state.plan) return [];
  const day = state.plan.day, parts = state.plan.parts;
  const result = [];
  if (day <= 3 * parts) {
    const group = (day - 1) % parts;
    for (const word of state.words) if (word.group === group) result.push({ wordId: word.id, source: '当日新词' });
  }
  for (const record of completeRecords()) {
    if (record.planDay <= 3 * parts && (record.planDay === day - 1 || record.planDay === day - 3)) {
      for (const answer of record.answers) if (!answer.correct && !result.some(item => item.wordId === answer.wordId)) result.push({ wordId: answer.wordId, source: '间隔错词复习' });
    }
  }
  return result;
}
function dayLabel(day) {
  const n = state.plan.parts;
  return day <= 3 * n ? `第 ${Math.floor((day - 1) / n) + 1} 轮 · 第 ${(day - 1) % n + 1} / ${n} 份` : '收尾复习';
}
function refreshHeader() {
  $('#mistakeBadge').textContent = wrongEntries().size;
}
function render() {
  refreshHeader();
  const section=selected==='familiar'?'familiar':(selected==='market'||selected==='marketBook')?'market':'memorize';
  const titles={today:'今日听写',myBook:'我的词本',market:'词本市场',marketBook:BUILTIN_BOOKS.find(b=>b.id===marketBookId)?.name||'词本详情',familiar:'刷词练习',mistakes:'错词本',settings:'备份与同步'};
  $('#pageTitle').textContent=titles[selected]||'今日听写';
  document.querySelectorAll('.primary-nav-item').forEach(b=>b.classList.toggle('active',b.dataset.section!=='memorize'&&b.dataset.section===section));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===(selected==='myBook'?'today':selected)));
  const area=$('#content');
  area.innerHTML=selected==='today'?renderToday():selected==='myBook'?renderBooks():selected==='market'?renderMarket():selected==='marketBook'?renderMarketBook():selected==='familiar'?renderComingSoon():selected==='mistakes'?renderMistakes():renderSettings();
  bindPage();
}
function renderPlanCalendar(){
  const today=localDateKey(),completedRecords=completeRecords();
  const completedDates=new Set(completedRecords.map(r=>localDateKey(new Date(r.completedAt))));
  const plan=state.plan,total=totalDays(),remaining=plan?Math.max(0,total-plan.day+1):0;
  const startCandidates=[plan?.createdAt?localDateKey(new Date(plan.createdAt)):today,...completedRecords.map(r=>localDateKey(new Date(r.completedAt)))].sort();
  const startDate=startCandidates[0]||today;
  const scheduleStart=plan?.nextDueDate&&plan.nextDueDate>today?plan.nextDueDate:today;
  const scheduled=new Map();
  for(let i=0;i<remaining;i++){const date=new Date(`${scheduleStart}T12:00:00`);date.setDate(date.getDate()+i);scheduled.set(localDateKey(date),plan.day+i);}
  const endCandidates=[...completedDates,today];
  if(remaining){const end=new Date(`${scheduleStart}T12:00:00`);end.setDate(end.getDate()+remaining-1);endCandidates.push(localDateKey(end));}
  const endDate=endCandidates.sort().at(-1)||startDate;
  const monthKey=date=>date.slice(0,7),startMonth=monthKey(startDate),endMonth=monthKey(endDate),todayMonth=monthKey(today);
  if(!calendarMonthKey||calendarMonthKey<startMonth||calendarMonthKey>endMonth)calendarMonthKey=todayMonth<startMonth?startMonth:todayMonth>endMonth?endMonth:todayMonth;
  const [year,monthIndex]=calendarMonthKey.split('-').map(Number);const month=monthIndex-1;
  const firstOffset=(new Date(year,month,1).getDay()+6)%7,daysInMonth=new Date(year,month+1,0).getDate();
  const cells=Array.from({length:firstOffset},()=>'<span class="calendar-empty"></span>');
  for(let d=1;d<=daysInMonth;d++){
    const dateKey=localDateKey(new Date(year,month,d)),dayPlan=scheduled.get(dateKey),classes=['calendar-day'];
    const isCompleted=completedDates.has(dateKey),isToday=dateKey===today;
    if(isCompleted)classes.push('completed');if(dayPlan)classes.push('scheduled');if(isToday)classes.push('today');
    const labels=[];if(isCompleted)labels.push('已完成');if(dayPlan)labels.push(`计划第 ${dayPlan} 天`);if(isToday)labels.push('今天');
    const label=labels.join('、')||`${month}月${d}日`;
    cells.push(`<span class="${classes.join(' ')}" title="${label}" aria-label="${label}">${d}</span>`);
  }
  while(cells.length<42)cells.push('<span class="calendar-empty"></span>');
  const previous=new Date(year,month-1,1),next=new Date(year,month+1,1),previousKey=monthKey(localDateKey(previous)),nextKey=monthKey(localDateKey(next));
  return `<div class="plan-calendar"><div class="calendar-title"><b>计划日历</b><div class="calendar-month-control"><button id="calendarPrev" aria-label="上一个月" ${previousKey<startMonth?'disabled':''}>‹</button><span>${year}年${monthIndex}月</span><button id="calendarNext" aria-label="下一个月" ${nextKey>endMonth?'disabled':''}>›</button></div></div><div class="calendar-grid calendar-weekdays">${['一','二','三','四','五','六','日'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div></div>`;
}
function renderToday() {
  if (!state.plan?.active) {
    const setup=state.words.length?`<div class="current-book"><div><small>当前词本</small><b>${esc(state.bookName||'我的词本')} · ${state.words.length} 个词</b></div><button class="secondary" data-nav="myBook">查看我的词本</button><button class="secondary" id="changeBook">更换词本</button></div><div class="book-ready"><label>分成 <input id="partInput" type="number" min="1" max="${state.words.length}" value="${Math.min(5,state.words.length)}"> 份</label><button class="primary" id="createPlan">生成计划 <span>· 预计 ${3*Math.min(5,state.words.length)+3} 天</span></button></div>`:`<div class="book-prompt">还没有选择词本，先去词本市场挑一本开始吧。 <button class="primary" data-nav="market">前往词本市场</button></div>`;
    return `<div class="welcome-card"><div class="eyebrow">听写练习</div><h2>今日听写</h2><p>按计划完成新词听写和错词复习。</p>${setup}</div>${renderRecentRecords()}`;
  }
  const n=state.plan.parts,day=state.plan.day,finished=day>totalDays();
  const waiting=!finished&&Boolean(state.plan.nextDueDate&&localDateKey()<state.plan.nextDueDate);
  let taskPanel;
  if(finished){
    taskPanel=`<section class="task-card next-day-card"><div class="done-mark">✓</div><div class="eyebrow">计划完成</div><h2>恭喜完成全部听写</h2><p>三轮主任务和最后三天的收尾复习都已完成。</p></section>`;
  }else if(waiting){
    taskPanel=`<section class="task-card next-day-card"><div class="done-mark">✓</div><div class="eyebrow">今日已完成</div><h2>今天的任务已完成</h2><p>第 ${day} 天计划于 ${state.plan.nextDueDate} 开放。也可以手动提前开始。</p><button class="primary" id="advanceEarly">提前开始第 ${day} 天</button></section>`;
  }else{
    todayTasks=currentTasks();
    const primaryCount=todayTasks.filter(x=>x.source==='当日新词').length;
    const reviewCount=todayTasks.length-primaryCount;
    const incomplete=state.records.filter(r=>r.planDay===day&&!r.completedAt).at(-1);
    const delayed=state.active?.planDay===day?state.active.delayedDays||state.delayDays||0:state.delayDays||0;
    const status=delayed>0?`<div class="status delayed"><span>↻</span><b>已延期 ${delayed} 天</b><small>今日会从头开始整份任务</small></div>`:state.active?.planDay===day?`<div class="status"><span>◷</span><b>未完成任务</b><small>本次进度已保存，今天可继续</small></div>`:incomplete?`<div class="status"><span>◷</span><b>未完成任务</b><small>今天从头开始整份任务</small></div>`:'';
    const action=todayTasks.length?`<button class="primary big" id="startTask">${state.active?.planDay===day&&!delayed?'继续今日听写':'开始今日听写'} <span>→</span></button>`:`<button class="primary big" id="emptyTask">完成今日复习 <span>→</span></button>`;
    taskPanel=`<section class="task-card"><div class="task-heading"><div><div class="eyebrow">${day<=3*n?`CYCLE ${Math.floor((day-1)/n)+1}`:'FINAL REVIEW'}</div><h2>第 ${day} 天</h2><p>${dayLabel(day)}</p></div><div class="question-count"><strong>${todayTasks.length}</strong><small>道题</small></div></div><div class="thin-rule"></div><div class="metrics"><div><small>当日新词</small><b>${primaryCount}<em>词</em></b></div><div><small>错词复习</small><b>${reviewCount}<em>词</em></b></div><div><small>计划总时长</small><b>${totalDays()}<em>天</em></b></div></div>${status}${action}<div class="task-note">每个单词播放一次，读音结束后有 5 秒作答时间。</div></section>`;
  }
  const progress=Math.min(100,Math.round((day-1)/totalDays()*100));
  return `<div class="day-grid">${taskPanel}<aside class="plan-card"><div class="card-title"><b>计划进度</b><span>${progress}%</span></div><div class="progress"><i style="width:${progress}%"></i></div><div class="progress-caption"><span>第 1 天</span><span>第 ${totalDays()} 天</span></div>${renderPlanCalendar()}<div class="today-actions"><button class="secondary" data-nav="myBook">我的词本</button><button class="secondary" data-nav="market">词本市场</button><button class="danger" id="resetPlan">重置计划</button></div></aside></div>${renderRecentRecords()}`;
}
function renderRecentRecords(){return `<section class="recent-section"><div class="section-head"><b>听写记录</b></div>${state.records.length?`<div class="recent-list">${state.records.slice().reverse().slice(0,10).map(r=>`<button class="recent-row" data-record="${r.id}"><span class="recent-day" title="${r.completedAt?'已完成':'未完成'}" aria-label="${r.completedAt?'已完成':'未完成'}">${r.completedAt?'✓':'◷'}</span><b>第 ${r.planDay} 天</b><span class="muted">${r.completedAt?`${r.answers.filter(a=>a.correct).length} 对 · ${r.answers.filter(a=>!a.correct).length} 错`:''}</span><span class="row-arrow">›</span></button>`).join('')}</div>`:`<div class="empty-inline">完成听写后，记录会显示在这里。</div>`}</section>`;}
function showBookPicker(){
  if(state.plan?.active){toast('请先重置当前计划，再更换词本');return;}
  const overlay=$('#overlay');
  overlay.innerHTML=`<div class="book-picker-modal"><header><div><small>今日听写</small><h2>选择词本</h2></div><button class="icon-button" id="closeBookPicker" aria-label="关闭">×</button></header><div class="book-picker-list">${BUILTIN_BOOKS.map(book=>`<button class="book-picker-option" data-select-book="${book.id}"><span class="market-book-icon">${book.icon}</span><span><b>${esc(book.name)}</b><small>${book.count.toLocaleString()} 个词汇</small></span><span class="row-arrow">›</span></button>`).join('')}</div></div>`;
  overlay.classList.remove('hidden');
  $('#closeBookPicker').addEventListener('click',()=>{overlay.classList.add('hidden');overlay.innerHTML='';});
  overlay.querySelectorAll('[data-select-book]').forEach(button=>button.addEventListener('click',()=>{const bookId=button.dataset.selectBook;overlay.classList.add('hidden');overlay.innerHTML='';loadBuiltinBook(bookId);}));
}
function renderMarket(){return `<div class="page-head"><div><h2>词本市场</h2><p>选择词本查看完整单词列表，也可以载入到今日听写。</p></div></div><div class="market-grid">${BUILTIN_BOOKS.map(book=>`<button class="market-book-card" data-market-book="${book.id}"><span class="market-book-icon" aria-hidden="true">${book.icon}</span><span class="market-book-info"><b>${esc(book.name)}</b><small>${book.count.toLocaleString()} 个词汇${book.id==='test'?` · ${esc(book.note)}`:''}</small></span><span class="row-arrow">›</span></button>`).join('')}</div>`;}
function renderMarketBook(){const book=BUILTIN_BOOKS.find(b=>b.id===marketBookId);if(!book)return renderMarket();return `<div class="page-head"><div><h2>${esc(book.name)}</h2><p>${marketBookWords.length} 个单词 · 点击单词查看详情</p></div><div><button class="secondary" data-nav="market">返回词本市场</button></div></div><div class="word-table book-word-table"><div class="table-head"><span>单词</span><span>释义</span><span>英音</span><span>美音</span></div>${marketBookWords.map((w,i)=>`<div class="word-row market-word-row"><button class="word-card-trigger" data-market-word="${i}" title="点击查看单词详情" aria-label="查看 ${esc(w.text)} 的单词详情">${esc(w.text)}</button><span>${esc(w.meaning||'暂无释义')}</span><span>${esc(w.ukPhonetic||'—')}</span><span>${esc(w.usPhonetic||'—')}</span></div>`).join('')}</div>`;}
function renderComingSoon(){return `<div class="coming-soon"><div class="coming-soon-mark">✦</div><h2>刷词练习</h2><p>这个功能正在准备中，敬请期待。</p></div>`;}
function renderBooks() {
  const canLookup=state.words.some(w=>!w.meaning);
  return `<div class="page-head"><div><h2>我的词本</h2><p>${state.bookName?`${esc(state.bookName)} · `:''}${state.words.length} 个词条 · 可编辑释义和英美音标</p></div><div><button class="secondary" data-nav="today">← 返回今日听写</button><button class="secondary" id="lookupWords" ${lookupBusy||!canLookup?'disabled':''}>${lookupBusy?'查询中…':'补全缺失释义'}</button></div></div>
    ${state.words.length ? `<div class="word-table book-word-table"><div class="table-head"><span>单词</span><span>释义</span><span>英音</span><span>美音</span><span>分组</span></div>${state.words.map((w,i)=>`<div class="word-row"><button class="word-card-trigger" data-word-card-book="${i}" title="点击查看单词详情" aria-label="查看 ${esc(w.text)} 的单词详情">${esc(w.text)}</button><input data-edit="${i}" data-field="meaning" value="${esc(w.meaning)}" placeholder="释义"><input data-edit="${i}" data-field="ukPhonetic" value="${esc(w.ukPhonetic)}" placeholder="英音"><input data-edit="${i}" data-field="usPhonetic" value="${esc(w.usPhonetic)}" placeholder="美音"><span>${state.plan?.active ? `第 ${(w.group||0)+1} 份` : '未分组'}</span></div>`).join('')}</div><p class="footnote">词条的英音和美音分别来自词表原始数据或开源发音词典；听写发音由系统英文语音合成。</p>` : `<div class="empty-card"><div>▤</div><b>还没有词本</b><p>请先从“今日任务”选择一本默认词表。</p><button class="primary" data-nav="today">选择词本</button></div>`}`;
}
function renderMistakes() {
  const wrong = wrongEntries();
  const rows = [...wrong.entries()].map(([id, attempts]) => ({ word: state.words.find(w=>w.id===id) || {text:attempts[0].word,meaning:attempts[0].meaning}, attempts })).sort((a,b)=>b.attempts.length-a.attempts.length);
  return `<div class="page-head"><div><h2>错词本</h2><p>累计答错过 ${rows.length} 个词 · 答对后仍保留历史</p></div><span class="pill">${wrong.size} 个错词</span></div>${rows.length?`<div class="word-table mistake-table"><div class="table-head"><span>单词</span><span>释义</span><span>错了几回</span><span>最近错误</span></div>${rows.map((x,i)=>`<button class="word-row mistake-row" data-word-card-mistake="${i}" title="点击查看单词详情"><b class="word-open-label">${esc(x.word.text)} <span aria-hidden="true">↗</span></b><span>${esc(x.word.meaning||'暂无释义')}</span><strong>${x.attempts.length} 次</strong><span>${new Date(Math.max(...x.attempts.map(a=>new Date(a.date).getTime()))).toLocaleDateString()}</span></button>`).join('')}</div><p class="footnote">点开任一单词可查看每次错误的日期和当时输入。</p>`:`<div class="empty-card"><div>✓</div><b>还没有错词</b><p>听写中答错的词会自动记录在这里。</p></div>`}`;
}
function renderHistory() {
  const rows = state.records.slice().reverse();
  return `<div class="page-head"><div><h2>听写记录</h2><p>每次听写完成后保存答题结果</p></div><span class="pill">${completeRecords().length} 次完成</span></div>${rows.length?`<div class="history-list">${rows.map(r=>`<button class="history-row ${r.completedAt?'':'unfinished'}" data-record="${r.id}"><span class="history-icon" title="${r.completedAt?'已完成':'未完成'}" aria-label="${r.completedAt?'已完成':'未完成'}">${r.completedAt?'✓':'◷'}</span><span class="history-main"><b>第 ${r.planDay} 天</b>${r.completedAt?`<small>${new Date(r.completedAt).toLocaleString()}</small>`:''}</span><span class="history-score">${r.completedAt?`<b class="correct">${r.answers.filter(a=>a.correct).length} 对</b><b class="wrong">${r.answers.filter(a=>!a.correct).length} 错</b>`:''}</span><span class="row-arrow">›</span></button>`).join('')}</div>`:`<div class="empty-card"><div>↻</div><b>暂无记录</b><p>完成今日听写后，结果会保存在这里。</p></div>`}`;
}
function renderSettings(){return `<div class="settings-wrap"><section class="settings-card"><div class="settings-icon">⇧</div><div><h3>备份与同步</h3><p>当前数据自动保存在这台电脑上，不依赖浏览器缓存。你可以导出备份文件，换浏览器或清理浏览数据后再恢复。需要在其他设备继续使用时，请先导出并妥善保存备份。</p><button class="primary" id="exportBackup">导出备份文件</button> <button class="secondary" id="importBackup">恢复备份文件</button></div></section></div>`;}
function bindPage() {
    document.querySelectorAll('[data-market-book]').forEach(button=>button.addEventListener('click',()=>openMarketBook(button.dataset.marketBook)));
  document.querySelectorAll('[data-market-word]').forEach(button=>button.addEventListener('click',()=>showWordCard(marketBookWords,Number(button.dataset.marketWord),{context:BUILTIN_BOOKS.find(b=>b.id===marketBookId)?.name||'词本市场'})));
  $('#changeBook')?.addEventListener('click',showBookPicker);
  $('#createPlan')?.addEventListener('click',async()=>{
    const parts=Math.max(1,Math.min(state.words.length,parseInt($('#partInput').value,10)||1));
    state.words.forEach((w,i)=>w.group=Math.min(parts-1,Math.floor(i*parts/state.words.length)));
    state.plan={active:true,parts,day:1,createdAt:new Date().toISOString(),nextDueDate:localDateKey()};calendarMonthKey=null;state.records=[];state.active=null;await save();render();
  });
  $('#partInput')?.addEventListener('input',()=>{const n=Math.max(1,Math.min(state.words.length,parseInt($('#partInput').value,10)||1));$('#createPlan').innerHTML=`生成计划 <span>· 预计 ${3*n+3} 天</span>`;});
  $('#startTask')?.addEventListener('click',startTask);
  $('#advanceEarly')?.addEventListener('click',async()=>{state.plan.nextDueDate=localDateKey();await save();render();});
  $('#calendarPrev')?.addEventListener('click',()=>shiftCalendarMonth(-1));
  $('#calendarNext')?.addEventListener('click',()=>shiftCalendarMonth(1));
  $('#resetPlan')?.addEventListener('click',resetPlan);
  $('#emptyTask')?.addEventListener('click',finishEmptyDay);
  $('#lookupWords')?.addEventListener('click',lookupMissing);
  $('#exportBackup')?.addEventListener('click',exportBackup);
  $('#importBackup')?.addEventListener('click',()=>$('#backupFile').click());
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.nav)));
  document.querySelectorAll('[data-record]').forEach(b=>b.addEventListener('click',()=>showDetails(state.records.find(r=>r.id===b.dataset.record))));
  document.querySelectorAll('[data-word-card-book]').forEach(b=>b.addEventListener('click',()=>showWordCard(state.words,Number(b.dataset.wordCardBook),{context:'我的词本'})));
  document.querySelectorAll('[data-word-card-mistake]').forEach(b=>b.addEventListener('click',()=>showWordCard(getMistakeCardEntries(),Number(b.dataset.wordCardMistake),{context:'错词本'})));
  document.querySelectorAll('[data-edit]').forEach(input=>input.addEventListener('change',async()=>{state.words[Number(input.dataset.edit)][input.dataset.field]=input.value;await save();toast('已保存');}));
}
function shiftCalendarMonth(delta){const [year,month]=calendarMonthKey.split('-').map(Number);const date=new Date(year,month-1+delta,1);calendarMonthKey=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;render();}
function go(page) { selected=page; render(); }
document.querySelectorAll('.primary-nav-item').forEach(button=>button.addEventListener('click',()=>go(button.dataset.section==='memorize'?'today':button.dataset.section==='market'?'market':'familiar')));
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>go(button.dataset.page)));
$('#backupFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const backup=JSON.parse(await f.text());if(!Array.isArray(backup.words)||!Array.isArray(backup.records))throw new Error();if(!confirm('恢复备份会替换当前词本和进度，继续吗？'))return;state=backup;await save();toast('备份已恢复');render();}catch{toast('无法读取这份备份文件');}e.target.value='';});
async function loadBuiltinBook(bookId){
  if(state.plan?.active){toast('请先重置当前计划，再更换词本');return;}
  const selectedBook=BUILTIN_BOOKS.find(book=>book.id===bookId);if(!selectedBook)return;
  if(state.bookId===bookId&&state.words.length){selected='today';render();toast('这本词书已载入');return;}
  if(state.words.length&&!confirm(`切换到“${selectedBook.name}”会替换当前词本及尚未开始的计划，继续吗？`))return;
  try{
    const path=bookId==='ngsl'?'/data/ngsl.json':`/data/books/${bookId}.json`;
    const response=await fetch(path);if(!response.ok)throw new Error('词库读取失败');const book=await response.json();
    let dictionary={},phonetics={};
    if(bookId==='ngsl'){
      const [dictResponse,phoneticResponse]=await Promise.all([fetch('/data/ngsl-dictionary.json'),fetch('/data/ngsl-phonetics.json')]);
      if(dictResponse.ok)dictionary=await dictResponse.json();if(phoneticResponse.ok)phonetics=await phoneticResponse.json();
    }
    state.words=book.words.map(item=>{
      const text=typeof item==='string'?item:item.word,key=text.trim().toLocaleLowerCase(),meaning=typeof item==='string'?dictionary[key]?.translation:item.meaning;
      return {id:uid(),text,meaning:meaning||'',ukPhonetic:(typeof item==='string'?phonetics[key]?.ukPhonetic:item.ukPhonetic)||'',usPhonetic:(typeof item==='string'?phonetics[key]?.usPhonetic:item.usPhonetic)||'',group:0};
    });
    state.bookId=bookId;state.bookName=selectedBook.name;state.plan=null;state.records=[];state.active=null;state.delayDays=0;
    await save();selected='today';render();toast(`已载入“${selectedBook.name}” · ${state.words.length} 个词`);
  }catch{toast('无法读取词库，请重启客户端后重试');}
}
async function openMarketBook(bookId){
  marketBookId=bookId;
  try{
    const response=await fetch(bookId==='ngsl'?'/data/ngsl.json':`/data/books/${bookId}.json`);if(!response.ok)throw new Error();
    const book=await response.json();let dictionary={},phonetics={};
    if(bookId==='ngsl'){const [d,p]=await Promise.all([fetch('/data/ngsl-dictionary.json'),fetch('/data/ngsl-phonetics.json')]);if(d.ok)dictionary=await d.json();if(p.ok)phonetics=await p.json();}
    marketBookWords=book.words.map(item=>{const text=typeof item==='string'?item:item.word,key=text.trim().toLowerCase();return {text,meaning:typeof item==='string'?dictionary[key]?.translation:item.meaning,ukPhonetic:typeof item==='string'?phonetics[key]?.ukPhonetic:item.ukPhonetic,usPhonetic:typeof item==='string'?phonetics[key]?.usPhonetic:item.usPhonetic};});
    selected='marketBook';render();
  }catch{toast('词本读取失败，请稍后重试');}
}
async function lookupMissing(){
  if(lookupBusy)return;lookupBusy=true;render();let found=0;const missing=[];
  try{const response=await fetch('/data/ngsl-dictionary.json');if(response.ok){const dictionary=await response.json();for(const w of state.words){if(w.meaning)continue;const entry=dictionary[w.text.trim().toLowerCase()];if(entry?.translation){w.meaning=entry.translation;found++;}}}}
  catch{}
  for(const w of state.words)if(!w.meaning)missing.push(w);
  let cursor=0;await Promise.all(Array.from({length:Math.min(5,missing.length)},async()=>{while(cursor<missing.length){const w=missing[cursor++];try{const res=await fetch(`/api/dictionary?word=${encodeURIComponent(w.text)}`,{signal:AbortSignal.timeout(9000)});if(!res.ok)continue;const item=await res.json();if(!w.meaning&&item.definition){w.meaning=item.definition;found++;}}catch{}}}));
  await save();lookupBusy=false;render();toast(`补全完成，找到 ${found} 个词的资料`);
}
function speak(word,onDone){clearTimeout(timer);if(!('speechSynthesis'in window)){timer=setTimeout(onDone,0);return;}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(word);utterance.lang='en-US';utterance.rate=0.88;currentSpeech=utterance;utterance.onend=()=>{currentSpeech=null;onDone();};utterance.onerror=()=>{currentSpeech=null;onDone();};speechSynthesis.speak(utterance);}
async function startTask(){
  const tasks=currentTasks();
  if(!state.active||state.active.planDay!==state.plan.day){state.active={planDay:state.plan.day,date:new Date().toISOString().slice(0,10),startedAt:new Date().toISOString(),delayedDays:state.delayDays||0,index:0,answers:[],tasks};}
  await save();openDictation();
}
async function finishEmptyDay(){
  const now=new Date().toISOString();state.records.push({id:uid(),planDay:state.plan.day,startedAt:now,completedAt:now,answers:[]});state.plan.day++;state.plan.nextDueDate=nextDate();state.active=null;await save();render();toast('今日复习已完成');
}
function openDictation(){
  let idx=state.active.index;let remaining=5;let locked=false;
  $('#overlay').innerHTML=`<div class="dictation-modal"><header><div><small>第 ${state.plan.day} 天 · 听写进行中</small><h2>输入你听到的单词</h2></div><button class="icon-button" id="closeStudy">×</button></header><div class="dictation-progress"><i id="dictationProgress"></i></div><div class="dictation-body"><div class="sound-orb"><span>♫</span></div><div class="listen-label" id="listenLabel">正在播放读音…</div><div class="countdown" id="countdown"></div><input id="answerInput" type="text" inputmode="latin" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" data-gramm="false" data-lpignore="true" placeholder="听音输入单词"><div class="dictation-caption" id="dictationCaption"></div></div><footer>倒计时结束会自动提交并进入下一题</footer></div>`;
  $('#overlay').classList.remove('hidden');
  const input=$('#answerInput');
  input.addEventListener('beforeinput',e=>{if(['insertFromPaste','insertFromDrop','insertFromYank','insertReplacementText','insertFromAutoFill'].includes(e.inputType))e.preventDefault();});
  input.addEventListener('paste',e=>e.preventDefault());
  input.addEventListener('drop',e=>e.preventDefault());
  function question(){
    if(idx>=state.active.tasks.length){finishDictation();return;}
    const task=state.active.tasks[idx],word=state.words.find(w=>w.id===task.wordId);if(!word){idx++;question();return;}
    locked=false;remaining=5;input.value='';$('#dictationProgress').style.width=`${(idx/state.active.tasks.length)*100}%`;$('#listenLabel').textContent=task.source;$('#dictationCaption').textContent=`${idx+1} / ${state.active.tasks.length} 题`;
    input.focus();speak(word.text,()=>{if(locked)return;$('#listenLabel').textContent='读音已播放';$('#countdown').textContent='5';const start=Date.now();timer=setInterval(()=>{remaining=Math.max(0,5-Math.floor((Date.now()-start)/1000));$('#countdown').textContent=String(remaining);if(Date.now()-start>=5000){clearInterval(timer);submit();}},100);});
  }
  async function submit(){if(locked)return;locked=true;clearInterval(timer);const task=state.active.tasks[idx],word=state.words.find(w=>w.id===task.wordId);if(!word){idx++;question();return;}const user=input.value.trim();const answer={id:uid(),wordId:word.id,word:word.text,meaning:word.meaning||'',userAnswer:user,correctAnswer:word.text,correct:user.toLowerCase()===word.text.trim().toLowerCase(),source:task.source,planDay:state.plan.day,date:new Date().toISOString()};state.active.answers.push(answer);idx++;state.active.index=idx;await save();question();}
  function finishDictation(){clearInterval(timer);window.speechSynthesis?.cancel();const now=new Date().toISOString();const record={id:uid(),planDay:state.plan.day,startedAt:state.active.startedAt,completedAt:now,answers:state.active.answers};state.records.push(record);state.plan.day++;state.plan.nextDueDate=nextDate();state.active=null;save().then(()=>{todayTasks=currentTasks();$('#overlay').innerHTML=`<div class="result-modal"><div class="done-mark">✓</div><div class="eyebrow">TASK COMPLETED</div><h2>听写完成</h2><p class="result-score"><b>${record.answers.filter(a=>a.correct).length}</b> 正确 <span>·</span> <b class="wrong-count">${record.answers.filter(a=>!a.correct).length}</b> 错误</p><button class="primary big" id="resultDetail">查看详情</button><button class="quiet-link" id="closeResult">返回今日任务</button></div>`;$('#resultDetail').addEventListener('click',()=>{hideOverlay();showDetails(record);});$('#closeResult').addEventListener('click',()=>{hideOverlay();render();});});}
  function hideOverlay(){clearInterval(timer);speechSynthesis?.cancel();$('#overlay').classList.add('hidden');$('#overlay').innerHTML='';render();}
  $('#closeStudy').addEventListener('click',()=>{clearInterval(timer);window.speechSynthesis?.cancel();$('#overlay').classList.add('hidden');$('#overlay').innerHTML='';});
  $('#overlay').onclick=e=>{if(e.target.id==='overlay'){clearInterval(timer);window.speechSynthesis?.cancel();$('#overlay').classList.add('hidden');$('#overlay').innerHTML='';}};
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();}});
  question();
}
function getMistakeCardEntries(){
  const wrong=wrongEntries();
  return [...wrong.entries()].map(([id,attempts])=>{
    const word=state.words.find(w=>w.id===id)||{text:attempts[0].word,meaning:attempts[0].meaning};
    return {...word,text:word.text||attempts[0].word,attempts};
  }).sort((a,b)=>(b.attempts?.length||0)-(a.attempts?.length||0));
}
function showWordCard(words,index,{context='单词详情',onClose=null}={}){
  if(!words?.length)return;
  let current=Math.max(0,Math.min(words.length-1,index));
  const handleKeys=e=>{if(e.key==='ArrowUp'){e.preventDefault();if(current>0){current--;paint();}}else if(e.key==='ArrowDown'){e.preventDefault();if(current<words.length-1){current++;paint();}}else if(e.key==='Escape')close();};
  const close=()=>{document.removeEventListener('keydown',handleKeys);window.speechSynthesis?.cancel();currentSpeech=null;$('#overlay').classList.add('hidden');$('#overlay').innerHTML='';if(onClose)onClose();};
  const speakCurrent=word=>{
    window.speechSynthesis?.cancel();currentSpeech=null;
    if(!('speechSynthesis'in window))return;
    const utterance=new SpeechSynthesisUtterance(word);utterance.lang='en-US';utterance.rate=.88;currentSpeech=utterance;
    utterance.onend=utterance.onerror=()=>{if(currentSpeech===utterance)currentSpeech=null;};window.speechSynthesis.speak(utterance);
  };
  const paint=()=>{
    const item=words[current], text=item.text||item.word||'', attempts=item.attempts||[];
    $('#overlay').innerHTML=`<div class="word-card-modal"><header><div><small>${esc(context)} · ${current+1} / ${words.length}</small><h2>单词详情</h2></div><button class="secondary detail-back-button" id="closeWordCard">← 返回</button></header><div class="word-card-body"><div class="word-card-wordline"><h3>${esc(text)}</h3><button class="secondary word-card-play" id="replayWord" title="再读一遍">♫ 再读一遍</button></div><div class="word-card-pronunciations"><div><small>英音</small><b>${esc(item.ukPhonetic||'暂无音标')}</b></div><div><small>美音</small><b>${esc(item.usPhonetic||'暂无音标')}</b></div></div><section class="word-card-meaning"><small>释义</small><p>${esc(item.meaning||'暂无释义')}</p></section>${attempts.length?`<section class="word-card-history"><small>错词记录 · 共 ${attempts.length} 次</small>${attempts.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(a=>`<div class="word-card-attempt"><span>${new Date(a.date).toLocaleString()}</span><span>输入 <b class="wrong">${esc(a.userAnswer||'（空）')}</b></span><span>正确答案 <b>${esc(a.correctAnswer||text)}</b></span></div>`).join('')}</section>`:''}</div><footer class="word-card-nav"><button class="secondary" id="previousWord" ${current===0?'disabled':''}>← 上一个</button><span>${esc(context)}中的单词</span><button class="secondary" id="nextWord" ${current===words.length-1?'disabled':''}>下一个 →</button></footer></div>`;
    $('#overlay').classList.remove('hidden');
    document.removeEventListener('keydown',handleKeys);document.addEventListener('keydown',handleKeys);
    $('#closeWordCard').onclick=close;$('#replayWord').onclick=()=>speakCurrent(text);
    $('#previousWord').onclick=()=>{if(current>0){current--;paint();}};
    $('#nextWord').onclick=()=>{if(current<words.length-1){current++;paint();}};
    $('#overlay').onclick=e=>{if(e.target.id==='overlay')close();};
    speakCurrent(text);
  };
  paint();
}
function showDetails(record){
  if(!record)return;let filter=false;
  const paint=()=>{
    const answers=filter?record.answers.filter(a=>!a.correct):record.answers;
    $('#overlay').innerHTML=`<div class="detail-modal"><header><div><small>听写详情</small><h2>第 ${record.planDay} 天</h2><p>${record.completedAt?new Date(record.completedAt).toLocaleString():''} · ${record.answers.filter(a=>a.correct).length} 对 · ${record.answers.filter(a=>!a.correct).length} 错</p></div><button class="secondary detail-back-button" id="closeDetail">← 返回今日听写</button></header><div class="detail-filters"><button class="filter-button ${!filter?'selected':''}" data-filter="all">今日全部</button><button class="filter-button ${filter?'selected':''}" data-filter="wrong">只看错题</button></div><div class="answer-list">${answers.map((a,i)=>`<article class="answer-item"><div class="answer-head"><button class="inline-word-link" data-answer-word="${i}" title="点击查看单词详情">${esc(a.word)}</button><span class="${a.correct?'correct':'wrong'}">${a.correct?'正确':'错误'}</span><small>${esc(a.source)}</small></div><p>${esc(a.meaning||'暂无释义')}</p><div class="answer-values"><span>你的输入 <b class="${a.correct?'correct':'wrong'}">${esc(a.userAnswer||'（空）')}</b></span><span>正确答案 <b>${esc(a.correctAnswer)}</b></span></div></article>`).join('')||'<div class="empty-inline">没有符合条件的题目</div>'}</div></div>`;
    $('#overlay').classList.remove('hidden');$('#closeDetail').onclick=hide;$('#overlay').onclick=e=>{if(e.target.id==='overlay')hide();};
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter==='wrong';paint();});
    document.querySelectorAll('[data-answer-word]').forEach(b=>b.onclick=()=>{const list=answers.map(a=>{const entry=state.words.find(w=>w.text.toLowerCase()===String(a.word).toLowerCase())||{};return {...entry,text:a.word,meaning:a.meaning||entry.meaning,correctAnswer:a.correctAnswer,userAnswer:a.userAnswer,correct:a.correct,source:a.source};});showWordCard(list,Number(b.dataset.answerWord),{context:'听写详情',onClose:paint});});
  };
  const hide=()=>{$('#overlay').classList.add('hidden');$('#overlay').innerHTML='';};paint();
}
function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`猛猛背单词-备份-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);}
function resetPlan(){if(!confirm('重置计划会清除当前计划的听写记录与错词记录，词书会保留。确定继续吗？'))return;calendarMonthKey=null;state.plan=null;state.records=[];state.active=null;save().then(render);}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.add('hidden'),2600);}
load().catch(()=>{$('#content').innerHTML='<div class="empty-card"><b>无法连接本地客户端</b><p>请关闭并重新打开 run.command。</p></div>';});
