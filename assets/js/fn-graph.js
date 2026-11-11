/* 原生 SVG 绘图。不会读取或修改题卡的题干、答案、视频及其它内容。 */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const DATA=()=>window.FN_GRAPH_DATA||{};
  const cache=new WeakMap();
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const E=(tag,attrs={},parent)=>{
    const el=document.createElementNS(NS,tag);
    for(const [key,value] of Object.entries(attrs))if(value!==undefined&&value!==null)el.setAttribute(key,String(value));
    if(parent)parent.append(el);
    return el;
  };
  const H=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const n=(v,p,s)=>typeof v==='function'?v(p,s):v;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const idstr=(s)=>String(s).replace(/[^\w-]/g,'_');
  function graph(svg,view,param,step,prefix){
    const W=720,HT=350,M={l:49,r:28,t:28,b:39}, b=view.bounds;
    const sx=x=>M.l+(x-b[0])/(b[1]-b[0])*(W-M.l-M.r);
    const sy=y=>HT-M.b-(y-b[2])/(b[3]-b[2])*(HT-M.t-M.b);
    svg.setAttribute('viewBox',`0 0 ${W} ${HT}`);
    svg.setAttribute('role','img');
    const defs=E('defs',{},svg),cp=E('clipPath',{id:prefix},defs);
    E('rect',{x:M.l,y:M.t,width:W-M.l-M.r,height:HT-M.t-M.b},cp);
    const rect=E('rect',{x:0,y:0,width:W,height:HT,fill:'transparent'},svg);
    const grid=E('g',{},svg), content=E('g',{'clip-path':`url(#${prefix})`},svg),front=E('g',{},svg);
    const nice=(extent)=>{const raw=extent/6,pow=10**Math.floor(Math.log10(raw));const z=raw/pow;return (z<=1?1:z<=2?2:z<=5?5:10)*pow;};
    const dx=nice(b[1]-b[0]),dy=nice(b[3]-b[2]);
    for(let x=Math.ceil(b[0]/dx)*dx;x<=b[1]+1e-7;x+=dx){let z=sx(x);E('line',{x1:z,x2:z,y1:M.t,y2:HT-M.b,class:'fn-graph__grid'},grid);}
    for(let y=Math.ceil(b[2]/dy)*dy;y<=b[3]+1e-7;y+=dy){let z=sy(y);E('line',{x1:M.l,x2:W-M.r,y1:z,y2:z,class:'fn-graph__grid'},grid);}
    if(b[2]<=0&&b[3]>=0)E('line',{x1:M.l,x2:W-M.r,y1:sy(0),y2:sy(0),class:'fn-graph__axis'},grid);
    if(b[0]<=0&&b[1]>=0)E('line',{x1:sx(0),x2:sx(0),y1:M.t,y2:HT-M.b,class:'fn-graph__axis'},grid);
    for(const c of (view.bands||[]))if(step>=(c.stage||0)){
      const x1=sx(n(c.x1,param,step)),x2=sx(n(c.x2,param,step));
      E('rect',{x:Math.min(x1,x2),y:M.t,width:Math.abs(x2-x1),height:HT-M.t-M.b,fill:'#dceafa',opacity:'.42'},content);
    }
    function label(x,y,txt,alt=false){if(!txt)return;let px=clamp(x+9,M.l+4,W-M.r-8),py=clamp(y-10,M.t+14,HT-M.b-5);const t=E('text',{x:px,y:py,class:'fn-graph__label',fill:alt?'#98664e':undefined},front);t.textContent=txt;}
    for(const l of view.lines||[]){if(step<(l.stage||0)||l.when&&!l.when(param))continue;
      const v=n(l.value,param,step);if(!Number.isFinite(v))continue;
      const a=l.axis==='x', z=a?sx(v):sy(v);
      E('line',a?{x1:z,x2:z,y1:M.t,y2:HT-M.b,class:'fn-graph__asymptote'}:{x1:M.l,x2:W-M.r,y1:z,y2:z,class:'fn-graph__asymptote'},content);
      label(a?z:W-M.r-75,a?M.t+22:z,l.label,!!l.alt);
    }
    for(const c of view.curves||[]){if(step<(c.stage||0)||c.when&&!c.when(param))continue;
      const segments=c.domain||[[b[0],b[1]]];
      for(const [lo,hi] of segments){
        const count=c.samples||Math.max(260,Math.round(520*(hi-lo)/(b[1]-b[0])));
        let path='',last=null;
        for(let i=0;i<=count;i++){
          const x=lo+(hi-lo)*i/count,y=c.fn(x,param);
          if(!Number.isFinite(y)||Math.abs(y)>1e8){last=null;continue;}
          const px=sx(x),py=sy(y);
          if(last&&Math.abs(py-last[1])>650){path+=' ';last=null;}
          path+=(last?'L':'M')+px.toFixed(2)+' '+py.toFixed(2)+' ';
          last=[px,py];
        }
        E('path',{d:path,class:'fn-graph__curve'+(c.alt?' fn-graph__curve--alt':'')+(c.secondary?' fn-graph__curve--secondary':'')},content);
      }
    }
    for(const bar of view.bars||[]){if(step<(bar.stage||0))continue;
      const x=sx(n(bar.x,param,step));E('line',{x1:x,x2:x,y1:sy(n(bar.y1,param,step)),y2:sy(n(bar.y2,param,step)),stroke:'#b17a5e','stroke-width':3,'stroke-dasharray':bar.dashed?'5 5':undefined,'vector-effect':'non-scaling-stroke'},content);
    }
    if(view.extrema&&step>0){
      // 极值通过对本图已给示意曲线采样得到，图上只标“最高点/最低点”，不写题目未给出的坐标。
      const c=(view.curves||[])[0];
      const segs=c&&c.domain?c.domain:[[b[0],b[1]]];
      let min=null,max=null;
      for(const [lo,hi] of segs){
        for(let i=0;i<=300;i++){
          const x=lo+(hi-lo)*i/300,y=c.fn(x,param);
          if(!Number.isFinite(y))continue;
          if(!min||y<min[1])min=[x,y];
          if(!max||y>max[1])max=[x,y];
        }
      }
      for(const [p,t] of [[min,'最低点'],[max,'最高点']]){
        if(!p)continue;
        E('circle',{cx:sx(p[0]),cy:sy(p[1]),r:5,class:'fn-graph__point fn-graph__point--filled'},front);
        label(sx(p[0]),sy(p[1]),t);
      }
    }
    const points=(view.points||[]).filter(p=>step>=(p.stage||0)&&(!p.when||p.when(param)));
    for(const p of points){
      if(p.open&&points.some(q=>!q.open&&Math.abs(n(p.x,param,step)-n(q.x,param,step))<1e-8&&Math.abs(n(p.y,param,step)-n(q.y,param,step))<1e-8))continue;
      const x=sx(n(p.x,param,step)),y=sy(n(p.y,param,step));
      E('circle',{cx:x,cy:y,r:6.2,class:'fn-graph__point '+(p.open?'fn-graph__point--open':'fn-graph__point--filled')+(p.alt?' fn-graph__point--alt':'')},front);
      label(x,y,p.label,!!p.alt);
    }
    for(const p of view.moving||[]){const x=n(p.x,param,step),y=n(p.y,param,step);E('circle',{cx:sx(x),cy:sy(y),r:5.5,fill:'#b17a5e'},front);}
    E('text',{x:W-M.r-4,y:sy(0)-8,class:'fn-graph__label','text-anchor':'end'},front).textContent='x';
    E('text',{x:sx(0)+10,y:M.t+12,class:'fn-graph__label'},front).textContent='y';
  }
  function numberGraph(svg,def,step){
    svg.setAttribute('viewBox','0 0 720 132');svg.setAttribute('role','img');
    const s=x=>48+(x+4)/8*624;
    E('line',{x1:48,x2:672,y1:67,y2:67,class:'fn-graph__axis'},svg);
    for(const [a,b] of def.intervals){E('line',{x1:s(a)+7,x2:s(b)-7,y1:67,y2:67,stroke:'#3976ae','stroke-width':7,'stroke-linecap':'round'},svg);}
    for(let i=0;i<def.marks.length;i++){
      let x=s(def.marks[i]);E('circle',{cx:x,cy:67,r:7,fill:'#fff',stroke:'#3976ae','stroke-width':2.3},svg);
      const t=E('text',{x,y:99,'text-anchor':'middle',class:'fn-graph__label'},svg);t.textContent=def.labels[i];
    }
    if(step>0){const t=E('text',{x:360,y:26,'text-anchor':'middle',class:'fn-graph__label'},svg);t.textContent='ln(u²)=2ln|u|，u≠0';}
  }
  function init(el){if(cache.has(el))return;const key=el.getAttribute('data-q'),def=DATA()[key];if(!def)return;
    let step=0,param=def.param?{[def.param.name]:def.param.value}:{},timer=null;
    const shell=H('div','fn-graph__shell'),plots=H('div','fn-graph__plots'),caption=H('div','fn-graph__caption'),controls=H('div','fn-graph__control');
    caption.setAttribute('aria-live','polite');caption.setAttribute('aria-atomic','true');
    shell.append(plots,caption,controls);el.append(shell);
    const button=(txt,label,handler)=>{const b=H('button','fn-graph__button',txt);b.type='button';b.setAttribute('aria-label',label);b.addEventListener('click',handler);controls.append(b);return b;};
    const progress=H('span','fn-graph__step');controls.append(progress);
    let next,play;
    const stop=()=>{if(timer!==null){clearInterval(timer);timer=null;}if(play)play.textContent='播放';};
    const update=()=>{
      plots.replaceChildren();plots.style.setProperty('--fg-cols',String(def.views?.length||1));
      if(def.mode==='flow'){
        const row=H('div','fn-graph__flow');for(let i=0;i<def.nodes.length;i++){
          if(i)row.append(H('span','fn-graph__flow-arrow','→'));
          row.append(H('span','fn-graph__flow-node'+(i===step?' is-active':''),def.nodes[i]));
        }plots.append(row);
      }else if(def.mode==='number'){
        const svg=E('svg',{class:'fn-graph__number',viewBox:'0 0 720 132','aria-label':key+'：数轴连续区间'});numberGraph(svg,def,step);plots.append(svg);
      }else for(let i=0;i<def.views.length;i++){
        const panel=H('div','fn-graph__panel'),lab=key+'：函数图像 '+(i+1),svg=E('svg',{class:'fn-graph__view',role:'img','aria-label':lab});
        const ti=E('title',{},svg);ti.textContent=lab;
        graph(svg,def.views[i],param,step,`fnclip_${idstr(key)}_${i}_${Math.random().toString(36).slice(2,8)}`);
        panel.append(svg);plots.append(panel);
      }
      const text=def.steps[Math.min(step,def.steps.length-1)];caption.textContent=text;
      progress.textContent=(step+1)+' / '+def.steps.length;
      next.textContent=step===def.steps.length-1?'重播':'下一步';
    };
    next=button('下一步','下一步解题图像',()=>{stop();step=(step+1)%def.steps.length;update();});
    play=button('播放','播放分步动画',()=>{
      if(timer!==null){stop();return;}
      if(reduced()){step=(step+1)%def.steps.length;update();return;}
      step=0;update();play.textContent='暂停';
      timer=setInterval(()=>{if(step+1>=def.steps.length){stop();return;}step++;update();},1250);
    });
    if(def.param){
      const wrap=H('label','fn-graph__parameter');wrap.append(H('span','',def.param.name));
      const slider=H('input','fn-graph__range');slider.type='range';slider.min=def.param.min;slider.max=def.param.max;slider.step=def.param.step;slider.value=def.param.value;slider.setAttribute('aria-label','参数 '+def.param.name);
      const out=H('output','fn-graph__value',String(def.param.value));
      slider.addEventListener('input',()=>{stop();param[def.param.name]=Number(slider.value);out.textContent=String(Number(slider.value));update();});
      wrap.append(slider,out);controls.append(wrap);
    }
    if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',key+' 的函数图像');
    cache.set(el,{update,stop});update();
  }
  let observer;
  function scan(root=document){
    if(!observer&&'IntersectionObserver'in window){observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);init(e.target);}}, {rootMargin:'180px'});}
    const closed=el=>el.closest&&el.closest('details:not([open])');
    const nodes=(root.matches&&root.matches('.fn-graph[data-q]')?[root]:[]).concat([...root.querySelectorAll('.fn-graph[data-q]')]);
    for(const el of nodes)if(!cache.has(el)&&!closed(el)){if(observer)observer.observe(el);else init(el);}
  }
  const watch=new MutationObserver(list=>{for(const m of list)for(const node of m.addedNodes)if(node.nodeType===1)scan(node);});
  function start(){scan();watch.observe(document.body,{childList:true,subtree:true});document.addEventListener('toggle',e=>{if(e.target.matches('details')&&e.target.open)scan(e.target)},true);}
  window.FNGraph={scan,renderAll:()=>{document.querySelectorAll('.fn-graph[data-q]').forEach(el=>{observer?.unobserve(el);init(el);});}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
