(function(){
  'use strict';
  const API = window.location.origin + '/api';
  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const lang = () => localStorage.getItem('sineq_lang') || localStorage.getItem('qfLang') || 'tr';
  const dict = {
    tr:{forYou:'✨ Senin İçin Öneriler', forYouSub:'İzlediklerine ve popüler içeriklere göre', topRequests:'En çok istenenler', vote:'Oy ver', votes:'oy', reviewTitle:'Yorumunu yaz', reviewPh:'Yorumun...', send:'Gönder', loginReview:'Yorum için giriş yapmalısın.', sent:'Kaydedildi', detailInfo:'İçerik bilgileri', cast:'Oyuncular', cats:'Kategoriler', year:'Yıl', type:'Tür'},
    ar:{forYou:'✨ مقترحات لك', forYouSub:'حسب مشاهداتك والمحتوى الرائج', topRequests:'الأكثر طلباً', vote:'صوّت', votes:'صوت', reviewTitle:'اكتب تعليقك', reviewPh:'تعليقك...', send:'إرسال', loginReview:'يجب تسجيل الدخول للتعليق.', sent:'تم الحفظ', detailInfo:'معلومات المحتوى', cast:'الممثلون', cats:'الفئات', year:'السنة', type:'النوع'},
    en:{forYou:'✨ Recommended for You', forYouSub:'Based on your watching and popular content', topRequests:'Most requested', vote:'Vote', votes:'votes', reviewTitle:'Write a review', reviewPh:'Your review...', send:'Send', loginReview:'Sign in to review.', sent:'Saved', detailInfo:'Content info', cast:'Cast', cats:'Categories', year:'Year', type:'Type'}
  };
  function t(k){ const l=lang(); return (dict[l]&&dict[l][k]) || dict.tr[k] || k; }
  function getUserId(){ return localStorage.getItem('userId') || window.USER_ID || 'guest'; }
  function getToken(){ return localStorage.getItem('token') || window.TOKEN || ''; }
  function toast(msg){ if(window.qfToast) window.qfToast(msg); else console.log(msg); }
  function renderCard(item){ return window.createCard ? window.createCard(item) : `<div class="qf-smart-card"><b>${esc(item.title)}</b></div>`; }

  async function loadRecommendations(){
    const main = $('main-sections'); if(!main || $('qf-recommend-section')) return;
    const section = document.createElement('div');
    section.className='section'; section.id='qf-recommend-section';
    section.innerHTML = `<div class="section-title">${t('forYou')}</div><div class="qf-smart-title"><small>${t('forYouSub')}</small></div><div class="cards-row" id="qf-recommend-row"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>`;
    const popular = $('popular-section'); main.insertBefore(section, popular || main.firstChild);
    try{
      const r = await fetch(API + '/recommendations/' + encodeURIComponent(getUserId()) + '?_=' + Date.now());
      const items = r.ok ? await r.json() : [];
      const row = $('qf-recommend-row');
      if(!row) return;
      if(!items.length){ section.style.display='none'; return; }
      row.innerHTML = items.map(renderCard).join('');
      if(window.initCarousels) setTimeout(window.initCarousels, 50);
    }catch(e){ section.style.display='none'; }
  }

  async function loadTopRequests(){
    let host = $('qf-content-request');
    if(!host) return setTimeout(loadTopRequests, 600);
    if($('qf-top-requests')) return;
    const box = document.createElement('div'); box.id='qf-top-requests'; box.className='qf-top-requests qf-smart-card';
    box.innerHTML = `<div class="qf-smart-title"><h3>${t('topRequests')}</h3><button class="qf-smart-btn secondary" type="button" onclick="qfLoadTopRequests()">↺</button></div><div id="qf-top-requests-list"><small>Yükleniyor...</small></div>`;
    host.appendChild(box);
    await refreshTopRequests();
  }
  async function refreshTopRequests(){
    const list = $('qf-top-requests-list'); if(!list) return;
    try{
      const r = await fetch(API + '/content-requests/public?_=' + Date.now());
      const items = r.ok ? await r.json() : [];
      if(!items.length){ list.innerHTML='<small>Henüz istek yok.</small>'; return; }
      list.innerHTML = items.slice(0,8).map(x => `<div class="qf-request-vote-card"><div><b>${esc(x.title)} ${x.releaseYear ? '('+esc(x.releaseYear)+')' : ''}</b><br><small>${Number(x.voteCount||0)} ${t('votes')}</small></div><button class="qf-smart-btn secondary" onclick="qfVoteRequest('${x._id}')">▲ ${t('vote')}</button></div>`).join('');
    }catch(e){ list.innerHTML='<small>İstekler yüklenemedi.</small>'; }
  }
  async function voteRequest(id){
    try{
      const r = await fetch(API + '/content-requests/' + id + '/vote', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:getUserId()})});
      if(!r.ok) throw new Error('vote failed');
      toast('Oy verildi'); refreshTopRequests();
    }catch(e){ toast('Oy verilemedi'); }
  }
  window.qfLoadTopRequests = refreshTopRequests;
  window.qfVoteRequest = voteRequest;

  function injectDetailInfo(){
    const body = document.querySelector('#detail-modal .modal-body');
    const s = window.currentSeries; if(!body || !s) return;
    let box = $('qf-detail-extra');
    if(!box){ box = document.createElement('div'); box.id='qf-detail-extra'; box.className='qf-detail-extra'; const desc=$('modal-desc'); if(desc) desc.insertAdjacentElement('afterend', box); else body.appendChild(box); }
    const chips=[];
    if(s.releaseYear) chips.push(`<span class="qf-detail-chip">${t('year')}: ${esc(s.releaseYear)}</span>`);
    if(s.type) chips.push(`<span class="qf-detail-chip">${t('type')}: ${esc(s.type)}</span>`);
    if(s.rating) chips.push(`<span class="qf-detail-chip">⭐ ${esc(s.rating)}/10</span>`);
    if((s.categories||[]).length) chips.push(`<span class="qf-detail-chip">${t('cats')}: ${esc((s.categories||[]).join(', '))}</span>`);
    const cast = (s.cast||[]).length ? `<p><b>${t('cast')}:</b> ${esc((s.cast||[]).slice(0,12).join(', '))}</p>` : '';
    box.innerHTML = `<b>${t('detailInfo')}</b><div class="qf-detail-extra-row">${chips.join('')}</div>${cast}`;
  }

  function injectReviewForm(seriesId){
    const ratingArea = $('rating-reviews-area');
    const body = document.querySelector('#detail-modal .modal-body');
    const host = ratingArea || body; if(!host || !seriesId || $('qf-review-form')) return;
    const form = document.createElement('div'); form.id='qf-review-form'; form.className='qf-review-form';
    form.innerHTML = `<b>${t('reviewTitle')}</b><div class="qf-review-form-row"><select id="qf-review-rating"><option value="5">⭐⭐⭐⭐⭐ 5</option><option value="4">⭐⭐⭐⭐ 4</option><option value="3">⭐⭐⭐ 3</option><option value="2">⭐⭐ 2</option><option value="1">⭐ 1</option></select><textarea id="qf-review-text" placeholder="${esc(t('reviewPh'))}"></textarea><button class="qf-smart-btn" id="qf-review-send" type="button">${t('send')}</button></div><span class="qf-review-status" id="qf-review-status"></span>`;
    if(ratingArea) ratingArea.insertBefore(form, ratingArea.firstChild); else host.appendChild(form);
    $('qf-review-send').onclick = () => submitInlineReview(seriesId);
  }
  async function submitInlineReview(seriesId){
    const token = getToken(); const st=$('qf-review-status');
    if(!token){ if(st) st.textContent=t('loginReview'); return; }
    const btn=$('qf-review-send'); if(btn) btn.disabled=true;
    try{
      const r = await fetch(API + '/ratings/add', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({seriesId,rating:Number($('qf-review-rating')?.value||5),review:$('qf-review-text')?.value||''})});
      const d = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error || 'error');
      if(st) st.textContent=t('sent'); if($('qf-review-text')) $('qf-review-text').value='';
      if(window.loadRatings) setTimeout(()=>window.loadRatings(seriesId), 150);
    }catch(e){ if(st) st.textContent=e.message || 'Hata'; }
    finally{ if(btn) btn.disabled=false; }
  }

  function patchDetail(){
    const original = window.openDetail;
    if(typeof original !== 'function' || original._qfSmartPublic) return;
    window.openDetail = async function(seriesId){
      const res = await original.apply(this, arguments);
      setTimeout(()=>{ injectDetailInfo(); injectReviewForm(seriesId); }, 180);
      setTimeout(()=>{ injectDetailInfo(); injectReviewForm(seriesId); }, 700);
      return res;
    };
    window.openDetail._qfSmartPublic = true;
  }
  function patchRatings(){
    const original = window.loadRatings;
    if(typeof original !== 'function' || original._qfSmartPublic) return;
    window.loadRatings = async function(seriesId){
      const res = await original.apply(this, arguments);
      setTimeout(()=>injectReviewForm(seriesId), 30);
      return res;
    };
    window.loadRatings._qfSmartPublic = true;
  }

  ready(()=>{ loadRecommendations(); loadTopRequests(); setTimeout(patchDetail, 300); setTimeout(patchDetail, 1000); setTimeout(patchRatings, 300); setTimeout(patchRatings, 1000); });
})();
