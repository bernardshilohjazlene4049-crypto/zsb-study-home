(function(){
 var base=document.currentScript.getAttribute('data-base')||'';
 if(!document.querySelector('script[data-site-nav]')){var sn=document.createElement('script');sn.src=base+'assets/js/site-nav.js';sn.setAttribute('data-base',base);sn.setAttribute('data-site-nav','');document.body.appendChild(sn);}
 var mq=matchMedia('(max-width:760px)');document.querySelectorAll('details.tocd').forEach(function(d){if(mq.matches)d.open=false;
  d.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){if(mq.matches)d.open=false})})});
})();
