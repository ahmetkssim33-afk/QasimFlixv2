(function(){
  'use strict';
  const API = window.location.origin + '/api';
  const LS_CONTINUE = 'qf_continue_local_v2';
  const LS_LISTS = 'qf_user_lists_v2';
  const CLICK_LOCK_MS = 750;
  let lastPlayClick = 0;

  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  const FALLBACK_I18N = {
    tr:{'request.title':'🎬 İçerik isteği gönder','request.subtitle':'Sitede olmayan film veya diziyi bize yaz.','request.name':'Film/dizi adı','request.year':'Yayın yılı','request.note':'Açıklama / not','request.send':'Gönder','request.sent':'İstek gönderildi','request.error':'İstek gönderilemedi','list.watchLater':'Daha sonra izle','list.liked':'Beğendim','list.disliked':'Beğenmedim','list.watched':'İzledim','list.remove':'Listeden kaldır','search.results':'sonuç','player.preparing':'Video hazırlanıyor...'},
    ar:{'request.title':'🎬 إرسال طلب محتوى','request.subtitle':'اكتب لنا الفيلم أو المسلسل غير الموجود.','request.name':'اسم الفيلم/المسلسل','request.year':'سنة العرض','request.note':'وصف / ملاحظة','request.send':'إرسال','request.sent':'تم إرسال الطلب','request.error':'تعذر إرسال الطلب','list.watchLater':'شاهد لاحقاً','list.liked':'أعجبني','list.disliked':'لم يعجبني','list.watched':'تمت المشاهدة','list.remove':'إزالة من القائمة','search.results':'نتيجة','player.preparing':'جاري تجهيز الفيديو...'},
    en:{'request.title':'🎬 Request content','request.subtitle':'Tell us the missing film or series.','request.name':'Film/series name','request.year':'Release year','request.note':'Description / note','request.send':'Send','request.sent':'Request sent','request.error':'Request could not be sent','list.watchLater':'Watch later','list.liked':'Liked','list.disliked':'Disliked','list.watched':'Mark watched','list.remove':'Remove','search.results':'results','player.preparing':'Video is preparing...'},
    'en-GB':{'request.title':'🎬 Request content','request.subtitle':'Tell us the missing film or series.','request.name':'Film/series name','request.year':'Release year','request.note':'Description / note','request.send':'Send','request.sent':'Request sent','request.error':'Request could not be sent','list.watchLater':'Watch later','list.liked':'Liked','list.disliked':'Disliked','list.watched':'Mark watched','list.remove':'Remove','search.results':'results','player.preparing':'Video is preparing...'},
    es:{'request.title':'🎬 Solicitar contenido','request.subtitle':'Dinos la película o serie que falta.','request.name':'Nombre','request.year':'Año','request.note':'Descripción / nota','request.send':'Enviar','request.sent':'Solicitud enviada','request.error':'No se pudo enviar','list.watchLater':'Ver más tarde','list.liked':'Me gusta','list.disliked':'No me gusta','list.watched':'Visto','list.remove':'Eliminar','search.results':'resultados','player.preparing':'Preparando vídeo...'},
    it:{'request.title':'🎬 Richiedi contenuto','request.subtitle':'Scrivi il film o la serie mancante.','request.name':'Nome','request.year':'Anno','request.note':'Descrizione / nota','request.send':'Invia','request.sent':'Richiesta inviata','request.error':'Invio non riuscito','list.watchLater':'Guarda dopo','list.liked':'Mi piace','list.disliked':'Non mi piace','list.watched':'Visto','list.remove':'Rimuovi','search.results':'risultati','player.preparing':'Video in preparazione...'},
    fr:{'request.title':'🎬 Demander un contenu','request.subtitle':'Indique le film ou la série manquante.','request.name':'Nom','request.year':'Année','request.note':'Description / note','request.send':'Envoyer','request.sent':'Demande envoyée','request.error':'Envoi impossible','list.watchLater':'À regarder plus tard','list.liked':'Aimé','list.disliked':'Pas aimé','list.watched':'Vu','list.remove':'Retirer','search.results':'résultats','player.preparing':'Préparation de la vidéo...'},
    de:{'request.title':'🎬 Inhalt anfragen','request.subtitle':'Nenne den fehlenden Film oder die Serie.','request.name':'Name','request.year':'Jahr','request.note':'Beschreibung / Notiz','request.send':'Senden','request.sent':'Anfrage gesendet','request.error':'Anfrage fehlgeschlagen','list.watchLater':'Später ansehen','list.liked':'Gefällt mir','list.disliked':'Gefällt nicht','list.watched':'Gesehen','list.remove':'Entfernen','search.results':'Ergebnisse','player.preparing':'Video wird vorbereitet...'},
    ru:{'request.title':'🎬 Запросить контент','request.subtitle':'Напишите отсутствующий фильм или сериал.','request.name':'Название','request.year':'Год','request.note':'Описание / заметка','request.send':'Отправить','request.sent':'Запрос отправлен','request.error':'Не удалось отправить','list.watchLater':'Смотреть позже','list.liked':'Понравилось','list.disliked':'Не понравилось','list.watched':'Просмотрено','list.remove':'Удалить','search.results':'результатов','player.preparing':'Видео готовится...'},
    zh:{'request.title':'🎬 请求内容','request.subtitle':'告诉我们缺少的电影或剧集。','request.name':'名称','request.year':'年份','request.note':'说明 / 备注','request.send':'发送','request.sent':'请求已发送','request.error':'发送失败','list.watchLater':'稍后观看','list.liked':'喜欢','list.disliked':'不喜欢','list.watched':'已观看','list.remove':'移除','search.results':'结果','player.preparing':'视频准备中...'}
  };
  function currentLang(){ return localStorage.getItem('sineq_lang') || localStorage.getItem('qfLang') || 'tr'; }
  function t(key){ const fromApp = window.qfT ? window.qfT(key) : key; if (fromApp && fromApp !== key) return fromApp; const l = currentLang(); return (FALLBACK_I18N[l] && FALLBACK_I18N[l][key]) || (FALLBACK_I18N.tr && FALLBACK_I18N.tr[key]) || key; }
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function getUserId(){ return localStorage.getItem('userId') || window.USER_ID || 'guest'; }
  function getToken(){ return localStorage.getItem('token') || window.TOKEN || ''; }

  function extendI18n(){
    const extra = {
      tr:{'request.title':'🎬 İçerik isteği gönder','request.subtitle':'Sitede olmayan film veya diziyi bize yaz.','request.name':'Film/dizi adı','request.year':'Yayın yılı','request.note':'Açıklama / not','request.send':'Gönder','request.sent':'İstek gönderildi','request.error':'İstek gönderilemedi','list.watchLater':'Daha sonra izle','list.liked':'Beğendim','list.disliked':'Beğenmedim','list.watched':'İzledim','list.remove':'Listeden kaldır','search.results':'sonuç','profile.signout':'🚪 Çıkış yap','content.film':'Film','player.preparing':'Video hazırlanıyor...'},
      ar:{'request.title':'🎬 إرسال طلب محتوى','request.subtitle':'اكتب لنا الفيلم أو المسلسل غير الموجود.','request.name':'اسم الفيلم/المسلسل','request.year':'سنة العرض','request.note':'وصف / ملاحظة','request.send':'إرسال','request.sent':'تم إرسال الطلب','request.error':'تعذر إرسال الطلب','list.watchLater':'شاهد لاحقاً','list.liked':'أعجبني','list.disliked':'لم يعجبني','list.watched':'تمت المشاهدة','list.remove':'إزالة من القائمة','search.results':'نتيجة','profile.signout':'🚪 تسجيل الخروج','content.film':'فيلم','player.preparing':'جاري تجهيز الفيديو...'},
      en:{'request.title':'🎬 Request content','request.subtitle':'Tell us the missing film or series.','request.name':'Film/series name','request.year':'Release year','request.note':'Description / note','request.send':'Send','request.sent':'Request sent','request.error':'Request could not be sent','list.watchLater':'Watch later','list.liked':'Liked','list.disliked':'Disliked','list.watched':'Mark watched','list.remove':'Remove','search.results':'results','profile.signout':'🚪 Sign out','content.film':'Film','player.preparing':'Video is preparing...'},
      'en-GB':{'request.title':'🎬 Request content','request.subtitle':'Tell us the missing film or series.','request.name':'Film/series name','request.year':'Release year','request.note':'Description / note','request.send':'Send','request.sent':'Request sent','request.error':'Request could not be sent','list.watchLater':'Watch later','list.liked':'Liked','list.disliked':'Disliked','list.watched':'Mark watched','list.remove':'Remove','search.results':'results','profile.signout':'🚪 Sign out','content.film':'Film','player.preparing':'Video is preparing...'},
      es:{'request.title':'🎬 Solicitar contenido','request.subtitle':'Dinos la película o serie que falta.','request.name':'Nombre','request.year':'Año','request.note':'Descripción / nota','request.send':'Enviar','request.sent':'Solicitud enviada','request.error':'No se pudo enviar','list.watchLater':'Ver más tarde','list.liked':'Me gusta','list.disliked':'No me gusta','list.watched':'Visto','list.remove':'Eliminar','search.results':'resultados'},
      it:{'request.title':'🎬 Richiedi contenuto','request.subtitle':'Scrivi il film o la serie mancante.','request.name':'Nome','request.year':'Anno','request.note':'Descrizione / nota','request.send':'Invia','request.sent':'Richiesta inviata','request.error':'Invio non riuscito','list.watchLater':'Guarda dopo','list.liked':'Mi piace','list.disliked':'Non mi piace','list.watched':'Visto','list.remove':'Rimuovi','search.results':'risultati'},
      fr:{'request.title':'🎬 Demander un contenu','request.subtitle':'Indique le film ou la série manquante.','request.name':'Nom','request.year':'Année','request.note':'Description / note','request.send':'Envoyer','request.sent':'Demande envoyée','request.error':'Envoi impossible','list.watchLater':'À regarder plus tard','list.liked':'Aimé','list.disliked':'Pas aimé','list.watched':'Vu','list.remove':'Retirer','search.results':'résultats'},
      de:{'request.title':'🎬 Inhalt anfragen','request.subtitle':'Nenne den fehlenden Film oder die Serie.','request.name':'Name','request.year':'Jahr','request.note':'Beschreibung / Notiz','request.send':'Senden','request.sent':'Anfrage gesendet','request.error':'Anfrage fehlgeschlagen','list.watchLater':'Später ansehen','list.liked':'Gefällt mir','list.disliked':'Gefällt nicht','list.watched':'Gesehen','list.remove':'Entfernen','search.results':'Ergebnisse'},
      ru:{'request.title':'🎬 Запросить контент','request.subtitle':'Напишите отсутствующий фильм или сериал.','request.name':'Название','request.year':'Год','request.note':'Описание / заметка','request.send':'Отправить','request.sent':'Запрос отправлен','request.error':'Не удалось отправить','list.watchLater':'Смотреть позже','list.liked':'Понравилось','list.disliked':'Не понравилось','list.watched':'Просмотрено','list.remove':'Удалить','search.results':'результатов'},
      zh:{'request.title':'🎬 请求内容','request.subtitle':'告诉我们缺少的电影或剧集。','request.name':'名称','request.year':'年份','request.note':'说明 / 备注','request.send':'发送','request.sent':'请求已发送','request.error':'发送失败','list.watchLater':'稍后观看','list.liked':'喜欢','list.disliked':'不喜欢','list.watched':'已观看','list.remove':'移除','search.results':'结果'}
    };
    window.APP_I18N = window.APP_I18N || {};
    Object.keys(extra).forEach(l => window.APP_I18N[l] = Object.assign(window.APP_I18N[l] || {}, extra[l]));
    if (window.qfApplyLang) window.qfApplyLang(localStorage.getItem('sineq_lang') || localStorage.getItem('qfLang') || 'tr');
  }

  function injectRequestBox(){
    if (document.getElementById('qf-content-request')) return;
    const mainSections = document.getElementById('main-sections');
    if (!mainSections) return;
    const box = document.createElement('section');
    box.id = 'qf-content-request';
    box.className = 'qf-content-request';
    box.innerHTML = `<h3 data-i18n="request.title">${t('request.title')}</h3><p data-i18n="request.subtitle">${t('request.subtitle')}</p><div class="qf-request-grid"><input id="qf-req-title" data-i18n-placeholder="request.name" placeholder="${esc(t('request.name'))}"><input id="qf-req-year" type="number" min="1900" max="2100" data-i18n-placeholder="request.year" placeholder="${esc(t('request.year'))}"><textarea id="qf-req-note" data-i18n-placeholder="request.note" placeholder="${esc(t('request.note'))}"></textarea></div><div class="qf-request-actions"><button id="qf-req-send" type="button" data-i18n="request.send">${t('request.send')}</button><span class="qf-request-status" id="qf-req-status"></span></div>`;
    mainSections.appendChild(box);
    box.querySelector('#qf-req-send').addEventListener('click', submitRequest);
  }

  async function submitRequest(){
    const title = document.getElementById('qf-req-title')?.value.trim();
    const releaseYear = document.getElementById('qf-req-year')?.value.trim();
    const note = document.getElementById('qf-req-note')?.value.trim();
    const status = document.getElementById('qf-req-status');
    if (!title) { if(status) status.textContent = t('request.name') + ' zorunlu'; return; }
    const btn = document.getElementById('qf-req-send');
    if (btn) btn.disabled = true;
    try{
      const body = { title, releaseYear, note, userId:getUserId(), userName:document.getElementById('user-display-name')?.textContent || '', userEmail:document.getElementById('dd-email')?.textContent || '' };
      const r = await fetch(API + '/content-requests', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error('request failed');
      ['qf-req-title','qf-req-year','qf-req-note'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      if(status) status.textContent = t('request.sent');
      if(window.qfToast) window.qfToast(t('request.sent'));
    }catch(e){ if(status) status.textContent = t('request.error'); }
    finally{ if(btn) btn.disabled = false; }
  }

  function getLists(){ try { return JSON.parse(localStorage.getItem(LS_LISTS) || '{}'); } catch(e){ return {}; } }
  function setLocalList(seriesId, action){ const data=getLists(); if(action==='remove') delete data[seriesId]; else data[seriesId]={action, updatedAt:Date.now()}; localStorage.setItem(LS_LISTS, JSON.stringify(data)); }
  async function listAction(seriesId, action){
    setLocalList(seriesId, action);
    try{
      const headers = {'Content-Type':'application/json'}; const token=getToken(); if(token) headers.Authorization='Bearer '+token;
      await fetch(API + '/user/list-action', { method:'POST', headers, body:JSON.stringify({ seriesId, action, userId:getUserId() }) });
    }catch(e){}
    if(window.qfToast) window.qfToast(t(action==='remove'?'list.remove':'list.'+action));
  }
  window.qfListAction = listAction;

  function injectListActions(){
    const actions = document.getElementById('modal-actions');
    if (!actions || !window.currentSeries || document.getElementById('qf-list-actions')) return;
    const sid = window.currentSeries._id;
    const wrap = document.createElement('div');
    wrap.id = 'qf-list-actions';
    wrap.className = 'qf-list-actions';
    wrap.innerHTML = `<button onclick="qfListAction('${sid}','watchLater')">${t('list.watchLater')}</button><button onclick="qfListAction('${sid}','liked')">${t('list.liked')}</button><button onclick="qfListAction('${sid}','disliked')">${t('list.disliked')}</button><button onclick="qfListAction('${sid}','watched')">${t('list.watched')}</button><button onclick="qfListAction('${sid}','remove')">${t('list.remove')}</button>`;
    actions.insertAdjacentElement('afterend', wrap);
  }

  function wrapDetail(){
    const original = window.openDetail;
    if (typeof original !== 'function' || original._qfEnhanced) return;
    window.openDetail = async function(){
      const result = await original.apply(this, arguments);
      setTimeout(injectListActions, 40);
      return result;
    };
    window.openDetail._qfEnhanced = true;
  }

  function saveLocalContinue(episodeId, progress){
    try{
      const s = window.currentSeries || {}; const ep = window.currentEpisode || {};
      if (!s._id || !episodeId) return;
      const items = JSON.parse(localStorage.getItem(LS_CONTINUE) || '[]').filter(x => String(x.episodeId?._id || x.episodeId) !== String(episodeId));
      items.unshift({ userId:getUserId(), progress:Number(progress)||1, lastWatchedAt:new Date().toISOString(), seriesId:{ _id:s._id, title:s.title, poster:s.poster, type:s.type }, episodeId:{ _id:episodeId, title:ep.title || s.title, episodeNumber:ep.episodeNumber || 1 } });
      localStorage.setItem(LS_CONTINUE, JSON.stringify(items.slice(0,20)));
    }catch(e){}
  }
  function wrapProgress(){
    const originalSave = window.saveProgress;
    if (typeof originalSave === 'function' && !originalSave._qfEnhanced) {
      window.saveProgress = async function(episodeId){
        const video = document.getElementById('video-player');
        saveLocalContinue(episodeId, video ? Math.floor(video.currentTime || 1) : 1);
        return originalSave.apply(this, arguments);
      };
      window.saveProgress._qfEnhanced = true;
    }
    const originalLoad = window.loadContinueWatching;
    if (typeof originalLoad === 'function' && !originalLoad._qfEnhanced) {
      window.loadContinueWatching = async function(){
        await originalLoad.apply(this, arguments);
        const section = document.getElementById('continue-section'); const row = document.getElementById('continue-row');
        if (!row || (row.children && row.children.length)) return;
        try{
          const local = JSON.parse(localStorage.getItem(LS_CONTINUE) || '[]').filter(x => !x.userId || x.userId === getUserId()).slice(0,10);
          if (!local.length) return;
          section.style.display = '';
          row.innerHTML = local.map(w => window.createResumeCard ? window.createResumeCard(w) : '').join('');
        }catch(e){}
      };
      window.loadContinueWatching._qfEnhanced = true;
    }
  }

  function wrapPlayer(){
    const original = window.playEpisode;
    if (typeof original !== 'function' || original._qfEnhanced) return;
    window.playEpisode = async function(episodeId){
      const now = Date.now();
      if (now - lastPlayClick < CLICK_LOCK_MS) return;
      lastPlayClick = now;
      document.body.classList.add('qf-player-click-lock');
      const info = document.getElementById('player-ep-info'); if (info) info.textContent = t('player.preparing') || 'Video hazırlanıyor...';
      try { return await original.apply(this, arguments); }
      finally { setTimeout(() => document.body.classList.remove('qf-player-click-lock'), CLICK_LOCK_MS); saveLocalContinue(episodeId, 1); }
    };
    window.playEpisode._qfEnhanced = true;
  }

  function overrideSearch(){
    if (typeof window.doSearch !== 'function' || window.doSearch._qfEnhanced) return;
    window.doSearch = async function(query){
      const resultsEl = document.getElementById('search-results'); const grid = document.getElementById('search-grid'); const count = document.getElementById('search-count');
      if (!resultsEl || !grid || !count) return;
      if (!query || query.length < 2) { resultsEl.style.display='none'; document.getElementById('main-sections')?.style.removeProperty('display'); return; }
      resultsEl.style.display='block'; const main=document.getElementById('main-sections'); if(main) main.style.display='none';
      grid.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
      try{
        const r = await fetch(API + '/search/full?q=' + encodeURIComponent(query));
        const items = r.ok ? await r.json() : [];
        count.textContent = `${items.length} ${t('search.results')}: "${query}"`;
        if(!items.length){ grid.innerHTML = '<div class="empty-state"><div class="icon">⌕</div><p>Sonuç bulunamadı</p></div>'; return; }
        grid.innerHTML = items.map(item => {
          const badge = item.matchType && item.matchType.includes('episode') ? `<div class="qf-search-match">Bölüm eşleşmesi: ${esc((item.matchedEpisodes||[]).map(e=>e.title).join(', '))}</div>` : '';
          const html = window.renderCard ? window.renderCard(item, null, null, null) : (window.createCard ? window.createCard(item) : '');
          return html.replace('</div>\n    </div>', `${badge}</div>\n    </div>`);
        }).join('');
      }catch(e){ grid.innerHTML = '<div class="empty-state"><p>Arama yapılamadı</p></div>'; }
    };
    window.doSearch._qfEnhanced = true;
  }

  function relabelStaticTexts(){
    document.querySelectorAll('#series-section .section-title').forEach(el => el.setAttribute('data-i18n','nav.series'));
    document.querySelectorAll('#movies-section .section-title').forEach(el => el.setAttribute('data-i18n','nav.movies'));
    document.querySelectorAll('#documentaries-section .section-title').forEach(el => el.setAttribute('data-i18n','nav.documentaries'));
    if (window.qfApplyLang) window.qfApplyLang(localStorage.getItem('sineq_lang') || localStorage.getItem('qfLang') || 'tr');
  }


  function updateEnhancementTexts(){
    document.querySelectorAll('#qf-content-request [data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('#qf-content-request [data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
    const list = document.getElementById('qf-list-actions');
    if (list && window.currentSeries) { list.remove(); injectListActions(); }
  }

  document.addEventListener('qf-lang-changed', () => { injectRequestBox(); injectListActions(); setTimeout(updateEnhancementTexts, 0); });
  ready(() => {
    extendI18n(); injectRequestBox(); updateEnhancementTexts(); relabelStaticTexts(); wrapDetail(); wrapPlayer(); wrapProgress(); overrideSearch();
    setTimeout(() => { if(window.loadContinueWatching) window.loadContinueWatching(); }, 400);
  });
})();
