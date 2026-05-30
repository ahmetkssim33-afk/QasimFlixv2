(function(){
  'use strict';

  const isMobileLike = () => {
    try {
      return window.matchMedia('(max-width: 950px)').matches || /Android|iPhone|iPad|iPod|QasimFlixAPK/i.test(navigator.userAgent);
    } catch (_) {
      return /Android|iPhone|iPad|iPod|QasimFlixAPK/i.test(navigator.userAgent);
    }
  };

  function setViewportVars(){
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    if (h) document.documentElement.style.setProperty('--qf-player-vh', h + 'px');
  }

  function toast(msg){
    if (window.qfToast) return window.qfToast(msg);
    if (window.showToast) return window.showToast(msg);
  }

  async function wake(){
    try {
      if ('wakeLock' in navigator && !window.qfWakeLock) {
        window.qfWakeLock = await navigator.wakeLock.request('screen');
        window.qfWakeLock.addEventListener('release', () => { window.qfWakeLock = null; });
      }
    } catch (_) {}
  }

  async function lockLandscape(){
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (_) {}
  }

  async function requestRealFullscreen(){
    const modal = document.getElementById('player-modal');
    const box = modal?.querySelector('.player-modal-box');
    const wrap = document.getElementById('player-wrap');
    const target = wrap || box || modal || document.documentElement;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (target.requestFullscreen) await target.requestFullscreen({ navigationUI: 'hide' });
        else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
      }
    } catch (_) {}
    await lockLandscape();
  }

  function isPlayerOpen(){
    const modal = document.getElementById('player-modal');
    return !!(modal && modal.classList.contains('open'));
  }

  function isDriveMode(){
    const modal = document.getElementById('player-modal');
    return !!(modal && modal.classList.contains('drive-embed-mode'));
  }

  function applyCinemaMode(){
    if (!isMobileLike()) return;
    setViewportVars();
    const open = isPlayerOpen();
    document.body.classList.toggle('mobile-cinema', open);
    document.body.classList.toggle('qf-hide-bottom-nav', open);
    if (!open) return;

    const modal = document.getElementById('player-modal');
    const wrap = document.getElementById('player-wrap');
    const embed = document.getElementById('embed-player');
    const iframe = embed?.querySelector('iframe');
    const bar = modal?.querySelector('.player-bar');
    const start = document.getElementById('qf-landscape-start');

    // APK içinde alttaki siyah bilgi şeridini kaldır. Google Drive kendi kontrolünü iframe içinde gösterir.
    if (bar) bar.style.display = 'none';
    if (start) start.classList.remove('show');

    if (wrap) {
      wrap.style.minHeight = 'var(--qf-player-vh, 100dvh)';
      wrap.style.height = 'var(--qf-player-vh, 100dvh)';
    }
    if (embed) {
      embed.style.display = isDriveMode() ? 'block' : embed.style.display;
      embed.style.position = 'absolute';
      embed.style.inset = '0';
      embed.style.width = '100vw';
      embed.style.height = 'var(--qf-player-vh, 100dvh)';
      embed.style.background = '#000';
    }
    if (iframe) {
      iframe.style.position = 'absolute';
      iframe.style.inset = '0';
      iframe.style.width = '100vw';
      iframe.style.height = 'var(--qf-player-vh, 100dvh)';
      iframe.style.border = '0';
      iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('webkitallowfullscreen', 'true');
    }
  }

  function exitFullscreen(){
    try {
      if (document.fullscreenElement) return document.exitFullscreen();
      if (document.webkitFullscreenElement) return document.webkitExitFullscreen();
    } catch (_) {}
  }

  function closeCinema(){
    document.body.classList.remove('mobile-cinema', 'qf-hide-bottom-nav');
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (_) {}
    exitFullscreen();
  }

  function handleBack(e){
    if (!isPlayerOpen() && !document.fullscreenElement && !document.webkitFullscreenElement) return false;
    e?.preventDefault?.();
    if (window.closePlayer) window.closePlayer();
    closeCinema();
    try { history.pushState({ qfPlayerBack: true }, '', location.href); } catch (_) {}
    return true;
  }

  function bind(){
    setViewportVars();
    window.addEventListener('resize', () => { setViewportVars(); applyCinemaMode(); }, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(() => { setViewportVars(); applyCinemaMode(); }, 250), { passive: true });

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.btn-play,.card-overlay-play,.ep-card,#fullscreen-btn,#qf-landscape-start button,#player-wrap,#embed-player,.qasim-video-controls');
      if (!trigger) return;
      wake();
      // Video açma tıklaması kullanıcı hareketi olduğu için tam ekran/yatay denemesini burada yapıyoruz.
      if (isMobileLike()) setTimeout(() => { applyCinemaMode(); requestRealFullscreen(); }, 60);
    }, true);

    const modal = document.getElementById('player-modal');
    if (modal && !modal._qfCinemaObserver) {
      modal._qfCinemaObserver = true;
      new MutationObserver(() => {
        applyCinemaMode();
        if (isPlayerOpen() && isMobileLike()) setTimeout(requestRealFullscreen, 120);
      }).observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    document.addEventListener('fullscreenchange', applyCinemaMode);
    document.addEventListener('webkitfullscreenchange', applyCinemaMode);
    window.addEventListener('popstate', handleBack);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') handleBack(e); });

    const oldClose = window.closePlayer;
    if (typeof oldClose === 'function' && !oldClose._qfCinemaWrapped) {
      window.closePlayer = function(){
        closeCinema();
        return oldClose.apply(this, arguments);
      };
      window.closePlayer._qfCinemaWrapped = true;
    }

    try {
      if (isMobileLike()) {
        history.replaceState({ qf: true }, '', location.href);
        history.pushState({ qf: true }, '', location.href);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  window.addEventListener('online', () => toast('Bağlantı geri geldi.'));
  window.addEventListener('offline', () => toast('İnternet yok. Video açılmazsa tekrar dene.'));
})();
