/* 点击 .pvideo-open 生成播放器后，补上同名 .vtt 字幕轨（默认关闭，可在播放器里打开）。 */
document.querySelectorAll('.pvideo-open[data-src]').forEach(link=>{
  const box=link.parentElement;
  link.addEventListener('click',()=>{
    const video=box&&box.querySelector('video');
    if(!video||video.querySelector('track'))return;
    const track=document.createElement('track');
    track.kind='captions';track.srclang='zh';track.label='中文字幕';
    track.src=link.dataset.src.replace(/\.mp4(\?.*)?$/,'.vtt');
    video.append(track);
  });
});

(function(){
  const cur=document.currentScript;
  if(!cur||!cur.src||document.querySelector('script[data-zsb-caption-position]'))return;
  const s=document.createElement('script');
  s.src=cur.src.replace(/[^/]+(?:\?.*)?$/,'caption-position.js');
  s.setAttribute('data-zsb-caption-position','');
  document.head.append(s);
})();
