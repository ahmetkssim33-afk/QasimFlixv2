(function(){
  'use strict';
  const LS_DOWNLOADS = 'qf_offline_downloads';
  const LS_DISMISSED = 'qf_update_dismissed_build';
  const LS_SETTINGS = 'qasimflix_settings';
  const LANG_KEY = 'qasimflix_lang';
  const OLD_LANG_KEY = 'qfLang';
  const DEFAULT_SETTINGS = { autoplay:true, tryFullscreen:true, tryLandscape:true, notifications:false };
  const APK_UA = /; wv\)|Android.*Version\/\d+|QasimFlixAPK/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const mobile = window.matchMedia('(max-width: 768px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile || standalone || APK_UA) document.documentElement.classList.add('qf-mobile-root'), document.body && document.body.classList.add('qf-apk-mode');

  function ready(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }
  function t(key){ return window.qfT ? window.qfT(key) : key; }
  function toast(msg){ let el=document.querySelector('.qf-apk-toast'); if(!el){ el=document.createElement('div'); el.className='qf-apk-toast'; document.body.appendChild(el); } el.textContent=msg; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2600); } window.qfToast=toast;
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/`/g,'&#96;'); }

  function getSettings(){ try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(LS_SETTINGS)||'{}')); } catch(e){ return Object.assign({}, DEFAULT_SETTINGS); } }
  function saveSettings(settings){ localStorage.setItem(LS_SETTINGS, JSON.stringify(Object.assign({}, DEFAULT_SETTINGS, settings||{}))); }
  function getSetting(name, fallback){ const s=getSettings(); return typeof s[name] === 'undefined' ? fallback : s[name]; }
  window.qfGetSettings = getSettings;
  window.qfGetSetting = getSetting;
  window.qfSetSetting = function(name, value){ const s=getSettings(); s[name]=!!value; saveSettings(s); renderSettingsState(); toast(t('settings.saved')); };

  function getCurrentLang(){ return localStorage.getItem(LANG_KEY) || localStorage.getItem(OLD_LANG_KEY) || 'tr'; }
  function setLanguage(lang){ if(window.qfApplyLang) window.qfApplyLang(lang); else { localStorage.setItem(LANG_KEY, lang); localStorage.setItem(OLD_LANG_KEY, lang); } renderDynamicText(); renderSettingsState(); }

  function getDownloads(){ try { return JSON.parse(localStorage.getItem(LS_DOWNLOADS)||'[]'); } catch(e){ return []; } }
  function saveDownloads(items){ localStorage.setItem(LS_DOWNLOADS, JSON.stringify(items.slice(0,80))); }
  function registerDownload(item){ const items=getDownloads().filter(x=>x.url!==item.url); items.unshift({title:item.title||'Video',url:item.url,type:item.type||'video',createdAt:Date.now()}); saveDownloads(items); }
  window.qfRegisterDownload=registerDownload;
  function canDirectDownload(url){ return !!url && /\.mp4(\?|#|$)/i.test(url) && !/(drive\.google|youtube|youtu\.be|iframe|embed)/i.test(url); }
  window.qfCanDirectDownload=canDirectDownload;
  function openSearch(){ const input=document.getElementById('search-input'); if(input){ input.focus(); input.scrollIntoView({block:'center',behavior:'smooth'}); } }

  function renderDownloads(){
    const sheet=document.getElementById('qf-downloads-sheet'); if(!sheet)return;
    const items=getDownloads(); const list=sheet.querySelector('[data-qf-download-list]');
    sheet.querySelector('[data-qf-sheet-title]').textContent=t('downloads.title');
    if(!items.length){ list.innerHTML='<div class="qf-empty-downloads">'+t('downloads.empty')+'</div>'; return; }
    list.innerHTML=items.map(x=>`<div class="qf-download-card"><div><b>${escapeHtml(x.title)}</b><small>${new Date(x.createdAt).toLocaleString(getCurrentLang()==='tr'?'tr-TR':undefined)}</small></div><a href="${escapeAttr(x.url)}" target="_blank" rel="noopener">${escapeHtml(t('downloads.open'))}</a></div>`).join('');
  }
  function openDownloads(){ renderDownloads(); closeProfileSheet(); closeSettings(); document.getElementById('qf-downloads-sheet')?.classList.add('open'); setActive('downloads'); }
  function closeDownloads(){ document.getElementById('qf-downloads-sheet')?.classList.remove('open'); }
  window.qfOpenDownloads=openDownloads; window.qfCloseDownloads=closeDownloads;

  function openProfileSheet(){ renderProfileSheet(); closeDownloads(); closeSettings(); document.getElementById('qf-profile-sheet')?.classList.add('open'); setActive('profile'); }
  function closeProfileSheet(){ document.getElementById('qf-profile-sheet')?.classList.remove('open'); }
  window.qfOpenProfileSheet=openProfileSheet; window.qfCloseProfileSheet=closeProfileSheet;
  function openSettings(){ renderSettingsState(); closeDownloads(); closeProfileSheet(); document.getElementById('qf-settings-sheet')?.classList.add('open'); setActive('profile'); }
  function closeSettings(){ document.getElementById('qf-settings-sheet')?.classList.remove('open'); }
  window.qfOpenSettings=openSettings; window.qfCloseSettings=closeSettings;

  function setActive(name){ document.querySelectorAll('.qf-mobile-bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.qfTab===name)); }

  function switchMarkup(key, checked){
    return `<button class="qf-switch ${checked?'on':''}" type="button" data-qf-setting="${key}" aria-pressed="${checked}"><span></span><b>${checked?t('settings.on'):t('settings.off')}</b></button>`;
  }
  function versionText(){
    const meta=document.querySelector('meta[name="app-version"]')?.content || window.QASIMFLIX_VERSION || '';
    return meta || document.getElementById('qf-settings-sheet')?.dataset.version || '1.0.0';
  }
  async function loadVersion(){
    try{ const res=await fetch('/version.json?ts='+Date.now(),{cache:'no-store'}); if(!res.ok)return; const data=await res.json(); const v=String(data.version||data.build||'1.0.0'); document.getElementById('qf-settings-sheet')?.setAttribute('data-version', v); const el=document.querySelector('[data-qf-version]'); if(el) el.textContent=v; }catch(e){}
  }
  function renderSettingsState(){
    const sheet=document.getElementById('qf-settings-sheet'); if(!sheet)return; const settings=getSettings();
    const langSelect=sheet.querySelector('[data-qf-lang-select]'); if(langSelect) langSelect.value=getCurrentLang();
    sheet.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=t(el.getAttribute('data-i18n')); });
    sheet.querySelectorAll('[data-qf-setting]').forEach(btn=>{ const k=btn.dataset.qfSetting; const checked=!!settings[k]; btn.classList.toggle('on',checked); btn.setAttribute('aria-pressed', String(checked)); const b=btn.querySelector('b'); if(b)b.textContent=checked?t('settings.on'):t('settings.off'); });
    const v=sheet.querySelector('[data-qf-version]'); if(v) v.textContent=versionText();
  }
  function renderProfileSheet(){
    const sheet=document.getElementById('qf-profile-sheet'); if(!sheet)return;
    const name=(window.AUTH_USER && (window.AUTH_USER.name || window.AUTH_USER.email)) || document.getElementById('user-display-name')?.textContent || t('profile.login');
    sheet.querySelector('[data-qf-profile-name]').textContent=name;
    sheet.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=t(el.getAttribute('data-i18n')); });
  }
  function renderDynamicText(){
    document.querySelectorAll('#qf-mobile-bottom-nav [data-i18n], #qf-downloads-sheet [data-i18n], #qf-profile-sheet [data-i18n], #qf-settings-sheet [data-i18n], #qf-update-banner [data-i18n]').forEach(el=>{ el.textContent=t(el.getAttribute('data-i18n')); });
    renderDownloads(); renderProfileSheet(); renderSettingsState();
  }

  async function clearAppCache(){
    try{
      if('caches' in window){ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }
      localStorage.removeItem(LS_DOWNLOADS);
      renderDownloads();
      toast(t('settings.cacheCleared'));
    }catch(e){ toast(t('settings.cacheError')); }
  }
  async function enableNotifications(on){
    const s=getSettings();
    if(on && 'Notification' in window){
      try{ const perm=await Notification.requestPermission(); s.notifications = perm === 'granted'; }catch(e){ s.notifications=false; }
    } else if(on) { s.notifications=false; toast(t('settings.notSupported')); }
    else s.notifications=false;
    saveSettings(s); renderSettingsState(); if(s.notifications) toast(t('settings.saved'));
  }

  function injectUI(){
    if(document.getElementById('qf-mobile-bottom-nav')) return;
    const nav=document.createElement('nav'); nav.id='qf-mobile-bottom-nav'; nav.className='qf-mobile-bottom-nav'; nav.setAttribute('aria-label','APK alt menü'); nav.innerHTML=`
      <button class="active" data-qf-tab="home" type="button"><span>⌂</span><small data-i18n="nav.home">${t('nav.home')}</small></button>
      <button data-qf-tab="search" type="button"><span>⌕</span><small data-i18n="nav.search">${t('nav.search')}</small></button>
      <button data-qf-tab="downloads" type="button"><span>⇩</span><small data-i18n="nav.downloads">${t('nav.downloads')}</small></button>
      <button data-qf-tab="favorites" type="button"><span>♡</span><small data-i18n="nav.favorites">${t('nav.favorites')}</small></button>
      <button data-qf-tab="profile" type="button"><span>◉</span><small data-i18n="nav.profile">${t('nav.profile')}</small></button>`; document.body.appendChild(nav);
    nav.addEventListener('click',e=>{ const btn=e.target.closest('button'); if(!btn)return; const tab=btn.dataset.qfTab; setActive(tab); if(tab==='home'){closeDownloads(); closeProfileSheet(); closeSettings(); if(window.showAll) window.showAll(); window.scrollTo({top:0,behavior:'smooth'});} if(tab==='search'){closeDownloads(); closeProfileSheet(); closeSettings(); openSearch();} if(tab==='downloads') openDownloads(); if(tab==='favorites'){closeDownloads(); closeProfileSheet(); closeSettings(); window.loadFavorites?window.loadFavorites():toast('Favoriler için giriş yapmalısın.');} if(tab==='profile') openProfileSheet(); });

    const downloads=document.createElement('section'); downloads.id='qf-downloads-sheet'; downloads.className='qf-downloads-sheet'; downloads.innerHTML='<div class="qf-downloads-head"><h3 data-qf-sheet-title data-i18n="downloads.title">'+t('downloads.title')+'</h3><button class="qf-sheet-close" onclick="qfCloseDownloads()">×</button></div><div data-qf-download-list></div>'; document.body.appendChild(downloads);

    const profile=document.createElement('section'); profile.id='qf-profile-sheet'; profile.className='qf-profile-sheet qf-mobile-sheet'; profile.innerHTML=`
      <div class="qf-sheet-grabber"></div>
      <div class="qf-downloads-head"><h3 data-i18n="profile.title">${t('profile.title')}</h3><button class="qf-sheet-close" onclick="qfCloseProfileSheet()">×</button></div>
      <div class="qf-profile-hero"><div class="qf-profile-avatar">◉</div><div><small data-i18n="profile.account">${t('profile.account')}</small><b data-qf-profile-name>${t('profile.login')}</b></div></div>
      <button class="qf-profile-action primary" type="button" onclick="qfOpenSettings()" data-i18n="settings.open">${t('settings.open')}</button>
      <button class="qf-profile-action" type="button" onclick="qfCloseProfileSheet(); window.openProfileSelectScreen ? openProfileSelectScreen() : document.getElementById('local-auth-btn')?.click()" data-i18n="profile.switch">${t('profile.switch')}</button>
      <button class="qf-profile-action" type="button" onclick="qfCloseProfileSheet(); window.openProfileManageModal ? openProfileManageModal() : null" data-i18n="profile.manage">${t('profile.manage')}</button>
      <button class="qf-profile-action" type="button" onclick="qfCloseProfileSheet(); window.loadWatchlist ? loadWatchlist() : null" data-i18n="profile.watchlist">${t('profile.watchlist')}</button>`; document.body.appendChild(profile);

    const settings=document.createElement('section'); settings.id='qf-settings-sheet'; settings.className='qf-settings-sheet qf-mobile-sheet'; settings.innerHTML=`
      <div class="qf-sheet-grabber"></div>
      <div class="qf-downloads-head"><div><h3 data-i18n="settings.title">${t('settings.title')}</h3><p data-i18n="settings.subtitle">${t('settings.subtitle')}</p></div><button class="qf-sheet-close" onclick="qfCloseSettings()">×</button></div>
      <label class="qf-setting-row qf-setting-lang"><span data-i18n="settings.language">${t('settings.language')}</span><select data-qf-lang-select aria-label="${escapeAttr(t('settings.language'))}">
        <option value="tr">Türkçe</option><option value="ar">العربية</option><option value="en">English</option><option value="en-GB">English UK</option><option value="es">Español</option><option value="it">Italiano</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="ru">Русский</option><option value="zh">中文</option>
      </select></label>
      <div class="qf-setting-row"><span data-i18n="settings.autoplay">${t('settings.autoplay')}</span>${switchMarkup('autoplay',getSetting('autoplay',true))}</div>
      <div class="qf-setting-row"><span data-i18n="settings.fullscreen">${t('settings.fullscreen')}</span>${switchMarkup('tryFullscreen',getSetting('tryFullscreen',true))}</div>
      <div class="qf-setting-row"><span data-i18n="settings.landscape">${t('settings.landscape')}</span>${switchMarkup('tryLandscape',getSetting('tryLandscape',true))}</div>
      <div class="qf-setting-row"><span data-i18n="settings.notifications">${t('settings.notifications')}</span>${switchMarkup('notifications',getSetting('notifications',false))}</div>
      <button class="qf-clear-cache" type="button" data-i18n="settings.clearCache">${t('settings.clearCache')}</button>
      <div class="qf-app-version"><span data-i18n="settings.version">${t('settings.version')}</span><b data-qf-version>${versionText()}</b></div>`; document.body.appendChild(settings);
    settings.querySelector('[data-qf-lang-select]').addEventListener('change', e=>setLanguage(e.target.value));
    settings.addEventListener('click', e=>{ const sw=e.target.closest('[data-qf-setting]'); if(sw){ const key=sw.dataset.qfSetting; const next=!getSetting(key,false); if(key==='notifications') enableNotifications(next); else window.qfSetSetting(key,next); } if(e.target.closest('.qf-clear-cache')) clearAppCache(); });

    const banner=document.createElement('div'); banner.id='qf-update-banner'; banner.className='qf-update-banner'; banner.innerHTML='<div style="flex:1"><strong data-i18n="update.title">'+t('update.title')+'</strong><p data-qf-update-msg data-i18n="update.message">'+t('update.message')+'</p></div><a data-qf-update-link href="#" target="_blank" rel="noopener" data-i18n="update.action">'+t('update.action')+'</a><button type="button" data-qf-update-close data-i18n="update.later">'+t('update.later')+'</button>'; document.body.appendChild(banner); banner.querySelector('[data-qf-update-close]').onclick=()=>{localStorage.setItem(LS_DISMISSED,banner.dataset.build||'');banner.classList.remove('show')};
    loadVersion(); renderDynamicText();
  }

  async function checkUpdate(){ try{ const res=await fetch('/version.json?ts='+Date.now(),{cache:'no-store'}); if(!res.ok)return; const data=await res.json(); if(!data.apkRequired && !data.apkUrl)return; const dismissed=localStorage.getItem(LS_DISMISSED); const build=String(data.build||data.version||''); if(dismissed===build)return; const b=document.getElementById('qf-update-banner'); if(!b)return; b.dataset.build=build; b.querySelector('[data-qf-update-msg]').textContent=data.message||t('update.message'); const a=b.querySelector('[data-qf-update-link]'); if(data.apkUrl){a.href=data.apkUrl; a.style.display='inline-block';} else {a.style.display='none';} b.classList.add('show'); }catch(e){} }
  function enhanceInstallTip(){ let deferredPrompt=null; window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; if(localStorage.getItem('qf_install_tip_closed'))return; const tip=document.createElement('div'); tip.className='qf-install-tip show'; tip.innerHTML='<button>'+t('install.close')+'</button>'+t('install.tip'); document.body.appendChild(tip); tip.onclick=async(ev)=>{ if(ev.target.tagName==='BUTTON'){ localStorage.setItem('qf_install_tip_closed','1'); tip.remove(); return; } if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; tip.remove(); } }; }); }
  function keepScreenAwake(){ document.addEventListener('click',async e=>{ if(!e.target.closest('.btn-play,.card,.ep-card,#fullscreen-btn,.landscape-start'))return; try{ if('wakeLock' in navigator && !window.qfWakeLock){ window.qfWakeLock=await navigator.wakeLock.request('screen'); window.qfWakeLock.addEventListener('release',()=>window.qfWakeLock=null); } }catch(_){} }); document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') window.qfWakeLock=null; }); }

  function modalIsVisible(el){ if(!el) return false; const cs=getComputedStyle(el); return el.classList.contains('open') || (cs.display!=='none' && cs.visibility!=='hidden' && Number(cs.opacity||1)>0 && el.getBoundingClientRect().height>80); }
  function setBottomNavHidden(hide){ const nav=document.getElementById('qf-mobile-bottom-nav'); document.body.classList.toggle('qf-hide-bottom-nav',!!hide); if(nav){ nav.style.display=hide?'none':''; nav.style.pointerEvents=hide?'none':''; } document.body.style.paddingBottom=hide?'0':''; }
  window.qfSetBottomNavHidden=setBottomNavHidden;
  function syncBottomNavVisibility(){ const detailOpen=modalIsVisible(document.getElementById('detail-modal')); const playerOpen=modalIsVisible(document.getElementById('player-modal')); setBottomNavHidden(!!(detailOpen||playerOpen)); }
  function observeModalState(){ syncBottomNavVisibility(); ['detail-modal','player-modal'].forEach(id=>{ const el=document.getElementById(id); if(!el||el._qfNavObserver)return; el._qfNavObserver=true; new MutationObserver(syncBottomNavVisibility).observe(el,{attributes:true,attributeFilter:['class','style','aria-hidden']}); }); const wrap=(name,after)=>{ const fn=window[name]; if(typeof fn==='function'&&!fn._qfWrapped){ window[name]=function(){ const r=fn.apply(this,arguments); setTimeout(after,0); setTimeout(syncBottomNavVisibility,80); return r; }; window[name]._qfWrapped=true; } }; wrap('openDetail',()=>setBottomNavHidden(true)); wrap('closeDetailModal',()=>setBottomNavHidden(false)); wrap('openPlayerShell',()=>setBottomNavHidden(true)); wrap('closePlayer',()=>setBottomNavHidden(false)); document.addEventListener('click',()=>setTimeout(syncBottomNavVisibility,0),true); window.addEventListener('popstate',()=>setTimeout(syncBottomNavVisibility,0)); }
  function overrideDownload(){ const original=window.downloadItem; window.downloadItem=function(type,itemId,videoUrl,title){ if(!videoUrl && window.currentSeries?.seasons?.[0]?.episodes?.[0]) videoUrl=window.currentSeries.seasons[0].episodes[0].videoUrl; if(!canDirectDownload(videoUrl)){ toast(t('download.unsupported')); return; } registerDownload({title:title||'Video',url:videoUrl,type}); if(original) return original.apply(this,arguments); const a=document.createElement('a'); a.href=videoUrl; a.download=(title||'video')+'.mp4'; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove(); toast(t('download.started')); } }

  document.addEventListener('qf-lang-changed', renderDynamicText);
  ready(()=>{ document.body.classList.add('qf-apk-mode'); injectUI(); observeModalState(); checkUpdate(); enhanceInstallTip(); keepScreenAwake(); setTimeout(overrideDownload,300); const action=new URLSearchParams(location.search).get('action'); if(action==='downloads') setTimeout(openDownloads,350); if(action==='search') setTimeout(openSearch,350); window.addEventListener('online',()=>toast(t('toast.online'))); window.addEventListener('offline',()=>toast(t('toast.offline'))); });
})();
