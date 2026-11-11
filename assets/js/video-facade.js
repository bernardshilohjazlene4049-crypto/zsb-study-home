/* 视频点击才加载（GPT video-facade）：.zsb-video[data-video-src] 内放封面 img + button，点击前不请求视频。 */
document.querySelectorAll('.zsb-video[data-video-src]').forEach(container=>{
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
