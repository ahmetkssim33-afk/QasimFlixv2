const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/streamingDB';
  if (!uri) {
    console.error('❌ MONGODB_URI environment variable tanımlı değil!');
    return;
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('✅ MongoDB bağlantısı kuruldu');
  } catch (err) {
    console.error('❌ MongoDB bağlantı hatası:', err.message);
    isConnected = false;
  }
}

module.exports = { connectDB, mongoose };
