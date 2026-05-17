const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log("MongoDB bağlandı");
  } catch (err) {
    console.error(err);
  }
}

const seriesSchema = new mongoose.Schema({
  title: String,
  description: String,
  poster: String,
  categories: [String],
  releaseYear: Number,
  rating: Number,
  type: String
});

const seasonSchema = new mongoose.Schema({
  seriesId: mongoose.Schema.Types.ObjectId,
  seasonNumber: Number,
  title: String
});

const episodeSchema = new mongoose.Schema({
  seasonId: mongoose.Schema.Types.ObjectId,
  seriesId: mongoose.Schema.Types.ObjectId,
  episodeNumber: Number,
  title: String,
  description: String,
  videoUrl: String
});

const watchProgressSchema = new mongoose.Schema({
  userId: String,
  seriesId: mongoose.Schema.Types.ObjectId,
  episodeId: mongoose.Schema.Types.ObjectId,
  progress: Number,
  lastWatchedAt: {
    type: Date,
    default: Date.now
  }
});

const Series = mongoose.models.Series || mongoose.model("Series", seriesSchema);
const Season = mongoose.models.Season || mongoose.model("Season", seasonSchema);
const Episode = mongoose.models.Episode || mongoose.model("Episode", episodeSchema);
const WatchProgress = mongoose.models.WatchProgress || mongoose.model("WatchProgress", watchProgressSchema);

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.get("/api/series", async (req, res) => {
  try {
    const series = await Series.find().sort({ createdAt: -1 });
    res.json({ series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/series/:id", async (req, res) => {
  try {
    const series = await Series.findById(req.params.id).lean();

    if (!series) {
      return res.status(404).json({ error: "Seri bulunamadı" });
    }

    const seasons = await Season.find({
      seriesId: series._id
    }).sort({ seasonNumber: 1 }).lean();

    const seasonsWithEpisodes = await Promise.all(
      seasons.map(async (season) => {
        const episodes = await Episode.find({
          seasonId: season._id
        }).sort({ episodeNumber: 1 }).lean();

        return {
          ...season,
          episodes
        };
      })
    );

    res.json({
      ...series,
      seasons: seasonsWithEpisodes
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.post("/api/progress", async (req, res) => {
  try {
    const { userId, seriesId, episodeId, progress } = req.body;

    const updated = await WatchProgress.findOneAndUpdate(
      { userId, episodeId },
      {
        userId,
        seriesId,
        episodeId,
        progress,
        lastWatchedAt: new Date()
      },
      {
        upsert: true,
        new: true
      }
    );

    res.json(updated);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.get("/api/progress/continue/:userId", async (req, res) => {
  try {
    const data = await WatchProgress.find({
      userId: req.params.userId
    })
    .sort({ lastWatchedAt: -1 })
    .limit(10)
    .populate("seriesId")
    .populate("episodeId");

    res.json(data);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.get("/api", (req, res) => {
  res.json({
    status: "ok"
  });
});

module.exports = app;