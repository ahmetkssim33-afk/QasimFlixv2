# 📚 API Documentation

Base URL: `http://localhost:3000/api`

---

## Categories Endpoints

### Get All Categories
```
GET /categories
```

**Response:**
```json
[
  { "_id": "...", "name": "Action" },
  { "_id": "...", "name": "Drama" },
  { "_id": "...", "name": "Thriller" }
]
```

---

## Series Endpoints

### Get All Series (Paginated)
```
GET /series?page=1&limit=12
```

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 12) - Items per page

**Response:**
```json
{
  "series": [
    {
      "_id": "...",
      "title": "Breaking Bad",
      "description": "...",
      "type": "series",
      "poster": "...",
      "rating": 9.5,
      "categories": ["Drama", "Crime"],
      "releaseYear": 2008,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "pages": 5,
  "currentPage": 1
}
```

---

### Get Series by ID with Seasons & Episodes
```
GET /series/:id
```

**Response:**
```json
{
  "_id": "...",
  "title": "Breaking Bad",
  "description": "...",
  "type": "series",
  "poster": "...",
  "rating": 9.5,
  "categories": ["Drama", "Crime"],
  "releaseYear": 2008,
  "seasons": [
    {
      "_id": "...",
      "seriesId": "...",
      "seasonNumber": 1,
      "title": "Season 1",
      "episodes": [
        {
          "_id": "...",
          "episodeNumber": 1,
          "title": "Pilot",
          "description": "...",
          "videoUrl": "...",
          "duration": 2700,
          "subtitles": [
            { "language": "EN", "vttContent": "..." },
            { "language": "TR", "vttContent": "..." }
          ]
        }
      ]
    }
  ]
}
```

---

### Search Series
```
GET /series/search/:query
```

**Example:**
```
GET /series/search/breaking
```

**Response:**
```json
[
  {
    "_id": "...",
    "title": "Breaking Bad",
    "description": "...",
    "type": "series",
    "poster": "...",
    "rating": 9.5,
    "categories": ["Drama", "Crime"],
    "releaseYear": 2008
  }
]
```

---

### Get Series by Category
```
GET /series/category/:category
```

**Example:**
```
GET /series/category/Drama
```

**Response:** Same as search results

---

### Create Series (Admin)
```
POST /series
```

**Request Body:**
```json
{
  "title": "Breaking Bad",
  "description": "A high school chemistry teacher...",
  "type": "series",
  "releaseYear": 2008,
  "rating": 9.5,
  "categories": ["Drama", "Crime", "Thriller"],
  "poster": "https://example.com/poster.jpg"
}
```

**Response:**
```json
{
  "_id": "...",
  "title": "Breaking Bad",
  ... (full series object)
}
```

---

### Update Series (Admin)
```
PUT /series/:id
```

**Request Body:** (any fields to update)
```json
{
  "title": "Breaking Bad",
  "rating": 9.6
}
```

---

### Delete Series (Admin)
```
DELETE /series/:id
```

**Note:** Deletes all associated seasons and episodes

**Response:**
```json
{}
```

---

## Seasons Endpoints

### Get Seasons of a Series
```
GET /seasons/:seriesId
```

**Response:**
```json
[
  {
    "_id": "...",
    "seriesId": "...",
    "seasonNumber": 1,
    "title": "Season 1",
    "description": "...",
    "releaseDate": "2008-01-20T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

---

### Create Season (Admin)
```
POST /seasons
```

**Request Body:**
```json
{
  "seriesId": "...",
  "seasonNumber": 1,
  "title": "Season 1",
  "description": "The first season..."
}
```

**Response:**
```json
{
  "_id": "...",
  "seriesId": "...",
  "seasonNumber": 1,
  "title": "Season 1",
  "description": "..."
}
```

---

### Update Season (Admin)
```
PUT /seasons/:id
```

**Request Body:** (any fields to update)
```json
{
  "title": "Season 1: Rise"
}
```

---

### Delete Season (Admin)
```
DELETE /seasons/:id
```

**Note:** Deletes all associated episodes

---

## Episodes Endpoints

### Get Episodes of a Season
```
GET /episodes/season/:seasonId
```

**Response:**
```json
[
  {
    "_id": "...",
    "seasonId": "...",
    "seriesId": "...",
    "episodeNumber": 1,
    "title": "Pilot",
    "description": "...",
    "videoUrl": "https://example.com/episode1.mp4",
    "duration": 2700,
    "thumbnail": "...",
    "subtitles": [
      {
        "language": "EN",
        "vttContent": "WEBVTT\n00:00:00.000 --> 00:00:05.000\nSubtitle line..."
      }
    ]
  }
]
```

---

### Get Single Episode
```
GET /episodes/:id
```

**Response:** (same as above, single object)

---

### Create Episode (Admin)
```
POST /episodes
```

**Request Body:**
```json
{
  "seasonId": "...",
  "seriesId": "...",
  "episodeNumber": 1,
  "title": "Pilot",
  "description": "The first episode...",
  "videoUrl": "https://example.com/episode1.mp4",
  "duration": 2700,
  "thumbnail": "https://example.com/thumb.jpg"
}
```

**Response:**
```json
{
  "_id": "...",
  "seasonId": "...",
  "seriesId": "...",
  "episodeNumber": 1,
  "title": "Pilot",
  "description": "...",
  "videoUrl": "...",
  "duration": 2700,
  "thumbnail": "...",
  "subtitles": []
}
```

---

### Add Subtitle to Episode (Admin)
```
POST /episodes/:id/subtitle
```

**Request Body:**
```json
{
  "language": "EN",
  "vttContent": "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nFirst subtitle\n\n00:00:05.000 --> 00:00:10.000\nSecond subtitle"
}
```

**Response:** (updated episode with subtitles)

---

### Update Episode (Admin)
```
PUT /episodes/:id
```

**Request Body:** (any fields to update)
```json
{
  "title": "Pilot - Special Edit",
  "duration": 2800
}
```

---

### Delete Episode (Admin)
```
DELETE /episodes/:id
```

---

## Watch Progress Endpoints

### Save Watch Progress
```
POST /progress
```

**Request Body:**
```json
{
  "userId": "user_123abc",
  "seriesId": "...",
  "episodeId": "...",
  "progress": 1500
}
```

**Response:**
```json
{
  "_id": "...",
  "userId": "user_123abc",
  "seriesId": "...",
  "episodeId": "...",
  "progress": 1500,
  "lastWatchedAt": "2024-01-15T10:30:00Z"
}
```

---

### Get Watch Progress
```
GET /progress/:userId/:episodeId
```

**Response:**
```json
{
  "_id": "...",
  "userId": "user_123abc",
  "seriesId": "...",
  "episodeId": "...",
  "progress": 1500,
  "lastWatchedAt": "2024-01-15T10:30:00Z"
}
```

**Note:** Returns `{ "progress": 0 }` if no progress saved

---

### Get Continue Watching
```
GET /progress/continue/:userId
```

**Response:**
```json
[
  {
    "_id": "...",
    "userId": "user_123abc",
    "seriesId": {
      "_id": "...",
      "title": "Breaking Bad",
      ...
    },
    "episodeId": "...",
    "progress": 1500,
    "lastWatchedAt": "2024-01-15T10:30:00Z"
  }
]
```

---

## Error Responses

### Not Found
```
404
{
  "error": "Series not found"
}
```

### Validation Error
```
400
{
  "error": "Season already exists"
}
```

### Server Error
```
500
{
  "error": "Internal server error"
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid data |
| 404 | Not Found - Resource not found |
| 500 | Server Error - Internal error |

---

## Rate Limiting

No rate limiting currently implemented. For production, consider adding rate limiting middleware.

---

## Authentication

Currently no authentication. For production:
- Add user authentication
- Restrict admin endpoints
- Use JWT tokens
- Implement role-based access control

---

## Testing with cURL

### Test Series Creation
```bash
curl -X POST http://localhost:3000/api/series \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test series","type":"series","rating":5}'
```

### Test Series Retrieval
```bash
curl http://localhost:3000/api/series
```

### Test Search
```bash
curl http://localhost:3000/api/series/search/breaking
```

---

## Postman Collection

You can import these endpoints into Postman for easier testing.

---

**For more examples, see EXAMPLES.md**
