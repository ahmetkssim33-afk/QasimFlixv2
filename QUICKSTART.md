#!/bin/bash
# Quick Start Guide for StreamFlix

echo "🎬 StreamFlix - Quick Start Guide"
echo "=================================="
echo ""

echo "STEP 1: Install Dependencies"
echo "----------------------------"
echo "Run this command:"
echo "npm install"
echo ""

echo "STEP 2: Start MongoDB"
echo "-------------------"
echo "Make sure MongoDB is running:"
echo "  Windows: mongod"
echo "  Mac/Linux: brew services start mongodb-community"
echo ""

echo "STEP 3: Start Server"
echo "-------------------"
echo "Run this command:"
echo "npm start"
echo ""

echo "STEP 4: Access Application"
echo "------------------------"
echo "👨‍💼 Admin Panel:  http://localhost:3000/admin.html"
echo "🎭 Frontend:     http://localhost:3000/index.html"
echo ""

echo "STEP 5: Add Content (Admin Panel)"
echo "--------------------------------"
echo "1. Go to Admin Panel"
echo "2. 📺 Manage Series → Add a series"
echo "3. 🎞️ Manage Seasons → Add seasons"
echo "4. 🎥 Manage Episodes → Add episodes with video URLs"
echo "5. Add subtitles in VTT format"
echo ""

echo "VIDEO URL EXAMPLE:"
echo "https://example.com/videos/episode1.mp4"
echo "or"
echo "https://media.example.com/episode.webm"
echo ""

echo "VTT SUBTITLE EXAMPLE:"
cat << 'EOF'
WEBVTT

00:00:00.000 --> 00:00:05.000
This is the first subtitle line.

00:00:05.000 --> 00:00:10.000
This is the second subtitle line.
EOF

echo ""
echo ""
echo "✅ You're ready to go!"
echo "🎬 Open http://localhost:3000/index.html to see your content"
