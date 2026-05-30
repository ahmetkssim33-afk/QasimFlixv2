(function(){
  'use strict';
  const isMobile = window.matchMedia('(max-width: 950px)').matches || /Android|iPhone|iPad|iPod|wv/i.test(navigator.userAgent);
  let wakeLock = null;

  function playerOpen(){ return !!document.getElementById('player-modal')?.classList.contains('open'); }
  function wrap(){ return document.getElementById('player-wrap') || document.getElementById('player-modal'); }
  function toast(msg){ if(window.qfToast) return window.qfToast(msg); }
  async function wake(){
    try{
      if('wakeLock' in navigator && !wakeLock){
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release',()=>wakeLock=null,{once:true});
      }
    }catch(_){ }
  }
  async function lockLandscape(){
    try{ if(screen.orientation?.lock) await screen.orientation.lock('landscape'); }catch(_){ }
  }
  function unlockLandscape(){ try{ screen.orientation?.unlock?.(); }catch(_){ } }
  async function requestFullScreen(){
    const el = wrap();
    if(!el || document.fullscreenElement || document.webkitFullscreenElement) return false;
    try{
      if(el.requestFullscreen) await el.requestFullscreen();
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      return true;
    }catch(_){ return false; }
  }
  function exitFullScreen(){
    try{ if(document.fullscreenElement) document.exitFullscreen(); else if(document.webkitFullscreenElement) document.webkitExitFullscreen(); }catch(_){ }
  }
  function enableCinema(){
    if(!isMobile || !playerOpen()) return;
    document.body.classList.add('qf-player-cinema','qf-hide-bottom-nav');
    document.documentElement.classList.add('qf-player-cinema');
    wake();
    const settings = window.qfGetSetting;
    if(!settings || settings('tryLandscape', true)) lockLandscape();
    if(!settings || settings('tryFullscreen', true)) requestFullScreen();
  }
  function disableCinema(){
    document.body.classList.remove('qf-player-cinema');
    document.documentElement.classList.remove('qf-player-cinema');
    if(!playerOpen()) document.body.classList.remove('qf-hide-bottom-nav');
    unlockLandscape();
    if(wakeLock){ try{ wakeLock.release(); }catch(_){ } wakeLock=null; }
  }
  function smartBack(e){
    if(!playerOpen()) return false;
    e?.preventDefault?.();
    if(window.closePlayer) window.closePlayer();
    else { document.getElementById('player-modal')?.classList.remove('open'); disableCinema(); exitFullScreen(); }
    try{ history.pushState({qfPlayer:false},'',location.href); }catch(_){ }
    return true;
  }

  const observer = new MutationObserver(()=> playerOpen() ? enableCinema() : disableCinema());
  document.addEventListener('DOMContentLoaded',()=>{
    const modal=document.getElementById('player-modal');
    if(modal) observer.observe(modal,{attributes:true,attributeFilter:['class']});
    if(isMobile){ try{ history.replaceState({qf:true},'',location.href); history.pushState({qf:true},'',location.href); }catch(_){ } }
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('.ep-card,.card-overlay-play,.btn-play,#fullscreen-btn,#qf-landscape-start,.qf-landscape-start')) setTimeout(enableCinema,40);
  },true);
  window.addEventListener('popstate',e=>{ if(smartBack(e)) return; });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') smartBack(e); });
  document.addEventListener('fullscreenchange',()=>{ if(playerOpen()) enableCinema(); });
  window.addEventListener('online',()=>toast('Bağlantı geri geldi.'));
  window.addEventListener('offline',()=>toast('İnternet yok. Video açılmazsa tekrar dene.'));
  window.qfEnablePlayerCinema = enableCinema;
  window.qfDisablePlayerCinema = disableCinema;
})();
