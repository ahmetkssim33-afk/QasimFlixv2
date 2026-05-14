# 🎬 StreamFlix - Professional Streaming Platform

## Project Overview

A **Netflix-like streaming platform** built with **Node.js + MongoDB (Backend)** and **HTML5 + CSS3 + JavaScript (Frontend)**. 

This system allows users to:
- Browse series and movies with a professional UI
- View series → seasons → episodes hierarchy
- Watch videos with subtitle support (multiple languages)
- Continue watching where they left off
- Search content by title

Admins can:
- Manage series, seasons, and episodes
- Upload video URLs and thumbnails
- Add subtitles in multiple languages (VTT format)
- Organize content by categories

---

## 🏗️ Project Structure

```
film proje/
├── server.js              # Node.js backend server
├── admin.html             # Admin panel interface
├── admin.js              # Admin panel logic
├── index.html            # Main frontend interface
├── app.js                # Frontend application logic
├── style.css             # All styling (Netflix-like)
├── script.js             # Deprecated (use app.js)
├── package.json          # Node.js dependencies
└── README.md             # This file
```

---

## 📊 Database Schema

### **1. Series Collection**
```javascript
{
  _id: ObjectId,
  title: String,              // e.g., "Peaky Blinders"
  description: String,        // Series description
  poster: String,             // Image URL or base64
  categories: [String],       // ["Drama", "Crime"]
  releaseYear: Number,        // 2013
  rating: Number,             // 0-10
  type: "series" | "movie",   // 'series' or 'movie'
  createdAt: Date
}
```

### **2. Season Collection**
```javascript
{
  _id: ObjectId,
  seriesId: ObjectId,         // Reference to Series
  seasonNumber: Number,       // 1, 2, 3...
  title: String,              // Season title
  description: String,        // Season description
  releaseDate: Date,
  createdAt: Date
}
```

### **3. Episode Collection**
```javascript
{
  _id: ObjectId,
  seasonId: ObjectId,         // Reference to Season
  seriesId: ObjectId,         // Reference to Series
  episodeNumber: Number,      // 1, 2, 3...
  title: String,              // Episode title
  description: String,
  videoUrl: String,           // URL to MP4/WebM video
  subtitles: [{
    language: String,         // "EN", "TR", "ES"
    vttContent: String        // WebVTT subtitle content
  }],
  duration: Number,           // in seconds
  thumbnail: String,          // Image URL
  createdAt: Date
}
```

### **4. Watch Progress Collection**
```javascript
{
  _id: ObjectId,
  userId: String,             // User identifier
  seriesId: ObjectId,         // Series being watched
  episodeId: ObjectId,        // Episode being watched
  progress: Number,           // Seconds watched
  lastWatchedAt: Date
}
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v14+)
- **MongoDB** (running on `mongodb://127.0.0.1:27017`)
- Modern web browser

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Start MongoDB:**
```bash
# On Windows
mongod

# On Mac/Linux
brew services start mongodb-community
```

3. **Start the server:**
```bash
npm start
# Server runs on http://localhost:3000
```

4. **Access the application:**
- 🎭 Frontend: [http://localhost:3000/index.html](http://localhost:3000/index.html)
- 👨‍💼 Admin Panel: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 📝 API Endpoints

### Categories
```
GET    /api/categories              # Get all categories
```

### Series
```
GET    /api/series                  # Get all series (paginated)
GET    /api/series/:id              # Get series with seasons & episodes
GET    /api/series/search/:query    # Search series
GET    /api/series/category/:cat    # Get by category
POST   /api/series                  # Create series (Admin)
PUT    /api/series/:id              # Update series (Admin)
DELETE /api/series/:id              # Delete series (Admin)
```

### Seasons
```
GET    /api/seasons/:seriesId       # Get seasons of a series
POST   /api/seasons                 # Create season (Admin)
PUT    /api/seasons/:id             # Update season (Admin)
DELETE /api/seasons/:id             # Delete season (Admin)
```

### Episodes
```
GET    /api/episodes/season/:id     # Get episodes of a season
GET    /api/episodes/:id            # Get single episode
POST   /api/episodes                # Create episode (Admin)
POST   /api/episodes/:id/subtitle   # Add subtitle (Admin)
PUT    /api/episodes/:id            # Update episode (Admin)
DELETE /api/episodes/:id            # Delete episode (Admin)
```

### Watch Progress
```
POST   /api/progress                              # Save progress
GET    /api/progress/:userId/:episodeId          # Get progress
GET    /api/progress/continue/:userId            # Get continue watching
```

---

## 👨‍💼 Admin Panel Guide

### Adding a Series

1. Go to **Admin Panel** → **📺 Manage Series**
2. Fill in:
   - Series Title (required)
   - Type: Series or Movie
   - Description
   - Release Year
   - Rating (0-10)
   - Categories (comma-separated, e.g., "Drama, Crime, Thriller")
   - Poster Image URL

3. Click **✅ Add Series**

### Adding Seasons

1. Go to **🎞️ Manage Seasons**
2. Select a series
3. Fill in:
   - Season Number
   - Season Title
   - Description
4. Click **✅ Add Season**

### Adding Episodes

1. Go to **🎥 Manage Episodes**
2. Select Series → Select Season
3. Fill in:
   - Episode Number
   - Episode Title
   - Description
   - **Video URL** (direct link to .mp4 or .webm file)
   - Duration (in seconds, optional)
   - Thumbnail URL

4. Click **✅ Add Episode**

### Adding Subtitles

1. Go to **🎥 Manage Episodes** (bottom section)
2. Select an episode
3. Select language (TR, EN, ES, FR, DE)
4. Paste VTT subtitle content

**VTT Format Example:**
```
WEBVTT

00:00:00.000 --> 00:00:05.000
Welcome to the series!

00:00:05.000 --> 00:00:10.000
This is the second subtitle line.
```

---

## 📺 Frontend Features

### Homepage
- **Popular Section**: Featured series/movies
- **Series Section**: All TV series
- **Movies Section**: All movies
- **Search Bar**: Real-time content search

### Viewing Series
1. Click on any series card
2. See all seasons
3. Click a season to see episodes
4. Click an episode to play

### Video Player
- **HTML5 Video**: Full controls (play, pause, seek, volume)
- **Multiple Subtitles**: Switch between available languages
- **Progress Saving**: Automatically saves where you left off
- **Continue Watching**: Returns to your saved position

### Mobile Responsive
- Fully responsive design for all screen sizes
- Touch-friendly controls
- Optimized for mobile viewing

---

## 🎨 Frontend Pages

### `index.html`
Main user interface with:
- Netflix-style navbar
- Hero section with featured content
- Multiple content sections
- Series detail modal
- Video player modal with subtitles

### `admin.html`
Admin management interface with:
- Tabbed interface (Series, Seasons, Episodes)
- Forms for adding/managing content
- Real-time list updates
- Subtitle management

---

## 🔧 Configuration

### Change API URL
Edit in **app.js** and **admin.js**:
```javascript
const API = 'http://localhost:3000/api';
```

### Change MongoDB Connection
Edit in **server.js**:
```javascript
mongoose.connect("mongodb://127.0.0.1:27017/streamingDB")
```

### Change Server Port
Edit in **server.js**:
```javascript
const PORT = process.env.PORT || 3000;
```

---

## 📤 Sample Data

### Adding Test Content

1. **Create a Series:**
```bash
curl -X POST http://localhost:3000/api/series \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Breaking Bad",
    "description": "A high school chemistry teacher turned meth cook",
    "type": "series",
    "releaseYear": 2008,
    "rating": 9.5,
    "categories": ["Drama", "Crime", "Thriller"],
    "poster": "https://via.placeholder.com/300x400"
  }'
```

2. **Create a Season:**
Copy the series ID from response, then:
```bash
curl -X POST http://localhost:3000/api/seasons \
  -H "Content-Type: application/json" \
  -d '{
    "seriesId": "PASTE_SERIES_ID_HERE",
    "seasonNumber": 1,
    "title": "Season 1: Pilot",
    "description": "The series begins..."
  }'
```

3. **Create an Episode:**
```bash
curl -X POST http://localhost:3000/api/episodes \
  -H "Content-Type: application/json" \
  -d '{
    "seasonId": "PASTE_SEASON_ID_HERE",
    "seriesId": "PASTE_SERIES_ID_HERE",
    "episodeNumber": 1,
    "title": "Pilot",
    "description": "The first episode",
    "videoUrl": "https://example.com/episode1.mp4",
    "duration": 3600,
    "thumbnail": "https://via.placeholder.com/300x200"
  }'
```

---

## 🎯 Key Features

✅ **Series → Seasons → Episodes Hierarchy** - Proper structure, not flat video list

✅ **Video Player with Subtitles** - HTML5 player with VTT subtitle support

✅ **Multiple Languages** - Switch between different subtitle languages

✅ **Progress Tracking** - Automatically saves watch progress

✅ **Netflix-Like UI** - Modern, responsive, dark theme

✅ **Admin Panel** - Easy content management

✅ **Search Functionality** - Find series by title or description

✅ **Categorization** - Organize by genre

✅ **Mobile Responsive** - Works on all devices

✅ **Clean Code** - Well-organized, commented, production-ready

---

## 🔮 Future Enhancements

- User authentication & accounts
- Watchlist/Favorites
- User ratings & reviews
- Video recommendations
- Streaming quality settings
- Download episodes (offline)
- Social sharing
- Multi-user profiles
- Parental controls
- Analytics dashboard

---

## 🐛 Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running: `mongod`
- Check connection string in `server.js`
- Default: `mongodb://127.0.0.1:27017/streamingDB`

### CORS Error
- Backend should have CORS enabled (check `server.js`)
- Ensure API URL matches server URL in frontend

### Videos Not Playing
- Check video URL is accessible and valid format (mp4, webm)
- Ensure video URL is direct link (not HTML page)
- Check browser console for errors

### Subtitles Not Showing
- Verify VTT format is correct
- Check that subtitles are added to the episode
- Test in admin panel first

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review API endpoints
3. Check browser console for errors
4. Verify MongoDB is running
5. Ensure all dependencies are installed

---

## 📄 License

This project is a professional streaming platform template for educational purposes.

---

**Made with ❤️ for video streaming excellence**
