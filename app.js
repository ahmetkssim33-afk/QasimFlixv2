// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const API = window.location.origin + '/api';
let TOKEN = localStorage.getItem('token') || null;
let USER_ID = localStorage.getItem('userId') || ('user_' + Math.random().toString(36).substr(2, 9));
let AUTH_USER = null; // populated after auth

let heroData = null;
let currentSeries = null;
let currentSeason = null;
let currentEpisode = null;
let currentFilter = null; // null=all, 'series', 'movie'
let allData = []; // global cache for all content

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// AUTH HELPERS & UI
// ═══════════════════════════════════════════════════════════════════

async function initAuth() {
    if (TOKEN) {
        try {
            const res = await fetch(API + '/auth/me', { headers: { 'Authorization': 'Bearer ' + TOKEN } });
            if (res.ok) {
                AUTH_USER = await res.json();
                USER_ID = AUTH_USER._id;
                localStorage.setItem('token', TOKEN);
                localStorage.setItem('userId', USER_ID);
            } else {
                TOKEN = null;
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
            }
        } catch (e) {
            TOKEN = null;
        }
    }
    updateAuthUI();
}

function updateAuthUI() {
    const localBtn = document.getElementById('local-auth-btn');
    const userInfo = document.getElementById('user-info');
    if (AUTH_USER) {
        if (localBtn) localBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = '';
        document.getElementById('user-display-name').textContent = AUTH_USER.name || AUTH_USER.email;
        document.getElementById('dd-name').textContent = AUTH_USER.name || AUTH_USER.email;
        document.getElementById('dd-email').textContent = AUTH_USER.email || '';
    } else {
        if (localBtn) localBtn.style.display = '';
        if (userInfo) userInfo.style.display = 'none';
    }
}

async function openAuthPrompt() {
    const mode = prompt('İşlem: "login" veya "register" (iptal için boş bırakın)');
    if (!mode) return;
    if (mode.toLowerCase() === 'login') return await loginFlow();
    if (mode.toLowerCase() === 'register') return await registerFlow();
    alert('Geçersiz seçenek');
}

async function loginFlow() {
    const email = prompt('Email adresiniz:');
    if (!email) return;
    const password = prompt('Şifreniz:');
    if (!password) return;
    try {
        const res = await fetch(API + '/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Giriş başarısız'); return; }
        TOKEN = data.token;
        await initAuth();
        await loadContinueWatching();
        alert('Giriş başarılı');
    } catch (e) { console.error(e); alert('Giriş hatası'); }
}

async function registerFlow() {
    const email = prompt('Kayıt için email:');
    if (!email) return;
    const name = prompt('İsim (opsiyonel):');
    const password = prompt('Şifre:');
    if (!password) return;
    try {
        const res = await fetch(API + '/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Kayıt başarısız'); return; }
        TOKEN = data.token;
        await initAuth();
        await loadContinueWatching();
        alert('Kayıt başarılı, hoş geldiniz');
    } catch (e) { console.error(e); alert('Kayıt hatası'); }
}

function signOut() {
    TOKEN = null;
    AUTH_USER = null;
    USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    updateAuthUI();
    loadContinueWatching();
}

async function toggleSave(type, itemId) {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    try {
        const res = await fetch(API + '/user/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
            body: JSON.stringify({ type, itemId })
        });
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Hata'); return; }
        alert('Kaydedildi');
    } catch (e) { console.error(e); alert('Sunucu hatası'); }
}

async function loadContinueWatching() {
    try {
        const row = document.getElementById('continue-row');
        if (!row) return;
        const headers = {};
        let url;
        if (TOKEN) { headers['Authorization'] = 'Bearer ' + TOKEN; url = API + '/progress/continue/me'; }
        else { url = API + '/progress/continue/' + USER_ID; }
        const res = await fetch(url, { headers });
        if (!res.ok) { row.innerHTML = ''; document.getElementById('continue-section').style.display = 'none'; return; }
        const data = await res.json();
        if (!data || !data.length) { row.innerHTML = ''; document.getElementById('continue-section').style.display = 'none'; return; }
        document.getElementById('continue-section').style.display = '';
        row.innerHTML = '';
        for (const w of data) {
            // w is a WatchProgress doc; server now populates seriesId and episodeId when available
            try {
                row.innerHTML += createResumeCard(w);
            } catch (err) {
                const s = w.seriesId;
                if (s) row.innerHTML += createCard(s);
            }
        }
    } catch (e) { console.error(e); }
}

function formatTime(sec) {
    sec = Number(sec) || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
}

function createResumeCard(watch) {
    const s = watch.seriesId || {};
    const ep = watch.episodeId || {};
    const posterHtml = s.poster ? `<img class="card-img" src="${esc(s.poster)}" alt="${esc(s.title)}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">` : '';
    const placeholderStyle = s.poster ? 'display:none' : '';
    const epLabel = ep.episodeNumber ? `E${ep.episodeNumber}` : '';
    const epTitle = ep.title || '';
    const progressLabel = formatTime(watch.progress || 0);

    return `
    <div class="card" onclick="openDetail('${s._id}')">
      ${posterHtml}
      <div class="card-placeholder" style="${placeholderStyle}">
        <span class="icon">${s.type === 'movie' ? '🎬' : '📺'}</span>
        <span>${esc(s.title)}</span>
      </div>
      <div class="card-overlay">
        <button class="card-overlay-play" onclick="event.stopPropagation();playEpisode('${ep._id}')">▶</button>
        <div class="card-overlay-title">${esc(s.title)}</div>
        <div class="card-overlay-meta">${epLabel ? epLabel + (epTitle ? ' • ' + esc(epTitle) : '') : esc(s.type || '')} • ${progressLabel}</div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════
function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pad(n) {
    return String(n || 0).padStart(2, '0');
}

// Initialize app on page load: auth, data and continue-watching
(async function boot() {
    try { await initAuth(); } catch (e) { console.warn('initAuth error', e); }
    try { await loadAll(); } catch (e) { console.warn('loadAll error', e); }
    try { await loadContinueWatching(); } catch (e) { /* ignore */ }
})();
// ═══════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════
async function loadAll() {
    try {
        const res = await fetch(API + '/series?page=1&limit=100');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        allData = data.series || [];

        renderHero(allData);
        renderRow('popular-row', allData.slice(0, 12));
        renderRow('series-row', allData.filter(s => s.type === 'series'));
        renderRow('documentaries-row', allData.filter(s => (s.categories||[]).some(c => (c||'').toLowerCase() === 'documentary' || (c||'').toLowerCase() === 'belgesel')));
        renderRow('movies-row', allData.filter(s => s.type === 'movie' || s.type === 'documentary'));
        // Yerli diziler (local) bölümü
        renderRow('local-series-row', allData.filter(s => s.type === 'yerli'));
        // show local section if content exists
        document.getElementById('local-series-section').style.display = (allData.some(s=>s.type==='yerli')) ? '' : 'none';
        initCarousels();

        // Always show sections; show empty state inside row if no content
        document.getElementById('series-section').style.display = '';
        document.getElementById('movies-section').style.display = '';
        document.getElementById('popular-section').style.display = '';
    } catch (err) {
        console.error('Load error:', err);
        document.getElementById('api-notice').classList.add('show');
        clearSkeletons();
    }
}

function clearSkeletons() {
    ['popular-row', 'series-row', 'documentaries-row', 'movies-row'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>İçerik yüklenemedi</p></div>';
    });
}

function toggleSection(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
}

// ═══════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════
function renderHero(list) {
    if (!list.length) return;
    const item = list[0];
    heroData = item;

    const hero = document.getElementById('hero');
    if (item.poster) {
        hero.style.backgroundImage =
            `linear-gradient(to right,rgba(0,0,0,0.85) 40%,transparent 100%),
             linear-gradient(to top,rgba(0,0,0,0.95) 0%,transparent 60%),
             url('${item.poster}')`;
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
    }

    document.getElementById('hero-title').textContent = item.title;
    const lang = localStorage.getItem('qfLang') || 'tr';
    const descText = (lang === 'ar') ? (item.description_ar || item.description || item.description_tr || '') : (item.description_tr || item.description || item.description_ar || '');
    document.getElementById('hero-desc').textContent = descText || (lang === 'ar' ? 'ابدأ بإضافة محتوى من لوحة التحكم.' : 'Keşfet ve izle.');

    const ratingEl = document.getElementById('hero-rating');
    if (item.rating) ratingEl.textContent = '⭐ ' + item.rating + '/10';

    const yearEl = document.getElementById('hero-year');
    if (item.releaseYear) yearEl.textContent = item.releaseYear;

    const catsEl = document.getElementById('hero-cats');
    if (item.categories?.length) catsEl.textContent = item.categories.slice(0, 2).join(' • ');

    document.getElementById('hero-play-btn').style.display = '';
    document.getElementById('hero-info-btn').style.display = '';
}

function heroPlay() {
    if (heroData) openDetail(heroData._id, true);
}

function heroInfo() {
    if (heroData) openDetail(heroData._id, false);
}

// ═══════════════════════════════════════════
// CARD RENDER
// ═══════════════════════════════════════════
function renderRow(rowId, list) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = '';

    if (!list.length) {
        row.innerHTML = '<div class="empty-state" style="width:100%"><div class="icon">📭</div><p>Henüz içerik yok</p></div>';
        return;
    }

    list.forEach(item => {
        row.innerHTML += createCard(item);
    });
    // ensure carousel UI is attached after rendering
    try { initCarousels(); } catch(e) { /* silent */ }
}

function createCard(item) {
    const tKey = item.type || 'series';
    let typeLabel = '📺 Dizi';
    let typeCls = 'badge-series';
    if (tKey === 'movie') { typeLabel = '🎬 Film'; typeCls = 'badge-movie'; }
    else if (tKey === 'documentary') { typeLabel = '🎞 Belgesel'; typeCls = 'badge-documentary'; }
    else if (tKey === 'yerli') { typeLabel = '🇸 Yerli Dizi'; typeCls = 'badge-red'; }
    const cat = item.categories?.[0] || '';
    const rating = item.rating ? item.rating : '';

    const imgHtml = item.poster
        ? `<img class="card-img" src="${esc(item.poster)}" alt="${esc(item.title)}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
        : '';
    const placeholderStyle = item.poster ? 'display:none' : '';

    return `
    <div class="card" onclick="openDetail('${item._id}')">
      ${imgHtml}
      <div class="card-placeholder" style="${placeholderStyle}">
        <span class="icon">${type === 'movie' ? '🎬' : type === 'documentary' ? '🎞' : '📺'}</span>
        <span>${esc(item.title)}</span>
      </div>
      <span class="badge-type ${typeCls}">${typeLabel}</span>
      ${rating ? `<span class="badge-rating">⭐ ${rating}</span>` : ''}
      <div class="card-overlay">
        <button class="card-overlay-play" onclick="event.stopPropagation();openDetail('${item._id}',true)">
          <svg viewBox="0 0 24 24" width="12" height="12"><polygon points="5,3 19,12 5,21" fill="#000"/></svg>
        </button>
        <div class="card-overlay-title">${esc(item.title)}</div>
        <div class="card-overlay-meta">${cat}${cat && rating ? ' • ' : ''}${rating ? '⭐ ' + rating : ''}</div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════
let searchTimer;
function handleSearch(val) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(val.trim()), 250);
}

async function doSearch(query) {
    const resultsEl = document.getElementById('search-results');
    const mainEl = document.getElementById('main-sections');

    if (!query) {
        resultsEl.style.display = 'none';
        mainEl.style.display = '';
        return;
    }

    try {
        const queryLower = query.toLowerCase();
        
        // Local filtering
        let localResults = allData.filter(item => {
            const matchTitle = (item.title || '').toLowerCase().includes(queryLower);
            const matchDesc = ((item.description || '') + ' ' + (item.description_tr||'') + ' ' + (item.description_ar||'')).toLowerCase().includes(queryLower);
            const matchCat = (item.categories || []).some(c => (c || '').toLowerCase().includes(queryLower));
            return matchTitle || matchDesc || matchCat;
        });

        const grid = document.getElementById('search-grid');
        grid.innerHTML = '';
        localResults.forEach(item => { grid.innerHTML += createCard(item); });
        
        document.getElementById('search-count').textContent = localResults.length + ' sonuç (Yerel): "' + query + '"';
        resultsEl.style.display = '';
        mainEl.style.display = 'none';

        // API filtering for broader search
        const res = await fetch(API + '/series/search/' + encodeURIComponent(query));
        if (res.ok) {
            const apiResults = await res.json();
            // Merge results to avoid duplicates
            const mergedResults = [...localResults];
            const localIds = new Set(localResults.map(i => i._id));
            
            apiResults.forEach(item => {
                if (!localIds.has(item._id)) {
                    mergedResults.push(item);
                    localIds.add(item._id);
                }
            });
            
            grid.innerHTML = '';
            mergedResults.forEach(item => { grid.innerHTML += createCard(item); });
            document.getElementById('search-count').textContent = mergedResults.length + ' sonuç: "' + query + '"';
        }
    } catch (err) {
        console.error('Search error:', err);
    }
}

// ═══════════════════════════════════════════
// CATEGORY FILTER
// ═══════════════════════════════════════════
function showCategory(type, btn) {
    currentFilter = type;
    setActiveNavBtn(btn);
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('main-sections').style.display = '';
    document.getElementById('popular-section').style.display = type ? 'none' : '';
    document.getElementById('series-section').style.display = type === 'series' ? '' : 'none';
    document.getElementById('movies-section').style.display = type === 'movie' ? '' : 'none';

    // Re-render rows from cached data to ensure content shows
    if (type === 'series') {
        renderRow('series-row', allData.filter(s => s.type === 'series'));
    } else if (type === 'movie') {
        renderRow('movies-row', allData.filter(s => s.type === 'movie' || s.type === 'documentary'));
    }
}

function showAll(btn) {
    currentFilter = null;
    setActiveNavBtn(btn);
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('main-sections').style.display = '';
    document.getElementById('popular-section').style.display = '';
    document.getElementById('series-section').style.display = '';
    document.getElementById('documentaries-section').style.display = '';
    document.getElementById('movies-section').style.display = '';
    document.getElementById('local-series-section').style.display = '';

    // Re-render all rows from cached data
    renderRow('popular-row', allData.slice(0, 12));
    renderRow('series-row', allData.filter(s => s.type === 'series'));
    renderRow('documentaries-row', allData.filter(s => (s.categories||[]).some(c => (c||'').toLowerCase() === 'documentary' || (c||'').toLowerCase() === 'belgesel')));
    renderRow('movies-row', allData.filter(s => s.type === 'movie' || s.type === 'documentary'));
    renderRow('local-series-row', allData.filter(s => s.type === 'yerli'));
}

function showDocumentaries(btn) {
    currentFilter = 'documentaries';
    setActiveNavBtn(btn);
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('main-sections').style.display = '';
    document.getElementById('popular-section').style.display = 'none';
    document.getElementById('series-section').style.display = 'none';
    document.getElementById('movies-section').style.display = 'none';
    document.getElementById('documentaries-section').style.display = '';
    renderRow('documentaries-row', allData.filter(s => (s.categories||[]).some(c => (c||'').toLowerCase() === 'documentary' || (c||'').toLowerCase() === 'belgesel')));
}

function showLocalSeries(btn) {
    currentFilter = 'yerli';
    setActiveNavBtn(btn);
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('main-sections').style.display = '';
    document.getElementById('popular-section').style.display = 'none';
    document.getElementById('series-section').style.display = 'none';
    document.getElementById('documentaries-section').style.display = 'none';
    document.getElementById('movies-section').style.display = 'none';
    document.getElementById('local-series-section').style.display = '';
    renderRow('local-series-row', allData.filter(s => s.type === 'yerli'));
}

function initLocalCarousel() {
    try {
        const row = document.getElementById('local-series-row');
        if (!row) return;
        // create a gentle auto-scroll
        if (row._carouselInit) return;
        row._carouselInit = true;
        let step = 0;
        setInterval(() => {
            if (!row || row.scrollWidth <= row.clientWidth) return;
            step = (step + Math.round(row.clientWidth * 0.7));
            if (step >= row.scrollWidth - row.clientWidth) step = 0;
            row.scrollTo({ left: step, behavior: 'smooth' });
        }, 4000);
    } catch (e) { console.warn('carousel init failed', e); }
}

// General carousel initializer: adds arrows, autoplay (if data-autoplay), swipe is native via scroll-snap
function initCarousels() {
    document.querySelectorAll('.cards-row').forEach(row => {
        if (row._carouselInit) return;
        row._carouselInit = true;

        // inject arrows container
        const container = row.parentElement;
        if (!container) return;
        container.style.position = container.style.position || 'relative';

        const left = document.createElement('button');
        left.className = 'carousel-btn left';
        left.innerHTML = '◀';
        left.addEventListener('click', (e) => { e.stopPropagation(); row.scrollBy({ left: -Math.round(row.clientWidth * 0.7), behavior: 'smooth' }); });

        const right = document.createElement('button');
        right.className = 'carousel-btn right';
        right.innerHTML = '▶';
        right.addEventListener('click', (e) => { e.stopPropagation(); row.scrollBy({ left: Math.round(row.clientWidth * 0.7), behavior: 'smooth' }); });

        container.appendChild(left);
        container.appendChild(right);

        // Autoplay for rows explicitly marked (e.g., local-series-row)
        const autoplay = row.dataset.autoplay === 'true' || row.id === 'local-series-row';
        let autoTimer = null;
        if (autoplay) {
            let step = 0;
            autoTimer = setInterval(() => {
                if (!row || row.scrollWidth <= row.clientWidth) return;
                step = (step + Math.round(row.clientWidth * 0.7));
                if (step >= row.scrollWidth - row.clientWidth) step = 0;
                row.scrollTo({ left: step, behavior: 'smooth' });
            }, 4200);
            row.addEventListener('mouseenter', () => { if (autoTimer) clearInterval(autoTimer); });
            row.addEventListener('mouseleave', () => { autoTimer = setInterval(() => { if (!row || row.scrollWidth <= row.clientWidth) return; step = (step + Math.round(row.clientWidth * 0.7)); if (step >= row.scrollWidth - row.clientWidth) step = 0; row.scrollTo({ left: step, behavior: 'smooth' }); }, 4200); });
        }
    });
}

function setActiveNavBtn(btn) {
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

// ═══════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════
async function openDetail(seriesId, autoPlay = false) {
    try {
        const res = await fetch(API + '/series/' + seriesId + '?_=' + Date.now());
        const series = await res.json();
        currentSeries = series;
        currentSeason = null;

        console.log('[openDetail] series:', series.title, 'seasons:', series.seasons?.length, series.seasons?.map(s => ({seasonNumber: s.seasonNumber, episodes: s.episodes?.length})));

        // Hero image
        const heroImg = document.getElementById('modal-hero-img');
        heroImg.style.backgroundImage = series.poster
            ? `url('${series.poster}')`
            : 'linear-gradient(135deg,#1a1a2e,#16213e)';

        document.getElementById('modal-title').textContent = series.title;

        const meta = [];
        if (series.rating) meta.push(`<span class="rating">⭐ ${series.rating}/10</span>`);
        if (series.releaseYear) meta.push(`<span>${series.releaseYear}</span>`);
        if (series.type) meta.push(`<span>${series.type === 'movie' ? '🎬 Film' : series.type === 'documentary' ? '🎞 Belgesel' : '📺 Dizi'}</span>`);
        if (series.categories?.length) meta.push(`<span>${series.categories.join(', ')}</span>`);
        document.getElementById('modal-meta').innerHTML = meta.join('<span style="color:#444">•</span>');

        // Show description according to selected language
        const lang2 = localStorage.getItem('qfLang') || 'tr';
        const modalDesc = (lang2 === 'ar') ? (series.description_ar || series.description || series.description_tr || '') : (series.description_tr || series.description || series.description_ar || '');
        document.getElementById('modal-desc').textContent = modalDesc || (lang2 === 'ar' ? 'لا يوجد وصف.' : 'Açıklama yok.');

        // Action buttons
        const actions = document.getElementById('modal-actions');
        if (series.type === 'movie' || series.type === 'documentary') {
            const watchLabel = series.type === 'documentary' ? '▶ İzle' : '▶ İzle';
            actions.innerHTML = `
                <button class="btn-play" onclick="playMovieDirect()">${watchLabel}</button>
                <button class="btn-info" onclick="toggleSave('film','${series._id}')">★ Kaydet</button>
                <button class="btn-info" onclick="downloadItem('film','${series._id}', null, '${esc(series.title)}')">⬇ İndir</button>`;
        } else {
            actions.innerHTML = `
                <button class="btn-play" onclick="playFirstEpisode()">▶ İzle</button>
                <button class="btn-info" onclick="toggleSave('series','${series._id}')">★ Kaydet</button>`;
        }

        // Seasons / Episodes
        const area = document.getElementById('seasons-area');
        if (series.type === 'series' && series.seasons?.length) {
            renderSeasonsArea(series.seasons);
        } else if (series.type === 'movie' || series.type === 'documentary') {
            area.innerHTML = '';
        } else {
            area.innerHTML = '<p style="color:var(--muted2);font-size:.85rem">Sezon bulunamadı.</p>';
        }

        document.getElementById('detail-modal').classList.add('open');

        if (autoPlay) {
            if (series.type === 'movie' || series.type === 'documentary') {
                playMovieDirect();
            } else {
                playFirstEpisode();
            }
        }
    } catch (err) {
        console.error('Detail error:', err);
    }
}

function renderSeasonsArea(seasons) {
    const area = document.getElementById('seasons-area');
    const tabs = seasons.map((s, i) =>
        `<button class="season-tab${i === 0 ? ' active' : ''}" onclick="switchSeason(${i},this)">Sezon ${s.seasonNumber}</button>`
    ).join('');

    area.innerHTML = `
        <div class="season-label">Sezonlar</div>
        <div class="season-tabs" id="season-tabs">${tabs}</div>
        <div class="episodes-list" id="episodes-list"></div>`;

    showSeasonEpisodes(seasons[0]);
}

function switchSeason(idx, btn) {
    document.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentSeason = currentSeries.seasons[idx];
    showSeasonEpisodes(currentSeries.seasons[idx]);
}

function showSeasonEpisodes(season) {
    currentSeason = season;
    const list = document.getElementById('episodes-list');
    if (!list) return;
    list.innerHTML = '';

    if (!season.episodes?.length) {
        list.innerHTML = '<p style="color:var(--muted2);font-size:.82rem">Bu sezonda bölüm yok.</p>';
        return;
    }

    season.episodes.forEach(ep => {
        const thumbHtml = ep.thumbnail
            ? `<img class="ep-thumb-img" src="${esc(ep.thumbnail)}" alt="" loading="lazy" onerror="this.style.background='#1a1a2e'">`
            : `<div class="ep-thumb-img" style="background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;align-items:center;justify-content:center;color:var(--muted2)">▶</div>`;

        const dur = ep.duration ? Math.floor(ep.duration / 60) + ' dk' : '';
        list.innerHTML += `
        <div class="ep-card" onclick="playEpisode('${ep._id}')">
          <div class="ep-num">E${ep.episodeNumber}</div>
          ${thumbHtml}
          <div class="ep-info">
            <div class="ep-title">${esc(ep.title)}</div>
            <div class="ep-desc">${esc(ep.description || '')}</div>
            ${dur ? `<div class="ep-meta">${dur}</div>` : ''}
          </div>
          <span class="ep-arrow">›</span>
        </div>`;
    });
}

function playMovieDirect() {
    if (!currentSeries) return;
    // Film için: sezon ve bölüm var mı kontrol et
    const seasons = currentSeries.seasons || [];
    for (const s of seasons) {
        if (s.episodes && s.episodes.length) {
            playEpisode(s.episodes[0]._id, true);
            return;
        }
    }
    // Bölüm bulunamadı — seri ID'si yanlışlıkla geçirilmesin
    console.warn('[playMovieDirect] Bu filme bağlı bölüm bulunamadı:', currentSeries._id);
    alert('Bu içerik için henüz video eklenmemiş.');
}

async function playFirstEpisode() {
    if (!currentSeries || !currentSeries.seasons?.length) return;
    const firstSeason = currentSeries.seasons[0];
    if (!firstSeason.episodes?.length) return;
    await playEpisode(firstSeason.episodes[0]._id);
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('open');
}

// ═══════════════════════════════════════════
// VIDEO PLAYER
// ═══════════════════════════════════════════
async function playEpisode(episodeId, isMovie = false) {
    try {
        // Önce cache'deki (currentSeries.seasons) episode'u bul — API'ye istek atmaya gerek yok
        let episode = null;
        const seasons = currentSeries?.seasons || [];
        for (const s of seasons) {
            const found = (s.episodes || []).find(e => String(e._id) === String(episodeId));
            if (found) { episode = found; break; }
        }

        // Cache'de bulunamazsa API'den çek
        if (!episode) {
            const res = await fetch(API + '/episode/' + episodeId + '?_=' + Date.now());
            episode = await res.json();
        }

        if (Array.isArray(episode)) {
            console.error('[playEpisode] array geldi, episode ID yanlış:', episodeId);
            return;
        }
        if (!episode || !episode.videoUrl) {
            console.error('[playEpisode] videoUrl yok:', episode);
            return;
        }

        currentEpisode = episode;
        console.log('[playEpisode] videoUrl:', episode.videoUrl);

        const videoPlayer = document.getElementById('video-player');
        const videoSource = document.getElementById('video-source');
        const embedContainer = document.getElementById('embed-player');

        embedContainer.innerHTML = '';
        embedContainer.style.display = 'none';
        videoPlayer.style.display = 'block';

        const src = episode.videoUrl || '';

        // Google Drive: convert share link to preview embed URL
        function toDriveEmbed(url) {
            // Already an embed URL
            if (url.includes('/preview')) return url;
            // Share URL: https://drive.google.com/file/d/FILE_ID/view
            const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
            // Old format: ?id=FILE_ID
            const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`;
            return url;
        }

        function isDirectVideo(url) {
            return /\.(mp4|webm|ogg|mov|mkv)(\?|$)/i.test(url);
        }

        function isGoogleDrive(url) {
            return url.includes('drive.google.com') || url.includes('docs.google.com');
        }

        function isYouTube(url) {
            return url.includes('youtube.com') || url.includes('youtu.be');
        }

        function toYouTubeEmbed(url) {
            let id = '';
            const m1 = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
            if (m1) id = m1[1];
            const m2 = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
            if (m2) id = m2[1];
            return id ? `https://www.youtube.com/embed/${id}?rel=0&showinfo=0` : url;
        }

        function showIframe(iframeSrc) {
            videoPlayer.pause();
            videoPlayer.style.display = 'none';
            const iframe = document.createElement('iframe');
            iframe.src = iframeSrc;
            iframe.allow = 'autoplay; fullscreen; encrypted-media';
            iframe.allowFullscreen = true;
            iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0';
            embedContainer.appendChild(iframe);
            embedContainer.style.display = 'block';
            document.getElementById('sub-wrap').style.display = 'none';
        }

        // Raw iframe tag in the field
        if (/^\s*</.test(src) && src.includes('iframe')) {
            videoPlayer.pause();
            videoPlayer.style.display = 'none';
            embedContainer.innerHTML = src;
            // Make any iframe inside fill the container
            const iframeEl = embedContainer.querySelector('iframe');
            if (iframeEl) {
                iframeEl.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0';
            }
            embedContainer.style.display = 'block';
            document.getElementById('sub-wrap').style.display = 'none';
        } else if (isGoogleDrive(src)) {
            showIframe(toDriveEmbed(src));
        } else if (isYouTube(src)) {
            showIframe(toYouTubeEmbed(src));
        } else if (isDirectVideo(src)) {
            videoSource.src = src;
            videoPlayer.load();
            document.getElementById('sub-wrap').style.display = '';
            loadSubtitles(episode.subtitles || []);
            await loadProgress(episodeId);
            videoPlayer.addEventListener('timeupdate', () => saveProgress(episodeId));
        } else if (src) {
            showIframe(src);
        } else {
            console.warn('No video URL for episode', episodeId);
        }

        // Episode info label
        let infoText = '';
        if (currentSeason) {
            infoText = `S${pad(currentSeason.seasonNumber)}E${pad(episode.episodeNumber)}: ${episode.title}`;
        } else {
            infoText = episode.title || (currentSeries?.title || '');
        }
        document.getElementById('player-ep-info').textContent = infoText;

        // İndirme butonunu güncelle
        const downloadBtnContainer = document.getElementById('player-download-btn-container');
        if (downloadBtnContainer) {
            downloadBtnContainer.innerHTML = `<button class="btn-info sm" style="background:var(--accent);color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.8rem;" onclick="downloadItem('episode', '${episode._id}', '${src}', '${infoText}')">⬇ İndir</button>`;
        }

        closeDetailModal();
        document.getElementById('player-modal').classList.add('open');
    } catch (err) {
        console.error('Play error:', err);
    }
}

function closePlayer() {
    document.getElementById('player-modal').classList.remove('open');
    const video = document.getElementById('video-player');
    try { video.pause(); } catch(e) {}
    document.getElementById('video-source').src = '';
    try { video.load(); } catch(e) {}
    const embed = document.getElementById('embed-player');
    embed.innerHTML = '';
    embed.style.display = 'none';
    video.style.display = 'block';
    document.getElementById('sub-wrap').style.display = '';
}

// ═══════════════════════════════════════════
// SUBTITLES
// ═══════════════════════════════════════════
function loadSubtitles(subtitles) {
    const sel = document.getElementById('subtitle-select');
    sel.innerHTML = '<option value="">Kapalı</option>';
    subtitles.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.language;
        opt.textContent = sub.language;
        sel.appendChild(opt);
    });
}

function changeSubtitle() {
    const lang = document.getElementById('subtitle-select').value;
    const video = document.getElementById('video-player');
    video.querySelectorAll('track').forEach(t => t.remove());
    if (!lang || !currentEpisode?.subtitles) return;
    const sub = currentEpisode.subtitles.find(s => s.language === lang);
    if (!sub) return;
    const blob = new Blob([sub.vttContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.srclang = lang.toLowerCase();
    track.label = lang;
    track.src = url;
    track.default = true;
    video.appendChild(track);
}

// ═══════════════════════════════════════════
// PROGRESS
// ═══════════════════════════════════════════
let lastProgressSaveTime = 0;
async function saveProgress(episodeId) {
    const video = document.getElementById('video-player');
    const progress = Math.floor(video.currentTime);
    if (!progress) return;
    
    const now = Date.now();
    if (now - lastProgressSaveTime < 10000) return; // Throttle: 10 seconds
    lastProgressSaveTime = now;
    
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
        const body = { seriesId: currentSeries?._id, episodeId, progress };
        if (!TOKEN) body.userId = USER_ID;
        await fetch(API + '/progress', {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
    } catch (err) { /* silent */ }
}

async function loadProgress(episodeId) {
    try {
        let res;
        const headers = {};
        if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
        if (TOKEN) {
            res = await fetch(API + '/progress/me/' + episodeId, { headers });
        } else {
            res = await fetch(API + '/progress/' + USER_ID + '/' + episodeId);
        }
        const data = await res.json();
        if (data && data.progress > 0) {
            document.getElementById('video-player').currentTime = data.progress;
        }
    } catch (err) { /* silent */ }
}

// ═══════════════════════════════════════════
// DOWNLOAD MANAGER
// ═══════════════════════════════════════════
async function downloadItem(type, itemId, videoUrl, title) {
    if (!videoUrl) {
        if (type === 'film' && currentSeries && currentSeries.seasons && currentSeries.seasons[0] && currentSeries.seasons[0].episodes && currentSeries.seasons[0].episodes[0]) {
            videoUrl = currentSeries.seasons[0].episodes[0].videoUrl;
        }
    }
    
    if (!videoUrl || videoUrl.includes('iframe') || videoUrl.includes('youtube') || videoUrl.includes('drive.google')) {
        alert('Bu video formatı doğrudan indirmeyi desteklemiyor. (Sadece MP4 desteklenir)');
        return;
    }
    
    try {
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = title + '.mp4';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        alert(title + ' indirmesi başlatılıyor. Tarayıcınızın indirmeler bölümünü kontrol edin.');
    } catch (err) {
        console.error('Download error:', err);
        alert('İndirme başlatılamadı.');
    }
}
