// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const API = window.location.origin + '/api';

// Mevcut giriş yapmış kullanıcı
let currentAuthUser = null;  // { id, username, email }
let authToken = null;

// LocalStorage'dan token ve kullanıcıyı yükle
function loadStoredAuth() {
    try {
        const stored = localStorage.getItem('qasimflix_auth');
        if (stored) {
            const data = JSON.parse(stored);
            authToken = data.token || null;
            currentAuthUser = data.user || null;
        }
    } catch (e) {
        authToken = null;
        currentAuthUser = null;
    }
}

function saveAuth(token, user) {
    authToken = token;
    currentAuthUser = user;
    localStorage.setItem('qasimflix_auth', JSON.stringify({ token, user }));
}

function clearAuth() {
    authToken = null;
    currentAuthUser = null;
    localStorage.removeItem('qasimflix_auth');
}

function getAuthHeaders() {
    if (!authToken) return { 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken };
}

function getUserId() {
    return currentAuthUser?.id || null;
}

let heroData = null;
let currentSeries = null;
let currentSeason = null;
let currentEpisode = null;
let currentFilter = null;
let allData = [];

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
window.addEventListener('load', async () => {
    loadStoredAuth();
    updateAuthUI();
    await loadAll();
    if (currentAuthUser) {
        loadContinueWatching();
    }
});

window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

// ═══════════════════════════════════════════
// AUTH UI
// ═══════════════════════════════════════════
function updateAuthUI() {
    const authSection = document.getElementById('auth-section');
    const userSection = document.getElementById('user-section');
    const userNameEl  = document.getElementById('user-display-name');

    if (currentAuthUser) {
        if (authSection) authSection.style.display = 'none';
        if (userSection) userSection.style.display = 'flex';
        if (userNameEl)  userNameEl.textContent = currentAuthUser.username;
        loadContinueWatching();
    } else {
        if (authSection) authSection.style.display = 'flex';
        if (userSection) userSection.style.display = 'none';
        const section = document.getElementById('continue-section');
        if (section) section.style.display = 'none';
    }
}

// Giriş / Kayıt modal aç-kapat
function openAuthModal(tab) {
    document.getElementById('auth-modal').classList.add('open');
    switchAuthTab(tab || 'login');
    clearAuthError();
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('open');
    clearAuthError();
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-form`).style.display = 'block';
    clearAuthError();
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearAuthError() {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// Kayıt ol
async function handleRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2= document.getElementById('reg-password2').value;

    clearAuthError();

    if (!username || !email || !password) return showAuthError('Tüm alanları doldurun');
    if (password !== password2) return showAuthError('Şifreler eşleşmiyor');
    if (password.length < 6) return showAuthError('Şifre en az 6 karakter olmalı');

    const btn = document.getElementById('reg-btn');
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor...';

    try {
        const res = await fetch(API + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) return showAuthError(data.error || 'Kayıt başarısız');

        saveAuth(data.token, data.user);
        closeAuthModal();
        updateAuthUI();
    } catch (err) {
        showAuthError('Sunucu hatası, tekrar deneyin');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Kayıt Ol';
    }
}

// Giriş yap
async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    clearAuthError();
    if (!username || !password) return showAuthError('Kullanıcı adı ve şifre zorunlu');

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Giriş yapılıyor...';

    try {
        const res = await fetch(API + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) return showAuthError(data.error || 'Giriş başarısız');

        saveAuth(data.token, data.user);
        closeAuthModal();
        updateAuthUI();
    } catch (err) {
        showAuthError('Sunucu hatası, tekrar deneyin');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Giriş Yap';
    }
}

// Çıkış yap
function handleLogout() {
    clearAuth();
    updateAuthUI();
    const section = document.getElementById('continue-section');
    if (section) section.style.display = 'none';
}

// Enter tuşu ile form gönder
function authKeyDown(e, action) {
    if (e.key === 'Enter') action();
}

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
        renderRow('movies-row', allData.filter(s => s.type === 'movie'));

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
    ['popular-row', 'series-row', 'movies-row'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>İçerik yüklenemedi</p></div>';
    });
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
    document.getElementById('hero-desc').textContent = item.description || 'Keşfet ve izle.';

    const ratingEl = document.getElementById('hero-rating');
    if (item.rating) ratingEl.textContent = '⭐ ' + item.rating + '/10';

    const yearEl = document.getElementById('hero-year');
    if (item.releaseYear) yearEl.textContent = item.releaseYear;

    const catsEl = document.getElementById('hero-cats');
    if (item.categories?.length) catsEl.textContent = item.categories.slice(0, 2).join(' • ');

    document.getElementById('hero-play-btn').style.display = '';
    document.getElementById('hero-info-btn').style.display = '';
}

function heroPlay() { if (heroData) openDetail(heroData._id, true); }
function heroInfo() { if (heroData) openDetail(heroData._id, false); }

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

    list.forEach(item => { row.innerHTML += createCard(item); });
}

function createCard(item) {
    const type = item.type === 'movie' ? 'movie' : 'series';
    const typeLabel = type === 'movie' ? 'Film' : 'Dizi';
    const typeCls = type === 'movie' ? 'badge-movie' : 'badge-series';
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
        <span class="icon">${type === 'movie' ? '🎬' : '📺'}</span>
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

function formatSeconds(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
}

function createContinueCard(watch) {
    const item = watch.seriesId;
    if (!item || !item._id) return '';
    const episode = watch.episodeId;
    const progressText = formatSeconds(watch.progress);
    const episodeTitle = episode?.title ? ` • ${esc(episode.title)}` : '';
    const imgHtml = item.poster
        ? `<img class="card-img" src="${esc(item.poster)}" alt="${esc(item.title)}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
        : '';
    const placeholderStyle = item.poster ? 'display:none' : '';
    const episodeId = episode?._id || watch.episodeId || '';

    return `
    <div class="card continue-card" onclick="openContinueWatch('${item._id}', '${episodeId}')">
      ${imgHtml}
      <div class="card-placeholder" style="${placeholderStyle}">
        <span class="icon">▶</span>
        <span>${esc(item.title)}</span>
      </div>
      <span class="badge-type badge-continue">Kaldığın yer</span>
      <div class="card-overlay">
        <button class="card-overlay-play" onclick="event.stopPropagation();openContinueWatch('${item._id}', '${episodeId}')">▶</button>
        <div class="card-overlay-title">${esc(item.title)}</div>
        <div class="card-overlay-meta">${progressText}${episodeTitle}</div>
      </div>
    </div>`;
}

async function openContinueWatch(seriesId, episodeId) {
    if (!episodeId) return openDetail(seriesId, true);
    await openDetail(seriesId, false);
    await playEpisode(episodeId);
}

async function loadContinueWatching() {
    const section = document.getElementById('continue-section');
    const row = document.getElementById('continue-row');
    if (!section || !row) return;

    if (!currentAuthUser) {
        section.style.display = 'none';
        row.innerHTML = '';
        return;
    }

    try {
        const res = await fetch(API + '/progress/continue/list', {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const watches = await res.json();
        const html = (watches || []).map(createContinueCard).filter(Boolean).join('');
        if (!html) {
            section.style.display = 'none';
            return;
        }
        row.innerHTML = html;
        section.style.display = '';
    } catch (err) {
        console.error('Continue watching error:', err);
        section.style.display = 'none';
    }
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
        const res = await fetch(API + '/series/search/' + encodeURIComponent(query));
        const results = await res.json();

        const grid = document.getElementById('search-grid');
        grid.innerHTML = '';
        results.forEach(item => { grid.innerHTML += createCard(item); });

        document.getElementById('search-count').textContent =
            results.length + ' sonuç: "' + query + '"';
        resultsEl.style.display = '';
        mainEl.style.display = 'none';
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

    if (type === 'series') renderRow('series-row', allData.filter(s => s.type === 'series'));
    else if (type === 'movie') renderRow('movies-row', allData.filter(s => s.type === 'movie'));
}

function showAll(btn) {
    currentFilter = null;
    setActiveNavBtn(btn);
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('main-sections').style.display = '';
    document.getElementById('popular-section').style.display = '';
    document.getElementById('series-section').style.display = '';
    document.getElementById('movies-section').style.display = '';
    renderRow('popular-row', allData.slice(0, 12));
    renderRow('series-row', allData.filter(s => s.type === 'series'));
    renderRow('movies-row', allData.filter(s => s.type === 'movie'));
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

        const heroImg = document.getElementById('modal-hero-img');
        heroImg.style.backgroundImage = series.poster
            ? `url('${series.poster}')`
            : 'linear-gradient(135deg,#1a1a2e,#16213e)';

        document.getElementById('modal-title').textContent = series.title;

        const meta = [];
        if (series.rating) meta.push(`<span class="rating">⭐ ${series.rating}/10</span>`);
        if (series.releaseYear) meta.push(`<span>${series.releaseYear}</span>`);
        if (series.type) meta.push(`<span>${series.type === 'movie' ? '🎬 Film' : '📺 Dizi'}</span>`);
        if (series.categories?.length) meta.push(`<span>${series.categories.join(', ')}</span>`);
        document.getElementById('modal-meta').innerHTML = meta.join('<span style="color:#444">•</span>');

        document.getElementById('modal-desc').textContent = series.description || 'Açıklama yok.';

        const actions = document.getElementById('modal-actions');
        if (series.type === 'movie') {
            actions.innerHTML = `<button class="btn-play" onclick="playMovieDirect()">▶ İzle</button>`;
        } else {
            actions.innerHTML = `<button class="btn-play" onclick="playFirstEpisode()">▶ İzle</button>`;
        }

        const area = document.getElementById('seasons-area');
        if (series.type === 'series' && series.seasons?.length) {
            renderSeasonsArea(series.seasons);
        } else if (series.type === 'movie') {
            area.innerHTML = '';
        } else {
            area.innerHTML = '<p style="color:var(--muted2);font-size:.85rem">Sezon bulunamadı.</p>';
        }

        document.getElementById('detail-modal').classList.add('open');

        if (autoPlay) {
            if (series.type === 'movie') playMovieDirect();
            else playFirstEpisode();
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
    const seasons = currentSeries.seasons || [];
    for (const s of seasons) {
        if (s.episodes && s.episodes.length) {
            playEpisode(s.episodes[0]._id, true);
            return;
        }
    }
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

        if (!episode || !episode.videoUrl) {
            console.error('[playEpisode] videoUrl yok:', episode);
            return;
        }

        currentEpisode = episode;

        const videoPlayer    = document.getElementById('video-player');
        const videoSource    = document.getElementById('video-source');
        const embedContainer = document.getElementById('embed-player');

        embedContainer.innerHTML = '';
        embedContainer.style.display = 'none';
        videoPlayer.style.display = 'block';

        const src = episode.videoUrl || '';

        function toDriveEmbed(url) {
            if (url.includes('/preview')) return url;
            const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
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

        if (/^\s*</.test(src) && src.includes('iframe')) {
            videoPlayer.pause();
            videoPlayer.style.display = 'none';
            embedContainer.innerHTML = src;
            const iframeEl = embedContainer.querySelector('iframe');
            if (iframeEl) iframeEl.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0';
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
            if (currentAuthUser) {
                await loadProgress(episodeId);
                videoPlayer.ontimeupdate = () => saveProgress(episodeId);
            }
        } else if (src) {
            showIframe(src);
        }

        let infoText = '';
        if (currentSeason) {
            infoText = `S${pad(currentSeason.seasonNumber)}E${pad(episode.episodeNumber)}: ${episode.title}`;
        } else {
            infoText = episode.title || (currentSeries?.title || '');
        }
        document.getElementById('player-ep-info').textContent = infoText;

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
    video.ontimeupdate = null;
    if (currentAuthUser) loadContinueWatching();
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
// PROGRESS — Kaldığın Yerden Devam
// ═══════════════════════════════════════════
async function saveProgress(episodeId) {
    if (!currentAuthUser) return;

    const video = document.getElementById('video-player');
    const progress = Math.floor(video.currentTime);
    if (!progress || !currentSeries?._id || !episodeId) return;

    try {
        await fetch(API + '/progress', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                seriesId: currentSeries._id,
                episodeId,
                progress
            })
        });
    } catch (err) { /* silent */ }
}

async function loadProgress(episodeId) {
    if (!currentAuthUser) return;

    try {
        const res = await fetch(API + '/progress/' + encodeURIComponent(episodeId), {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.progress > 0) {
            document.getElementById('video-player').currentTime = data.progress;
        }
    } catch (err) { /* silent */ }
}

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pad(n) {
    return String(n || 0).padStart(2, '0');
}