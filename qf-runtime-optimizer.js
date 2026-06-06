/* SineQ Runtime Optimizer
   Normal site + APK WebView için küçük performans yamaları.
   - Görselleri lazy/async yükler
   - Kart satırlarına düşük maliyetli scroll davranışı verir
   - APK/PWA modunu daha erken algılar
   - Ağ yavaşken kullanıcıya daha hızlı geri bildirim sağlar
*/
(function(){
  'use strict';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(max-width: 768px)').matches;
  const isApk = /SineQAPK|; wv\)|Android.*Version\//i.test(navigator.userAgent) || new URLSearchParams(location.search).get('source') === 'apk';

  if (isMobile || isApk) {
    document.documentElement.classList.add('qf-mobile-root');
    document.documentElement.classList.toggle('qf-apk-detected', !!isApk);
    if (document.body) document.body.classList.add('qf-apk-mode');
    else document.addEventListener('DOMContentLoaded', () => document.body?.classList.add('qf-apk-mode'));
  }

  function idle(fn){
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 1200 });
    else setTimeout(fn, 80);
  }

  function optimizeImages(root=document){
    root.querySelectorAll('img:not([data-qf-img-opt])').forEach(img => {
      img.dataset.qfImgOpt = '1';
      if (!img.hasAttribute('loading')) img.loading = 'lazy';
      if (!img.hasAttribute('decoding')) img.decoding = 'async';
      if (!img.hasAttribute('referrerpolicy')) img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => {
        img.style.display = 'none';
        const next = img.nextElementSibling;
        if (next && /placeholder/i.test(next.className || '')) next.style.display = 'flex';
      }, { once:true });
    });
  }

  function optimizeRows(root=document){
    root.querySelectorAll('.cards-row:not([data-qf-row-opt])').forEach(row => {
      row.dataset.qfRowOpt = '1';
      row.style.webkitOverflowScrolling = 'touch';
      row.addEventListener('wheel', (ev) => {
        if (Math.abs(ev.deltaX) >= Math.abs(ev.deltaY)) return;
        if (row.scrollWidth <= row.clientWidth) return;
        row.scrollLeft += ev.deltaY;
        ev.preventDefault();
      }, { passive:false });
    });
  }

  function run(){ optimizeImages(); optimizeRows(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => idle(run));
  else idle(run);

  const mo = new MutationObserver((mutations) => {
    let needs = false;
    for (const m of mutations) { if (m.addedNodes && m.addedNodes.length) { needs = true; break; } }
    if (needs) idle(run);
  });
  document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { childList:true, subtree:true }), { once:true });
})();
