const API = window.location.origin + '/api';

// ═══════════════════════════════════════════════════════
// UI Functions
// ═══════════════════════════════════════════════════════

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');

    // Load data
    if (tabName === 'series') loadSeries();
    if (tabName === 'seasons') { loadSeriesForSeasons(); loadSeasons(); }
    if (tabName === 'episodes') { loadSeriesForEpisodes(); loadAllEpisodes(); }
}

function showMessage(elementId, message, isSuccess) {
    const msg = document.getElementById(elementId);
    msg.textContent = message;
    msg.className = `message ${isSuccess ? 'success' : 'error'}`;
    setTimeout(() => msg.className = 'message', 5000);
}

// ═══════════════════════════════════════════════════════
// SERIES Functions
// ═══════════════════════════════════════════════════════

async function addSeries(e) {
    e.preventDefault();

    const series = {
        title: document.getElementById('series-title').value,
        type: document.getElementById('series-type').value,
        description: document.getElementById('series-desc').value,
        releaseYear: parseInt(document.getElementById('series-year').value) || null,
        rating: parseFloat(document.getElementById('series-rating').value) || 0,
        categories: document.getElementById('series-categories').value
            .split(',')
            .map(c => c.trim())
            .filter(c => c),
        poster: document.getElementById('series-poster').value
    };

    try {
        const res = await fetch(API + '/series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(series)
        });

        if (res.ok) {
            showMessage('series-msg', '✅ Series added successfully!', true);
            e.target.reset();
            loadSeries();
            loadSeriesForSeasons();
            loadSeriesForEpisodes();
        } else {
            showMessage('series-msg', '❌ Error adding series', false);
        }
    } catch (err) {
        showMessage('series-msg', '❌ ' + err.message, false);
    }
}

async function loadSeries() {
    try {
        const res = await fetch(API + '/series?page=1&limit=100');
        const data = await res.json();

        const list = document.getElementById('series-list');
        list.innerHTML = '';

        if (!data.series || data.series.length === 0) {
            list.innerHTML = '<p style="color: #888;">No series yet. Add one to get started!</p>';
            return;
        }

        data.series.forEach(s => {
            list.innerHTML += `
                <div class="list-item">
                    <div>
                        <h3>${s.title}</h3>
                        <p style="color: #888; font-size: 0.9rem;">
                            ${s.type} | ${s.categories?.join(', ') || 'N/A'} | ⭐ ${s.rating}
                        </p>
                    </div>
                    <div class="list-actions">
                        <button class="btn-small btn-danger" onclick="deleteSeries('${s._id}')">🗑️ Delete</button>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error('Error loading series:', err);
    }
}

async function deleteSeries(id) {
    if (!confirm('Delete this series? (All seasons and episodes will also be deleted)')) return;

    try {
        const res = await fetch(API + '/series/' + id, { method: 'DELETE' });
        if (res.ok) {
            loadSeries();
            loadSeriesForSeasons();
            loadSeriesForEpisodes();
        }
    } catch (err) {
        console.error('Error deleting:', err);
    }
}

async function loadSeriesForSeasons() {
    try {
        const res = await fetch(API + '/series?page=1&limit=100');
        const data = await res.json();

        const select = document.getElementById('season-series-id');
        select.innerHTML = '<option value="">-- Choose Series --</option>';

        data.series.forEach(s => {
            select.innerHTML += `<option value="${s._id}">${s.title}</option>`;
        });
    } catch (err) {
        console.error('Error loading series:', err);
    }
}

async function loadSeriesForEpisodes() {
    try {
        const res = await fetch(API + '/series?page=1&limit=100');
        const data = await res.json();

        const select = document.getElementById('episode-series-id');
        select.innerHTML = '<option value="">-- Choose Series --</option>';

        data.series.forEach(s => {
            select.innerHTML += `<option value="${s._id}">${s.title}</option>`;
        });
    } catch (err) {
        console.error('Error loading series:', err);
    }
}

// ═══════════════════════════════════════════════════════
// SEASONS Functions
// ═══════════════════════════════════════════════════════

async function addSeason(e) {
    e.preventDefault();

    const season = {
        seriesId: document.getElementById('season-series-id').value,
        seasonNumber: parseInt(document.getElementById('season-number').value),
        title: document.getElementById('season-title').value,
        description: document.getElementById('season-desc').value
    };

    try {
        const res = await fetch(API + '/seasons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(season)
        });

        if (res.ok) {
            showMessage('season-msg', '✅ Season added successfully!', true);
            e.target.reset();
            loadSeasons();
        } else {
            const err = await res.json();
            showMessage('season-msg', '❌ ' + err.error, false);
        }
    } catch (err) {
        showMessage('season-msg', '❌ ' + err.message, false);
    }
}

async function loadSeasons() {
    try {
        const seriesId = document.getElementById('season-series-id').value;
        if (!seriesId) {
            document.getElementById('seasons-list').innerHTML = '<p style="color: #888;">Select a series first</p>';
            return;
        }

        const res = await fetch(API + '/seasons/' + seriesId);
        const seasons = await res.json();

        const list = document.getElementById('seasons-list');
        list.innerHTML = '';

        if (!seasons || seasons.length === 0) {
            list.innerHTML = '<p style="color: #888;">No seasons yet</p>';
            return;
        }

        seasons.forEach(s => {
            list.innerHTML += `
                <div class="list-item">
                    <div>
                        <h3>Season ${s.seasonNumber}: ${s.title}</h3>
                        <p style="color: #888; font-size: 0.9rem;">${s.description || 'No description'}</p>
                    </div>
                    <div class="list-actions">
                        <button class="btn-small btn-danger" onclick="deleteSeason('${s._id}')">🗑️ Delete</button>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error('Error loading seasons:', err);
    }
}

async function deleteSeason(id) {
    if (!confirm('Delete this season? (All episodes will also be deleted)')) return;

    try {
        const res = await fetch(API + '/seasons/' + id, { method: 'DELETE' });
        if (res.ok) {
            loadSeasons();
            loadAllEpisodes();
        }
    } catch (err) {
        console.error('Error deleting:', err);
    }
}

async function loadSeriesSeasons() {
    const seriesId = document.getElementById('episode-series-id').value;
    const seasonSelect = document.getElementById('episode-season-id');

    if (!seriesId) {
        seasonSelect.innerHTML = '<option value="">-- Choose Season --</option>';
        return;
    }

    try {
        const res = await fetch(API + '/seasons/' + seriesId);
        const seasons = await res.json();

        seasonSelect.innerHTML = '<option value="">-- Choose Season --</option>';
        seasons.forEach(s => {
            seasonSelect.innerHTML += `<option value="${s._id}">Season ${s.seasonNumber}: ${s.title}</option>`;
        });
    } catch (err) {
        console.error('Error loading seasons:', err);
    }
}

// ═══════════════════════════════════════════════════════
// EPISODES Functions
// ═══════════════════════════════════════════════════════

async function addEpisode(e) {
    e.preventDefault();

    const episode = {
        seasonId: document.getElementById('episode-season-id').value,
        seriesId: document.getElementById('episode-series-id').value,
        episodeNumber: parseInt(document.getElementById('episode-number').value),
        title: document.getElementById('episode-title').value,
        description: document.getElementById('episode-desc').value,
        videoUrl: document.getElementById('episode-video').value,
        duration: parseInt(document.getElementById('episode-duration').value) || 0,
        thumbnail: document.getElementById('episode-thumbnail').value
    };

    try {
        const res = await fetch(API + '/episodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(episode)
        });

        if (res.ok) {
            showMessage('episode-msg', '✅ Episode added successfully!', true);
            e.target.reset();
            loadAllEpisodes();
            loadEpisodesForSubtitles();
        } else {
            showMessage('episode-msg', '❌ Error adding episode', false);
        }
    } catch (err) {
        showMessage('episode-msg', '❌ ' + err.message, false);
    }
}

async function loadAllEpisodes() {
    try {
        const seriesId = document.getElementById('episode-series-id').value;
        if (!seriesId) {
            document.getElementById('episodes-list').innerHTML = '<p style="color: #888;">Select a series first</p>';
            return;
        }

        const res = await fetch(API + '/series/' + seriesId);
        const data = await res.json();

        const list = document.getElementById('episodes-list');
        list.innerHTML = '';

        if (!data.seasons || data.seasons.length === 0) {
            list.innerHTML = '<p style="color: #888;">No seasons yet</p>';
            return;
        }

        data.seasons.forEach(season => {
            if (!season.episodes || season.episodes.length === 0) return;
            season.episodes.forEach(ep => {
                list.innerHTML += `
                    <div class="list-item">
                        <div>
                            <h3>S${String(season.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}: ${ep.title}</h3>
                            <p style="color: #888; font-size: 0.9rem;">${ep.description || 'No description'}</p>
                            <p style="color: #888; font-size: 0.85rem;">Subtitles: ${ep.subtitles?.map(s => s.language).join(', ') || 'None'}</p>
                        </div>
                        <div class="list-actions">
                            <button class="btn-small btn-danger" onclick="deleteEpisode('${ep._id}')">🗑️ Delete</button>
                        </div>
                    </div>
                `;
            });
        });
    } catch (err) {
        console.error('Error loading episodes:', err);
    }
}

async function deleteEpisode(id) {
    if (!confirm('Delete this episode?')) return;

    try {
        const res = await fetch(API + '/episodes/' + id, { method: 'DELETE' });
        if (res.ok) {
            loadAllEpisodes();
            loadEpisodesForSubtitles();
        }
    } catch (err) {
        console.error('Error deleting:', err);
    }
}

async function loadEpisodesForSubtitles() {
    try {
        const seriesId = document.getElementById('episode-series-id').value;
        if (!seriesId) {
            document.getElementById('subtitle-episode-id').innerHTML = '<option value="">-- Choose Episode --</option>';
            return;
        }

        const res = await fetch(API + '/series/' + seriesId);
        const data = await res.json();

        const select = document.getElementById('subtitle-episode-id');
        select.innerHTML = '<option value="">-- Choose Episode --</option>';

        data.seasons.forEach(season => {
            season.episodes.forEach(ep => {
                select.innerHTML += `<option value="${ep._id}">S${season.seasonNumber}E${ep.episodeNumber}: ${ep.title}</option>`;
            });
        });
    } catch (err) {
        console.error('Error loading episodes:', err);
    }
}

// ═══════════════════════════════════════════════════════
// SUBTITLES Functions
// ═══════════════════════════════════════════════════════

async function addSubtitle(e) {
    e.preventDefault();

    const subtitle = {
        language: document.getElementById('subtitle-language').value,
        vttContent: document.getElementById('subtitle-content').value
    };

    const episodeId = document.getElementById('subtitle-episode-id').value;

    try {
        const res = await fetch(API + '/episodes/' + episodeId + '/subtitle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subtitle)
        });

        if (res.ok) {
            showMessage('episode-msg', '✅ Subtitle added successfully!', true);
            e.target.reset();
            loadAllEpisodes();
        } else {
            showMessage('episode-msg', '❌ Error adding subtitle', false);
        }
    } catch (err) {
        showMessage('episode-msg', '❌ ' + err.message, false);
    }
}

// ═══════════════════════════════════════════════════════
// ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════════════

async function loadAnalyticsDashboard() {
    try {
        const res = await fetch(API + '/admin/analytics');
        if (!res.ok) {
            console.error('Analytics error:', res.status);
            return;
        }
        
        const data = await res.json();
        const analyticsContainer = document.getElementById('analytics-container') || createAnalyticsContainer();
        
        let html = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:30px;">
                <div style="background:var(--accent); color:white; padding:20px; border-radius:8px; text-align:center;">
                    <div style="font-size:2.5rem; font-weight:bold;">${data.totalUsers}</div>
                    <div style="font-size:0.9rem; margin-top:5px;">Toplam Kullanıcı</div>
                </div>
                <div style="background:#6c63ff; color:white; padding:20px; border-radius:8px; text-align:center;">
                    <div style="font-size:2.5rem; font-weight:bold;">${data.totalWatches}</div>
                    <div style="font-size:0.9rem; margin-top:5px;">Toplam İzlenme</div>
                </div>
                <div style="background:#00d4aa; color:white; padding:20px; border-radius:8px; text-align:center;">
                    <div style="font-size:2.5rem; font-weight:bold;">${data.totalSeries}</div>
                    <div style="font-size:0.9rem; margin-top:5px;">Toplam İçerik</div>
                </div>
            </div>
            
            <h3 style="margin-top:30px; margin-bottom:15px;">En Popüler İçerikler</h3>
            <div style="background:var(--surface); border-radius:8px; overflow:hidden;">
        `;
        
        if (data.topSeries && data.topSeries.length > 0) {
            data.topSeries.forEach((series, idx) => {
                html += `
                    <div style="padding:15px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
                        <div><strong>${idx + 1}. ${series.title}</strong></div>
                        <div style="color:var(--muted);">⭐ ${series.rating}/10</div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        analyticsContainer.innerHTML = html;
    } catch (err) {
        console.error('Analytics error:', err);
    }
}

function createAnalyticsContainer() {
    const container = document.createElement('div');
    container.id = 'analytics-container';
    container.style.padding = '20px';
    const mainContent = document.querySelector('main') || document.body;
    mainContent.insertBefore(container, mainContent.firstChild);
    return container;
}

// ═══════════════════════════════════════════════════════
// EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════

async function sendNotificationEmail(userId, subject, message) {
    try {
        const res = await fetch(API + '/email/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, subject, message })
        });
        
        if (res.ok) {
            alert('Email gönderildi');
        } else {
            alert('Email gönderilemedi');
        }
    } catch (err) {
        console.error('Email error:', err);
        alert('Hata: ' + err.message);
    }
}

// ═══════════════════════════════════════════════════════
// BULK EMAIL NOTIFICATION (Tüm kullanıcılara)
// ═══════════════════════════════════════════════════════

async function sendBulkNotification() {
    const subject = prompt('Email konusu:');
    if (!subject) return;
    const message = prompt('Mesaj:');
    if (!message) return;
    
    // Bu, tüm kullanıcılara göndermek için bir batch job başlatır
    alert('Toplu email gönderme admin panelinde ayarlanmalıdır. Şu anda manuel gönderme desteklenmektedir.');
}

// Load data on page load
window.addEventListener('load', () => {
    loadSeriesForSeasons();
    loadSeriesForEpisodes();
    // Uncomment to load analytics on admin page load
    // loadAnalyticsDashboard();
});
