// QasimFlix TMDB helper — API key/token server-side only
// Env: TMDB_TOKEN (recommended API Read Access Token) or TMDB_API_KEY (v3 key)

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';

function getToken(){ return process.env.TMDB_TOKEN || process.env.TMDB_READ_ACCESS_TOKEN || ''; }
function getApiKey(){ return process.env.TMDB_API_KEY || ''; }
function isConfigured(){ return !!(getToken() || getApiKey()); }
function posterUrl(path, size='w500'){ return path ? `${TMDB_IMAGE}/${size}${path}` : ''; }
function backdropUrl(path, size='w1280'){ return path ? `${TMDB_IMAGE}/${size}${path}` : ''; }
function roundRating(v){ const n = Number(v || 0); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; }
function yearFrom(item){ return String(item?.release_date || item?.first_air_date || '').slice(0,4) || ''; }
function mediaFromInput(type){
  const raw = String(type || 'multi').toLowerCase();
  if (['movie','film'].includes(raw)) return 'movie';
  if (['tv','series','dizi','yerli'].includes(raw)) return 'tv';
  return 'multi';
}
function normalizeType(t){ return t === 'tv' ? 'series' : (t === 'movie' ? 'movie' : t); }
function pickTrailer(videos){
  const list = videos?.results || [];
  const preferred = list.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
                    list.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
                    list.find(v => v.site === 'YouTube');
  return preferred?.key ? `https://www.youtube.com/watch?v=${preferred.key}` : '';
}
function normalizeSearchItem(item){
  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
  if (!['movie','tv'].includes(mediaType)) return null;
  return {
    tmdbId: item.id,
    tmdbType: mediaType,
    type: normalizeType(mediaType),
    title: item.title || item.name || '',
    originalTitle: item.original_title || item.original_name || '',
    description: item.overview || '',
    releaseYear: Number(yearFrom(item)) || null,
    rating: roundRating(item.vote_average),
    poster: posterUrl(item.poster_path),
    banner: backdropUrl(item.backdrop_path),
    tmdbPoster: posterUrl(item.poster_path),
    tmdbBackdrop: backdropUrl(item.backdrop_path),
    popularity: item.popularity || 0
  };
}
function normalizeDetails(item, mediaType){
  const isMovie = mediaType === 'movie';
  const cast = (item.credits?.cast || []).slice(0,10).map(c => c.name).filter(Boolean);
  const duration = isMovie ? Number(item.runtime || 0) * 60 : Number((item.episode_run_time || [])[0] || 0) * 60;
  return {
    tmdbId: item.id,
    tmdbType: mediaType,
    type: normalizeType(mediaType),
    title: item.title || item.name || '',
    originalTitle: item.original_title || item.original_name || '',
    description: item.overview || '',
    description_tr: item.overview || '',
    releaseYear: Number(yearFrom(item)) || null,
    rating: roundRating(item.vote_average),
    categories: (item.genres || []).map(g => g.name).filter(Boolean),
    poster: posterUrl(item.poster_path),
    banner: backdropUrl(item.backdrop_path),
    tmdbPoster: posterUrl(item.poster_path),
    tmdbBackdrop: backdropUrl(item.backdrop_path),
    trailerUrl: pickTrailer(item.videos),
    cast,
    duration: duration || 0,
    externalIds: item.external_ids || {}
  };
}
async function tmdbFetch(path, params = {}){
  if (!isConfigured()) {
    const err = new Error('TMDB_TOKEN veya TMDB_API_KEY tanımlı değil.');
    err.statusCode = 503;
    throw err;
  }
  const url = new URL(TMDB_BASE + path);
  const query = { language: 'tr-TR', ...params };
  if (!getToken() && getApiKey()) query.api_key = getApiKey();
  Object.entries(query).forEach(([k,v]) => {
    if (v !== undefined && v !== null && String(v) !== '') url.searchParams.set(k, String(v));
  });
  const headers = { accept: 'application/json' };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const response = await fetch(url, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.status_message || data.error || `TMDB isteği başarısız: ${response.status}`);
    err.statusCode = response.status;
    throw err;
  }
  return data;
}
async function searchTMDB({ q, type='multi', language='tr-TR', page=1 } = {}){
  const query = String(q || '').trim();
  if (!query) return [];
  const media = mediaFromInput(type);
  const path = media === 'multi' ? '/search/multi' : `/search/${media}`;
  const data = await tmdbFetch(path, { query, language, page, include_adult: false });
  return (data.results || []).map(item => normalizeSearchItem({ ...item, media_type: item.media_type || media })).filter(Boolean).slice(0,16);
}
async function getTMDBDetails(mediaType, id, language='tr-TR'){
  const media = mediaFromInput(mediaType);
  if (!['movie','tv'].includes(media)) {
    const err = new Error('Geçersiz TMDB türü. movie veya tv olmalı.');
    err.statusCode = 400;
    throw err;
  }
  const data = await tmdbFetch(`/${media}/${encodeURIComponent(id)}`, { language, append_to_response: 'credits,videos,external_ids' });
  return normalizeDetails(data, media);
}
module.exports = { isConfigured, searchTMDB, getTMDBDetails, normalizeSearchItem, normalizeDetails };
