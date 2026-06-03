(function(){
  'use strict';
  const API = window.location.origin + '/api';
  const REPORT_NOTIFY_KEY = 'qf_report_notified_session';
  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function lang(){ return localStorage.getItem('qfLang') || localStorage.getItem('sineq_lang') || 'tr'; }
  function t(key){
    const tr = {
      'nav.requests':'İstekler','requests.title':'Kullanıcı İçerik İstekleri','requests.sub':'Sitede olmayan film/dizi istekleri','requests.empty':'Henüz istek yok','requests.open':'Bekliyor','requests.done':'Tamamlandı','requests.markDone':'Tamamlandı','requests.reopen':'Geri al','requests.delete':'Sil','requests.user':'Kullanıcı','requests.date':'Tarih','requests.year':'Yıl',
      'nav.reports':'Raporlar','reports.title':'Kullanıcı Sorun Raporları','reports.sub':'Ayarlardan gönderilen hata ve sorun bildirimleri','reports.empty':'Henüz sorun raporu yok','reports.open':'Yeni','reports.read':'Okundu','reports.resolved':'Çözüldü','reports.markRead':'Okundu yap','reports.resolve':'Çözüldü','reports.reopen':'Yeniden aç','reports.delete':'Sil','reports.user':'Kullanıcı','reports.date':'Tarih','reports.type':'Tür','reports.page':'Sayfa','reports.contact':'İletişim','reports.toast':'Yeni sorun raporu var'
    };
    const ar = {
      'nav.requests':'الطلبات','requests.title':'طلبات المحتوى','requests.sub':'طلبات الأفلام والمسلسلات غير الموجودة','requests.empty':'لا توجد طلبات','requests.open':'قيد الانتظار','requests.done':'مكتمل','requests.markDone':'اكتمل','requests.reopen':'إرجاع','requests.delete':'حذف','requests.user':'المستخدم','requests.date':'التاريخ','requests.year':'السنة',
      'nav.reports':'البلاغات','reports.title':'بلاغات مشاكل المستخدمين','reports.sub':'الأخطاء والمشاكل المرسلة من الإعدادات','reports.empty':'لا توجد بلاغات','reports.open':'جديد','reports.read':'مقروء','reports.resolved':'تم الحل','reports.markRead':'اجعله مقروءاً','reports.resolve':'تم الحل','reports.reopen':'إعادة فتح','reports.delete':'حذف','reports.user':'المستخدم','reports.date':'التاريخ','reports.type':'النوع','reports.page':'الصفحة','reports.contact':'التواصل','reports.toast':'يوجد بلاغ مشكلة جديد'
    };
    return ((lang()==='ar'?ar:tr)[key]) || (window.adminT ? window.adminT(key) : key);
  }

  async function apiRaw(method, path, body){
    const headers = {'Content-Type':'application/json'};
    if (window.qfAdminHeaders) Object.assign(headers, window.qfAdminHeaders());
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(API + path, opts);
    const d = await r.json().catch(()=>({}));
    if(!r.ok) {
      if (r.status === 401 && typeof window.showAdminLogin === 'function') window.showAdminLogin(d.error || 'Admin oturumu gerekli.');
      throw new Error(d.error || d.message || 'HTTP ' + r.status);
    }
    return d;
  }

  function ensureAdminNavItem(view, icon, labelKey, badgeId){
    if (document.querySelector(`[data-view="${view}"]`)) return;
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.view = view;
    item.innerHTML = `<span class="icon">${icon}</span> <span data-i18n="${labelKey}">${t(labelKey)}</span>${badgeId ? `<span class="nav-badge" id="${badgeId}">0</span>` : ''}`;
    item.onclick = () => window.navigate ? navigate(item, view) : null;
    nav.appendChild(item);
  }

  function ensureNav(){
    ensureAdminNavItem('requests', '✉', 'nav.requests', 'nb-requests');
    ensureAdminNavItem('reports', '⚠', 'nav.reports', 'nb-reports');
  }

  function ensureRequestsView(){
    if (document.getElementById('view-requests')) return;
    const content = document.querySelector('.content');
    if (!content) return;
    const view = document.createElement('div');
    view.className = 'view';
    view.id = 'view-requests';
    view.innerHTML = `<div class="section-header"><div><h2 data-i18n="requests.title">${t('requests.title')}</h2><div class="sub" data-i18n="requests.sub">${t('requests.sub')}</div></div><button class="btn btn-ghost sm" type="button" onclick="qfLoadRequests()">↺</button></div><div id="qf-admin-requests" class="qf-admin-request-list"><div class="skeleton skeleton-item"></div></div>`;
    content.appendChild(view);
  }

  function ensureReportsView(){
    if (document.getElementById('view-reports')) return;
    const content = document.querySelector('.content');
    if (!content) return;
    const view = document.createElement('div');
    view.className = 'view';
    view.id = 'view-reports';
    view.innerHTML = `<div class="section-header"><div><h2 data-i18n="reports.title">${t('reports.title')}</h2><div class="sub" data-i18n="reports.sub">${t('reports.sub')}</div></div><button class="btn btn-ghost sm" type="button" onclick="qfLoadReports()">↺</button></div><div id="qf-admin-reports" class="qf-admin-request-list"><div class="skeleton skeleton-item"></div></div>`;
    content.appendChild(view);
  }

  function ensureViews(){ ensureRequestsView(); ensureReportsView(); }

  function patchNavigate(){
    const original = window.navigate;
    if (typeof original !== 'function' || original._qfAdminEnhancements) return;
    window.navigate = function(el, view){
      const r = original.apply(this, arguments);
      if (view === 'requests') {
        document.getElementById('page-title').textContent = t('requests.title');
        document.getElementById('page-breadcrumb').textContent = 'CineAdmin / ' + t('nav.requests');
        loadRequests();
      }
      if (view === 'reports') {
        document.getElementById('page-title').textContent = t('reports.title');
        document.getElementById('page-breadcrumb').textContent = 'CineAdmin / ' + t('nav.reports');
        loadReports(false);
      }
      return r;
    };
    window.navigate._qfAdminEnhancements = true;
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

  function reportStatusLabel(status){
    if (status === 'resolved') return t('reports.resolved');
    if (status === 'read') return t('reports.read');
    return t('reports.open');
  }
  function reportStatusClass(status){ return status === 'resolved' ? 'qf-status-done' : 'qf-status-open'; }
  function reportTypeLabel(type){
    const map = { bug:'Genel hata', player:'Video / oynatma', account:'Hesap / giriş', other:'Diğer' };
    return map[type] || type || '—';
  }
  function maybeNotifyReports(openCount){
    if (!openCount) return;
    const app = document.getElementById('app');
    const visible = app && app.classList.contains('visible');
    if (!visible) return;
    if (sessionStorage.getItem(REPORT_NOTIFY_KEY) === String(openCount)) return;
    sessionStorage.setItem(REPORT_NOTIFY_KEY, String(openCount));
    if (window.toast) toast(`🔔 ${openCount} ${t('reports.toast')}`, 'info');
  }

  async function loadReports(showNotification = false){
    const wrap = document.getElementById('qf-admin-reports');
    if(wrap) wrap.innerHTML = '<div class="skeleton skeleton-item"></div>';
    try{
      const items = await apiRaw('GET','/reports');
      const openCount = items.filter(x=>x.status === 'open' || !x.status).length;
      const badge = document.getElementById('nb-reports');
      if(badge){ badge.textContent = openCount; badge.style.display = openCount ? '' : 'none'; }
      if(showNotification) maybeNotifyReports(openCount);
      if(!wrap) return;
      if(!items.length){ wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠</div><p>${t('reports.empty')}</p></div>`; return; }
      wrap.innerHTML = items.map(x => {
        const user = x.userEmail || x.userName || x.userId || '—';
        const date = x.createdAt ? new Date(x.createdAt).toLocaleString('tr-TR') : '—';
        const page = x.pageUrl ? `<a href="${esc(x.pageUrl)}" target="_blank" rel="noopener">${t('reports.page')}</a>` : '';
        const contact = x.contact ? `<span>${t('reports.contact')}: ${esc(x.contact)}</span>` : '';
        return `<div class="qf-admin-request-card ${x.status === 'open' ? 'qf-admin-report-new' : ''}"><div><h4>⚠ ${esc(reportTypeLabel(x.type))}</h4><div class="qf-admin-request-meta"><span>${t('reports.date')}: ${esc(date)}</span><span>${t('reports.user')}: ${esc(user)}</span>${contact}<span>${page}</span><span class="${reportStatusClass(x.status)}">${reportStatusLabel(x.status)}</span></div><p>${esc(x.message)}</p>${x.userAgent ? `<p style="font-size:.72rem;opacity:.65">${esc(x.userAgent)}</p>` : ''}</div><div class="qf-admin-request-actions"><button class="btn btn-info sm" onclick="qfSetReportStatus('${x._id}','read')">${t('reports.markRead')}</button><button class="btn btn-info sm" onclick="qfSetReportStatus('${x._id}','resolved')">${t('reports.resolve')}</button><button class="btn btn-ghost sm" onclick="qfSetReportStatus('${x._id}','open')">${t('reports.reopen')}</button><button class="btn btn-danger sm" onclick="qfDeleteReport('${x._id}')">${t('reports.delete')}</button></div></div>`;
      }).join('');
    }catch(e){ if(wrap) wrap.innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p></div>`; }
  }

  async function setRequestStatus(id, status){
    try{ await apiRaw('PATCH','/content-requests/'+id,{status}); if(window.toast) toast(status==='done' ? t('requests.done') : t('requests.open'), 'success'); loadRequests(); }
    catch(e){ if(window.toast) toast(e.message, 'error'); }
  }
  async function deleteRequest(id){
    try{ await apiRaw('DELETE','/content-requests/'+id); if(window.toast) toast(t('requests.delete'), 'info'); loadRequests(); }
    catch(e){ if(window.toast) toast(e.message, 'error'); }
  }
  async function setReportStatus(id, status){
    try{ await apiRaw('PATCH','/reports/'+id,{status}); if(window.toast) toast(reportStatusLabel(status), 'success'); loadReports(false); }
    catch(e){ if(window.toast) toast(e.message, 'error'); }
  }
  async function deleteReport(id){
    try{ await apiRaw('DELETE','/reports/'+id); if(window.toast) toast(t('reports.delete'), 'info'); loadReports(false); }
    catch(e){ if(window.toast) toast(e.message, 'error'); }
  }

  window.qfLoadRequests = loadRequests;
  window.qfSetRequestStatus = setRequestStatus;
  window.qfDeleteRequest = deleteRequest;
  window.qfLoadReports = () => loadReports(false);
  window.qfSetReportStatus = setReportStatus;
  window.qfDeleteReport = deleteReport;

  function patchContentTypeLabels(){
    const type = document.getElementById('s-type');
    const titleLabel = document.querySelector('label [data-i18n="form.title"]');
    const titleInput = document.getElementById('s-title');
    if(!type) return;
    const apply = () => {
      const isMovie = type.value === 'movie';
      if(titleLabel) titleLabel.textContent = isMovie ? 'Film Adı' : 'Dizi Adı';
      if(titleInput) titleInput.placeholder = isMovie ? 'örn. Requiem for a Dream' : 'örn. Squid Game';
      const sea = document.querySelector('[data-view="seasons"]'); const ep = document.querySelector('[data-view="episodes"]');
      if(sea) sea.title = isMovie ? 'Film seçilince sezon gerekmiyor' : '';
      if(ep) ep.title = isMovie ? 'Film seçilince bölüm otomatik oluşur' : '';
    };
    type.addEventListener('change', apply);
    apply();
  }

  function observeAdminOpen(){
    const app = document.getElementById('app');
    if(!app) return;
    const run = () => { if(app.classList.contains('visible')) setTimeout(()=>loadReports(true), 350); };
    run();
    new MutationObserver(run).observe(app, { attributes:true, attributeFilter:['class'] });
  }

  document.addEventListener('qf-lang-changed', () => { ensureNav(); ensureViews(); loadReports(false); loadRequests(); });
  ready(() => {
    ensureNav(); ensureViews(); patchNavigate(); patchContentTypeLabels(); observeAdminOpen();
    setTimeout(loadRequests, 500);
    setTimeout(()=>loadReports(true), 650);
    setInterval(()=>loadReports(false), 60000);
  });
})();
