(function(){
  'use strict';
  const API = window.location.origin + '/api';
  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const lang = () => localStorage.getItem('sineq_lang') || localStorage.getItem('qfLang') || 'tr';
  const dict = {
    tr:{broken:'Bu bölüm açılmıyor', sent:'Rapor admine gönderildi', sending:'Gönderiliyor...', trailer:'Fragmanı İzle', close:'Kapat', noTrailer:'Fragman yok'},
    ar:{broken:'هذه الحلقة لا تعمل', sent:'تم إرسال البلاغ إلى الإدارة', sending:'جارٍ الإرسال...', trailer:'مشاهدة الإعلان', close:'إغلاق', noTrailer:'لا يوجد إعلان'},
    en:{broken:'This episode does not open', sent:'Report sent to admin', sending:'Sending...', trailer:'Watch Trailer', close:'Close', noTrailer:'No trailer'}
  };
  function t(k){ const l=lang(); return (dict[l]&&dict[l][k]) || dict.tr[k] || k; }
  function toast(msg){ if(window.qfToast) window.qfToast(msg); else console.log(msg); }
  function injectStyle(){
    if($('qf-public-pro-style')) return;
    const st=document.createElement('style'); st.id='qf-public-pro-style'; st.textContent = `
      .qf-ann-public{position:sticky;top:72px;z-index:90;margin:0 auto 12px;width:min(1180px,calc(100% - 28px));border:1px solid rgba(255,255,255,.10);border-radius:18px;background:linear-gradient(135deg,rgba(245,185,66,.22),rgba(255,255,255,.07));box-shadow:0 18px 54px rgba(0,0,0,.36);backdrop-filter:blur(12px);color:#fff;padding:12px 44px 12px 15px}.qf-ann-public b{display:block;font-size:.94rem}.qf-ann-public p{margin:4px 0 0;color:rgba(255,255,255,.72);font-size:.84rem}.qf-ann-public button{position:absolute;right:10px;top:10px;width:28px;height:28px;border:0;border-radius:999px;background:rgba(0,0,0,.3);color:#fff;cursor:pointer}.qf-trailer-modal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.82);padding:18px}.qf-trailer-modal.open{display:flex}.qf-trailer-box{width:min(920px,96vw);aspect-ratio:16/9;background:#000;border-radius:18px;overflow:hidden;position:relative;box-shadow:0 24px 100px rgba(0,0,0,.7)}.qf-trailer-box iframe{width:100%;height:100%;border:0}.qf-trailer-close{position:absolute;right:10px;top:10px;z-index:2;border:0;border-radius:999px;background:rgba(0,0,0,.7);color:#fff;width:38px;height:38px;font-weight:900;cursor:pointer}.qf-broken-report{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(78px,calc(78px + env(safe-area-inset-bottom)));z-index:76;border:1px solid rgba(245,185,66,.45);border-radius:999px;background:rgba(245,185,66,.22);color:#fff;padding:9px 13px;font:900 12px system-ui;cursor:pointer;backdrop-filter:blur(10px)}.qf-broken-status{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(118px,calc(118px + env(safe-area-inset-bottom)));z-index:76;color:rgba(255,255,255,.82);font:800 12px system-ui;text-shadow:0 1px 8px #000}.qf-loading-steps{font-size:12px;color:rgba(255,255,255,.65);margin-top:4px}@media(max-width:760px){.qf-ann-public{top:62px;width:calc(100% - 20px);border-radius:14px}.qf-broken-report{bottom:max(18px,env(safe-area-inset-bottom));font-size:11px;padding:8px 11px}.qf-broken-status{bottom:max(55px,calc(55px + env(safe-area-inset-bottom)))}}`;
    document.head.appendChild(st);
  }
  async function loadAnnouncements(){
    try{
      const hidden = localStorage.getItem('qf_ann_hidden_v1') || '';
      const r = await fetch(API + '/announcements/public');
      const items = r.ok ? await r.json() : [];
      const item = (items || []).find(x => String(x._id) !== hidden);
      if(!item || $('qf-ann-public')) return;
      const main = document.querySelector('main') || document.body;
      const box = document.createElement('div'); box.id='qf-ann-public'; box.className='qf-ann-public';
      box.innerHTML = `<button aria-label="Kapat">×</button><b>${esc(item.title)}</b><p>${esc(item.message)}</p>`;
      box.querySelector('button').onclick = () => { localStorage.setItem('qf_ann_hidden_v1', String(item._id)); box.remove(); };
      main.insertBefore(box, main.firstChild);
    }catch(e){}
  }
  function youtubeEmbed(url){
    const raw=String(url||'');
    const id=(raw.match(/[?&]v=([^&]+)/)||raw.match(/youtu\.be\/([^?&]+)/)||raw.match(/embed\/([^?&]+)/)||[])[1];
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : raw;
  }
  function ensureTrailerModal(){
    if($('qf-trailer-modal')) return;
    const modal=document.createElement('div'); modal.id='qf-trailer-modal'; modal.className='qf-trailer-modal';
    modal.innerHTML = `<div class="qf-trailer-box"><button class="qf-trailer-close" title="${esc(t('close'))}">×</button><iframe allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    modal.addEventListener('click', e => { if(e.target===modal) closeTrailer(); });
    modal.querySelector('button').onclick=closeTrailer;
    document.body.appendChild(modal);
  }
  function openTrailer(url){ ensureTrailerModal(); const m=$('qf-trailer-modal'); const iframe=m.querySelector('iframe'); iframe.src=youtubeEmbed(url); m.classList.add('open'); document.body.style.overflow='hidden'; }
  function closeTrailer(){ const m=$('qf-trailer-modal'); if(!m)return; m.classList.remove('open'); const iframe=m.querySelector('iframe'); if(iframe) iframe.src=''; document.body.style.overflow=''; }
  window.qfOpenTrailer = openTrailer; window.qfCloseTrailer = closeTrailer;
  function injectTrailerButton(){
    const actions=$('modal-actions'); const s=window.currentSeries;
    if(!actions || !s || !s.trailerUrl || $('qf-trailer-btn')) return;
    const btn=document.createElement('button'); btn.className='btn-info'; btn.id='qf-trailer-btn'; btn.type='button'; btn.textContent='▶ ' + t('trailer'); btn.onclick=()=>openTrailer(s.trailerUrl);
    actions.appendChild(btn);
  }
  function wrapDetail(){
    const original=window.openDetail;
    if(typeof original !== 'function' || original._qfPublicPro) return;
    window.openDetail = async function(){ const res = await original.apply(this, arguments); setTimeout(injectTrailerButton, 50); return res; };
    window.openDetail._qfPublicPro=true;
  }
  function ensureBrokenReportButton(){
    const modal=$('player-modal'); if(!modal || $('qf-broken-report')) return;
    const btn=document.createElement('button'); btn.id='qf-broken-report'; btn.className='qf-broken-report'; btn.type='button'; btn.textContent='⚠ ' + t('broken');
    const status=document.createElement('div'); status.id='qf-broken-status'; status.className='qf-broken-status';
    btn.onclick=sendBrokenReport;
    modal.appendChild(btn); modal.appendChild(status);
  }
  async function sendBrokenReport(){
    const status=$('qf-broken-status'); if(status) status.textContent=t('sending');
    const s=window.currentSeries||{}; const sea=window.currentSeason||{}; const ep=window.currentEpisode||{};
    const body={
      type:'player', errorType:'broken_video', pageUrl:location.href, userAgent:navigator.userAgent,
      userId:localStorage.getItem('userId') || window.USER_ID || 'guest', userName:$('user-display-name')?.textContent || '', userEmail:$('dd-email')?.textContent || '',
      contentTitle:s.title || '', seriesId:s._id || '', seasonNumber:sea.seasonNumber || undefined, episodeNumber:ep.episodeNumber || undefined, episodeId:ep._id || '', videoUrl:ep.videoUrl || '',
      message:`Video açılmıyor bildirimi: ${s.title || ''} ${sea.seasonNumber ? 'S'+sea.seasonNumber : ''}${ep.episodeNumber ? 'E'+ep.episodeNumber : ''}`.trim()
    };
    try{
      const r=await fetch(API + '/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!r.ok) throw new Error('report failed');
      if(status) status.textContent=t('sent'); toast(t('sent'));
      setTimeout(()=>{ if(status) status.textContent=''; }, 3500);
    }catch(e){ if(status) status.textContent='Rapor gönderilemedi'; }
  }
  function improveLoadingText(){
    const texts = lang()==='ar' ? ['جاري تجهيز الفيديو...','يتم فحص الاتصال...','يتم تحميل المشغل...'] : ['Video hazırlanıyor...','Bağlantı kontrol ediliyor...','Player yükleniyor...'];
    let i=0;
    setInterval(()=>{ const el=$('qasim-loading-text'); const modal=$('player-modal'); if(el && modal?.classList.contains('open')) { i=(i+1)%texts.length; el.innerHTML = `${texts[i]}<div class="qf-loading-steps">SineQ</div>`; } }, 1600);
  }
  ready(()=>{ injectStyle(); loadAnnouncements(); ensureTrailerModal(); ensureBrokenReportButton(); improveLoadingText(); setTimeout(wrapDetail, 250); setTimeout(wrapDetail, 900); });
})();
