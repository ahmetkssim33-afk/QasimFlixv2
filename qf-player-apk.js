(function(){
  'use strict';
  const mobile=window.matchMedia('(max-width: 900px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  function toast(msg){ if(window.showToast) return window.showToast(msg); let el=document.querySelector('.toast')||document.createElement('div'); if(!el.parentNode){el.className='toast';document.body.appendChild(el);} el.textContent=msg; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2200); }
  async function wake(){try{if('wakeLock' in navigator && !window.qfWakeLock){window.qfWakeLock=await navigator.wakeLock.request('screen'); window.qfWakeLock.addEventListener('release',()=>window.qfWakeLock=null);}}catch(e){}}
  async function landscape(){try{if(screen.orientation?.lock) await screen.orientation.lock('landscape');}catch(e){}}
  function exitFullscreen(){try{if(document.fullscreenElement) return document.exitFullscreen(); if(document.webkitFullscreenElement) return document.webkitExitFullscreen();}catch(e){}}
  function backSmart(e){ if(document.fullscreenElement || document.webkitFullscreenElement || document.body.classList.contains('mobile-cinema')){ e?.preventDefault?.(); document.body.classList.remove('mobile-cinema'); exitFullscreen(); try{history.pushState(null,'',location.href);}catch(_){ } return true;} return false; }
  window.addEventListener('popstate',e=>{ if(backSmart(e)) return; });
  document.addEventListener('keydown',e=>{if(e.key==='Escape') backSmart(e);});
  document.addEventListener('click',e=>{ if(e.target.closest('.landscape-start,.action-btn,.mobile-video-controls,.video-container')){ wake(); if(mobile && (!window.qfGetSetting || window.qfGetSetting('tryLandscape', true))) setTimeout(landscape,250); } },true);
  window.addEventListener('online',()=>toast('Bağlantı geri geldi.'));
  window.addEventListener('offline',()=>toast('İnternet yok. Video açılmazsa tekrar dene.'));
  if(mobile){ try{history.replaceState({qf:true},'',location.href); history.pushState({qf:true},'',location.href);}catch(_){ } }
})();
