# 📋 Example Data & API Tests

## Quick Test Data

You can use these examples to quickly populate your database with test content.

---

## Example 1: Breaking Bad Series

### Step 1: Create Series
```bash
curl -X POST http://localhost:3000/api/series \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Breaking Bad",
    "description": "A high school chemistry teacher, after being diagnosed with inoperable lung cancer, turns to manufacturing and selling methamphetamine with a former student to secure his family'\''s financial future.",
    "type": "series",
    "releaseYear": 2008,
    "rating": 9.5,
    "categories": ["Drama", "Crime", "Thriller"],
    "poster": "https://via.placeholder.com/300x400?text=Breaking+Bad"
  }'
```
**Response:** Copy the `_id` value (e.g., `61a1234567890`)

### Step 2: Create Season 1
```bash
curl -X POST http://localhost:3000/api/seasons \
  -H "Content-Type: application/json" \
  -d '{
    "seriesId": "PASTE_SERIES_ID_HERE",
    "seasonNumber": 1,
    "title": "Season 1",
    "description": "A high school chemistry teacher is diagnosed with terminal lung cancer. In desperation, he partners with a former student to manufacture methamphetamine."
  }'
```
**Response:** Copy the `_id` value

### Step 3: Create Episode 1
```bash
curl -X POST http://localhost:3000/api/episodes \
  -H "Content-Type: application/json" \
  -d '{
    "seasonId": "PASTE_SEASON_ID_HERE",
    "seriesId": "PASTE_SERIES_ID_HERE",
    "episodeNumber": 1,
    "title": "Pilot",
    "description": "High school chemistry teacher Walter White '\''s life takes a drastic turn when he receives a terminal lung cancer diagnosis.",
    "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4",
    "duration": 2700,
    "thumbnail": "https://via.placeholder.com/300x200?text=Breaking+Bad+EP1"
  }'
```
**Response:** Copy the `_id` value

### Step 4: Add English Subtitle
```bash
curl -X POST http://localhost:3000/api/episodes/PASTE_EPISODE_ID_HERE/subtitle \
  -H "Content-Type: application/json" \
  -d '{
    "language": "EN",
    "vttContent": "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nMy name is Walter Hartwell White.\n\n00:00:05.000 --> 00:00:10.000\nI live at 308 Negra Arroyo Lane.\n\n00:00:10.000 --> 00:00:15.000\nUboquerque, New Mexico 87111."
  }'
```

---

## Example 2: Movie (Single Episode)

### Create Movie
```bash
curl -X POST http://localhost:3000/api/series \
  -H "Content-Type: application/json" \
  -d '{
    "title": "The Shawshank Redemption",
    "description": "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    "type": "movie",
    "releaseYear": 1994,
    "rating": 9.3,
    "categories": ["Drama"],
    "poster": "https://via.placeholder.com/300x400?text=Shawshank"
  }'
```

### Create Season (required even for movies)
```bash
curl -X POST http://localhost:3000/api/seasons \
  -H "Content-Type: application/json" \
  -d '{
    "seriesId": "PASTE_SERIES_ID_HERE",
    "seasonNumber": 1,
    "title": "Full Movie"
  }'
```

### Create Episode (the movie itself)
```bash
curl -X POST http://localhost:3000/api/episodes \
  -H "Content-Type: application/json" \
  -d '{
    "seasonId": "PASTE_SEASON_ID_HERE",
    "seriesId": "PASTE_SERIES_ID_HERE",
    "episodeNumber": 1,
    "title": "The Shawshank Redemption",
    "description": "Full movie",
    "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4",
    "duration": 5400,
    "thumbnail": "https://via.placeholder.com/300x200?text=Shawshank"
  }'
```

---

## VTT Subtitle Examples

### English Subtitles
```
WEBVTT

00:00:00.000 --> 00:00:05.000
My name is Walter Hartwell White.

00:00:05.000 --> 00:00:10.000
I live at 308 Negra Arroyo Lane, Albuquerque, New Mexico, 87111.

00:00:10.000 --> 00:00:15.000
This is my confession.
```

### Turkish Subtitles
```
WEBVTT

00:00:00.000 --> 00:00:05.000
Benim adım Walter Hartwell White.

00:00:05.000 --> 00:00:10.000
308 Negra Arroyo Lane'de, Albuquerque, New Mexico'da yaşıyorum.

00:00:10.000 --> 00:00:15.000
Bu benim itirafım.
```

### Spanish Subtitles
```
WEBVTT

00:00:00.000 --> 00:00:05.000
Mi nombre es Walter Hartwell White.

00:00:05.000 --> 00:00:10.000
Vivo en 308 Negra Arroyo Lane, Albuquerque, Nuevo México.

00:00:10.000 --> 00:00:15.000
Esta es mi confesión.
```

---

## Get All Data

### Get All Series
```bash
curl http://localhost:3000/api/series
```

### Get Specific Series with Seasons & Episodes
```bash
curl http://localhost:3000/api/series/PASTE_SERIES_ID_HERE
```

### Search Series
```bash
curl http://localhost:3000/api/series/search/breaking
```

### Get Series by Category
```bash
curl http://localhost:3000/api/series/category/Drama
```

---

## Sample Video URLs

You can use these free video URLs for testing:

```
https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4

https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4

https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4

https://download.blender.org/demo/movies/BBB/bbb_sunflower_1080p_h264.mov
```

---

## Test Flow

1. **Create a Series** → Copy ID
2. **Create Season(s)** → Copy Season ID
3. **Create Episode(s)** → Copy Episode ID
4. **Add Subtitles** to Episode
5. **Visit Frontend** at http://localhost:3000/index.html
6. **Search or Browse** your content
7. **Click & Play** to watch!

---

## Troubleshooting

### Episode Won't Play
- Check that `videoUrl` is a direct link to a video file
- Verify the video URL is publicly accessible
- Check browser console for CORS errors

### Subtitles Not Showing
- Verify VTT format is correct (must start with `WEBVTT`)
- Ensure timestamps are properly formatted (HH:MM:SS.MMM)
- Check subtitle was added via POST endpoint

### Can't Find Content
- Ensure series was created successfully (check MongoDB)
- Search query must match series title or description
- Check filters (Series vs Movies)

---

## Database Verification

Connect to MongoDB:
```bash
mongosh
use streamingDB
db.series.find()
db.seasons.find()
db.episodes.find()
```

---

**Ready to test? Start with the Quick Start Guide!**
