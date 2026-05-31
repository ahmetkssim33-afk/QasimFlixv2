/* QasimFlix Player Failsafe: hata paneli, tekrar dene, alternatif kalite ve tek tık rapor */
(function(){
  'use strict';
  let loadTimer = null;
  let reportedOnce = false;

  function $(id){ return document.getElementById(id); }
  function playerOpen(){ return $('player-modal')?.classList.contains('open'); }
  function esc(s){ return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function toast(msg){ if (window.qfToast) window.qfToast(msg); else console.log(msg); }
  function currentEpisode(){ return window.currentEpisode || null; }
  function currentSeries(){ return window.currentSeries || null; }

  function injectStyle(){
    if ($('qf-player-failsafe-style')) return;
    const style = document.createElement('style');
    style.id = 'qf-player-failsafe-style';
    style.textContent = `
      .qf-player-failsafe{position:absolute;left:50%;bottom:max(74px,env(safe-area-inset-bottom) + 74px);z-index:75;transform:translateX(-50%);width:min(520px,92vw);display:none;padding:14px;border-radius:20px;background:rgba(12,12,16,.92);border:1px solid rgba(255,255,255,.13);box-shadow:0 22px 70px rgba(0,0,0,.62);color:#fff;backdrop-filter:blur(14px)}
      .qf-player-failsafe.show{display:block}.qf-player-failsafe b{display:block;font-size:15px;margin-bottom:5px}.qf-player-failsafe p{margin:0 0 10px;color:rgba(255,255,255,.68);font-size:12px;line-height:1.45}.qf-failsafe-actions{display:flex;gap:8px;flex-wrap:wrap}.qf-failsafe-actions button{border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;font-weight:900;font-size:12px;padding:9px 12px;cursor:pointer}.qf-failsafe-actions button.primary{background:#e50914;border-color:#e50914}.qf-alt-list{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0 0}.qf-alt-list button{border:0;border-radius:999px;background:rgba(229,9,20,.18);color:#fff;font-weight:900;font-size:11px;padding:7px 10px;cursor:pointer}
      @media(max-width:950px){.qf-player-failsafe{bottom:max(18px,env(safe-area-inset-bottom) + 18px)}}`;
    document.head.appendChild(style);
  }

  function panel(){
    injectStyle();
    let el = $('qf-player-failsafe');
    if (el) return el;
    const wrap = $('player-wrap') || $('player-modal') || document.body;
    el = document.createElement('div');
    el.id = 'qf-player-failsafe';
    el.className = 'qf-player-failsafe';
    el.innerHTML = `<b>Video yüklenemedi veya geç açılıyor</b><p>Bağlantı, Google Drive izni veya internet yavaşlığı buna sebep olabilir.</p><div class="qf-failsafe-actions"><button class="primary" data-qf-retry>Tekrar dene</button><button data-qf-report>Admin'e bildir</button><button data-qf-close>Gizle</button></div><div class="qf-alt-list" data-qf-alt-list></div>`;
    wrap.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-qf-close]')) hide();
      if (e.target.closest('[data-qf-retry]')) retry();
      if (e.target.closest('[data-qf-report]')) reportProblem();
      const alt = e.target.closest('[data-qf-alt]');
      if (alt) switchAlternative(Number(alt.dataset.qfAlt));
    });
    return el;
  }

  function alternatives(){
    const ep = currentEpisode();
    const list = Array.isArray(ep?.qualitySources) ? ep.qualitySources : [];
    return list.filter(x => x && x.url).slice(0, 8);
  }

  function renderAlternatives(){
    const listEl = panel().querySelector('[data-qf-alt-list]');
    const list = alternatives();
    if (!listEl) return;
    if (list.length <= 1) { listEl.innerHTML = ''; return; }
    listEl.innerHTML = list.map((x, i) => `<button type="button" data-qf-alt="${i}">${esc(x.label || x.quality || ('Kaynak ' + (i+1)))}</button>`).join('');
  }

  function show(message){
    if (!playerOpen()) return;
    const el = panel();
    if (message) el.querySelector('p').textContent = message;
    renderAlternatives();
    el.classList.add('show');
  }
  function hide(){ panel().classList.remove('show'); }

  function retry(){
    hide();
    const ep = currentEpisode();
    if (ep?._id && typeof window.playEpisode === 'function') {
      toast('Video tekrar deneniyor...');
      window.playEpisode(ep._id);
    } else {
      location.reload();
    }
  }

  async function switchAlternative(index){
    const list = alternatives();
    const selected = list[index];
    if (!selected?.url) return;
    const select = $('quality-select');
    if (select) select.value = String(index);
    hide();
    if (typeof window.changeQuality === 'function') {
      await window.changeQuality();
      toast('Alternatif kaynak açılıyor...');
    }
  }

  async function reportProblem(){
    if (reportedOnce) { toast('Rapor zaten gönderildi.'); return; }
    const ep = currentEpisode();
    const series = currentSeries();
    try {
      const token = localStorage.getItem('token') || window.TOKEN || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      const body = {
        type: 'player',
        message: 'Player hata panelinden otomatik rapor: video açılmıyor/geç açılıyor.',
        pageUrl: location.href,
        userAgent: navigator.userAgent,
        contentTitle: series?.title || ep?.title || '',
        seriesId: series?._id || ep?.seriesId || '',
        episodeId: ep?._id || '',
        episodeNumber: ep?.episodeNumber || undefined,
        videoUrl: ep?.videoUrl || '',
        errorType: 'player_failsafe'
      };
      const r = await fetch('/api/reports', { method:'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('report failed');
      reportedOnce = true;
      toast('Rapor admin paneline gönderildi.');
    } catch (_) {
      toast('Rapor gönderilemedi.');
    }
  }

  function clearTimer(){ if (loadTimer) clearTimeout(loadTimer); loadTimer = null; }
  function armTimer(){
    clearTimer();
    reportedOnce = false;
    if (!playerOpen()) return;
    loadTimer = setTimeout(() => {
      if (!playerOpen()) return;
      const video = $('video-player');
      const embed = $('embed-player');
      const hasHtmlVideo = video && video.style.display !== 'none';
      if (hasHtmlVideo && video.readyState >= 2) return;
      if (embed && embed.style.display !== 'none') {
        show('Google Drive/iframe geç açılıyorsa dosya izni “Herkese açık” olmalı. Açılmazsa rapor gönder.');
      } else {
        show('Video beklenenden uzun sürdü. İnternet veya kaynak linki problemli olabilir.');
      }
    }, 12000);
  }

  function bindVideo(){
    const video = $('video-player');
    if (!video || video._qfFailsafeBound) return;
    video._qfFailsafeBound = true;
    ['canplay','playing','loadedmetadata'].forEach(ev => video.addEventListener(ev, () => { clearTimer(); hide(); }));
    ['error','stalled','abort'].forEach(ev => video.addEventListener(ev, () => show('Video kaynağı yüklenemedi. Alternatif varsa deneyebilir veya admin’e rapor gönderebilirsin.')));
  }

  function observe(){
    bindVideo();
    const modal = $('player-modal');
    if (modal && !modal._qfFailsafeObserved) {
      modal._qfFailsafeObserved = true;
      new MutationObserver(() => playerOpen() ? armTimer() : (clearTimer(), hide())).observe(modal, { attributes:true, attributeFilter:['class'] });
    }
    if (playerOpen()) armTimer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();
  window.qfShowPlayerFailsafe = show;
  window.qfHidePlayerFailsafe = hide;
})();
