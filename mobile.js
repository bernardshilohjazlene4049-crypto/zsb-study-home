(function(){
 var base=document.currentScript.getAttribute('data-base')||'';
 var here=location.pathname.replace(/index\.html$/,'');
 var S=function(d){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>'};
 var items=[['首页','',S('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>')],['计算机','jsj/',S('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>')],['高数','gs/',S('<path d="M5 19c4 0 3-14 7-14s3 14 7 14"/>')],['C语言','c/',S('<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>')],['英语','yy/',S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>')]];
 var nav=document.createElement('nav');nav.className='m-nav';nav.setAttribute('aria-label','快捷导航');
 items.forEach(function(it){var a=document.createElement('a');a.href=base+it[1]+'index.html';a.innerHTML=it[2]+'<span>'+it[0]+'</span>';
  var p=a.pathname.replace(/index\.html$/,'');if(p===here)a.setAttribute('aria-current','page');nav.appendChild(a)});
 var t=document.createElement('button');t.type='button';t.innerHTML=S('<path d="M12 19V5M6 11l6-6 6 6"/>')+'<span>顶部</span>';t.setAttribute('aria-label','回到顶部');
 t.onclick=function(){scrollTo({top:0,behavior:'smooth'})};nav.appendChild(t);document.body.appendChild(nav);
 if(!document.querySelector('script[data-site-nav]')){var sn=document.createElement('script');sn.src=base+'assets/js/site-nav.js';sn.setAttribute('data-base',base);sn.setAttribute('data-site-nav','');document.body.appendChild(sn);}
 var mq=matchMedia('(max-width:760px)');document.querySelectorAll('details.tocd').forEach(function(d){if(mq.matches)d.open=false;
  d.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){if(mq.matches)d.open=false})})});
})();
