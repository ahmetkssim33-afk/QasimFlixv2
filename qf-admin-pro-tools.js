(function(){
  'use strict';
  const API = window.location.origin + '/api';
  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const lang = () => localStorage.getItem('qfLang') || localStorage.getItem('qasimflix_lang') || 'tr';
  const tr = {
    'tmdb.title':'🎞 TMDB otomatik bilgi çekme','tmdb.sub':'Başlık yaz, poster/açıklama/yıl/puan/kategori/fragman otomatik dolsun. API key tarayıcıya yazılmaz; Vercel Environment Variable içinde durur.','tmdb.search':'Bilgileri Çek','tmdb.placeholder':'Film/dizi adı yaz ve Bilgileri Çek’e bas','tmdb.notConfigured':'TMDB_TOKEN eksik. Vercel → Settings → Environment Variables içine TMDB_TOKEN ekle.','tmdb.noResults':'Sonuç bulunamadı.','tmdb.apply':'Bu bilgileri kullan','tmdb.applied':'TMDB bilgileri forma aktarıldı.','tmdb.error':'TMDB bilgisi çekilemedi.','tmdb.posterHint':'TMDB poster URL’si kaydedilecek. İstersen dosyadan poster seçersen dosya öncelikli olur.',
    'link.check':'Video linkini kontrol et','link.ok':'Çalışıyor','link.broken':'Bozuk','link.empty':'Link boş','link.access_denied':'Erişim yok / izin kapalı','ann.nav':'Duyurular','ann.title':'Site İçi Duyurular','ann.sub':'Ana sayfa ve APK içinde gösterilecek duyuruları yönet.','ann.newTitle':'Başlık','ann.message':'Mesaj','ann.add':'Duyuru Ekle','ann.empty':'Henüz duyuru yok','ann.active':'Aktif','ann.passive':'Pasif','ann.delete':'Sil','pro.summary':'Canlı Özet'
  };
  const ar = {
    'tmdb.title':'🎞 جلب معلومات TMDB تلقائياً','tmdb.sub':'اكتب الاسم ليتم ملء البوستر والوصف والسنة والتقييم والتصنيف والتريلر. المفتاح يبقى في Vercel Environment Variable.','tmdb.search':'جلب المعلومات','tmdb.placeholder':'اكتب اسم الفيلم/المسلسل واضغط جلب','tmdb.notConfigured':'TMDB_TOKEN غير موجود. أضفه من Vercel → Settings → Environment Variables.','tmdb.noResults':'لا توجد نتائج.','tmdb.apply':'استخدم هذه المعلومات','tmdb.applied':'تم نقل معلومات TMDB إلى النموذج.','tmdb.error':'تعذر جلب معلومات TMDB.','tmdb.posterHint':'سيتم حفظ رابط بوستر TMDB. إذا اخترت ملفاً من جهازك فله الأولوية.',
    'link.check':'تحقق من رابط الفيديو','link.ok':'يعمل','link.broken':'معطل','link.empty':'الرابط فارغ','link.access_denied':'لا يوجد وصول','ann.nav':'الإعلانات','ann.title':'إعلانات الموقع','ann.sub':'إدارة الإعلانات التي تظهر في الصفحة الرئيسية والتطبيق.','ann.newTitle':'العنوان','ann.message':'الرسالة','ann.add':'إضافة إعلان','ann.empty':'لا توجد إعلانات','ann.active':'نشط','ann.passive':'غير نشط','ann.delete':'حذف','pro.summary':'ملخص مباشر'
  };
  function t(k){ return (lang()==='ar' ? ar[k] : tr[k]) || (window.adminT ? window.adminT(k) : k); }
  function toast(msg, type){ if (window.toast) window.toast(msg, type || 'info'); else console.log(msg); }
  async function api(method, path, body){
    const opts = { method, headers:{ 'Content-Type':'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(API + path, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || d.message || ('HTTP ' + r.status));
    return d;
  }
  function injectStyle(){
    if ($('qf-admin-pro-style')) return;
    const style = document.createElement('style');
    style.id = 'qf-admin-pro-style';
    style.textContent = `
      .qf-pro-card{margin:14px 0;padding:15px;border:1px solid rgba(229,9,20,.28);border-radius:18px;background:linear-gradient(135deg,rgba(229,9,20,.13),rgba(255,255,255,.045));box-shadow:0 16px 42px rgba(0,0,0,.22)}
      .qf-pro-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.qf-pro-head h4{font-size:1rem;margin:0}.qf-pro-head p{margin:5px 0 0;color:var(--muted);font-size:.82rem;line-height:1.45}.qf-pro-row{display:flex;gap:8px;align-items:center}.qf-pro-row input,.qf-pro-row select{height:40px;border:1px solid var(--border2);border-radius:12px;background:rgba(0,0,0,.24);color:var(--text);padding:0 12px;outline:none}.qf-pro-row input{flex:1}.qf-pro-row button,.qf-pro-btn{height:40px;border:0;border-radius:12px;background:#e50914;color:#fff;font-weight:900;padding:0 14px;cursor:pointer}.qf-pro-btn.secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.13)}.qf-tmdb-status{margin-top:8px;color:var(--muted);font-size:.78rem}.qf-tmdb-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:12px}.qf-tmdb-item{display:flex;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(0,0,0,.24)}.qf-tmdb-item img{width:58px;height:86px;object-fit:cover;border-radius:10px;background:#111}.qf-tmdb-item b{display:block;font-size:.9rem}.qf-tmdb-item small{display:block;color:var(--muted);margin:4px 0}.qf-tmdb-item p{margin:0;color:var(--muted);font-size:.76rem;line-height:1.35;max-height:42px;overflow:hidden}.qf-tmdb-item button{align-self:flex-start;margin-top:8px;border:0;border-radius:10px;background:rgba(229,9,20,.86);color:#fff;font-size:.76rem;font-weight:900;padding:8px 10px;cursor:pointer}.qf-hidden-meta{display:none!important}.qf-link-check-inline{display:flex;gap:8px;align-items:center;margin-top:8px}.qf-link-check-inline span{font-size:.8rem;color:var(--muted)}.qf-link-ok{color:#22c55e!important}.qf-link-bad{color:#ef4444!important}.qf-ann-form{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin:14px 0}.qf-ann-form input,.qf-ann-form textarea,.qf-ann-form select{border:1px solid var(--border2);border-radius:12px;background:rgba(0,0,0,.25);color:var(--text);padding:10px}.qf-ann-form textarea{min-height:42px;resize:vertical}.qf-ann-list{display:grid;gap:10px}.qf-ann-item{display:flex;justify-content:space-between;gap:12px;padding:13px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.045)}.qf-ann-item p{margin:5px 0 0;color:var(--muted);font-size:.86rem}.qf-ann-actions{display:flex;gap:7px;align-items:center}.qf-pro-summary{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.qf-pro-pill{padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);font-size:.82rem;color:var(--muted)}.qf-pro-pill b{color:var(--text)}
      @media(max-width:720px){.qf-pro-row,.qf-ann-form{grid-template-columns:1fr;display:grid}.qf-pro-row button{width:100%}.qf-pro-head{display:block}}
    `;
    document.head.appendChild(style);
  }
  function setVal(id, value){ const el=$(id); if (el && value !== undefined && value !== null && String(value) !== '') el.value = value; }
  function injectHiddenMeta(){
    const formCard = document.querySelector('#view-series .form-card');
    if (!formCard || $('s-poster-url')) return;
    const wrap = document.createElement('div');
    wrap.className = 'qf-hidden-meta';
    wrap.innerHTML = `
      <input type="hidden" id="s-poster-url"><input type="hidden" id="s-banner-url"><input type="hidden" id="s-trailer"><input type="hidden" id="s-tmdb-id"><input type="hidden" id="s-tmdb-type"><input type="hidden" id="s-original-title"><input type="hidden" id="s-cast">
    `;
    formCard.appendChild(wrap);
  }
  function injectTMDBPanel(){
    const titleGroup = $('s-title')?.closest('.form-group');
    const formCard = document.querySelector('#view-series .form-card');
    if (!titleGroup || !formCard || $('qf-tmdb-card')) return;
    injectHiddenMeta();
    const card = document.createElement('div');
    card.id = 'qf-tmdb-card';
    card.className = 'qf-pro-card';
    card.innerHTML = `
      <div class="qf-pro-head"><div><h4>${t('tmdb.title')}</h4><p>${t('tmdb.sub')}</p></div><button class="qf-pro-btn secondary" type="button" id="qf-tmdb-status-btn">API?</button></div>
      <div class="qf-pro-row"><input id="qf-tmdb-query" placeholder="${esc(t('tmdb.placeholder'))}"><select id="qf-tmdb-type"><option value="multi">Film + Dizi</option><option value="movie">Film</option><option value="tv">Dizi</option></select><button type="button" id="qf-tmdb-search">${t('tmdb.search')}</button></div>
      <div class="qf-tmdb-status" id="qf-tmdb-status">${t('tmdb.posterHint')}</div><div class="qf-tmdb-results" id="qf-tmdb-results"></div>`;
    const descGroup = $('s-desc')?.closest('.form-group');
    formCard.insertBefore(card, descGroup || formCard.children[1]);
    $('qf-tmdb-query').value = $('s-title')?.value || '';
    $('s-title')?.addEventListener('input', () => { if(!$('qf-tmdb-query').value.trim()) $('qf-tmdb-query').value = $('s-title').value; });
    $('qf-tmdb-search')?.addEventListener('click', searchTMDB);
    $('qf-tmdb-query')?.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); searchTMDB(); } });
    $('qf-tmdb-status-btn')?.addEventListener('click', checkTMDBStatus);
    checkTMDBStatus(false);
  }
  function currentTmdbSearchType(){
    const selected = $('qf-tmdb-type')?.value || 'multi';
    if (selected !== 'multi') return selected;
    const type = $('s-type')?.value || '';
    if (type === 'movie' || type === 'documentary') return 'movie';
    if (type === 'series' || type === 'yerli') return 'tv';
    return 'multi';
  }
  async function checkTMDBStatus(showToast=true){
    const st = $('qf-tmdb-status');
    try{
      const d = await api('GET','/tmdb/status');
      if(st) st.textContent = d.configured ? `TMDB hazır (${d.envName}).` : t('tmdb.notConfigured');
      if(showToast) toast(d.configured ? 'TMDB hazır' : t('tmdb.notConfigured'), d.configured ? 'success' : 'error');
    }catch(e){ if(st) st.textContent = t('tmdb.notConfigured'); }
  }
  async function searchTMDB(){
    const q = ($('qf-tmdb-query')?.value || $('s-title')?.value || '').trim();
    const results = $('qf-tmdb-results'); const st = $('qf-tmdb-status');
    if(!q){ if(st) st.textContent = t('tmdb.placeholder'); return; }
    if(results) results.innerHTML = '<div class="skeleton skeleton-item"></div>';
    if(st) st.textContent = 'TMDB aranıyor...';
    try{
      const d = await api('GET', `/tmdb/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(currentTmdbSearchType())}&language=tr-TR`);
      const items = d.results || [];
      if(!items.length){ if(results) results.innerHTML = ''; if(st) st.textContent = t('tmdb.noResults'); return; }
      if(st) st.textContent = `${items.length} sonuç bulundu.`;
      if(results) results.innerHTML = items.map(item => `
        <div class="qf-tmdb-item"><img src="${esc(item.poster || '')}" alt="" onerror="this.style.display='none'"><div><b>${esc(item.title)}</b><small>${esc(item.type === 'movie' ? 'Film' : 'Dizi')} ${item.releaseYear ? '• '+item.releaseYear : ''} ${item.rating ? '• ⭐ '+item.rating : ''}</small><p>${esc(item.description || '')}</p><button type="button" onclick="qfApplyTMDB('${esc(item.tmdbType)}','${esc(item.tmdbId)}')">${t('tmdb.apply')}</button></div></div>`).join('');
    }catch(e){ if(results) results.innerHTML=''; if(st) st.textContent = e.message || t('tmdb.error'); toast(e.message || t('tmdb.error'), 'error'); }
  }
  async function applyTMDB(mediaType, id){
    const st = $('qf-tmdb-status'); if(st) st.textContent = 'Detaylar alınıyor...';
    try{
      const d = await api('GET', `/tmdb/details/${encodeURIComponent(mediaType)}/${encodeURIComponent(id)}?language=tr-TR`);
      setVal('s-title', d.title); setVal('qf-tmdb-query', d.title); setVal('s-desc', d.description); setVal('s-desc-tr', d.description_tr || d.description);
      setVal('s-year', d.releaseYear); setVal('s-rating', d.rating); setVal('s-cats', (d.categories || []).join(', '));
      setVal('s-poster-url', d.poster); setVal('s-banner-url', d.banner); setVal('s-trailer', d.trailerUrl); setVal('s-tmdb-id', d.tmdbId); setVal('s-tmdb-type', d.tmdbType); setVal('s-original-title', d.originalTitle); setVal('s-cast', (d.cast || []).join(', '));
      if (d.type === 'movie' && $('s-type')) { $('s-type').value = 'movie'; window.onContentTypeChange?.(); }
      if (d.duration && $('s-duration')) setVal('s-duration', d.duration);
      const prev = $('s-poster-prev'); if(prev && d.poster){ prev.src = d.poster; prev.style.display = 'block'; }
      const bprev = $('s-banner-prev'); if(bprev && d.banner){ bprev.src = d.banner; bprev.style.display = 'block'; }
      if(st) st.textContent = t('tmdb.applied'); toast(t('tmdb.applied'), 'success');
    }catch(e){ if(st) st.textContent = e.message || t('tmdb.error'); toast(e.message || t('tmdb.error'), 'error'); }
  }
  window.qfApplyTMDB = applyTMDB;

  function injectLinkCheck(){
    const group = $('s-video-group');
    if (!group || $('qf-link-check')) return;
    const wrap = document.createElement('div');
    wrap.className = 'qf-link-check-inline';
    wrap.innerHTML = `<button type="button" class="qf-pro-btn secondary" id="qf-link-check">${t('link.check')}</button><span id="qf-link-check-result"></span>`;
    group.appendChild(wrap);
    $('qf-link-check')?.addEventListener('click', async () => {
      const out = $('qf-link-check-result'); if(out) { out.className=''; out.textContent='Kontrol ediliyor...'; }
      try{
        const d = await api('POST','/link-check',{ url: $('s-video')?.value || '' });
        const key = 'link.' + d.status;
        if(out){ out.textContent = t(key) || d.message || d.status; out.className = d.ok ? 'qf-link-ok' : 'qf-link-bad'; }
      }catch(e){ if(out){ out.textContent = e.message; out.className='qf-link-bad'; } }
    });
  }
  function ensureNavItem(view, icon, label){
    if (document.querySelector(`[data-view="${view}"]`)) return;
    const nav = document.querySelector('.sidebar nav'); if(!nav) return;
    const div = document.createElement('div'); div.className='nav-item'; div.dataset.view=view;
    div.innerHTML = `<span class="icon">${icon}</span> <span>${label}</span>`;
    div.onclick = () => window.navigate ? window.navigate(div, view) : null;
    nav.appendChild(div);
  }
  function ensureAnnouncementsView(){
    if ($('view-announcements')) return;
    const content = document.querySelector('.content'); if(!content) return;
    const view = document.createElement('div'); view.className='view'; view.id='view-announcements';
    view.innerHTML = `<div class="section-header"><div><h2>${t('ann.title')}</h2><div class="sub">${t('ann.sub')}</div></div><button class="btn btn-ghost sm" onclick="qfLoadAnnouncements()">↺</button></div><div class="qf-ann-form"><input id="qf-ann-title" placeholder="${esc(t('ann.newTitle'))}"><textarea id="qf-ann-message" placeholder="${esc(t('ann.message'))}"></textarea><button class="qf-pro-btn" type="button" onclick="qfCreateAnnouncement()">${t('ann.add')}</button></div><div class="qf-ann-list" id="qf-ann-list"></div>`;
    content.appendChild(view);
  }
  async function loadAnnouncements(){
    const list = $('qf-ann-list'); if(!list) return;
    list.innerHTML = '<div class="skeleton skeleton-item"></div>';
    try{
      const items = await api('GET','/announcements');
      if(!items.length){ list.innerHTML = `<div class="empty-state"><div class="empty-icon">📢</div><p>${t('ann.empty')}</p></div>`; return; }
      list.innerHTML = items.map(a => `<div class="qf-ann-item"><div><b>${esc(a.title)}</b><p>${esc(a.message)}</p><small>${new Date(a.createdAt || Date.now()).toLocaleString('tr-TR')}</small></div><div class="qf-ann-actions"><button class="btn btn-info sm" onclick="qfToggleAnnouncement('${a._id}',${a.isActive ? 'false':'true'})">${a.isActive ? t('ann.active') : t('ann.passive')}</button><button class="btn btn-danger sm" onclick="qfDeleteAnnouncement('${a._id}')">${t('ann.delete')}</button></div></div>`).join('');
    }catch(e){ list.innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p></div>`; }
  }
  async function createAnnouncement(){
    try{
      await api('POST','/announcements',{ title: $('qf-ann-title')?.value || '', message: $('qf-ann-message')?.value || '', level: 'info', isActive: true });
      if($('qf-ann-title')) $('qf-ann-title').value=''; if($('qf-ann-message')) $('qf-ann-message').value='';
      toast('Duyuru eklendi','success'); loadAnnouncements();
    }catch(e){ toast(e.message,'error'); }
  }
  async function toggleAnnouncement(id, active){ try{ await api('PATCH','/announcements/'+id,{ isActive: !!active }); loadAnnouncements(); }catch(e){ toast(e.message,'error'); } }
  async function deleteAnnouncement(id){ try{ await api('DELETE','/announcements/'+id); loadAnnouncements(); }catch(e){ toast(e.message,'error'); } }
  window.qfLoadAnnouncements = loadAnnouncements; window.qfCreateAnnouncement = createAnnouncement; window.qfToggleAnnouncement = toggleAnnouncement; window.qfDeleteAnnouncement = deleteAnnouncement;
  function patchNavigate(){
    const original = window.navigate;
    if (typeof original !== 'function' || original._qfProTools) return;
    window.navigate = function(el, view){
      const res = original.apply(this, arguments);
      if(view === 'announcements'){
        const title = $('page-title'); if(title) title.textContent = t('ann.title');
        const bc = $('page-breadcrumb'); if(bc) bc.textContent = 'CineAdmin / ' + t('ann.nav');
        loadAnnouncements();
      }
      return res;
    };
    window.navigate._qfProTools = true;
  }
  async function loadProSummary(){
    const dash = $('view-dashboard'); if(!dash || $('qf-pro-summary')) return;
    const wrap = document.createElement('div'); wrap.id='qf-pro-summary'; wrap.className='qf-pro-summary'; wrap.innerHTML = '<span class="qf-pro-pill">Özet yükleniyor...</span>';
    dash.insertBefore(wrap, dash.firstChild);
    try{
      const d = await api('GET','/admin/summary');
      wrap.innerHTML = `<span class="qf-pro-pill">${t('pro.summary')}</span><span class="qf-pro-pill">Kullanıcı: <b>${d.totalUsers||0}</b></span><span class="qf-pro-pill">Açık rapor: <b>${d.openReports||0}</b></span><span class="qf-pro-pill">İstek: <b>${d.openRequests||0}</b></span><span class="qf-pro-pill">Bölüm: <b>${d.totalEpisodes||0}</b></span>`;
    }catch(e){ wrap.remove(); }
  }
  ready(() => {
    injectStyle(); injectTMDBPanel(); injectLinkCheck(); ensureNavItem('announcements','📢',t('ann.nav')); ensureAnnouncementsView(); loadProSummary();
    setTimeout(patchNavigate, 250); setTimeout(patchNavigate, 900);
  });
})();
