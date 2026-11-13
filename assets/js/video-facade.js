/* 视频点击才加载（GPT video-facade）：.zsb-video[data-video-src] 内放封面 img + button，点击前不请求视频。 */
(function(){
  const observer = ('IntersectionObserver' in window) ? new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        const img = target.querySelector('img[data-src]');
        if (img && !img.src && img.dataset.src) {
          img.src = img.dataset.src;
        }
        if (target.tagName === 'VIDEO' && target.dataset.poster && !target.poster) {
          target.poster = target.dataset.poster;
        }
        obs.unobserve(target);
      }
    });
  }, { rootMargin: '200px 0px' }) : null;

  function observeElement(el) {
    if (observer) observer.observe(el);
    else {
      const img = el.querySelector?.('img[data-src]');
      if (img && !img.src && img.dataset.src) img.src = img.dataset.src;
      if (el.tagName === 'VIDEO' && el.dataset.poster && !el.poster) el.poster = el.dataset.poster;
    }
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
