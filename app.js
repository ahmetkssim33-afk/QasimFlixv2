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

function qfText(key) {
    return window.qfT ? window.qfT(key) : key;
}
function qfCurrentLang() {
    return localStorage.getItem('qasimflix_lang') || localStorage.getItem('qfLang') || 'tr';
}
function qfExposeAuthGlobals() {
    window.TOKEN = TOKEN;
    window.USER_ID = USER_ID;
    window.AUTH_USER = AUTH_USER;
}

// ═══════════════════════════════════════════
// LOADING SPINNER
// ═══════════════════════════════════════════
function showLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.add('active');
}

function hideLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.classList.remove('active');
}

// ═══════════════════════════════════════════
// FAVORITES (FAVORİLER)
// ═══════════════════════════════════════════
async function toggleFavorite(seriesId) {
    try {
        const res = await fetch(API + `/favorites/${seriesId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN ? 'Bearer ' + TOKEN : '' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Hata');
        const btn = document.querySelector(`[data-series="${seriesId}"] .heart-btn`);
        if (btn) btn.classList.toggle('active');
        return data;
    } catch (e) {
        console.error('Favorite error:', e);
    }
}

async function loadFavorites() {
    try {
        showLoading();
        const res = await fetch(API + '/favorites', {
            headers: { 'Authorization': TOKEN ? 'Bearer ' + TOKEN : '' }
        });
        if (!res.ok) throw new Error('Favoriler yüklenemedi');
        const favorites = await res.json();
        displayFavorites(favorites);
    } catch (e) {
        console.error('Load favorites error:', e);
    } finally {
        hideLoading();
    }
}

function displayFavorites(items) {
    const row = document.getElementById('search-results') || document.querySelector('.results-container');
    if (!row) {
        alert(qfText('alert.resultsMissing'));
        return;
    }
    row.innerHTML = items.map(item => renderCard(item, null, null, null)).join('');
}

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
    qfExposeAuthGlobals();
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
        if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || qfText('alert.saveError')); return; }
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Kaydedildi');
    } catch (e) { alert(qfText('alert.saveError')); }
}

async function loadContinueWatching() {
    try {
        const row = document.getElementById('continue-row');
        if (!row) return;
        const headers = {};
        let url;
        if (TOKEN) { headers['Authorization'] = 'Bearer ' + TOKEN; url = API + '/progress/continue/me?_=' + Date.now(); }
        else { url = API + '/progress/continue/' + USER_ID + '?_=' + Date.now(); }
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

// Sayfayı yenile (admin panelinde eklenen yeni içerik için)
async function refreshPage() {
    try {
        await loadAll();
        await loadContinueWatching();
    } catch (e) {
        console.error('Refresh error:', e);
    }
}
// ═══════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════
async function loadAll() {
    try {
        const res = await fetch(API + '/series?page=1&limit=100&_=' + Date.now());
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
    const lang = localStorage.getItem('qasimflix_lang') || localStorage.getItem('qfLang') || 'tr';
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
        row.innerHTML = `<div class="empty-state" style="width:100%"><div class="icon">📭</div><p data-i18n="section.empty">${qfText('section.empty')}</p></div>`;
        return;
    }

    // Performans: innerHTML += her kartta DOM'u tekrar parse eder.
    // Tek seferde join etmek özellikle mobil/APK WebView'de kaydırma ve ilk yüklemeyi hızlandırır.
    row.innerHTML = list.map(createCard).join('');
    // ensure carousel UI is attached after rendering
    try { initCarousels(); } catch(e) { /* silent */ }
}

function createCard(item) {
    const tKey = item.type || 'series';
    let typeLabel = qfText('content.series'); let typeI18n = 'content.series';
    let typeCls = 'badge-series';
    if (tKey === 'movie') { typeLabel = qfText('content.movie'); typeI18n = 'content.movie'; typeCls = 'badge-movie'; }
    else if (tKey === 'documentary') { typeLabel = qfText('content.documentary'); typeI18n = 'content.documentary'; typeCls = 'badge-documentary'; }
    else if (tKey === 'yerli') { typeLabel = qfText('content.localSeries'); typeI18n = 'content.localSeries'; typeCls = 'badge-red'; }
    const cat = item.categories?.[0] || '';
    const rating = item.rating ? item.rating : '';

    const imgHtml = item.poster
        ? `<img class="card-img" src="${esc(item.poster)}" alt="${esc(item.title)}" loading="lazy" decoding="async" fetchpriority="low" draggable="false" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
    const placeholderStyle = item.poster ? 'display:none' : '';

    return `
    <div class="card" data-series="${item._id}">
      ${imgHtml}
      <div class="card-placeholder" style="${placeholderStyle}">
        <span class="icon">${tKey === 'movie' ? '🎬' : tKey === 'documentary' ? '🎞' : '📺'}</span>
        <span>${esc(item.title)}</span>
      </div>
      <span class="badge-type ${typeCls}" data-i18n="${typeI18n}">${typeLabel}</span>
      ${rating ? `<span class="badge-rating">⭐ ${rating}</span>` : ''}
      <button class="heart-btn" onclick="event.stopPropagation();toggleFavorite('${item._id}')">❤️</button>
      <div class="card-overlay" onclick="openDetail('${item._id}')">
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
        grid.innerHTML = localResults.map(createCard).join('');
        
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
            
            grid.innerHTML = mergedResults.map(createCard).join('');
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
        window.currentSeries = currentSeries;
        currentSeason = null;
        window.currentSeason = currentSeason;

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
        if (series.type) meta.push(`<span data-i18n="${series.type === 'movie' ? 'content.movie' : series.type === 'documentary' ? 'content.documentary' : 'content.series'}">${series.type === 'movie' ? qfText('content.movie') : series.type === 'documentary' ? qfText('content.documentary') : qfText('content.series')}</span>`);
        if (series.categories?.length) meta.push(`<span>${series.categories.join(', ')}</span>`);
        document.getElementById('modal-meta').innerHTML = meta.join('<span style="color:#444">•</span>');

        // Show description according to selected language
        const lang2 = qfCurrentLang();
        const modalDesc = (lang2 === 'ar') ? (series.description_ar || series.description || series.description_tr || '') : (series.description_tr || series.description || series.description_ar || '');
        document.getElementById('modal-desc').textContent = modalDesc || qfText('content.noDescription');

        // Action buttons
        const actions = document.getElementById('modal-actions');
        if (series.type === 'movie' || series.type === 'documentary') {
            const watchLabel = qfText('action.watch');
            actions.innerHTML = `
                <button class="btn-play" onclick="playMovieDirect()" data-i18n="action.watch">${watchLabel}</button>
                <button class="btn-info" onclick="toggleSave('film','${series._id}')" data-i18n="action.save">${qfText('action.save')}</button>
                <button class="btn-info" onclick="addToFavorites('${series._id}')" data-i18n="action.favorite">${qfText('action.favorite')}</button>
                <button class="btn-info" onclick="submitRating('${series._id}')" data-i18n="action.rate">${qfText('action.rate')}</button>
                <button class="btn-info" onclick="downloadItem('film','${series._id}', null, '${esc(series.title)}')" data-i18n="action.download">${qfText('action.download')}</button>`;
        } else {
            actions.innerHTML = `
                <button class="btn-play" onclick="playFirstEpisode()" data-i18n="action.watch">${qfText('action.watch')}</button>
                <button class="btn-info" onclick="toggleSave('series','${series._id}')" data-i18n="action.save">${qfText('action.save')}</button>
                <button class="btn-info" onclick="addToFavorites('${series._id}')" data-i18n="action.favorite">${qfText('action.favorite')}</button>
                <button class="btn-info" onclick="addToWatchlist('${series._id}')" data-i18n="action.watchlist">${qfText('action.watchlist')}</button>
                <button class="btn-info" onclick="submitRating('${series._id}')" data-i18n="action.rate">${qfText('action.rate')}</button>`;
        }

        // Seasons / Episodes
        const area = document.getElementById('seasons-area');
        if (series.seasons && series.seasons.length > 0) {
            renderSeasonsArea(series.seasons);
        } else {
            area.innerHTML = `<p style="color:var(--muted2);font-size:.85rem" data-i18n="content.noSeason">${qfText('content.noSeason')}</p>`;
        }

        document.getElementById('detail-modal').classList.add('open');
        if (window.qfSetBottomNavHidden) window.qfSetBottomNavHidden(true);
        loadRatings(series._id).catch(() => {});

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
        `<button class="season-tab${i === 0 ? ' active' : ''}" onclick="switchSeason(${i},this)"><span data-i18n="content.season">${qfText('content.season')}</span> ${s.seasonNumber}</button>`
    ).join('');

    area.innerHTML = `
        <div class="season-label" data-i18n="content.seasons">${qfText('content.seasons')}</div>
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
    window.currentSeason = currentSeason;
    const list = document.getElementById('episodes-list');
    if (!list) return;
    list.innerHTML = '';

    if (!season.episodes?.length) {
        list.innerHTML = `<p style="color:var(--muted2);font-size:.82rem" data-i18n="content.noEpisodes">${qfText('content.noEpisodes')}</p>`;
        return;
    }

    season.episodes.forEach(ep => {
        const thumbHtml = ep.thumbnail
            ? `<img class="ep-thumb-img" src="${esc(ep.thumbnail)}" alt="" loading="lazy" onerror="this.style.background='#1a1a2e'">`
            : `<div class="ep-thumb-img" style="background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;align-items:center;justify-content:center;color:var(--muted2)">▶</div>`;

        const dur = ep.duration ? Math.floor(ep.duration / 60) + ' ' + qfText('content.minute') : '';
        list.innerHTML += `
        <div class="ep-card" onclick="playEpisode('${ep._id}')">
          <div class="ep-num"><span data-i18n="content.episode">${qfText('content.episode')}</span> ${ep.episodeNumber}</div>
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
    alert('Bu içerik için henüz video eklenmemiş.');
}

async function playFirstEpisode() {
    if (!currentSeries || !currentSeries.seasons?.length) return;
    const firstSeason = currentSeries.seasons[0];
    if (!firstSeason.episodes?.length) return;
    await playEpisode(firstSeason.episodes[0]._id);
}

function closeDetailModal() {
    document.getElementById('detail-modal')?.classList.remove('open');
    if (window.qfSetBottomNavHidden) window.qfSetBottomNavHidden(false);
}

// ═══════════════════════════════════════════
// VIDEO PLAYER
// ═══════════════════════════════════════════
let qasimQualitySources = [];
let qasimCurrentSourceUrl = '';
let qasimPlayerBound = false;
let qasimControlsHideTimer = null;
let qasimPlayOpenBusy = false;
let qasimActiveLoadToken = 0;
let qasimAutoNextTimer = null;
let qasimAutoNextBusy = false;
let qasimAutoNextCountdownTimer = null;
let qasimPendingNextEpisode = null;

function clearEpisodeAutoNextTimer() {
    if (qasimAutoNextTimer) clearTimeout(qasimAutoNextTimer);
    if (qasimAutoNextCountdownTimer) clearInterval(qasimAutoNextCountdownTimer);
    qasimAutoNextTimer = null;
    qasimAutoNextCountdownTimer = null;
}

function hideAutoNextOverlay() {
    const el = document.getElementById('qf-auto-next');
    if (el) el.hidden = true;
    qasimPendingNextEpisode = null;
}

function showAutoNextOverlay(next, seconds = 5) {
    const el = document.getElementById('qf-auto-next');
    const titleEl = document.getElementById('qf-auto-next-title');
    const countEl = document.getElementById('qf-auto-next-count');
    qasimPendingNextEpisode = next;
    if (!el || !next?.episode?._id) return playPendingAutoNext();
    const title = `S${pad(next.season?.seasonNumber || 1)}E${pad(next.episode.episodeNumber)}: ${next.episode.title || 'Sonraki bölüm'}`;
    if (titleEl) titleEl.textContent = title;
    let left = seconds;
    if (countEl) countEl.textContent = String(left);
    el.hidden = false;
    if (qasimAutoNextCountdownTimer) clearInterval(qasimAutoNextCountdownTimer);
    qasimAutoNextCountdownTimer = setInterval(() => {
        left -= 1;
        if (countEl) countEl.textContent = String(Math.max(0, left));
        if (left <= 0) playPendingAutoNext();
    }, 1000);
}

function playPendingAutoNext() {
    const next = qasimPendingNextEpisode;
    clearEpisodeAutoNextTimer();
    hideAutoNextOverlay();
    if (!next?.episode?._id) { qasimAutoNextBusy = false; return; }
    qasimAutoNextBusy = false;
    syncSeasonUIForAutoNext(next.seasonIndex, next.season);
    playEpisode(next.episode._id);
}

function qfCancelAutoNext() {
    clearEpisodeAutoNextTimer();
    hideAutoNextOverlay();
    qasimAutoNextBusy = false;
    if (window.qfToast) window.qfToast('Otomatik geçiş iptal edildi');
}

function qfPlayAutoNextNow() {
    playPendingAutoNext();
}
window.qfCancelAutoNext = qfCancelAutoNext;
window.qfPlayAutoNextNow = qfPlayAutoNextNow;

function getEpisodeLocation(episodeId) {
    const seasons = currentSeries?.seasons || [];
    for (let si = 0; si < seasons.length; si++) {
        const episodes = seasons[si].episodes || [];
        const ei = episodes.findIndex(e => String(e._id) === String(episodeId));
        if (ei >= 0) return { seasonIndex: si, episodeIndex: ei, season: seasons[si], episode: episodes[ei] };
    }
    return null;
}

function getNextEpisodeLocation() {
    if (!currentEpisode || !currentSeries?.seasons?.length) return null;
    const loc = getEpisodeLocation(currentEpisode._id);
    if (!loc) return null;
    const sameSeason = loc.season.episodes || [];
    if (loc.episodeIndex < sameSeason.length - 1) {
        return { seasonIndex: loc.seasonIndex, episodeIndex: loc.episodeIndex + 1, season: loc.season, episode: sameSeason[loc.episodeIndex + 1] };
    }
    const seasons = currentSeries.seasons || [];
    for (let si = loc.seasonIndex + 1; si < seasons.length; si++) {
        const episodes = seasons[si].episodes || [];
        if (episodes.length) return { seasonIndex: si, episodeIndex: 0, season: seasons[si], episode: episodes[0] };
    }
    return null;
}

function syncSeasonUIForAutoNext(seasonIndex, season) {
    if (!season) return;
    currentSeason = season;
    window.currentSeason = currentSeason;
    document.querySelectorAll('.season-tab').forEach((tab, idx) => tab.classList.toggle('active', idx === seasonIndex));
    const list = document.getElementById('episodes-list');
    if (list && currentSeries?.seasons?.[seasonIndex]) showSeasonEpisodes(currentSeries.seasons[seasonIndex]);
}

async function markEpisodeCompletedForAutoNext() {
    try {
        if (!currentEpisode || !currentSeries) return;
        const video = document.getElementById('video-player');
        const finalProgress = Math.floor(video?.duration || currentEpisode.duration || video?.currentTime || 1);
        const headers = { 'Content-Type': 'application/json' };
        if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
        const body = { seriesId: currentSeries._id, episodeId: currentEpisode._id, progress: finalProgress || 1 };
        if (!TOKEN) body.userId = USER_ID;
        await fetch(API + '/progress', { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (_) {}
}

async function handleEpisodeEndedAutoNext(reason = 'ended') {
    if (qasimAutoNextBusy || !currentEpisode) return;
    if (window.qfGetSetting && window.qfGetSetting('autoNext', true) === false) return;
    qasimAutoNextBusy = true;
    clearEpisodeAutoNextTimer();
    await markEpisodeCompletedForAutoNext();

    const next = getNextEpisodeLocation();
    const infoEl = document.getElementById('player-ep-info');
    if (next?.episode?._id) {
        if (infoEl) infoEl.textContent = 'Sonraki bölüm hazırlanıyor...';
        if (window.qfToast) window.qfToast('Sonraki bölüm 5 saniye içinde başlıyor');
        showAutoNextOverlay(next, 5);
        return;
    }

    qasimAutoNextBusy = false;
    if (window.qfToast) window.qfToast('Sezon bitti');
    // Son bölümde player kapanır ve kullanıcı bölüm listesine geri döner.
    closePlayer();
    if (currentSeries?._id) setTimeout(() => openDetail(currentSeries._id), 250);
}

function scheduleIframeAutoNextFallback(episode) {
    clearEpisodeAutoNextTimer();
    const duration = Number(episode?.duration || 0);
    // iframe/Google Drive içinde gerçek "ended" olayı alınamaz; süre girildiyse emniyetli otomatik geçiş yapılır.
    if (!Number.isFinite(duration) || duration < 30) return;
    qasimAutoNextTimer = setTimeout(() => handleEpisodeEndedAutoNext('iframe-timer'), (duration + 3) * 1000);
}

function isGoogleDriveUrl(url = '') {
    return String(url).includes('drive.google.com') || String(url).includes('docs.google.com');
}

function isYouTubeUrl(url = '') {
    return String(url).includes('youtube.com') || String(url).includes('youtu.be');
}

function isDirectVideoUrl(url = '') {
    return /\.(mp4|webm|ogg|mov|mkv|m3u8)(\?|$)/i.test(String(url));
}

function makePlayableUrl(url = '') {
    const clean = String(url || '').trim();
    if (!clean) return '';
    // Google Drive paylaşım linkleri direkt MP4 stream değildir.
    // Bu yüzden Drive linklerini /api/video-proxy veya HTML5 video'ya zorlamıyoruz.
    // Drive videoları getGoogleDrivePreviewUrl() ile iframe preview olarak açılır.
    if (isGoogleDriveUrl(clean)) return clean;
    return clean;
}

function getGoogleDrivePreviewUrl(url = '') {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const id = raw.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
        || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
        || raw.match(/open\?id=([a-zA-Z0-9_-]+)/)?.[1];
    if (!id) return raw;
    return `https://drive.google.com/file/d/${id}/preview`;
}

function toYouTubeEmbed(url) {
    let id = '';
    const m1 = String(url).match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (m1) id = m1[1];
    const m2 = String(url).match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (m2) id = m2[1];
    return id ? `https://www.youtube.com/embed/${id}?rel=0&showinfo=0` : url;
}

function extractIframeSrc(html = '') {
    const match = String(html).match(/src=["']([^"']+)["']/i);
    return match ? match[1] : '';
}

function parseQualitySources(episode, fallbackUrl) {
    const list = [];
    const add = (label, url) => {
        if (!url) return;
        const cleanUrl = String(url).trim();
        if (!cleanUrl) return;
        if (list.some(item => item.url === cleanUrl)) return;
        list.push({ label: label || 'Orijinal', url: cleanUrl });
    };

    // Gelecekte API'ye qualities/videoQualities alanı eklenirse otomatik destekler.
    const rawQualities = episode?.qualities || episode?.videoQualities || episode?.qualitySources;
    if (Array.isArray(rawQualities)) {
        rawQualities.forEach(q => add(q.label || q.quality || q.name, q.url || q.src || q.videoUrl));
    } else if (rawQualities && typeof rawQualities === 'object') {
        Object.entries(rawQualities).forEach(([label, url]) => add(label, url));
    }

    // Tek videoUrl içine satır satır kalite girilirse destekler:
    // 480p=https://...
    // 720p=https://...
    const textUrl = String(fallbackUrl || '');
    if (textUrl.includes('\n') || /\b\d{3,4}p\s*[:=|]/i.test(textUrl)) {
        textUrl.split(/\n|;;/).forEach(line => {
            const match = line.trim().match(/^([^:=|]+)\s*[:=|]\s*(https?:\/\/.+)$/i);
            if (match) add(match[1].trim(), match[2].trim());
        });
    }

    if (!list.length) add('Orijinal', fallbackUrl);
    return list;
}

function fillQualitySelect(sources) {
    const select = document.getElementById('quality-select');
    const wrap = document.getElementById('quality-wrap');
    if (!select || !wrap) return;

    select.innerHTML = '';
    sources.forEach((item, index) => {
        const opt = document.createElement('option');
        opt.value = String(index);
        opt.textContent = item.label || (index === 0 ? 'Orijinal' : `Kalite ${index + 1}`);
        select.appendChild(opt);
    });
    wrap.style.display = sources.length ? '' : 'none';
}

function qasimFormatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateQasimControls() {
    const video = document.getElementById('video-player');
    if (!video) return;
    const cur = document.getElementById('qasim-current-time');
    const dur = document.getElementById('qasim-duration');
    const progress = document.getElementById('qasim-progress');

    // Play / Pause ikonları
    const iconPlay  = document.querySelector('#qasim-play-pause .qp-icon-play');
    const iconPause = document.querySelector('#qasim-play-pause .qp-icon-pause');
    if (iconPlay)  iconPlay.style.display  = video.paused ? '' : 'none';
    if (iconPause) iconPause.style.display = video.paused ? 'none' : '';

    // Volume ikonları
    const iconVol  = document.querySelector('#qasim-mute .qp-icon-vol');
    const iconMute = document.querySelector('#qasim-mute .qp-icon-mute');
    if (iconVol)  iconVol.style.display  = (video.muted || video.volume === 0) ? 'none' : '';
    if (iconMute) iconMute.style.display = (video.muted || video.volume === 0) ? '' : 'none';

    if (cur) cur.textContent = qasimFormatTime(video.currentTime || 0);
    if (dur) dur.textContent = qasimFormatTime(video.duration || 0);
    if (progress && Number.isFinite(video.duration) && video.duration > 0) {
        progress.value = String((video.currentTime / video.duration) * 100);
        // Progress bar fill (CSS var trick)
        progress.style.setProperty('--qp-pct', progress.value + '%');
    }
    // Volume slider fill
    const vol = document.getElementById('qasim-volume');
    if (vol) {
        vol.value = String(video.muted ? 0 : video.volume);
        vol.style.setProperty('--qp-pct', (Number(vol.value) * 100) + '%');
    }
    // Buffered bar
    const buffered = document.getElementById('qp-buffered');
    if (buffered && video.buffered.length > 0 && Number.isFinite(video.duration) && video.duration > 0) {
        const pct = (video.buffered.end(video.buffered.length - 1) / video.duration) * 100;
        buffered.style.width = pct + '%';
    }
    // Fullscreen icons
    const fsOpen  = document.querySelector('#fullscreen-btn .qp-icon-fs-open');
    const fsClose = document.querySelector('#fullscreen-btn .qp-icon-fs-close');
    if (fsOpen && fsClose) {
        const isFs = !!document.fullscreenElement;
        fsOpen.style.display  = isFs ? 'none' : '';
        fsClose.style.display = isFs ? '' : 'none';
    }
}

function setQasimLoading(isLoading, message = 'Video hazırlanıyor...') {
    const wrap = document.getElementById('player-wrap');
    if (!wrap) return;
    wrap.classList.toggle('is-loading', !!isLoading);
    const text = document.getElementById('qasim-loading-text');
    if (text) text.textContent = message;
}

function showQasimControls() {
    const wrap = document.getElementById('player-wrap');
    if (!wrap) return;
    wrap.classList.remove('controls-hidden');
    clearTimeout(qasimControlsHideTimer);
    qasimControlsHideTimer = setTimeout(() => {
        const video = document.getElementById('video-player');
        if (video && !video.paused) wrap.classList.add('controls-hidden');
    }, 2600);
}

function spawnRipple(wrap) {
    const el = document.createElement('div');
    el.className = 'qp-ripple';
    wrap.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
}

function initQasimPlayerControls() {
    if (qasimPlayerBound) return;
    qasimPlayerBound = true;

    const video = document.getElementById('video-player');
    const wrap  = document.getElementById('player-wrap');
    if (!video || !wrap) return;

    const playBtn    = document.getElementById('qasim-play-pause');
    const backBtn    = document.getElementById('qasim-back-10');
    const forwardBtn = document.getElementById('qasim-forward-10');
    const progress   = document.getElementById('qasim-progress');
    const muteBtn    = document.getElementById('qasim-mute');
    const volume     = document.getElementById('qasim-volume');
    const fsBtn      = document.getElementById('fullscreen-btn');

    /* ── Play / Pause ── */
    const togglePlay = () => {
        if (video.paused) video.play().catch(err => console.warn('Video oynatılamadı:', err));
        else video.pause();
        spawnRipple(wrap);
    };

    playBtn?.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

    /* ── Click on video = toggle, double-click = seek ±10s ── */
    let clickTimer = null;
    video.addEventListener('click', () => {
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
        clickTimer = setTimeout(() => { clickTimer = null; togglePlay(); }, 220);
    });
    video.addEventListener('dblclick', (e) => {
        clearTimeout(clickTimer); clickTimer = null;
        const rect = video.getBoundingClientRect();
        if (e.clientX - rect.left < rect.width / 2) {
            video.currentTime = Math.max(0, video.currentTime - 10);
        } else {
            video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
        }
        spawnRipple(wrap);
    });

    /* ── Seek buttons ── */
    backBtn?.addEventListener('click',    () => { video.currentTime = Math.max(0, video.currentTime - 10); });
    forwardBtn?.addEventListener('click', () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); });

    /* ── Progress bar ── */
    progress?.addEventListener('input', () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = (Number(progress.value) / 100) * video.duration;
        }
    });

    /* ── Mute / Volume ── */
    muteBtn?.addEventListener('click', () => { video.muted = !video.muted; updateQasimControls(); });
    volume?.addEventListener('input', () => {
        video.volume = Number(volume.value);
        video.muted = video.volume === 0;
        updateQasimControls();
    });

    /* ── Fullscreen ── */
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            requestPlayerLandscape(true);
        } else {
            document.exitFullscreen?.() || document.webkitExitFullscreen?.();
        }
    };
    fsBtn?.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateQasimControls);

    /* ── Keyboard shortcuts (only when player modal is open) ── */
    document.addEventListener('keydown', (e) => {
        const playerModal = document.getElementById('player-modal');
        if (!playerModal?.classList.contains('open')) return;
        if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;

        switch (e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                togglePlay();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                video.muted = !video.muted;
                updateQasimControls();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - 10);
                showQasimControls();
                break;
            case 'ArrowRight':
                e.preventDefault();
                video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                showQasimControls();
                break;
            case 'ArrowUp':
                e.preventDefault();
                video.volume = Math.min(1, video.volume + 0.1);
                video.muted = false;
                if (volume) volume.value = String(video.volume);
                updateQasimControls();
                break;
            case 'ArrowDown':
                e.preventDefault();
                video.volume = Math.max(0, video.volume - 0.1);
                if (volume) volume.value = String(video.volume);
                updateQasimControls();
                break;
            case 'Escape':
                closePlayer();
                break;
        }
    });

    /* ── Video event listeners ── */
    ['play', 'pause', 'timeupdate', 'loadedmetadata', 'volumechange', 'ended'].forEach(ev => {
        video.addEventListener(ev, updateQasimControls);
    });
    ['loadstart', 'waiting'].forEach(ev => video.addEventListener(ev, () => setQasimLoading(true)));
    ['canplay', 'playing', 'loadeddata'].forEach(ev => video.addEventListener(ev, () => setQasimLoading(false)));

    /* ── Show controls on any interaction ── */
    ['mousemove', 'touchstart', 'click'].forEach(ev => wrap.addEventListener(ev, showQasimControls, { passive: true }));
}

function showIframe(iframeSrc, options = {}) {
    const videoPlayer = document.getElementById('video-player');
    const embedContainer = document.getElementById('embed-player');
    const controls = document.getElementById('qasim-video-controls');
    const playerWrap = document.getElementById('player-wrap');
    const modal = document.getElementById('player-modal');
    if (!videoPlayer || !embedContainer) return;

    const loadToken = ++qasimActiveLoadToken;
    const isDriveEmbed = options.type === 'drive' || isGoogleDriveUrl(iframeSrc);

    try { videoPlayer.pause(); } catch(e) {}
    videoPlayer.removeAttribute('src');
    const source = document.getElementById('video-source');
    if (source) source.src = '';
    try { videoPlayer.load(); } catch(e) {}

    videoPlayer.style.display = 'none';
    if (controls) controls.style.display = 'none';
    embedContainer.innerHTML = '';

    if (modal) {
        modal.classList.add('open', 'embed-mode');
        modal.classList.toggle('drive-embed-mode', !!isDriveEmbed);
    }
    document.body.style.overflow = 'hidden';

    if (playerWrap) {
        playerWrap.classList.add('embed-mode');
        playerWrap.classList.toggle('drive-embed-mode', !!isDriveEmbed);
        const targetH = window.innerWidth <= 950 ? window.innerHeight : Math.min(window.innerHeight * 0.78, 760);
        playerWrap.style.minHeight = Math.max(260, targetH) + 'px';
    }

    setQasimLoading(true);

    const iframe = document.createElement('iframe');
    iframe.src = iframeSrc;
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('webkitallowfullscreen', 'true');
    iframe.setAttribute('mozallowfullscreen', 'true');
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.loading = 'eager';
    iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;inset:0;background:#000';
    iframe.addEventListener('load', () => {
        if (loadToken === qasimActiveLoadToken) setQasimLoading(false);
    }, { once: true });
    iframe.addEventListener('error', () => {
        if (loadToken === qasimActiveLoadToken) setQasimLoading(false);
    }, { once: true });
    embedContainer.appendChild(iframe);
    embedContainer.style.display = 'block';
    if (window.qfEnablePlayerCinema) setTimeout(window.qfEnablePlayerCinema, 60);

    const sub = document.getElementById('sub-wrap');
    const quality = document.getElementById('quality-wrap');
    if (sub) sub.style.display = 'none';
    if (quality) quality.style.display = 'none';

    if (isDriveEmbed && isMobileViewport()) {
        const autoTry = !window.qfGetSetting || window.qfGetSetting('tryFullscreen', true) || window.qfGetSetting('tryLandscape', true);
        if (autoTry) setTimeout(() => requestPlayerLandscape(false), 150);
        const start = document.getElementById('qf-landscape-start');
        if (start && autoTry) start.classList.add('show');
    }
}

async function setVideoSource(url, keepTime = 0, autoPlay = true) {
    if (autoPlay && window.qfGetSetting && window.qfGetSetting('autoplay', true) === false) autoPlay = false;
    const videoPlayer = document.getElementById('video-player');
    const videoSource = document.getElementById('video-source');
    const embedContainer = document.getElementById('embed-player');
    const controls = document.getElementById('qasim-video-controls');
    const playerWrap = document.getElementById('player-wrap');
    if (!videoPlayer || !videoSource || !embedContainer) return;

    const loadToken = ++qasimActiveLoadToken;
    qasimCurrentSourceUrl = url;
    embedContainer.innerHTML = '';
    embedContainer.style.display = 'none';

    // Embed'den HTML5 player'a geri dönünce class ve minHeight temizle
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.classList.add('open');
        modal.classList.remove('embed-mode', 'drive-embed-mode');
    }
    document.body.style.overflow = 'hidden';
    if (playerWrap) {
        playerWrap.style.minHeight = '';
        playerWrap.classList.remove('embed-mode', 'drive-embed-mode');
    }

    videoPlayer.style.display = 'block';
    if (controls) controls.style.display = '';
    setQasimLoading(true);

    const hidePlayerLoading = () => {
        if (loadToken === qasimActiveLoadToken) setQasimLoading(false);
    };
    videoPlayer.addEventListener('loadedmetadata', hidePlayerLoading, { once: true });
    videoPlayer.addEventListener('canplay', hidePlayerLoading, { once: true });
    videoPlayer.addEventListener('loadeddata', hidePlayerLoading, { once: true });

    videoSource.src = makePlayableUrl(url);
    videoPlayer.load();

    // Try to play immediately (helps when called directly from a user gesture).
    if (autoPlay) {
      try {
        const playPromise = videoPlayer.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(err => {
            
            // Fallback: try muted autoplay (many browsers allow muted autoplay)
            try {
              const prevMuted = videoPlayer.muted;
              videoPlayer.muted = true;
              videoPlayer.play().catch(() => {
                // If muted autoplay also fails, leave it for the loadedmetadata handler.
                videoPlayer.muted = prevMuted;
              });
            } catch (e) { /* ignore */ }
          });
        }
      } catch (e) { /* ignore */ }
    }

    videoPlayer.addEventListener('loadedmetadata', () => {
      if (keepTime > 0 && Number.isFinite(videoPlayer.duration)) {
        videoPlayer.currentTime = Math.min(keepTime, Math.max(0, videoPlayer.duration - 2));
      }
      updateQasimControls();
      if (autoPlay) {
        // Final attempt after metadata is loaded.
        videoPlayer.play().catch(err => {
          // If play is still blocked, prefer to keep the player visible and let user interact.
          
        });
      }
    }, { once: true });
}

async function changeQuality() {
    const select = document.getElementById('quality-select');
    const video = document.getElementById('video-player');
    if (!select || !video || !qasimQualitySources.length) return;
    const item = qasimQualitySources[Number(select.value)] || qasimQualitySources[0];
    await setVideoSource(item.url, video.currentTime || 0, !video.paused);
    if (currentEpisode?.subtitles) loadSubtitles(currentEpisode.subtitles || []);
}


function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
}

async function requestPlayerLandscape(force = false) {
    const modal = document.getElementById('player-modal');
    const wrap = document.getElementById('player-wrap');
    const video = document.getElementById('video-player');
    const target = wrap || video || modal;
    if (!target) return false;

    const shouldFullscreen = force || !window.qfGetSetting || window.qfGetSetting('tryFullscreen', true);
    const shouldLandscape = force || !window.qfGetSetting || window.qfGetSetting('tryLandscape', true);
    if (!shouldFullscreen && !shouldLandscape) return false;

    try {
        if (shouldFullscreen && !document.fullscreenElement) {
            if (target.requestFullscreen) await target.requestFullscreen();
            else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
        }
        if (shouldLandscape && screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape').catch(() => {});
        }
        document.getElementById('qf-landscape-start')?.classList.remove('show');
        return true;
    } catch (err) {
        if (force) console.warn('[QasimFlix] Tam ekran/yatay izin verilmedi:', err);
        return false;
    }
}

function prepareMobilePlayerStart() {
    const modal = document.getElementById('player-modal');
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (isMobileViewport()) {
        const start = document.getElementById('qf-landscape-start');
        const autoTry = !window.qfGetSetting || window.qfGetSetting('tryFullscreen', true) || window.qfGetSetting('tryLandscape', true);
        if (start && autoTry) start.classList.add('show');
        if (autoTry) requestPlayerLandscape(false).then(ok => {
            if (ok) start?.classList.remove('show');
        });
        if (window.qfEnablePlayerCinema) setTimeout(window.qfEnablePlayerCinema, 60);
    }
}

async function playEpisode(episodeId, isMovie = false) {
    if (qasimPlayOpenBusy) return;
    qasimPlayOpenBusy = true;
    qasimAutoNextBusy = false;
    clearEpisodeAutoNextTimer();
    const requestToken = ++qasimActiveLoadToken;

    try {
        prepareMobilePlayerStart();
        initQasimPlayerControls();
        closeDetailModal();
        setQasimLoading(true);
        showQasimControls();

        const info = document.getElementById('player-ep-info');
        if (info) info.textContent = 'Video hazırlanıyor...';
        const downloadBtnContainer = document.getElementById('player-download-btn-container');
        if (downloadBtnContainer) downloadBtnContainer.innerHTML = '';

        // Önce cache'deki (currentSeries.seasons) episode'u bul; bulunamazsa modal açık kalırken API arkadan alınır.
        let episode = null;
        const seasons = currentSeries?.seasons || [];
        for (const s of seasons) {
            const found = (s.episodes || []).find(e => String(e._id) === String(episodeId));
            if (found) { episode = found; break; }
        }

        if (!episode) {
            const res = await fetch(API + '/episode/' + episodeId + '?_=' + Date.now());
            episode = await res.json();
        }

        if (requestToken !== qasimActiveLoadToken) return;

        if (Array.isArray(episode) || !episode || !episode.videoUrl) {
            setQasimLoading(false);
            const infoEl = document.getElementById('player-ep-info');
            if (infoEl) infoEl.textContent = 'Video bulunamadı';
            return;
        }

        currentEpisode = episode;
        window.currentEpisode = currentEpisode;
        window.currentSeries = currentSeries;
        window.currentSeason = currentSeason;
        saveProgressSeconds(episodeId, 1, true).catch(() => {});

        let src = episode.videoUrl || '';
        const rawIframeSrc = /^\s*</.test(src) && src.includes('iframe') ? extractIframeSrc(src) : '';
        if (rawIframeSrc) src = rawIframeSrc;
        // Kalite kaynakları admin panelinden girildiyse ilk kalite ana kaynak olarak kullanılır.
        const initialQualitySources = parseQualitySources(episode, src);
        if (initialQualitySources.length && initialQualitySources[0]?.url) src = initialQualitySources[0].url;

        // Episode info label, kaynak yüklenmeden önce yazı görünsün.
        let infoText = '';
        if (currentSeason) {
            infoText = `S${pad(currentSeason.seasonNumber)}E${pad(episode.episodeNumber)}: ${episode.title}`;
        } else {
            infoText = episode.title || (currentSeries?.title || '');
        }
        const infoEl = document.getElementById('player-ep-info');
        if (infoEl) infoEl.textContent = infoText || 'Video hazırlanıyor...';

        if (downloadBtnContainer) {
            downloadBtnContainer.innerHTML = `<button class="btn-info sm" style="background:var(--accent);color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.8rem;" onclick="downloadItem('episode', '${episode._id}', '${src}', '${infoText}')" data-i18n="action.download">${qfText('action.download')}</button>`;
        }

        const canUseHtmlPlayer = isDirectVideoUrl(src) || (!isGoogleDriveUrl(src) && !isYouTubeUrl(src) && !/^\s*</.test(src));

        if (isYouTubeUrl(src)) {
            showIframe(toYouTubeEmbed(src), { type: 'youtube' });
            scheduleIframeAutoNextFallback(episode);
        } else if (isGoogleDriveUrl(src)) {
            showIframe(getGoogleDrivePreviewUrl(src), { type: 'drive' });
            scheduleIframeAutoNextFallback(episode);
        } else if (canUseHtmlPlayer) {
            qasimQualitySources = initialQualitySources && initialQualitySources.length ? initialQualitySources : parseQualitySources(episode, src);
            fillQualitySelect(qasimQualitySources);
            const subWrap = document.getElementById('sub-wrap');
            if (subWrap) subWrap.style.display = '';
            loadSubtitles(episode.subtitles || []);

            const videoPlayer = document.getElementById('video-player');
            if (videoPlayer) {
                clearEpisodeAutoNextTimer();
                qasimAutoNextBusy = false;
                videoPlayer.ontimeupdate = () => { saveProgress(episodeId); updateQasimControls(); };
                videoPlayer.onended = () => handleEpisodeEndedAutoNext('ended');
                videoPlayer.onerror = () => {
                    setQasimLoading(false);
                    const infoErr = document.getElementById('player-ep-info');
                    if (infoErr) infoErr.textContent = 'Video yüklenemedi';
                };
            }

            setVideoSource(qasimQualitySources[0]?.url || src, 0, true);

            // İzleme geçmişi player açılışını bekletmez; video görünürken arka planda uygulanır.
            loadProgress(episodeId).catch(() => {});
        } else if (rawIframeSrc) {
            showIframe(rawIframeSrc);
            scheduleIframeAutoNextFallback(episode);
        } else if (src) {
            showIframe(src);
            scheduleIframeAutoNextFallback(episode);
        } else {
            setQasimLoading(false);
        }
    } catch (err) {
        setQasimLoading(false);
        const infoEl = document.getElementById('player-ep-info');
        if (infoEl) infoEl.textContent = 'Video açılamadı';
    } finally {
        setTimeout(() => { qasimPlayOpenBusy = false; }, 700);
    }
}

function closePlayer() {
    try {
        const v = document.getElementById('video-player');
        if (currentEpisode?._id && v && Number(v.currentTime) > 0) saveProgressSeconds(currentEpisode._id, v.currentTime, true).catch(() => {});
    } catch (_) {}
    hideAutoNextOverlay();
    if (window.qfDisablePlayerCinema) window.qfDisablePlayerCinema();
    qasimPlayOpenBusy = false;
    qasimAutoNextBusy = false;
    clearEpisodeAutoNextTimer();
    qasimActiveLoadToken++;
    const modal = document.getElementById('player-modal');
    if (modal) modal.classList.remove('open', 'embed-mode', 'drive-embed-mode');
    document.body.style.overflow = '';
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e) {}
    const video = document.getElementById('video-player');
    try { video.pause(); } catch(e) {}
    const videoSource = document.getElementById('video-source');
    if (videoSource) videoSource.src = '';
    try { video?.load(); } catch(e) {}
    const embed = document.getElementById('embed-player');
    if (embed) {
        embed.innerHTML = '';
        embed.style.display = 'none';
    }
    if (video) video.style.display = 'block';
    const controls = document.getElementById('qasim-video-controls');
    if (controls) controls.style.display = '';
    const subWrapClose = document.getElementById('sub-wrap');
    if (subWrapClose) subWrapClose.style.display = '';
    const qualityWrap = document.getElementById('quality-wrap');
    if (qualityWrap) qualityWrap.style.display = '';
    // minHeight sıfırla (showIframe tarafından set edilmiş olabilir)
    const playerWrap = document.getElementById('player-wrap');
    if (playerWrap) playerWrap.style.minHeight = '';
    setQasimLoading(false);
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
async function saveProgressSeconds(episodeId, progress, force = false) {
    progress = Math.max(1, Math.floor(Number(progress) || 1));
    if (!episodeId || !currentSeries?._id) return;
    const now = Date.now();
    if (!force && now - lastProgressSaveTime < 10000) return; // Throttle: 10 seconds
    lastProgressSaveTime = now;
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
        const body = { seriesId: currentSeries._id, episodeId, progress };
        if (!TOKEN) body.userId = USER_ID;
        await fetch(API + '/progress', { method: 'POST', headers, body: JSON.stringify(body) });
        if (typeof loadContinueWatching === 'function') setTimeout(() => loadContinueWatching().catch?.(() => {}), 400);
    } catch (err) { /* silent */ }
}

async function saveProgress(episodeId) {
    const video = document.getElementById('video-player');
    const progress = Math.floor(video?.currentTime || 0);
    if (!progress) return;
    await saveProgressSeconds(episodeId, progress, false);
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
            const video = document.getElementById('video-player');
            if (!video) return;
            const applyProgress = () => {
                if (Number.isFinite(video.duration)) {
                    video.currentTime = Math.min(data.progress, Math.max(0, video.duration - 2));
                } else {
                    video.currentTime = data.progress;
                }
            };
            if (video.readyState >= 1) applyProgress();
            else video.addEventListener('loadedmetadata', applyProgress, { once: true });
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
        alert(qfText('download.unsupported'));
    }
}

// ═══════════════════════════════════════════
// FAVORITES & WATCHLIST
// ═══════════════════════════════════════════
async function addToFavorites(seriesId) {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    try {
    const res = await fetch(API + '/favorites/add', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesId })
    });
    const data = await res.json();
    if (res.ok) alert(data.message || qfText('alert.favoritesAdded'));
    else alert(data.error || 'Hata');
  } catch (err) { alert(qfText('alert.favoriteError')); }
}

async function removeFromFavorites(seriesId) {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    try {
        const res = await fetch(API + '/favorites/remove', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ seriesId })
        });
        const data = await res.json();
        if (res.ok) alert(data.message || qfText('alert.favoriteRemoved'));
        else alert(data.error || 'Hata');
    } catch (err) { alert(qfText('alert.favoriteError')); }
}

async function addToWatchlist(seriesId) {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    try {
        const res = await fetch(API + '/watchlist/add', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ seriesId })
        });
        const data = await res.json();
        if (res.ok) alert(data.message || qfText('alert.watchlistAdded'));
        else alert(data.error || 'Hata');
    } catch (err) { alert(qfText('alert.watchlistError')); }
}



async function loadWatchlist() {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    try {
        const res = await fetch(API + '/watchlist', {
            headers: { 'Authorization': 'Bearer ' + TOKEN }
        });
        if (res.ok) {
            const watchlist = await res.json();
            displayFavorites(watchlist);
        }
    } catch (err) { console.error(err); }
}

// ═══════════════════════════════════════════
// RATING & REVIEWS
// ═══════════════════════════════════════════
async function submitRating(seriesId) {
    if (!TOKEN) {
        alert('Yorum yapmak için önce giriş yapmalısın.');
        return;
    }

    const ratingRaw = prompt('Puanınız (1-5):');
    if (!ratingRaw) return;
    const rating = Number(ratingRaw);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        alert('Puan 1 ile 5 arasında olmalı.');
        return;
    }

    const review = prompt('Yorumunuz:') || '';
    try {
        const res = await fetch(API + '/ratings/add', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ seriesId, rating, review })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            alert(data.message || 'Yorumun kaydedildi.');
            loadRatings(seriesId).catch(() => {});
        } else {
            alert(data.error || 'Yorum kaydedilemedi.');
        }
    } catch (err) {
        alert('Yorum kaydedilemedi. İnternet bağlantını kontrol et.');
    }
}

async function loadRatings(seriesId) {
    const modalBody = document.querySelector('#detail-modal .modal-body');
    if (!modalBody || !seriesId) return;

    let area = document.getElementById('rating-reviews-area');
    if (!area) {
        area = document.createElement('div');
        area.id = 'rating-reviews-area';
        area.style.cssText = 'margin-top:20px;border-top:1px solid var(--border);padding-top:20px;';
        modalBody.appendChild(area);
    }
    area.innerHTML = '<h3 style="margin:0 0 12px">Yorumlar</h3><p style="color:var(--muted);font-size:.85rem">Yorumlar yükleniyor...</p>';

    try {
        const res = await fetch(API + '/ratings/' + seriesId + '?_=' + Date.now());
        if (!res.ok) throw new Error('ratings_failed');
        const ratings = await res.json();
        let html = '<h3 style="margin:0 0 12px">Yorumlar</h3>';
        if (!ratings.length) {
            html += '<p style="color:var(--muted);font-size:.85rem">Henüz yorum yok. İlk yorumu sen yap.</p>';
        } else {
            ratings.forEach(r => {
                const userName = esc(r.userId?.name || r.userId?.email || 'Anonim');
                const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : '';
                html += `<div class="qf-review-card">`;
                html += `<strong>${userName}</strong> <span>⭐ ${Number(r.rating || 0)}/5</span>`;
                if (date) html += `<small>${date}</small>`;
                if (r.review) html += `<p>${esc(r.review)}</p>`;
                html += `</div>`;
            });
        }
        area.innerHTML = html;
    } catch (err) {
        area.innerHTML = '<h3 style="margin:0 0 12px">Yorumlar</h3><p style="color:var(--muted);font-size:.85rem">Yorumlar şu an yüklenemedi.</p>';
    }
}

// ═══════════════════════════════════════════
// ADVANCED SEARCH
// ═══════════════════════════════════════════
async function advancedSearch(query, category, year, minRating, sortBy) {
    try {
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (category) params.append('category', category);
        if (year) params.append('year', year);
        if (minRating) params.append('minRating', minRating);
        if (sortBy) params.append('sortBy', sortBy);
        
        const res = await fetch(API + '/search/advanced?' + params.toString());
        if (res.ok) {
            const results = await res.json();
            displayFavorites(results);
        }
    } catch (err) { console.error(err); }
}

// ═══════════════════════════════════════════
// USER PREFERENCES & PROFILE
// ═══════════════════════════════════════════
async function toggleDarkMode() {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newMode = !isDark;
    
    try {
        const res = await fetch(API + '/user/preferences', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ darkMode: newMode })
        });
        if (res.ok) {
            document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
            localStorage.setItem('darkMode', newMode);
        }
    } catch (err) { console.error(err); }
}

async function setVideoQuality(quality) {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    try {
        const res = await fetch(API + '/user/preferences', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferredQuality: quality })
        });
        if (res.ok) {
            alert('Video kalitesi ' + quality + ' olarak ayarlandı');
        }
    } catch (err) { console.error(err); }
}

async function updateProfile(name, profilePicture) {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    try {
        const res = await fetch(API + '/user/profile', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, profilePicture })
        });
        if (res.ok) {
            await initAuth();
            alert('Profil güncellendi');
        }
    } catch (err) { alert(qfText('alert.favoriteError')); }
}

// ═══════════════════════════════════════════
// PARENTAL CONTROLS
// ═══════════════════════════════════════════
async function createChildProfile(name, ageRestriction, pinCode) {
    if (!TOKEN) { alert('Lütfen önce giriş yapın'); return; }
    try {
        const res = await fetch(API + '/user/profiles', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ageRestriction, pinCode })
        });
        if (res.ok) {
            alert('Çocuk profili oluşturuldu');
        }
    } catch (err) { alert(qfText('alert.favoriteError')); }
}

// ═══════════════════════════════════════════
// PROFİL YÖNETİMİ & PIN SİSTEMİ
// ═══════════════════════════════════════════

let ACTIVE_PROFILE = null; // Seçili profil (null = ana hesap)
let _pinResolve = null;

const PROFILE_EMOJIS = ['🎬','🎭','🌟','🦁','🐬','🦊','🌈','🎮','👑','🏆'];

function getProfileEmoji(name) {
  const idx = name ? (name.charCodeAt(0) % PROFILE_EMOJIS.length) : 0;
  return PROFILE_EMOJIS[idx];
}

// ── Profil Seçim Ekranı ──────────────────────────────────
async function openProfileSelectScreen() {
  if (!AUTH_USER) return;
  const screen = document.getElementById('profile-select-screen');
  screen.style.display = 'flex';

  // Profil verilerini çek
  let profiles = { mainProfile: null, childProfiles: [] };
  try {
    const res = await fetch(API + '/user/profiles', { headers: { 'Authorization': 'Bearer ' + TOKEN } });
    if (res.ok) profiles = await res.json();
  } catch (e) {}

  const container = document.getElementById('profile-avatars');
  container.innerHTML = '';

  // Ana profil kartı
  const main = profiles.mainProfile || { name: AUTH_USER.name || 'Ana Hesap', isMain: true };
  container.innerHTML += profileAvatarCard(null, main.name, true);

  // Alt profil kartları
  (profiles.childProfiles || []).forEach(p => {
    container.innerHTML += profileAvatarCard(p._id, p.name, false, !!p.pinCode, p.ageRestriction);
  });
}

function profileAvatarCard(id, name, isMain, hasPin = false, age = null) {
  const emoji = getProfileEmoji(name);
  const ageLabel = age && age < 18 ? `<div style="font-size:.65rem;color:var(--muted);margin-top:2px">${age}+</div>` : '';
  const pinIcon = hasPin ? `<div style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:.6rem">🔒</div>` : '';
  return `
    <div onclick="${isMain ? 'selectMainProfile()' : `selectChildProfile('${id}','${name}',${hasPin})`}"
         style="display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:10px;transition:background .2s;width:110px;min-width:90px"
         onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background='transparent'">
      <div style="position:relative;width:72px;height:72px;border-radius:10px;background:linear-gradient(135deg,${isMain?'var(--accent),#f40612':'#6c63ff,#a78bfa'});display:flex;align-items:center;justify-content:center;font-size:2.2rem;border:2px solid ${ACTIVE_PROFILE===null&&isMain || ACTIVE_PROFILE&&ACTIVE_PROFILE._id===id?'#fff':'transparent'}">
        ${emoji}${pinIcon}
      </div>
      <div style="font-size:.85rem;font-weight:500;text-align:center;word-break:break-word;max-width:90px">${name || 'Profil'}</div>
      ${ageLabel}
    </div>`;
}

function selectMainProfile() {
  ACTIVE_PROFILE = null;
  closeProfileSelectScreen();
  updateActiveProfileBadge();
}

async function selectChildProfile(id, name, hasPin = false) {
  if (hasPin) {
    const ok = await showPinModal(id, name);
    if (!ok) return;
  }
  ACTIVE_PROFILE = { _id: id, name };
  closeProfileSelectScreen();
  updateActiveProfileBadge();
}

function closeProfileSelectScreen() {
  document.getElementById('profile-select-screen').style.display = 'none';
}

function updateActiveProfileBadge() {
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) {
    nameEl.textContent = ACTIVE_PROFILE ? ACTIVE_PROFILE.name : (AUTH_USER ? (AUTH_USER.name || AUTH_USER.email) : '');
  }
}

// ── PIN Modali ───────────────────────────────────────────
function showPinModal(profileId, profileName) {
  return new Promise(resolve => {
    _pinResolve = resolve;
    document.getElementById('pin-profile-name').textContent = profileName;
    document.querySelector('#pin-avatar-display').textContent = getProfileEmoji(profileName);
    document.querySelectorAll('.pin-box').forEach(b => { b.value = ''; b.style.borderColor = 'var(--border)'; });
    document.getElementById('pin-error').textContent = '';
    document.getElementById('pin-modal').classList.add('open');
    setTimeout(() => document.querySelectorAll('.pin-box')[0].focus(), 100);

    // Attach profileId to modal for verify
    document.getElementById('pin-modal').dataset.profileId = profileId;
  });
}

function closePinModal() {
  document.getElementById('pin-modal').classList.remove('open');
  if (_pinResolve) { _pinResolve(false); _pinResolve = null; }
}

function pinInput(input, idx) {
  input.value = input.value.replace(/[^0-9]/g,'');
  input.style.borderColor = input.value ? 'var(--accent)' : 'var(--border)';
  const boxes = document.querySelectorAll('.pin-box');
  if (input.value && idx < 3) { boxes[idx + 1].focus(); }
  if (idx === 3 && input.value) { submitPin(); }
}

function pinKeyDown(event, idx) {
  const boxes = document.querySelectorAll('.pin-box');
  if (event.key === 'Backspace' && !boxes[idx].value && idx > 0) { boxes[idx - 1].focus(); }
  if (event.key === 'Enter') { submitPin(); }
}

async function submitPin() {
  const boxes = document.querySelectorAll('.pin-box');
  const pin = Array.from(boxes).map(b => b.value).join('');
  if (pin.length < 4) { document.getElementById('pin-error').textContent = '4 haneli PIN giriniz'; return; }

  const profileId = document.getElementById('pin-modal').dataset.profileId;
  try {
    const res = await fetch(API + `/user/profiles/${profileId}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('pin-modal').classList.remove('open');
      if (_pinResolve) { _pinResolve(true); _pinResolve = null; }
    } else {
      document.getElementById('pin-error').textContent = 'Yanlış PIN, tekrar deneyin';
      boxes.forEach(b => { b.value = ''; b.style.borderColor = '#ff6b6b'; });
      setTimeout(() => { boxes.forEach(b => b.style.borderColor = 'var(--border)'); }, 1200);
      boxes[0].focus();
    }
  } catch (e) {
    document.getElementById('pin-error').textContent = 'Bağlantı hatası';
  }
}

// ── Profil Yönetim Modali ────────────────────────────────
async function openProfileManageModal() {
  if (!AUTH_USER) { alert('Lütfen önce giriş yapın'); return; }
  // Kapat screen varsa
  closeProfileSelectScreen();
  document.getElementById('profile-manage-modal').classList.add('open');

  // Ana profil alanını doldur
  document.getElementById('mp-name').textContent = AUTH_USER.name || AUTH_USER.email || '';
  document.getElementById('mp-name-input').value = AUTH_USER.name || '';
  document.getElementById('mp-avatar').textContent = getProfileEmoji(AUTH_USER.name);

  await reloadChildProfilesList();
}

function closeProfileManageModal() {
  document.getElementById('profile-manage-modal').classList.remove('open');
}

async function reloadChildProfilesList() {
  const list = document.getElementById('child-profiles-list');
  if (!list) return;
  
  list.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:4px">Yükleniyor...</div>';
  
  try {
    if (!AUTH_USER || !AUTH_USER._id) return;
    
    const res = await fetch(API + '/user/profiles', {
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    });
    
    if (!res.ok) throw new Error('Profiller yüklenemedi');
    
    const profiles = await res.json();
    
    if (!profiles || profiles.length === 0) {
      list.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:8px">Henüz profil oluşturulmadı.</div>';
      return;
    }
    
    list.innerHTML = profiles.map(p => `
      <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;padding:14px 16px;display:flex;align-items:center;gap:12px" id="cpcard-${p._id}">
        <div style="width:40px;height:40px;border-radius:8px;background:linear-gradient(135deg,#6c63ff,#a78bfa);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${getProfileEmoji(p.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.88rem;font-weight:600">${p.name}</div>
          <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${p.ageRestriction || 18}+ yaş · ${p.hasPin ? '🔒 PIN korumalı' : '🔓 PIN yok'}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button onclick="editChildProfile('${p._id}','${p.name}',${p.ageRestriction||18},${!!p.hasPin})" style="background:rgba(255,255,255,0.08);border:1px solid var(--border);color:var(--muted);padding:6px 12px;border-radius:5px;cursor:pointer;font-size:.75rem;font-family:var(--font)">Düzenle</button>
          <button onclick="deleteChildProfile('${p._id}','${p.name}')" style="background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.3);color:#ff6b6b;padding:6px 10px;border-radius:5px;cursor:pointer;font-size:.75rem">Sil</button>
        </div>
      </div>`).join('');
  } catch (e) {
    console.error('Error loading profiles:', e);
    list.innerHTML = '<div style="color:#ff6b6b;font-size:.8rem;padding:8px">Profiller yüklenemedi.</div>';
  }
}

// ═══════════════════════════════════════════════════════
// LANDSCAPE MODE & FULLSCREEN (Mobile)
// ═══════════════════════════════════════════════════════

function initLandscapeMode() {
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (!fullscreenBtn) return;

  // Fullscreen button click
  fullscreenBtn.addEventListener('click', () => {
    const playerModal = document.getElementById('player-modal');
    if (!playerModal) return;

    // Request fullscreen
    const elem = playerModal;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }

    // Try to lock to landscape
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(err => {
        console.log('Orientation lock not supported:', err);
      });
    }
  });

  // Orientation change listener
  window.addEventListener('orientationchange', () => {
    const playerModal = document.getElementById('player-modal');
    if (playerModal && playerModal.classList.contains('open')) {
      const video = document.getElementById('video-player');
      const embed = document.getElementById('embed-player');
      
      if (window.innerHeight < window.innerWidth) {
        // Landscape mode
        playerModal.style.padding = '0';
        playerModal.style.height = '100vh';
        if (video) video.style.maxHeight = 'calc(100vh - 100px)';
        if (embed) embed.style.height = 'calc(100vh - 100px)';
      } else {
        // Portrait mode
        playerModal.style.padding = '20px';
        playerModal.style.height = 'auto';
        if (video) video.style.maxHeight = '60vh';
        if (embed) embed.style.height = '60vh';
      }
    }
  });

  // Screen orientation lock for landscape viewing
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement && screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(err => {
        console.log('Landscape lock not available');
      });
    }
    updateQasimControls(); // fullscreen ikonlarını güncelle
  });
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  initLandscapeMode();
  initKeyboardShortcuts();
  initSwipeGestures();
});

// Also initialize if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLandscapeMode();
    initKeyboardShortcuts();
    initSwipeGestures();
  });
} else {
  initLandscapeMode();
  initKeyboardShortcuts();
  initSwipeGestures();
}

// ═══════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const video = document.getElementById('video-player');
    const playerModal = document.getElementById('player-modal');
    
    if (!playerModal || !playerModal.classList.contains('open') || !video) return;

    // Prevent default if focused on input
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    switch(e.code) {
      case 'Space':
        e.preventDefault();
        video.paused ? video.play() : video.pause();
        break;
      case 'KeyF':
        e.preventDefault();
        if (video.requestFullscreen) {
          video.requestFullscreen();
        }
        break;
      case 'KeyN':
        e.preventDefault();
        nextEpisode();
        break;
      case 'KeyP':
        e.preventDefault();
        previousEpisode();
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime += 10;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime -= 10;
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        break;
      case 'KeyM':
        e.preventDefault();
        video.muted = !video.muted;
        break;
    }
  });
}

// ═══════════════════════════════════════════════════════
// SWIPE GESTURES (Mobile)
// ═══════════════════════════════════════════════════════

function initSwipeGestures() {
  let touchStartX = 0;
  let touchEndX = 0;
  let touchStartY = 0;
  let touchEndY = 0;
  let lastTapTime = 0;
  let lastTapX = 0;

  const playerModal = document.getElementById('player-modal');
  if (!playerModal) return;

  // ─── Double-tap to seek (sol = -10s, sağ = +10s) ───
  playerModal.addEventListener('touchend', (e) => {
    // Kontrol butonlarına dokunulmuşsa pas geç
    if (e.target.closest('.qasim-video-controls') || e.target.closest('.player-bar')) return;

    const video = document.getElementById('video-player');
    if (!video || video.style.display === 'none') return;

    const now = Date.now();
    const tapX = e.changedTouches[0].clientX;

    if (now - lastTapTime < 300 && Math.abs(tapX - lastTapX) < 80) {
      // Çift tıklama
      const rect = playerModal.getBoundingClientRect();
      const relX = tapX - rect.left;
      if (relX < rect.width / 2) {
        video.currentTime = Math.max(0, video.currentTime - 10);
        showSeekIndicator('⏪ 10s', 'left');
      } else {
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
        showSeekIndicator('10s ⏩', 'right');
      }
      lastTapTime = 0;
    } else {
      lastTapTime = now;
      lastTapX = tapX;
    }
  }, false);

  // ─── Swipe: yatay = bölüm değiştir, dikey = ses ───
  const playerWrap = document.getElementById('player-wrap');
  if (playerWrap) {
    playerWrap.addEventListener('touchstart', (e) => {
      if (e.target.closest('.qasim-video-controls')) return;
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    playerWrap.addEventListener('touchend', (e) => {
      if (e.target.closest('.qasim-video-controls')) return;
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      handleSwipe();
    }, false);
  }

  function handleSwipe() {
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
      // Yatay swipe → bölüm değiştir
      if (diffX > 0) nextEpisode();
      else previousEpisode();
    } else if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 30) {
      // Dikey swipe → ses ayarla
      const video = document.getElementById('video-player');
      if (!video || video.style.display === 'none') return;
      const delta = diffY / 200; // ne kadar kaydırıldı
      video.volume = Math.min(1, Math.max(0, video.volume + delta));
      video.muted = video.volume === 0;
      updateQasimControls();
    }
  }

  // ─── Seek göstergesi ───
  function showSeekIndicator(text, side) {
    let ind = document.getElementById('qasim-seek-indicator');
    if (!ind) {
      ind = document.createElement('div');
      ind.id = 'qasim-seek-indicator';
      ind.style.cssText = `
        position:absolute;top:50%;transform:translateY(-50%);
        background:rgba(0,0,0,.65);color:#fff;
        padding:10px 18px;border-radius:8px;font-size:1rem;font-weight:700;
        pointer-events:none;z-index:20;transition:opacity .3s;
      `;
      const wrap = document.getElementById('player-wrap');
      if (wrap) wrap.appendChild(ind);
    }
    ind.textContent = text;
    ind.style.opacity = '1';
    ind.style.left = side === 'left' ? '14%' : 'auto';
    ind.style.right = side === 'right' ? '14%' : 'auto';
    clearTimeout(ind._hideTimer);
    ind._hideTimer = setTimeout(() => { ind.style.opacity = '0'; }, 800);
  }
}

// ═══════════════════════════════════════════════════════
// EPISODE NAVIGATION
// ═══════════════════════════════════════════════════════

function nextEpisode() {
  if (!currentSeason || !currentEpisode) return;
  
  const episodes = currentSeason.episodes || [];
  const currentIdx = episodes.findIndex(e => String(e._id) === String(currentEpisode._id));
  
  if (currentIdx >= 0 && currentIdx < episodes.length - 1) {
    playEpisode(episodes[currentIdx + 1]._id);
  }
}

function previousEpisode() {
  if (!currentSeason || !currentEpisode) return;
  
  const episodes = currentSeason.episodes || [];
  const currentIdx = episodes.findIndex(e => String(e._id) === String(currentEpisode._id));
  
  if (currentIdx > 0) {
    playEpisode(episodes[currentIdx - 1]._id);
  }
}

// ═══════════════════════════════════════════════════════
// VIEWING STATISTICS & WATCH HISTORY
// ═══════════════════════════════════════════════════════

function trackViewingTime(duration) {
  if (!currentEpisode || !currentSeries) return;

  const viewingData = {
    seriesId: currentSeries._id,
    seriesTitle: currentSeries.title,
    episodeId: currentEpisode._id,
    episodeNum: currentEpisode.episodeNumber,
    duration: duration,
    watchedAt: new Date().toISOString(),
    userId: USER_ID
  };

  // Save to localStorage
  let viewingStats = JSON.parse(localStorage.getItem('viewingStats') || '[]');
  viewingStats.push(viewingData);
  
  // Keep only last 100 entries
  if (viewingStats.length > 100) {
    viewingStats = viewingStats.slice(-100);
  }
  
  localStorage.setItem('viewingStats', JSON.stringify(viewingStats));

  // Send to server if logged in
  if (TOKEN) {
    fetch(API + '/viewing-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + TOKEN
      },
      body: JSON.stringify(viewingData)
    }).catch(err => console.log('Stats tracking error:', err));
  }
}

function getViewingStats() {
  const stats = JSON.parse(localStorage.getItem('viewingStats') || '[]');
  
  let totalWatched = 0;
  let totalSeries = new Set();
  let watchDates = {};

  stats.forEach(s => {
    totalWatched += s.duration;
    totalSeries.add(s.seriesId);
    
    const date = new Date(s.watchedAt).toLocaleDateString();
    watchDates[date] = (watchDates[date] || 0) + s.duration;
  });

  return {
    totalMinutesWatched: Math.round(totalWatched / 60),
    totalSeriesWatched: totalSeries.size,
    recentActivity: stats.slice(-5),
    watchDates: watchDates
  };
}

function displayViewingStats() {
  const stats = getViewingStats();
  const msg = `📊 İzleme İstatistikleri\n` +
    `Toplam İzlenmiş: ${stats.totalMinutesWatched} dakika\n` +
    `Dizi Sayısı: ${stats.totalSeriesWatched}`;
  console.log(msg);
  return stats;
}

// Track video playback end
document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video-player');
  if (video) {
    video.addEventListener('ended', () => {
      trackViewingTime(Math.round(video.duration / 60));
    });
    
    // Also track on video time update every 30 seconds
    let lastTracked = 0;
    video.addEventListener('timeupdate', () => {
      if (video.currentTime - lastTracked >= 30 && !video.paused) {
        trackViewingTime(Math.round(video.currentTime / 60));
        lastTracked = video.currentTime;
      }
    });
  }
});

// ═══════════════════════════════════════════════════════
// LANDSCAPE MODE & FULLSCREEN (Mobile)
// ═══════════════════════════════════════════════════════

async function saveMainProfile() {
  const name = document.getElementById('mp-name-input').value.trim();
  if (!name) { alert('Ad boş olamaz'); return; }
  try {
    const res = await fetch(API + '/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      await initAuth();
      document.getElementById('mp-name').textContent = name;
      document.getElementById('mp-avatar').textContent = getProfileEmoji(name);
      alert('Profil güncellendi');
    } else {
      const e = await res.json(); alert(e.error || 'Hata');
    }
  } catch (e) { alert('Bağlantı hatası'); }
}

async function changePassword() {
  const cur = document.getElementById('mp-cur-pass').value;
  const nw = document.getElementById('mp-new-pass').value;
  if (!cur || !nw) { alert('Her iki alan da doldurulmalı'); return; }
  try {
    const res = await fetch(API + '/user/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify({ currentPassword: cur, newPassword: nw })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('mp-cur-pass').value = '';
      document.getElementById('mp-new-pass').value = '';
      alert('Şifre başarıyla değiştirildi');
    } else {
      alert(data.error || 'Hata');
    }
  } catch (e) { alert('Bağlantı hatası'); }
}

async function addNewChildProfile() {
  const name = document.getElementById('new-profile-name').value.trim();
  const age = parseInt(document.getElementById('new-profile-age').value);
  const pin = document.getElementById('new-profile-pin').value.trim();
  if (!name) { alert('Profil adı gerekli'); return; }
  if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) { alert('PIN 4 haneli sayı olmalı'); return; }
  try {
    const res = await fetch(API + '/user/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify({ name, ageRestriction: age, pinCode: pin || null })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('new-profile-name').value = '';
      document.getElementById('new-profile-pin').value = '';
      await reloadChildProfilesList();
    } else { alert(data.error || 'Hata'); }
  } catch (e) { alert('Bağlantı hatası'); }
}

function editChildProfile(id, name, age, hasPin) {
  const newName = prompt('Yeni profil adı:', name);
  if (!newName) return;
  const newAge = prompt('Yaş sınırı (6/12/16/18):', age);
  const newPin = prompt('Yeni PIN (boş bırakırsan ' + (hasPin?'eskisi kalır':'PIN eklenmez') + '): (4 haneli sayı)');

  const body = { name: newName, ageRestriction: parseInt(newAge) || age };
  if (newPin !== null && newPin.trim() !== '') {
    if (!/^\d{4}$/.test(newPin.trim())) { alert('PIN 4 haneli sayı olmalı'); return; }
    body.pinCode = newPin.trim();
  }

  fetch(API + `/user/profiles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify(body)
  }).then(r => r.json()).then(d => {
    if (d._id) reloadChildProfilesList();
    else alert(d.error || 'Güncelleme hatası');
  }).catch(() => alert('Bağlantı hatası'));
}

async function deleteChildProfile(id, name) {
  if (!confirm(`"${name}" profilini silmek istediğinize emin misiniz?`)) return;
  try {
    const res = await fetch(API + `/user/profiles/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    });
    const data = await res.json();
    if (data.success) {
      if (ACTIVE_PROFILE && ACTIVE_PROFILE._id === id) { ACTIVE_PROFILE = null; updateActiveProfileBadge(); }
      await reloadChildProfilesList();
    } else { alert(data.error || 'Silme hatası'); }
  } catch (e) { alert('Bağlantı hatası'); }
}

// ── Giriş sonrası profil seçim ekranını göster ───────────
function applyTheme() {
    const isDark = localStorage.getItem('darkMode') !== 'false';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (!isDark) {
        document.documentElement.style.setProperty('--bg', '#ffffff');
        document.documentElement.style.setProperty('--bg2', '#f5f5f5');
        document.documentElement.style.setProperty('--text', '#000000');
        document.documentElement.style.setProperty('--muted', '#666666');
    }
}

// Initialize theme on page load
window.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    initAuth().then(() => {
        // Giriş sonrası profil seçim ekranını göster
        const params = new URLSearchParams(window.location.search);
        if (params.get('showProfiles') === '1' && AUTH_USER) {
            // URL'yi temizle
            history.replaceState({}, '', window.location.pathname);
            openProfileSelectScreen();
        }
        // Hide loading spinner
        hideLoading();
    }).catch(err => {
        console.error('Init error:', err);
        hideLoading();
    });
});

// Auto-hide loading after 5 seconds (failsafe)
window.addEventListener('load', () => {
    setTimeout(() => {
        hideLoading();
    }, 1000);
});

// ═══════════════════════════════════════════
// EXPOSE FUNCTIONS FOR INLINE EVENT HANDLERS
// ═══════════════════════════════════════════
window.pinInput = pinInput;
window.pinKeyDown = pinKeyDown;
window.closePinModal = closePinModal;
window.toggleFavorite = toggleFavorite;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.reloadChildProfilesList = reloadChildProfilesList;
window.saveMainProfile = saveMainProfile;
window.changePassword = changePassword;
window.addNewChildProfile = addNewChildProfile;