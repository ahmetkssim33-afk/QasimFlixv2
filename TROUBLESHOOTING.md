# 🔧 Troubleshooting Guide

## Common Issues & Solutions

---

## ❌ Server Won't Start

### Issue: Command not found or port already in use

**Error:** 
```
Error: listen EADDRINUSE :::3000
```

**Solution 1: Port already in use**
```bash
# Kill process using port 3000
# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# On Mac:
lsof -ti:3000 | xargs kill -9

# On Linux:
fuser -k 3000/tcp
```

**Solution 2: Change port**
Edit `server.js`:
```javascript
const PORT = process.env.PORT || 3001;  // Change to 3001
```

---

## ❌ MongoDB Connection Failed

### Issue: Can't connect to MongoDB

**Error:**
```
MongoServerError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution 1: Start MongoDB**
```bash
# On Windows (if installed):
net start MongoDB

# On Mac (with Homebrew):
brew services start mongodb-community

# On Linux:
sudo systemctl start mongod

# Or start manually:
mongod
```

**Solution 2: Check connection string**
In `server.js`, verify:
```javascript
const MONGODB_URI = 'mongodb://127.0.0.1:27017/streamingDB';
```

**Solution 3: MongoDB not installed**
```bash
# Install MongoDB
# Windows: Download from mongodb.com
# Mac: brew install mongodb-community
# Linux: sudo apt-get install mongodb
```

**Solution 4: Use MongoDB Atlas (Cloud)**
In `server.js`:
```javascript
const MONGODB_URI = 'mongodb+srv://username:password@cluster.mongodb.net/streamingDB';
```

---

## ❌ Frontend Not Loading

### Issue: Page won't load or shows blank

**Error:** Network error, 404, or blank page

**Solution 1: Server not running**
- Ensure `npm start` is running
- Check terminal shows "Server running on port 3000"

**Solution 2: Wrong port**
- Verify using http://localhost:3000/index.html
- Not localhost:8000 or other ports

**Solution 3: CORS error**
Check browser console (F12 → Console tab):
```
Access to XMLHttpRequest blocked by CORS policy
```

In `server.js`, ensure CORS is enabled:
```javascript
app.use(cors());
```

**Solution 4: File not found**
Check terminal shows files being served

---

## ❌ Videos Won't Play

### Issue: Video player shows but no video plays

**Error:** 
- Black screen
- "MEDIA_ERR_SRC_NOT_SUPPORTED"
- "Network error"

**Solution 1: Invalid video URL**
- Test URL directly in browser
- URL must return actual video file
- Should be direct .mp4/.webm link, not HTML page

**Valid:**
```
https://example.com/video.mp4
https://storage.googleapis.com/sample.mp4
```

**Invalid:**
```
https://youtube.com/watch?v=...  (streaming site)
https://example.com/page/       (HTML page)
```

**Solution 2: CORS error on video**
```
Cross-Origin Request Blocked
```

- Video must be accessible from browser
- May need video host to enable CORS
- Some hosts block video playback

**Solution 3: Unsupported format**
Supported formats:
- .mp4 (H.264 codec)
- .webm (VP8/VP9 codec)
- .ogg (Theora codec)

Convert with ffmpeg:
```bash
ffmpeg -i video.mov -c:v libx264 output.mp4
```

**Solution 4: Wrong URL in database**
In admin panel:
- Copy full URL exactly
- Test URL in browser first
- Ensure URL doesn't change

---

## ❌ Subtitles Not Showing

### Issue: Subtitle dropdown empty or subtitles invisible

**Error:**
- "No subtitles available"
- Subtitle option exists but text not visible

**Solution 1: VTT format incorrect**
Check VTT content format:
```
WEBVTT

00:00:00.000 --> 00:00:05.000
First subtitle line

00:00:05.000 --> 00:00:10.000
Second subtitle line
```

Common mistakes:
- Missing "WEBVTT" at start
- Wrong timestamp format (use HH:MM:SS.MMM)
- Missing blank line between entries

**Solution 2: Language not set**
In admin panel, add subtitle with language:
- Select language from dropdown
- Paste VTT content
- Click "Add Subtitle"

**Solution 3: Subtitle not loaded**
In database, check `subtitles` array has entries:
```bash
db.episodes.findOne({})  # Check in MongoDB
```

Should show:
```json
"subtitles": [
  {
    "language": "EN",
    "vttContent": "WEBVTT\n..."
  }
]
```

**Solution 4: Browser doesn't support**
- Use Chrome, Firefox, Safari (not IE)
- Check browser console for errors

---

## ❌ Admin Panel Not Working

### Issue: Forms don't submit or data not saving

**Error:**
- Form submission fails silently
- No success/error message
- Data doesn't appear in lists

**Solution 1: Server not running**
- Start backend: `npm start`
- Check in browser DevTools → Network tab

**Solution 2: API error (check console)**
F12 → Console tab → Look for red errors:

```javascript
POST http://localhost:3000/api/series 404
```

- Endpoint doesn't exist
- Check `server.js` routes match

**Solution 3: Invalid form data**
- Title field empty
- Type must be "series" or "movie"
- URL format incorrect

**Solution 4: MongoDB not saving**
```bash
# Check MongoDB is running
# Verify data in MongoDB:
mongo
use streamingDB
db.series.find()
```

---

## ❌ Search Not Working

### Issue: Search returns no results

**Error:**
- Search box returns empty
- No error shown
- All searches fail

**Solution 1: Database empty**
- Add content first via admin panel
- Search needs content to find

**Solution 2: Case sensitivity**
- Try different cases: "Breaking", "breaking", "BREAKING"
- API searches titles and descriptions

**Solution 3: Partial search**
```
Works: search "break" → finds "Breaking Bad"
Works: search "bad" → finds "Breaking Bad"
```

**Solution 4: Server error**
- Check browser console
- Check server terminal for errors
- Verify MongoDB running

---

## ❌ Progress Not Saving

### Issue: Watch progress lost when refreshing

**Error:**
- Progress resets to 0
- "Continue Watching" empty
- Resume position not working

**Solution 1: User ID not set**
- Each user needs unique ID
- Frontend uses random ID by default
- Check browser console logs

**Solution 2: API not called**
In browser console:
```javascript
// Should see POST requests to /api/progress
```

Check DevTools → Network tab

**Solution 3: MongoDB not storing**
- Verify MongoDB running
- Check watchprogress collection:
```bash
mongo
use streamingDB
db.watchprogress.find()
```

**Solution 4: Progress collection not created**
- Collection auto-creates on first insert
- Try watching any episode
- Check if collection appears

---

## ❌ Categories Not Working

### Issue: Series categories empty or not filtering

**Error:**
- Category dropdown empty
- Filter by category returns nothing
- Categories not showing on series

**Solution 1: Categories not seeded**
In `server.js`, categories auto-create on first run
- Restart server: `npm start`
- Check MongoDB:
```bash
mongo
use streamingDB
db.categories.find()
```

**Solution 2: Series not assigned categories**
- When creating series, enter categories
- Use comma-separated: "Drama, Crime, Thriller"
- Check admin panel success message

**Solution 3: Category name mismatch**
- Category filter is case-sensitive
- Use exact names from category list

---

## ❌ Page Crashes or Freezes

### Issue: Application becomes unresponsive

**Error:**
- Page hangs
- CPU usage high
- Browser unresponsive

**Solution 1: Large dataset**
- Too many series loaded at once
- Use pagination (already implemented)
- Check server logs for errors

**Solution 2: Memory leak**
- Refresh browser: Ctrl+Shift+Delete
- Clear cache and cookies
- Close and reopen

**Solution 3: Infinite loop in code**
- Check browser console for errors
- Clear browser cache
- Restart server

**Solution 4: Network timeout**
- Check internet connection
- Verify server running
- Try different video URL

---

## ❌ CORS Errors

### Issue: Requests blocked by CORS policy

**Error:**
```
Access to XMLHttpRequest at 'http://localhost:3000/api/series' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**
In `server.js`, verify CORS is enabled:
```javascript
const cors = require('cors');
app.use(cors());  // Must be early in middleware
```

---

## ❌ Mobile Not Working

### Issue: App doesn't work on phone

**Error:**
- Page doesn't load
- Layout broken
- Can't interact with elements

**Solution 1: Wrong IP address**
- Don't use localhost on phone
- Use computer IP: http://192.168.x.x:3000
- Find IP: `ipconfig` (Windows) or `ifconfig` (Mac)

**Solution 2: Firewall blocking**
- Check firewall allows port 3000
- Or disable temporarily for testing

**Solution 3: Responsive design issue**
- Check viewport meta tag in HTML:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**Solution 4: Touch events**
- Test on actual phone
- Some features may not work in phone browser

---

## ❌ Dependencies Issues

### Issue: npm install fails

**Error:**
```
npm ERR! No compatible version found
npm ERR! peer dependencies not met
```

**Solution 1: Clear cache**
```bash
npm cache clean --force
npm install
```

**Solution 2: Use exact versions**
In `package.json`:
```json
{
  "dependencies": {
    "express": "4.18.2",
    "mongoose": "7.5.0",
    "cors": "2.8.5",
    "multer": "1.4.5-lts.1"
  }
}
```

**Solution 3: Update npm**
```bash
npm install -g npm@latest
```

**Solution 4: Delete node_modules**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## ❌ Database Data Lost

### Issue: Data disappeared from database

**Error:**
- Series list empty
- Previously added content gone
- Fresh start needed

**Solution 1: Wrong database**
- Check MongoDB connected to right DB
- In `server.js`: `mongodb://127.0.0.1:27017/streamingDB`
- Ensure "streamingDB" correct

**Solution 2: Database reset**
```bash
# In MongoDB:
mongo
use streamingDB
db.series.deleteMany({})  # Careful!
```

**Solution 3: Backup database**
```bash
# Backup:
mongodump --db streamingDB --out backup/

# Restore:
mongorestore backup/streamingDB
```

---

## ❌ Performance Issues

### Issue: Application slow or laggy

**Error:**
- Slow page load
- Freezing during playback
- Network requests slow

**Solution 1: Too many series**
- Implement pagination (already done)
- Check `limit` parameter

**Solution 2: Large video file**
- Use compressed format
- Reduce resolution
- Use CDN for delivery

**Solution 3: Network bandwidth**
- Check internet speed
- Use smaller test videos
- Try different video URL

**Solution 4: Computer resources**
- Close other applications
- Free up RAM
- Check CPU usage

---

## ✅ Quick Diagnostic Checklist

Run these checks in order:

```
☑ Server running? (npm start)
☑ MongoDB running? (mongod)
☑ Frontend loads? (http://localhost:3000/index.html)
☑ Admin panel loads? (http://localhost:3000/admin.html)
☑ Can add series? (try in admin panel)
☑ Series appears in frontend? (refresh and check)
☑ Can click series? (opens detail modal)
☑ Can select season? (if series type)
☑ Can select episode? (shows play button)
☑ Video plays? (click play button)
☑ Subtitles available? (check dropdown)
☑ Progress saving? (watch and refresh)
☑ Search works? (search for title)
```

If all ☑ - System working perfectly!

---

## 📞 Need More Help?

1. **Check logs:**
   - Browser console: F12 → Console
   - Server terminal: look for errors
   - MongoDB shell: verify data

2. **Test with examples:**
   - Use EXAMPLES.md test data
   - Try curl commands
   - Verify endpoints respond

3. **Review documentation:**
   - README.md for overview
   - API.md for endpoints
   - QUICKSTART.md for setup

4. **Browser DevTools:**
   - Network tab: see API calls
   - Console tab: see errors
   - Application tab: see storage

5. **Reset and retry:**
   - Kill server: Ctrl+C
   - Restart: npm start
   - Try again

---

## 🎯 If All Else Fails

### Complete Reset

```bash
# Stop server
Ctrl+C

# Stop MongoDB
Ctrl+C

# Start MongoDB
mongod

# In another terminal:
# Delete old data
mongo
use streamingDB
db.dropDatabase()

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Start server
npm start

# Try again
```

---

**Still stuck? Check the browser console (F12) - most errors are reported there!**

**Happy troubleshooting! 🔧**
