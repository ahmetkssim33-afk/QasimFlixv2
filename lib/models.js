const mongoose = require('mongoose');

// SERIES
const seriesSchema = new mongoose.Schema({
  title:         { type: String, required: true, unique: true },
  description:   String, // generic/default description
  description_tr: String, // Turkish
  description_ar: String, // Arabic
  poster:        String,
  banner:        String,
  categories:    [String],
  releaseYear:   Number,
  rating:        { type: Number, default: 0, min: 0, max: 10 },
  tmdbId:        Number,
  tmdbType:      String,
  originalTitle: String,
  trailerUrl:    String,
  cast:          [String],
  tmdbPoster:    String,
  tmdbBackdrop:  String,
  // added 'yerli' for local series
  type:          { type: String, enum: ['series', 'movie', 'documentary', 'yerli'], default: 'series' },
  createdAt:     { type: Date, default: Date.now }
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
  linkStatus:  { type: String, enum: ['unknown','ok','broken','access_denied','empty'], default: 'unknown' },
  lastLinkCheckAt: Date,
  createdAt:   { type: Date, default: Date.now }
});

// WATCH PROGRESS
const watchProgressSchema = new mongoose.Schema({
  userId:        String,
  seriesId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Series' },
  episodeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Episode' },
  progress:      Number,
  isFavorite:    { type: Boolean, default: false },
  listStatus:    { type: String, enum: ['watchLater','liked','disliked','watched','none'], default: 'none' },
  isWatched:     { type: Boolean, default: false },
  lastWatchedAt: { type: Date, default: Date.now }
});


// CONTENT REQUESTS (Kullanıcı film/dizi isteği)
const contentRequestSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  requestType: { type: String, enum: ['movie','series','documentary','unknown'], default: 'unknown' },
  releaseYear: Number,
  note:        String,
  userId:      String,
  userName:    String,
  userEmail:   String,
  voteCount:   { type: Number, default: 1 },
  status:      { type: String, enum: ['open', 'done', 'rejected'], default: 'open' },
  createdAt:   { type: Date, default: Date.now },
  completedAt: Date
});


// ISSUE REPORTS (Kullanıcı sorun raporu)
const issueReportSchema = new mongoose.Schema({
  type:       { type: String, enum: ['bug', 'player', 'account', 'other'], default: 'bug' },
  message:    { type: String, required: true },
  pageUrl:    String,
  userAgent:  String,
  userId:     String,
  userName:   String,
  userEmail:  String,
  contact:    String,
  contentTitle: String,
  seriesId:    String,
  seasonNumber:Number,
  episodeNumber:Number,
  episodeId:   String,
  videoUrl:    String,
  errorType:   String,
  status:     { type: String, enum: ['open', 'read', 'resolved'], default: 'open' },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
  resolvedAt: Date
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
  profilePicture: String,
  savedSeries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Series' }],
  savedFilms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Film' }],
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Series' }],
  watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Series' }],
  profiles: [{ name: String, ageRestriction: Number, pinCode: String }], // Multiple profiles
  darkMode: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  verificationToken: String,
  resetToken: String,
  resetTokenExpiry: Date,
  preferredQuality: { type: String, enum: ['480p', '720p', '1080p'], default: '720p' },
  createdAt: { type: Date, default: Date.now }
});

// RATING & REVIEW
const ratingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'Series', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review: String,
  createdAt: { type: Date, default: Date.now }
});

// ADMIN ANALYTICS
const analyticsSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  totalWatches: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  uniqueViewers: { type: Number, default: 0 },
  mostWatchedSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'Series' },
  watchHeatmap: {}, // Track watch times by hour
  createdAt: { type: Date, default: Date.now }
});

// PUSH SUBSCRIPTIONS (FCM token kayıtları)
const pushSubscriptionSchema = new mongoose.Schema({
  token:      { type: String, required: true, unique: true },
  platform:   { type: String, default: 'web' },
  userId:     String,
  userName:   String,
  userEmail:  String,
  userAgent:  String,
  lastSeenAt: { type: Date, default: Date.now },
  createdAt:  { type: Date, default: Date.now }
});

// ANNOUNCEMENTS (Site içi duyurular)
const announcementSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  message:    { type: String, required: true },
  level:      { type: String, enum: ['info','success','warning','danger'], default: 'info' },
  isActive:   { type: Boolean, default: true },
  startsAt:   Date,
  endsAt:     Date,
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now }
});

// EMAIL LOG
const emailLogSchema = new mongoose.Schema({
  to: String,
  subject: String,
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
  createdAt: { type: Date, default: Date.now }
});

const Series        = mongoose.models.Series        || mongoose.model('Series', seriesSchema);
const Season        = mongoose.models.Season        || mongoose.model('Season', seasonSchema);
const Episode       = mongoose.models.Episode       || mongoose.model('Episode', episodeSchema);
const WatchProgress = mongoose.models.WatchProgress || mongoose.model('WatchProgress', watchProgressSchema);
const Category      = mongoose.models.Category      || mongoose.model('Category', categorySchema);
const Film          = mongoose.models.Film          || mongoose.model('Film', filmSchema);
const User          = mongoose.models.User          || mongoose.model('User', userSchema);
const Rating        = mongoose.models.Rating        || mongoose.model('Rating', ratingSchema);
const Analytics     = mongoose.models.Analytics     || mongoose.model('Analytics', analyticsSchema);
const EmailLog      = mongoose.models.EmailLog      || mongoose.model('EmailLog', emailLogSchema);
const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', pushSubscriptionSchema);
const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
const ContentRequest = mongoose.models.ContentRequest || mongoose.model('ContentRequest', contentRequestSchema);
const IssueReport = mongoose.models.IssueReport || mongoose.model('IssueReport', issueReportSchema);

module.exports = { Series, Season, Episode, WatchProgress, Category, Film, User, Rating, Analytics, EmailLog, PushSubscription, Announcement, ContentRequest, IssueReport };
