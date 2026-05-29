(function(){
  'use strict';
  const API = window.location.origin + '/api';
  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function t(key){
    const lang = localStorage.getItem('qfLang') || localStorage.getItem('qasimflix_lang') || 'tr';
    const tr = {'nav.requests':'İstekler','requests.title':'Kullanıcı İçerik İstekleri','requests.sub':'Sitede olmayan film/dizi istekleri','requests.empty':'Henüz istek yok','requests.open':'Bekliyor','requests.done':'Tamamlandı','requests.markDone':'Tamamlandı','requests.reopen':'Geri al','requests.delete':'Sil','requests.user':'Kullanıcı','requests.date':'Tarih','requests.year':'Yıl'};
    const ar = {'nav.requests':'الطلبات','requests.title':'طلبات المحتوى','requests.sub':'طلبات الأفلام والمسلسلات غير الموجودة','requests.empty':'لا توجد طلبات','requests.open':'قيد الانتظار','requests.done':'مكتمل','requests.markDone':'اكتمل','requests.reopen':'إرجاع','requests.delete':'حذف','requests.user':'المستخدم','requests.date':'التاريخ','requests.year':'السنة'};
    return ((lang==='ar'?ar:tr)[key]) || (window.adminT ? window.adminT(key) : key);
  }
  async function apiRaw(method, path, body){
    const opts = { method, headers:{'Content-Type':'application/json'} };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(API + path, opts);
    const d = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error || d.message || 'HTTP ' + r.status);
    return d;
  }
  function ensureNav(){
    if (document.querySelector('[data-view="requests"]')) return;
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.view = 'requests';
    item.innerHTML = `<span class="icon">✉</span> <span data-i18n="nav.requests">${t('nav.requests')}</span><span class="nav-badge" id="nb-requests">0</span>`;
    item.onclick = () => window.navigate ? navigate(item, 'requests') : null;
    nav.appendChild(item);
  }
  function ensureView(){
    if (document.getElementById('view-requests')) return;
    const content = document.querySelector('.content');
    if (!content) return;
    const view = document.createElement('div');
    view.className = 'view';
    view.id = 'view-requests';
    view.innerHTML = `<div class="section-header"><div><h2 data-i18n="requests.title">${t('requests.title')}</h2><div class="sub" data-i18n="requests.sub">${t('requests.sub')}</div></div><button class="btn btn-ghost sm" type="button" onclick="qfLoadRequests()">↺</button></div><div id="qf-admin-requests" class="qf-admin-request-list"><div class="skeleton skeleton-item"></div></div>`;
    content.appendChild(view);
  }
  function patchNavigate(){
    const original = window.navigate;
    if (typeof original !== 'function' || original._qfRequests) return;
    window.navigate = function(el, view){
      const r = original.apply(this, arguments);
      if (view === 'requests') {
        document.getElementById('page-title').textContent = t('requests.title');
        document.getElementById('page-breadcrumb').textContent = 'CineAdmin / ' + t('nav.requests');
        loadRequests();
      }
      return r;
    };
    window.navigate._qfRequests = true;
  }
  async function loadRequests(){
    const wrap = document.getElementById('qf-admin-requests');
    if(!wrap) return;
    wrap.innerHTML = '<div class="skeleton skeleton-item"></div>';
    try{
      const items = await apiRaw('GET','/content-requests');
      const badge = document.getElementById('nb-requests'); if(badge) badge.textContent = items.filter(x=>x.status!=='done').length;
      if(!items.length){ wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">✉</div><p>${t('requests.empty')}</p></div>`; return; }
      wrap.innerHTML = items.map(x => {
        const user = x.userEmail || x.userName || x.userId || '—';
        const date = x.createdAt ? new Date(x.createdAt).toLocaleString('tr-TR') : '—';
        const done = x.status === 'done';
        return `<div class="qf-admin-request-card"><div><h4>${esc(x.title)} ${x.releaseYear ? `<small>(${esc(x.releaseYear)})</small>` : ''}</h4><div class="qf-admin-request-meta"><span>${t('requests.date')}: ${esc(date)}</span><span>${t('requests.user')}: ${esc(user)}</span><span class="${done?'qf-status-done':'qf-status-open'}">${done?t('requests.done'):t('requests.open')}</span></div>${x.note ? `<p>${esc(x.note)}</p>` : ''}</div><div class="qf-admin-request-actions"><button class="btn btn-info sm" onclick="qfSetRequestStatus('${x._id}','${done?'open':'done'}')">${done?t('requests.reopen'):t('requests.markDone')}</button><button class="btn btn-danger sm" onclick="qfDeleteRequest('${x._id}')">${t('requests.delete')}</button></div></div>`;
      }).join('');
    }catch(e){ wrap.innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p></div>`; }
  }
  async function setStatus(id, status){
    try{ await apiRaw('PATCH','/content-requests/'+id,{status}); if(window.toast) toast(status==='done' ? t('requests.done') : t('requests.open'), 'success'); loadRequests(); }
    catch(e){ if(window.toast) toast(e.message, 'error'); }
  }
  async function delReq(id){
    try{ await apiRaw('DELETE','/content-requests/'+id); if(window.toast) toast(t('requests.delete'), 'info'); loadRequests(); }
    catch(e){ if(window.toast) toast(e.message, 'error'); }
  }
  window.qfLoadRequests = loadRequests;
  window.qfSetRequestStatus = setStatus;
  window.qfDeleteRequest = delReq;
  function patchContentTypeLabels(){
    const type = document.getElementById('s-type');
    const titleLabel = document.querySelector('label [data-i18n="form.title"]');
    const titleInput = document.getElementById('s-title');
    if(!type) return;
    const apply = () => {
      const isMovie = type.value === 'movie' || type.value === 'documentary';
      if(titleLabel) titleLabel.textContent = isMovie ? 'Film Adı' : 'Dizi Adı';
      if(titleInput) titleInput.placeholder = isMovie ? 'örn. Requiem for a Dream' : 'örn. Squid Game';
      const sea = document.querySelector('[data-view="seasons"]'); const ep = document.querySelector('[data-view="episodes"]');
      if(sea) sea.title = isMovie ? 'Film seçilince sezon gerekmiyor' : '';
      if(ep) ep.title = isMovie ? 'Film seçilince bölüm otomatik oluşur' : '';
    };
    type.addEventListener('change', apply);
    apply();
  }
  document.addEventListener('qf-lang-changed', () => { ensureNav(); ensureView(); });
  ready(() => { ensureNav(); ensureView(); patchNavigate(); patchContentTypeLabels(); setTimeout(loadRequests, 500); });
})();
