const input=document.querySelector('#zsb-search');
const form=document.querySelector('#zsb-search-form');
const status=document.querySelector('#zsb-search-status');
const list=document.querySelector('#zsb-search-results');
let pagefind,serial=0;
const params=new URLSearchParams(location.search);
input.value=params.get('q')||'';
async function loadIndex(){
  if(!pagefind){pagefind=await import('../../pagefind/pagefind.js');await pagefind.options({baseUrl:new URL('../../',import.meta.url).pathname});await pagefind.init();}
  return pagefind;
}
// 构建时补的“<section id>-h”标题锚点 → 跳到 section 本身（页面目录用的同一锚点，带顶栏留白）。
function itemLink(url){const a=document.createElement('a');a.className='zsb-result';a.href=String(url).replace(/#([^#]+)-h$/,'#$1');return a;}
function addResult(data,part){
  const a=itemLink(part?.url||data.url);
  const h=document.createElement('h2');h.textContent=part?.title||data.meta?.title||'课程';
  const p=document.createElement('p');p.textContent=part?.excerpt?.replace(/<[^>]*>/g,'')||data.plain_excerpt||'';
  a.append(h,p);list.append(a);
}
async function search(q){
  const ticket=++serial;list.replaceChildren();
  const u=new URL(location.href);if(q)u.searchParams.set('q',q);else u.searchParams.delete('q');history.replaceState(null,'',u);
  if(!q.trim()){status.textContent='';return;}
  status.textContent='搜索中…';
  try{
    const engine=await loadIndex();const result=await engine.search(q.trim());
    const raw=await Promise.all(result.results.slice(0,25).map(r=>r.data()));
    if(ticket!==serial)return;
    for(const entry of raw){const subs=[...(entry.sub_results||[])].sort((a,b)=>(b.weighted_locations?.length||b.locations?.length||0)-(a.weighted_locations?.length||a.locations?.length||0)).slice(0,3);if(subs.length){for(const sub of subs)addResult(entry,sub);}else addResult(entry);}
    status.textContent=result.results.length?`找到 ${result.results.length} 个匹配页面`:'没有找到相关课程';
  }catch(error){if(ticket===serial)status.textContent='搜索暂不可用，请稍后重试';console.error('Pagefind search failed',error);}
}
form.addEventListener('submit',e=>{e.preventDefault();search(input.value)});
if(input.value)search(input.value);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();input.focus();}if(e.key==='Escape'&&document.activeElement===input)input.blur();});
