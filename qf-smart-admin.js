(function(){
  'use strict';
  const API = window.location.origin + '/api';
  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function toast2(msg,type){ if(window.toast) window.toast(msg,type||'info'); else console.log(msg); }
  async function api(method,path,body){ const headers={'Content-Type':'application/json'}; if(window.qfAdminHeaders) Object.assign(headers, window.qfAdminHeaders()); const opts={method,headers}; if(body!==undefined) opts.body=JSON.stringify(body); const r=await fetch(API+path,opts); const d=await r.json().catch(()=>({})); if(!r.ok){ if(r.status===401&&typeof window.showAdminLogin==='function') window.showAdminLogin(d.error||'Admin oturumu gerekli.'); throw new Error(d.error||d.message||('HTTP '+r.status)); } return d; }
  function navItem(view, icon, label, badge){
    if(document.querySelector(`[data-view="${view}"]`)) return;
    const nav=document.querySelector('.sidebar nav'); if(!nav) return;
    const item=document.createElement('div'); item.className='nav-item'; item.dataset.view=view;
    item.innerHTML=`<span class="icon">${icon}</span> <span>${label}</span>${badge?`<span class="nav-badge danger" id="${badge}">0</span>`:''}`;
    item.onclick=()=>window.navigate?window.navigate(item,view):null;
    nav.appendChild(item);
  }

  function ensureViews(){
    navItem('linkscan','🔎','Link Tarama','nb-badlinks');
    navItem('security','🛡','Güvenlik','');
    const content=document.querySelector('.content'); if(!content) return;
    if(!$('view-linkscan')){
      const v=document.createElement('div'); v.className='view'; v.id='view-linkscan';
      v.innerHTML=`<div class="section-header"><div><h2>Bozuk Video Link Tarama</h2><div class="sub">Tüm bölümlerdeki video linklerini kontrol eder ve sonucu kaydeder.</div></div><button class="btn btn-ghost sm" onclick="qfLoadLinkScan()">↺</button></div><div class="qf-admin-tool-card"><h3>Toplu link kontrol</h3><p>Önce 30 bölüm taranır. Büyük arşivlerde birkaç kez çalıştırabilirsin.</p><div class="qf-admin-actions"><button class="qf-smart-btn" onclick="qfRunLinkScan(false)">Taramayı Başlat</button><button class="qf-smart-btn secondary" onclick="qfRunLinkScan(true)">Sadece bilinmeyenleri tara</button></div><div id="qf-linkscan-status" class="qf-security-note"></div></div><div id="qf-linkscan-list" class="qf-scan-list"></div>`;
      content.appendChild(v);
    }
    if(!$('view-security')){
      const v=document.createElement('div'); v.className='view'; v.id='view-security';
      v.innerHTML=`<div class="section-header"><div><h2>Admin Güvenliği</h2><div class="sub">Giriş denemeleri, kilit sistemi ve işlem kayıtları.</div></div><button class="btn btn-ghost sm" onclick="qfLoadSecurityLogs()">↺</button></div><div class="qf-admin-tool-card"><h3>Güvenlik durumu</h3><p>5 hatalı girişten sonra panel bu tarayıcıda 60 saniye kilitlenir. Başarılı ve hatalı girişler güvenlik kaydına yazılır.</p><div id="qf-security-status" class="qf-security-note"></div></div><div id="qf-security-list" class="qf-scan-list"></div>`;
      content.appendChild(v);
    }
  }
  function patchNavigate(){
    const original=window.navigate;
    if(typeof original!=='function'||original._qfSmartAdmin) return;
    window.navigate=function(el,view){ const r=original.apply(this,arguments); if(view==='linkscan'){ $('page-title').textContent='Link Tarama'; $('page-breadcrumb').textContent='SineQ Admin / Link Tarama'; loadLinkScan(); } if(view==='security'){ $('page-title').textContent='Güvenlik'; $('page-breadcrumb').textContent='SineQ Admin / Güvenlik'; loadSecurityLogs(); } return r; };
    window.navigate._qfSmartAdmin=true;
  }

  function parseQualityBox(id){
    const raw=($(id)?.value||'').trim(); if(!raw) return [];
    return raw.split(/\n|;;/).map(line=>{
      const m=line.trim().match(/^([^:=|]+)\s*[:=|]\s*(https?:\/\/.+)$/i);
      return m ? {label:m[1].trim(),url:m[2].trim()} : null;
    }).filter(Boolean).slice(0,8);
  }
  function qualityBoxHtml(id, val){
    return `<div class="qf-admin-quality-box"><label style="display:block;margin:8px 0 6px;color:var(--muted);font-size:.76rem;text-transform:uppercase">Kalite Linkleri (opsiyonel)</label><textarea id="${id}" placeholder="480p=https://...\n720p=https://...\n1080p=https://...">${esc(val||'')}</textarea><div class="hint">Bu alan alternatif/fallback değil; kullanıcı player içinde kaliteyi elle seçer.</div></div>`;
  }
  function injectQualityField(){
    const video=$('ep-video'); if(video && !$('ep-quality')) video.closest('.form-group')?.insertAdjacentHTML('beforeend', qualityBoxHtml('ep-quality',''));
  }
  function patchAddEpisode(){
    if(typeof window.addEpisode!=='function'||window.addEpisode._qfSmartAdmin) return;
    window.addEpisode = async function(){
      const v=window.v || (id => ($(id)?.value||'').trim());
      const seasonId=v('ep-season'), seriesId=v('ep-series'), num=parseInt(v('ep-num')), title=v('ep-title'), video=v('ep-video');
      if(!seriesId){ toast2('Seri seçin','error'); return; }
      if(!seasonId){ toast2('Sezon seçin','error'); return; }
      if(!num){ toast2('Bölüm numarası girin','error'); return; }
      if(!title){ toast2('Başlık zorunlu','error'); return; }
      if(!video){ toast2('Video URL zorunlu','error'); return; }
      const btn=$('btn-add-ep'); if(window.setLoading&&btn) window.setLoading(btn,true);
      try{
        let thumbPath=''; const thumbFile=$('ep-thumb-file')?.files?.[0]; if(thumbFile && window.uploadImage) thumbPath=await window.uploadImage(thumbFile);
        await api('POST','/episodes',{seasonId,seriesId,episodeNumber:num,title,description:v('ep-desc'),videoUrl:video,duration:parseInt(v('ep-dur'))||0,thumbnail:thumbPath,qualitySources:parseQualityBox('ep-quality')});
        toast2('✓ Bölüm eklendi '+title,'success'); ['ep-num','ep-title','ep-desc','ep-video','ep-dur','ep-quality'].forEach(id=>{const el=$(id); if(el) el.value='';}); const tf=$('ep-thumb-file'); if(tf) tf.value=''; const prev=$('ep-thumb-prev'); if(prev) prev.style.display='none'; if(window.loadEpisodesList) await window.loadEpisodesList(seriesId);
      }catch(e){ toast2(e.message,'error'); }
      finally{ if(window.setLoading&&btn) window.setLoading(btn,false,'+ Bölüm Ekle'); }
    };
    window.addEpisode._qfSmartAdmin=true;
  }
  function patchEditEpisode(){
    const oldOpen=window.openEditEpisode;
    if(typeof oldOpen==='function'&&!oldOpen._qfSmartAdmin){
      window.openEditEpisode=async function(id,seriesId){ const r=await oldOpen.apply(this,arguments); setTimeout(async()=>{ try{ const ep=await api('GET','/episode/'+id+'?_='+Date.now()); const val=(ep.qualitySources||[]).map(q=>`${q.label}=${q.url}`).join('\n'); const input=$('edit-ep-video'); if(input && !$('edit-ep-quality')) input.closest('.form-group')?.insertAdjacentHTML('beforeend', qualityBoxHtml('edit-ep-quality',val)); }catch(e){} },80); return r; };
      window.openEditEpisode._qfSmartAdmin=true;
    }
    const oldSave=window.saveEditEpisode;
    if(typeof oldSave==='function'&&!oldSave._qfSmartAdmin){
      window.saveEditEpisode=async function(id,seriesId){
        const title=($('edit-ep-title')?.value||'').trim(), video=($('edit-ep-video')?.value||'').trim();
        if(!title){ toast2('Başlık zorunlu','error'); return; } if(!video){ toast2('Video URL zorunlu','error'); return; }
        let thumbnail; const thumbFile=$('edit-ep-thumb-file')?.files?.[0]; if(thumbFile&&window.uploadImage) thumbnail=await window.uploadImage(thumbFile);
        try{ const body={episodeNumber:parseInt($('edit-ep-num')?.value)||1,title,description:($('edit-ep-desc')?.value||'').trim(),videoUrl:video,duration:parseInt($('edit-ep-dur')?.value)||0,qualitySources:parseQualityBox('edit-ep-quality')}; if(thumbnail!==undefined) body.thumbnail=thumbnail; await api('PUT','/episodes/'+id,body); toast2('✓ Bölüm güncellendi','success'); if(window.closeEditModal) window.closeEditModal(); if(window.loadEpisodesList) await window.loadEpisodesList(seriesId); }catch(e){ toast2(e.message,'error'); }
      };
      window.saveEditEpisode._qfSmartAdmin=true;
    }
  }

  function injectBulkTool(){
    const view=$('view-episodes'); if(!view || $('qf-bulk-episodes')) return;
    const card=document.createElement('div'); card.id='qf-bulk-episodes'; card.className='qf-admin-tool-card';
    card.innerHTML=`<h3>Toplu Bölüm Ekle</h3><p>Format: <b>No | Başlık | Süre(saniye) | Video URL | Açıklama | 480p=https...,720p=https...</b><br><small>Thumbnail linki yazmana gerek yok; aşağıdan bilgisayardan görselleri seç.</small></p><textarea id="qf-bulk-lines" placeholder="1 | Bölüm 1 | 2400 | https://drive.google.com/file/d/VIDEO_ID/preview | Açıklama\n2 | Bölüm 2 | 2450 | https://example.com/video2.mp4 | Açıklama | 720p=https://example.com/720.mp4,1080p=https://example.com/1080.mp4"></textarea><div class="qf-bulk-thumb-picker"><label>Thumbnail görselleri (bilgisayardan seç)</label><input type="file" id="qf-bulk-thumbs" accept="image/*" multiple onchange="qfBulkThumbChanged()"><div class="hint">Birden fazla resim seçebilirsin. 1. resim 1. satıra, 2. resim 2. satıra eklenir. Az seçersen kalan bölümlerin thumbnail alanı boş kalır.</div><div id="qf-bulk-thumb-status" class="qf-bulk-thumb-status">Henüz görsel seçilmedi.</div></div><div class="qf-admin-actions"><button class="qf-smart-btn" id="qf-bulk-submit-btn" onclick="qfSubmitBulkEpisodes()">Toplu Ekle</button><button class="qf-smart-btn secondary" onclick="qfFillBulkExample()">Örnek Doldur</button></div><div id="qf-bulk-status" class="qf-security-note"></div>`;
    const list=$('episodes-list-wrap'); view.insertBefore(card, list || null);
  }
  function fillBulkExample(){
    const el=$('qf-bulk-lines');
    if(el) el.value='1 | 1. Bölüm | 2400 | https://drive.google.com/file/d/VIDEO_ID/preview | İlk bölüm açıklaması\n2 | 2. Bölüm | 2450 | https://example.com/video2.mp4 | İkinci bölüm açıklaması | 720p=https://example.com/720.mp4,1080p=https://example.com/1080.mp4';
  }
  function parseBulkQuality(raw){
    return String(raw||'').split(',').map(x=>{
      const m=x.trim().match(/^([^:=|]+)\s*[:=]\s*(https?:\/\/.+)$/i);
      return m?{label:m[1].trim(),url:m[2].trim()}:null;
    }).filter(Boolean).slice(0,8);
  }
  function parseBulkLines(raw){
    return String(raw||'').split('\n').map(line=>line.trim()).filter(Boolean).map((line,idx)=>{
      const parts=line.split('|').map(x=>x.trim());
      // Eski format da bozulmasın: No | Başlık | Süre | Video | Açıklama | ThumbnailURL | Kalite
      const legacyThumb = /^https?:\/\//i.test(parts[5]||'') || /^data:image\//i.test(parts[5]||'');
      const qRaw = legacyThumb ? (parts[6]||'') : (parts[5]||'');
      return {
        episodeNumber:Number(parts[0])||idx+1,
        title:parts[1]||`Bölüm ${idx+1}`,
        duration:Number(parts[2])||0,
        videoUrl:parts[3]||'',
        description:parts[4]||'',
        thumbnail:legacyThumb ? (parts[5]||'') : '',
        qualitySources:parseBulkQuality(qRaw)
      };
    });
  }
  function getBulkThumbFiles(){
    return Array.from($('qf-bulk-thumbs')?.files || []);
  }
  function bulkThumbChanged(){
    const files=getBulkThumbFiles();
    const st=$('qf-bulk-thumb-status');
    if(!st) return;
    if(!files.length){ st.textContent='Henüz görsel seçilmedi.'; return; }
    const names=files.slice(0,5).map(f=>f.name).join(', ');
    st.textContent=`${files.length} thumbnail seçildi: ${names}${files.length>5?'...':''}`;
  }
  async function uploadThumbForEpisode(file, index, total){
    if(!file) return '';
    if(!window.uploadImage) throw new Error('Görsel yükleme fonksiyonu bulunamadı. Sayfayı yenileyip tekrar dene.');
    const st=$('qf-bulk-status');
    if(st) st.textContent=`Thumbnail yükleniyor: ${index+1}/${total}`;
    return await window.uploadImage(file);
  }
  async function submitBulkEpisodes(){
    const st=$('qf-bulk-status'); const btn=$('qf-bulk-submit-btn');
    const seriesId=($('ep-series')?.value||'').trim(); const seasonId=($('ep-season')?.value||'').trim();
    if(!seriesId||!seasonId){ if(st) st.textContent='Önce seri ve sezon seç.'; return; }
    const episodes=parseBulkLines($('qf-bulk-lines')?.value||'');
    if(!episodes.length){ if(st) st.textContent='Bölüm satırı yok.'; return; }
    if(episodes.some(e=>!e.videoUrl)){ if(st) st.textContent='Bazı satırlarda video URL eksik.'; return; }
    const thumbFiles=getBulkThumbFiles();
    try{
      if(btn){ btn.disabled=true; btn.textContent='Ekleniyor...'; }
      // Thumbnail bilgisayardan seçildiyse bölümleri tek tek ekliyoruz.
      // Böylece base64 görseller /episodes/bulk içindeki uzunluk sınırına takılıp bozulmaz.
      if(thumbFiles.length){
        let added=0;
        for(const [idx, ep] of episodes.entries()){
          const thumbnail=await uploadThumbForEpisode(thumbFiles[idx], idx, episodes.length);
          if(thumbnail) ep.thumbnail=thumbnail;
          if(st) st.textContent=`Bölüm ekleniyor: ${idx+1}/${episodes.length}`;
          await api('POST','/episodes',{seriesId,seasonId,...ep});
          added++;
        }
        if(st) st.textContent=`${added} bölüm eklendi. Thumbnail görselleri bilgisayardan yüklendi.`;
      }else{
        if(st) st.textContent='Ekleniyor...';
        const d=await api('POST','/episodes/bulk',{seriesId,seasonId,episodes});
        if(st) st.textContent=`${d.count||episodes.length} bölüm eklendi.`;
      }
      toast2('Toplu bölüm eklendi','success');
      const lines=$('qf-bulk-lines'); if(lines) lines.value='';
      const thumbs=$('qf-bulk-thumbs'); if(thumbs) thumbs.value='';
      const ts=$('qf-bulk-thumb-status'); if(ts) ts.textContent='Henüz görsel seçilmedi.';
      if(window.loadEpisodesList) await window.loadEpisodesList(seriesId);
    }
    catch(e){ if(st) st.textContent=e.message; toast2(e.message,'error'); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='Toplu Ekle'; } }
  }
  window.qfSubmitBulkEpisodes=submitBulkEpisodes; window.qfFillBulkExample=fillBulkExample; window.qfBulkThumbChanged=bulkThumbChanged;

  async function loadLinkScan(){
    const list=$('qf-linkscan-list'); if(!list) return;
    list.innerHTML='<div class="qf-scan-item"><span>Yükleniyor...</span></div>';
    try{
      const d=await api('GET','/admin/link-scan?limit=150');
      const bad=(d.counts||[]).filter(x=>['broken','access_denied','empty'].includes(x._id)).reduce((a,x)=>a+Number(x.count||0),0); const b=$('nb-badlinks'); if(b){ b.textContent=bad; b.style.display=bad?'':'none'; }
      const items=d.items||[];
      if(!items.length){ list.innerHTML='<div class="qf-scan-item"><span>Henüz bölüm yok.</span></div>'; return; }
      list.innerHTML=items.map(x=>{ const st=x.linkStatus||'unknown'; const cls=st==='ok'?'qf-status-ok':(['broken','access_denied','empty'].includes(st)?'qf-status-bad':'qf-status-warn'); return `<div class="qf-scan-item"><div><b>${esc(x.title)}</b><p style="margin:3px 0;color:var(--muted);font-size:.78rem">${esc(String(x.videoUrl||'').slice(0,120))}</p></div><span class="${cls}">${esc(st)}</span></div>`; }).join('');
    }catch(e){ list.innerHTML=`<div class="qf-scan-item"><span>${esc(e.message)}</span></div>`; }
  }
  async function runLinkScan(onlyUnknown){
    const st=$('qf-linkscan-status'); if(st) st.textContent='Taranıyor...';
    try{ const d=await api('POST','/admin/link-scan',{limit:30,onlyUnknown:!!onlyUnknown}); if(st) st.textContent=`${d.scanned||0} bölüm tarandı.`; toast2('Link tarama tamamlandı','success'); loadLinkScan(); loadSmartStats(); }
    catch(e){ if(st) st.textContent=e.message; toast2(e.message,'error'); }
  }
  window.qfLoadLinkScan=loadLinkScan; window.qfRunLinkScan=runLinkScan;

  async function loadSmartStats(){
    const dash=$('view-dashboard'); if(!dash) return;
    let wrap=$('qf-smart-admin-stats');
    if(!wrap){ wrap=document.createElement('div'); wrap.id='qf-smart-admin-stats'; const recent = $('dashboard-recent');
        dash.insertBefore(wrap, recent || null); }
    wrap.innerHTML='<div class="qf-admin-tool-card">İstatistikler yükleniyor...</div>';
    try{
      const d=await api('GET','/admin/stats?_='+Date.now());
      const bad=$('nb-badlinks'); if(bad){ bad.textContent=d.badLinks||0; bad.style.display=d.badLinks?'':'none'; }
      wrap.innerHTML=`<div class="qf-admin-panel-grid"><div class="qf-admin-panel-card"><div class="num">${d.totalUsers||0}</div><div class="lbl">Kayıtlı hesap</div></div><div class="qf-admin-panel-card"><div class="num">${d.activeUsers||0}</div><div class="lbl">Aktif kullanıcı</div></div><div class="qf-admin-panel-card"><div class="num">${d.newUsersToday||0}</div><div class="lbl">Bugün kayıt</div></div><div class="qf-admin-panel-card"><div class="num">${d.totalWatches||0}</div><div class="lbl">İzleme kaydı</div></div><div class="qf-admin-panel-card"><div class="num">${d.openReports||0}</div><div class="lbl">Açık rapor</div></div><div class="qf-admin-panel-card"><div class="num">${d.openRequests||0}</div><div class="lbl">Açık istek</div></div><div class="qf-admin-panel-card"><div class="num">${d.badLinks||0}</div><div class="lbl">Sorunlu link</div></div></div><div class="qf-admin-tool-card"><h3>En çok izlenenler</h3>${(d.topWatched||[]).length?(d.topWatched||[]).map((x,i)=>`<div class="qf-request-vote-card"><b>${i+1}. ${esc(x.title)}</b><small>${x.watches||0} izleme</small></div>`).join(''):'<p>Henüz izleme verisi yok.</p>'}</div><div class="qf-admin-tool-card"><h3>En çok istenenler</h3>${(d.latestRequests||[]).length?(d.latestRequests||[]).map(x=>`<div class="qf-request-vote-card"><b>${esc(x.title)}</b><small>${x.voteCount||0} oy</small></div>`).join(''):'<p>İstek yok.</p>'}</div>`;
    }catch(e){ wrap.innerHTML='<div class="qf-admin-tool-card">İstatistikler yüklenemedi.</div>'; }
  }

  const LOCK_KEY='qf_admin_lock_until', FAIL_KEY='qf_admin_fail_count';
  function lockLeft(){ return Math.max(0, Number(localStorage.getItem(LOCK_KEY)||0)-Date.now()); }
  async function logSecurity(action,detail){ try{ await api('POST','/admin/security-log',{action,detail}); }catch(e){} }
  function patchLogin(){
    const old=window.doLogin; if(typeof old!=='function'||old._qfSmartAdmin) return;
    window.doLogin=function(){
      const left=lockLeft(); const err=$('auth-error');
      if(left>0){ if(err) err.textContent='Çok fazla hatalı deneme. '+Math.ceil(left/1000)+' sn bekle.'; return; }
      old.apply(this,arguments);
      setTimeout(()=>{
        const ok=$('app')?.classList.contains('visible');
        if(ok){ localStorage.removeItem(FAIL_KEY); localStorage.removeItem(LOCK_KEY); logSecurity('admin_login_success','Admin panel girişi başarılı'); }
        else{ const count=Number(localStorage.getItem(FAIL_KEY)||0)+1; localStorage.setItem(FAIL_KEY,String(count)); logSecurity('admin_login_failed','Hatalı admin şifresi denemesi'); if(count>=5){ localStorage.setItem(LOCK_KEY,String(Date.now()+60000)); localStorage.setItem(FAIL_KEY,'0'); if(err) err.textContent='Panel 60 saniye kilitlendi.'; } }
      },520);
    };
    window.doLogin._qfSmartAdmin=true;
  }
  async function loadSecurityLogs(){
    const st=$('qf-security-status'); if(st){ const left=lockLeft(); st.textContent=left>0?'Kilit aktif: '+Math.ceil(left/1000)+' sn':'Kilit yok. Hatalı deneme: '+(localStorage.getItem(FAIL_KEY)||0); }
    const list=$('qf-security-list'); if(!list) return;
    list.innerHTML='<div class="qf-scan-item"><span>Yükleniyor...</span></div>';
    try{ const logs=await api('GET','/admin/security-log?_='+Date.now()); if(!logs.length){ list.innerHTML='<div class="qf-scan-item"><span>Kayıt yok.</span></div>'; return; } list.innerHTML=logs.map(x=>`<div class="qf-scan-item"><div><b>${esc(x.action)}</b><p>${esc(x.detail||'')}</p></div><small>${x.createdAt?new Date(x.createdAt).toLocaleString('tr-TR'):''}</small></div>`).join(''); }
    catch(e){ list.innerHTML='<div class="qf-scan-item"><span>Kayıtlar yüklenemedi.</span></div>'; }
  }
  window.qfLoadSecurityLogs=loadSecurityLogs;

  ready(()=>{ ensureViews(); patchNavigate(); injectQualityField(); injectBulkTool(); patchAddEpisode(); patchEditEpisode(); patchLogin(); loadSmartStats(); setTimeout(()=>{ ensureViews(); patchNavigate(); injectQualityField(); injectBulkTool(); patchAddEpisode(); patchEditEpisode(); loadLinkScan(); },800); });
})();
