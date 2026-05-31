/* QasimFlix APK Native Bridge
   Web tarafı hazırdır; Android WebView içinde window.QasimFlixAndroid varsa
   tam ekran, yatay mod, ekran açık tutma ve native indirme komutlarını iletir. */
(function(){
  'use strict';

  const BRIDGE_NAMES = ['QasimFlixAndroid', 'Android', 'QFAndroid'];
  const state = { playerActive: false, lastDownload: 0 };

  function nativeBridge(){
    for (const name of BRIDGE_NAMES) {
      const bridge = window[name];
      if (bridge) return bridge;
    }
    return null;
  }

  function callNative(method, ...args){
    const bridge = nativeBridge();
    if (!bridge || typeof bridge[method] !== 'function') return false;
    try {
      bridge[method](...args.map(v => typeof v === 'string' ? v : JSON.stringify(v)));
      return true;
    } catch (err) {
      console.warn('[QasimFlix APK Bridge]', method, err);
      return false;
    }
  }

  window.QFNative = {
    isAvailable(){ return !!nativeBridge(); },
    call: callNative,
    setPlayerActive(active){ return setPlayerActive(!!active); },
    download(url, title){ return downloadNative(url, title); },
    openExternal(url){ return callNative('openExternal', String(url || '')); },
    share(text){ return callNative('shareText', String(text || '')); }
  };

  function setPlayerActive(active){
    if (state.playerActive === active) return true;
    state.playerActive = active;
    document.documentElement.classList.toggle('qf-native-player-active', active);
    document.body?.classList.toggle('qf-native-player-active', active);
    callNative('setPlayerActive', String(active));
    callNative('setFullscreen', String(active));
    callNative('keepScreenOn', String(active));
    callNative('lockLandscape', String(active));
    if (!active) callNative('unlockOrientation');
    return true;
  }

  function isPlayerOpen(){
    const modal = document.getElementById('player-modal');
    if (!modal) return false;
    return modal.classList.contains('open') || modal.getAttribute('aria-hidden') === 'false';
  }

  function syncPlayerState(){
    setPlayerActive(isPlayerOpen());
  }

  function observePlayer(){
    const modal = document.getElementById('player-modal');
    if (!modal || modal._qfNativeObserved) return;
    modal._qfNativeObserved = true;
    new MutationObserver(syncPlayerState).observe(modal, { attributes:true, attributeFilter:['class','style','aria-hidden'] });
    syncPlayerState();
  }

  function downloadNative(url, title){
    const src = String(url || '').trim();
    if (!src) return false;
    const now = Date.now();
    if (now - state.lastDownload < 900) return true;
    state.lastDownload = now;
    return callNative('downloadVideo', src, String(title || 'QasimFlix Video'));
  }

  function patchDownloadItem(){
    const original = window.downloadItem;
    if (typeof original !== 'function' || original._qfNativePatched) return;
    window.downloadItem = function(type, itemId, videoUrl, title){
      if (nativeBridge() && videoUrl && window.qfCanDirectDownload && window.qfCanDirectDownload(videoUrl)) {
        const ok = downloadNative(videoUrl, title || 'QasimFlix Video');
        if (ok) {
          if (window.qfToast) window.qfToast('İndirme APK içinde başlatıldı.');
          return;
        }
      }
      return original.apply(this, arguments);
    };
    window.downloadItem._qfNativePatched = true;
  }

  function patchPlayerLandscape(){
    const original = window.requestPlayerLandscape;
    if (typeof original !== 'function' || original._qfNativePatched) return;
    window.requestPlayerLandscape = async function(force){
      callNative('setFullscreen', 'true');
      callNative('lockLandscape', 'true');
      callNative('keepScreenOn', 'true');
      return original.apply(this, arguments);
    };
    window.requestPlayerLandscape._qfNativePatched = true;
  }

  function init(){
    document.documentElement.classList.toggle('qf-native-bridge', !!nativeBridge());
    observePlayer();
    patchDownloadItem();
    patchPlayerLandscape();
    setTimeout(observePlayer, 500);
    setTimeout(patchDownloadItem, 900);
    setTimeout(patchPlayerLandscape, 900);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) setPlayerActive(false);
      else syncPlayerState();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
