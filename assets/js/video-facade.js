/* 视频点击才加载（GPT video-facade）：.zsb-video[data-video-src] 内放封面 img + button，点击前不请求视频。 */
(function(){
  function loadPoster(target) {
    const img = target.querySelector?.('img[data-src]');
    if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
    if (target.tagName === 'VIDEO' && target.dataset.poster && !target.getAttribute('poster')) {
      target.poster = target.dataset.poster;
    }
  }

  /* 等 window load 后再观察，避免上方图片未撑开时把首屏以下封面误判为进入视口。rootMargin 为 0：科目主页视频均在首屏以下，打开不滚动时不应请求封面。 */
  const observer = ('IntersectionObserver' in window) ? new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      const r = entry.target.getBoundingClientRect();
      if (entry.isIntersecting && r.bottom > 0 && r.top < window.innerHeight) {
        loadPoster(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px' }) : null;

  function whenLayoutStable(fn) {
    let timer;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { ro.disconnect(); fn(); }, 150);
    });
    const begin = () => { ro.observe(document.documentElement); clearTimeout(timer); timer = setTimeout(() => { ro.disconnect(); fn(); }, 150); };
    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', begin, { once: true });
  }

  function observeElement(el) {
    whenLayoutStable(() => {
      if (observer) observer.observe(el);
      else loadPoster(el);
    });
  }

  document.querySelectorAll('.zsb-video[data-video-src]').forEach(container=>{
    observeElement(container);
    const button=container.querySelector('button'); if(!button)return;
    button.addEventListener('click',()=>{
      const source=container.dataset.videoSrc;
      if(!source||!/^\.?\.?\//.test(source)){console.error('Expected a relative video path');return;}
      const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='none';video.src=source;
      if(container.dataset.label)video.setAttribute('aria-label',container.dataset.label);
      const trackSrc=container.dataset.captions;
      if(trackSrc){const track=document.createElement('track');track.kind='captions';track.label='中文字幕';track.srclang='zh';track.src=trackSrc;video.append(track);}
      container.replaceChildren(video);video.focus({preventScroll:true});video.play().catch(()=>{});
    },{once:true});
  });

  document.querySelectorAll('video[data-poster]').forEach(video => {
    observeElement(video);
    video.addEventListener('play', () => {
      video.querySelectorAll('track[data-src]').forEach(track => {
        if (!track.getAttribute('src') && track.dataset.src) {
          track.src = track.dataset.src;
        }
      });
    }, { once: true });
  });

  const cur=document.currentScript;
  if(!cur||!cur.src||document.querySelector('script[data-zsb-caption-position]'))return;
  const s=document.createElement('script');
  s.src=cur.src.replace(/[^/]+(?:\?.*)?$/,'caption-position.js');
  s.setAttribute('data-zsb-caption-position','');
  document.head.append(s);
})();
