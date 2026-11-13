/* Shared lecture controls. No dependencies. Load after existing caption scripts or with defer. */
(function () {
  'use strict';
  const STORAGE = 'zsb-lecture-rate-v1';
  const SELECTOR = 'video:not([data-zlp-skip])';
  const ICONS = {
    play:'<path d="m8 5 11 7-11 7z"/>', pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    sound:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9a5 5 0 0 1 0 6"/>', mute:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/>',
    cc:'<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M11 10a2 2 0 1 0 0 4M19 10a2 2 0 1 0 0 4"/>',
    full:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>', close:'<path d="M8 8 16 16M16 8l-8 8"/>'
  };
  const players = new WeakMap();
  let sharedRate = readRate();
  function readRate(){try{const n=Number(localStorage.getItem(STORAGE));return n>=.5&&n<=3?n:1}catch{return 1}}
  function writeRate(n){sharedRate=n;try{localStorage.setItem(STORAGE,String(n))}catch{} }
  function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`}
  function button(cls,label,content){const b=document.createElement('button');b.type='button';b.className='zlp__icon '+cls;b.setAttribute('aria-label',label);b.innerHTML=content;return b}
  function clock(sec){if(!Number.isFinite(sec)||sec<0)return '0:00';sec=Math.floor(sec);return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
  function enhance(video){
    if(players.has(video)||!video.isConnected||video.closest('[data-zlp-ignore], .zsb-video:not(:has(video))'))return;
    if(video.closest('pre,code,template')||video.getAttribute('data-zlp-skip')!==null)return;
    const parent=video.parentNode;if(!parent)return;
    if(parent.classList?.contains('zsb-video'))parent.classList.add('zlp--facade-active');
    const wasPlaying=!video.paused&&!video.ended;
    const host=document.createElement('div');host.className='zlp zlp--idle';host.dataset.zlpEnhanced='';
    const screen=document.createElement('div');screen.className='zlp__screen';parent.insertBefore(host,video);host.append(screen);screen.append(video);
    video.controls=false;video.removeAttribute('controls');video.playsInline=true;video.setAttribute('playsinline','');
    video.setAttribute('tabindex','0');video.setAttribute('aria-label',video.getAttribute('aria-label')||'讲解视频');
    // Existing site scripts can insert <track> after the video has been mounted.
    let timer=null, pointerOver=false, menuOpen=false, seeking=false;
    const center=button('zlp__center','播放',icon('play'));screen.append(center);
    const controls=document.createElement('div');controls.className='zlp__controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','视频播放控件');
    const toggle=button('zlp__toggle','播放',icon('play'));
    const time=document.createElement('span');time.className='zlp__time';time.textContent='0:00 / 0:00';
    const seek=document.createElement('input');seek.className='zlp__seek';seek.type='range';seek.min='0';seek.max='1000';seek.value='0';seek.setAttribute('aria-label','播放进度');
    const mute=button('zlp__mute','静音',icon('sound'));
    const volume=document.createElement('input');volume.className='zlp__volume';volume.type='range';volume.min='0';volume.max='1';volume.step='.05';volume.value='1';volume.setAttribute('aria-label','音量');
    const captions=button('zlp__captions','开启中文字幕',icon('cc'));captions.setAttribute('aria-pressed','false');
    const speedButton=button('zlp__speed-button','播放倍速',`${sharedRate}×`);speedButton.setAttribute('aria-expanded','false');
    const full=button('zlp__full','全屏',icon('full'));
    controls.append(toggle,time,seek,mute,volume,captions,speedButton,full);host.append(controls);
    const panel=document.createElement('div');panel.className='zlp__speed';panel.setAttribute('role','group');panel.setAttribute('aria-label','倍速');
    const rates=document.createElement('div');rates.className='zlp__rates';
    const choices=[.5,.75,1,1.25,1.5,2];
    for(const value of choices){const b=document.createElement('button');b.type='button';b.className='zlp__rate';b.textContent=`${value}×`;b.setAttribute('aria-pressed',String(value===sharedRate));b.addEventListener('click',()=>setRate(value,true));rates.append(b)}
    const label=document.createElement('label');label.className='zlp__rate-label';label.textContent='自定义倍速';
    const row=document.createElement('div');row.className='zlp__custom-row';
    const custom=document.createElement('input');custom.className='zlp__custom';custom.type='number';custom.min='.5';custom.max='3';custom.step='.05';custom.inputMode='decimal';custom.value=String(sharedRate);custom.id=`zlp-custom-${++enhance.count}`;label.htmlFor=custom.id;
    const apply=document.createElement('button');apply.className='zlp__apply';apply.type='button';apply.textContent='应用';row.append(custom,apply);panel.append(rates,label,row);host.append(panel);
    const announcer=document.createElement('span');announcer.className='zlp__hidden';announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');host.append(announcer);
    function setRate(n,commit){n=Number(n);if(!Number.isFinite(n)||n<.5||n>3){custom.setCustomValidity('请输入 0.5 到 3 之间的数字');custom.reportValidity();return}custom.setCustomValidity('');video.playbackRate=n;speedButton.textContent=`${Number(n.toFixed(2))}×`;custom.value=String(Number(n.toFixed(2)));rates.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.textContent.replace('×',''))===n)));if(commit){writeRate(n);document.querySelectorAll('.zlp__speed-button').forEach(b=>b.textContent=`${Number(n.toFixed(2))}×`);document.querySelectorAll('.zlp video').forEach(v=>{if(v!==video)v.playbackRate=n});announcer.textContent=`${n} 倍速`}closeMenu();show()}
    function syncCaptions(){const t=[...video.textTracks].find(t=>t.kind==='captions'||t.kind==='subtitles');const enabled=!!t&&t.mode==='showing';captions.disabled=!t;captions.setAttribute('aria-pressed',String(enabled));captions.setAttribute('aria-label',enabled?'关闭中文字幕':'开启中文字幕');captions.style.opacity=t?'1':'.45';return t}
    function sync(){const playing=!video.paused&&!video.ended;host.classList.toggle('zlp--playing',playing);host.classList.toggle('zlp--idle',!playing);toggle.innerHTML=icon(playing?'pause':'play');toggle.setAttribute('aria-label',playing?'暂停':'播放');center.innerHTML=icon('play');center.setAttribute('aria-label','播放');const d=video.duration;time.textContent=`${clock(video.currentTime)} / ${Number.isFinite(d)?clock(d):'0:00'}`;if(!seeking)seek.value=Number.isFinite(d)&&d>0?String(Math.round(video.currentTime/d*1000)):'0';seek.disabled=!(Number.isFinite(d)&&d>0);seek.setAttribute('aria-valuetext',clock(video.currentTime));mute.innerHTML=icon(video.muted||video.volume===0?'mute':'sound');mute.setAttribute('aria-label',video.muted?'取消静音':'静音');volume.value=String(video.volume);syncCaptions()}
    function show(){host.classList.add('zlp--show');clearTimeout(timer);if(!menuOpen&&!(host.classList.contains('zlp--keyboard')&&host.matches(':focus-within')))timer=setTimeout(()=>{if(!(host.classList.contains('zlp--keyboard')&&host.matches(':focus-within'))&&!menuOpen&&!pointerOver)host.classList.remove('zlp--show')},2600)}
    function hideLater(){pointerOver=false;clearTimeout(timer);if(!menuOpen&&!(host.classList.contains('zlp--keyboard')&&host.matches(':focus-within')))timer=setTimeout(()=>host.classList.remove('zlp--show'),950)}
    function closeMenu(){menuOpen=false;host.classList.remove('zlp--menu');speedButton.setAttribute('aria-expanded','false')}
    function togglePlayback(){if(video.paused||video.ended)video.play().catch(()=>{});else video.pause();show()}
    center.addEventListener('click',e=>{e.stopPropagation();togglePlayback()});toggle.addEventListener('click',togglePlayback);
    // Tapping blank video toggles; keyboard focus on the video supports Space/K.
    video.addEventListener('click',()=>{if(menuOpen){closeMenu();return}togglePlayback()});
    video.addEventListener('keydown',e=>{if([' ','k','K','ArrowLeft','ArrowRight','m','M','c','C','f','F'].includes(e.key)){e.preventDefault();if(e.key===' '||e.key.toLowerCase()==='k')togglePlayback();else if(e.key==='ArrowLeft')video.currentTime=Math.max(0,video.currentTime-5);else if(e.key==='ArrowRight')video.currentTime=Math.min(video.duration||Infinity,video.currentTime+5);else if(e.key.toLowerCase()==='m')mute.click();else if(e.key.toLowerCase()==='c')captions.click();else if(e.key.toLowerCase()==='f')full.click();show()}});
    seek.addEventListener('input',()=>{seeking=true;if(Number.isFinite(video.duration))video.currentTime=Number(seek.value)/1000*video.duration;sync();show()});seek.addEventListener('change',()=>{seeking=false;sync()});
    mute.addEventListener('click',()=>{video.muted=!video.muted;sync();show()});volume.addEventListener('input',()=>{video.volume=Number(volume.value);video.muted=false;sync();show()});
    captions.addEventListener('click',()=>{const t=syncCaptions();if(!t)return;for(const x of video.textTracks){if(x.kind==='captions'||x.kind==='subtitles')x.mode=x===t&&x.mode!=='showing'?'showing':'disabled'}if(typeof window.zsbCaptionPosition?.pinVideoCaptions==='function')window.zsbCaptionPosition.pinVideoCaptions(video);sync();show()});
    speedButton.addEventListener('click',()=>{menuOpen=!menuOpen;host.classList.toggle('zlp--menu',menuOpen);speedButton.setAttribute('aria-expanded',String(menuOpen));show();if(menuOpen)custom.focus()});
    apply.addEventListener('click',()=>setRate(custom.value,true));custom.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setRate(custom.value,true)}else if(e.key==='Escape'){closeMenu();speedButton.focus()}});
    full.addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else if(host.requestFullscreen)host.requestFullscreen().catch(()=>{if(video.webkitEnterFullscreen)video.webkitEnterFullscreen()});else video.webkitEnterFullscreen?.();show()});
    host.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){pointerOver=true;show()}});host.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){pointerOver=true;show()}});host.addEventListener('pointerleave',hideLater);
    screen.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')show()});
    host.addEventListener('pointerdown',()=>host.classList.remove('zlp--keyboard'));host.addEventListener('keydown',()=>host.classList.add('zlp--keyboard'));host.addEventListener('focusin',()=>{if(host.classList.contains('zlp--keyboard'))show()});host.addEventListener('focusout',()=>setTimeout(()=>{if(!(host.classList.contains('zlp--keyboard')&&host.matches(':focus-within'))&&!menuOpen)hideLater()},0));
    document.addEventListener('pointerdown',e=>{if(menuOpen&&!host.contains(e.target))closeMenu()});host.addEventListener('keydown',e=>{if(e.key==='Escape'&&menuOpen){e.preventDefault();closeMenu();speedButton.focus()}});
    video.addEventListener('play',()=>{sync();show();clearTimeout(timer);timer=setTimeout(()=>{if(!(host.classList.contains('zlp--keyboard')&&host.matches(':focus-within'))&&!menuOpen&&!pointerOver)host.classList.remove('zlp--show')},2600)});
    video.addEventListener('pause',()=>{sync();show();pointerOver=false;clearTimeout(timer);timer=setTimeout(()=>{if(!(host.classList.contains('zlp--keyboard')&&host.matches(':focus-within'))&&!menuOpen&&!pointerOver)host.classList.remove('zlp--show')},2600)});
    ['timeupdate','durationchange','loadedmetadata','volumechange','ended'].forEach(type=>video.addEventListener(type,sync));
    video.addEventListener('ratechange',()=>{const n=video.playbackRate;if(n>=.5&&n<=3){speedButton.textContent=`${n}×`;custom.value=String(n);rates.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.textContent.replace('×',''))===n)))}});
    // Track may be injected by pvideo-captions after the video is created.
    new MutationObserver(syncCaptions).observe(video,{childList:true});video.textTracks?.addEventListener?.('change',syncCaptions);
    video.playbackRate=sharedRate;sync();players.set(video,{host,show,setRate});if(wasPlaying)video.play().catch(()=>{});
    video.addEventListener('play', () => {
      video.querySelectorAll('track[data-src]').forEach(track => {
        if (!track.getAttribute('src') && track.dataset.src) {
          track.src = track.dataset.src;
        }
      });
    }, { once: true });
  }
  enhance.count=0;
  function scan(root){if(root.nodeType!==1&&root.nodeType!==9)return;if(root.matches?.('video'))enhance(root);root.querySelectorAll?.(SELECTOR).forEach(enhance)}
  function start(){scan(document);new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)scan(n)}).observe(document.documentElement,{childList:true,subtree:true})}
  window.zsbLecturePlayer={enhance,scan,setGlobalRate(n){const value=Number(n);if(value<.5||value>3||!Number.isFinite(value))return;writeRate(value);document.querySelectorAll('.zlp video').forEach(v=>v.playbackRate=value)}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  if('IntersectionObserver' in window){
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(e => {
        if(e.isIntersecting) {
          const v = e.target;
          if(v.tagName === 'VIDEO' && v.dataset.poster && !v.poster) {
            v.poster = v.dataset.poster;
          }
          o.unobserve(v);
        }
      });
    }, { rootMargin: '200px 0px' });
    function observeVideos() {
      document.querySelectorAll('video[data-poster]').forEach(v => obs.observe(v));
    }
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeVideos, {once:true});
    else observeVideos();
  }
})();
