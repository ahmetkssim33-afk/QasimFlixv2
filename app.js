// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const API = window.location.origin + '/api';
const USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);

let heroData = null;
let currentSeries = null;
let currentSeason = null;
let currentEpisode = null;
let currentFilter = null; // null=all, 'series', 'movie'
let allData = []; // global cache for all content

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
window.addEventListener('load', async () => {
    await loadAll();
});

window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

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
        renderRow('movies-row', allData.filter(s => s.type === 'movie'));

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

    // Re-render rows from cached data to ensure content shows
    if (type === 'series') {
        renderRow('series-row', allData.filter(s => s.type === 'series'));
    } else if (type === 'movie') {
        renderRow('movies-row', allData.filter(s => s.type === 'movie'));
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

    // Re-render all rows from cached data
    renderRow('popular-row', allData.slice(0, 12));
    renderRow('series-row', allData.filter(s => s.type === 'series'));
    renderRow('documentaries-row', allData.filter(s => (s.categories||[]).some(c => (c||'').toLowerCase() === 'documentary' || (c||'').toLowerCase() === 'belgesel')));
    renderRow('movies-row', allData.filter(s => s.type === 'movie'));
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
        if (series.type) meta.push(`<span>${series.type === 'movie' ? '🎬 Film' : '📺 Dizi'}</span>`);
        if (series.categories?.length) meta.push(`<span>${series.categories.join(', ')}</span>`);
        document.getElementById('modal-meta').innerHTML = meta.join('<span style="color:#444">•</span>');

        document.getElementById('modal-desc').textContent = series.description || 'Açıklama yok.';

        // Action buttons
        const actions = document.getElementById('modal-actions');
        if (series.type === 'movie') {
            actions.innerHTML = `
                <button class="btn-play" onclick="playMovieDirect()">▶ İzle</button>`;
        } else {
            actions.innerHTML = `
                <button class="btn-play" onclick="playFirstEpisode()">▶ İzle</button>`;
        }

        // Seasons / Episodes
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
            if (series.type === 'movie') {
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
async function saveProgress(episodeId) {
    const video = document.getElementById('video-player');
    const progress = Math.floor(video.currentTime);
    if (!progress) return;
    try {
        await fetch(API + '/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: USER_ID,
                seriesId: currentSeries?._id,
                episodeId,
                progress
            })
        });
    } catch (err) { /* silent */ }
}

async function loadProgress(episodeId) {
    try {
        const res = await fetch(API + '/progress/' + USER_ID + '/' + episodeId);
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
