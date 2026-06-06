const mongoose = require('mongoose');
mongoose.set('sanitizeFilter', true);

let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;

  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI Vercel Environment Variables içinde tanımlı değil. MongoDB Atlas bağlantı linkini ekleyin.');
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 0),
    });
    isConnected = true;
    console.log('MongoDB bağlantısı kuruldu');
  } catch (err) {
    isConnected = false;
    console.error('MongoDB bağlantı hatası:', err.message);
    throw err;
  }
}

module.exports = { connectDB, mongoose };
