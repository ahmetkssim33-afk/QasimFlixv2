const mongoose = require('mongoose');

// SERIES
const seriesSchema = new mongoose.Schema({
  title:       { type: String, required: true, unique: true },
  description: String,
  poster:      String,
  categories:  [String],
  releaseYear: Number,
  rating:      { type: Number, default: 0, min: 0, max: 10 },
  type:        { type: String, enum: ['series', 'movie', 'documentary'], default: 'series' },
  createdAt:   { type: Date, default: Date.now }
});

// SEASON
const seasonSchema = new mongoose.Schema({
  seriesId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Series', required: true },
  seasonNumber: { type: Number, required: true },
  title:        String,
  description:  String,
  releaseDate:  Date,
  createdAt:    { type: Date, default: Date.now }
});

// EPISODE
const episodeSchema = new mongoose.Schema({
  seasonId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Season', required: true },
  seriesId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Series', required: true },
  episodeNumber: { type: Number, required: true },
  title:         { type: String, required: true },
  description:   String,
  videoUrl:      { type: String, required: true },
  subtitles: [{ language: { type: String, default: 'TR' }, vttContent: String }],
  duration:    Number,
  thumbnail:   String,
  createdAt:   { type: Date, default: Date.now }
});

// WATCH PROGRESS
const watchProgressSchema = new mongoose.Schema({
  userId:        String,
  seriesId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Series' },
  episodeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Episode' },
  progress:      Number,
  lastWatchedAt: { type: Date, default: Date.now }
});

// CATEGORY
const categorySchema = new mongoose.Schema({ name: { type: String, unique: true, required: true } });

// FILM (legacy)
const filmSchema = new mongoose.Schema({
  ad:       { type: String, required: true },
  type:     { type: String },
  kategori: { type: String },
  video:    { type: String },
  thumb:    { type: String },
  puan:     { type: Number, default: 0 }
});

// USER
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: String,
  name: String,
  savedSeries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Series' }],
  savedFilms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Film' }],
  createdAt: { type: Date, default: Date.now }
});

const Series       = mongoose.models.Series       || mongoose.model('Series', seriesSchema);
const Season       = mongoose.models.Season       || mongoose.model('Season', seasonSchema);
const Episode      = mongoose.models.Episode      || mongoose.model('Episode', episodeSchema);
const WatchProgress= mongoose.models.WatchProgress|| mongoose.model('WatchProgress', watchProgressSchema);
const Category     = mongoose.models.Category     || mongoose.model('Category', categorySchema);
const Film         = mongoose.models.Film         || mongoose.model('Film', filmSchema);
const User         = mongoose.models.User         || mongoose.model('User', userSchema);

module.exports = { Series, Season, Episode, WatchProgress, Category, Film, User };
