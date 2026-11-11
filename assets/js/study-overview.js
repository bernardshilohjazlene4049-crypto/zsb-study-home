/* Adapter contract: window.ZSBStudyAdapter.getSnapshot() ->
 {subjects:[{id,title,completed,total,url}], activity:[{date:'YYYY-MM-DD',count}],
 reviews:[{id,title,dueAt,url}], lastVisited:{title,url}|null, today?:'YYYY-MM-DD'}.
 Data must be supplied by the existing /study IndexedDB store; never synthesize progress. */
const $=s=>document.querySelector(s);
const text=(node,val)=>{node.textContent=String(val)};
const localDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const addDays=(date,n)=>{const copy=new Date(date+'T12:00:00');copy.setDate(copy.getDate()+n);return localDay(copy)};
const dateKey=v=>{if(typeof v!=='string')return '';return /^\d{4}-\d\d-\d\d$/.test(v)?v:localDay(new Date(v))};
function streak(days,today){let cur=days.has(today)?today:addDays(today,-1);let n=0;while(days.has(cur)&&n<20000){n++;cur=addDays(cur,-1)}return n}
function render(snapshot){
 const subjects=Array.isArray(snapshot.subjects)?snapshot.subjects:[];
 const activity=Array.isArray(snapshot.activity)?snapshot.activity:[];
 const reviews=Array.isArray(snapshot.reviews)?snapshot.reviews:[];
 const today=snapshot.today||localDay();
 const counts=new Map();for(const a of activity){if(a.count>0&&dateKey(a.date))counts.set(dateKey(a.date),(counts.get(dateKey(a.date))||0)+Number(a.count))}
 const due=reviews.filter(x=>x.dueAt&&dateKey(x.dueAt)<=today).sort((a,b)=>String(a.dueAt).localeCompare(String(b.dueAt)));
 text($('#zsb-due-count'),due.length);text($('#zsb-streak-count'),streak(new Set(counts.keys()),today));text($('#zsb-subject-count'),subjects.filter(x=>x.total>0&&x.completed===x.total).length+' / '+subjects.length);
 const continuation=$('#zsb-continue');continuation.replaceChildren();if(snapshot.lastVisited?.url){const a=document.createElement('a');a.className='zsb-btn zsb-btn--primary';a.href=snapshot.lastVisited.url;a.textContent='继续：'+snapshot.lastVisited.title;continuation.append(a)}
 const subjectsNode=$('#zsb-subjects');subjectsNode.replaceChildren();for(const s of subjects){const block=document.createElement('div');block.className='zsb-subject';const h=document.createElement('h3');h.textContent=s.title;const n=document.createElement('span');n.className='zsb-muted';n.textContent=`${s.completed} / ${s.total}`;const bar=document.createElement('progress');bar.max=Math.max(1,s.total);bar.value=Math.min(Math.max(0,s.completed),bar.max);bar.setAttribute('aria-label',s.title+'完成进度');block.append(h,n,bar);subjectsNode.append(block)}if(!subjects.length)text(subjectsNode,'尚无课程进度');
 const heat=$('#zsb-heatmap');heat.replaceChildren();let active=0;for(let i=29;i>=0;i--){const day=addDays(today,-i);const c=counts.get(day)||0;if(c)active++;const mark=document.createElement('span');mark.className='zsb-day';mark.dataset.level=String(c===0?0:c===1?1:c<4?2:c<8?3:4);mark.title=`${day} · ${c} 次学习记录`;mark.setAttribute('aria-label',mark.title);heat.append(mark)}text($('#zsb-activity-text'),`近 30 天学习 ${active} 天`);
 const queue=$('#zsb-due-list');queue.replaceChildren();for(const r of due.slice(0,20)){const li=document.createElement('li');const a=document.createElement('a');a.href=r.url||'./';a.textContent=r.title||'复习题';const time=document.createElement('span');time.className='zsb-muted';time.textContent=dateKey(r.dueAt);li.append(a,time);queue.append(li)}if(!due.length){const li=document.createElement('li');li.textContent='今天没有到期的复习';queue.append(li)}
}
function showStats(on){for(const el of document.querySelectorAll('[data-zsb-stats]'))el.hidden=!on}
async function start(){const node=$('#zsb-overview-status');showStats(false);try{const adapter=window.ZSBStudyAdapter;if(!adapter||typeof adapter.getSnapshot!=='function'){node.textContent='无法读取学习记录';return}const result=await adapter.getSnapshot()||{};if(result.hasRecords===false){node.textContent='尚无学习记录';return}render(result);showStats(true);node.textContent=''}catch(error){console.error(error);node.textContent='无法读取学习记录'}}
start();
