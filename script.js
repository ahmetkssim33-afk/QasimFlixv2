// This file is deprecated. All functionality has been moved to app.js
// See app.js for the main application logic


// Başlangıç
// Backwards-compatible helper used by older `index.html` buttons
function kategori(tur) {
    // if user passed a known type, switch type; otherwise treat as category name
    if (tur === 'film' || tur === 'dizi' || tur === 'anime') {
        setType(tur);
    } else {
        // set category filter (keeps currentType)
        kategoriSec(tur);
    }
}

window.addEventListener('load', () => setType('film'));